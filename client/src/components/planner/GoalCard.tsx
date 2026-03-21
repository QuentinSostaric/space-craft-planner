import { type SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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
}

export function GoalCard({ goal, isActive, onRemove, onQtyChange, onEdit, onSelect }: GoalCardProps) {
  const { blueprints } = useCraft();
  const { t } = useI18n();
  const theme = useTheme();
  const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);

  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        borderColor: isActive ? theme.palette.primary.main : theme.palette.ui.border,
        backgroundColor: isActive ? theme.palette.ui.surface2 : theme.palette.ui.surface1,
        transition: 'all 150ms ease',
        '&:hover': { borderColor: theme.palette.ui.borderStrong },
      }}
      onClick={onSelect}
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
              onClick={(event) => { stopPropagation(event); onEdit(); }}
              aria-label={`${t('Edit', 'Modifier')} ${goal.blueprintName}`}
              sx={{ fontSize: '.75rem' }}
            >
              ✎
            </IconButton>
            <IconButton
              size="small"
              onClick={(event) => { stopPropagation(event); onRemove(); }}
              aria-label={`${t('Remove', 'Supprimer')} ${goal.blueprintName}`}
              sx={{ fontSize: '.7rem', color: 'error.main' }}
            >
              ✕
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '.65rem' }}>
            {t('Qty', 'Qte')}
          </Typography>
          <IconButton
            size="small"
            onClick={(event) => { stopPropagation(event); onQtyChange(Math.max(1, goal.quantity - 1)); }}
            aria-label={t('Decrease', 'Reduire')}
            sx={{ width: 22, height: 22, fontSize: '.7rem' }}
          >
            −
          </IconButton>
          <TextField
            type="number"
            size="small"
            value={goal.quantity}
            onClick={stopPropagation}
            onFocus={stopPropagation}
            onChange={(event) =>
              onQtyChange(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
            }
            slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 32, textAlign: 'center', padding: '2px 4px', fontSize: '.75rem' } } }}
            sx={{ width: 48 }}
          />
          <IconButton
            size="small"
            onClick={(event) => { stopPropagation(event); onQtyChange(Math.min(99, goal.quantity + 1)); }}
            aria-label={t('Increase', 'Augmenter')}
            sx={{ width: 22, height: 22, fontSize: '.7rem' }}
          >
            +
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}
