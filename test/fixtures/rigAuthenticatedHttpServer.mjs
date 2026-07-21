import http from 'node:http';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const port = Number(process.env.PANETERA_FIXTURE_PORT || 4317);
const expectedBearer = process.env.PANETERA_FIXTURE_BEARER || '';
if (!expectedBearer) throw new Error('PANETERA_FIXTURE_BEARER is required.');

const app = express();
app.use(express.json());
app.post('/mcp', async (req, res) => {
  if (req.headers.authorization !== `Bearer ${expectedBearer}`) {
    res.status(401).json({ error: 'Unauthorized fixture request.' });
    return;
  }
  const server = new McpServer({ name: 'PaneTera authenticated acceptance fixture', version: '1.0.0' });
  server.tool('echo', { text: z.string() }, async ({ text }) => ({ content: [{ type: 'text', text }] }));
  server.resource('acceptance-note', 'fixture://authenticated-note', async () => ({
    contents: [{ uri: 'fixture://authenticated-note', text: 'Authenticated MCP resource retrieved.' }],
  }));
  server.prompt('greet', { name: z.string() }, ({ name }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Hello ${name}` } }],
  }));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
});

const server = http.createServer(app);
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`authenticated MCP fixture listening on ${port}\n`);
});

const close = () => server.close(() => process.exit(0));
process.on('SIGTERM', close);
process.on('SIGINT', close);
