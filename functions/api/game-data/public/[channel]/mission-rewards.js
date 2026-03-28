import {
  errorResponse,
  getDatasetVisibilityNamespace,
  isValidChannel,
  publicApiJsonResponse,
} from '../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_MUTABLE,
  getChannelChunk,
} from '../../../../_shared/r2Datasets.js';
import { getAliasChunkKey } from '../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { channel } = context.params;

  if (!isValidChannel(channel)) {
    return errorResponse(404, `Unknown dataset channel "${channel}".`);
  }

  try {
    const namespace = getDatasetVisibilityNamespace(context.request, context.env);
    const object = await context.env.GAME_DATA.get(
      getAliasChunkKey(namespace, channel, 'mission-rewards'),
    );

    if (object) {
      // Stream the R2 object body directly — avoids JSON.parse on a large payload.
      // The stored chunk already has the { datasetId, missionRewards } response shape.
      return new Response(object.body, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'Cache-Control': CACHE_CONTROL_MUTABLE,
        },
      });
    }

    // Alias not found — determine whether the channel itself exists.
    const dataset = await getChannelChunk(context.request, context.env, channel, 'core');
    if (!dataset) {
      return errorResponse(404, `No dataset for channel "${channel}".`);
    }

    return publicApiJsonResponse(
      { datasetId: dataset.datasetId, missionRewards: null },
      { headers: { 'Cache-Control': CACHE_CONTROL_MUTABLE } },
    );
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load mission rewards.');
  }
}
