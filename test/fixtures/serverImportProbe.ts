// test/fixtures/serverImportProbe.ts
//
// Run in a child process by test/testIsolation.test.ts. Imports the server
// module and, in "start" mode, starts it, then reports what persisted where.

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

function records(): Array<{ connectionId: string; state: string; env: string[] }> {
  const file = path.join(process.env.TESSERA_APP_DATA as string, 'rig', 'connections.json');
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    connections: Array<{ connectionId: string; state: string; transport: { environment?: Array<{ name: string }> } }>;
  };
  return data.connections.map((record) => ({
    connectionId: record.connectionId,
    state: record.state,
    env: (record.transport.environment ?? []).map((binding) => binding.name),
  }));
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const port = Number(process.env.PROBE_PORT);
  const server = await import('../../server/index');

  if (mode === 'start') {
    const handle = server.startPaneTeraServer({ port });
    await new Promise((resolve) => handle.httpServer.once('listening', resolve));
    const report = { listening: await portOpen(port), records: records() };
    handle.httpServer.close();
    process.stdout.write(`PROBE ${JSON.stringify(report)}\n`);
    process.exit(0);
  }

  await new Promise((resolve) => setTimeout(resolve, 750));
  const dotenvLoaded = process.env.PANETERA_DOTENV_PROBE === 'loaded';
  process.stdout.write(`PROBE ${JSON.stringify({ listening: await portOpen(port), records: records(), dotenvLoaded })}\n`);
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stdout.write(`PROBE-ERROR ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
