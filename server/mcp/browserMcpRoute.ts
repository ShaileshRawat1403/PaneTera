import { Router, Request, Response, NextFunction } from 'express';
import { validateMcpClient } from './browserMcpAuth';
import { setupMcpServer } from './browserOperatorServer';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as crypto from 'crypto';

export const mcpRouter = Router();

mcpRouter.post('/', async (req: Request, res: Response) => {
  // 1. Authenticate and Validate Host/Origin
  const authValidation = validateMcpClient(req);
  if (authValidation.status !== 200) {
    return res.status(authValidation.status).json({ error: authValidation.error });
  }

  // 2. Body limits / content type
  // Note: Express body-parser should be configured globally with limits,
  // but we enforce JSON here.
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type: application/json required' });
  }

  if (Buffer.byteLength(JSON.stringify(req.body)) > 2000000) {
    return res.status(413).json({ error: 'Payload Too Large' });
  }

  // 3. Generate transaction ID
  const transactionId = crypto.randomUUID();

  // 4. Create server and transport
  const server = setupMcpServer(transactionId, authValidation.principal!);
  
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless
    enableJsonResponse: true       // JSON responses (no SSE)
  });

  try {
    await server.connect(transport);
    
    // 5. Handle Request
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('MCP Handling Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error processing MCP request' });
    }
  } finally {
    // 6. Cleanup
    try {
      await server.close();
      await transport.close();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});

// GET /mcp/browser -> 405 Method Not Allowed
mcpRouter.get('/', (req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({ error: 'Method Not Allowed' });
});

// DELETE /mcp/browser -> 405 Method Not Allowed
mcpRouter.delete('/', (req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({ error: 'Method Not Allowed' });
});
