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

app.use((req, res, next) => {
  const oldEnd = res.end;
  res.end = function(...args) {
    console.log(`[${req.method} ${req.url}] response status:`, res.statusCode);
    return oldEnd.apply(this, args);
  }
  next();
});

app.post('/mcp', async (req, res) => {
  console.log('Received payload:', req.body);
  try {
    await transport.handleRequest(req, res, req.body);
    console.log('handleRequest finished');
  } catch (e) {
    console.log('handleRequest threw:', e);
    if (!res.headersSent) res.status(500).end();
  }
});
app.get('/mcp', (req, res) => {
  console.log('GET request to /mcp');
  res.status(405).end();
});

const httpServer = http.createServer(app);
httpServer.listen(4052, async () => {
  const client1 = new Client({ name: "c1", version: "1" }, { capabilities: {} });
  const t1 = new StreamableHTTPClientTransport("http://127.0.0.1:4052/mcp");
  try {
    await client1.connect(t1);
    console.log('Client 1 connected');
  } catch(e) {
    console.log('Client 1 failed:', e);
  }
  httpServer.close();
});
