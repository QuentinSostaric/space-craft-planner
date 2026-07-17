import { Box, IconButton, Typography, useTheme } from '../../ui/system';
import { Card, CardContent, TextField } from '../../ui/widgets';
import { DragIndicatorIcon } from '../../ui/icons';
import { memo, useCallback, useMemo, type DragEventHandler, type SyntheticEvent } from 'react';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { CategoryBadge } from '../ui/Badge';
import type { CraftGoal } from '../../types';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL} from '../../theme';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';

interface GoalCardProps {
  goal: CraftGoal;
  isActive: boolean;
  onRemove: () => void;
  onQtyChange: (quantity: number) => void;
  onEdit: () => void;
  onSelect: () => void;
  href: string;
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
  href,
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
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'pointer',
        borderColor: isActive ? theme.palette.primary.main : theme.palette.ui.border,
        backgroundColor: isActive ? theme.palette.ui.surface2 : theme.palette.ui.surface1,
        transition: 'all 150ms ease',
        transform: isDragging ? 'scale(0.985)' : 'none',
        opacity: isDragging ? 0.7 : 1,
        boxShadow: isDropTarget ? `0 0 0 1px ${theme.palette.primary.main}` : undefined,
        '&:hover': { borderColor: theme.palette.ui.borderStrong },
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Box
        component="a"
        href={href}
        aria-label={`${t('Goal', 'Objectif')}: ${goal.blueprintName}`}
        onClick={(event) => {
          if (!shouldHandleInternalLinkClick(event)) return;
          event.preventDefault();
          onSelect();
        }}
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          borderRadius: 'inherit',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      />
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
                position: 'relative',
                zIndex: 2,
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
            <Typography variant="body2" sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '.85rem', lineHeight: 1.2 }}>
              {goal.blueprintName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: FONT_MONO, fontSize: TEXT_LABEL }}>
              {t('Build index', 'Indice de build')}: <strong>{goal.qualityScore}</strong>/100
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25, position: 'relative', zIndex: 2 }}>
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
              sx={{ fontSize: TEXT_LABEL, color: 'error.main' }}
            >
              ✕
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: TEXT_LABEL }}>
            {t('Qty', 'Qté')}
          </Typography>
          <IconButton
            size="small"
            onClick={(event) => { handleStopPropagation(event); onQtyChange(Math.max(1, goal.quantity - 1)); }}
            aria-label={t('Decrease', 'Réduire')}
            sx={{ width: 22, height: 22, fontSize: TEXT_LABEL, position: 'relative', zIndex: 2 }}
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
            sx={{ width: 48, position: 'relative', zIndex: 2 }}
          />
          <IconButton
            size="small"
            onClick={(event) => { handleStopPropagation(event); onQtyChange(Math.min(99, goal.quantity + 1)); }}
            aria-label={t('Increase', 'Augmenter')}
            sx={{ width: 22, height: 22, fontSize: TEXT_LABEL, position: 'relative', zIndex: 2 }}
          >
            +
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
});
