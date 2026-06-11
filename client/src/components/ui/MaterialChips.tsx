import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import type { MaterialSlot, Resource } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatResourceQuantity,
  getSlotQuantityValue,
  isResourceSlot,
} from '../../utils/crafting';
import { TEXT_LABEL, TEXT_LABEL_SM } from '../../theme';

function slugifyResourceName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface MaterialChipsProps {
  slots: MaterialSlot[];
  resources: Resource[];
  /** Fallback list of resource IDs shown when slots aren't loaded yet (summary blueprints). */
  resourceIds?: string[];
  maxVisible?: number;
}

type AggregatedItem = {
  name: string;
  total: number | null;
  quantityUnit: MaterialSlot['quantityUnit'] | 'mixed' | null;
  color: string;
};

export function MaterialChips({ slots, resources, resourceIds, maxVisible = 3 }: MaterialChipsProps) {
  const theme = useTheme();
  const { t, lang } = useI18n();

  const aggregated = useMemo(() => {
    const map = new Map<string, AggregatedItem>();
    const resourcesById = new Map(resources.map((r) => [r.id, r]));

    const resourceSlots = slots.filter(isResourceSlot);

    if (resourceSlots.length > 0) {
      for (const slot of resourceSlots) {
        const existing = map.get(slot.requiredResource);
        const res = resourcesById.get(slugifyResourceName(slot.requiredResource));
        if (existing && existing.total !== null) {
          existing.total += getSlotQuantityValue(slot);
          existing.quantityUnit =
            existing.quantityUnit === slot.quantityUnit ? existing.quantityUnit : 'mixed';
        } else {
          map.set(slot.requiredResource, {
            name: res?.name ?? slot.requiredResource,
            total: getSlotQuantityValue(slot),
            quantityUnit: slot.quantityUnit,
            color: res?.color ?? theme.palette.text.disabled,
          });
        }
      }
    } else if (resourceIds && resourceIds.length > 0) {
      for (const id of resourceIds) {
        const res = resourcesById.get(id);
        map.set(id, {
          name: res?.name ?? id,
          total: null,
          quantityUnit: null,
          color: res?.color ?? theme.palette.text.disabled,
        });
      }
    }

    return map;
  }, [slots, resources, resourceIds, theme.palette.text.disabled]);

  const items = [...aggregated.values()];
  const visible = items.slice(0, maxVisible);
  const overflow = Math.max(0, items.length - maxVisible);

  if (items.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: TEXT_LABEL_SM,
          color: 'text.secondary',
          fontWeight: 600,
        }}
      >
        {t('Required materials', 'Matériaux requis')}
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
                fontSize: TEXT_LABEL,
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {mat.name}
              {mat.total !== null && (
                <Box component="span" sx={{ opacity: 0.6, fontWeight: 400 }}>
                  {' '}({formatResourceQuantity(mat.total, mat.quantityUnit ?? 'count', lang)})
                </Box>
              )}
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
              sx={{ fontSize: TEXT_LABEL_SM, color: 'text.secondary', fontWeight: 700 }}
            >
              +{overflow}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
