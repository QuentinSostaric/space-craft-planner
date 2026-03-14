/**
 * GET /api/game-data/public
 * Retourne la liste des datasets publiés (résumés sans blueprints/resources).
 */
import {
  getMongoClient, getCollections,
  toSummary, SUMMARY_PROJECTION,
  jsonResponse, errorResponse,
} from '../../_shared/mongoClient.js';

export async function onRequestGet({ env }) {
  try {
    const client = await getMongoClient(env);
    const db   = client.db(env.ATLAS_DB_NAME ?? 'craft');
    const cols = getCollections(env);

    const [liveDocs, ptuDocs] = await Promise.all([
      db.collection(cols.live).find({ published: true })
        .project(SUMMARY_PROJECTION).sort({ importedAt: -1 }).limit(1).toArray(),
      db.collection(cols.ptu).find({ published: true })
        .project(SUMMARY_PROJECTION).sort({ importedAt: -1 }).limit(1).toArray(),
    ]);

    const datasets = [
      ...liveDocs.map((d) => toSummary({ ...d, channel: 'live' })),
      ...ptuDocs.map((d)  => toSummary({ ...d, channel: 'ptu' })),
    ];

    const defaultChannel =
      datasets.find((d) => d.channel === 'ptu')?.channel
      ?? datasets[0]?.channel
      ?? null;

    return jsonResponse({ datasets, defaultChannel });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Erreur inconnue');
  }
}
