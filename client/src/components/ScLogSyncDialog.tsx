import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FONT_MONO } from '../theme';
import { useScLog } from '../hooks/ScLogSyncContext';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { ScLogSyncChannelResult, ScLogSyncState } from '../hooks/useScLogSync';

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
            fontSize: '0.7rem',
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

// ─── Sync result details ──────────────────────────────────────────────────────

function ChannelResult({
  label,
  result,
}: {
  label: string;
  result: ScLogSyncChannelResult;
}) {
  const { t } = useI18n();
  const hasUnmatched = result.unmatchedNames.length > 0;

  return (
    <Box sx={{ fontFamily: FONT_MONO, fontSize: '0.72rem', lineHeight: 1.6 }}>
      <Typography
        variant="caption"
        sx={{ fontFamily: FONT_MONO, fontWeight: 700, display: 'block', mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: 'success.main', display: 'block' }}>
        ✓ {result.matchedIds.length} {t('blueprint(s) added to inventory', 'schéma(s) ajouté(s) à l\'inventaire')}
      </Typography>
      {hasUnmatched && (
        <Box sx={{ mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ fontFamily: FONT_MONO, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <WarningAmberIcon sx={{ fontSize: 13 }} />
            {result.unmatchedNames.length}{' '}
            {t(
              'name(s) found in log but not matched in database:',
              'nom(s) trouvé(s) dans les logs mais introuvable(s) dans la base:',
            )}
          </Typography>
          <Box
            component="ul"
            sx={{ m: 0, pl: 2, mt: 0.25, fontFamily: FONT_MONO, fontSize: '0.68rem', color: 'text.secondary' }}
          >
            {result.unmatchedNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * Shows the detailed result of the last log sync (matched / unmatched counts).
 * Render this near SyncBlueprintsButton; it is only visible after a completed sync.
 */
export function ScLogSyncResult() {
  const { t } = useI18n();
  const { sync } = useScLog();

  const isDone = sync.status === 'done';
  const isError = sync.status === 'error';
  const hasResult = Boolean(sync.live ?? sync.ptu);

  const totalFound = (sync.live?.foundNames.length ?? 0) + (sync.ptu?.foundNames.length ?? 0);
  const totalMatched = (sync.live?.matchedIds.length ?? 0) + (sync.ptu?.matchedIds.length ?? 0);
  const totalUnmatched =
    (sync.live?.unmatchedNames.length ?? 0) + (sync.ptu?.unmatchedNames.length ?? 0);

  return (
    <Collapse in={(isDone || isError) && hasResult}>
      <Box sx={{ mt: 1 }}>
        {isError && sync.error && (
          <Alert severity="error" variant="outlined" sx={{ fontFamily: FONT_MONO, fontSize: '0.72rem' }}>
            {sync.error}
          </Alert>
        )}

        {isDone && hasResult && (
          <>
            {totalFound === 0 ? (
              <Alert severity="info" variant="outlined" sx={{ fontFamily: FONT_MONO, fontSize: '0.72rem' }}>
                {t(
                  'No blueprint names found in game logs.',
                  'Aucun nom de schéma trouvé dans les logs du jeu.',
                )}
              </Alert>
            ) : (
              <Alert
                severity={totalUnmatched > 0 ? 'warning' : 'success'}
                variant="outlined"
                sx={{ fontFamily: FONT_MONO, fontSize: '0.72rem', '.MuiAlert-message': { width: '100%' } }}
              >
                <Typography variant="caption" sx={{ fontFamily: FONT_MONO, display: 'block', mb: 0.75 }}>
                  {t(
                    `${totalFound} name(s) found in logs — ${totalMatched} matched, ${totalUnmatched} unmatched.`,
                    `${totalFound} nom(s) trouvé(s) dans les logs — ${totalMatched} associé(s), ${totalUnmatched} non trouvé(s).`,
                  )}
                </Typography>

                {sync.live?.scanned && (
                  <ChannelResult label={t('Live channel', 'Serveur Live')} result={sync.live} />
                )}

                {sync.ptu?.scanned && (
                  <Box sx={{ mt: sync.live?.scanned ? 1 : 0 }}>
                    <ChannelResult label={t('PTU channel', 'Serveur PTU')} result={sync.ptu} />
                  </Box>
                )}

                {totalUnmatched > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: FONT_MONO, color: 'text.secondary', display: 'block', mt: 1 }}
                  >
                    {t(
                      'Unmatched names are likely blueprint names in your game language that differ from the database. The names have been cached and will be retried on the next sync.',
                      'Les noms non associés sont probablement des noms de schémas dans la langue du jeu qui diffèrent de la base de données. Ils ont été mis en cache et seront retentés lors du prochain sync.',
                    )}
                  </Typography>
                )}
              </Alert>
            )}
          </>
        )}
      </Box>
    </Collapse>
  );
}
