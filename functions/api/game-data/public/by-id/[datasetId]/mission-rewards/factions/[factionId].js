import { errorResponse } from '../../../../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  getVisibleDatasetCore,
} from '../../../../../../../_shared/r2Datasets.js';
import { getFactionContractsKey } from '../../../../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { datasetId, factionId } = context.params;

  if (!datasetId) return errorResponse(400, 'Missing datasetId.');
  if (!factionId) return errorResponse(400, 'Missing factionId.');

  try {
    const core = await getVisibleDatasetCore(context.request, context.env, datasetId);
    if (!core) {
      return errorResponse(404, `No dataset for id "${datasetId}".`);
    }

    const object = await context.env.GAME_DATA.get(
      getFactionContractsKey(datasetId, factionId),
    );

    if (!object) {
      return errorResponse(404, `No faction contracts for "${factionId}" in dataset "${datasetId}".`);
    }

    return new Response(object.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Cache-Control': CACHE_CONTROL_IMMUTABLE,
      },
    });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load faction contracts.');
  }
}
