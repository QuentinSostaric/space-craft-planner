import { errorResponse, publicApiJsonResponse } from '../../../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  getVisibleDatasetCore,
  TTL_IMMUTABLE,
} from '../../../../../../_shared/r2Datasets.js';
import { getBlueprintDetailKey, getJson } from '../../../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { datasetId, blueprintId } = context.params;

  if (!datasetId || !blueprintId) {
    return errorResponse(400, 'Missing datasetId or blueprintId.');
  }

  try {
    const dataset = await getVisibleDatasetCore(context.request, context.env, datasetId);

    if (!dataset) {
      return errorResponse(404, `No dataset for id "${datasetId}".`);
    }

    const blueprint = await getJson(
      context.env,
      getBlueprintDetailKey(datasetId, blueprintId),
      TTL_IMMUTABLE,
    );

    if (!blueprint) {
      return errorResponse(404, `No blueprint "${blueprintId}" for dataset "${datasetId}".`);
    }

    return publicApiJsonResponse(
      {
        datasetId,
        blueprint,
      },
      {
        headers: {
          'Cache-Control': CACHE_CONTROL_IMMUTABLE,
        },
      },
    );
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load blueprint detail.');
  }
}
