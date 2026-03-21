'use strict';
// CJS shim — replaces node:tls for Cloudflare Workers.
// Injected into the MongoDB driver at build time by scripts/patchMongoTls.mjs.
// The node:tls polyfill's TLS handshake hangs against MongoDB Atlas;
// cloudflare:sockets completes the handshake correctly.
const { connect: cfConnect } = require('cloudflare:sockets');
const { Duplex } = require('stream');

function connect(options, callback) {
  const host = options.servername || options.host || 'localhost';
  const port = Number(options.port);
  const cfSock = cfConnect({ hostname: host, port }, { secureTransport: 'on' });
  const reader = cfSock.readable.getReader();
  const writer = cfSock.writable.getWriter();
  let destroyed = false;
  let timeoutHandle = null;

  const duplex = new Duplex({
    emitClose: true,
    read() { /* push-based; driven by readLoop below */ },
    write(chunk, _enc, cb) {
      if (destroyed) { cb(new Error('socket destroyed')); return; }
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      writer.write(buf).then(() => cb(), cb);
    },
    final(cb) {
      writer.close().then(() => cb(), cb);
    },
    destroy(err, cb) {
      if (destroyed) { cb(err); return; }
      destroyed = true;
      if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
      reader.cancel('socket destroyed').catch(() => {});
      try { cfSock.close(); } catch {}
      cb(err);
    },
  });

  duplex.setTimeout = (ms) => {
    if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
    if (ms > 0) {
      timeoutHandle = setTimeout(() => { if (!destroyed) duplex.emit('timeout'); }, ms);
    }
  };
  duplex.authorized = true;
  duplex.remoteAddress = host;
  duplex.remotePort = port;
  duplex.setNoDelay = () => duplex;
  duplex.setKeepAlive = () => duplex;
  duplex.disableRenegotiation = () => {};
  duplex.unref = () => duplex;
  duplex.ref = () => duplex;
  duplex.address = () => ({ address: '0.0.0.0', port, family: 'IPv4' });

  // Pump data from cloudflare socket into the duplex readable side
  (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || destroyed) { duplex.push(null); break; }
        duplex.push(Buffer.from(value));
      }
    } catch (err) {
      if (!destroyed) duplex.destroy(err);
    }
  })();

  // Emit 'secureConnect' after cloudflare TLS handshake resolves
  const openedPromise = cfSock.opened instanceof Promise ? cfSock.opened : Promise.resolve();
  openedPromise
    .then(() => {
      if (!destroyed) {
        duplex.emit('secureConnect');
        if (callback) callback.call(duplex);
      }
    })
    .catch(err => {
      if (!destroyed) duplex.destroy(err);
    });

  return duplex;
}

module.exports = {
  connect,
  TLSSocket: class TLSSocket {},
  createSecureContext: () => ({}),
};
