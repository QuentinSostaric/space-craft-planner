export const TTL_IMMUTABLE = 60 * 60 * 24 * 365;
export const TTL_MUTABLE = 60;

export const CACHE_CONTROL_IMMUTABLE =
  'public, max-age=31536000, s-maxage=31536000, immutable';
export const CACHE_CONTROL_MUTABLE =
  'public, max-age=60, s-maxage=300, stale-while-revalidate=300';

function buildCacheControl(ttl) {
  return ttl >= TTL_IMMUTABLE ? CACHE_CONTROL_IMMUTABLE : CACHE_CONTROL_MUTABLE;
}

function buildCacheKey(key) {
  return new Request(`https://game-data-cache.internal/${key}`);
}

async function putCachedJson(key, text, ttl) {
  await caches.default.put(
    buildCacheKey(key),
    new Response(text, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': buildCacheControl(ttl),
      },
    }),
  );
}

export async function getJson(env, key, ttl = TTL_MUTABLE) {
  const cached = await caches.default.match(buildCacheKey(key));
  if (cached) {
    return cached.json();
  }

  const object = await env.GAME_DATA.get(key);
  if (!object) {
    return null;
  }

  const text = await object.text();
  await putCachedJson(key, text, ttl);
  return JSON.parse(text);
}

export function getIndexKey(namespace) {
  return `indexes/${namespace}.json`;
}

export function getAliasChunkKey(namespace, channel, chunkName) {
  return `aliases/${namespace}/${channel}/${chunkName}.json`;
}

export function getDatasetChunkKey(datasetId, chunkName) {
  return `datasets/${datasetId}/${chunkName}.json`;
}

export function getBlueprintDetailKey(datasetId, blueprintId) {
  return `datasets/${datasetId}/blueprints/${encodeURIComponent(blueprintId)}.json`;
}

export function getFactionContractsKey(datasetId, factionId) {
  return `datasets/${datasetId}/mission-rewards/factions/${encodeURIComponent(factionId)}.json`;
}

export function getFactionContractsAliasKey(namespace, channel, factionId) {
  return `aliases/${namespace}/${channel}/mission-rewards/factions/${encodeURIComponent(factionId)}.json`;
}
