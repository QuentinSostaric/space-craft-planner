/**
 * Data service — reads static JSON snapshots generated from published MongoDB datasets.
 *
 * Static files served by the app:
 *   /data/index.json
 *   /data/live.json
 *   /data/ptu.json
 *   /data/<datasetId>.json    when a per-dataset snapshot exists
 *
 * Local exporter output is not a supported runtime source.
 * Refresh these files from MongoDB with `node scripts/fetchGameData.mjs`.
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
