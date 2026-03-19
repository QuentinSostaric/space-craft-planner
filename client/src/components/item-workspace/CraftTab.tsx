import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';
import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../ui/Button';
import { SlotCard } from './shared/SlotCard';
import { QualityScore } from './shared/QualityScore';
import { CombinedModifiers } from './shared/CombinedModifiers';
import { ResourceSummary } from './shared/ResourceSummary';
import { tokens } from '../../theme';
import type { Blueprint, ItemStats, AggregatedResource } from '../../types';

interface CraftTabProps {
  blueprint: Blueprint;
  slotAssignments: Record<string, number | undefined>;
  assignQuality: (slotId: string, value: number | undefined) => void;
  clearAssignments: () => void;
  qualityScore: number;
  projectedStats: ItemStats;
  requiredResources: AggregatedResource[];
}

export function CraftTab({
  blueprint,
  slotAssignments,
  assignQuality,
  clearAssignments,
  qualityScore,
  projectedStats,
  requiredResources,
}: CraftTabProps) {
  const { t } = useI18n();

  function fillSlots(mode: 'max' | 'minimum') {
    for (const slot of blueprint.slots) {
      assignQuality(slot.id, mode === 'max' ? 1000 : (slot.minQuality ?? 0));
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Top bar: quality score + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <QualityScore score={qualityScore} />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('max')}>{t('Max quality', 'Qualite max')}</Button>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('minimum')}>{t('Minimum valid', 'Minimum valide')}</Button>
          <Button variant="ghost" size="sm" onClick={clearAssignments}>{t('Clear', 'Effacer')}</Button>
        </Box>
      </Box>

      {/* Section: Parts — horizontal scrollable grid */}
      <Box>
        <Typography
          variant="h6"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontFamily: "'Khand', sans-serif",
            fontWeight: 700,
            fontSize: '.9rem',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            mb: 1,
          }}
        >
          <SettingsIcon sx={{ fontSize: '1rem' }} /> {t('Parts', 'Composants')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: `repeat(${Math.min(blueprint.slots.length, 3)}, 1fr)`,
              lg: `repeat(${Math.min(blueprint.slots.length, 4)}, 1fr)`,
            },
            gap: 1,
          }}
        >
          {blueprint.slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              qualityValue={slotAssignments[slot.id]}
              onQualityChange={(value) => assignQuality(slot.id, value)}
              category={blueprint.category}
            />
          ))}
        </Box>
      </Box>

      {/* Bottom section: Modifiers + Resources side by side */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          '& > *': {
            p: 1.5,
            border: `1px solid ${tokens.border}`,
            backgroundColor: tokens.surface1,
          },
        }}
      >
        <CombinedModifiers blueprint={blueprint} projectedStats={projectedStats} />
        <ResourceSummary entries={requiredResources} />
      </Box>
    </Box>
  );
}
