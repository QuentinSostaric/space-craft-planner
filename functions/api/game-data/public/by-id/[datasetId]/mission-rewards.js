import { errorResponse, publicApiJsonResponse } from '../../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  getVisibleDatasetCore,
} from '../../../../../_shared/r2Datasets.js';
import { getDatasetChunkKey } from '../../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { datasetId } = context.params;

  if (!datasetId) {
    return errorResponse(400, 'Missing datasetId.');
  }

  try {
    // Visibility check: ensure the dataset exists and is published for the caller.
    const core = await getVisibleDatasetCore(context.request, context.env, datasetId);
    if (!core) {
      return errorResponse(404, `No dataset for id "${datasetId}".`);
    }

    const object = await context.env.GAME_DATA.get(
      getDatasetChunkKey(datasetId, 'mission-rewards'),
    );

    if (!object) {
      return publicApiJsonResponse(
        { datasetId, missionRewards: null },
        { headers: { 'Cache-Control': CACHE_CONTROL_IMMUTABLE } },
      );
    }

    // Stream the R2 object body directly — avoids JSON.parse on a large payload.
    // The stored chunk already has the { datasetId, missionRewards } response shape.
    return new Response(object.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Cache-Control': CACHE_CONTROL_IMMUTABLE,
      },
    });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load mission rewards.');
  }
}
