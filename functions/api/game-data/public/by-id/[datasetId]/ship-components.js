import { errorResponse, publicApiJsonResponse } from '../../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  getVisibleDatasetChunk,
} from '../../../../../_shared/r2Datasets.js';

export async function onRequestGet(context) {
  const { datasetId } = context.params;

  if (!datasetId) {
    return errorResponse(400, 'Missing datasetId.');
  }

  try {
    const match = await getVisibleDatasetChunk(context.request, context.env, datasetId, 'ship-components');

    if (!match) {
      return errorResponse(404, `No dataset for id "${datasetId}".`);
    }

    return publicApiJsonResponse(
      {
        datasetId,
        shipComponents: match.chunk?.shipComponents ?? null,
      },
      {
        headers: {
          'Cache-Control': CACHE_CONTROL_IMMUTABLE,
        },
      },
    );
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load ship components.');
  }
}
