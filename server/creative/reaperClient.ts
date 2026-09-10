// server/creative/reaperClient.ts
//
// Client for communicating with the live REAPER bridge on 127.0.0.1:9872.

import net from 'node:net';

const REAPER_HOST = '127.0.0.1';
const REAPER_PORT = 9872;
const TIMEOUT_MS = 4000;

export interface ReaperResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export function sendReaperCommand<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<ReaperResponse<T>> {
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
          error: 'Connection to live REAPER bridge timed out. Ensure panetera_reaper_bridge.lua is running in REAPER.',
        });
      }
    }, TIMEOUT_MS);

    socket.connect(REAPER_PORT, REAPER_HOST, () => {
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
              error: `Invalid JSON received from REAPER: ${String(err)}`,
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
          error: `Could not connect to REAPER on ${REAPER_HOST}:${REAPER_PORT} (${err.message})`,
        });
      }
    });
  });
}
