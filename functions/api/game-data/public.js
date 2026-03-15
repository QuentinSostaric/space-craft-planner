import { getDb, getCollectionName } from '../../_shared/mongoClient.js';
import { SUMMARY_PROJECTION, errorResponse, jsonResponse, toSummary } from '../../_shared/gameData.js';

export async function onRequestGet(context) {
  try {
    const db = await getDb(context.env);

    const [liveDocs, ptuDocs] = await Promise.all([
      db.collection(getCollectionName(context.env, 'live'))
        .find({ published: true })
        .project(SUMMARY_PROJECTION)
        .sort({ importedAt: -1 })
        .limit(1)
        .toArray(),
      db.collection(getCollectionName(context.env, 'ptu'))
        .find({ published: true })
        .project(SUMMARY_PROJECTION)
        .sort({ importedAt: -1 })
        .limit(1)
        .toArray(),
    ]);

    const datasets = [
      ...liveDocs.map((doc) => toSummary(doc, 'live')),
      ...ptuDocs.map((doc) => toSummary(doc, 'ptu')),
    ];

    const defaultChannel =
      datasets.find((dataset) => dataset.channel === 'ptu')?.channel ??
      datasets[0]?.channel ??
      null;

    return jsonResponse({ datasets, defaultChannel });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load dataset index.');
  }
}
