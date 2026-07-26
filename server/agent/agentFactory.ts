import { AgentRuntime } from './runtime';
import { AgentRunStore } from './runStore';
import { configuredAgentProvider } from './providerFactory';
import { createCoreAgentCapabilities } from './capabilities';
import { createBrowserActionCapabilities } from './browserActionCapabilities';
import { createRigCapabilities, mergeCapabilities } from './rigCapabilities';
import { RigToolAdapter } from '../rig/adapter';
import { RigRuntime } from '../rig/runtime';
import { RigRegistry } from '../rig/registry';
import { getTesseraAppDataDir } from '../appData';

export interface AgentFactoryOptions {
  registry?: RigRegistry;
  runtime?: RigRuntime;
}

/**
 * Creates a configured AgentRuntime with all available capabilities.
 * This is the single entry point for creating a fully wired agent.
 *
 * Capabilities are merged in priority order:
 * 1. Core capabilities (workspace, browser, execution)
 * 2. Browser action capabilities (governed click proposals)
 * 3. Rig MCP capabilities (enabled tools from connected servers)
 */
export function createAgentRuntime(options: AgentFactoryOptions = {}): AgentRuntime | null {
  const provider = configuredAgentProvider();
  if (!provider) return null;

  const registry = options.registry || new RigRegistry();
  const runtime = options.runtime || new RigRuntime();

  const adapter = new RigToolAdapter(registry, runtime);

  const coreCapabilities = createCoreAgentCapabilities();
  const browserCapabilities = createBrowserActionCapabilities();
  const rigCapabilities = createRigCapabilities(adapter, runtime);

  const allCapabilities = mergeCapabilities(
    coreCapabilities,
    mergeCapabilities(browserCapabilities, rigCapabilities),
  );

  const store = new AgentRunStore(getTesseraAppDataDir());

  return new AgentRuntime(store, provider, allCapabilities);
}
