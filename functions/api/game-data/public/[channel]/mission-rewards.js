import { getDb, getCollectionName } from '../../../../_shared/mongoClient.js';
import { errorResponse, jsonResponse } from '../../../../_shared/gameData.js';

function isValidChannel(channel) {
  return channel === 'live' || channel === 'ptu';
}

export async function onRequestGet(context) {
  const { channel } = context.params;

  if (!isValidChannel(channel)) {
    return errorResponse(404, `Unknown dataset channel "${channel}".`);
  }

  try {
    const db = await getDb(context.env);
    const doc = await db.collection(getCollectionName(context.env, channel))
      .findOne(
        { published: true },
        {
          projection: {
            _id: 0,
            missionRewards: 1,
          },
          sort: { importedAt: -1 },
        },
      );

    if (!doc) {
      return errorResponse(404, `No published dataset for channel "${channel}".`);
    }

    return jsonResponse({ missionRewards: doc.missionRewards ?? null });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load mission rewards.');
  }
}
