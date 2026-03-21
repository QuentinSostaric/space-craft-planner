// Temporary diagnostic endpoint — remove after diagnosis
import { connect } from 'cloudflare:sockets';
import * as net from 'node:net';
import * as tls from 'node:tls';

// Minimal MongoDB OP_MSG "hello" command (unauthenticated)
function buildMongoHello() {
  const doc = new Uint8Array([
    // hello: 1
    0x10, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x01, 0x00, 0x00, 0x00,
    // client.driver.name: "test"
    0x03, 0x63, 0x6c, 0x69, 0x65, 0x6e, 0x74, 0x00,
    0x1c, 0x00, 0x00, 0x00,
    0x03, 0x64, 0x72, 0x69, 0x76, 0x65, 0x72, 0x00,
    0x0f, 0x00, 0x00, 0x00,
    0x02, 0x6e, 0x61, 0x6d, 0x65, 0x00, 0x05, 0x00, 0x00, 0x00, 0x74, 0x65, 0x73, 0x74, 0x00, 0x00, 0x00,
    0x00,
    0x00,
  ]);
  // MsgHeader: totalLength(4) + requestId(4) + responseTo(4=0) + opCode(4=2013 OP_MSG)
  // Section kind=0 (4 bytes): body doc
  const docLen = doc.length;
  const bodySection = new Uint8Array(1 + docLen);
  bodySection[0] = 0; // section kind body
  bodySection.set(doc, 1);
  const flagBits = new Uint8Array([0, 0, 0, 0]);
  const payloadLen = 4 + bodySection.length; // flagBits + section
  const totalLen = 16 + payloadLen;
  const msg = new Uint8Array(totalLen);
  const view = new DataView(msg.buffer);
  view.setInt32(0, totalLen, true);
  view.setInt32(4, 1, true); // requestId
  view.setInt32(8, 0, true); // responseTo
  view.setInt32(12, 2013, true); // OP_MSG
  msg.set(flagBits, 16);
  msg.set(bodySection, 20);
  return msg;
}

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

  // Test 2: cloudflare:sockets TLS — write a MongoDB hello and check for reply
  try {
    const socket = connect({ hostname: host, port }, { secureTransport: 'on' });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    await writer.write(buildMongoHello());
    writer.releaseLock();
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('no reply in 6s')), 6000)),
    ]);
    reader.releaseLock();
    results.cf_tls_mongo = read?.done ? 'eof' : ('got ' + (read?.value?.length ?? 0) + ' bytes reply');
  } catch (e) {
    results.cf_tls_mongo = e.message;
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
      setTimeout(() => reject(new Error('node:net connect timeout')), 4000);
    });
  } catch (e) {
    results.node_net_tcp = e.message;
  }

  // Test 4: node:tls connect (longer timeout)
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        const sock = tls.connect({ host, port, servername: host }, () => {
          results.node_tls = 'handshake ok, authorized: ' + sock.authorized;
          sock.destroy();
          resolve();
        });
        sock.on('error', (e) => { results.node_tls = 'error: ' + e.message; resolve(); });
      }),
      new Promise((resolve) => setTimeout(() => { results.node_tls = results.node_tls ?? 'timeout 8s'; resolve(); }, 8000)),
    ]);
  } catch (e) {
    results.node_tls = 'exception: ' + e.message;
  }

  return Response.json(results);
}
