import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import { useI18n, loc } from '../../../i18n/I18nContext';
import { ResourceIcon } from '../../ui/ResourceIcon';
import { GameIcon } from '../../ui/GameIcon';
import type { MaterialSlot, ItemCategory } from '../../../types';
import type { GameIconName } from '../../ui/GameIcon';
import {
  clampQualityValue,
  formatSlotQuantity,
  getSlotRequirementName,
  isPlaceholderResourceSlot,
  isResourceSlot,
} from '../../../utils/crafting';
import { FONT_HEADING, FONT_MONO } from '../../../theme';

const CAT_ICON: Record<ItemCategory, GameIconName> = {
  'fps-weapon': 'weapons',
  'fps-magazine': 'ammos',
  'fps-armor': 'armor',
  'fps-helmet': 'armor',
  'fps-undersuit': 'utilities',
  'fps-backpack': 'utilities',
  powerplant: 'power-plants',
  cooler: 'coolers',
  'shield-generator': 'shields',
  'quantum-drive': 'engines',
  radar: 'radars',
  'fuel-nozzle': 'utilities',
  'ship-weapon': 'weapons',
  'mining-laser': 'mining-lasers',
  'salvage-head': 'salvage',
  'tractor-beam': 'tractor-beams',
};

const QUALITY_STEP = 50;

export function SlotCard({
  slot,
  qualityValue,
  onQualityChange,
  category,
}: {
  slot: MaterialSlot;
  qualityValue: number | undefined;
  onQualityChange: (value: number | undefined) => void;
  category?: ItemCategory;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();

  const currentQuality = qualityValue ?? 0;
  const qualityPercent = Math.round(currentQuality / 10);
  const isAssigned = qualityValue !== undefined;
  const requirementName = getSlotRequirementName(slot);
  const isResourceRequirement = isResourceSlot(slot);
  const isPlaceholderResource = isPlaceholderResourceSlot(slot);

  const deadZoneEnd = slot.modifiers.length > 0
    ? Math.min(...slot.modifiers.map((m) => m.qualityStart))
    : 0;
  const deadZonePct = (deadZoneEnd / 1000) * 100;
  const optimalStart = Math.round((slot.minQuality ?? deadZoneEnd) / 10);

  function nudge(delta: number) {
    const next = clampQualityValue(currentQuality + delta);
    onQualityChange(next);
  }

  return (
    <Card
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(210px, 0.92fr) minmax(220px, 1fr) 74px minmax(92px, 118px) 34px',
        },
        gap: { xs: 0.85, md: 1 },
        alignItems: 'center',
        px: { xs: 1, md: 1 },
        py: { xs: 1, md: 0.78 },
        minHeight: { md: 64 },
        background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, isAssigned ? 0.065 : 0.018)} 0%, ${alpha(theme.palette.ui.surface1, 0.98)} 64%)`,
        borderColor: isAssigned ? alpha(theme.palette.primary.main, 0.52) : theme.palette.ui.border,
        transition: 'border-color 150ms, background-color 150ms',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr)', gap: 0.85, alignItems: 'center', minWidth: 0 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1px solid ${isAssigned ? alpha(theme.palette.primary.main, 0.42) : theme.palette.ui.border}`,
            backgroundColor: isAssigned
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.background.default, 0.25),
            color: isAssigned ? 'primary.light' : 'text.secondary',
          }}
        >
          {category ? (
            <GameIcon name={CAT_ICON[category]} size={21} />
          ) : isResourceRequirement ? (
            <ResourceIcon name={slot.requiredResource} size={21} />
          ) : (
            <GameIcon name="utilities" size={21} />
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontFamily: FONT_HEADING,
              fontWeight: 800,
              fontSize: '0.88rem',
              lineHeight: 1.05,
              color: 'text.primary',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {loc(slot.label, lang)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              mt: 0.35,
              display: 'block',
              color: 'text.secondary',
              fontSize: '0.75rem',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isPlaceholderResource
              ? t('System slot', 'Slot systeme')
              : isResourceRequirement
                ? t('Resource', 'Ressource')
                : t('Item', 'Objet')}{' '}
            {requirementName}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.2,
              color: 'text.secondary',
              fontSize: '0.75rem',
              lineHeight: 1.15,
            }}
          >
            {t('Optimal range', 'Plage optimale')}: {optimalStart}% - 100%
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'space-between', mb: 0.3 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem' }}>
            {t('Quality', 'Qualite')}
          </Typography>
          <Typography variant="caption" sx={{ color: isAssigned ? 'primary.light' : 'text.disabled', fontWeight: 800 }}>
            {isAssigned ? `${qualityPercent}%` : '-'}
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) 24px', gap: 0.45, alignItems: 'center' }}>
          <IconButton
            onClick={() => nudge(-QUALITY_STEP)}
            size="small"
            disabled={!isAssigned || currentQuality <= 0}
            sx={{ p: 0.25 }}
            aria-label={t('Decrease quality', 'Reduire qualite')}
          >
            <RemoveIcon sx={{ fontSize: '0.86rem' }} />
          </IconButton>
          <Slider
            min={0}
            max={1000}
            value={currentQuality}
            onChange={(_e, val) => onQualityChange(clampQualityValue(val as number))}
            aria-label={t(
              `Quality for ${requirementName}`,
              `Qualite pour ${requirementName}`,
              `Qualitat fur ${requirementName}`,
            )}
            getAriaValueText={(v) => `${Math.round(v / 10)}%`}
            size="small"
            marks={deadZoneEnd > 0 ? [{ value: deadZoneEnd, label: '' }] : undefined}
            sx={{
              flex: 1,
              color: isAssigned ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.52),
              ...(deadZonePct > 0 && {
                '& .MuiSlider-track': {
                  background: `linear-gradient(to right, rgba(107,114,128,0.45) 0%, rgba(107,114,128,0.45) ${deadZonePct}%, currentColor ${deadZonePct}%)`,
                },
              }),
              '& .MuiSlider-thumb': {
                width: 13,
                height: 13,
                border: `2px solid ${theme.palette.background.paper}`,
              },
            }}
          />
          <IconButton
            onClick={() => nudge(QUALITY_STEP)}
            size="small"
            disabled={currentQuality >= 1000}
            sx={{ p: 0.25 }}
            aria-label={t('Increase quality', 'Augmenter qualite')}
          >
            <AddIcon sx={{ fontSize: '0.86rem' }} />
          </IconButton>
        </Box>
      </Box>

      <Typography
        sx={{
          display: { xs: 'none', md: 'block' },
          fontFamily: FONT_MONO,
          fontWeight: 800,
          color: isAssigned ? 'text.primary' : 'text.disabled',
          fontSize: '0.86rem',
          textAlign: 'right',
        }}
      >
        {isAssigned ? `${qualityPercent}%` : '-'}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: { xs: 'space-between', md: 'center' },
          gap: 0.5,
          minWidth: 0,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          type="number"
          size="small"
          value={isAssigned ? Math.round(currentQuality) : ''}
          placeholder="-"
          onChange={(e) => {
            if (e.target.value === '') {
              onQualityChange(undefined);
              return;
            }
            onQualityChange(clampQualityValue(Number(e.target.value)));
          }}
          slotProps={{
            htmlInput: {
              min: 0,
              max: 1000,
              'aria-label': t(
                `Quality value for ${requirementName}`,
                `Valeur qualité pour ${requirementName}`,
                `Qualitätswert für ${requirementName}`,
              ),
              style: { width: 50, textAlign: 'center', padding: '2px 4px', fontSize: '0.75rem', fontFamily: FONT_MONO },
            },
          }}
          sx={{
            width: 68,
            '& .MuiInputBase-root': {
              height: 27,
              backgroundColor: alpha(theme.palette.background.default, 0.24),
            },
          }}
        />
        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {formatSlotQuantity(slot)}
        </Typography>
        {slot.quantityMultiplier != null && (
          <Chip
            label={`x${slot.quantityMultiplier}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.75rem', height: 20 }}
          />
        )}
        {slot.minQuality != null && slot.minQuality > 0 && (
          <Chip
            label={`MIN ${slot.minQuality}`}
            size="small"
            variant="outlined"
            sx={{
              height: 20,
              color: 'warning.main',
              borderColor: alpha(theme.palette.warning.main, 0.35),
              '& .MuiChip-label': { fontSize: '0.75rem', fontWeight: 800 },
            }}
          />
        )}
      </Box>

      <IconButton
        onClick={() => onQualityChange(undefined)}
        disabled={!isAssigned}
        size="small"
        sx={{ justifySelf: { xs: 'flex-end', md: 'center' }, p: 0.35 }}
        aria-label={t('Clear', 'Effacer')}
      >
        <CloseIcon sx={{ fontSize: '0.9rem' }} />
      </IconButton>
    </Card>
  );
}
