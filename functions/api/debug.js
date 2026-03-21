// Temporary diagnostic endpoint — remove after diagnosis
import { connect } from 'cloudflare:sockets';

export async function onRequestGet(context) {
  const host = 'ac-yzbdjfa-shard-00-00.unxousw.mongodb.net';
  const port = 27017;
  const results = {};

  // Test 1: raw TCP via cloudflare:sockets
  try {
    const socket = connect({ hostname: host, port });
    const writer = socket.writable.getWriter();
    await Promise.race([
      writer.write(new Uint8Array([0])),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tcp connect timeout')), 5000)),
    ]);
    writer.releaseLock();
    await socket.close();
    results.tcp = 'ok';
  } catch (e) {
    results.tcp = e.message;
  }

  // Test 2: DNS lookup via fetch (indirect)
  try {
    const r = await Promise.race([
      fetch(`https://${host}`, { method: 'HEAD' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), 5000)),
    ]);
    results.fetch_head = r.status;
  } catch (e) {
    results.fetch_head = e.message;
  }

  // Test 3: TLS socket
  try {
    const socket = connect({ hostname: host, port }, { secureTransport: 'on' });
    const reader = socket.readable.getReader();
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tls timeout')), 5000)),
    ]);
    reader.releaseLock();
    results.tls = 'ok, got ' + (read?.value?.length ?? 0) + ' bytes';
  } catch (e) {
    results.tls = e.message;
  }

  return Response.json(results);
}
