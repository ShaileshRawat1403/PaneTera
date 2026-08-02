import assert from 'assert';
import { ChatStreamAccumulator } from '../server/openaiStream';

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

function main() {
  console.log('Running OpenAI token-stream accumulator tests...');
  textStreamAssemblesAndEmitsDeltas();
  toolCallFragmentsReassemble();
  malformedChunksAreIgnored();
  console.log('OpenAI token-stream accumulator tests passed.');
}

main();
