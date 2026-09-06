import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let fetchPublishedDatasetIndex: typeof import('./gameDataService').fetchPublishedDatasetIndex;
let fetchPublishedMissionRewards: typeof import('./gameDataService').fetchPublishedMissionRewards;
const mocks = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock('./apiBaseUrl', () => ({ fetchTauriApiJson: mocks.native, getApiUrl: (path: string) => path, getApiCredentials: () => 'same-origin' }));
beforeEach(async () => {
  vi.resetModules();
  mocks.native.mockReset();
  ({ fetchPublishedDatasetIndex, fetchPublishedMissionRewards } = await import('./gameDataService'));
});
afterEach(() => vi.unstubAllGlobals());
it('preserves native API failures without an unauthenticated browser retry', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  mocks.native.mockRejectedValue('HTTP 404: No published dataset for channel "ptu".');
  await expect(fetchPublishedDatasetIndex()).rejects.toBe('HTTP 404: No published dataset for channel "ptu".');
  expect(fetch).not.toHaveBeenCalled();
});
it('still uses browser fetch outside Tauri', async () => {
  mocks.native.mockResolvedValue(null);
  const payload = { datasets: [], defaultChannel: null };
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
  vi.stubGlobal('fetch', fetch);
  await expect(fetchPublishedDatasetIndex()).resolves.toEqual(payload);
  expect(fetch).toHaveBeenCalledOnce();
});

it('preserves published payouts and resource faction lookup when normalizing mission data', async () => {
  const missionPayouts = {
    missionCount: 1,
    minRewardUec: 15000,
    maxRewardUec: 15000,
    medianRewardUec: 15000,
    categories: ['Delivery'],
    missions: [{ id: 'supply-run', title: 'Supply run', rewardUec: 15000 }],
  };
  const resourceObjectiveIndex = { titanium: ['hurston-dynamics'] };
  mocks.native.mockResolvedValue({
    datasetId: 'live-test',
    missionRewards: { missionPayouts, resourceObjectiveIndex },
  });

  const payload = await fetchPublishedMissionRewards('live');
  expect(payload?.missionRewards?.missionPayouts).toEqual(missionPayouts);
  expect(payload?.missionRewards?.resourceObjectiveIndex).toEqual(resourceObjectiveIndex);
  expect(payload?.missionRewards?.factionGroups).toEqual([]);
});

it('keeps older mission datasets usable when optional mission data is absent', async () => {
  mocks.native.mockResolvedValue({ datasetId: 'legacy', missionRewards: {} });
  const payload = await fetchPublishedMissionRewards('live');
  expect(payload?.missionRewards?.missionPayouts).toBeNull();
  expect(payload?.missionRewards?.resourceObjectiveIndex).toEqual({});
});
