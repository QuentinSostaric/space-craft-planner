/**
 * Runtime data service.
 * The client reads published datasets from MongoDB through Cloudflare Pages Functions.
 * No local dataset snapshot is used at runtime.
 */

import type { DatasetChannel, DatasetSummary, GameDataset, MissionRewardsData } from '../types';

export interface DatasetIndexResponse {
  datasets: DatasetSummary[];
  defaultChannel: DatasetChannel | null;
}

function normalizeMissionRewards(missionRewards: MissionRewardsData | null | undefined): MissionRewardsData | null {
  if (!missionRewards) {
    return null;
  }

  return {
    summary: missionRewards.summary ?? null,
    conclusions: missionRewards.conclusions ?? null,
    factionGroups: (missionRewards.factionGroups ?? []).map((group) => ({
      ...group,
      reputationScopes: group.reputationScopes ?? [],
      contracts: (group.contracts ?? []).map((contract) => ({
        ...contract,
        minimumRequiredStandings: contract.minimumRequiredStandings ?? [],
        availability: {
          derivedScale: contract.availability?.derivedScale ?? 'unknown',
          localities: contract.availability?.localities ?? [],
          explicitLocations: contract.availability?.explicitLocations ?? [],
          hasHandlerAvailabilityRules: Boolean(contract.availability?.hasHandlerAvailabilityRules),
        },
        rewardedBlueprints: contract.rewardedBlueprints ?? [],
        itemAwards: contract.itemAwards ?? [],
        resourceObjectives: contract.resourceObjectives ?? [],
      })),
    })),
    blueprintAcquisitionGraph: missionRewards.blueprintAcquisitionGraph ?? [],
  };
}

function normalizeDataset(dataset: GameDataset): GameDataset {
  return {
    ...dataset,
    manufacturers: dataset.manufacturers ?? [],
    resourceInsights: dataset.resourceInsights
      ? dataset.resourceInsights.map((entry) => ({
          ...entry,
          systems: entry.systems ?? [],
          providerTypes: entry.providerTypes ?? [],
          sourceMethods: entry.sourceMethods ?? [],
          missionEmployers: entry.missionEmployers ?? [],
          missionLocations: entry.missionLocations ?? [],
          blueprintCategoryCounts: entry.blueprintCategoryCounts ?? {},
          blueprintIds: entry.blueprintIds ?? [],
        }))
      : null,
    materialSources: dataset.materialSources
      ? {
          ...dataset.materialSources,
          resources: Object.fromEntries(
            Object.entries(dataset.materialSources.resources ?? {}).map(([resourceId, entry]) => [
              resourceId,
              {
                ...entry,
                sourceMethods: entry?.sourceMethods ?? [],
                providers: entry?.providers ?? [],
              },
            ]),
          ),
          providers: dataset.materialSources.providers ?? [],
          summary: dataset.materialSources.summary
            ? {
                ...dataset.materialSources.summary,
                providerTypes: dataset.materialSources.summary.providerTypes ?? {},
                sourceMethods: dataset.materialSources.summary.sourceMethods ?? {},
                systems: dataset.materialSources.summary.systems ?? [],
              }
            : undefined,
        }
      : null,
    missionRewards: normalizeMissionRewards(dataset.missionRewards ?? null),
    shipComponents: dataset.shipComponents
      ? {
          ...dataset.shipComponents,
          entries: dataset.shipComponents.entries ?? [],
        }
      : null,
  };
}

function buildApiCandidateUrls(path: string): string[] {
  return [path];
}

async function apiFetch<T>(path: string): Promise<T> {
  const candidateUrls = buildApiCandidateUrls(path);
  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`Non-JSON response - HTTP ${response.status}`);
      }

      if (!response.ok) {
        const msg = (payload as { message?: string })?.message ?? `HTTP ${response.status}`;
        lastError = new Error(msg);
        continue;
      }

      return payload as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown API error.');
    }
  }

  throw lastError ?? new Error('Failed to reach the dataset API.');
}

export async function fetchPublishedDatasetIndex(): Promise<DatasetIndexResponse> {
  return apiFetch<DatasetIndexResponse>('/api/game-data/public');
}

export async function fetchPublishedDataset(channel: DatasetChannel): Promise<GameDataset> {
  const payload = await apiFetch<{ dataset: GameDataset | null }>(`/api/game-data/public/${channel}`);

  if (!payload.dataset) {
    throw new Error(`No published dataset for channel "${channel}".`);
  }

  return normalizeDataset(payload.dataset);
}

export async function fetchPublishedDatasetById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<GameDataset> {
  try {
    const payload = await apiFetch<{ dataset: GameDataset | null }>(
      `/api/game-data/public/by-id/${datasetId}`,
    );
    if (!payload.dataset) {
      throw new Error(`No published dataset for id "${datasetId}".`);
    }
    return normalizeDataset(payload.dataset);
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
  const payload = await apiFetch<{ missionRewards: MissionRewardsData | null }>(
    `/api/game-data/public/${channel}/mission-rewards`,
  );
  return normalizeMissionRewards(payload.missionRewards ?? null);
}

export async function fetchPublishedMissionRewardsById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<MissionRewardsData | null> {
  try {
    const payload = await apiFetch<{ missionRewards: MissionRewardsData | null }>(
      `/api/game-data/public/by-id/${datasetId}/mission-rewards`,
    );
    return normalizeMissionRewards(payload.missionRewards ?? null);
  } catch (error) {
    if (channelHint) {
      return fetchPublishedMissionRewards(channelHint);
    }
    throw error;
  }
}
