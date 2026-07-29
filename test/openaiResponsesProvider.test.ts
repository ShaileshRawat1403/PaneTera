import assert from 'assert';
import { OpenAIResponsesProvider } from '../server/agent/openaiResponsesProvider';
import { configuredAgentProvider } from '../server/agent/providerFactory';

async function main() {
  console.log('Running OpenAI Responses provider tests...');
  const requests: Array<{ url: string; body: any; headers: HeadersInit }> = [];
  const responses = [
    {
      id: 'resp_1',
      output: [{
        type: 'function_call',
        call_id: 'call_1',
        name: 'inspect',
        arguments: JSON.stringify({ target: 'README.md' }),
      }],
    },
    {
      id: 'resp_2',
      output_text: 'The file was inspected.',
      output: [],
    },
  ];
  const fakeFetch: typeof fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)),
      headers: init?.headers || {},
    });
    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const provider = new OpenAIResponsesProvider({
    apiKey: 'server-only-test-key',
    fetchImpl: fakeFetch,
    safetySeed: 'installation-test',
  });
  const common = {
    instruction: 'Be truthful.',
    objective: 'Inspect the readme.',
    history: [],
    tools: [{
      name: 'inspect',
      description: 'Inspect a file.',
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
        additionalProperties: false,
      },
      risk: 'observe' as const,
    }],
  };
  const first = await provider.generate(common);
  assert.strictEqual(first.toolCalls[0].name, 'inspect');
  assert.deepStrictEqual(first.toolCalls[0].arguments, { target: 'README.md' });
  assert.strictEqual(requests[0].url, 'https://api.openai.com/v1/responses');
  assert.strictEqual(requests[0].body.model, 'gpt-4o-mini');
  assert.strictEqual(requests[0].body.reasoning.effort, 'medium');
  assert.strictEqual(requests[0].body.tools[0].strict, true);
  assert.ok(requests[0].body.safety_identifier);
  assert.strictEqual(JSON.stringify(requests[0].body).includes('server-only-test-key'), false);

  const second = await provider.generate({
    ...common,
    previousResponseId: first.continuationId,
    toolOutputs: [{ callId: 'call_1', output: { content: 'hello' } }],
  });
  assert.strictEqual(second.text, 'The file was inspected.');
  assert.strictEqual(requests[1].body.previous_response_id, 'resp_1');
  assert.strictEqual(requests[1].body.input[0].type, 'function_call_output');
  assert.strictEqual(configuredAgentProvider({ PANETERA_AGENT_PROVIDER: 'openai' }), null);
  assert.throws(
    () => configuredAgentProvider({ PANETERA_AGENT_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'unused' }),
    /will not silently substitute/,
  );
  console.log('OpenAI Responses provider tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
