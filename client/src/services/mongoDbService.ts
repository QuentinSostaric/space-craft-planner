/**
 * Service de données — lit les JSON statiques générés au moment du build
 * par scripts/fetchGameData.mjs depuis MongoDB Atlas.
 *
 * Fichiers servis en statique via CDN :
 *   /data/index.json          → liste des datasets publiés
 *   /data/live.json           → dataset live complet (blueprints, resources, dismantling, missionRewards)
 *   /data/ptu.json            → dataset ptu complet
 *   /data/<datasetId>.json    → snapshot complet d'un dataset spécifique quand disponible
 *
 * En dev local : lancer `node scripts/devData.mjs` ou
 * `MONGODB_URI=... node scripts/fetchGameData.mjs` pour générer ces fichiers.
 */

import type { DatasetChannel, DatasetSummary, GameDataset, MissionRewardsData } from '../types';

export interface DatasetIndexResponse {
  datasets: DatasetSummary[];
  defaultChannel: DatasetChannel | null;
}

async function staticFetch<T>(path: string): Promise<T> {
  const response = await fetch(path);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Non-JSON response — HTTP ${response.status}`);
  }

  if (!response.ok) {
    const msg = (payload as { message?: string })?.message ?? `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return payload as T;
}

export async function fetchPublishedDatasetIndex(): Promise<DatasetIndexResponse> {
  return staticFetch<DatasetIndexResponse>('/data/index.json');
}

export async function fetchPublishedDataset(channel: DatasetChannel): Promise<GameDataset> {
  const payload = await staticFetch<{ dataset: GameDataset | null }>(`/data/${channel}.json`);

  if (!payload.dataset) {
    throw new Error(`No published dataset for channel "${channel}".`);
  }

  return payload.dataset;
}

export async function fetchPublishedDatasetById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<GameDataset> {
  try {
    const payload = await staticFetch<{ dataset: GameDataset | null }>(`/data/${datasetId}.json`);
    if (!payload.dataset) {
      throw new Error(`No published dataset for id "${datasetId}".`);
    }
    return payload.dataset;
  } catch (error) {
    if (channelHint) {
      return fetchPublishedDataset(channelHint);
    }
    throw error;
  }
}

export async function fetchPublishedMissionRewards(
  channel: DatasetChannel,
): Promise<MissionRewardsData | null> {
  // Mission rewards are embedded in the full dataset JSON file.
  // We re-fetch the dataset and extract missionRewards to keep the
  // lazy-loading contract from CraftContext without requiring a separate endpoint.
  const payload = await staticFetch<{ dataset: GameDataset | null }>(`/data/${channel}.json`);
  return payload.dataset?.missionRewards ?? null;
}

export async function fetchPublishedMissionRewardsById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<MissionRewardsData | null> {
  try {
    const payload = await staticFetch<{ dataset: GameDataset | null }>(`/data/${datasetId}.json`);
    return payload.dataset?.missionRewards ?? null;
  } catch (error) {
    if (channelHint) {
      return fetchPublishedMissionRewards(channelHint);
    }
    throw error;
  }
}
