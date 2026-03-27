import net from 'node:net';

const REQUIRED_PORTS = [
  { port: 5173, label: 'Vite dev server' },
  { port: 8788, label: 'Local R2 API server' },
];

function ensurePortFree({ port, label }) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
        reject(new Error(`${label} requires port ${port}, but it is already in use.`));
        return;
      }

      reject(error instanceof Error ? error : new Error(`Failed to probe port ${port}.`));
    });

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });

    server.listen(port, '127.0.0.1');
  });
}

try {
  for (const entry of REQUIRED_PORTS) {
    // eslint-disable-next-line no-await-in-loop
    await ensurePortFree(entry);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown port availability error.';
  console.error(`dev startup aborted: ${message}`);
  process.exit(1);
}
