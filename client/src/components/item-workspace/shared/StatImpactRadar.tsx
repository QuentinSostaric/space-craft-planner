import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { RadarChart } from '@mui/x-charts/RadarChart';
import { loc, useI18n } from '../../../i18n/I18nContext';
import {
  ARMOR_DAMAGE_RESISTANCE_KEYS,
  STAT_LABELS,
  STAT_LOWER_IS_BETTER,
  STAT_PERCENT_KEYS,
} from '../../../types';
import type { Blueprint, ItemStats, NumericItemStatKey } from '../../../types';

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
        : ARMOR_METRICS;

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

  const metricKeys = getMetricKeys(blueprint, projectedStats).slice(0, 6);

  if (metricKeys.length < 3) {
    return (
      <Box component="section">
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}
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

  const baseSeries = metricKeys.map(() => 100);
  const buildSeries = metricKeys.map((key) =>
    getIndexedScore(key, blueprint.baseStats[key], projectedStats[key]),
  );

  const metrics = metricKeys.map((key) => ({
    name: loc(STAT_LABELS[key], lang) ?? key,
    min: 80,
    max: 120,
  }));

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
            sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", fontSize: '.85rem' }}
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

      <RadarChart
        height={260}
        hideLegend
        shape="sharp"
        margin={{ top: 28, bottom: 18, left: 28, right: 28 }}
        series={[
          {
            label: t('Base', 'Base'),
            data: baseSeries,
            color: alpha(theme.palette.text.secondary, 0.75),
          },
          {
            label: t('Current build', 'Build actuel'),
            data: buildSeries,
            color: theme.palette.primary.main,
            fillArea: true,
          },
        ]}
        radar={{
          metrics,
          startAngle: -90,
          labelGap: 14,
          labelFormatter: (label) =>
            String(label)
              .replace('Resistance', 'Res.')
              .replace('Smoothness', 'Smooth.')
              .replace('Handling', 'Handle.'),
        }}
        sx={{
          '& .MuiChartsLegend-root': { display: 'none' },
          '& .MuiChartsAxis-tickLabel, & .MuiRadarMetricLabels-root text': {
            fill: theme.palette.text.secondary,
            fontSize: 11,
            fontFamily: "'Khand', sans-serif",
          },
          '& .MuiRadarGrid-root line, & .MuiRadarGrid-root path, & .MuiRadarGrid-root polygon': {
            stroke: alpha(theme.palette.primary.main, 0.18),
          },
          '& .MuiRadarAxisHighlight-root': {
            fill: alpha(theme.palette.primary.main, 0.06),
          },
        }}
      />
    </Box>
  );
}
