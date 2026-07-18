import { getRequestListener } from '@hono/node-server';
import http from 'http';

const handler = getRequestListener(async (req) => {
  return new Response(null, { status: 202 });
}, { overrideGlobalObjects: false });

const server = http.createServer(handler);
server.listen(4053, async () => {
  console.log('Listening on 4053');
  const res = await fetch('http://localhost:4053', { method: 'POST' });
  console.log('Response:', res.status, res.statusText);
  server.close();
});
