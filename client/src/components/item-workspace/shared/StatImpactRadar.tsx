import { Box, Stack, Typography, useMediaQuery, alpha, useTheme } from '../../../ui/system';
import { Chip } from '../../../ui/widgets';
import { useEffect, useMemo, useRef } from 'react';
import {
  Chart,
  Filler,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
} from 'chart.js';
import { loc, useI18n } from '../../../i18n/I18nContext';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler);

function shortenMetricLabel(label: string): string {
  return label
    .replace('Resistance', 'Res.')
    .replace('Smoothness', 'Smooth.')
    .replace('Handling', 'Handle.');
}

function RadarCanvas({
  labels,
  baseSeries,
  buildSeries,
  height,
  baseColor,
  buildColor,
  gridColor,
  labelColor,
  labelFont,
}: {
  labels: string[];
  baseSeries: number[];
  buildSeries: number[];
  height: number;
  baseColor: string;
  buildColor: string;
  gridColor: string;
  labelColor: string;
  labelFont: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'radar'> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    // StrictMode double-invokes effects; make sure no chart instance is
    // still bound to this canvas before creating a new one.
    Chart.getChart(canvas)?.destroy();
    chartRef.current = new Chart<'radar'>(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            data: baseSeries,
            borderColor: baseColor,
            borderWidth: 1,
            borderDash: [4, 4],
            backgroundColor: 'transparent',
            pointRadius: 0,
          },
          {
            data: buildSeries,
            borderColor: buildColor,
            borderWidth: 2,
            backgroundColor: alpha(buildColor, 0.18),
            fill: true,
            pointRadius: 2,
            pointBackgroundColor: buildColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          r: {
            min: 80,
            max: 120,
            ticks: { display: false },
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: {
              color: labelColor,
              font: { size: 11, family: labelFont },
            },
          },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, baseSeries, buildSeries, baseColor, buildColor, gridColor, labelColor, labelFont]);

  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={canvasRef} role="img" aria-label="Quality impact radar" />
    </div>
  );
}
import {
  ARMOR_DAMAGE_RESISTANCE_KEYS,
  NUMERIC_ITEM_STAT_KEYS,
  STAT_LABELS,
  STAT_LOWER_IS_BETTER,
  STAT_PERCENT_KEYS,
} from '../../../types';
import type { Blueprint, ItemStats, NumericItemStatKey } from '../../../types';
import { FONT_HEADING, TEXT_LABEL} from '../../../theme';

const WEAPON_METRICS: NumericItemStatKey[] = [
  'damage',
  'rateOfFire',
  'effectiveRange',
  'recoilSmoothness',
  'recoilHandling',
  'recoilKick',
];

const ARMOR_METRICS: NumericItemStatKey[] = [
  ...ARMOR_DAMAGE_RESISTANCE_KEYS,
  'temperatureMax',
  'temperatureMin',
  'radiationDissipation',
  'impactForceResistance',
  'wearMovementMultiplier',
];

const COMPONENT_METRICS: Partial<Record<Blueprint['category'], NumericItemStatKey[]>> = {
  powerplant: ['powerGeneration', 'maxHealth'],
  cooler: ['coolantGeneration', 'maxHealth'],
  'shield-generator': ['shieldMaxHealth', 'maxHealth'],
  'quantum-drive': ['quantumSpeed', 'quantumFuelRequirement', 'maxHealth'],
  radar: ['radarMinAimAssistDistance', 'radarMaxAimAssistDistance', 'maxHealth'],
  'fuel-nozzle': ['hydrogenFlowSpeed', 'quantumFlowSpeed', 'maxHealth'],
  'salvage-head': ['hullScrapingEfficiency', 'hullScrapingRadius', 'hullScrapingSpeed', 'maxHealth'],
  'tractor-beam': ['tractorForce', 'tractorFullStrengthDistance', 'tractorMaxDistance', 'tractorMaxVolume'],
  'ship-weapon': ['burstDps', 'sustainedDps', 'rateOfFire', 'effectiveRange', 'maxHealth'],
  'mining-laser': ['powerGeneration', 'coolantGeneration', 'maxHealth'],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getComparableValue(key: NumericItemStatKey, value: number) {
  if (key === 'temperatureMin') {
    return Math.abs(value);
  }

  return value;
}

function getMetricKeys(blueprint: Blueprint, projectedStats: ItemStats): NumericItemStatKey[] {
  const candidates =
    blueprint.category === 'fps-weapon'
      ? WEAPON_METRICS
      : blueprint.category === 'fps-magazine'
        ? (['magazineSize'] as NumericItemStatKey[])
        : ['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(blueprint.category)
          ? ARMOR_METRICS
          : COMPONENT_METRICS[blueprint.category] ?? NUMERIC_ITEM_STAT_KEYS;

  return candidates.filter((key) => {
    const base = blueprint.baseStats[key];
    const projected = projectedStats[key];
    return typeof base === 'number' || typeof projected === 'number';
  });
}

function getIndexedScore(
  key: NumericItemStatKey,
  baseValue: number | undefined,
  projectedValue: number | undefined,
) {
  const base = typeof baseValue === 'number' ? baseValue : 0;
  const projected = typeof projectedValue === 'number' ? projectedValue : base;
  const comparableBase = getComparableValue(key, base);
  const comparableProjected = getComparableValue(key, projected);

  let deltaPct = 0;

  if (Math.abs(comparableBase) > 0.0001) {
    deltaPct = ((comparableProjected / comparableBase) - 1) * 100;
  } else if (STAT_PERCENT_KEYS.has(key)) {
    deltaPct = (projected - base) * 100;
  } else {
    deltaPct = comparableProjected - comparableBase;
  }

  const signedDelta = STAT_LOWER_IS_BETTER.has(key) ? -deltaPct : deltaPct;
  return clamp(100 + signedDelta, 80, 120);
}

export function StatImpactRadar({
  blueprint,
  projectedStats,
}: {
  blueprint: Blueprint;
  projectedStats: ItemStats;
}) {
  const theme = useTheme();
  const { lang, t } = useI18n();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));

  const { metricKeys, baseSeries, buildSeries, metrics, metricStates } = useMemo(() => {
    const keys = getMetricKeys(blueprint, projectedStats).slice(0, 6);
    const base = keys.map(() => 100);
    const build = keys.map((key) =>
      getIndexedScore(key, blueprint.baseStats[key], projectedStats[key]),
    );
    const states = keys.map((key) => {
      const baseValue = blueprint.baseStats[key];
      const projectedValue = projectedStats[key];
      const baseNumeric = typeof baseValue === 'number' ? baseValue : 0;
      const projectedNumeric =
        typeof projectedValue === 'number' ? projectedValue : baseNumeric;
      const comparableBase = getComparableValue(key, baseNumeric);
      const comparableProjected = getComparableValue(key, projectedNumeric);

      let pct = 0;
      if (Math.abs(comparableBase) > 0.0001) {
        pct = ((comparableProjected / comparableBase) - 1) * 100;
      } else if (STAT_PERCENT_KEYS.has(key)) {
        pct = (projectedNumeric - baseNumeric) * 100;
      } else {
        pct = comparableProjected - comparableBase;
      }

      const isNeutral = Math.abs(pct) < 0.005;
      const isImproved = STAT_LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;

      return {
        key,
        label: loc(STAT_LABELS[key] ?? { en: key, fr: key }, lang),
        pct,
        isNeutral,
        isImproved,
      };
    });
    const metricsArr = keys.map((key) => ({
      name: loc(STAT_LABELS[key] ?? { en: key, fr: key }, lang),
      min: 80,
      max: 120,
    }));
    return {
      metricKeys: keys,
      baseSeries: base,
      buildSeries: build,
      metrics: metricsArr,
      metricStates: states,
    };
  }, [blueprint, projectedStats, lang]);

  if (metricKeys.length < 3) {
    return (
      <Box component="section">
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, fontFamily: FONT_HEADING, mb: 0.5, fontSize: '.85rem' }}
        >
          {t('Quality Impact Profile', 'Profil d impact qualite')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t(
            'Not enough comparable stats for a radar profile.',
            'Pas assez de stats comparables pour un profil radar.',
          )}
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="section">
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, fontFamily: FONT_HEADING, fontSize: '.85rem' }}
          >
            {t('Quality Impact Profile', 'Profil d impact qualite')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('Baseline index = 100', 'Indice de base = 100')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            label={t('Base', 'Base')}
            variant="outlined"
            sx={{
              height: 22,
              color: 'text.secondary',
              borderColor: alpha(theme.palette.text.secondary, 0.35),
            }}
          />
          <Chip
            size="small"
            label={t('Current build', 'Build actuel')}
            variant="filled"
            sx={{
              height: 22,
              backgroundColor: alpha(theme.palette.primary.main, 0.16),
              color: 'primary.light',
            }}
          />
        </Stack>
      </Stack>

      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 1.25 }}
      >
        {metricStates.map((metric) => {
          const statePrefix = metric.isNeutral ? '' : metric.isImproved ? '↑ ' : '↓ ';
          const stateLabel = metric.isNeutral
            ? t('unchanged', 'inchangé', 'unverändert')
            : metric.isImproved
              ? t('improved', 'amélioré', 'verbessert')
              : t('degraded', 'dégradé', 'verschlechtert');
          return (
            <Chip
              key={metric.key}
              size="small"
              label={`${statePrefix}${metric.label}`}
              variant="outlined"
              aria-label={`${metric.label}: ${stateLabel}`}
              sx={{
                height: 22,
                fontSize: TEXT_LABEL,
                color: metric.isNeutral
                  ? 'text.secondary'
                  : metric.isImproved
                    ? theme.palette.success.main
                    : theme.palette.error.main,
                borderColor: metric.isNeutral
                  ? alpha(theme.palette.text.secondary, 0.28)
                  : metric.isImproved
                    ? alpha(theme.palette.success.main, 0.45)
                    : alpha(theme.palette.error.main, 0.45),
                backgroundColor: metric.isNeutral
                  ? alpha(theme.palette.text.secondary, 0.04)
                  : metric.isImproved
                    ? alpha(theme.palette.success.main, 0.08)
                    : alpha(theme.palette.error.main, 0.08),
              }}
            />
          );
        })}
      </Stack>

      <RadarCanvas
        labels={metrics.map((m) => shortenMetricLabel(m.name))}
        baseSeries={baseSeries}
        buildSeries={buildSeries}
        height={isCompact ? 220 : 260}
        baseColor={alpha(theme.palette.text.secondary, 0.75)}
        buildColor={theme.palette.primary.main}
        gridColor={alpha(theme.palette.primary.main, 0.18)}
        labelColor={theme.palette.text.secondary}
        labelFont={FONT_HEADING}
      />
    </Box>
  );
}
