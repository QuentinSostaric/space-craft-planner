/**
 * Client Atlas Data API partagé entre les Cloudflare Pages Functions.
 * Les clés (ATLAS_DATA_API_URL, ATLAS_API_KEY) sont accessibles via context.env
 * et stockées en tant que secrets Cloudflare — jamais dans le bundle JS client.
 */

export function getCollections(env) {
  return {
    live: env.ATLAS_LIVE_COLLECTION ?? 'craft-live-data',
    ptu:  env.ATLAS_PTU_COLLECTION  ?? 'craft-ptu-data',
  };
}

export function getAtlasBody(env, collection, extra = {}) {
  return {
    dataSource: env.ATLAS_DATA_SOURCE ?? 'Cluster42',
    database:   env.ATLAS_DB_NAME    ?? 'craft',
    collection,
    ...extra,
  };
}

export async function atlasRequest(env, action, body) {
  const url = `${env.ATLAS_DATA_API_URL}/action/${action}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.ATLAS_API_KEY,
    },
    body: JSON.stringify(body),
    cf: { cacheTtl: 60, cacheEverything: false }, // Cache Cloudflare edge optionnel
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      msg = err.error ?? err.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(`Atlas API : ${msg}`);
  }

  return response.json();
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
