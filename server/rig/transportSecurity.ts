import dns from 'dns';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { createHash } from 'crypto';
import { digest } from './canonical';
import type { HttpTransportSpec, StdioTransportSpec } from './types';
import { connectionIdFromAuthRef } from './keychain';

const SECRET_NAMES = /(?:token|secret|password|passwd|api[_-]?key|credential|authorization|cookie)/i;

export interface VerifiedLaunchSpec {
  executablePath: string;
  executableDigest: string;
  entryPointDigest: string | null;
  argv: string[];
  cwd: string;
  env: Record<string, string>;
  launchSpecDigest: string;
  isolationMode: 'none' | 'container';
}

async function fileDigest(filePath: string): Promise<string> {
  const bytes = await fs.promises.readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

export async function verifyStdioSpec(spec: StdioTransportSpec): Promise<VerifiedLaunchSpec> {
  if (!path.isAbsolute(spec.executablePath) || !path.isAbsolute(spec.cwd)) {
    throw new Error('Executable and working directory must be absolute paths.');
  }
  if (!Array.isArray(spec.argv) || spec.argv.some((arg) => typeof arg !== 'string')) {
    throw new Error('Arguments must be an ordered string array.');
  }
  const executablePath = await fs.promises.realpath(spec.executablePath);
  const cwd = await fs.promises.realpath(spec.cwd);
  const [executableInfo, cwdInfo] = await Promise.all([
    fs.promises.stat(executablePath),
    fs.promises.stat(cwd),
  ]);
  if (!executableInfo.isFile() || !cwdInfo.isDirectory()) throw new Error('Invalid executable or working directory.');

  const executableDigest = await fileDigest(executablePath);
  const runner = /^(?:node|python\d*|ruby|bash|sh|tsx)$/.test(path.basename(executablePath));
  let entryPointDigest: string | null = null;
  if (runner) {
    const entry = spec.argv[0];
    if (!entry || !path.isAbsolute(entry)) throw new Error('Interpreter connections require an absolute entry point.');
    const resolvedEntry = await fs.promises.realpath(entry);
    entryPointDigest = await fileDigest(resolvedEntry);
  }

  const env: Record<string, string> = { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' };
  const environmentForDigest: Array<Record<string, string>> = [];
  for (const binding of [...spec.environment].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(binding.name) || SECRET_NAMES.test(binding.name)) {
      throw new Error(`Environment binding ${binding.name} is not permitted.`);
    }
    if (binding.source === 'secret-ref') {
      throw new Error('Authenticated stdio connections require OS keychain integration.');
    }
    env[binding.name] = binding.value;
    environmentForDigest.push({ name: binding.name, source: binding.source, valueDigest: digest(binding.value) });
  }

  const launchSpecDigest = digest({
    executablePath,
    executableDigest,
    entryPointDigest,
    argv: spec.argv,
    cwd,
    environment: environmentForDigest,
    limitsProfile: 'rig-v1',
    isolationMode: spec.isolationMode,
  });
  return { executablePath, executableDigest, entryPointDigest, argv: [...spec.argv], cwd, env, launchSpecDigest, isolationMode: spec.isolationMode };
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd')
      || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')
      || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.');
  }
  return true;
}

export async function verifyHttpSpec(spec: HttpTransportSpec): Promise<{ url: URL; addresses: string[] }> {
  if (spec.authRef) connectionIdFromAuthRef(spec.authRef);
  const url = new URL(spec.url);
  const allowedProtocol = url.protocol === 'https:' || (spec.localDevelopment && url.protocol === 'http:');
  if (!allowedProtocol || url.username || url.password) throw new Error('MCP endpoint protocol or credentials are not permitted.');
  const results = await dns.promises.lookup(url.hostname, { all: true, verbatim: true });
  if (results.length === 0) throw new Error('MCP endpoint did not resolve.');
  const addresses = results.map(({ address }) => address);
  if (!spec.localDevelopment && addresses.some(isPrivateAddress)) {
    throw new Error('MCP endpoint resolves to a private or local network address.');
  }
  return { url, addresses };
}
