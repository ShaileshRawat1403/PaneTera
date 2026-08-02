// server/openaiStream.ts
//
// H3d: token streaming for the OpenAI chat operator. The provider's non-stream
// path returns a whole message; this consumes `stream: true` Server-Sent chunks,
// surfaces each text fragment through `onDelta` (which the operator run maps to a
// `model.delta` event over the same sink and SSE), and reassembles the final
// assistant message and tool calls identically to the non-stream path.
//
// The assembly is a pure accumulator so it is unit-tested without any network:
// feed it the JSON of each `data:` line, then call finish().

export interface StreamedTurn {
  content: string;
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  // Shaped exactly like the non-stream assistant message so it can be pushed to
  // the conversation and the next turn sees the same history.
  assistantMessage: Record<string, unknown>;
}

function safeJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Reassembles a streamed chat completion from its delta chunks. OpenAI streams
// text in `delta.content` fragments and tool calls in `delta.tool_calls`
// fragments keyed by index (id and name arrive once, arguments accrue as a
// string), so both are accumulated and finalized together.
export class ChatStreamAccumulator {
  private content = '';
  private readonly tools = new Map<number, { id: string; name: string; args: string }>();

  push(dataLine: string, onDelta?: (fragment: string) => void): void {
    const line = dataLine.trim();
    if (!line || line === '[DONE]') return;
    let json: any;
    try { json = JSON.parse(line); } catch { return; }
    const delta = json?.choices?.[0]?.delta;
    if (!delta) return;

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      this.content += delta.content;
      onDelta?.(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const call of delta.tool_calls) {
        const index = typeof call.index === 'number' ? call.index : 0;
        const entry = this.tools.get(index) ?? { id: '', name: '', args: '' };
        if (call.id) entry.id = call.id;
        if (call.function?.name) entry.name = call.function.name;
        if (typeof call.function?.arguments === 'string') entry.args += call.function.arguments;
        this.tools.set(index, entry);
      }
    }
  }

  finish(): StreamedTurn {
    const entries = [...this.tools.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value);
    const toolCalls = entries.map((tool) => ({ id: tool.id, name: tool.name, args: tool.args ? safeJsonObject(tool.args) : {} }));
    const assistantMessage: Record<string, unknown> = { role: 'assistant', content: this.content || null };
    if (entries.length > 0) {
      assistantMessage.tool_calls = entries.map((tool) => ({
        id: tool.id,
        type: 'function',
        function: { name: tool.name, arguments: tool.args },
      }));
    }
    return { content: this.content, toolCalls, assistantMessage };
  }
}

// Drives a fetch Response body (an OpenAI SSE stream) through the accumulator,
// splitting on blank lines and stripping the `data: ` prefix. Returns the fully
// reassembled turn once the stream ends.
export async function readOpenAIStream(
  response: { body: ReadableStream<Uint8Array> | null },
  onDelta?: (fragment: string) => void,
): Promise<StreamedTurn> {
  const accumulator = new ChatStreamAccumulator();
  const body = response.body;
  if (!body) return accumulator.finish();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const rawLine of rawEvent.split('\n')) {
        const line = rawLine.startsWith('data:') ? rawLine.slice(5) : rawLine;
        accumulator.push(line, onDelta);
      }
    }
  }
  if (buffer.trim()) {
    for (const rawLine of buffer.split('\n')) {
      const line = rawLine.startsWith('data:') ? rawLine.slice(5) : rawLine;
      accumulator.push(line, onDelta);
    }
  }
  return accumulator.finish();
}
