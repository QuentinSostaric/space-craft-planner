import {
  errorResponse,
  getDatasetVisibilityNamespace,
  isValidChannel,
} from '../../../../../_shared/gameData.js';
import { CACHE_CONTROL_MUTABLE } from '../../../../../_shared/r2Datasets.js';
import { getFactionContractsAliasKey } from '../../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { channel, factionId } = context.params;

  if (!isValidChannel(channel)) {
    return errorResponse(404, `Unknown dataset channel "${channel}".`);
  }
  if (!factionId) return errorResponse(400, 'Missing factionId.');

  try {
    const namespace = getDatasetVisibilityNamespace(context.request, context.env);
    const object = await context.env.GAME_DATA.get(
      getFactionContractsAliasKey(namespace, channel, factionId),
    );

    if (!object) {
      return errorResponse(404, `No faction contracts for "${factionId}" on channel "${channel}".`);
    }

    return new Response(object.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Cache-Control': CACHE_CONTROL_MUTABLE,
      },
    });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load faction contracts.');
  }
}
