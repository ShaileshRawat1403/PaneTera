// server/creative/blenderClient.ts
//
// Client for communicating with the live Blender Python socket bridge on 127.0.0.1:9871.

import net from 'node:net';

const BLENDER_HOST = '127.0.0.1';
const BLENDER_PORT = 9871;
const TIMEOUT_MS = 4000;

export interface BlenderResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export function sendBlenderCommand<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<BlenderResponse<T>> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let responseData = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({
          id: reqId,
          success: false,
          error: 'Connection to live Blender bridge timed out. Ensure panetera_blender_bridge.py is running in Blender.',
        });
      }
    }, TIMEOUT_MS);

    socket.connect(BLENDER_PORT, BLENDER_HOST, () => {
      const payload = JSON.stringify({ id: reqId, action, params }) + '\n';
      socket.write(payload);
    });

    socket.on('data', (chunk) => {
      responseData += chunk.toString('utf-8');
      if (responseData.includes('\n')) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.end();
          try {
            const parsed = JSON.parse(responseData.trim());
            resolve(parsed);
          } catch (err) {
            resolve({
              id: reqId,
              success: false,
              error: `Invalid JSON received from Blender: ${String(err)}`,
            });
          }
        }
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          id: reqId,
          success: false,
          error: `Could not connect to Blender on ${BLENDER_HOST}:${BLENDER_PORT} (${err.message})`,
        });
      }
    });
  });
}
