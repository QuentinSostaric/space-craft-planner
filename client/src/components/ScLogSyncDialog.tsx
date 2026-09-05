import { AppAlert, AppProgressSpinner } from './ui/feedback';
import { AppButton } from './ui/controls';
import { AppDialog, AppTooltip } from './ui/overlays';
import { SyncIcon, CheckCircleOutlineIcon, ErrorOutlineIcon } from '../ui/icons';
import { useState } from 'react';
import { FONT_MONO, TEXT_LABEL} from '../theme';
import { useScLog } from '../hooks/ScLogSyncContext';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { ScLogSyncState } from '../hooks/useScLogSync';

export type { ScLogSyncState };

// ─── Inline sync button ───────────────────────────────────────────────────────

interface SyncBlueprintsButtonProps {
  onSuccess?: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium';
}

export function SyncBlueprintsButton({
  onSuccess,
  variant = 'outlined',
  size = 'small',
}: SyncBlueprintsButtonProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { sync } = useScLog();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = sync.status === 'scanning' || sync.status === 'syncing';
  const isDone = sync.status === 'done';
  const isPartial = sync.status === 'partial';
  const isLoggedIn = Boolean(user);
  const hasPath = Boolean(sync.installPaths?.live ?? sync.installPaths?.ptu);

  const handleSync = () => {
    setDetailsOpen(true);
    setLocalError(null);
    sync.sync().then((success) => {
      if (success && onSuccess) onSuccess();
    }).catch((err: unknown) => {
      setLocalError(err instanceof Error ? err.message : 'Sync failed.');
    });
  };

  if (!sync.available) return null;

  const displayedError = localError ?? sync.error ?? sync.detectError;
  const unmatchedCount = (sync.live?.unmatchedNames.length ?? 0) + (sync.ptu?.unmatchedNames.length ?? 0);
  const pendingScopes = (['live', 'ptu'] as const).filter(scope => sync[scope]?.pendingCatalog);
  const tooltipTitle = !isLoggedIn
    ? t('Login with Discord to sync your inventory', 'Connecte-toi avec Discord pour synchroniser')
    : !hasPath
      ? t('No Star Citizen installation detected', 'Aucune installation Star Citizen détectée')
      : displayedError ?? '';

  const appVariant = variant === 'contained' ? 'primary' : variant === 'text' ? 'ghost' : 'secondary';
  const icon = isBusy ? (
    <AppProgressSpinner size={13} strokeWidth={4} />
  ) : isDone ? (
    <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
  ) : displayedError || isPartial ? (
    <ErrorOutlineIcon sx={{ fontSize: 14, color: displayedError ? 'error.main' : 'warning.main' }} />
  ) : (
    <SyncIcon sx={{ fontSize: 14 }} />
  );

  return (
    <>
    <AppTooltip content={tooltipTitle} disabled={!tooltipTitle}>
      <span>
        <AppButton
          variant={appVariant}
          size={size === 'small' ? 'sm' : 'md'}
          onClick={handleSync}
          disabled={isBusy || !isLoggedIn || !hasPath}
          icon={icon}
          sx={{
            minHeight: size === 'small' ? 44 : 46,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: TEXT_LABEL,
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            ...(isDone ? { color: 'success.main', borderColor: 'success.main' } : null),
            ...(displayedError ? { color: 'error.main', borderColor: 'error.main' } : null),
          }}
        >
          {isBusy
            ? (sync.status === 'scanning'
              ? t('Scanning…', 'Scan…')
              : t('Syncing…', 'Sync…'))
            : isPartial
              ? t('Partially synced', 'Synchronisation partielle')
            : isDone
              ? t('Synced', 'Synchronisé')
              : t('Sync game', 'Sync game')}
        </AppButton>
      </span>
    </AppTooltip>
    <AppDialog
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
      title={t('Blueprint synchronization', 'Synchronisation des blueprints')}
      closeLabel={t('Close', 'Fermer')}
      footer={<AppButton variant="secondary" onClick={() => setDetailsOpen(false)}>{t('Close', 'Fermer')}</AppButton>}
    >
      {isBusy && <p role="status">{t('Reading logs and synchronizing…', 'Lecture des logs et synchronisation…')}</p>}
      {(['live', 'ptu'] as const).map(scope => {
        const result = sync[scope];
        if (!result?.scanned || result.pendingCatalog) return null;
        return <p key={scope}>{scope.toUpperCase()} — {t(`${result.matchedIds.length} blueprints recognized.`, `${result.matchedIds.length} blueprints reconnus.`)}</p>;
      })}
      {isDone && <AppAlert severity="success">{t('Synchronization complete.', 'Synchronisation terminée.')}</AppAlert>}
      {pendingScopes.map(scope => <AppAlert key={scope} severity="warning">
        {t(`No ${scope.toUpperCase()} catalog is currently published. Detected names are saved on this computer. Run Sync game again once the catalog is available.`, `Aucun catalogue ${scope.toUpperCase()} n’est actuellement publié. Les noms détectés sont conservés sur cet ordinateur. Relance Sync game lorsque le catalogue sera disponible.`)}
      </AppAlert>)}
      {displayedError && <AppAlert severity="error" sx={{ overflowWrap: 'anywhere' }}>{displayedError}</AppAlert>}
      {(isDone || isPartial) && unmatchedCount > 0 && <AppAlert severity="warning">{t(`${unmatchedCount} blueprint names could not be matched to the catalog.`, `${unmatchedCount} noms de blueprints ne correspondent pas au catalogue.`)}</AppAlert>}
    </AppDialog>
    </>
  );
}
