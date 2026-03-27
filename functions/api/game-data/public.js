import { errorResponse, publicApiJsonResponse } from '../../_shared/gameData.js';
import {
  CACHE_CONTROL_MUTABLE,
  getDatasetIndex,
} from '../../_shared/r2Datasets.js';

export async function onRequestGet(context) {
  try {
    const index = await getDatasetIndex(context.request, context.env);
    if (!index) {
      return publicApiJsonResponse(
        {
          datasets: [],
          defaultChannel: null,
        },
        {
          headers: {
            'Cache-Control': CACHE_CONTROL_MUTABLE,
          },
        },
      );
    }

    return publicApiJsonResponse(index, {
      headers: {
        'Cache-Control': CACHE_CONTROL_MUTABLE,
      },
    });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load dataset index.');
  }
}
