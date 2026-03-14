/**
 * Client MongoDB natif pour Cloudflare Pages Functions.
 * CF Workers = environnement serverless : pas de pool de connexions persistant.
 * On crée une connexion fraîche par requête et on la ferme après usage.
 */
import { MongoClient } from 'mongodb';

export async function getMongoClient(env) {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS:         10_000,
    socketTimeoutMS:          15_000,
    maxPoolSize:              1,
    minPoolSize:              0,
    tls:                      true,
    directConnection:         false,
  });

  await client.connect();
  return client;
}

export function getCollections(env) {
  return {
    live: env.ATLAS_LIVE_COLLECTION ?? 'craft-live-data',
    ptu:  env.ATLAS_PTU_COLLECTION  ?? 'craft-ptu-data',
  };
}

export const SUMMARY_PROJECTION = {
  _id: 0, blueprints: 0, resources: 0, changelog: 0,
  metrics: 0, sourceFiles: 0,
};

export const FULL_PROJECTION = {
  _id: 0, metrics: 0, sourceFiles: 0,
};

export function toSummary(doc) {
  return {
    channel:        doc.channel,
    datasetId:      doc.datasetId,
    label:          doc.label,
    version:        doc.version,
    branch:         doc.branch        ?? null,
    buildNumber:    doc.buildNumber   ?? null,
    published:      Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? (doc.blueprints?.length ?? 0),
    resourceCount:  doc.resourceCount  ?? (doc.resources?.length  ?? 0),
    importedAt:     doc.importedAt,
    updatedAt:      doc.updatedAt ?? doc.importedAt,
    hasChangelog:   Boolean(doc.changelog),
  };
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': status === 200
        ? 'public, max-age=60, stale-while-revalidate=300'
        : 'no-store',
    },
  });
}

export function errorResponse(message, status = 502) {
  console.error(`[sc-craft function] ${message}`);
  return jsonResponse({ message }, status);
}
