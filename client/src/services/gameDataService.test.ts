import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let fetchPublishedDatasetIndex: typeof import('./gameDataService').fetchPublishedDatasetIndex;
const mocks = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock('./apiBaseUrl', () => ({ fetchTauriApiJson: mocks.native, getApiUrl: (path: string) => path, getApiCredentials: () => 'same-origin' }));
beforeEach(async () => {
  vi.resetModules();
  mocks.native.mockReset();
  ({ fetchPublishedDatasetIndex } = await import('./gameDataService'));
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
