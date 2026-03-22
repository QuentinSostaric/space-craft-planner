import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import type { MaterialSlot, Resource } from '../../types';
import { useI18n } from '../../i18n/I18nContext';

interface MaterialChipsProps {
  slots: MaterialSlot[];
  resources: Resource[];
  maxVisible?: number;
}

function formatMaterialQuantity(total: number): string {
  if (total >= 10) {
    return Math.round(total).toString();
  }

  if (total >= 1) {
    return total.toFixed(1).replace(/\.0$/, '');
  }

  return total.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function MaterialChips({ slots, resources, maxVisible = 3 }: MaterialChipsProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const aggregated = useMemo(() => {
    const map = new Map<string, { name: string; total: number; color: string }>();
    for (const slot of slots) {
      const existing = map.get(slot.requiredResource);
      const res = resources.find((r) => r.name === slot.requiredResource);
      if (existing) {
        existing.total += slot.quantityScu;
      } else {
        map.set(slot.requiredResource, {
          name: res?.name ?? slot.requiredResource,
          total: slot.quantityScu,
          color: res?.color ?? theme.palette.text.disabled,
        });
      }
    }
    return map;
  }, [slots, resources, theme.palette.text.disabled]);

  const items = [...aggregated.values()];
  const visible = items.slice(0, maxVisible);
  const overflow = Math.max(0, items.length - maxVisible);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.65rem',
          color: 'text.disabled',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
        }}
      >
        {t('Required Materials', 'Matériaux requis')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {visible.map((mat) => (
          <Box
            key={mat.name}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              backgroundColor: alpha(theme.palette.text.primary, 0.03),
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 0.5,
              px: 1,
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
                boxShadow: `0 0 4px ${alpha(mat.color, 0.5)}`,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'text.primary',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {mat.name}{' '}
              <Box component="span" sx={{ opacity: 0.6, fontWeight: 400 }}>
                ({formatMaterialQuantity(mat.total)} SCU)
              </Box>
            </Typography>
          </Box>
        ))}
        {overflow > 0 && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: alpha(theme.palette.text.primary, 0.03),
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 0.5,
              px: 1,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: '.6rem', color: 'text.secondary', fontWeight: 700 }}
            >
              +{overflow}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
