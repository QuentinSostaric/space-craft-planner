import { memo, useCallback, useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { alpha, useTheme } from '@mui/material/styles';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { ResourceMethodDetail } from './ResourceMethodDetail';
import { ResourceIcon } from '../ui/ResourceIcon';
import type { AggregatedResource, ResourceMethod, ResourceProgress } from '../../types';

const DEFAULT_PROGRESS: ResourceProgress = { collected: 0, method: null };

interface ResourceRowProps {
  resource: AggregatedResource;
  progress?: ResourceProgress;
}

const PALETTE_KEY_MAP: Record<ResourceMethod, 'primary' | 'success' | 'warning' | 'secondary'> = {
  mission: 'primary',
  mining: 'success',
  dismantle: 'warning',
  buy: 'secondary',
};

export const ResourceRow = memo(function ResourceRow({ resource, progress = DEFAULT_PROGRESS }: ResourceRowProps) {
  const { setResourceCollected, setResourceMethod } = useCraft();
  const { t } = useI18n();
  const theme = useTheme();
  const collected = Math.min(progress.collected, resource.totalScu);
  const method = progress.method;
  const isDone = collected >= resource.totalScu && resource.totalScu > 0;

  const handleMethodChange = useCallback(
    (_: React.MouseEvent, value: ResourceMethod | null) => {
      setResourceMethod(resource.resourceName, value);
    },
    [resource.resourceName, setResourceMethod],
  );

  const handleSliderChange = useCallback(
    (_: Event, value: number | number[]) => {
      setResourceCollected(resource.resourceName, value as number);
    },
    [resource.resourceName, setResourceCollected],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        setResourceCollected(resource.resourceName, Math.max(0, Math.min(resource.totalScu, val)));
      }
    },
    [resource.resourceName, resource.totalScu, setResourceCollected],
  );

  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      const clamped = isNaN(val) ? 0 : Math.round(Math.max(0, Math.min(resource.totalScu, val)) * 100) / 100;
      setResourceCollected(resource.resourceName, clamped);
    },
    [resource.resourceName, resource.totalScu, setResourceCollected],
  );

  const handleCheckbox = useCallback(() => {
    setResourceCollected(resource.resourceName, isDone ? 0 : resource.totalScu);
  }, [resource.resourceName, resource.totalScu, isDone, setResourceCollected]);

  const valueLabelFormat = useCallback((v: number) => `${v.toFixed(2)} SCU`, []);

  const borderColor = useMemo(() => {
    if (isDone) return theme.palette.success.main;
    if (!method) return theme.palette.divider;
    return theme.palette[PALETTE_KEY_MAP[method]].main;
  }, [isDone, method, theme]);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor,
        opacity: isDone ? 0.6 : 1,
        overflow: 'hidden',
        transition: 'border-color 200ms ease, opacity 200ms ease',
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>

        {/* Name row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ResourceIcon name={resource.resourceName} size={16} />
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, flex: 1, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'text.disabled' : 'text.primary' }}
          >
            {resource.resourceName}
          </Typography>
          {resource.minRequiredQuality != null && resource.minRequiredQuality > 0 && (
            <Chip
              label={`Min ${resource.minRequiredQuality}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 18, color: 'warning.main', borderColor: alpha(theme.palette.warning.main, 0.3) }}
            />
          )}
          <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", color: 'text.secondary', flexShrink: 0 }}>
            {resource.totalScu.toFixed(2)} SCU
          </Typography>
        </Box>

        {/* Method toggle */}
        <ToggleButtonGroup
          value={method}
          exclusive
          onChange={handleMethodChange}
          size="small"
          aria-label={t('Collection method', 'Méthode de collecte')}
          sx={{ '& .MuiToggleButton-root': { fontSize: '0.65rem', py: 0.25, px: 1, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
        >
          <ToggleButton value="mission">{t('Mission', 'Mission')}</ToggleButton>
          <ToggleButton value="mining">{t('Mining', 'Minage')}</ToggleButton>
          <ToggleButton value="dismantle">{t('Dismantle', 'Démantèle')}</ToggleButton>
          <ToggleButton value="buy">{t('Buy', 'Achat')}</ToggleButton>
        </ToggleButtonGroup>

        {/* Progress: Slider + TextField + Checkbox */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Slider
            min={0}
            max={resource.totalScu}
            step={0.01}
            value={collected}
            onChange={handleSliderChange}
            valueLabelDisplay="auto"
            valueLabelFormat={valueLabelFormat}
            aria-label={t('Collected SCU', 'SCU collecté')}
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
                step: 0.01,
                style: { width: 52, textAlign: 'right', padding: '3px 6px', fontSize: '0.72rem', fontFamily: 'monospace' },
              },
            }}
            sx={{ width: 70, flexShrink: 0 }}
            aria-label={t('Collected SCU value', 'Valeur SCU collectée')}
          />
          <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap', flexShrink: 0 }}>
            / {resource.totalScu.toFixed(2)}
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

      {/* Method detail accordion */}
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
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: '1rem' }} />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {method === 'mission' ? t('Available contracts', 'Contrats disponibles')
                : method === 'mining' ? t('Mining', 'Minage')
                : method === 'dismantle' ? t('Dismantling', 'Démantèlement')
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
