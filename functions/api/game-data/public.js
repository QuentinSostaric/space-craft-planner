import { getDb, getCollectionName } from '../../_shared/mongoClient.js';
import { SUMMARY_PROJECTION, errorResponse, jsonResponse, toSummary } from '../../_shared/gameData.js';

function compareSummaries(a, b) {
  const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
  const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }

  const buildA = Number(a.buildNumber ?? 0);
  const buildB = Number(b.buildNumber ?? 0);
  if (buildA !== buildB) {
    return buildB - buildA;
  }

  return String(b.version ?? '').localeCompare(String(a.version ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export async function onRequestGet(context) {
  try {
    const db = await getDb(context.env);

    const [liveDocs, ptuDocs] = await Promise.all([
      db.collection(getCollectionName(context.env, 'live'))
        .find({ published: true })
        .project(SUMMARY_PROJECTION)
        .sort({ importedAt: -1 })
        .toArray(),
      db.collection(getCollectionName(context.env, 'ptu'))
        .find({ published: true })
        .project(SUMMARY_PROJECTION)
        .sort({ importedAt: -1 })
        .toArray(),
    ]);

    const datasets = [
      ...liveDocs.map((doc) => toSummary(doc, 'live')),
      ...ptuDocs.map((doc) => toSummary(doc, 'ptu')),
    ].sort(compareSummaries);

    const defaultChannel = datasets[0]?.channel ?? null;

    return jsonResponse({ datasets, defaultChannel });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load dataset index.');
  }
}
