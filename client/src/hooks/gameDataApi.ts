/**
 * Runtime API facade.
 * CraftContext imports from this file to keep data access centralized.
 */
export {
  fetchPublishedDatasetIndex,
  fetchPublishedDataset,
  fetchPublishedDatasetById,
  fetchPublishedMissionRewards,
  fetchPublishedMissionRewardsById,
} from '../services/mongoDbService';
export type { DatasetIndexResponse } from '../services/mongoDbService';
