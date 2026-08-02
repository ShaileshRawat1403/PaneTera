import assert from 'assert';
import { ChatStreamAccumulator, normalizeUsage } from '../server/openaiStream';

function textStreamAssemblesAndEmitsDeltas() {
  const acc = new ChatStreamAccumulator();
  const deltas: string[] = [];
  const chunks = [
    JSON.stringify({ choices: [{ delta: { role: 'assistant', content: '' } }] }),
    JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
    JSON.stringify({ choices: [{ delta: { content: ', world' } }] }),
    '[DONE]',
  ];
  for (const c of chunks) acc.push(c, (f) => deltas.push(f));
  const turn = acc.finish();

  assert.strictEqual(turn.content, 'Hello, world');
  assert.deepStrictEqual(deltas, ['Hello', ', world'], 'each non-empty fragment is emitted, in order');
  assert.strictEqual(turn.toolCalls.length, 0);
  assert.strictEqual(turn.assistantMessage.content, 'Hello, world');
}

function toolCallFragmentsReassemble() {
  const acc = new ChatStreamAccumulator();
  // Arguments arrive as a string split across chunks; id and name arrive once.
  const chunks = [
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'proposeExecution', arguments: '' } }] } }] }),
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"command":"npm ' } }] } }] }),
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'run build"}' } }] } }] }),
    '[DONE]',
  ];
  for (const c of chunks) acc.push(c);
  const turn = acc.finish();

  assert.strictEqual(turn.toolCalls.length, 1);
  assert.strictEqual(turn.toolCalls[0].id, 'call_1');
  assert.strictEqual(turn.toolCalls[0].name, 'proposeExecution');
  assert.deepStrictEqual(turn.toolCalls[0].args, { command: 'npm run build' }, 'fragmented arguments parse to the full object');
  assert.strictEqual(turn.content, '');
}

function malformedChunksAreIgnored() {
  const acc = new ChatStreamAccumulator();
  acc.push('not json');
  acc.push(JSON.stringify({ choices: [] }));
  acc.push(JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }));
  const turn = acc.finish();
  assert.strictEqual(turn.content, 'ok', 'a bad chunk does not corrupt the stream');
}

function usageChunkIsCaptured() {
  const acc = new ChatStreamAccumulator();
  const chunks = [
    JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] }),
    // The include_usage final chunk: empty choices, usage-only.
    JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } }),
    '[DONE]',
  ];
  for (const c of chunks) acc.push(c);
  const turn = acc.finish();
  assert.strictEqual(turn.content, 'Hi', 'the usage chunk does not disturb the content');
  assert.deepStrictEqual(turn.usage, { prompt: 12, completion: 5, total: 17 }, 'usage is captured from the final chunk');
}

function usageAbsentIsNull() {
  const acc = new ChatStreamAccumulator();
  acc.push(JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }));
  assert.strictEqual(acc.finish().usage, null, 'no usage chunk means null usage');
}

function normalizeUsageMapsAndDefends() {
  assert.deepStrictEqual(
    normalizeUsage({ prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }),
    { prompt: 3, completion: 4, total: 7 },
  );
  // total is derived when the provider omits it.
  assert.deepStrictEqual(normalizeUsage({ prompt_tokens: 3, completion_tokens: 4 }), { prompt: 3, completion: 4, total: 7 });
  assert.strictEqual(normalizeUsage(undefined), null, 'undefined usage is null');
  assert.strictEqual(normalizeUsage({}), null, 'an empty object is null');
}

function main() {
  console.log('Running OpenAI token-stream accumulator tests...');
  textStreamAssemblesAndEmitsDeltas();
  toolCallFragmentsReassemble();
  malformedChunksAreIgnored();
  usageChunkIsCaptured();
  usageAbsentIsNull();
  normalizeUsageMapsAndDefends();
  console.log('OpenAI token-stream accumulator tests passed.');
}

main();
