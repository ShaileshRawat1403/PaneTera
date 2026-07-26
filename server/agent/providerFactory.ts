import type { AgentModelProvider } from './types';
import { OpenAIResponsesProvider } from './openaiResponsesProvider';

export type AgentProviderId = 'openai' | 'google' | 'anthropic' | 'ollama' | 'openai-compatible';

export interface AgentProviderDescriptor {
  id: AgentProviderId;
  label: string;
  transport: 'responses' | 'generate-content' | 'messages' | 'openai-compatible';
  implemented: boolean;
}

/**
 * The model catalog is product configuration, not agent identity. All entries
 * must implement AgentModelProvider before they can receive PaneTera tools.
 */
export const AGENT_PROVIDER_CATALOG: readonly AgentProviderDescriptor[] = [
  { id: 'openai', label: 'OpenAI', transport: 'responses', implemented: true },
  { id: 'google', label: 'Google', transport: 'generate-content', implemented: false },
  { id: 'anthropic', label: 'Anthropic', transport: 'messages', implemented: false },
  { id: 'ollama', label: 'Local / Ollama', transport: 'openai-compatible', implemented: false },
  { id: 'openai-compatible', label: 'OpenAI-compatible endpoint', transport: 'openai-compatible', implemented: false },
] as const;

export function configuredAgentProvider(env: NodeJS.ProcessEnv = process.env): AgentModelProvider | null {
  const requested = (env.PANETERA_AGENT_PROVIDER || 'openai').trim().toLowerCase();
  if (requested !== 'openai') {
    throw new Error(
      `PANETERA_AGENT_PROVIDER=${requested} is not implemented in the governed runtime yet. ` +
      'PaneTera will not silently substitute a different provider.',
    );
  }
  if (!env.OPENAI_API_KEY) return null;
  const effort = parseReasoningEffort(env.OPENAI_REASONING_EFFORT);
  return new OpenAIResponsesProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_AGENT_MODEL,
    baseUrl: env.OPENAI_BASE_URL,
    reasoningEffort: effort,
    safetySeed: env.PANETERA_INSTALLATION_ID || 'panetera-local-user',
  });
}

function parseReasoningEffort(value: string | undefined): 'low' | 'medium' | 'high' | 'xhigh' {
  if (!value) return 'medium';
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh') return value;
  throw new Error('OPENAI_REASONING_EFFORT must be low, medium, high, or xhigh.');
}
