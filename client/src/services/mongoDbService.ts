/**
 * Service de données — appelle les Cloudflare Pages Functions (/api/game-data/…).
 * Les clés MongoDB Atlas sont stockées côté Cloudflare (secrets), jamais dans le bundle.
 *
 * En dev local : utiliser `npm run dev` (wrangler pages dev + Vite via proxy).
 * En production : Cloudflare Pages déploie les fonctions automatiquement.
 */

import type { DatasetChannel, DatasetSummary, GameDataset } from '../types';

export interface DatasetIndexResponse {
  datasets: DatasetSummary[];
  defaultChannel: DatasetChannel | null;
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(path);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Réponse non-JSON — HTTP ${response.status}`);
  }

  if (!response.ok) {
    const msg = (payload as { message?: string })?.message ?? `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return payload as T;
}

/**
 * Récupère la liste des datasets publiés (résumés).
 */
export async function fetchPublishedDatasetIndex(): Promise<DatasetIndexResponse> {
  return apiFetch<DatasetIndexResponse>('/api/game-data/public');
}

/**
 * Récupère le dataset complet (blueprints + resources + changelog) pour un canal.
 */
export async function fetchPublishedDataset(channel: DatasetChannel): Promise<GameDataset> {
  const payload = await apiFetch<{ dataset: GameDataset | null }>(
    `/api/game-data/public/${channel}`,
  );

  if (!payload.dataset) {
    throw new Error(`Aucun dataset publié pour le canal "${channel}".`);
  }

  return payload.dataset;
}
