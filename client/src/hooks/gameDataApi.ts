/**
 * Re-export du service MongoDB Atlas.
 * CraftContext importe depuis ce fichier — on garde la compatibilité des imports.
 */
export { fetchPublishedDatasetIndex, fetchPublishedDataset } from '../services/mongoDbService';
export type { DatasetIndexResponse } from '../services/mongoDbService';
