import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'PaneTera Rig fixture', version: '1.0.0' });

server.tool('echo', { text: z.string() }, async ({ text }) => ({
  content: [{ type: 'text', text }],
}));

server.resource('fixture-note', 'fixture://note', async (uri) => ({
  contents: [{ uri: uri.href, text: 'fixture resource' }],
}));

server.prompt('greet', { name: z.string() }, ({ name }) => ({
  messages: [{ role: 'user', content: { type: 'text', text: `Hello ${name}` } }],
}));

await server.connect(new StdioServerTransport());
