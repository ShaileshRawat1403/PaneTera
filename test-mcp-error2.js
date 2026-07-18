import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({ name: "Test", version: "1.0.0" });
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true
});
await server.connect(transport);

try {
  // 1. Initialize
  const req1 = new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({ method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c1', version: '1' } }, jsonrpc: '2.0', id: 0 })
  });
  const res1 = await transport._webStandardTransport.handleRequest(req1, {
    parsedBody: { method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c1', version: '1' } }, jsonrpc: '2.0', id: 0 }
  });
  console.log('Res1:', res1.status);

  // 2. Notification
  const req2 = new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25"
    },
    body: JSON.stringify({ method: 'notifications/initialized', jsonrpc: '2.0' })
  });
  const res2 = await transport._webStandardTransport.handleRequest(req2, {
    parsedBody: { method: 'notifications/initialized', jsonrpc: '2.0' }
  });
  console.log('Res2:', res2.status);
} catch (e) {
  console.error('THREW:', e);
}
