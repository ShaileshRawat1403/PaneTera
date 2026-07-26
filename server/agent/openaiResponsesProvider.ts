import { createHash } from 'crypto';
import type {
  AgentModelInput,
  AgentModelProvider,
  AgentModelTurn,
  AgentToolCall,
} from './types';

export const DEFAULT_OPENAI_AGENT_MODEL = 'gpt-5.6-sol';

type FetchLike = typeof fetch;

export interface OpenAIResponsesProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  fetchImpl?: FetchLike;
  safetySeed?: string;
  timeoutMs?: number;
}

export class OpenAIResponsesProvider implements AgentModelProvider {
  readonly providerId = 'openai';
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly url: string;
  private readonly reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh';
  private readonly fetchImpl: FetchLike;
  private readonly safetyIdentifier: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAIResponsesProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('OpenAI API key is required.');
    this.apiKey = options.apiKey;
    this.modelId = validateModel(options.model?.trim() || DEFAULT_OPENAI_AGENT_MODEL);
    this.reasoningEffort = options.reasoningEffort || 'medium';
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = options.timeoutMs ?? 90_000;
    this.safetyIdentifier = createHash('sha256')
      .update(options.safetySeed || 'panetera-local-user')
      .digest('hex')
      .slice(0, 64);
    this.url = `${(options.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/responses`;
  }

  async generate(input: AgentModelInput): Promise<AgentModelTurn> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const forwardAbort = () => controller.abort();
    input.signal?.addEventListener('abort', forwardAbort, { once: true });

    try {
      const body: Record<string, unknown> = {
        model: this.modelId,
        instructions: input.instruction,
        reasoning: { effort: this.reasoningEffort },
        text: { verbosity: 'medium' },
        safety_identifier: this.safetyIdentifier,
        tools: input.tools.map((tool) => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: true,
        })),
      };

      if (input.previousResponseId && input.toolOutputs?.length) {
        body.previous_response_id = input.previousResponseId;
        body.input = input.toolOutputs.map((result) => ({
          type: 'function_call_output',
          call_id: result.callId,
          output: JSON.stringify(result.output),
        }));
      } else {
        body.input = [
          ...input.history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: 'user', content: input.objective },
        ];
      }

      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 2_000);
        throw new Error(`OpenAI Responses API error ${response.status}: ${detail}`);
      }

      const payload = await response.json() as Record<string, any>;
      const output = Array.isArray(payload.output) ? payload.output : [];
      const toolCalls: AgentToolCall[] = output.flatMap((item: any) => {
        if (item?.type !== 'function_call' || typeof item.name !== 'string') return [];
        return [{
          callId: String(item.call_id || item.id || ''),
          name: item.name,
          arguments: parseArguments(item.arguments),
        }];
      });
      const text = typeof payload.output_text === 'string'
        ? payload.output_text
        : output
          .filter((item: any) => item?.type === 'message')
          .flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
          .filter((item: any) => item?.type === 'output_text' && typeof item.text === 'string')
          .map((item: any) => item.text)
          .join('\n');

      if (typeof payload.id !== 'string') throw new Error('OpenAI response did not include a response identifier.');
      if (!text && toolCalls.length === 0) throw new Error('OpenAI response contained neither text nor tool calls.');

      return {
        text: cleanText(text),
        toolCalls,
        continuationId: payload.id,
        provider: this.providerId,
        model: this.modelId,
      };
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', forwardAbort);
    }
  }
}

function validateModel(model: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) {
    throw new Error('OPENAI_AGENT_MODEL contains unsupported characters.');
  }
  return model;
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function cleanText(value: string): string {
  return value
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .trim();
}
