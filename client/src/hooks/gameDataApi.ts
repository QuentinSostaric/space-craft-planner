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
  fetchPublishedBlueprintCatalogPageById,
  fetchFactionContracts,
} from '../services/gameDataService';
export type { BlueprintCatalogQuery, DatasetIndexResponse } from '../services/gameDataService';
