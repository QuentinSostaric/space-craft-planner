import { Box, IconButton, Typography, alpha, useTheme } from '../../ui/system';
import type { Theme } from '../../ui/system';
import { AddIcon, CloseIcon, RemoveIcon } from '../../ui/icons';
import { AppSlider } from '../ui/controls';
import { ResourceIcon } from '../ui/ResourceIcon';
import { GameIcon } from '../ui/GameIcon';
import type { GameIconName } from '../ui/GameIcon';
import { loc, useI18n } from '../../i18n/I18nContext';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import type { Blueprint, ItemCategory, ItemStats, MaterialSlot, NumericItemStatKey } from '../../types';
import {
  NUMERIC_ITEM_STAT_KEYS,
  STAT_LABELS,
  STAT_LOWER_IS_BETTER,
} from '../../types';
import { formatStatValue } from '../../utils/statFormatting';
import {
  clampQualityValue,
  formatSlotQuantity,
  getSlotRequirementName,
  isPlaceholderResourceSlot,
  isResourceSlot,
} from '../../utils/crafting';
import { BUILD_INDEX_MAX } from '../../hooks/useCraftSimulator';

const QUALITY_STEP = 50;

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

/** Quality → tone. Mirrors the thresholds used across the craft UI. */
export function qualityTone(theme: Theme, quality: number | undefined): string {
  if (quality == null) return theme.palette.text.disabled;
  if (quality >= 600) return theme.palette.success.main;
  if (quality >= 400) return theme.palette.primary.main;
  if (quality >= 200) return theme.palette.warning.main;
  return theme.palette.error.main;
}

/**
 * Grid template shared by the slot table header and its rows.
 *
 * Narrow viewports drop the quality column out of the header row and give the
 * controls a full-width second row of their own — the table stays dense on
 * desktop without the sliders becoming unreachable on a phone.
 */
const SLOT_GRID = {
  xs: '22px minmax(0, 1fr) 58px 48px',
  md: '22px minmax(96px, 1.25fr) minmax(140px, 1.7fr) 58px 48px',
};

export function SlotTableHeader() {
  const { t } = useI18n();
  const cell = {
    fontFamily: FONT_MONO,
    fontSize: '0.5625rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'text.disabled',
  } as const;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: SLOT_GRID,
        gap: 1.125,
        px: 1.5,
        py: 0.625,
        borderBottom: (t: Theme) => `1px solid ${t.palette.ui.border}`,
      }}
    >
      <span />
      <Typography sx={cell}>{t('Material', 'Matériau')}</Typography>
      <Typography sx={{ ...cell, display: { xs: 'none', md: 'block' } }}>{t('Quality', 'Qualité')}</Typography>
      <Typography sx={{ ...cell, textAlign: 'right' }}>{t('Value', 'Valeur')}</Typography>
      <Typography sx={{ ...cell, textAlign: 'center' }}>{t('Min', 'Min')}</Typography>
    </Box>
  );
}

export function SlotRow({
  slot,
  quality,
  onQualityChange,
  category,
}: {
  slot: MaterialSlot;
  quality: number | undefined;
  onQualityChange: (value: number | undefined) => void;
  category?: ItemCategory;
}) {
  const theme = useTheme();
  const { lang, t } = useI18n();

  const assigned = quality !== undefined;
  const current = quality ?? 500;
  const tone = qualityTone(theme, quality);
  const requirementName = getSlotRequirementName(slot);
  const deadZoneEnd = slot.modifiers.length > 0 ? Math.min(...slot.modifiers.map((m) => m.qualityStart)) : 0;
  const optimalStart = Math.round((slot.minQuality ?? deadZoneEnd) / 10);
  const minQuality = slot.minQuality ?? 0;
  const meetsMin = minQuality === 0 || (assigned && current >= minQuality);
  const multiplier = slot.quantityMultiplier;
  const hasMultiplier = multiplier != null && multiplier > 1;

  // On an unassigned slot either stepper assigns the neutral 500 baseline —
  // stepping from an implicit value the row doesn't display would be arbitrary.
  const nudge = (delta: number) => onQualityChange(assigned ? clampQualityValue(current + delta) : 500);

  return (
    <Box
      role="listitem"
      aria-label={`${requirementName} — ${loc(slot.label, lang)}`}
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: SLOT_GRID,
        gap: 1.125,
        alignItems: 'center',
        px: 1.5,
        py: 0.75,
        borderBottom: (t: Theme) => `1px solid ${t.palette.ui.border}`,
        transition: 'background-color 120ms ease',
        '&:hover': { backgroundColor: (t: Theme) => alpha(t.palette.primary.main, 0.06) },
        // Keep the dense table clean: the clear affordance surfaces on hover.
        '&:hover .slot-clear, &:focus-within .slot-clear': { opacity: 1 },
        // Left accent stripe once the slot carries a material quality
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 2,
          backgroundColor: assigned ? tone : 'transparent',
          opacity: 0.7,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          gridColumn: { xs: 1, md: 'auto' },
          gridRow: { xs: 1, md: 'auto' },
          width: 22,
          height: 22,
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: `1px solid ${assigned ? theme.palette.ui.borderAccent : theme.palette.ui.border}`,
          backgroundColor: assigned ? alpha(theme.palette.primary.main, 0.13) : 'transparent',
          color: assigned ? 'primary.main' : 'text.disabled',
        }}
      >
        {isResourceSlot(slot) ? (
          <ResourceIcon name={slot.requiredResource} size={15} />
        ) : (
          <GameIcon name={category ? CAT_ICON[category] : 'utilities'} size={14} />
        )}
      </Box>

      <Box sx={{ minWidth: 0, gridColumn: { xs: 2, md: 'auto' }, gridRow: { xs: 1, md: 'auto' } }}>
        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: '0.76rem',
            lineHeight: 1.15,
            color: 'text.primary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isPlaceholderResourceSlot(slot) ? t('System slot', 'Slot système') : requirementName}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.63rem',
            lineHeight: 1.3,
            color: 'text.disabled',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {loc(slot.label, lang)} · {formatSlotQuantity(slot)} · {t('opt', 'opt')} {optimalStart}–100%
        </Typography>
      </Box>

      <Box
        sx={{
          // Full-width second row on phones, inline table cell from md up.
          gridColumn: { xs: '1 / -1', md: 'auto' },
          gridRow: { xs: 2, md: 'auto' },
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.5, md: 1 },
          minWidth: 0,
          pt: { xs: 0.5, md: 0 },
        }}
      >
        <IconButton
          size="small"
          onClick={() => nudge(-QUALITY_STEP)}
          disabled={assigned && current <= 0}
          aria-label={t('Decrease quality', 'Réduire la qualité', 'Qualität verringern')}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, minWidth: 44, minHeight: 44, flexShrink: 0 }}
        >
          <RemoveIcon sx={{ fontSize: 15 }} />
        </IconButton>
        {/* The slider needs a sized flex parent: PrimeReact's track is width-driven. */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AppSlider
            min={0}
            max={1000}
            step={QUALITY_STEP}
            value={current}
            onValueChange={(value) => onQualityChange(clampQualityValue(value))}
            label={t(`Quality for ${requirementName}`, `Qualité pour ${requirementName}`, `Qualität für ${requirementName}`)}
            formatValue={(value) => t(
              `${Math.round(value / 10)}% quality, ${value} of 1000`,
              `${Math.round(value / 10)}% de qualité, ${value} sur 1000`,
              `${Math.round(value / 10)}% Qualität, ${value} von 1000`,
            )}
            sx={{
              width: '100%',
              minWidth: 0,
              '& > div:first-of-type': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
            }}
            partSx={{
              // PrimeReact ships no intrinsic track height — give it one so the
              // rail reads as a rail and not just a floating handle.
              root: { height: 4, borderRadius: '999px', border: 'none' },
              range: { borderRadius: '999px', backgroundColor: assigned ? tone : theme.palette.text.disabled },
              handle: {
                width: 14,
                height: 14,
                // PrimeReact's structural CSS ships no radius — the design's
                // thumb is a circle, not a rounded square.
                borderRadius: '50%',
                border: `3px solid ${assigned ? tone : theme.palette.text.secondary}`,
                backgroundColor: theme.palette.ui.bgElev,
                boxShadow: `0 1px 4px rgba(0,0,0,0.35)`,
              },
            }}
          />
        </Box>
        <IconButton
          size="small"
          onClick={() => nudge(QUALITY_STEP)}
          disabled={assigned && current >= 1000}
          aria-label={t('Increase quality', 'Augmenter la qualité', 'Qualität erhöhen')}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, minWidth: 44, minHeight: 44, flexShrink: 0 }}
        >
          <AddIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <Box
          component="input"
          type="number"
          min={0}
          max={1000}
          step={QUALITY_STEP}
          value={assigned ? Math.round(current) : ''}
          placeholder="–"
          aria-label={t(
            `Quality value for ${requirementName}`,
            `Valeur qualité pour ${requirementName}`,
            `Qualitätswert für ${requirementName}`,
          )}
          onChange={(event: { currentTarget: { value: string } }) => {
            if (event.currentTarget.value === '') {
              onQualityChange(undefined);
              return;
            }
            onQualityChange(clampQualityValue(Number(event.currentTarget.value)));
          }}
          sx={{
            width: { xs: 56, md: 46 },
            height: { xs: 44, md: 26 },
            flexShrink: 0,
            border: `1px solid ${theme.palette.ui.border}`,
            borderRadius: '5px',
            backgroundColor: alpha(theme.palette.background.default, 0.4),
            color: 'text.primary',
            fontFamily: FONT_MONO,
            fontSize: '0.66rem',
            textAlign: 'center',
            p: 0,
          }}
        />
        <IconButton
          className="slot-clear"
          size="small"
          onClick={() => onQualityChange(undefined)}
          disabled={!assigned}
          aria-label={t('Clear this slot', 'Vider ce slot', 'Slot leeren')}
          title={t('Clear this slot', 'Vider ce slot', 'Slot leeren')}
          sx={{
            flexShrink: 0,
            minWidth: { xs: 44, md: 22 },
            minHeight: { xs: 44, md: 22 },
            p: 0,
            color: 'text.disabled',
            // Always reachable on touch; hover-revealed on pointer devices.
            opacity: { xs: 1, md: 0 },
            transition: 'opacity 120ms ease',
            '&:hover, &:focus-visible': { color: 'primary.main', opacity: 1 },
          }}
        >
          <CloseIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>

      <Box sx={{ textAlign: 'right', gridColumn: { xs: 3, md: 'auto' }, gridRow: { xs: 1, md: 'auto' } }}>
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: '0.86rem',
            lineHeight: 1,
            color: assigned ? tone : 'text.disabled',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {assigned ? current : '–'}
        </Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.58rem', color: 'text.disabled' }}>
          {assigned ? `${Math.round(current / 10)}%` : ''}
        </Typography>
      </Box>

      {/* A slot can carry both a minimum quality and a multiplier — show each. */}
      <Box
        sx={{
          gridColumn: { xs: 4, md: 'auto' },
          gridRow: { xs: 1, md: 'auto' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
        }}
      >
        {minQuality > 0 && (
          <Box
            title={`${t('Minimum quality', 'Qualité minimum')} ${minQuality}`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 18,
              px: 0.625,
              borderRadius: '5px',
              border: `1px solid ${alpha(meetsMin ? theme.palette.success.main : theme.palette.warning.main, 0.45)}`,
              color: meetsMin ? 'success.main' : 'warning.main',
              fontFamily: FONT_MONO,
              fontSize: '0.56rem',
              fontWeight: 800,
            }}
          >
            {minQuality}
          </Box>
        )}
        {hasMultiplier && (
          <Typography
            title={t('Quantity multiplier', 'Multiplicateur de quantité')}
            sx={{ fontFamily: FONT_MONO, fontSize: '0.62rem', fontWeight: 700, color: 'text.disabled' }}
          >
            ×{multiplier}
          </Typography>
        )}
        {minQuality === 0 && !hasMultiplier && (
          <Typography sx={{ color: 'text.disabled', opacity: 0.5 }}>·</Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Projected result ─────────────────────────────────────────────────────────

export function BuildIndexKnob({ score, color }: { score: number; color: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const size = 112;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.palette.ui.surface3} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(BUILD_INDEX_MAX, score)) / BUILD_INDEX_MAX)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(.22,1,.36,1), stroke 300ms ease' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            // Four digits now fit inside the ring, so the type has to come down
            // a step from the 2rem the two-digit 0–100 index used.
            fontSize: '1.625rem',
            lineHeight: 1,
            color: 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: '0.5625rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'text.disabled',
            mt: 0.25,
          }}
        >
          {t('Build index', 'Indice de build', 'Build-Index')}
        </Typography>
      </Box>
    </Box>
  );
}

interface StatMeter {
  key: NumericItemStatKey;
  label: string;
  base: number;
  final: number;
  deltaPct: number;
  fillBase: number;
  fillFinal: number;
  improved: boolean;
  neutral: boolean;
}

export function buildStatMeters(
  blueprint: Blueprint,
  projectedStats: ItemStats,
  lang: 'en' | 'fr' | 'de',
): StatMeter[] {
  const base = blueprint.baseStats;
  return NUMERIC_ITEM_STAT_KEYS.filter((key) => typeof base[key] === 'number' && base[key] !== 0)
    .map((key) => {
      const baseVal = base[key] as number;
      const finalVal = typeof projectedStats[key] === 'number' ? (projectedStats[key] as number) : baseVal;
      const delta = finalVal - baseVal;
      const lowerIsBetter = STAT_LOWER_IS_BETTER.has(key);
      const maxRef = Math.max(Math.abs(baseVal), Math.abs(finalVal)) * 1.15 || 1;
      const labelObj = STAT_LABELS[key] ?? { en: String(key), fr: String(key) };
      return {
        key,
        label: loc(labelObj, lang),
        base: baseVal,
        final: finalVal,
        deltaPct: baseVal !== 0 ? (finalVal / baseVal - 1) * 100 : 0,
        fillBase: Math.min(100, (Math.abs(baseVal) / maxRef) * 100),
        fillFinal: Math.min(100, (Math.abs(finalVal) / maxRef) * 100),
        improved: lowerIsBetter ? delta < 0 : delta > 0,
        neutral: Math.abs(baseVal !== 0 ? (finalVal / baseVal - 1) * 100 : 0) < 0.005,
      };
    })
    .slice(0, 12);
}

export function StatMeterRow({ meter }: { meter: StatMeter }) {
  const theme = useTheme();
  const { t } = useI18n();
  const color = meter.neutral
    ? theme.palette.text.disabled
    : meter.improved
      ? theme.palette.success.main
      : theme.palette.error.main;
  const outcome = meter.neutral
    ? t('Unchanged', 'Inchangé')
    : meter.improved
      ? t('Improved', 'Amélioré')
      : t('Degraded', 'Dégradé');

  return (
    <Box component="article" aria-label={`${meter.label}: ${outcome}`} sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.625, mb: 0.375 }}>
        <Typography
          sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {meter.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexShrink: 0, fontFamily: FONT_MONO }}>
          <Typography
            title={t('Base value', 'Valeur de base')}
            sx={{ fontSize: '0.6rem', color: 'text.disabled' }}
          >
            {formatStatValue(meter.key, meter.base)}
          </Typography>
          <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>→</Typography>
          <Typography
            title={t('Projected value', 'Valeur projetée')}
            sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.primary' }}
          >
            {formatStatValue(meter.key, meter.final)}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color }}>
            {meter.neutral ? '—' : `${meter.improved ? '▲' : '▼'}${Math.abs(meter.deltaPct).toFixed(0)}%`}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          position: 'relative',
          height: 3,
          borderRadius: '2px',
          overflow: 'hidden',
          backgroundColor: (tt: Theme) => alpha(tt.palette.text.primary, 0.08),
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: `${meter.fillBase}%`,
            backgroundColor: (tt: Theme) => alpha(tt.palette.text.secondary, 0.28),
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: `${meter.fillFinal}%`,
            backgroundColor: meter.neutral ? theme.palette.primary.main : color,
            opacity: 0.85,
            transition: 'width 300ms cubic-bezier(.22,1,.36,1)',
          }}
        />
      </Box>
    </Box>
  );
}
