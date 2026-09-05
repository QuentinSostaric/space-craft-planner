import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { rememberScLogBlueprintNames } from '../services/scLogBlueprintCache';
import { useCraft } from '../store/CraftContext';
import { fetchPublishedDataset } from '../services/gameDataService';
import { fetchCurrentAccount, saveCurrentAccountState } from '../services/authService';

const WATCHER_AUTO_KEY = 'sc-log-watcher-auto';

interface WatcherStatus {
  running: boolean;
  channelPath: string | null;
}

export interface ScLogWatcherState {
  available: boolean;
  error: string | null;
  running: boolean;
  channelPath: string | null;
  newBlueprintCount: number;
  autoStartEnabled: boolean;
  autoStartupEnabled: boolean;
  start: (channelPath: string) => Promise<void>;
  stop: () => void;
  setAutoStart: (enabled: boolean) => void;
  enableAutoStartup: () => Promise<void>;
  disableAutoStartup: () => Promise<void>;
  clearNewCount: () => void;
}

export function useScLogWatcher(): ScLogWatcherState {
  const available = isTauriRuntime();
  const { blueprints, activeDataset } = useCraft();
  const { user, queueAccountStateUpdate, accountDatasetScope } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [channelPath, setChannelPath] = useState<string | null>(null);
  const [newBlueprintCount, setNewBlueprintCount] = useState(0);
  const [autoStartEnabled, setAutoStartEnabledState] = useState(
    () => localStorage.getItem(WATCHER_AUTO_KEY) === 'true',
  );
  const [autoStartupEnabled, setAutoStartupEnabled] = useState(false);

  const datasetChannelRef = useRef(activeDataset.channel);
  datasetChannelRef.current = activeDataset.channel;
  const blueprintsRef = useRef(blueprints);
  blueprintsRef.current = blueprints;

  const userRef = useRef(user);
  userRef.current = user;

  const scopeRef = useRef(accountDatasetScope);
  scopeRef.current = accountDatasetScope;

  // Check Windows auto-startup state on mount
  useEffect(() => {
    if (!available) return;
    invoke<boolean>('is_auto_startup_enabled')
      .then(setAutoStartupEnabled)
      .catch(() => {});
  }, [available]);

  // Sync watcher status on mount
  useEffect(() => {
    if (!available) return;
    invoke<WatcherStatus>('get_watcher_status').then((s) => {
      setRunning(s.running);
      setChannelPath(s.channelPath);
    }).catch(() => {});
  }, [available]);

  useEffect(() => {
    if (!available) return;
    let disposed = false;
    let cleanup: UnlistenFn | undefined;
    listen<string>('sc-log-error', event => {
      setError(event.payload);
      setRunning(false);
    }).then(fn => { if (disposed) fn(); else cleanup = fn; }).catch(e => setError(String(e)));
    return () => { disposed = true; cleanup?.(); };
  }, [available]);

  // Listen for new blueprint events emitted by the Rust watcher
  useEffect(() => {
    if (!available) return;
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    let updates = Promise.resolve();
    listen<string[]>('sc-log-new-blueprints', (event) => {
      const names = event.payload;
      if (!names.length) return;

      setNewBlueprintCount((n) => n + names.length);
      rememberScLogBlueprintNames('live', names);

      const currentUser = userRef.current;
      if (!currentUser) return;

      updates = updates.then(async () => {
        if (cancelled || userRef.current?.id !== currentUser.id) return;
        const catalog = datasetChannelRef.current === 'live'
          ? blueprintsRef.current : (await fetchPublishedDataset('live')).blueprints;
        const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameToId = new Map(catalog.map(b => [normalize(b.name), b.id]));
        const newIds = names.map(n => nameToId.get(normalize(n))).filter(Boolean) as string[];
        if (!newIds.length || cancelled || userRef.current?.id !== currentUser.id) return;
        if (scopeRef.current === 'live') {
          queueAccountStateUpdate(snapshot => ({
            ...snapshot,
            inventoryBlueprintIds: [...new Set([...snapshot.inventoryBlueprintIds, ...newIds])],
          }), { flushAfterMs: 3000 });
        } else {
          // The watcher follows LIVE even when the user browses the PTU catalog.
          const current = await fetchCurrentAccount('live');
          if (cancelled || userRef.current?.id !== currentUser.id) return;
          await saveCurrentAccountState({
            favoriteBlueprintIds: current.favoriteBlueprintIds,
            inventoryBlueprintIds: [...new Set([...current.inventoryBlueprintIds, ...newIds])],
            planner: current.planner,
          }, 'live');
        }
      }).catch(e => setError(`Unable to save detected blueprints. Retry with Sync game: ${String(e)}`));
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    }).catch(e => setError(`Unable to listen for blueprints: ${String(e)}`));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [available, queueAccountStateUpdate]);

  const start = useCallback(async (path: string) => {
    setError(null);
    try {
      await invoke('start_log_watcher', { channelPath: path });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
    setRunning(true);
    setChannelPath(path);
  }, []);

  const stop = useCallback(() => {
    invoke('stop_log_watcher').catch(e => setError(`Unable to stop log monitoring: ${String(e)}`));
    setRunning(false);
    setChannelPath(null);
  }, []);

  const setAutoStart = useCallback((enabled: boolean) => {
    setAutoStartEnabledState(enabled);
    localStorage.setItem(WATCHER_AUTO_KEY, String(enabled));
  }, []);

  const enableAutoStartup = useCallback(async () => {
    await invoke('enable_auto_startup');
    setAutoStartupEnabled(true);
  }, []);

  const disableAutoStartup = useCallback(async () => {
    await invoke('disable_auto_startup');
    setAutoStartupEnabled(false);
  }, []);

  const clearNewCount = useCallback(() => setNewBlueprintCount(0), []);

  return {
    available,
    error,
    running,
    channelPath,
    newBlueprintCount,
    autoStartEnabled,
    autoStartupEnabled,
    start,
    stop,
    setAutoStart,
    enableAutoStartup,
    disableAutoStartup,
    clearNewCount,
  };
}
