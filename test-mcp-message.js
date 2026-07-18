import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({ name: "Test", version: "1.0.0" });
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true
});
await server.connect(transport);

try {
  await transport._webStandardTransport.onmessage({
    method: 'notifications/initialized',
    jsonrpc: '2.0'
  });
  console.log('Handled successfully');
} catch (e) {
  console.error('Error in onmessage:', e);
}
