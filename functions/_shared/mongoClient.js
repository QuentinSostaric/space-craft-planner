import { connect as cfConnect } from 'cloudflare:sockets';
import { Duplex } from 'node:stream';
import * as nodeTls from 'node:tls';
import { MongoClient } from 'mongodb';

// In Cloudflare Workers, node:tls's TLS handshake never completes against MongoDB Atlas.
// We replace tls.connect with a cloudflare:sockets-backed Duplex stream so the MongoDB
// driver gets a fully Node-compatible socket that uses Cloudflare's native TLS.
nodeTls.connect = function cfTlsConnect(options, callback) {
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

  // Socket properties/methods expected by the MongoDB driver
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

  // Pump data from the cloudflare socket into the duplex readable side
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

  // Emit 'secureConnect' once the cloudflare TLS handshake completes.
  // cfSock.opened resolves after the handshake; fall back to microtask if unavailable.
  const openedPromise = cfSock.opened instanceof Promise ? cfSock.opened : Promise.resolve();
  openedPromise.then(() => {
    if (!destroyed) {
      duplex.emit('secureConnect');
      if (callback) callback.call(duplex);
    }
  }).catch(err => {
    if (!destroyed) duplex.destroy(err);
  });

  return duplex;
};

let clientPromise = null;
let cachedUri = null;

function getUri(env) {
  const uri = env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI secret.');
  }
  return uri;
}

export function getDbName(env) {
  return env.ATLAS_DB_NAME ?? 'craft';
}

export function getCollectionName(env, channel) {
  return channel === 'live'
    ? (env.ATLAS_LIVE_COLLECTION ?? 'craft-live-data')
    : (env.ATLAS_PTU_COLLECTION ?? 'craft-ptu-data');
}

export async function getDb(env) {
  const uri = getUri(env);

  if (!clientPromise || cachedUri !== uri) {
    cachedUri = uri;
    const client = new MongoClient(uri, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
      tls: true,
      directConnection: false,
    });
    clientPromise = client.connect().catch((e) => {
      console.error('[mongo] connect failed:', e.message);
      clientPromise = null;
      cachedUri = null;
      throw e;
    });
  }

  const client = await clientPromise;
  return client.db(getDbName(env));
}
