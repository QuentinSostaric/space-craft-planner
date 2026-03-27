/**
 * Runtime data service.
 * The client reads published datasets from the public game-data API.
 */

import type {
  Blueprint,
  DatasetBlueprintDetailChunk,
  DatasetChannel,
  DatasetChangelog,
  DatasetMissionRewardsChunk,
  DatasetResourceDataChunk,
  DatasetShipComponentsChunk,
  DatasetSummary,
  GameDataset,
  MaterialSlot,
  MissionRewardsData,
} from '../types';

export interface DatasetIndexResponse {
  datasets: DatasetSummary[];
  defaultChannel: DatasetChannel | null;
}

function normalizeSlot(slot: MaterialSlot): MaterialSlot {
  return {
    ...slot,
    modifiers: slot.modifiers ?? [],
  };
}

function normalizeBlueprint(
  blueprint: Blueprint,
  detailsLoadedDefault: boolean,
): Blueprint {
  return {
    ...blueprint,
    slots: (blueprint.slots ?? []).map(normalizeSlot),
    detailsLoaded: blueprint.detailsLoaded ?? detailsLoadedDefault,
  };
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
    hasDismantling: dataset.hasDismantling ?? Boolean(dataset.dismantling),
    hasMissionRewards: dataset.hasMissionRewards ?? Boolean(dataset.missionRewards),
    hasResourceData:
      dataset.hasResourceData ??
      Boolean(dataset.resourceInsights || dataset.materialSources),
    hasShipComponents: dataset.hasShipComponents ?? Boolean(dataset.shipComponents),
    hasChangelog: dataset.hasChangelog ?? Boolean(dataset.changelog),
    blueprints: (dataset.blueprints ?? []).map((blueprint) =>
      normalizeBlueprint(blueprint, false),
    ),
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

function normalizeResourceData(
  payload: DatasetResourceDataChunk | null | undefined,
): DatasetResourceDataChunk | null {
  if (!payload) {
    return null;
  }

  return {
    datasetId: payload.datasetId,
    resourceInsights: payload.resourceInsights
      ? payload.resourceInsights.map((entry) => ({
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
    materialSources: payload.materialSources
      ? {
          ...payload.materialSources,
          resources: Object.fromEntries(
            Object.entries(payload.materialSources.resources ?? {}).map(([resourceId, entry]) => [
              resourceId,
              {
                ...entry,
                sourceMethods: entry?.sourceMethods ?? [],
                providers: entry?.providers ?? [],
              },
            ]),
          ),
          providers: payload.materialSources.providers ?? [],
          summary: payload.materialSources.summary
            ? {
                ...payload.materialSources.summary,
                providerTypes: payload.materialSources.summary.providerTypes ?? {},
                sourceMethods: payload.materialSources.summary.sourceMethods ?? {},
                systems: payload.materialSources.summary.systems ?? [],
              }
            : undefined,
        }
      : null,
  };
}

function normalizeShipComponents(
  payload: DatasetShipComponentsChunk | null | undefined,
): DatasetShipComponentsChunk | null {
  if (!payload) {
    return null;
  }

  return {
    datasetId: payload.datasetId,
    shipComponents: payload.shipComponents
      ? {
          ...payload.shipComponents,
          entries: payload.shipComponents.entries ?? [],
        }
      : null,
  };
}

function normalizeChangelog(
  payload: { datasetId: string; changelog: DatasetChangelog | null } | null | undefined,
): { datasetId: string; changelog: DatasetChangelog | null } | null {
  if (!payload) {
    return null;
  }

  return {
    datasetId: payload.datasetId,
    changelog: payload.changelog ?? null,
  };
}

function normalizeBlueprintDetail(
  payload: DatasetBlueprintDetailChunk | null | undefined,
): DatasetBlueprintDetailChunk | null {
  if (!payload) {
    return null;
  }

  return {
    datasetId: payload.datasetId,
    blueprint: payload.blueprint ? normalizeBlueprint(payload.blueprint, true) : null,
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(path);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Non-JSON response - HTTP ${response.status}`);
  }

  if (!response.ok) {
    const message = (payload as { message?: string })?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
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
  if (channelHint) {
    try {
      const payload = await apiFetch<{ dataset: GameDataset | null }>(
        `/api/game-data/public/${channelHint}`,
      );
      if (payload.dataset?.datasetId === datasetId) {
        return normalizeDataset(payload.dataset);
      }
    } catch {
      // Fall back to by-id below.
    }
  }

  const payload = await apiFetch<{ dataset: GameDataset | null }>(
    `/api/game-data/public/by-id/${datasetId}`,
  );
  if (!payload.dataset) {
    throw new Error(`No published dataset for id "${datasetId}".`);
  }
  return normalizeDataset(payload.dataset);
}

export async function fetchPublishedMissionRewards(
  channel: DatasetChannel,
): Promise<DatasetMissionRewardsChunk | null> {
  return normalizeMissionRewardsChunk(
    await apiFetch<DatasetMissionRewardsChunk | null>(
      `/api/game-data/public/${channel}/mission-rewards`,
    ),
  );
}

function normalizeMissionRewardsChunk(
  payload: DatasetMissionRewardsChunk | null | undefined,
): DatasetMissionRewardsChunk | null {
  if (!payload) {
    return null;
  }

  return {
    datasetId: payload.datasetId,
    missionRewards: normalizeMissionRewards(payload.missionRewards ?? null),
  };
}

export async function fetchPublishedMissionRewardsById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<MissionRewardsData | null> {
  if (channelHint) {
    try {
      const latestPayload = await fetchPublishedMissionRewards(channelHint);
      if (latestPayload?.datasetId === datasetId) {
        return latestPayload.missionRewards ?? null;
      }
    } catch {
      // Fall back to by-id below.
    }
  }

  const payload = normalizeMissionRewardsChunk(
    await apiFetch<DatasetMissionRewardsChunk | null>(
      `/api/game-data/public/by-id/${datasetId}/mission-rewards`,
    ),
  );
  return payload?.missionRewards ?? null;
}

export async function fetchPublishedResourceData(
  channel: DatasetChannel,
): Promise<DatasetResourceDataChunk | null> {
  return normalizeResourceData(
    await apiFetch<DatasetResourceDataChunk | null>(
      `/api/game-data/public/${channel}/resource-data`,
    ),
  );
}

export async function fetchPublishedResourceDataById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<DatasetResourceDataChunk | null> {
  if (channelHint) {
    try {
      const latestPayload = await fetchPublishedResourceData(channelHint);
      if (latestPayload?.datasetId === datasetId) {
        return latestPayload;
      }
    } catch {
      // Fall back to by-id below.
    }
  }

  return normalizeResourceData(
    await apiFetch<DatasetResourceDataChunk | null>(
      `/api/game-data/public/by-id/${datasetId}/resource-data`,
    ),
  );
}

export async function fetchPublishedShipComponents(
  channel: DatasetChannel,
): Promise<DatasetShipComponentsChunk | null> {
  return normalizeShipComponents(
    await apiFetch<DatasetShipComponentsChunk | null>(
      `/api/game-data/public/${channel}/ship-components`,
    ),
  );
}

export async function fetchPublishedShipComponentsById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<DatasetShipComponentsChunk | null> {
  if (channelHint) {
    try {
      const latestPayload = await fetchPublishedShipComponents(channelHint);
      if (latestPayload?.datasetId === datasetId) {
        return latestPayload;
      }
    } catch {
      // Fall back to by-id below.
    }
  }

  return normalizeShipComponents(
    await apiFetch<DatasetShipComponentsChunk | null>(
      `/api/game-data/public/by-id/${datasetId}/ship-components`,
    ),
  );
}

export async function fetchPublishedChangelog(
  channel: DatasetChannel,
): Promise<{ datasetId: string; changelog: DatasetChangelog | null } | null> {
  return normalizeChangelog(
    await apiFetch<{ datasetId: string; changelog: DatasetChangelog | null } | null>(
      `/api/game-data/public/${channel}/changelog`,
    ),
  );
}

export async function fetchPublishedChangelogById(
  datasetId: string,
  channelHint?: DatasetChannel,
): Promise<DatasetChangelog | null> {
  if (channelHint) {
    try {
      const latestPayload = await fetchPublishedChangelog(channelHint);
      if (latestPayload?.datasetId === datasetId) {
        return latestPayload.changelog ?? null;
      }
    } catch {
      // Fall back to by-id below.
    }
  }

  const payload = normalizeChangelog(
    await apiFetch<{ datasetId: string; changelog: DatasetChangelog | null } | null>(
      `/api/game-data/public/by-id/${datasetId}/changelog`,
    ),
  );
  return payload?.changelog ?? null;
}

export async function fetchPublishedBlueprintDetailById(
  datasetId: string,
  blueprintId: string,
): Promise<Blueprint | null> {
  const payload = normalizeBlueprintDetail(
    await apiFetch<DatasetBlueprintDetailChunk | null>(
      `/api/game-data/public/by-id/${datasetId}/blueprints/${blueprintId}`,
    ),
  );

  return payload?.blueprint ?? null;
}
