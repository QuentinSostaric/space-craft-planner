import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import type { Rarity } from '../../types';

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const theme = useTheme();
  
  const colors: Record<Rarity, string> = {
    legendary: theme.palette.warning.main,
    rare: theme.palette.primary.main,
    common: theme.palette.text.disabled,
  };

  return (
    <PillBadge
      label={rarity.toUpperCase()}
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
      color={colors[scale] ?? theme.palette.text.disabled}
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
