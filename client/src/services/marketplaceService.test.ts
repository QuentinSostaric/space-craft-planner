import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTauriApi } from './apiBaseUrl';
import {
  createMarketplaceCraftRequest,
  fetchMarketplace,
  reportMarketplaceMember,
  saveMarketplacePublication,
  setMarketplaceBlock,
} from './marketplaceService';

vi.hoisted(() => vi.resetModules());
vi.mock('./apiBaseUrl', () => ({
  fetchTauriApi: vi.fn(),
  getApiCredentials: () => 'same-origin',
  getApiUrl: (path: string) => path,
}));
beforeEach(() => vi.mocked(fetchTauriApi).mockReset().mockResolvedValue(null));
afterEach(() => vi.unstubAllGlobals());

describe('Community marketplace API', () => {
  it('encodes scoped pagination and combines an asset with its provider filter', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ datasetScope: 'ptu', members: [], nextCursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchMarketplace('ptu', {
      blueprintId: 'bp/one',
      ownerHandle: 'Test Citizen',
      cursor: 'next+/=',
      limit: 20,
    });
    const url = new URL(fetchMock.mock.calls[0][0], 'https://app.invalid');
    expect(url.pathname).toBe('/api/auth/marketplace');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      datasetScope: 'ptu',
      blueprintId: 'bp/one',
      ownerHandle: 'Test Citizen',
      cursor: 'next+/=',
      limit: '20',
    });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
  });

  it('publishes only the explicit selection and can withdraw without changing it', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json({ account: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const selection = { enabled: true, blueprintIds: ['selected-only'], resourceEntryIds: ['lot-one'] };
    await saveMarketplacePublication('live', selection);
    await saveMarketplacePublication('live', { ...selection, enabled: false });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/account/marketplace?datasetScope=live');
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
      selection,
      { ...selection, enabled: false },
    ]);
  });

  it('uses the authenticated desktop bridge for requests and blocks', async () => {
    vi.mocked(fetchTauriApi).mockResolvedValue({ account: {}, request: {} });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await createMarketplaceCraftRequest('ptu', {
      blueprintId: 'bp',
      ownerHandle: 'Provider',
      comment: 'At Area18',
      resourcesOption: 'has_resources',
    });
    await setMarketplaceBlock('ptu', 'Provider', true);
    expect(fetchTauriApi).toHaveBeenNthCalledWith(
      1,
      '/api/auth/marketplace/craft-requests?datasetScope=ptu',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchTauriApi).toHaveBeenNthCalledWith(
      2,
      '/api/auth/marketplace/block?datasetScope=ptu',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ handle: 'Provider', blocked: true }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces rate limiting without replaying a report', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ message: 'Too many reports.' }, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(reportMarketplaceMember('live', 'Provider', 'spam')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
