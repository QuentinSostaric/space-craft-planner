import { useEffect, useMemo, useRef } from 'react';
import type { AccountStateSnapshot, StoredAccount } from '../services/authService';
import { useCraft } from '../store/CraftContext';
import { computeLocalBlueprintImportPlan } from './localAccountImport';
import { useAuth } from './AuthContext';

function hasStoredAccountState(account: StoredAccount): boolean {
  return (
    account.favoriteBlueprintIds.length > 0 ||
    account.inventoryBlueprintIds.length > 0 ||
    account.planner.goals.length > 0 ||
    account.planner.todoItems.length > 0 ||
    Object.keys(account.planner.resourceRequirements).length > 0 ||
    Object.keys(account.planner.resourceProgress).length > 0
  );
}

function isSnapshotEmpty(snapshot: AccountStateSnapshot): boolean {
  return (
    snapshot.favoriteBlueprintIds.length === 0 &&
    snapshot.inventoryBlueprintIds.length === 0 &&
    snapshot.planner.goals.length === 0 &&
    snapshot.planner.todoItems.length === 0 &&
    Object.keys(snapshot.planner.resourceRequirements).length === 0 &&
    Object.keys(snapshot.planner.resourceProgress).length === 0
  );
}

function createSnapshotFromAccount(account: StoredAccount): AccountStateSnapshot {
  return {
    favoriteBlueprintIds: account.favoriteBlueprintIds,
    inventoryBlueprintIds: account.inventoryBlueprintIds,
    planner: account.planner,
  };
}

export function AccountStateSync() {
  const { enabled, loading, user, account, syncAccountState, accountDatasetScope, setAccountDatasetScope } = useAuth();
  const {
    activeDataset,
    favoriteIds,
    inventoryIds,
    goals,
    plannerTodoItems,
    plannerResourceRequirements,
    resourceProgress,
  } = useCraft();
  const initialSyncHandledRef = useRef(false);
  const mirrorEstablishedRef = useRef(false);
  const lastSyncedSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    const nextScope = activeDataset.channel === 'ptu' ? 'ptu' : 'live';
    if (nextScope !== accountDatasetScope) {
      setAccountDatasetScope(nextScope);
    }
  }, [accountDatasetScope, activeDataset.channel, setAccountDatasetScope]);

  const snapshot = useMemo<AccountStateSnapshot>(
    () => ({
      favoriteBlueprintIds: favoriteIds,
      inventoryBlueprintIds: inventoryIds,
      planner: {
        goals,
        todoItems: plannerTodoItems,
        resourceRequirements: plannerResourceRequirements,
        resourceProgress,
      },
    }),
    [favoriteIds, goals, inventoryIds, plannerResourceRequirements, plannerTodoItems, resourceProgress],
  );
  const localImportPlan = useMemo(
    () =>
      computeLocalBlueprintImportPlan(account, {
        favoriteBlueprintIds: favoriteIds,
        inventoryBlueprintIds: inventoryIds,
      }),
    [account, favoriteIds, inventoryIds],
  );
  const serializedSnapshot = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const serializedAccountSnapshot = useMemo(
    () => (account ? JSON.stringify(createSnapshotFromAccount(account)) : null),
    [account],
  );

  useEffect(() => {
    initialSyncHandledRef.current = false;
    mirrorEstablishedRef.current = false;
    lastSyncedSnapshotRef.current = null;
  }, [account?.accountId, accountDatasetScope, activeDataset.channel, user?.id]);

  useEffect(() => {
    if (loading || !enabled || !user || !account) {
      return undefined;
    }

    if ((activeDataset.channel === 'ptu' ? 'ptu' : 'live') !== accountDatasetScope) {
      return undefined;
    }

    if (account.datasetScope && account.datasetScope !== accountDatasetScope) {
      return undefined;
    }

    if (localImportPlan.hasPendingImport) {
      return undefined;
    }

    if (!initialSyncHandledRef.current) {
      initialSyncHandledRef.current = true;
      if (isSnapshotEmpty(snapshot) && hasStoredAccountState(account)) {
        lastSyncedSnapshotRef.current = serializedSnapshot;
        return undefined;
      }
    }

    if (serializedAccountSnapshot === serializedSnapshot) {
      mirrorEstablishedRef.current = true;
      lastSyncedSnapshotRef.current = serializedSnapshot;
      return undefined;
    }

    if (!mirrorEstablishedRef.current && isSnapshotEmpty(snapshot) && hasStoredAccountState(account)) {
      lastSyncedSnapshotRef.current = serializedSnapshot;
      return undefined;
    }

    if (lastSyncedSnapshotRef.current === serializedSnapshot) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      lastSyncedSnapshotRef.current = serializedSnapshot;
      void syncAccountState(snapshot).catch(() => {
        lastSyncedSnapshotRef.current = null;
      });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    account,
    accountDatasetScope,
    activeDataset.channel,
    enabled,
    loading,
    localImportPlan.hasPendingImport,
    serializedAccountSnapshot,
    serializedSnapshot,
    snapshot,
    syncAccountState,
    user,
  ]);

  return null;
}
