import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import express from 'express';
import http from 'http';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: "Test", version: "1.0.0" });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  server.tool("test-tool", () => ({ content: [{ type: "text", text: "ok" }] }));
  await server.connect(transport);
  
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!res.headersSent) res.status(500).end();
  }
});
app.get('/mcp', (req, res) => res.status(405).end());

const httpServer = http.createServer(app);
httpServer.listen(4054, async () => {
  const client1 = new Client({ name: "c1", version: "1" }, { capabilities: {} });
  const t1 = new StreamableHTTPClientTransport("http://127.0.0.1:4054/mcp");
  
  try {
    await client1.connect(t1);
    console.log('Client 1 connected');
    const tools = await client1.listTools();
    console.log('Client 1 tools:', tools);
  } catch(e) {
    console.error('Client 1 failed:', e);
  }
  
  httpServer.close();
});
