/**
 * Runtime API facade.
 * CraftContext imports from this file to keep data access centralized.
 */
export {
  fetchPublishedDatasetIndex,
  fetchPublishedDataset,
  fetchPublishedDatasetById,
  fetchPublishedResourceData,
  fetchPublishedResourceDataById,
  fetchPublishedShipComponents,
  fetchPublishedShipComponentsById,
  fetchPublishedChangelog,
  fetchPublishedChangelogById,
  fetchPublishedMissionRewards,
  fetchPublishedMissionRewardsById,
  fetchPublishedBlueprintDetailById,
} from '../services/gameDataService';
export type { DatasetIndexResponse } from '../services/gameDataService';
