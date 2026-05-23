import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { useI18n } from '../i18n/I18nContext';
import { isTauriRuntime } from '../services/apiBaseUrl';

type UpdateMode = 'web' | 'desktop';
type UpdateStatus = 'available' | 'downloading' | 'error';

interface VersionFile {
  version?: string;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function reloadWithFreshCache() {
  if ('caches' in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  }

  const url = new URL(window.location.href);
  url.searchParams.set('appReload', String(Date.now()));
  window.location.replace(url.toString());
}

export function AppUpdateSnackbar() {
  const { t } = useI18n();
  const [mode, setMode] = useState<UpdateMode | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [desktopUpdate, setDesktopUpdate] = useState<Update | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [contentLength, setContentLength] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detectUpdate() {
      if (isTauriRuntime()) {
        try {
          const nextUpdate = await check();
          if (!cancelled && nextUpdate) {
            setMode('desktop');
            setDesktopUpdate(nextUpdate);
            setAvailableVersion(nextUpdate.version);
            setStatus('available');
          }
        } catch {
          // Startup update checks should never interrupt the app.
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
        const latestVersion = payload.version?.trim();
        if (!cancelled && latestVersion && compareVersions(latestVersion, __APP_VERSION__) > 0) {
          setMode('web');
          setAvailableVersion(latestVersion);
          setStatus('available');
        }
      } catch {
        // Same behavior on web: no noisy error if detection fails.
      }
    }

    void detectUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    setError(null);

    if (mode === 'web') {
      try {
        await reloadWithFreshCache();
      } catch (nextError) {
        setStatus('error');
        setError(nextError instanceof Error ? nextError.message : t('Unable to refresh the app.', 'Impossible de rafraichir l app.', 'App konnte nicht aktualisiert werden.'));
      }
      return;
    }

    if (!desktopUpdate) return;

    setStatus('downloading');
    setDownloaded(0);
    setContentLength(null);

    try {
      await desktopUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          setContentLength(event.data.contentLength ?? null);
          setDownloaded(0);
        }
        if (event.event === 'Progress') {
          setDownloaded((current) => current + event.data.chunkLength);
        }
      });
      await relaunch();
    } catch (nextError) {
      setStatus('error');
      setError(nextError instanceof Error ? nextError.message : t('Unable to install the update.', 'Impossible d installer la mise a jour.', 'Update konnte nicht installiert werden.'));
    }
  }, [desktopUpdate, mode, t]);

  if (!status || !mode) return null;

  const isDownloading = status === 'downloading';
  const progressLabel = isDownloading && contentLength ? `${formatBytes(downloaded)} / ${formatBytes(contentLength)}` : null;

  return (
    <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} sx={{ maxWidth: { xs: 'calc(100vw - 24px)', sm: 520 } }}>
      <Alert
        severity={status === 'error' ? 'error' : 'info'}
        role={status === 'error' ? undefined : 'status'}
        variant="filled"
        action={
          <Button color="inherit" size="small" onClick={handleUpdate} disabled={isDownloading}>
            {mode === 'web' ? t('Refresh', 'Rafraichir', 'Neu laden') : t('Update', 'Mettre a jour', 'Aktualisieren')}
          </Button>
        }
        sx={{ width: '100%', alignItems: 'center' }}
      >
        <Stack spacing={0.75} sx={{ minWidth: { xs: 0, sm: 320 } }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {status === 'error'
              ? t('Update unavailable', 'Mise a jour indisponible', 'Update nicht verfugbar')
              : t(
                  `Version ${availableVersion ?? ''} is available`,
                  `Version ${availableVersion ?? ''} disponible`,
                  `Version ${availableVersion ?? ''} verfugbar`,
                )}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {error ??
              (mode === 'web'
                ? t('Reload the app with a fresh cache.', 'Recharge l app avec un cache neuf.', 'Ladt die App mit frischem Cache neu.')
                : t('Download and install the matching desktop release.', 'Telecharge et installe la release desktop compatible.', 'Ladt das passende Desktop-Release herunter und installiert es.'))}
          </Typography>
          {isDownloading && (
            <Stack spacing={0.5}>
              <LinearProgress color="inherit" aria-label={t('Update download progress', 'Progression du téléchargement')} />
              {progressLabel && <Typography variant="caption">{progressLabel}</Typography>}
            </Stack>
          )}
        </Stack>
      </Alert>
    </Snackbar>
  );
}
