/**
 * GET /api/game-data/public/:channel   (channel = "live" | "ptu")
 * Retourne le dataset complet publié pour un canal donné.
 */
import {
  getMongoClient, getCollections,
  FULL_PROJECTION,
  jsonResponse, errorResponse,
} from '../../../_shared/mongoClient.js';

export async function onRequestGet({ params, env }) {
  const channel = params.channel;

  if (channel !== 'live' && channel !== 'ptu') {
    return errorResponse(`Canal invalide : "${channel}". Valeurs acceptées : live, ptu`, 400);
  }

  try {
    const client     = await getMongoClient(env);
    const db         = client.db(env.ATLAS_DB_NAME ?? 'craft');
    const collection = getCollections(env)[channel];

    const doc = await db.collection(collection)
      .findOne({ published: true }, {
        projection: FULL_PROJECTION,
        sort: { importedAt: -1 },
      });

    if (!doc) return jsonResponse({ dataset: null }, 404);

    return jsonResponse({ dataset: { ...doc, channel } });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Erreur inconnue');
  }
}
