import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useLocalPersist } from '../../hooks/useLocalPersist';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { LS_KEYS } from '../../types';
import { areStringArraysEqual, moveIdBefore, synchronizeOrderedIds } from '../../utils/reorder';
import { GoalCard } from './GoalCard';
import { GoalEditModal } from './GoalEditModal';

export function GoalsList() {
  const { goals, blueprints, activeBlueprint, removeGoal, updateGoalQuantity, selectGoalBlueprint } = useCraft();
  const { t } = useI18n();
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalOrder, setGoalOrder] = useLocalPersist<string[]>(LS_KEYS.PLANNER_GOAL_ORDER, []);
  const [draggedGoalId, setDraggedGoalId] = useState<string | null>(null);
  const [dropGoalId, setDropGoalId] = useState<string | null>(null);
  const editingGoal = goals.find((g) => g.id === editingGoalId) ?? null;
  const goalIds = useMemo(() => goals.map((goal) => goal.id), [goals]);

  useEffect(() => {
    setGoalOrder((previous) => {
      const next = synchronizeOrderedIds(previous, goalIds);
      return areStringArraysEqual(previous, next) ? previous : next;
    });
  }, [goalIds, setGoalOrder]);

  const orderedGoals = useMemo(() => {
    const goalById = new Map(goals.map((goal) => [goal.id, goal]));
    return synchronizeOrderedIds(goalOrder, goalIds)
      .map((goalId) => goalById.get(goalId))
      .filter((goal): goal is NonNullable<typeof goal> => Boolean(goal));
  }, [goalIds, goalOrder, goals]);

  const totalCraftSecs = useMemo(() => {
    return orderedGoals.reduce((sum, goal) => {
      const bp = blueprints.find((b) => b.id === goal.blueprintId);
      return sum + (bp?.craftTimeSecs ?? 0) * goal.quantity;
    }, 0);
  }, [orderedGoals, blueprints]);

  const craftTimeLabel = totalCraftSecs < 60
    ? t('< 1 min', '< 1 min')
    : `~${Math.round(totalCraftSecs / 60)} min`;

  const handleDragStart = useCallback(
    (goalId: string) => (event: DragEvent<HTMLElement>) => {
      setDraggedGoalId(goalId);
      setDropGoalId(goalId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', goalId);
    },
    [],
  );

  const handleDragOver = useCallback(
    (goalId: string) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (!draggedGoalId || draggedGoalId === goalId) {
        return;
      }
      event.dataTransfer.dropEffect = 'move';
      setDropGoalId(goalId);
    },
    [draggedGoalId],
  );

  const handleDrop = useCallback(
    (goalId: string) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const currentDraggedGoalId = draggedGoalId ?? event.dataTransfer.getData('text/plain');
      if (!currentDraggedGoalId || currentDraggedGoalId === goalId) {
        setDraggedGoalId(null);
        setDropGoalId(null);
        return;
      }

      setGoalOrder((previous) => {
        const synced = synchronizeOrderedIds(previous, goalIds);
        const next = moveIdBefore(synced, currentDraggedGoalId, goalId);
        return areStringArraysEqual(synced, next) ? synced : next;
      });
      setDraggedGoalId(null);
      setDropGoalId(null);
    },
    [draggedGoalId, goalIds, setGoalOrder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedGoalId(null);
    setDropGoalId(null);
  }, []);

  return (
    <Box sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0, borderRight: { xs: 0, md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Column header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography variant="overline" sx={{ display: 'block' }}>{t('Goals', 'Objectifs')}</Typography>
      </Box>

      {/* Goals list */}
      <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, maxHeight: { xs: 196, md: 'none' }, overflowY: 'auto', p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {orderedGoals.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.78rem', py: 1.5, textAlign: 'center' }}>
            {t('No goals yet.', 'Aucun objectif.')}
          </Typography>
        )}
        {orderedGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            isActive={activeBlueprint?.id === goal.blueprintId}
            onRemove={() => removeGoal(goal.id)}
            onQtyChange={(qty) => updateGoalQuantity(goal.id, qty)}
            onEdit={() => setEditingGoalId(goal.id)}
            onSelect={() => selectGoalBlueprint(goal.id)}
            isDragging={draggedGoalId === goal.id}
            isDropTarget={dropGoalId === goal.id && draggedGoalId !== goal.id}
            onDragOver={handleDragOver(goal.id)}
            onDrop={handleDrop(goal.id)}
            dragHandleProps={{
              draggable: true,
              onDragStart: handleDragStart(goal.id),
              onDragEnd: handleDragEnd,
            }}
          />
        ))}
      </Box>

      {/* Craft time */}
      {orderedGoals.length > 0 && (
        <Box sx={{ mx: 1.25, mb: 1.25, px: 1.25, py: 1, border: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
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
