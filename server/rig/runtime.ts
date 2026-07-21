import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { capabilityCard, snapshotDigest } from './canonical';
import { createDestinationBoundFetch } from './boundFetch';
import { GovernedStdioTransport } from './governedStdio';
import { verifyHttpSpec, verifyStdioSpec, type VerifiedLaunchSpec } from './transportSecurity';
import type { CapabilityCard, CapabilitySnapshot, McpConnection } from './types';

const PAGE_LIMIT = 5;
const ITEM_LIMIT = 500;
const STARTUP_TIMEOUT_MS = 15_000;

interface ActiveConnection {
  client: Client;
  transport: Transport;
}

export interface ConnectedInventory {
  snapshot: CapabilitySnapshot;
  verifiedLaunch: VerifiedLaunchSpec | null;
  endpointRef: string;
}

export class RigRuntime {
  private active = new Map<string, ActiveConnection>();

  constructor(private readonly onFault?: (connectionId: string, error: Error) => void | Promise<void>) {}

  async connect(record: McpConnection): Promise<ConnectedInventory> {
    await this.disconnect(record.connectionId);
    let transport: Transport;
    let verifiedLaunch: VerifiedLaunchSpec | null = null;
    let endpointRef = record.endpointRef;

    if (record.transport.kind === 'stdio') {
      verifiedLaunch = await verifyStdioSpec(record.transport);
      endpointRef = verifiedLaunch.executablePath;
      transport = new GovernedStdioTransport({
        executablePath: verifiedLaunch.executablePath,
        argv: verifiedLaunch.argv,
        cwd: verifiedLaunch.cwd,
        env: verifiedLaunch.env,
      });
    } else {
      const verified = await verifyHttpSpec(record.transport);
      endpointRef = verified.url.toString();
      transport = new StreamableHTTPClientTransport(verified.url, {
        fetch: createDestinationBoundFetch(record.transport),
        reconnectionOptions: { maxReconnectionDelay: 10_000, initialReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1.5, maxRetries: 2 },
      });
    }

    const client = new Client({ name: 'panetera-rig', version: '1.0.0' });
    transport.onerror = () => undefined;
    try {
      await this.withTimeout(client.connect(transport), STARTUP_TIMEOUT_MS, 'MCP server did not initialize in time.');
    } catch (error) {
      try { await client.close(); } catch { try { await transport.close(); } catch { /* already closed */ } }
      throw error;
    }
    this.active.set(record.connectionId, { client, transport });
    const existingError = transport.onerror;
    const existingClose = transport.onclose;
    transport.onerror = (error) => {
      existingError?.(error);
      if (this.active.has(record.connectionId)) this.reportFault(record.connectionId, error);
    };
    transport.onclose = () => {
      existingClose?.();
      if (this.active.has(record.connectionId)) {
        this.active.delete(record.connectionId);
        this.reportFault(record.connectionId, new Error('MCP transport closed unexpectedly.'));
      }
    };

    try {
      const snapshot = await this.discover(record.connectionId, record.capabilities);
      return { snapshot, verifiedLaunch, endpointRef };
    } catch (error) {
      await this.disconnect(record.connectionId);
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const active = this.active.get(connectionId);
    this.active.delete(connectionId);
    if (!active) return;
    try { await active.client.close(); } catch { await active.transport.close(); }
  }

  async discover(connectionId: string, previous?: CapabilitySnapshot): Promise<CapabilitySnapshot> {
    const client = this.requireClient(connectionId);
    const [tools, resources, prompts] = await Promise.all([
      this.collectOptionalPages<Record<string, unknown>>(async (cursor) => {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        return { items: page.tools as unknown as Record<string, unknown>[], nextCursor: page.nextCursor };
      }),
      this.collectOptionalPages<Record<string, unknown>>(async (cursor) => {
        const page = await client.listResources(cursor ? { cursor } : undefined);
        return { items: page.resources as unknown as Record<string, unknown>[], nextCursor: page.nextCursor };
      }),
      this.collectOptionalPages<Record<string, unknown>>(async (cursor) => {
        const page = await client.listPrompts(cursor ? { cursor } : undefined);
        return { items: page.prompts as unknown as Record<string, unknown>[], nextCursor: page.nextCursor };
      }),
    ]);

    const preserve = (card: CapabilityCard): CapabilityCard => {
      const old = [...(previous?.tools ?? []), ...(previous?.resources ?? []), ...(previous?.prompts ?? [])]
        .find((candidate) => candidate.capabilityId === card.capabilityId);
      if (!old || old.structuralDigest !== card.structuralDigest) return card;
      return { ...card, enabled: old.enabled, permission: old.permission, description: old.description };
    };
    const snapshot: CapabilitySnapshot = {
      tools: tools.items.map((item) => preserve(capabilityCard(connectionId, 'tool', item))),
      resources: resources.items.map((item) => preserve(capabilityCard(connectionId, 'resource', item))),
      prompts: prompts.items.map((item) => preserve(capabilityCard(connectionId, 'prompt', item))),
      structuralDigest: '',
      presentationDigest: '',
      discoveredAt: new Date().toISOString(),
      truncated: tools.truncated || resources.truncated || prompts.truncated,
    };
    Object.assign(snapshot, snapshotDigest(snapshot));
    return snapshot;
  }

  async callTool(connectionId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.requireClient(connectionId).callTool({ name, arguments: args });
  }

  async readResource(connectionId: string, uri: string): Promise<unknown> {
    return this.requireClient(connectionId).readResource({ uri });
  }

  async getPrompt(connectionId: string, name: string, args: Record<string, string>): Promise<unknown> {
    return this.requireClient(connectionId).getPrompt({ name, arguments: args });
  }

  isConnected(connectionId: string): boolean {
    return this.active.has(connectionId);
  }

  private requireClient(connectionId: string): Client {
    const active = this.active.get(connectionId);
    if (!active) throw new Error('Rig connection is not active.');
    return active.client;
  }

  private reportFault(connectionId: string, error: Error): void {
    if (!this.onFault) return;
    Promise.resolve(this.onFault(connectionId, error)).catch((faultError: unknown) => {
      const message = faultError instanceof Error ? faultError.message : String(faultError);
      console.warn('[RigRuntime] Could not persist transport failure:', message);
    });
  }

  private async collectPages<T>(
    load: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>,
  ): Promise<{ items: T[]; truncated: boolean }> {
    const items: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < PAGE_LIMIT; page += 1) {
      const result = await load(cursor);
      items.push(...result.items.slice(0, Math.max(0, ITEM_LIMIT - items.length)));
      cursor = result.nextCursor;
      if (!cursor || items.length >= ITEM_LIMIT) return { items, truncated: Boolean(cursor) };
    }
    return { items, truncated: Boolean(cursor) };
  }

  private async collectOptionalPages<T>(
    load: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>,
  ): Promise<{ items: T[]; truncated: boolean }> {
    try {
      return await this.collectPages(load);
    } catch (error: unknown) {
      const candidate = error as { code?: number; message?: string };
      if (candidate?.code === -32601 || candidate?.message?.includes('Method not found')) {
        return { items: [], truncated: false };
      }
      throw error;
    }
  }

  private async withTimeout<T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
