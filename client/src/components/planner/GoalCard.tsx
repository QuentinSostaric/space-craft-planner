import { memo, useCallback, useMemo, type DragEventHandler, type SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTheme } from '@mui/material/styles';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { CategoryBadge } from '../ui/Badge';
import type { CraftGoal } from '../../types';

interface GoalCardProps {
  goal: CraftGoal;
  isActive: boolean;
  onRemove: () => void;
  onQtyChange: (quantity: number) => void;
  onEdit: () => void;
  onSelect: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragOver?: DragEventHandler<HTMLElement>;
  onDrop?: DragEventHandler<HTMLElement>;
  dragHandleProps?: {
    draggable: boolean;
    onDragStart: DragEventHandler<HTMLElement>;
    onDragEnd: DragEventHandler<HTMLElement>;
  };
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

export const GoalCard = memo(function GoalCard({
  goal,
  isActive,
  onRemove,
  onQtyChange,
  onEdit,
  onSelect,
  isDragging = false,
  isDropTarget = false,
  onDragOver,
  onDrop,
  dragHandleProps,
}: GoalCardProps) {
  const { blueprints } = useCraft();
  const { t } = useI18n();
  const theme = useTheme();
  const blueprint = useMemo(() => blueprints.find((b) => b.id === goal.blueprintId), [blueprints, goal.blueprintId]);

  // useCallback kept here so the identity is stable across re-renders (no deps needed — fn is module-level)
  const handleStopPropagation = useCallback(stopPropagation, []);

  return (
    <Card
      data-goal-card="true"
      sx={{
        cursor: isDragging ? 'grabbing' : 'pointer',
        borderColor: isActive ? theme.palette.primary.main : theme.palette.ui.border,
        backgroundColor: isActive ? theme.palette.ui.surface2 : theme.palette.ui.surface1,
        transition: 'all 150ms ease',
        transform: isDragging ? 'scale(0.985)' : 'none',
        opacity: isDragging ? 0.7 : 1,
        boxShadow: isDropTarget ? `0 0 0 1px ${theme.palette.primary.main}` : undefined,
        '&:hover': { borderColor: theme.palette.ui.borderStrong },
      }}
      onClick={onSelect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${t('Goal', 'Objectif')}: ${goal.blueprintName}`}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {dragHandleProps && (
            <Box
              component="span"
              {...dragHandleProps}
              onClick={handleStopPropagation}
              onMouseDown={handleStopPropagation}
              title={t('Drag to reorder', 'Glisser pour réordonner')}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.disabled',
                cursor: isDragging ? 'grabbing' : 'grab',
                flexShrink: 0,
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: '1rem' }} />
            </Box>
          )}
          {blueprint && <CategoryBadge category={blueprint.category} iconOnly />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.85rem', lineHeight: 1.2 }}>
              {goal.blueprintName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: "'Share Tech Mono', monospace", fontSize: '.62rem' }}>
              {t('Build index', 'Indice de build')}: <strong>{goal.qualityScore}</strong>/100
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={(event) => { handleStopPropagation(event); onEdit(); }}
              aria-label={`${t('Edit', 'Modifier')} ${goal.blueprintName}`}
              sx={{ fontSize: '.75rem' }}
            >
              ✎
            </IconButton>
            <IconButton
              size="small"
              onClick={(event) => { handleStopPropagation(event); onRemove(); }}
              aria-label={`${t('Remove', 'Supprimer')} ${goal.blueprintName}`}
              sx={{ fontSize: '.7rem', color: 'error.main' }}
            >
              ✕
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '.65rem' }}>
            {t('Qty', 'Qté')}
          </Typography>
          <IconButton
            size="small"
            onClick={(event) => { handleStopPropagation(event); onQtyChange(Math.max(1, goal.quantity - 1)); }}
            aria-label={t('Decrease', 'Réduire')}
            sx={{ width: 22, height: 22, fontSize: '.7rem' }}
          >
            −
          </IconButton>
          <TextField
            type="number"
            size="small"
            value={goal.quantity}
            onClick={handleStopPropagation}
            onFocus={handleStopPropagation}
            onChange={(event) =>
              onQtyChange(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
            }
            slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 32, textAlign: 'center', padding: '2px 4px', fontSize: '.75rem' } } }}
            sx={{ width: 48 }}
          />
          <IconButton
            size="small"
            onClick={(event) => { handleStopPropagation(event); onQtyChange(Math.min(99, goal.quantity + 1)); }}
            aria-label={t('Increase', 'Augmenter')}
            sx={{ width: 22, height: 22, fontSize: '.7rem' }}
          >
            +
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
});
