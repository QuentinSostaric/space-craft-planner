import { Stack, Typography } from '../ui/system';
import { AppButton } from './ui/controls';
import { AppProgressBar } from './ui/feedback';
import { AppSnackbar } from './ui/feedback';
import { useI18n } from '../i18n/I18nContext';
import { formatBytes, useAppUpdate } from '../hooks/useAppUpdate';

export function AppUpdateSnackbar() {
  const { t } = useI18n();
  const { mode, status, availableVersion, downloaded, contentLength, error, triggerUpdate } = useAppUpdate();

  // Desktop: header button handles the "available" state; snackbar only for download progress and errors.
  if (!status || !mode) return null;
  if (mode === 'desktop' && status === 'available') return null;

  const isDownloading = status === 'downloading';
  const progressLabel = isDownloading && contentLength ? `${formatBytes(downloaded)} / ${formatBytes(contentLength)}` : null;

  return (
    <AppSnackbar
      open
      severity={status === 'error' ? 'error' : 'info'}
      action={(
        <AppButton variant="ghost" size="sm" onClick={triggerUpdate} disabled={isDownloading} sx={{ minHeight: 44 }}>
          {mode === 'web' ? t('Refresh', 'Rafraichir', 'Neu laden') : t('Update', 'Mettre a jour', 'Aktualisieren')}
        </AppButton>
      )}
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
            <AppProgressBar label={t('Update download progress', 'Progression du téléchargement')} />
            {progressLabel && <Typography variant="caption">{progressLabel}</Typography>}
          </Stack>
        )}
      </Stack>
    </AppSnackbar>
  );
}
