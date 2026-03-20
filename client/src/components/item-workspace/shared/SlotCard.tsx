import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import { useI18n, loc } from '../../../i18n/I18nContext';
import { gppModifier } from '../../../hooks/useCraftSimulator';
import { ResourceIcon } from '../../ui/ResourceIcon';
import { GameIcon } from '../../ui/GameIcon';
import { GPP_LABELS } from '../../../types';
import { tokens } from '../../../theme';
import type { MaterialSlot, ItemCategory } from '../../../types';
import type { GameIconName } from '../../ui/GameIcon';
import { clampQualityValue } from '../../../utils/crafting';

const CAT_ICON: Record<ItemCategory, GameIconName> = {
  'fps-weapon': 'weapons',
  'fps-magazine': 'ammos',
  'fps-armor': 'armor',
  'fps-helmet': 'armor',
  'fps-undersuit': 'utilities',
  'fps-backpack': 'utilities',
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

  const currentQuality = qualityValue ?? 0;
  const isAssigned = qualityValue !== undefined;

  const modifiers = useMemo(() => {
    if (!isAssigned || qualityValue === undefined) return [];
    return slot.modifiers
      .map((modifier) => {
        const label = GPP_LABELS[modifier.gppId]?.[lang] ?? modifier.gppId;
        const multiplier = gppModifier(modifier.modAtMin, modifier.modAtMax, qualityValue);
        const pct = (multiplier - 1) * 100;
        const lowerIsBetter = modifier.gppId.includes('Recoil');
        const isImproved = lowerIsBetter ? pct < 0 : pct > 0;
        return { gppId: modifier.gppId, label, pct, isImproved, isNeutral: Math.abs(pct) < 0.005, occurrenceCount: modifier.occurrenceCount };
      })
      .filter(Boolean);
  }, [isAssigned, lang, qualityValue, slot.modifiers]);

  const deadZoneEnd = slot.modifiers.length > 0
    ? Math.min(...slot.modifiers.map((m) => m.qualityStart))
    : 0;
  const deadZonePct = (deadZoneEnd / 1000) * 100;

  function nudge(delta: number) {
    const next = clampQualityValue(currentQuality + delta);
    onQualityChange(next);
  }

  return (
    <Card
      sx={{
        backgroundColor: tokens.surface1,
        borderColor: isAssigned ? tokens.violet : tokens.border,
        transition: 'border-color 150ms',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header: icon + slot name + resource */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          p: '10px 12px 8px',
          borderBottom: `1px solid ${tokens.border}`,
          backgroundColor: isAssigned ? 'rgba(139, 92, 246, 0.06)' : 'transparent',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1px solid ${tokens.border}`,
            backgroundColor: tokens.bgSubtle,
          }}
        >
          {category ? (
            <GameIcon name={CAT_ICON[category]} size={20} />
          ) : (
            <ResourceIcon name={slot.requiredResource} size={20} />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              fontSize: '0.875rem',
              lineHeight: 1.2,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {loc(slot.label, lang)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '.1em' }}
            >
              {t('Resource', 'Ressource')}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
              {slot.requiredResource}
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={() => onQualityChange(undefined)}
          disabled={!isAssigned}
          size="small"
          sx={{ p: 0.25, mt: -0.25 }}
          aria-label={t('Clear', 'Effacer')}
        >
          <CloseIcon sx={{ fontSize: '0.85rem' }} />
        </IconButton>
      </Box>

      {/* Quality slider zone */}
      <Box sx={{ p: '8px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Quality value display */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '.1em' }}
          >
            {t('Quality', 'Qualite')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 700,
              fontSize: '0.875rem',
              color: isAssigned ? tokens.violet : 'text.disabled',
            }}
          >
            {isAssigned ? Math.round(currentQuality) : '—'}
          </Typography>
        </Box>

        {/* Slider with +/- buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            onClick={() => nudge(-QUALITY_STEP)}
            size="small"
            disabled={!isAssigned || currentQuality <= 0}
            sx={{ p: 0.25 }}
            aria-label={t('Decrease quality', 'Reduire qualite')}
          >
            <RemoveIcon sx={{ fontSize: '0.85rem' }} />
          </IconButton>
          <Slider
            min={0}
            max={1000}
            value={currentQuality}
            onChange={(_e, val) => onQualityChange(clampQualityValue(val as number))}
            aria-label={t(`Quality for ${slot.requiredResource}`, `Qualite pour ${slot.requiredResource}`)}
            size="small"
            marks={deadZoneEnd > 0 ? [{ value: deadZoneEnd, label: '' }] : undefined}
            sx={{
              flex: 1,
              mx: 0.5,
              ...(deadZonePct > 0 && {
                '& .MuiSlider-track': {
                  background: `linear-gradient(to right, rgba(107,114,128,0.4) 0%, rgba(107,114,128,0.4) ${deadZonePct}%, currentColor ${deadZonePct}%)`,
                },
              }),
            }}
          />
          <IconButton
            onClick={() => nudge(QUALITY_STEP)}
            size="small"
            disabled={!isAssigned || currentQuality >= 1000}
            sx={{ p: 0.25 }}
            aria-label={t('Increase quality', 'Augmenter qualite')}
          >
            <AddIcon sx={{ fontSize: '0.85rem' }} />
          </IconButton>
        </Box>

        {/* Direct input */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            value={isAssigned ? Math.round(currentQuality) : ''}
            placeholder="—"
            onChange={(e) => onQualityChange(clampQualityValue(Number(e.target.value)))}
            slotProps={{
              htmlInput: {
                min: 0,
                max: 1000,
                style: { textAlign: 'center', padding: '2px 4px', fontSize: '0.75rem' },
              },
            }}
            sx={{ flex: 1, '& .MuiInputBase-root': { height: 26 } }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', flexShrink: 0 }}>
            {slot.quantityScu} SCU
          </Typography>
          {slot.quantityMultiplier != null && (
            <Chip
              label={`x${slot.quantityMultiplier}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          )}
          {slot.minQuality != null && slot.minQuality > 0 && (
            <Typography
              variant="caption"
              sx={{ color: 'warning.main', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', flexShrink: 0 }}
            >
              MIN {slot.minQuality}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Modifier chips (bottom) */}
      {modifiers.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            p: '6px 12px 8px',
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          {modifiers.map((m) => (
            <Box
              key={m.gppId}
              sx={{
                px: 0.75,
                py: 0.25,
                border: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                backgroundColor: tokens.bgSubtle,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.05em' }}
              >
                {m.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: m.isNeutral ? 'text.secondary' : m.isImproved ? 'success.main' : 'error.main',
                }}
              >
                {m.pct > 0 ? '+' : ''}{m.pct.toFixed(1)}%
              </Typography>
              {m.occurrenceCount > 1 && (
                <Box component="span" sx={{ ml: 0.5, fontWeight: 700, opacity: 0.7 }}>
                  x{m.occurrenceCount}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
