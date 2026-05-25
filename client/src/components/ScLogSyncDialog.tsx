import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { FONT_MONO } from '../theme';
import { useScLogSync } from '../hooks/useScLogSync';
import { useScLogWatcher } from '../hooks/useScLogWatcher';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { ScLogSyncChannelResult, ScLogSyncState } from '../hooks/useScLogSync';

// ─── Channel row ──────────────────────────────────────────────────────────────

function ChannelRow({
  label,
  path,
  result,
}: {
  label: string;
  path: string | null;
  result: ScLogSyncChannelResult | null;
}) {
  const { t } = useI18n();

  if (!path) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, minWidth: 40 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {t('Not found', 'Non trouvé')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, minWidth: 40 }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled', minWidth: 0 }}>
          <FolderOpenOutlinedIcon sx={{ fontSize: 13 }} />
          <Typography
            variant="caption"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.65rem' }}
          >
            {path}
          </Typography>
        </Box>
      </Box>
      {result && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pl: '48px' }}>
          <Chip
            label={t(`${result.matchedIds.length} blueprints`, `${result.matchedIds.length} blueprints`)}
            size="small"
            color={result.matchedIds.length > 0 ? 'primary' : 'default'}
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
          {result.unmatchedNames.length > 0 && (
            <Tooltip title={result.unmatchedNames.join(', ')}>
              <Chip
                label={t(`${result.unmatchedNames.length} unmatched`, `${result.unmatchedNames.length} non trouvés`)}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        mb: 1,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: '0.6rem',
      }}
    >
      {children}
    </Typography>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.25 }}>
      <Box>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{label}</Typography>
        {description && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
            {description}
          </Typography>
        )}
      </Box>
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Box>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  sync: ScLogSyncState;
}

export function ScLogSyncDialog({ open, onClose, sync }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const watcher = useScLogWatcher();
  const [watcherError, setWatcherError] = useState<string | null>(null);

  const isLoggedIn = Boolean(user);
  const isSyncing = sync.status === 'scanning' || sync.status === 'syncing';
  const isDetecting = sync.detecting;

  const livePath = sync.installPaths?.live ?? null;
  const ptuPath = sync.installPaths?.ptu ?? null;

  const handleSync = () => { void sync.sync(); };
  const handleDetect = () => { void sync.detectPaths(); };

  const handleWatcherToggle = async (enabled: boolean) => {
    setWatcherError(null);
    if (enabled && livePath) {
      await watcher.start(livePath);
      watcher.setAutoStart(true);
    } else {
      watcher.stop();
      watcher.setAutoStart(false);
    }
  };

  const handleAutoStartupToggle = async (enabled: boolean) => {
    setWatcherError(null);
    if (enabled) {
      await watcher.enableAutoStartup();
    } else {
      await watcher.disableAutoStartup();
    }
  };

  return (
    <Dialog open={open} onClose={isSyncing ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          {t('Sync from Star Citizen logs', 'Synchroniser depuis les logs Star Citizen')}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Detected installations */}
        <Box sx={{ border: '1px solid', borderColor: 'divider', p: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SectionLabel>{t('Detected installations', 'Installations détectées')}</SectionLabel>
            {isDetecting && <CircularProgress size={11} sx={{ mb: 1 }} />}
          </Box>
          <ChannelRow label="LIVE" path={livePath} result={sync.live} />
          <ChannelRow label="PTU" path={ptuPath} result={sync.ptu} />
          {sync.detectError && (
            <Box sx={{ mt: 0.5, p: 0.75, bgcolor: 'error.dark', borderRadius: 0 }}>
              <Typography variant="caption" sx={{ color: 'error.contrastText', fontFamily: 'monospace', fontSize: '0.6rem', wordBreak: 'break-all' }}>
                {`[debug] ${sync.detectError}`}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Real-time watcher */}
        <Box sx={{ border: '1px solid', borderColor: 'divider', p: 1.5 }}>
          <SectionLabel>{t('Real-time sync', 'Synchronisation temps réel')}</SectionLabel>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {watcher.running ? (
              <>
                <FiberManualRecordIcon sx={{ fontSize: 10, color: 'success.main', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
                <Typography variant="caption" sx={{ color: 'success.main' }}>
                  {t('Watching LIVE logs…', 'Surveillance des logs LIVE…')}
                </Typography>
                {watcher.newBlueprintCount > 0 && (
                  <Chip
                    label={t(`+${watcher.newBlueprintCount} new`, `+${watcher.newBlueprintCount} nouveaux`)}
                    size="small"
                    color="success"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                )}
              </>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {livePath
                  ? t('Watcher inactive', 'Surveillance inactive')
                  : t('No LIVE installation found', 'Aucune installation LIVE trouvée')}
              </Typography>
            )}
          </Box>

          <SettingRow
            label={t('Watch LIVE logs in real-time', 'Surveiller les logs LIVE en temps réel')}
            description={t(
              'Detects new blueprints instantly when received in-game and syncs your inventory automatically.',
              'Détecte les nouveaux blueprints instantanément en jeu et synchronise automatiquement votre inventaire.',
            )}
            checked={watcher.running}
            disabled={!isLoggedIn || !livePath}
            onChange={(v) => {
              void handleWatcherToggle(v).catch((error: unknown) => {
                setWatcherError(error instanceof Error ? error.message : 'Failed to update watcher.');
              });
            }}
          />
          {watcherError && (
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {watcherError}
            </Typography>
          )}
        </Box>

        {/* Auto-startup */}
        <Box sx={{ border: '1px solid', borderColor: 'divider', p: 1.5 }}>
          <SectionLabel>{t('System', 'Système')}</SectionLabel>
          <SettingRow
            label={t('Launch at Windows startup', 'Lancer au démarrage de Windows')}
            description={t(
              'Start Item Fabricator automatically when Windows boots so the watcher is always active.',
              'Démarre Item Fabricator automatiquement au démarrage de Windows pour que la surveillance soit toujours active.',
            )}
            checked={watcher.autoStartupEnabled}
            onChange={(v) => {
              void handleAutoStartupToggle(v).catch((error: unknown) => {
                setWatcherError(error instanceof Error ? error.message : 'Failed to update startup setting.');
              });
            }}
          />
        </Box>

        {/* Auth warning */}
        {!isLoggedIn && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
            <ErrorOutlineIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              {t(
                'You must be logged in with Discord to sync your inventory.',
                'Vous devez être connecté avec Discord pour synchroniser votre inventaire.',
              )}
            </Typography>
          </Box>
        )}

        {/* One-shot scan status */}
        {isSyncing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <CircularProgress size={14} />
            <Typography variant="caption">
              {sync.status === 'scanning'
                ? t('Scanning log files…', 'Analyse des fichiers log…')
                : t('Syncing to server…', 'Synchronisation vers le serveur…')}
            </Typography>
          </Box>
        )}

        {sync.status === 'done' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">{t('Sync complete.', 'Synchronisation terminée.')}</Typography>
          </Box>
        )}

        {sync.status === 'error' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <ErrorOutlineIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">{sync.error}</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          size="small"
          onClick={handleDetect}
          disabled={isSyncing || isDetecting}
          startIcon={isDetecting ? <CircularProgress size={13} /> : undefined}
          sx={{ mr: 'auto', fontSize: '0.75rem' }}
        >
          {t('Re-detect', 'Re-détecter')}
        </Button>
        <Button onClick={onClose} disabled={isSyncing} size="small">
          {t('Close', 'Fermer')}
        </Button>
        <Tooltip title={!isLoggedIn ? t('Login required', 'Connexion requise') : ''}>
          <span>
            <Button
              variant="contained"
              onClick={handleSync}
              disabled={isSyncing || !isLoggedIn || (!livePath && !ptuPath)}
              size="small"
              startIcon={isSyncing ? <CircularProgress size={13} /> : <SyncIcon />}
            >
              {t('Full scan & sync', 'Scan complet')}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}

// ─── Header button ────────────────────────────────────────────────────────────

export function ScLogSyncButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { newBlueprintCount, autoStartEnabled, running, start } = useScLogWatcher();
  const sync = useScLogSync();

  // Auto-start watcher on mount if preference is saved and LIVE path is known
  useEffect(() => {
    if (autoStartEnabled && !running && sync.installPaths?.live) {
      void start(sync.installPaths.live);
    }
  }, [autoStartEnabled, sync.installPaths?.live, running, start]);

  return (
    <>
      <Tooltip title={running ? t('SC log sync — watching LIVE', 'Sync logs SC — surveillance LIVE active') : t('SC log sync', 'Sync logs SC')}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
          onClick={() => setOpen(true)}
        >
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton
              size="small"
              aria-label={t('Sync blueprints from SC logs', 'Synchroniser les blueprints depuis les logs SC')}
              sx={{ width: 34, height: 34, borderRadius: 1, color: running ? 'primary.main' : 'text.secondary', '&:hover': { color: 'text.primary' }, pointerEvents: 'none' }}
            >
              <SyncIcon sx={{ fontSize: 18 }} />
            </IconButton>
            {newBlueprintCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  border: '2px solid',
                  borderColor: 'background.default',
                }}
              />
            )}
          </Box>
          {running && (
            <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 0.5 }}>
              <FiberManualRecordIcon sx={{ fontSize: 8, color: 'success.main', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
              <Typography sx={{ fontSize: '0.65rem', fontFamily: FONT_MONO, fontWeight: 700, color: 'success.main', letterSpacing: '0.04em' }}>
                LIVE
              </Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
      {open && <ScLogSyncDialog open onClose={() => { setOpen(false); }} sync={sync} />}
    </>
  );
}
