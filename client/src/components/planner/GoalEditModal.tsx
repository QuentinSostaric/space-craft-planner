import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import CloseIcon from '@mui/icons-material/Close';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { useCraftSimulator } from '../../hooks/useCraftSimulator';
import { CategoryBadge } from '../ui/Badge';
import { ResourceIcon } from '../ui/ResourceIcon';
import { GameIcon } from '../ui/GameIcon';
import { Button } from '../ui/Button';
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
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="goal-edit-modal-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="goal-edit-modal-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryBadge category={blueprint.category} iconOnly />
          <Typography variant="h6" sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '1.1rem' }}>
            {goal.blueprintName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: FONT_MONO }}>
            {t('Build index', 'Indice de build')}: <strong>{qualityScore}</strong>/100
          </Typography>
          <IconButton onClick={onClose} aria-label={t('Close', 'Fermer')} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!blueprint.detailsLoaded ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <LinearProgress aria-label={t('Loading blueprint detail', 'Chargement du détail blueprint')} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('Loading blueprint detail...', 'Chargement du détail blueprint...')}
            </Typography>
          </Box>
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {blueprint.slots.map((slot: MaterialSlot) => {
            const assignedValue = assignments[slot.id];
            const requirementName = getSlotRequirementName(slot);
            return (
              <Box key={slot.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isResourceSlot(slot) ? (
                    <ResourceIcon name={slot.requiredResource} size={16} />
                  ) : (
                    <GameIcon name="utilities" size={16} />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{requirementName}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: 'text.secondary' }}>
                    {formatSlotQuantity(slot)}
                  </Typography>
                  {slot.minQuality != null && slot.minQuality > 0 && (
                    <Chip label={`Min ${slot.minQuality}`} size="small" variant="outlined" sx={{ fontSize: TEXT_LABEL, height: 20, color: 'warning.main', borderColor: 'rgba(251,191,36,.25)' }} />
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
                    slotProps={{ htmlInput: { min: 0, max: 1000, 'aria-label': t(
                      `Assigned quality for ${requirementName}`,
                      `Qualité assignée pour ${requirementName}`,
                    ), style: { width: 60, textAlign: 'center', padding: '4px 6px' } } }}
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
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('Cancel', 'Annuler')}
        </Button>
        <Button
          variant="gradient"
          size="sm"
          disabled={!blueprint.detailsLoaded}
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
