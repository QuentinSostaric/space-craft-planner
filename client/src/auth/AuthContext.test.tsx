import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { applyOptimisticAccountMutations, buildMutationStorageKey, resolveClientStorageScope, type PersistedAccountMutation } from './accountMutations';
import * as authService from '../services/authService';
import type { AccountDatasetScope, StoredAccount } from '../services/authService';

vi.hoisted(() => vi.resetModules());
vi.mock('../services/authService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/authService')>(),
  fetchAuthSession: vi.fn(),
  fetchCurrentAccount: vi.fn(),
  saveCurrentAccountState: vi.fn(),
  saveAccountInventoryResources: vi.fn(),
  logoutAuthSession: vi.fn(),
  deleteCurrentAccount: vi.fn(),
}));
vi.mock('../services/apiBaseUrl', () => ({
  isTauriRuntime: () => false,
  clearDesktopAuthSession: vi.fn(),
}));

function accountFixture(datasetScope: AccountDatasetScope = 'live'): StoredAccount {
  return {
    accountId: 'discord_test', datasetScope, provider: 'discord', providerUserId: 'test',
    profile: { id: 'test', username: 'Citizen', displayName: 'Citizen', globalName: null, discriminator: null, avatarUrl: null },
    favoriteBlueprintIds: [], inventoryBlueprintIds: [], inventoryResources: [],
    planner: { goals: [], todoItems: [], resourceRequirements: {}, resourceProgress: {} },
    organizationBlueprintShares: {}, organizationResourceShares: {},
    sharedBlueprintIds: [], sharedResourceEntryIds: [], organizations: [],
    incomingCraftRequests: [], outgoingCraftRequests: [], rsi: null, isAdmin: false,
    lastRsiLinkAt: null, onboardingCompletedAt: null, onboardingDismissedAt: null,
    createdAt: null, updatedAt: null, lastLoginAt: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authService.fetchAuthSession).mockResolvedValue({ enabled: true, provider: 'discord', user: accountFixture().profile });
  vi.mocked(authService.fetchCurrentAccount).mockImplementation(async (scope) => accountFixture(scope));
  vi.mocked(authService.saveCurrentAccountState).mockImplementation(async (snapshot, scope) => ({ ...accountFixture(scope), ...snapshot }));
});
afterEach(() => vi.restoreAllMocks());

async function renderAccount() {
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('Account synchronization', () => {
  it('keeps a newer edit queued while an earlier snapshot finishes saving', async () => {
    const firstSave = deferred<StoredAccount>();
    vi.mocked(authService.saveCurrentAccountState).mockImplementationOnce(() => firstSave.promise);
    const { result } = await renderAccount();
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, inventoryBlueprintIds: ['first'] }), { flushAfterMs: 60_000 }));
    let flush!: Promise<void>;
    act(() => { flush = result.current.flushPendingMutations(); });
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, inventoryBlueprintIds: [...snapshot.inventoryBlueprintIds, 'second'] }), { flushAfterMs: 60_000 }));

    await act(async () => {
      firstSave.resolve({ ...accountFixture(), inventoryBlueprintIds: ['first'] });
      await flush;
    });

    expect(result.current.account?.inventoryBlueprintIds).toEqual(['first', 'second']);
    expect(result.current.pendingMutationCount).toBe(1);
    await act(async () => { await result.current.flushPendingMutations(); });
    expect(authService.saveCurrentAccountState).toHaveBeenLastCalledWith(expect.objectContaining({ inventoryBlueprintIds: ['first', 'second'] }), 'live');
    expect(result.current.pendingMutationCount).toBe(0);
  });

  it('saves from the in-memory queue when browser persistence is unavailable', async () => {
    const { result } = await renderAccount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, favoriteBlueprintIds: ['favorite'] }), { flushAfterMs: 60_000 }));
    await act(async () => { await result.current.flushPendingMutations(); });
    expect(authService.saveCurrentAccountState).toHaveBeenLastCalledWith(expect.objectContaining({ favoriteBlueprintIds: ['favorite'] }), 'live');
    expect(result.current.account?.favoriteBlueprintIds).toEqual(['favorite']);
    expect(result.current.pendingMutationCount).toBe(0);
  });

  it('keeps unsaved changes and the active session when signing out fails to sync', async () => {
    vi.mocked(authService.saveCurrentAccountState).mockRejectedValueOnce(new Error('Offline'));
    const { result } = await renderAccount();
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, favoriteBlueprintIds: ['unsaved'] }), { flushAfterMs: 60_000 }));
    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow('Sync them before signing out');
    });
    expect(authService.logoutAuthSession).not.toHaveBeenCalled();
    expect(result.current.account?.favoriteBlueprintIds).toEqual(['unsaved']);
    expect(result.current.pendingMutationCount).toBe(1);
    expect(result.current.syncStatus).toBe('error');
  });

  it('rejects edits while a deferred sign-out request is revoking the session', async () => {
    const signOut = deferred<void>();
    vi.mocked(authService.logoutAuthSession).mockImplementationOnce(() => signOut.promise);
    const { result } = await renderAccount();
    let logout!: Promise<void>;
    await act(async () => { logout = result.current.logout(); });
    expect(authService.logoutAuthSession).toHaveBeenCalledOnce();
    act(() => {
      expect(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, favoriteBlueprintIds: ['too-late'] }))).toThrow('Sign-out is in progress');
    });
    expect(result.current.account?.favoriteBlueprintIds).toEqual([]);
    expect(result.current.pendingMutationCount).toBe(0);
    vi.mocked(authService.fetchAuthSession).mockResolvedValueOnce({ enabled: true, provider: 'discord', user: null });
    await act(async () => { signOut.resolve(); await logout; });
    expect(result.current.account).toBeNull();
    expect(authService.saveCurrentAccountState).not.toHaveBeenCalled();
  });

  it('unlocks account edits if the sign-out request fails', async () => {
    const signOut = deferred<void>();
    vi.mocked(authService.logoutAuthSession).mockImplementationOnce(() => signOut.promise);
    const { result } = await renderAccount();
    let logout!: Promise<void>;
    await act(async () => { logout = result.current.logout(); });
    await act(async () => {
      signOut.reject(new Error('Network unavailable'));
      await expect(logout).rejects.toThrow('Network unavailable');
    });
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, favoriteBlueprintIds: ['after-failure'] }), { flushAfterMs: 60_000 }));
    expect(result.current.account?.favoriteBlueprintIds).toEqual(['after-failure']);
    expect(result.current.pendingMutationCount).toBe(1);
  });

  it('does not replace PTU data with the result of a delayed LIVE save', async () => {
    const liveSave = deferred<StoredAccount>();
    vi.mocked(authService.saveCurrentAccountState).mockImplementationOnce(() => liveSave.promise);
    const { result } = await renderAccount();
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, inventoryBlueprintIds: ['live-only'] }), { flushAfterMs: 60_000 }));
    let flush!: Promise<void>;
    act(() => { flush = result.current.flushPendingMutations(); });
    act(() => result.current.setAccountDatasetScope('ptu'));
    await waitFor(() => expect(result.current.account?.datasetScope).toBe('ptu'));
    act(() => result.current.queueAccountStateUpdate((snapshot) => ({ ...snapshot, inventoryBlueprintIds: ['ptu-only'] }), { flushAfterMs: 60_000 }));
    await act(async () => {
      liveSave.resolve({ ...accountFixture(), inventoryBlueprintIds: ['live-only'] });
      await flush;
    });
    expect(result.current.account?.datasetScope).toBe('ptu');
    expect(result.current.account?.inventoryBlueprintIds).toEqual(['ptu-only']);
    expect(result.current.pendingMutationCount).toBe(1);
  });

  it('removes pending changes from both datasets when deleting the account', async () => {
    const { result } = await renderAccount();
    const storageKey = buildMutationStorageKey('discord_test', resolveClientStorageScope(window.location.origin));
    localStorage.setItem(`${storageKey}:live`, '[]');
    localStorage.setItem(`${storageKey}:ptu`, '[]');
    vi.mocked(authService.fetchAuthSession).mockResolvedValueOnce({ enabled: true, provider: 'discord', user: null });
    await act(async () => { await result.current.deleteAccount(); });
    expect(localStorage.getItem(`${storageKey}:live`)).toBeNull();
    expect(localStorage.getItem(`${storageKey}:ptu`)).toBeNull();
    expect(result.current.account).toBeNull();
  });
});

describe('Optimistic inventories', () => {
  const baseMutation = { accountId: 'discord_test', id: 'mutation', createdAt: 1, flushAfterMs: 0 };

  it('preserves the server-supported precision for resource batches below 0.001 SCU', () => {
    const mutation: PersistedAccountMutation = {
      ...baseMutation, kind: 'account-inventory-resources', scope: 'snapshot', payload: { inventoryResources: [
        { id: 'batch', resourceId: 'iron', resourceName: 'Iron', quantity: 0.000125, quantityUnit: 'scu', quality: 500, createdAt: null, updatedAt: null },
      ] },
    };
    expect(applyOptimisticAccountMutations(accountFixture(), [mutation])?.inventoryResources[0]?.quantity).toBe(0.000125);
  });

  it('removes blueprint shares immediately when their inventory entry is removed', () => {
    const account = { ...accountFixture(), inventoryBlueprintIds: ['owned', 'removed'], organizationBlueprintShares: { ORG: ['owned', 'removed'] }, sharedBlueprintIds: ['owned', 'removed'] };
    const mutation: PersistedAccountMutation = {
      ...baseMutation, kind: 'account-snapshot', scope: 'snapshot', payload: { favoriteBlueprintIds: [], inventoryBlueprintIds: ['owned'], planner: account.planner },
    };
    const next = applyOptimisticAccountMutations(account, [mutation]);
    expect(next?.organizationBlueprintShares).toEqual({ ORG: ['owned'] });
    expect(next?.sharedBlueprintIds).toEqual(['owned']);
  });
});
