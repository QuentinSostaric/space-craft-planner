import { Box, Paper, Typography, alpha, useTheme } from '../../ui/system';
import { Accordion, AccordionDetails, AccordionSummary, Checkbox, Chip, Slider, TextField, ToggleButton, ToggleButtonGroup } from '../../ui/widgets';
import { DragIndicatorIcon } from '../../ui/icons';
import {
  memo,
  useCallback,
  useMemo,
  type ChangeEvent,
  type DragEventHandler,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatQuantityValue,
  formatResourceQuantity,
  getResourceQuantityInputStep,
} from '../../utils/crafting';
import type { AggregatedResource, ResourceMethod, ResourceProgress } from '../../types';
import { ResourceMethodDetail } from './ResourceMethodDetail';
import { AppGlyph } from '../ui/AppGlyph';
import { ResourceIcon } from '../ui/ResourceIcon';
import { FONT_MONO, TEXT_LABEL} from '../../theme';

const DEFAULT_PROGRESS: ResourceProgress = { collected: 0, method: null };

interface ResourceRowProps {
  resource: AggregatedResource;
  progress?: ResourceProgress;
  manualRequired?: number;
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

const PALETTE_KEY_MAP: Record<ResourceMethod, 'primary' | 'success' | 'warning' | 'secondary'> = {
  mission: 'primary',
  mining: 'success',
  dismantle: 'warning',
  buy: 'secondary',
};

export const ResourceRow = memo(function ResourceRow({
  resource,
  progress = DEFAULT_PROGRESS,
  manualRequired = 0,
  isDragging = false,
  isDropTarget = false,
  onDragOver,
  onDrop,
  dragHandleProps,
}: ResourceRowProps) {
  const { clearPlannerResourceRequirement, setResourceCollected, setResourceMethod } = useCraft();
  const { t, lang } = useI18n();
  const theme = useTheme();
  const quantityStep = getResourceQuantityInputStep(resource.quantityUnit);
  const collected = Math.min(progress.collected, resource.totalScu);
  const method = progress.method;
  const isDone = collected >= resource.totalScu && resource.totalScu > 0;

  const handleMethodChange = useCallback(
    (_event: MouseEvent<HTMLElement>, value: ResourceMethod | null) => {
      setResourceMethod(resource.resourceName, value);
    },
    [resource.resourceName, setResourceMethod],
  );

  const handleSliderChange = useCallback(
    (_event: Event, value: number | number[]) => {
      setResourceCollected(resource.resourceName, value as number);
    },
    [resource.resourceName, setResourceCollected],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      if (!Number.isNaN(value)) {
        setResourceCollected(resource.resourceName, Math.max(0, Math.min(resource.totalScu, value)));
      }
    },
    [resource.resourceName, resource.totalScu, setResourceCollected],
  );

  const handleInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      const clamped = Number.isNaN(value)
        ? 0
        : resource.quantityUnit === 'count'
          ? Math.round(Math.max(0, Math.min(resource.totalScu, value)))
          : Math.round(Math.max(0, Math.min(resource.totalScu, value)) * 100) / 100;
      setResourceCollected(resource.resourceName, clamped);
    },
    [resource.quantityUnit, resource.resourceName, resource.totalScu, setResourceCollected],
  );

  const handleCheckbox = useCallback(() => {
    setResourceCollected(resource.resourceName, isDone ? 0 : resource.totalScu);
  }, [resource.resourceName, resource.totalScu, isDone, setResourceCollected]);

  const valueLabelFormat = useCallback(
    (value: number) => formatResourceQuantity(value, resource.quantityUnit, lang, 'long'),
    [lang, resource.quantityUnit],
  );

  const borderColor = useMemo(() => {
    if (isDone) return theme.palette.success.main;
    if (!method) return theme.palette.divider;
    return theme.palette[PALETTE_KEY_MAP[method]].main;
  }, [isDone, method, theme]);

  return (
    <Paper
      variant="outlined"
      data-resource-row="true"
      onDragOver={onDragOver}
      onDrop={onDrop}
      sx={{
        borderColor,
        opacity: isDone ? 0.6 : 1,
        overflow: 'hidden',
        transition: 'border-color 200ms ease, opacity 200ms ease',
        boxShadow: isDropTarget ? `0 0 0 1px ${theme.palette.primary.main}` : undefined,
        transform: isDragging ? 'scale(0.995)' : 'none',
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ResourceIcon name={resource.resourceName} size={16} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              flex: 1,
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? 'text.disabled' : 'text.primary',
            }}
          >
            {resource.resourceName}
          </Typography>
          {resource.minRequiredQuality != null && resource.minRequiredQuality > 0 && (
            <Chip
              label={`Min ${resource.minRequiredQuality}`}
              size="small"
              variant="outlined"
              sx={{
                fontSize: TEXT_LABEL,
                height: 18,
                color: 'warning.main',
                borderColor: alpha(theme.palette.warning.main, 0.3),
              }}
            />
          )}
          {manualRequired > 0 && (
            <Chip
              label={`+${formatResourceQuantity(manualRequired, resource.quantityUnit, lang, 'long')} ${t('manual', 'manuel')}`}
              size="small"
              variant="outlined"
              onDelete={() => clearPlannerResourceRequirement(resource.resourceName)}
              sx={{ fontSize: TEXT_LABEL, height: 18 }}
            />
          )}
          <Typography
            variant="caption"
            sx={{
              fontFamily: FONT_MONO,
              color: 'text.secondary',
              flexShrink: 0,
            }}
          >
            {formatResourceQuantity(resource.totalScu, resource.quantityUnit, lang, 'long')}
          </Typography>
          {dragHandleProps && (
            <Box
              component="span"
              {...dragHandleProps}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
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
        </Box>

        <ToggleButtonGroup
          value={method}
          exclusive
          onChange={handleMethodChange}
          size="small"
          aria-label={t('Collection method', 'Méthode de collecte')}
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: TEXT_LABEL,
              py: 0.25,
              px: 1,
            },
          }}
        >
          <ToggleButton value="mission">{t('Mission', 'Mission')}</ToggleButton>
          <ToggleButton value="mining">{t('Mining', 'Minage')}</ToggleButton>
          <ToggleButton value="dismantle">{t('Dismantle', 'Démantelé')}</ToggleButton>
          <ToggleButton value="buy">{t('Buy', 'Achat')}</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Slider
            min={0}
            max={resource.totalScu}
            step={quantityStep}
            value={collected}
            onChange={handleSliderChange}
            valueLabelDisplay="auto"
            valueLabelFormat={valueLabelFormat}
            aria-label={t('Collected amount', 'Quantité collectée')}
            sx={{ flex: 1, color: isDone ? 'success.main' : undefined }}
          />
          <TextField
            type="number"
            size="small"
            value={collected}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            slotProps={{
              htmlInput: {
                min: 0,
                max: resource.totalScu,
                step: quantityStep,
                style: {
                  width: 52,
                  textAlign: 'right',
                  padding: '3px 6px',
                  fontSize: TEXT_LABEL,
                  fontFamily: 'monospace',
                },
              },
            }}
            sx={{ width: 70, flexShrink: 0 }}
            aria-label={t('Collected amount value', 'Valeur collectée')}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
            / {formatQuantityValue(resource.totalScu, resource.quantityUnit)}
          </Typography>
          <Checkbox
            checked={isDone}
            onChange={handleCheckbox}
            size="small"
            title={t('Mark as fully collected', 'Marquer comme entièrement collecté')}
            aria-label={t('Mark as fully collected', 'Marquer comme entièrement collecté')}
            sx={{ p: 0.25, flexShrink: 0 }}
          />
        </Box>
      </Box>

      {method && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            borderTop: `1px solid ${borderColor}`,
            backgroundColor: alpha(borderColor, 0.04),
            '&::before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<AppGlyph name="caret-up" size={16} />}
            sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                fontSize: TEXT_LABEL,
              }}
            >
              {method === 'mission'
                ? t('Available contracts', 'Contrats disponibles')
                : method === 'mining'
                  ? t('Mining', 'Minage')
                  : method === 'dismantle'
                    ? t('Dismantling', 'Démantèlement')
                    : t('Purchase', 'Achat')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1, px: 1.5 }}>
            <ResourceMethodDetail resourceName={resource.resourceName} method={method} />
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );
});
