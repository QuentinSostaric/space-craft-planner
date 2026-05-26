import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { rememberScLogBlueprintNames } from '../services/scLogBlueprintCache';
import { useCraft } from '../store/CraftContext';

const WATCHER_AUTO_KEY = 'sc-log-watcher-auto';

interface WatcherStatus {
  running: boolean;
  channelPath: string | null;
}

export interface ScLogWatcherState {
  available: boolean;
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
  const { blueprints } = useCraft();
  const { user, queueAccountStateUpdate, accountDatasetScope } = useAuth();

  const [running, setRunning] = useState(false);
  const [channelPath, setChannelPath] = useState<string | null>(null);
  const [newBlueprintCount, setNewBlueprintCount] = useState(0);
  const [autoStartEnabled, setAutoStartEnabledState] = useState(
    () => localStorage.getItem(WATCHER_AUTO_KEY) === 'true',
  );
  const [autoStartupEnabled, setAutoStartupEnabled] = useState(false);

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

  // Listen for new blueprint events emitted by the Rust watcher
  useEffect(() => {
    if (!available) return;
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen<string[]>('sc-log-new-blueprints', (event) => {
      const names = event.payload;
      if (!names.length) return;

      setNewBlueprintCount((n) => n + names.length);
      rememberScLogBlueprintNames(scopeRef.current, names);

      const currentUser = userRef.current;
      if (!currentUser) return;

      // Map display names → blueprint IDs
      const nameToId = new Map(blueprintsRef.current.map((b) => [b.name, b.id]));
      const newIds = names.map((n) => nameToId.get(n)).filter(Boolean) as string[];
      if (!newIds.length) return;

      // Merge into existing inventory (never replace, only add)
      queueAccountStateUpdate(
        (snapshot) => ({
          ...snapshot,
          inventoryBlueprintIds: [
            ...new Set([...snapshot.inventoryBlueprintIds, ...newIds]),
          ],
        }),
        { flushAfterMs: 3000 },
      );
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [available, queueAccountStateUpdate]);

  const start = useCallback(async (path: string) => {
    await invoke('start_log_watcher', { channelPath: path });
    setRunning(true);
    setChannelPath(path);
  }, []);

  const stop = useCallback(() => {
    invoke('stop_log_watcher').catch(() => {});
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
