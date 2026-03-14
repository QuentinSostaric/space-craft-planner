/**
 * Client MongoDB natif partagé entre les Cloudflare Pages Functions.
 * Utilise le driver officiel `mongodb` via nodejs_compat (cloudflare:sockets TCP).
 * MONGODB_URI est stocké en secret Cloudflare — jamais dans le bundle JS client.
 */
import { MongoClient } from 'mongodb';

/** Cache de connexion par URI (réutilisé entre requêtes dans le même isolate) */
let _client = null;
let _clientUri = null;

export async function getMongoClient(env) {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  if (_client && _clientUri === uri) return _client;

  _client = new MongoClient(uri, {
    maxPoolSize: 1,          // CF Workers : isolate ephémère → pool minimal
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 30_000,
  });
  _clientUri = uri;
  await _client.connect();
  return _client;
}

export function getCollections(env) {
  return {
    live: env.ATLAS_LIVE_COLLECTION ?? 'craft-live-data',
    ptu:  env.ATLAS_PTU_COLLECTION  ?? 'craft-ptu-data',
  };
}

/** Projections réutilisables */
export const SUMMARY_PROJECTION = {
  _id: 0, blueprints: 0, resources: 0, changelog: 0,
  metrics: 0, sourceFiles: 0,
};

export const FULL_PROJECTION = {
  _id: 0, metrics: 0, sourceFiles: 0,
};

/** Construit un résumé de dataset (sans les données volumineuses) */
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

/** Réponse JSON avec headers CORS et cache */
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

/** Réponse d'erreur normalisée */
export function errorResponse(message, status = 502) {
  console.error(`[sc-craft function] ${message}`);
  return jsonResponse({ message }, status);
}
