import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from 'express';

const server = new McpServer({ name: "Test", version: "1.0.0" });
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true
});
await server.connect(transport);

try {
  // Mock webRequest
  const webRequest = new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({ method: 'notifications/initialized', jsonrpc: '2.0' })
  });
  const res = await transport._webStandardTransport.handleRequest(webRequest, {});
  console.log('Result:', res);
} catch (e) {
  console.error('THREW:', e);
}
