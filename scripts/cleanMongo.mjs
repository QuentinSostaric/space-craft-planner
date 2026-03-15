/**
 * Nettoie les collections PTU et LIVE dans MongoDB.
 * Usage: MONGODB_URI=... node scripts/cleanMongo.mjs
 */
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI manquant'); process.exit(1); }

const client = new MongoClient(URI);
try {
  await client.connect();
  const db = client.db('craft');
  const [r1, r2] = await Promise.all([
    db.collection('craft-ptu-data').deleteMany({}),
    db.collection('craft-live-data').deleteMany({}),
  ]);
  console.log(`✓ craft-ptu-data  : ${r1.deletedCount} doc(s) supprimé(s)`);
  console.log(`✓ craft-live-data : ${r2.deletedCount} doc(s) supprimé(s)`);
} finally {
  await client.close();
}
