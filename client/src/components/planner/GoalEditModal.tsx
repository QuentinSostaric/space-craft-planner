import { Box, Typography } from '../../ui/system';
import { AppProgressBar } from '../ui/feedback';
import { useEffect, useState } from 'react';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { useCraftSimulator } from '../../hooks/useCraftSimulator';
import { CategoryBadge } from '../ui/Badge';
import { ResourceIcon } from '../ui/ResourceIcon';
import { GameIcon } from '../ui/GameIcon';
import { AppButton } from '../ui/controls';
import { AppDialog } from '../ui/overlays';
import { AppChip } from '../ui/data-display';
import { PlannerNumberInput } from './PlannerControls';
import {
  clampQualityValue,
  formatSlotQuantity,
  getSlotRequirementName,
  isResourceSlot,
} from '../../utils/crafting';
import type { CraftGoal, MaterialSlot } from '../../types';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL} from '../../theme';

interface GoalEditModalProps {
  goal: CraftGoal;
  onClose: () => void;
}

export function GoalEditModal({ goal, onClose }: GoalEditModalProps) {
  const { blueprints, updateGoal, ensureBlueprintDetailLoaded } = useCraft();
  const { t } = useI18n();
  const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);
  const [assignments, setAssignments] = useState<Record<string, number | undefined>>({
    ...goal.slotAssignments,
  });

  useEffect(() => {
    if (blueprint && !blueprint.detailsLoaded) {
      void ensureBlueprintDetailLoaded(blueprint.id);
    }
  }, [blueprint, ensureBlueprintDetailLoaded]);

  const { qualityScore, projectedStats } = useCraftSimulator(
    blueprint?.detailsLoaded ? blueprint : null,
    assignments,
  );

  if (!blueprint) {
    return null;
  }

  function setSlotQuality(slotId: string, value: number | undefined) {
    setAssignments((previous) => ({ ...previous, [slotId]: clampQualityValue(value) }));
  }

  return (
    <AppDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <CategoryBadge category={blueprint.category} iconOnly />
          <Typography sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '1.1rem' }}>
            {goal.blueprintName}
          </Typography>
        </Box>
      )}
      description={`${t('Build index', 'Indice de build')}: ${qualityScore}/100`}
      closeLabel={t('Close', 'Fermer')}
      width="min(40rem, calc(100vw - 1rem))"
      footer={(
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          <AppButton variant="ghost" size="sm" onClick={onClose}>
            {t('Cancel', 'Annuler')}
          </AppButton>
          <AppButton
            variant="gradient"
            size="sm"
            disabled={!blueprint.detailsLoaded}
            onClick={() => {
              updateGoal(goal.id, assignments, qualityScore, projectedStats);
              onClose();
            }}
          >
            {t('Save changes', 'Enregistrer')}
          </AppButton>
        </Box>
      )}
      partSx={{
        header: { borderBottom: '1px solid', borderColor: 'divider' },
        content: { padding: { xs: 1.5, sm: 2 } },
        footer: { borderTop: '1px solid', borderColor: 'divider', padding: 1.5 },
      }}
    >
      <Typography sx={{ color: 'text.secondary', fontFamily: FONT_MONO, mb: 1.5 }}>
        {t('Build index', 'Indice de build')}: <strong>{qualityScore}</strong>/100
      </Typography>
      {!blueprint.detailsLoaded ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AppProgressBar label={t('Loading blueprint detail', 'Chargement du détail blueprint')} />
          <Typography sx={{ color: 'text.secondary' }}>
            {t('Loading blueprint detail...', 'Chargement du détail blueprint...')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {blueprint.slots.map((slot: MaterialSlot) => {
            const assignedValue = assignments[slot.id];
            const requirementName = getSlotRequirementName(slot);
            return (
              <Box key={slot.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {isResourceSlot(slot) ? <ResourceIcon name={slot.requiredResource} size={16} /> : <GameIcon name="utilities" size={16} />}
                  <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{requirementName}</Typography>
                  <Typography sx={{ fontSize: TEXT_LABEL, fontFamily: FONT_MONO, color: 'text.secondary' }}>
                    {formatSlotQuantity(slot)}
                  </Typography>
                  {slot.minQuality != null && slot.minQuality > 0 && (
                    <AppChip label={`Min ${slot.minQuality}`} size="sm" tone="warning" outlined />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <PlannerNumberInput
                    value={assignedValue ?? ''}
                    onValueChange={(value) => setSlotQuality(slot.id, value === '' ? undefined : value)}
                    onBlur={(value) => setSlotQuality(slot.id, value === '' ? undefined : value)}
                    min={0}
                    max={1000}
                    step={1}
                    ariaLabel={t(`Assigned quality for ${requirementName}`, `Qualité assignée pour ${requirementName}`)}
                    sx={{ width: 88, textAlign: 'center' }}
                  />
                  <AppButton variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, slot.minQuality ?? 0)}>{t('Min', 'Min')}</AppButton>
                  <AppButton variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, 1000)}>{t('Max', 'Max')}</AppButton>
                  <AppButton variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, undefined)}>{t('Clear', 'Effacer')}</AppButton>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </AppDialog>
  );
}
