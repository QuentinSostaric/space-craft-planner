import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { GoalCard } from './GoalCard';
import { GoalEditModal } from './GoalEditModal';

export function GoalsList() {
  const { goals, blueprints, activeBlueprint, removeGoal, updateGoalQuantity, selectGoalBlueprint } = useCraft();
  const { t } = useI18n();
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const editingGoal = goals.find((g) => g.id === editingGoalId) ?? null;

  const totalCraftSecs = useMemo(() => {
    return goals.reduce((sum, goal) => {
      const bp = blueprints.find((b) => b.id === goal.blueprintId);
      return sum + (bp?.craftTimeSecs ?? 0) * goal.quantity;
    }, 0);
  }, [goals, blueprints]);

  const craftTimeLabel = totalCraftSecs < 60
    ? t('< 1 min', '< 1 min')
    : `~${Math.round(totalCraftSecs / 60)} min`;

  return (
    <Box sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0, borderRight: { xs: 0, md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Column header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography variant="overline" sx={{ display: 'block' }}>{t('Goals', 'Objectifs')}</Typography>
      </Box>

      {/* Goals list */}
      <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, maxHeight: { xs: 240, md: 'none' }, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {goals.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.78rem', py: 2, textAlign: 'center' }}>
            {t('No goals yet.', 'Aucun objectif.')}
          </Typography>
        )}
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            isActive={activeBlueprint?.id === goal.blueprintId}
            onRemove={() => removeGoal(goal.id)}
            onQtyChange={(qty) => updateGoalQuantity(goal.id, qty)}
            onEdit={() => setEditingGoalId(goal.id)}
            onSelect={() => selectGoalBlueprint(goal.id)}
          />
        ))}
      </Box>

      {/* Craft time */}
      {goals.length > 0 && (
        <Box sx={{ mx: 1.5, mb: 1.5, px: 1.5, py: 1, border: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('Total craft time', 'Temps de craft total')}
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", color: 'secondary.main', fontWeight: 700 }}>
            {craftTimeLabel}
          </Typography>
        </Box>
      )}

      {/* Edit modal */}
      {editingGoal && (
        <GoalEditModal goal={editingGoal} onClose={() => setEditingGoalId(null)} />
      )}
    </Box>
  );
}
