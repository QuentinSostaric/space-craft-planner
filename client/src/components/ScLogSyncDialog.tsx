import { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { FONT_MONO } from '../theme';
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
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = sync.status === 'scanning' || sync.status === 'syncing';
  const isDone = sync.status === 'done';
  const isLoggedIn = Boolean(user);
  const hasPath = Boolean(sync.installPaths?.live ?? sync.installPaths?.ptu);

  const handleSync = () => {
    setLocalError(null);
    sync.sync().then(() => {
      if (onSuccess) onSuccess();
    }).catch((err: unknown) => {
      setLocalError(err instanceof Error ? err.message : 'Sync failed.');
    });
  };

  if (!sync.available) return null;

  const tooltipTitle = !isLoggedIn
    ? t('Login with Discord to sync your inventory', 'Connecte-toi avec Discord pour synchroniser')
    : !hasPath
      ? t('No Star Citizen installation detected', 'Aucune installation Star Citizen détectée')
      : localError ?? '';

  return (
    <Tooltip title={tooltipTitle}>
      <span>
        <Button
          variant={variant}
          size={size}
          onClick={handleSync}
          disabled={isBusy || !isLoggedIn || !hasPath}
          startIcon={
            isBusy ? (
              <CircularProgress size={13} />
            ) : isDone ? (
              <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
            ) : localError ? (
              <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
            ) : (
              <SyncIcon sx={{ fontSize: 14 }} />
            )
          }
          sx={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            ...(isDone ? { color: 'success.main', borderColor: 'success.main' } : null),
            ...(localError ? { color: 'error.main', borderColor: 'error.main' } : null),
          }}
        >
          {isBusy
            ? (sync.status === 'scanning'
              ? t('Scanning…', 'Scan…')
              : t('Syncing…', 'Sync…'))
            : isDone
              ? t('Synced', 'Synchronisé')
              : t('Sync game', 'Sync game')}
        </Button>
      </span>
    </Tooltip>
  );
}
