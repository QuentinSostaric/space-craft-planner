import { getDb, getCollectionName } from '../../../../../_shared/mongoClient.js';
import { errorResponse, publicApiJsonResponse } from '../../../../../_shared/gameData.js';

async function findPublishedMissionRewardsById(db, env, datasetId) {
  for (const channel of ['live', 'ptu']) {
    const doc = await db.collection(getCollectionName(env, channel)).findOne(
      { published: true, datasetId },
      {
        projection: {
          _id: 0,
          missionRewards: 1,
        },
        sort: { importedAt: -1 },
      },
    );

    if (doc) {
      return doc.missionRewards ?? null;
    }
  }

  return undefined;
}

export async function onRequestGet(context) {
  const { datasetId } = context.params;

  if (!datasetId) {
    return errorResponse(400, 'Missing datasetId.');
  }

  try {
    const db = await getDb(context.env);
    const missionRewards = await findPublishedMissionRewardsById(db, context.env, datasetId);

    if (missionRewards === undefined) {
      return errorResponse(404, `No published dataset for id "${datasetId}".`);
    }

    return publicApiJsonResponse({ missionRewards });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load mission rewards.');
  }
}
