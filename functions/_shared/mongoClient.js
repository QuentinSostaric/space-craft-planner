import { MongoClient } from 'mongodb';

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
      maxPoolSize: 4,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
      tls: true,
      directConnection: false,
    });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(getDbName(env));
}
