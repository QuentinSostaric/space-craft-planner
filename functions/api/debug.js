// Temporary diagnostic endpoint — remove after diagnosis
import { connect } from 'cloudflare:sockets';
import * as net from 'node:net';
import * as tls from 'node:tls';

export async function onRequestGet(context) {
  const host = 'ac-yzbdjfa-shard-00-00.unxousw.mongodb.net';
  const port = 27017;
  const results = {};

  // Test 1: cloudflare:sockets raw TCP — can we read data back?
  try {
    const socket = connect({ hostname: host, port });
    const reader = socket.readable.getReader();
    // MongoDB without TLS will reject but still responds
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tcp read timeout')), 4000)),
    ]);
    reader.releaseLock();
    results.cf_tcp_read = 'ok, got ' + (read?.value?.length ?? 0) + ' bytes';
  } catch (e) {
    results.cf_tcp_read = e.message;
  }

  // Test 2: cloudflare:sockets TLS — can we complete the handshake?
  try {
    const socket = connect({ hostname: host, port }, { secureTransport: 'on' });
    const reader = socket.readable.getReader();
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tls read timeout')), 4000)),
    ]);
    reader.releaseLock();
    results.cf_tls_read = 'ok, got ' + (read?.value?.length ?? 0) + ' bytes';
  } catch (e) {
    results.cf_tls_read = e.message;
  }

  // Test 3: node:net TCP connect
  try {
    await new Promise((resolve, reject) => {
      const sock = net.createConnection({ host, port }, () => {
        results.node_net_tcp = 'connected';
        sock.destroy();
        resolve();
      });
      sock.on('error', (e) => reject(new Error('node:net error: ' + e.message)));
      sock.setTimeout(4000, () => reject(new Error('node:net timeout')));
    });
  } catch (e) {
    results.node_net_tcp = e.message;
  }

  // Test 4: node:tls connect
  try {
    await new Promise((resolve, reject) => {
      const sock = tls.connect({ host, port, servername: host }, () => {
        results.node_tls = 'handshake ok, cipher: ' + JSON.stringify(sock.getCipher());
        sock.destroy();
        resolve();
      });
      sock.on('error', (e) => reject(new Error('node:tls error: ' + e.message)));
      sock.setTimeout(4000, () => reject(new Error('node:tls timeout')));
    });
  } catch (e) {
    results.node_tls = e.message;
  }

  return Response.json(results);
}
