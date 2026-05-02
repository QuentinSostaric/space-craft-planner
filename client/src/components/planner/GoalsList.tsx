import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocalPersist } from '../../hooks/useLocalPersist';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { LS_KEYS } from '../../types';
import { areStringArraysEqual, moveIdBefore, synchronizeOrderedIds } from '../../utils/reorder';
import { GoalCard } from './GoalCard';
import { GoalEditModal } from './GoalEditModal';
import { FONT_HEADING, FONT_MONO } from '../../theme';
import { toSlug } from '../../utils/slug';

export function GoalsList() {
  const { goals, blueprints, activeBlueprint, removeGoal, updateGoalQuantity, selectGoalBlueprint } = useCraft();
  const { t } = useI18n();
  const theme = useTheme();
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

      const previewElement = event.currentTarget.closest('[data-goal-card="true"]');
      if (previewElement instanceof HTMLElement) {
        const rect = previewElement.getBoundingClientRect();
        event.dataTransfer.setDragImage(
          previewElement,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (goalId: string) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const currentDraggedGoalId = draggedGoalId ?? event.dataTransfer.getData('text/plain');
      if (!currentDraggedGoalId || currentDraggedGoalId === goalId) {
        return;
      }
      event.dataTransfer.dropEffect = 'move';
      setDropGoalId(goalId);
      setGoalOrder((previous) => {
        const synced = synchronizeOrderedIds(previous, goalIds);
        const next = moveIdBefore(synced, currentDraggedGoalId, goalId);
        return areStringArraysEqual(synced, next) ? synced : next;
      });
    },
    [draggedGoalId, goalIds, setGoalOrder],
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
    <Paper
      variant="outlined"
      sx={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderColor: alpha(theme.palette.primary.main, 0.16),
        backgroundColor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ display: 'block', color: 'primary.main' }}>
            {t('Queue', 'File')}
          </Typography>
          <Typography sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '1.25rem', lineHeight: 0.95 }}>
            {t('Build queue', 'File de craft')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label={`${orderedGoals.length} ${t('goals', 'objectifs')}`}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
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
            href={`/item/${toSlug(goal.blueprintName)}`}
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

      {orderedGoals.length > 0 && (
        <Box
          sx={{
            mx: 1.25,
            mb: 1.25,
            px: 1.25,
            py: 1,
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.18),
            borderRadius: 1.5,
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('Total craft time', 'Temps de craft total')}
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: 'secondary.main', fontWeight: 700 }}>
            {craftTimeLabel}
          </Typography>
        </Box>
      )}

      {editingGoal && (
        <GoalEditModal goal={editingGoal} onClose={() => setEditingGoalId(null)} />
      )}
    </Paper>
  );
}
