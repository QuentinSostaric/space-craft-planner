import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useScLogSync, type ScLogSyncState } from './useScLogSync';
import { useScLogWatcher, type ScLogWatcherState } from './useScLogWatcher';

interface ScLogContextValue {
  sync: ScLogSyncState;
  watcher: ScLogWatcherState;
}

const ScLogContext = createContext<ScLogContextValue | null>(null);

export function ScLogProvider({ children }: { children: ReactNode }) {
  const sync = useScLogSync();
  const watcher = useScLogWatcher();

  // Auto-start watcher if preference is saved and LIVE path is known
  useEffect(() => {
    if (watcher.autoStartEnabled && !watcher.running && sync.installPaths?.live) {
      void watcher.start(sync.installPaths.live);
    }
  }, [watcher.autoStartEnabled, sync.installPaths?.live, watcher.running, watcher.start]);

  const value = useMemo<ScLogContextValue>(() => ({ sync, watcher }), [sync, watcher]);

  return (
    <ScLogContext.Provider value={value}>
      {children}
    </ScLogContext.Provider>
  );
}

export function useScLog(): ScLogContextValue {
  const ctx = useContext(ScLogContext);
  if (!ctx) throw new Error('useScLog must be used within ScLogProvider');
  return ctx;
}
