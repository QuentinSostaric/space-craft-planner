import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tokens } from '../../theme';
import type { MaterialSlot, Resource } from '../../types';

interface MaterialChipsProps {
  slots: MaterialSlot[];
  resources: Resource[];
  maxVisible?: number;
}

export function MaterialChips({ slots, resources, maxVisible = 3 }: MaterialChipsProps) {
  const aggregated = new Map<string, { name: string; total: number; color: string }>();
  for (const slot of slots) {
    const existing = aggregated.get(slot.requiredResource);
    const res = resources.find((r) => r.name === slot.requiredResource);
    if (existing) {
      existing.total += slot.quantityScu;
    } else {
      aggregated.set(slot.requiredResource, {
        name: res?.name ?? slot.requiredResource,
        total: slot.quantityScu,
        color: res?.color ?? tokens.textDim,
      });
    }
  }

  const items = [...aggregated.values()];
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - maxVisible;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: '.5rem',
          color: tokens.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        REQUIRED_MATERIALS
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {visible.map((mat) => (
          <Box
            key={mat.name}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              backgroundColor: tokens.surface2,
              border: `1px solid ${tokens.border}`,
              px: 0.75,
              py: 0.25,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: mat.color,
                flexShrink: 0,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: '.55rem',
                fontWeight: 600,
                color: tokens.text,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {mat.name} ({Math.round(mat.total)})
            </Typography>
          </Box>
        ))}
        {overflow > 0 && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: tokens.surface2,
              border: `1px solid ${tokens.border}`,
              px: 0.75,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: '.55rem', color: tokens.textMuted }}
            >
              +{overflow}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
