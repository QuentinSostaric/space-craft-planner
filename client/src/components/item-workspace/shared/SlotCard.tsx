import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
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
import { FONT_DISPLAY, FONT_MONO } from '../../../theme';

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

export interface InventoryLot {
  id: string;
  qty: number;
  quality: number;
}

export function SlotCard({
  slot,
  qualityValue,
  onQualityChange,
  category,
  inventoryLots,
}: {
  slot: MaterialSlot;
  qualityValue: number | undefined;
  onQualityChange: (value: number | undefined) => void;
  category?: ItemCategory;
  inventoryLots?: InventoryLot[];
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();

  const currentQuality = qualityValue ?? 500;
  const qualityPercent = Math.round(currentQuality / 10);
  const isAssigned = qualityValue !== undefined;
  const requirementName = getSlotRequirementName(slot);
  const isResourceRequirement = isResourceSlot(slot);
  const isPlaceholderResource = isPlaceholderResourceSlot(slot);

  const deadZoneEnd = slot.modifiers.length > 0
    ? Math.min(...slot.modifiers.map((m) => m.qualityStart))
    : 0;
  const optimalStart = Math.round((slot.minQuality ?? deadZoneEnd) / 10);

  function nudge(delta: number) {
    const next = clampQualityValue(currentQuality + delta);
    onQualityChange(next);
  }

  // Tone color for the quality indicator (matching design)
  const tone = currentQuality >= 600 ? theme.palette.success.main
             : currentQuality >= 400 ? theme.palette.primary.main
             : currentQuality >= 200 ? theme.palette.warning.main
             : theme.palette.error.main;

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
        px: { xs: 1.5, md: 1.5 },
        py: { xs: 1.25, md: 1 },
        minHeight: { md: 68 },
        position: 'relative',
        backgroundColor: 'background.paper',
        borderColor: isAssigned ? alpha(tone, 0.45) : 'ui.border',
        transition: 'border-color 150ms, background-color 150ms',
        // Accent stripe on the left
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 2,
          borderRadius: '0 2px 2px 0',
          backgroundColor: isAssigned ? tone : 'transparent',
          opacity: 0.6,
          transition: 'background-color 150ms',
        },
        pl: { xs: 1.5, md: 2 },
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
          {isResourceRequirement ? (
            <ResourceIcon name={slot.requiredResource} size={24} />
          ) : category ? (
            <GameIcon name={CAT_ICON[category]} size={21} />
          ) : (
            <GameIcon name="utilities" size={21} />
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {/* Material name is the primary label */}
          <Typography
            variant="body2"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: '0.875rem',
              lineHeight: 1.05,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isPlaceholderResource ? t('System slot', 'Slot systeme') : requirementName}
          </Typography>
          {/* Slot label as secondary */}
          <Typography
            variant="caption"
            sx={{
              mt: 0.25,
              display: 'block',
              color: 'text.secondary',
              fontSize: '0.75rem',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {loc(slot.label, lang)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.15,
              color: 'text.disabled',
              fontSize: '0.75rem',
              lineHeight: 1.15,
            }}
          >
            {t('Optimal', 'Optimal')}: {optimalStart}% – 100%
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'space-between', mb: 0.3 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.75rem' }}>
            {t('Quality', 'Qualite')}
          </Typography>
          <Typography variant="caption" sx={{ color: isAssigned ? 'primary.light' : 'text.disabled', fontWeight: 800 }}>
            {isAssigned ? `${qualityPercent}%` : '-'}
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '24px 1fr 24px', gap: 0.45, alignItems: 'center', overflow: 'hidden' }}>
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
            getAriaValueText={(v) => `${v} / 1000`}
            size="small"
            valueLabelDisplay="off"
            marks={[
              { value: 500 },
              ...(deadZoneEnd > 0 && deadZoneEnd !== 500 ? [{ value: deadZoneEnd }] : []),
            ]}
            sx={{
              width: '100%',
              mx: 0.5,
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                border: `3px solid ${isAssigned ? tone : theme.palette.text.secondary}`,
                backgroundColor: theme.palette.background.paper,
                boxShadow: `0 2px 6px rgba(0,0,0,0.3), 0 0 0 4px ${alpha(isAssigned ? tone : theme.palette.text.secondary, 0.14)}`,
                '&:hover': { boxShadow: `0 2px 6px rgba(0,0,0,0.3), 0 0 0 4px ${alpha(isAssigned ? tone : theme.palette.text.secondary, 0.14)}` },
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

      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 0.25,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          backgroundColor: isAssigned ? alpha(tone, 0.08) : 'transparent',
          border: '1px solid',
          borderColor: isAssigned ? alpha(tone, 0.25) : 'transparent',
          minWidth: 60,
        }}
      >
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            color: isAssigned ? tone : 'text.disabled',
            fontSize: '1rem',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isAssigned ? currentQuality : '–'}
        </Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled', letterSpacing: '0.04em' }}>
          {isAssigned ? (currentQuality >= 500 ? `+${qualityPercent - 50}%` : `${qualityPercent - 50}%`) : ''}
        </Typography>
      </Box>

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

      {inventoryLots != null && (
        <Box
          sx={{
            gridColumn: { xs: '1 / -1', md: '1 / -1' },
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            pt: 0.75,
            mt: 0.25,
            borderTop: `1px solid ${alpha(theme.palette.ui.border, 0.6)}`,
          }}
        >
          <InventoryIcon sx={{ fontSize: '0.85rem', color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem', flexShrink: 0 }}>
            {t('Inventory lot', 'Lot d\'inventaire')}
          </Typography>
          <Select
            size="small"
            displayEmpty
            value=""
            onChange={(e) => {
              const id = e.target.value as string;
              if (!id) return;
              const found = inventoryLots.find((l) => l.id === id);
              if (found) onQualityChange(found.quality);
            }}
            sx={{
              ml: 'auto',
              minWidth: 140,
              height: 24,
              fontSize: '0.75rem',
              fontFamily: FONT_MONO,
              '& .MuiSelect-select': { py: '2px', px: 1 },
              backgroundColor: alpha(theme.palette.background.default, 0.3),
            }}
            aria-label={t('Select inventory lot', 'Sélectionner un lot d\'inventaire')}
          >
            <MenuItem value="" sx={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'text.disabled' }}>
              — {t('Manual', 'Manuel')} —
            </MenuItem>
            {inventoryLots.map((lot) => (
              <MenuItem key={lot.id} value={lot.id} sx={{ fontSize: '0.75rem', fontFamily: FONT_MONO }}>
                {lot.qty}× Q{lot.quality}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}
    </Card>
  );
}
