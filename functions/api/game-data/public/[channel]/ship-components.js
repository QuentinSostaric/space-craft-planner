import {
  errorResponse,
  isValidChannel,
  publicApiJsonResponse,
} from '../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_MUTABLE,
  getChannelChunk,
} from '../../../../_shared/r2Datasets.js';

export async function onRequestGet(context) {
  const { channel } = context.params;

  if (!isValidChannel(channel)) {
    return errorResponse(404, `Unknown dataset channel "${channel}".`);
  }

  try {
    const dataset = await getChannelChunk(context.request, context.env, channel, 'core');
    if (!dataset) {
      return errorResponse(404, `No dataset for channel "${channel}".`);
    }

    const shipComponents = await getChannelChunk(
      context.request,
      context.env,
      channel,
      'ship-components',
    );

    return publicApiJsonResponse(
      {
        datasetId: dataset.datasetId,
        shipComponents: shipComponents?.shipComponents ?? null,
      },
      {
        headers: {
          'Cache-Control': CACHE_CONTROL_MUTABLE,
        },
      },
    );
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load ship components.');
  }
}
