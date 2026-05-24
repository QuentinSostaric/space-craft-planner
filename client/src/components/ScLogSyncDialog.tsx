import { useState } from 'react';
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
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { useScLogSync } from '../hooks/useScLogSync';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { ScLogSyncChannelResult } from '../hooks/useScLogSync';

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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ScLogSyncDialog({ open, onClose }: Props) {
  const { t } = useI18n();
  const { installPaths, status, error, live, ptu, sync, detectPaths } = useScLogSync();
  const { user } = useAuth();

  const isWorking = status === 'scanning' || status === 'syncing';
  const isLoggedIn = Boolean(user);

  const handleSync = () => {
    void sync();
  };

  const handleDetect = () => {
    void detectPaths();
  };

  return (
    <Dialog open={open} onClose={isWorking ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          {t('Sync from Star Citizen logs', 'Synchroniser depuis les logs Star Citizen')}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.5 }}>
          {t(
            'Scans your Star Citizen Game.log and logbackup files to detect blueprints you received as mission rewards, then syncs them to your LIVE and PTU inventories.',
            'Analyse les fichiers Game.log et logbackups de Star Citizen pour détecter les blueprints reçus en récompense de missions, puis les synchronise dans vos inventaires LIVE et PTU.',
          )}
        </Typography>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            p: 1.5,
            mb: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.6rem' }}>
            {t('Detected installations', 'Installations détectées')}
          </Typography>
          <ChannelRow label="LIVE" path={installPaths?.live ?? null} result={live} />
          <ChannelRow label="PTU" path={installPaths?.ptu ?? null} result={ptu} />
        </Box>

        {/* Not logged in warning */}
        {!isLoggedIn && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main', mb: 1 }}>
            <ErrorOutlineIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              {t(
                'You must be logged in with Discord to sync your inventory.',
                'Vous devez être connecté avec Discord pour synchroniser votre inventaire.',
              )}
            </Typography>
          </Box>
        )}

        {/* Status feedback */}
        {isWorking && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <CircularProgress size={14} />
            <Typography variant="caption">
              {status === 'scanning'
                ? t('Scanning log files…', 'Analyse des fichiers log…')
                : t('Syncing to server…', 'Synchronisation vers le serveur…')}
            </Typography>
          </Box>
        )}

        {status === 'done' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              {t('Sync complete.', 'Synchronisation terminée.')}
            </Typography>
          </Box>
        )}

        {status === 'error' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <ErrorOutlineIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">{error}</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          size="small"
          onClick={handleDetect}
          disabled={isWorking}
          sx={{ mr: 'auto', fontSize: '0.75rem' }}
        >
          {t('Re-detect paths', 'Re-détecter les chemins')}
        </Button>
        <Button onClick={onClose} disabled={isWorking} size="small">
          {t('Close', 'Fermer')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSync}
          disabled={isWorking || !isLoggedIn || (!installPaths?.live && !installPaths?.ptu)}
          size="small"
          startIcon={isWorking ? <CircularProgress size={13} /> : <SyncIcon />}
        >
          {t('Scan & Sync', 'Scanner et synchroniser')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ScLogSyncButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={t('Sync blueprints from SC logs', 'Synchroniser les blueprints depuis les logs SC')}>
        <IconButton
          onClick={() => setOpen(true)}
          size="small"
          aria-label={t('Sync blueprints from SC logs', 'Synchroniser les blueprints depuis les logs SC')}
          sx={{ width: 34, height: 34, borderRadius: 1, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          <SyncIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      {open && <ScLogSyncDialog open onClose={() => setOpen(false)} />}
    </>
  );
}
