/**
 * Service de données — lit les JSON statiques générés au moment du build
 * par scripts/fetchGameData.mjs depuis MongoDB Atlas.
 *
 * Fichiers servis en statique via CDN :
 *   /data/index.json          → liste des datasets publiés
 *   /data/live.json           → dataset live complet
 *   /data/ptu.json            → dataset ptu complet
 *
 * En dev local : placer des fichiers JSON de mock dans client/public/data/
 * ou lancer `node scripts/fetchGameData.mjs` avec MONGODB_URI configuré.
 */

import type { DatasetChannel, DatasetSummary, GameDataset } from '../types';

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
