import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tokens } from '../../theme';
import type { Rarity } from '../../types';

const RARITY_COLORS: Record<Rarity, string> = {
  legendary: tokens.rarityLegendary,
  rare: tokens.rarityRare,
  common: tokens.rarityCommon,
};

const SCALE_COLORS: Record<string, string> = {
  system: tokens.blue,
  'planetary-cluster': tokens.violet,
  'regional-sector': tokens.rarityLegendary,
  'specific-location': tokens.rarityRare,
};

interface BadgeProps {
  label: string;
  color: string;
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <Badge
      label={rarity.toUpperCase()}
      color={RARITY_COLORS[rarity]}
    />
  );
}

export function ScaleBadge({ scale, label }: { scale: string; label: string }) {
  return (
    <Badge
      label={label}
      color={SCALE_COLORS[scale] ?? tokens.textDim}
    />
  );
}

function Badge({ label, color }: BadgeProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        borderLeft: `3px solid ${color}`,
        backgroundColor: `${color}22`,
        px: 1,
        py: 0.25,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontSize: '.55rem',
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
