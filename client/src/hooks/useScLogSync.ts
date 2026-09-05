import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { useCraft } from '../store/CraftContext';
import {
  fetchCurrentAccount,
  saveCurrentAccountState,
  type AccountDatasetScope,
} from '../services/authService';
import { rememberScLogBlueprintNames } from '../services/scLogBlueprintCache';

import { SC_PATHS_CHANGED, resolveScPaths, type ScInstallPaths } from '../services/scInstallPaths';
import type { Blueprint } from '../types';
import { fetchPublishedDatasetIndex, fetchPublishedDataset } from '../services/gameDataService';

export type ScLogSyncStatus = 'idle' | 'scanning' | 'syncing' | 'partial' | 'done' | 'error';

export interface ScLogSyncChannelResult {
  scanned: boolean;
  pendingCatalog?: boolean;
  foundNames: string[];
  matchedIds: string[];
  unmatchedNames: string[];
}

export interface ScLogSyncState {
  available: boolean;
  installPaths: ScInstallPaths | null;
  detecting: boolean;
  detectError: string | null;
  status: ScLogSyncStatus;
  error: string | null;
  live: ScLogSyncChannelResult | null;
  ptu: ScLogSyncChannelResult | null;
  sync: () => Promise<boolean>;
  detectPaths: () => Promise<void>;
}

const EMPTY_RESULT: ScLogSyncChannelResult = {
  scanned: false,
  foundNames: [],
  matchedIds: [],
  unmatchedNames: [],
};

export function useScLogSync(): ScLogSyncState {
  const available = isTauriRuntime();
  const { blueprints, activeDataset } = useCraft();
  const { user, refreshSession, setAccountDatasetScope, accountDatasetScope } = useAuth();

  const [installPaths, setInstallPaths] = useState<ScInstallPaths | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [status, setStatus] = useState<ScLogSyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ScLogSyncChannelResult | null>(null);
  const [ptu, setPtu] = useState<ScLogSyncChannelResult | null>(null);

  const detectPaths = useCallback(async () => {
    if (!available) {
      setDetectError('Log synchronization is available in the desktop app.');
      return;
    }
    setDetecting(true);
    setDetectError(null);
    try {
      const paths = await invoke<ScInstallPaths>('detect_sc_install_paths');
      const entries = resolveScPaths(paths);
      setInstallPaths({ ...paths, live: entries.find(p => p.scope === 'live')?.path ?? null, ptu: entries.find(p => p.scope === 'ptu')?.path ?? null });
      if (!entries.length) setDetectError('No Star Citizen installation found. Add the LIVE or PTU folder in Settings.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useScLogSync] detect_sc_install_paths failed:', e);
      setDetectError(`Unable to detect installations: ${msg}`);
      setInstallPaths({ live: null, ptu: null });
    } finally {
      setDetecting(false);
    }
  }, [available]);

  useEffect(() => {
    if (available) {
      void detectPaths();
      window.addEventListener(SC_PATHS_CHANGED, detectPaths);
      return () => window.removeEventListener(SC_PATHS_CHANGED, detectPaths);
    }
  }, [available, detectPaths]);

  const scanChannel = useCallback(
    async (path: string, scope: AccountDatasetScope, getCatalog: (scope: AccountDatasetScope) => Promise<Blueprint[] | null>): Promise<ScLogSyncChannelResult> => {
      const foundNames: string[] = await invoke<string[]>('scan_blueprints_from_logs', {
        channelPath: path,
      });
      const knownNames = rememberScLogBlueprintNames(scope, foundNames);

      // Case-insensitive, whitespace-normalised lookup so minor formatting
      // differences between the game log and the dataset don't silently drop blueprints.
      const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!knownNames.length) return { ...EMPTY_RESULT, scanned: true };
      let catalog: Blueprint[] | null;
      try { catalog = await getCatalog(scope); }
      catch (e) { throw new Error(`Unable to load the ${scope.toUpperCase()} blueprint catalog: ${e instanceof Error ? e.message : String(e)}`); }
      if (!catalog) return { scanned: true, pendingCatalog: true, foundNames: knownNames, matchedIds: [], unmatchedNames: [] };
      const nameToId = new Map(catalog.map((b) => [normalize(b.name), b.id]));
      const matchedIds: string[] = [];
      const unmatchedNames: string[] = [];

      for (const name of knownNames) {
        const id = nameToId.get(normalize(name));
        if (id) {
          matchedIds.push(id);
        } else {
          unmatchedNames.push(name);
        }
      }

      return { scanned: true, foundNames: knownNames, matchedIds, unmatchedNames };
    },
    [],
  );

  const sync = useCallback(async () => {
    if (!available) return false;
    if (!user) {
      setStatus('error');
      setError('You must be logged in to sync your blueprint inventory.');
      return false;
    }

    setStatus('scanning');
    setError(null);
    setLive(null);
    setPtu(null);

    try {
      const paths = await invoke<ScInstallPaths>('detect_sc_install_paths');
      const entries = resolveScPaths(paths);
      if (!entries.length) throw new Error('No Star Citizen installation found. Add the LIVE or PTU folder in Settings.');
      let liveResult: ScLogSyncChannelResult = { ...EMPTY_RESULT };
      let ptuResult: ScLogSyncChannelResult = { ...EMPTY_RESULT };
      const issues: string[] = [];
      const catalogs = new Map<AccountDatasetScope, Promise<Blueprint[] | null>>();
      let index: ReturnType<typeof fetchPublishedDatasetIndex> | undefined;
      const getCatalog = (scope: AccountDatasetScope) => {
        if (!catalogs.has(scope)) {
          catalogs.set(scope, (async () => {
            if (activeDataset.channel === scope) return blueprints;
            index ??= fetchPublishedDatasetIndex();
            if (!(await index).datasets.some(dataset => dataset.channel === scope)) return null;
            return (await fetchPublishedDataset(scope)).blueprints;
          })());
        }
        return catalogs.get(scope)!;
      };
      for (const entry of entries) {
        try {
          const result = await scanChannel(entry.path, entry.scope, getCatalog);
          const previous = entry.scope === 'live' ? liveResult : ptuResult;
          const merged = {
            scanned: true,
            pendingCatalog: previous.pendingCatalog || result.pendingCatalog,
            foundNames: [...new Set([...previous.foundNames, ...result.foundNames])],
            matchedIds: [...new Set([...previous.matchedIds, ...result.matchedIds])],
            unmatchedNames: [...new Set([...previous.unmatchedNames, ...result.unmatchedNames])],
          };
          if (entry.scope === 'live') { liveResult = merged; setLive(merged); }
          else { ptuResult = merged; setPtu(merged); }
        } catch (e) {
          issues.push(`${entry.scope.toUpperCase()} (${entry.path}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      setStatus('syncing');

      const previousScope = accountDatasetScope;

      const syncScope = async (scope: AccountDatasetScope, matchedIds: string[]) => {
        const currentAccount = await fetchCurrentAccount(scope);
        await saveCurrentAccountState(
          {
            favoriteBlueprintIds: currentAccount.favoriteBlueprintIds,
            inventoryBlueprintIds: [
              ...new Set([...currentAccount.inventoryBlueprintIds, ...matchedIds]),
            ],
            planner: currentAccount.planner,
          },
          scope,
        );
      };

      if (liveResult.scanned && liveResult.matchedIds.length > 0) {
        try { await syncScope('live', liveResult.matchedIds); }
        catch (e) { issues.push(`Unable to save LIVE inventory: ${String(e)}`); }
      }

      if (ptuResult.scanned && ptuResult.matchedIds.length > 0) {
        try { await syncScope('ptu', ptuResult.matchedIds); }
        catch (e) { issues.push(`Unable to save PTU inventory: ${String(e)}`); }
      }

      // Restore original scope
      setAccountDatasetScope(previousScope);
      await refreshSession();

      if (issues.length) throw new Error(`Synchronization incomplete. ${issues.join(' • ')}`);
      const pending = liveResult.pendingCatalog || ptuResult.pendingCatalog;
      setStatus(pending ? 'partial' : 'done');
      return !pending;
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [
    available,
    blueprints,
    activeDataset.channel,
    scanChannel,
    user,
    accountDatasetScope,
    setAccountDatasetScope,
    refreshSession,
  ]);

  return { available, installPaths, detecting, detectError, status, error, live, ptu, sync, detectPaths };
}
