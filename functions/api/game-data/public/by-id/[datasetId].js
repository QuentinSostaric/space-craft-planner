import { errorResponse, publicApiJsonResponse } from '../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  getVisibleDatasetCore,
} from '../../../../_shared/r2Datasets.js';

export async function onRequestGet(context) {
  const { datasetId } = context.params;

  if (!datasetId) {
    return errorResponse(400, 'Missing datasetId.');
  }

  try {
    const dataset = await getVisibleDatasetCore(context.request, context.env, datasetId);

    if (!dataset) {
      return errorResponse(404, `No dataset for id "${datasetId}".`);
    }

    return publicApiJsonResponse({ dataset }, {
      headers: {
        'Cache-Control': CACHE_CONTROL_IMMUTABLE,
      },
    });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load dataset.');
  }
}
