import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { useCraftSimulator } from '../../hooks/useCraftSimulator';
import { CategoryBadge } from '../ui/Badge';
import { ResourceIcon } from '../ui/ResourceIcon';
import { Button } from '../ui/Button';
import { clampQualityValue } from '../../utils/crafting';
import type { CraftGoal, MaterialSlot } from '../../types';

interface GoalEditModalProps {
  goal: CraftGoal;
  onClose: () => void;
}

export function GoalEditModal({ goal, onClose }: GoalEditModalProps) {
  const { blueprints, updateGoal } = useCraft();
  const { t } = useI18n();
  const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);
  const [assignments, setAssignments] = useState<Record<string, number | undefined>>({
    ...goal.slotAssignments,
  });

  const { qualityScore, projectedStats } = useCraftSimulator(blueprint ?? null, assignments);

  if (!blueprint) {
    return null;
  }

  function setSlotQuality(slotId: string, value: number | undefined) {
    setAssignments((previous) => ({ ...previous, [slotId]: clampQualityValue(value) }));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      aria-label={t(`Edit goal ${goal.blueprintName}`, `Modifier l objectif ${goal.blueprintName}`)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryBadge category={blueprint.category} iconOnly />
          <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>
            {goal.blueprintName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: "'Share Tech Mono', monospace" }}>
            {t('Build index', 'Indice de build')}: <strong>{qualityScore}</strong>/100
          </Typography>
          <IconButton onClick={onClose} aria-label={t('Close', 'Fermer')} size="small">
            ✕
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {blueprint.slots.map((slot: MaterialSlot) => {
            const assignedValue = assignments[slot.id];
            return (
              <Box key={slot.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ResourceIcon name={slot.requiredResource} size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{slot.requiredResource}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", color: 'text.secondary' }}>
                    {slot.quantityScu.toFixed(2)} SCU
                  </Typography>
                  {slot.minQuality != null && slot.minQuality > 0 && (
                    <Chip label={`Min ${slot.minQuality}`} size="small" variant="outlined" sx={{ fontSize: '.6rem', height: 20, color: 'warning.main', borderColor: 'rgba(251,191,36,.25)' }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField
                    type="number"
                    size="small"
                    value={assignedValue ?? ''}
                    placeholder="0-1000"
                    onChange={(event) =>
                      setSlotQuality(
                        slot.id,
                        event.target.value === '' ? undefined : Number(event.target.value),
                      )
                    }
                    slotProps={{ htmlInput: { min: 0, max: 1000, style: { width: 60, textAlign: 'center', padding: '4px 6px' } } }}
                    aria-label={t(
                      `Assigned quality for ${slot.requiredResource}`,
                      `Qualite assignee pour ${slot.requiredResource}`,
                    )}
                    sx={{ width: 80 }}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, slot.minQuality ?? 0)}>
                    {t('Min', 'Min')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, 1000)}>
                    {t('Max', 'Max')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, undefined)}>
                    {t('Clear', 'Effacer')}
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('Cancel', 'Annuler')}
        </Button>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => {
            updateGoal(goal.id, assignments, qualityScore, projectedStats);
            onClose();
          }}
        >
          {t('Save changes', 'Enregistrer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
