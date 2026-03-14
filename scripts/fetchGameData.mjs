/**
 * Script de build : récupère les datasets publiés depuis MongoDB Atlas
 * et les écrit en JSON statiques dans client/public/data/.
 * Exécuté dans Node.js (GitHub Actions) — pas de restrictions TLS Workers.
 *
 * Usage : MONGODB_URI=... node scripts/fetchGameData.mjs
 */
import { MongoClient } from 'mongodb';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = join(__dir, '../client/public/data');

const MONGODB_URI          = process.env.MONGODB_URI;
const DB_NAME              = process.env.ATLAS_DB_NAME         ?? 'craft';
const LIVE_COLLECTION      = process.env.ATLAS_LIVE_COLLECTION ?? 'craft-live-data';
const PTU_COLLECTION       = process.env.ATLAS_PTU_COLLECTION  ?? 'craft-ptu-data';

const SUMMARY_PROJECTION = {
  _id: 0, blueprints: 0, resources: 0, changelog: 0, metrics: 0, sourceFiles: 0,
};
const FULL_PROJECTION = { _id: 0, metrics: 0, sourceFiles: 0 };

function toSummary(doc, channel) {
  return {
    channel,
    datasetId:      doc.datasetId,
    label:          doc.label,
    version:        doc.version,
    branch:         doc.branch      ?? null,
    buildNumber:    doc.buildNumber ?? null,
    published:      Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? (doc.blueprints?.length ?? 0),
    resourceCount:  doc.resourceCount  ?? (doc.resources?.length  ?? 0),
    importedAt:     doc.importedAt,
    updatedAt:      doc.updatedAt ?? doc.importedAt,
    hasChangelog:   Boolean(doc.changelog),
  };
}

async function main() {
  if (!MONGODB_URI) {
    console.warn('[fetchGameData] MONGODB_URI not set — skipping data fetch, using existing files.');
    process.exit(0);
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('[fetchGameData] Connected to MongoDB');
    const db = client.db(DB_NAME);

    const [liveDocs, ptuDocs] = await Promise.all([
      db.collection(LIVE_COLLECTION).find({ published: true })
        .project(SUMMARY_PROJECTION).sort({ importedAt: -1 }).limit(1).toArray(),
      db.collection(PTU_COLLECTION).find({ published: true })
        .project(SUMMARY_PROJECTION).sort({ importedAt: -1 }).limit(1).toArray(),
    ]);

    const datasets = [
      ...liveDocs.map((d) => toSummary(d, 'live')),
      ...ptuDocs.map((d)  => toSummary(d, 'ptu')),
    ];
    const defaultChannel = datasets.find((d) => d.channel === 'ptu')?.channel
      ?? datasets[0]?.channel ?? null;

    mkdirSync(OUT, { recursive: true });

    // index.json — réponse de /api/game-data/public
    writeFileSync(join(OUT, 'index.json'), JSON.stringify({ datasets, defaultChannel }, null, 2));
    console.log('[fetchGameData] Written index.json —', datasets.length, 'dataset(s)');

    // live.json + ptu.json — réponses de /api/game-data/public/:channel
    for (const channel of ['live', 'ptu']) {
      const collection = channel === 'live' ? LIVE_COLLECTION : PTU_COLLECTION;
      const doc = await db.collection(collection)
        .findOne({ published: true }, { projection: FULL_PROJECTION, sort: { importedAt: -1 } });
      const payload = { dataset: doc ? { ...doc, channel } : null };
      writeFileSync(join(OUT, `${channel}.json`), JSON.stringify(payload, null, 2));
      console.log(`[fetchGameData] Written ${channel}.json —`, doc ? doc.datasetId : 'null');
    }

    console.log('[fetchGameData] Done.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[fetchGameData] Error:', err.message);
  process.exit(1);
});
