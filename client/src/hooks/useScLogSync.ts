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

interface ScInstallPaths {
  live: string | null;
  ptu: string | null;
}

export type ScLogSyncStatus = 'idle' | 'scanning' | 'syncing' | 'done' | 'error';

export interface ScLogSyncChannelResult {
  scanned: boolean;
  foundNames: string[];
  matchedIds: string[];
  unmatchedNames: string[];
}

export interface ScLogSyncState {
  available: boolean;
  installPaths: ScInstallPaths | null;
  status: ScLogSyncStatus;
  error: string | null;
  live: ScLogSyncChannelResult | null;
  ptu: ScLogSyncChannelResult | null;
  sync: () => Promise<void>;
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
  const { blueprints } = useCraft();
  const { user, refreshSession, setAccountDatasetScope, accountDatasetScope } = useAuth();

  const [installPaths, setInstallPaths] = useState<ScInstallPaths | null>(null);
  const [status, setStatus] = useState<ScLogSyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ScLogSyncChannelResult | null>(null);
  const [ptu, setPtu] = useState<ScLogSyncChannelResult | null>(null);

  const detectPaths = useCallback(async () => {
    if (!available) return;
    try {
      const paths = await invoke<ScInstallPaths>('detect_sc_install_paths');
      setInstallPaths(paths);
    } catch (e) {
      setInstallPaths({ live: null, ptu: null });
    }
  }, [available]);

  useEffect(() => {
    if (available) {
      void detectPaths();
    }
  }, [available, detectPaths]);

  const scanChannel = useCallback(
    async (path: string): Promise<ScLogSyncChannelResult> => {
      const foundNames: string[] = await invoke<string[]>('scan_blueprints_from_logs', {
        channelPath: path,
      });

      const nameToId = new Map(blueprints.map((b) => [b.name, b.id]));
      const matchedIds: string[] = [];
      const unmatchedNames: string[] = [];

      for (const name of foundNames) {
        const id = nameToId.get(name);
        if (id) {
          matchedIds.push(id);
        } else {
          unmatchedNames.push(name);
        }
      }

      return { scanned: true, foundNames, matchedIds, unmatchedNames };
    },
    [blueprints],
  );

  const sync = useCallback(async () => {
    if (!available) return;
    if (!user) {
      setStatus('error');
      setError('You must be logged in to sync your blueprint inventory.');
      return;
    }

    setStatus('scanning');
    setError(null);
    setLive(null);
    setPtu(null);

    try {
      const paths = installPaths ?? (await invoke<ScInstallPaths>('detect_sc_install_paths'));
      if (!installPaths) setInstallPaths(paths);

      let liveResult: ScLogSyncChannelResult = EMPTY_RESULT;
      let ptuResult: ScLogSyncChannelResult = EMPTY_RESULT;

      if (paths.live) {
        liveResult = await scanChannel(paths.live);
        setLive(liveResult);
      }

      if (paths.ptu) {
        ptuResult = await scanChannel(paths.ptu);
        setPtu(ptuResult);
      }

      setStatus('syncing');

      const previousScope = accountDatasetScope;

      const syncScope = async (scope: AccountDatasetScope, matchedIds: string[]) => {
        const currentAccount = await fetchCurrentAccount(scope);
        await saveCurrentAccountState(
          {
            favoriteBlueprintIds: currentAccount.favoriteBlueprintIds,
            inventoryBlueprintIds: matchedIds,
            planner: currentAccount.planner,
          },
          scope,
        );
      };

      if (liveResult.scanned && liveResult.matchedIds.length > 0) {
        await syncScope('live', liveResult.matchedIds);
      }

      if (ptuResult.scanned && ptuResult.matchedIds.length > 0) {
        await syncScope('ptu', ptuResult.matchedIds);
      }

      // Restore original scope
      setAccountDatasetScope(previousScope);
      await refreshSession();

      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    available,
    installPaths,
    scanChannel,
    user,
    accountDatasetScope,
    setAccountDatasetScope,
    refreshSession,
  ]);

  return { available, installPaths, status, error, live, ptu, sync, detectPaths };
}
