import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface GovernedStdioOptions {
  executablePath: string;
  argv: string[];
  cwd: string;
  env: Record<string, string>;
  idleTimeoutMs?: number;
  maxMessageBytes?: number;
  maxOutputBytes?: number;
}

export class GovernedStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T) => void;

  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = Buffer.alloc(0);
  private outputBytes = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private closeNotified = false;

  constructor(private readonly options: GovernedStdioOptions) {}

  async start(): Promise<void> {
    if (this.child) throw new Error('Governed stdio transport is already running.');
    const { executablePath, argv, cwd, env } = this.options;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executablePath, argv, {
        cwd,
        env,
        shell: false,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.child = child;

      const failed = (error: Error) => {
        reject(error);
        this.onerror?.(error);
      };
      child.once('error', failed);
      child.once('spawn', () => {
        child.off('error', failed);
        child.on('error', (error) => this.onerror?.(error));
        this.resetIdleTimer();
        resolve();
      });
      child.on('close', () => this.finishClose());
      child.stdin.on('error', (error) => this.onerror?.(error));
      child.stdout.on('error', (error) => this.onerror?.(error));
      child.stderr.on('error', (error) => this.onerror?.(error));
      child.stdout.on('data', (chunk: Buffer) => this.receive(chunk));
      child.stderr.on('data', (chunk: Buffer) => this.countOutput(chunk.length));
    });
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    const child = this.child;
    if (!child) throw new Error('Governed stdio transport is not connected.');
    const serialised = Buffer.from(`${JSON.stringify(message)}\n`, 'utf8');
    const maximum = this.options.maxMessageBytes ?? 1024 * 1024;
    if (serialised.length > maximum) throw new Error('MCP message exceeds the configured byte ceiling.');
    this.resetIdleTimer();
    await new Promise<void>((resolve, reject) => {
      child.stdin.write(serialised, (error) => error ? reject(error) : resolve());
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.clearIdleTimer();
    const child = this.child;
    this.child = null;
    if (!child) {
      this.onclose?.();
      return;
    }
    try { child.stdin.end(); } catch { /* already closed */ }
    await this.terminateProcessGroup(child, 'SIGTERM', 1200);
    if (child.exitCode === null && child.signalCode === null) {
      await this.terminateProcessGroup(child, 'SIGKILL', 300);
    }
    this.finishClose();
  }

  private receive(chunk: Buffer): void {
    this.countOutput(chunk.length);
    this.resetIdleTimer();
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const maximum = this.options.maxMessageBytes ?? 1024 * 1024;
    if (this.buffer.length > maximum && this.buffer.indexOf(10) < 0) {
      this.fail(new Error('MCP message exceeded the configured byte ceiling before termination.'));
      return;
    }
    while (true) {
      const newline = this.buffer.indexOf(10);
      if (newline < 0) return;
      const line = this.buffer.subarray(0, newline).toString('utf8').replace(/\r$/, '');
      this.buffer = this.buffer.subarray(newline + 1);
      if (!line) continue;
      if (Buffer.byteLength(line, 'utf8') > maximum) {
        this.fail(new Error('MCP message exceeds the configured byte ceiling.'));
        return;
      }
      try {
        const parsed = JSON.parse(line) as JSONRPCMessage;
        this.onmessage?.(parsed);
      } catch {
        this.fail(new Error('MCP server emitted invalid JSON.'));
        return;
      }
    }
  }

  private countOutput(bytes: number): void {
    this.outputBytes += bytes;
    if (this.outputBytes > (this.options.maxOutputBytes ?? 10 * 1024 * 1024)) {
      this.fail(new Error('MCP process exceeded the configured output ceiling.'));
    }
  }

  private fail(error: Error): void {
    this.onerror?.(error);
    void this.close();
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.fail(new Error('MCP process exceeded its idle timeout.'));
    }, this.options.idleTimeoutMs ?? 5 * 60_000);
    this.idleTimer.unref();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private async terminateProcessGroup(
    child: ChildProcessWithoutNullStreams,
    signal: NodeJS.Signals,
    waitMs: number,
  ): Promise<void> {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch { /* process already exited */ }
    if (child.exitCode !== null || child.signalCode !== null) return;
    await Promise.race([
      new Promise<void>((resolve) => child.once('close', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, waitMs).unref()),
    ]);
  }

  private finishClose(): void {
    if (!this.closed) this.closed = true;
    this.clearIdleTimer();
    this.child = null;
    if (!this.closeNotified) {
      this.closeNotified = true;
      this.onclose?.();
    }
  }
}
