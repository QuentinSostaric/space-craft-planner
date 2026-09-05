import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useScLogSync } from './useScLogSync';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), save: vi.fn(), fetch: vi.fn(), dataset: vi.fn(), index: vi.fn(), refresh: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../services/apiBaseUrl', () => ({ isTauriRuntime: () => true }));
vi.mock('../store/CraftContext', () => ({ useCraft: () => ({ blueprints: [{ id: 'live-id', name: 'Live blueprint' }], activeDataset: { channel: 'live' } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, refreshSession: mocks.refresh, setAccountDatasetScope: () => {}, accountDatasetScope: 'live' }) }));
vi.mock('../services/authService', () => ({ fetchCurrentAccount: mocks.fetch, saveCurrentAccountState: mocks.save }));
vi.mock('../services/gameDataService', () => ({ fetchPublishedDataset: mocks.dataset, fetchPublishedDatasetIndex: mocks.index }));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.index.mockResolvedValue({ datasets: [{ channel: 'live' }, { channel: 'ptu' }] });
  mocks.fetch.mockResolvedValue({ favoriteBlueprintIds: [], inventoryBlueprintIds: ['existing'], planner: {} });
  mocks.save.mockResolvedValue({});
  mocks.dataset.mockResolvedValue({ blueprints: [{ id: 'ptu-id', name: 'PTU blueprint' }] });
});
it('scans custom installations without auto-detected paths and saves each scope with its catalog', async () => {
  localStorage.setItem('sc-custom-install-paths', JSON.stringify([
    { id: '1', label: 'LIVE', path: 'Z:/Custom/LIVE' }, { id: '2', label: 'EPTU', path: 'Y:/Custom/EPTU' },
  ]));
  mocks.invoke.mockImplementation(async (command, args) => command === 'detect_sc_install_paths'
    ? { live: null, ptu: null, channels: [] }
    : args.channelPath.endsWith('EPTU') ? ['PTU blueprint'] : ['Live blueprint']);
  const { result } = renderHook(() => useScLogSync());
  await waitFor(() => expect(result.current.installPaths?.live).toBe('Z:/Custom/LIVE'));
  await act(async () => { expect(await result.current.sync()).toBe(true); });
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['existing', 'live-id'] }), 'live');
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['existing', 'ptu-id'] }), 'ptu');
});
it('reports incomplete scans while still importing readable installations', async () => {
  mocks.invoke.mockImplementation(async (command, args) => {
    if (command === 'detect_sc_install_paths') return { live: 'C:/LIVE', ptu: 'C:/PTU' };
    if (args.channelPath.endsWith('LIVE')) throw new Error('Access denied');
    return ['PTU blueprint'];
  });
  const { result } = renderHook(() => useScLogSync());
  await waitFor(() => expect(result.current.detecting).toBe(false));
  await act(async () => { expect(await result.current.sync()).toBe(false); });
  expect(result.current.status).toBe('error');
  expect(result.current.error).toContain('Access denied');
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['existing', 'ptu-id'] }), 'ptu');
});
it('does not report success when no installation exists', async () => {
  mocks.invoke.mockResolvedValue({ live: null, ptu: null });
  const { result } = renderHook(() => useScLogSync());
  await waitFor(() => expect(result.current.detecting).toBe(false));
  await act(async () => { expect(await result.current.sync()).toBe(false); });
  expect(result.current.error).toContain('No Star Citizen installation');
  expect(mocks.save).not.toHaveBeenCalled();
});

it('preserves PTU detections without a published catalog while importing LIVE', async () => {
  mocks.index.mockResolvedValue({ datasets: [{ channel: 'live' }] });
  mocks.invoke.mockImplementation(async (command, args) => command === 'detect_sc_install_paths'
    ? { live: 'C:/LIVE', ptu: 'J:/PTU', channels: ['C:/LIVE', 'J:/PTU', 'J:/HOTFIX'] }
    : args.channelPath.endsWith('LIVE') ? ['Live blueprint'] : ['PTU blueprint']);
  const { result } = renderHook(() => useScLogSync());
  await waitFor(() => expect(result.current.detecting).toBe(false));
  await act(async () => { expect(await result.current.sync()).toBe(false); });
  expect(result.current.status).toBe('partial');
  expect(result.current.error).toBeNull();
  expect(result.current.ptu?.pendingCatalog).toBe(true);
  expect(result.current.ptu?.foundNames).toEqual(['PTU blueprint']);
  expect(mocks.dataset).not.toHaveBeenCalled();
  expect(mocks.index).toHaveBeenCalledTimes(1);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['existing', 'live-id'] }), 'live');
  // A later sync matches the persisted names even if they are no longer in logs.
  mocks.index.mockResolvedValue({ datasets: [{ channel: 'live' }, { channel: 'ptu' }] });
  mocks.invoke.mockImplementation(async command => command === 'detect_sc_install_paths'
    ? { live: null, ptu: 'J:/PTU' } : []);
  await act(async () => { expect(await result.current.sync()).toBe(true); });
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['existing', 'ptu-id'] }), 'ptu');
});
it('does not request a catalog when logs contain no blueprints', async () => {
  mocks.invoke.mockImplementation(async command => command === 'detect_sc_install_paths'
    ? { live: null, ptu: 'J:/PTU' } : []);
  const { result } = renderHook(() => useScLogSync());
  await waitFor(() => expect(result.current.detecting).toBe(false));
  await act(async () => { expect(await result.current.sync()).toBe(true); });
  expect(mocks.index).not.toHaveBeenCalled();
  expect(mocks.dataset).not.toHaveBeenCalled();
});
it('reports catalog network failures as errors rather than missing catalogs', async () => {
  mocks.index.mockRejectedValue(new Error('Network unavailable'));
  mocks.invoke.mockImplementation(async command => command === 'detect_sc_install_paths'
    ? { live: null, ptu: 'J:/PTU' } : ['PTU blueprint']);
  const { result } = renderHook(() => useScLogSync());
  await waitFor(() => expect(result.current.detecting).toBe(false));
  await act(async () => { expect(await result.current.sync()).toBe(false); });
  expect(result.current.status).toBe('error');
  expect(result.current.error).toContain('Unable to load the PTU blueprint catalog: Network unavailable');
});
