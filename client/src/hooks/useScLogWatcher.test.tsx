import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useScLogWatcher } from './useScLogWatcher';
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), listeners: new Map<string, (event: { payload: unknown }) => void>(),
  queue: vi.fn(), save: vi.fn(), fetch: vi.fn(), dataset: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (name, callback) => { mocks.listeners.set(name, callback); return () => mocks.listeners.delete(name); }) }));
vi.mock('../services/apiBaseUrl', () => ({ isTauriRuntime: () => true }));
vi.mock('../store/CraftContext', () => ({ useCraft: () => ({ blueprints: [{ id: 'ptu-id', name: 'Shared name' }], activeDataset: { channel: 'ptu' } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, queueAccountStateUpdate: mocks.queue, accountDatasetScope: 'ptu' }) }));
vi.mock('../services/authService', () => ({ fetchCurrentAccount: mocks.fetch, saveCurrentAccountState: mocks.save }));
vi.mock('../services/gameDataService', () => ({ fetchPublishedDataset: mocks.dataset }));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.listeners.clear();
  mocks.invoke.mockImplementation(async (command) => command === 'get_watcher_status' ? { running: false, channelPath: null } : false);
  mocks.fetch.mockResolvedValue({ favoriteBlueprintIds: [], inventoryBlueprintIds: ['existing'], planner: {} });
  mocks.dataset.mockResolvedValue({ blueprints: [{ id: 'live-id', name: 'Shared name' }] });
  mocks.save.mockResolvedValue({});
});
it('stores LIVE detections in LIVE while browsing PTU', async () => {
  renderHook(() => useScLogWatcher());
  await act(async () => { mocks.listeners.get('sc-log-new-blueprints')!({ payload: ['Shared name'] }); });
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['existing', 'live-id'] }), 'live'));
  expect(mocks.queue).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('sc-log-blueprint-names-v1')!)).toEqual({ live: ['Shared name'] });
});
it('exposes native read errors and stops displaying a running watcher', async () => {
  const { result } = renderHook(() => useScLogWatcher());
  await act(async () => { await result.current.start('Z:/Custom/LIVE'); });
  expect(result.current.running).toBe(true);
  act(() => mocks.listeners.get('sc-log-error')!({ payload: 'Unable to read Game.log: Access denied' }));
  expect(result.current.running).toBe(false);
  expect(result.current.error).toContain('Access denied');
});
