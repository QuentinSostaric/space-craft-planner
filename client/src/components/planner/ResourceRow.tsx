import { Box, Paper, Typography, alpha, useTheme } from '../../ui/system';
import { Accordion, AccordionDetails, AccordionSummary } from '../ui/primitives';
import { AppChip } from '../ui/data-display';
import { DragIndicatorIcon } from '../../ui/icons';
import {
  memo,
  useCallback,
  useMemo,
  type DragEventHandler,
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
import { AppCheckbox, AppSlider } from '../ui/controls';
import { PlannerNumberInput, PlannerSegmentedControl } from './PlannerControls';

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
    (value: ResourceMethod) => {
      setResourceMethod(resource.resourceName, value === method ? null : value);
    },
    [method, resource.resourceName, setResourceMethod],
  );

  const handleSliderChange = useCallback(
    (value: number) => {
      setResourceCollected(resource.resourceName, value);
    },
    [resource.resourceName, setResourceCollected],
  );

  const handleInputChange = useCallback(
    (value: number | '') => {
      if (value !== '' && Number.isFinite(value)) {
        setResourceCollected(resource.resourceName, Math.max(0, Math.min(resource.totalScu, value)));
      }
    },
    [resource.resourceName, resource.totalScu, setResourceCollected],
  );

  const handleInputBlur = useCallback(
    (value: number | '') => {
      const clamped = value === '' || !Number.isFinite(value)
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
            <AppChip
              label={`Min ${resource.minRequiredQuality}`}
              size="sm"
              outlined
              sx={{
                fontSize: TEXT_LABEL,
                height: 18,
                color: 'warning.main',
                borderColor: alpha(theme.palette.warning.main, 0.3),
              }}
            />
          )}
          {manualRequired > 0 && (
            <AppChip
              label={`+${formatResourceQuantity(manualRequired, resource.quantityUnit, lang, 'long')} ${t('manual', 'manuel')}`}
              size="sm"
              outlined
              onRemove={() => clearPlannerResourceRequirement(resource.resourceName)}
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

        <PlannerSegmentedControl
          value={method}
          onValueChange={handleMethodChange}
          ariaLabel={t('Collection method', 'Méthode de collecte')}
          compact
          sx={{ width: '100%' }}
          options={[
            { value: 'mission', label: t('Mission', 'Mission') },
            { value: 'mining', label: t('Mining', 'Minage') },
            { value: 'dismantle', label: t('Dismantle', 'Démantelé') },
            { value: 'buy', label: t('Buy', 'Achat') },
          ]}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AppSlider
            min={0}
            max={resource.totalScu}
            step={quantityStep}
            value={collected}
            onValueChange={handleSliderChange}
            formatValue={valueLabelFormat}
            label={t('Collected amount', 'Quantité collectée')}
            marks={resource.totalScu > 0 ? [
              { value: 0, label: '0' },
              { value: resource.totalScu, label: formatQuantityValue(resource.totalScu, resource.quantityUnit) },
            ] : []}
            sx={{ flex: 1, minWidth: 120 }}
            partSx={{ handle: { minWidth: 24, minHeight: 24 }, root: { minHeight: 24 } }}
          />
          <PlannerNumberInput
            value={collected}
            onValueChange={handleInputChange}
            onBlur={handleInputBlur}
            min={0}
            max={resource.totalScu}
            step={quantityStep}
            ariaLabel={t('Collected amount value', 'Valeur collectée')}
            sx={{ width: 76, flexShrink: 0, fontFamily: FONT_MONO, fontSize: TEXT_LABEL }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
            / {formatQuantityValue(resource.totalScu, resource.quantityUnit)}
          </Typography>
          <AppCheckbox
            checked={isDone}
            onCheckedChange={handleCheckbox}
            label={t('Mark as fully collected', 'Marquer comme entièrement collecté')}
            sx={{ minWidth: 44, minHeight: 44, flexShrink: 0, '& > span': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }}
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
            sx={{ minHeight: 44, py: 0.5 }}
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
