import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import type { Rarity } from '../../types';
import { useI18n } from '../../i18n/I18nContext';

// Badge language: PillBadge (left border, sharp corners) is reserved for
// categorical identity (rarity, acquisition scale). Everything else uses the
// rounded outlined chips from ui/Badge.tsx.

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const theme = useTheme();
  const { t } = useI18n();

  const colors: Record<Rarity, string> = {
    legendary: theme.palette.warning.main,
    rare: theme.palette.primary.main,
    common: theme.palette.text.secondary,
  };

  const labels: Record<Rarity, string> = {
    legendary: t('Legendary', 'Légendaire', 'Legendär'),
    rare: t('Rare', 'Rare', 'Selten'),
    common: t('Common', 'Commune', 'Gewöhnlich'),
  };

  return (
    <PillBadge
      label={labels[rarity]}
      color={colors[rarity]}
    />
  );
}

export function ScaleBadge({ scale, label }: { scale: string; label: string }) {
  const theme = useTheme();
  
  const colors: Record<string, string> = {
    system: theme.palette.secondary.main,
    'planetary-cluster': theme.palette.primary.main,
    'regional-sector': theme.palette.warning.main,
    'specific-location': theme.palette.info.main,
  };

  return (
    <PillBadge
      label={label}
      color={colors[scale] ?? theme.palette.text.secondary}
    />
  );
}

function PillBadge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        borderLeft: `3px solid ${color}`,
        backgroundColor: alpha(color, 0.15),
        px: 1,
        py: 0.25,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
