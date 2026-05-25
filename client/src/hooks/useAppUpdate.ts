import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isTauriRuntime } from '../services/apiBaseUrl';

export type UpdateMode = 'web' | 'desktop';
export type UpdateStatus = 'available' | 'downloading' | 'error';

export interface AppUpdateState {
  mode: UpdateMode | null;
  status: UpdateStatus | null;
  availableVersion: string | null;
  downloaded: number;
  contentLength: number | null;
  error: string | null;
  triggerUpdate: () => Promise<void>;
}

interface VersionFile {
  version?: string;
}

function compareVersions(left: string, right: string): number {
  const l = left.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const r = right.split('.').map((p) => Number.parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    const d = (l[i] ?? 0) - (r[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export const AppUpdateContext = createContext<AppUpdateState>({
  mode: null,
  status: null,
  availableVersion: null,
  downloaded: 0,
  contentLength: null,
  error: null,
  triggerUpdate: async () => {},
});

export function useAppUpdateState(): AppUpdateState {
  const [mode, setMode] = useState<UpdateMode | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [contentLength, setContentLength] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const desktopUpdateRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function detectUpdate() {
      if (isTauriRuntime()) {
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const nextUpdate = await check();
          if (!cancelled && nextUpdate) {
            desktopUpdateRef.current = nextUpdate;
            setMode('desktop');
            setAvailableVersion(nextUpdate.version);
            setStatus('available');
          }
        } catch (e) {
          console.error('[updater] check failed:', e);
        }
        return;
      }

      try {
        const response = await fetch(`/itemfabricator_version.json?ts=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as VersionFile;
        const latest = payload.version?.trim();
        if (!cancelled && latest && compareVersions(latest, __APP_VERSION__) > 0) {
          setMode('web');
          setAvailableVersion(latest);
          setStatus('available');
        }
      } catch {
        // silent
      }
    }

    void detectUpdate();
    return () => { cancelled = true; };
  }, []);

  const triggerUpdate = useCallback(async () => {
    setError(null);

    if (mode === 'web') {
      try {
        if ('caches' in window) {
          const names = await window.caches.keys();
          await Promise.all(names.map((n) => window.caches.delete(n)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update()));
        }
        const url = new URL(window.location.href);
        url.searchParams.set('appReload', String(Date.now()));
        window.location.replace(url.toString());
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Unable to refresh the app.');
      }
      return;
    }

    const update = desktopUpdateRef.current;
    if (!update) return;

    setStatus('downloading');
    setDownloaded(0);
    setContentLength(null);

    try {
      await update.downloadAndInstall((event: { event: string; data: { contentLength?: number; chunkLength: number } }) => {
        if (event.event === 'Started') { setContentLength(event.data.contentLength ?? null); setDownloaded(0); }
        if (event.event === 'Progress') { setDownloaded((c) => c + event.data.chunkLength); }
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      setStatus('error');
      const msg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
      console.error('[updater] install failed:', e);
      setError(msg || 'Unable to install the update.');
    }
  }, [mode]);

  return { mode, status, availableVersion, downloaded, contentLength, error, triggerUpdate };
}

export function useAppUpdate(): AppUpdateState {
  return useContext(AppUpdateContext);
}
