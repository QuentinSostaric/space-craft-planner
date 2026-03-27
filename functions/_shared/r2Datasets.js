import { getDatasetVisibilityNamespace } from './gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  CACHE_CONTROL_MUTABLE,
  TTL_IMMUTABLE,
  TTL_MUTABLE,
  getAliasChunkKey,
  getDatasetChunkKey,
  getIndexKey,
  getJson,
} from './r2Store.js';

export {
  CACHE_CONTROL_IMMUTABLE,
  CACHE_CONTROL_MUTABLE,
  TTL_IMMUTABLE,
  TTL_MUTABLE,
};

export async function getDatasetIndex(request, env) {
  const namespace = getDatasetVisibilityNamespace(request, env);
  return getJson(env, getIndexKey(namespace), TTL_MUTABLE);
}

export async function getChannelChunk(request, env, channel, chunkName) {
  const namespace = getDatasetVisibilityNamespace(request, env);
  return getJson(env, getAliasChunkKey(namespace, channel, chunkName), TTL_MUTABLE);
}

export async function getVisibleDatasetCore(request, env, datasetId) {
  const core = await getJson(env, getDatasetChunkKey(datasetId, 'core'), TTL_IMMUTABLE);
  if (!core) {
    return null;
  }

  const namespace = getDatasetVisibilityNamespace(request, env);
  if (namespace === 'public' && !core.published) {
    return null;
  }

  return core;
}

export async function getVisibleDatasetChunk(request, env, datasetId, chunkName) {
  const core = await getVisibleDatasetCore(request, env, datasetId);
  if (!core) {
    return null;
  }

  if (chunkName === 'core') {
    return core;
  }

  const chunk = await getJson(env, getDatasetChunkKey(datasetId, chunkName), TTL_IMMUTABLE);
  return {
    core,
    chunk,
  };
}
