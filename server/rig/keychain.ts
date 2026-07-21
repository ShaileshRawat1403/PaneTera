import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { mkdir, stat } from 'fs/promises';
import { getTesseraAppDataDir } from '../appData';

const AUTH_REF_PREFIX = 'keychain:panetera-rig:';

function assertConnectionId(connectionId: string): void {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(connectionId)) {
    throw new Error('Invalid Rig credential account.');
  }
}

export function keychainAuthRef(connectionId: string): string {
  assertConnectionId(connectionId);
  return `${AUTH_REF_PREFIX}${connectionId}`;
}

export function connectionIdFromAuthRef(authRef: string): string {
  if (!authRef.startsWith(AUTH_REF_PREFIX)) throw new Error('Unsupported Rig credential reference.');
  const connectionId = authRef.slice(AUTH_REF_PREFIX.length);
  assertConnectionId(connectionId);
  return connectionId;
}

interface KeychainRequest {
  operation: 'store' | 'read' | 'delete';
  account: string;
  secret?: string;
}

const HELPER_PATH = fileURLToPath(new URL('./keychain-helper.c', import.meta.url));
const HELPER_BINARY = path.join(getTesseraAppDataDir(), 'rig', 'panetera-keychain-helper-v4');
let helperReady: Promise<void> | null = null;

function runProcess(executable: string, args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes <= 64 * 1024) target.push(chunk);
      else child.kill('SIGKILL');
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.once('error', reject);
    child.once('close', (code) => {
      if (outputBytes > 64 * 1024) return reject(new Error('Keychain response exceeded its safety limit.'));
      if (code !== 0) {
        const message = Buffer.concat(stderr).toString('utf8').trim();
        return reject(new Error(message || 'macOS Keychain operation failed.'));
      }
      resolve(Buffer.concat(stdout).toString('utf8').trimEnd());
    });
    child.stdin.end(stdin);
  });
}

async function ensureHelper(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Authenticated MCP connections require the macOS Keychain on this build.');
  }
  if (!helperReady) {
    helperReady = (async () => {
      await mkdir(path.dirname(HELPER_BINARY), { recursive: true, mode: 0o700 });
      try {
        const binary = await stat(HELPER_BINARY);
        if (binary.isFile()) return;
      } catch { /* compile the bundled helper once */ }
      await runProcess('/usr/bin/xcrun', [
        'clang', '-Wno-deprecated-declarations', HELPER_PATH,
        '-framework', 'Security', '-framework', 'CoreFoundation',
        '-o', HELPER_BINARY,
      ]);
    })().catch((error) => {
      helperReady = null;
      throw error;
    });
  }
  await helperReady;
}

async function runKeychainHelper(request: KeychainRequest): Promise<string> {
  await ensureHelper();
  return runProcess(HELPER_BINARY, [request.operation, request.account], request.secret);
}

export async function storeBearerCredential(connectionId: string, secret: string): Promise<string> {
  assertConnectionId(connectionId);
  if (!secret || Buffer.byteLength(secret, 'utf8') > 8192 || /[\r\n]/.test(secret)) {
    throw new Error('Bearer token must be a single line no larger than 8 KiB.');
  }
  // The helper uses Security.framework directly and receives the secret only
  // through stdin, so it never appears in argv or process listings.
  await runKeychainHelper({ operation: 'store', account: connectionId, secret });
  return keychainAuthRef(connectionId);
}

export async function readBearerCredential(authRef: string): Promise<string> {
  const connectionId = connectionIdFromAuthRef(authRef);
  const secret = await runKeychainHelper({ operation: 'read', account: connectionId });
  if (!secret) throw new Error('Rig credential is missing from the macOS Keychain.');
  return secret;
}

export async function deleteBearerCredential(authRef: string): Promise<void> {
  const connectionId = connectionIdFromAuthRef(authRef);
  await runKeychainHelper({ operation: 'delete', account: connectionId });
}
