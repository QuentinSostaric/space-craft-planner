import type { DatasetChannel, DatasetSummary, GameDataset } from '../types';

interface DatasetIndexResponse {
  datasets: DatasetSummary[];
  defaultChannel: DatasetChannel | null;
}

interface DatasetResponse {
  dataset: GameDataset | null;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String(payload.message)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function fetchPublishedDatasetIndex(): Promise<DatasetIndexResponse> {
  const response = await fetch('/api/game-data/public');
  return parseJsonResponse<DatasetIndexResponse>(response);
}

export async function fetchPublishedDataset(channel: DatasetChannel): Promise<GameDataset> {
  const response = await fetch(`/api/game-data/public/${channel}`);
  const payload = await parseJsonResponse<DatasetResponse>(response);

  if (!payload.dataset) {
    throw new Error(`No dataset returned for ${channel}.`);
  }

  return payload.dataset;
}
