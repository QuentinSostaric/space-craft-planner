import { getDb, getCollectionName } from '../../../../_shared/mongoClient.js';
import { CORE_PROJECTION, errorResponse, jsonResponse, normalizeCoreDataset } from '../../../../_shared/gameData.js';

async function findPublishedDatasetById(db, env, datasetId) {
  for (const channel of ['live', 'ptu']) {
    const doc = await db.collection(getCollectionName(env, channel)).findOne(
      { published: true, datasetId },
      { projection: CORE_PROJECTION, sort: { importedAt: -1 } },
    );

    if (doc) {
      return { doc, channel };
    }
  }

  return null;
}

export async function onRequestGet(context) {
  const { datasetId } = context.params;

  if (!datasetId) {
    return errorResponse(400, 'Missing datasetId.');
  }

  try {
    const db = await getDb(context.env);
    const match = await findPublishedDatasetById(db, context.env, datasetId);

    if (!match) {
      return errorResponse(404, `No published dataset for id "${datasetId}".`);
    }

    return jsonResponse({ dataset: normalizeCoreDataset(match.doc, match.channel) });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load dataset.');
  }
}
