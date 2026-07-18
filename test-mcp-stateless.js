import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import express from 'express';
import http from 'http';

const app = express();
app.use(express.json());

const server = new McpServer({ name: "Test", version: "1.0.0" });
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true
});
await server.connect(transport);

app.post('/mcp', async (req, res, next) => {
  console.log('Received:', req.body);
  const oldEnd = res.end;
  res.end = function(...args) {
    console.log('Response status:', res.statusCode);
    return oldEnd.apply(this, args);
  }
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('Server error:', e);
    if (!res.headersSent) res.status(500).end();
  }
});

const httpServer = http.createServer(app);
httpServer.listen(4050, async () => {
  console.log('Listening on 4050');
  
  const client1 = new Client({ name: "c1", version: "1" }, { capabilities: {} });
  const t1 = new StreamableHTTPClientTransport("http://127.0.0.1:4050/mcp");
  
  console.log('Client 1 connecting...');
  try {
    await client1.connect(t1);
    console.log('Client 1 connected');
    const tools = await client1.listTools();
    console.log('Tools:', tools);
  } catch (e) {
    console.error('Client 1 fail:', e);
  }
  
  httpServer.close();
});
