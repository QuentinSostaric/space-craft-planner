import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import type { AcquisitionGraphEntry, AggregatedResource, Blueprint, ItemStats } from '../../types';
import { FONT_HEADING, FONT_MONO } from '../../theme';

interface BlueprintOverviewProps {
  blueprint: Blueprint;
  detailReady: boolean;
  qualityScore: number;
  projectedStats: ItemStats;
  acquisitionEntry: AcquisitionGraphEntry | null;
  acquisitionLoading: boolean;
  resources: AggregatedResource[];
  resourceDataLoading: boolean;
  dismantleTimeSecs: number;
  dismantleEfficiency: number;
}

type MetricTone = 'primary' | 'secondary' | 'success' | 'warning' | 'neutral';

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function getComplexity(
  slotCount: number,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (slotCount >= 5) {
    return t('Complex', 'Complexe');
  }

  if (slotCount >= 3) {
    return t('Standard', 'Standard');
  }

  return t('Simple', 'Simple');
}

function getPrimaryStatRatio(blueprint: Blueprint, projectedStats: ItemStats) {
  if (blueprint.category === 'fps-weapon') {
    const baseDps = ((blueprint.baseStats.damage ?? 0) * (blueprint.baseStats.rateOfFire ?? 0)) / 60;
    const projectedDps = ((projectedStats.damage ?? blueprint.baseStats.damage ?? 0) * (projectedStats.rateOfFire ?? blueprint.baseStats.rateOfFire ?? 0)) / 60;
    return baseDps > 0 ? projectedDps / baseDps : 1;
  }

  if (blueprint.category === 'ship-weapon') {
    const baseDps = blueprint.baseStats.burstDps
      ?? ((blueprint.baseStats.damage ?? 0) * (blueprint.baseStats.rateOfFire ?? 0)) / 60;
    const projectedDps = projectedStats.burstDps
      ?? ((projectedStats.damage ?? blueprint.baseStats.damage ?? 0) * (projectedStats.rateOfFire ?? blueprint.baseStats.rateOfFire ?? 0)) / 60;
    return baseDps > 0 ? projectedDps / baseDps : 1;
  }

  if (blueprint.category === 'fps-magazine') {
    const baseCapacity = blueprint.baseStats.magazineSize ?? 0;
    const projectedCapacity = projectedStats.magazineSize ?? baseCapacity;
    return baseCapacity > 0 ? projectedCapacity / baseCapacity : 1;
  }

  if (['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(blueprint.category)) {
    const baseMobility = blueprint.baseStats.wearMovementMultiplier ?? 1;
    const projectedMobility = projectedStats.wearMovementMultiplier ?? baseMobility;
    return baseMobility > 0 ? projectedMobility / baseMobility : 1;
  }

  const fallbackKeys: Array<keyof ItemStats> = [
    'powerGeneration',
    'coolantGeneration',
    'shieldMaxHealth',
    'quantumSpeed',
    'hullScrapingEfficiency',
    'tractorForce',
    'maxHealth',
  ];
  const key = fallbackKeys.find((candidate) => typeof blueprint.baseStats[candidate] === 'number');
  if (!key) {
    return 1;
  }

  const baseValue = blueprint.baseStats[key];
  const projectedValue = projectedStats[key] ?? baseValue;
  return typeof baseValue === 'number' && baseValue > 0 && typeof projectedValue === 'number'
    ? projectedValue / baseValue
    : 1;
}

function OverviewMetric({
  icon,
  label,
  value,
  helper,
  href,
  tone,
  loading = false,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper: ReactNode;
  href: string;
  tone: MetricTone;
  loading?: boolean;
  progress?: number;
}) {
  const theme = useTheme();
  const accentByTone: Record<MetricTone, string> = {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    neutral: theme.palette.text.secondary,
  };
  const accent = accentByTone[tone];

  return (
    <Box
      component="a"
      href={href}
      sx={{
        minWidth: 0,
        px: { xs: 1.2, md: 1.35 },
        py: { xs: 1.05, md: 1.15 },
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr)',
        gap: 1,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
        borderRight: {
          lg: `1px solid ${theme.palette.ui.border}`,
        },
        '&:nth-of-type(3n)': {
          borderRight: { sm: 'none', lg: `1px solid ${theme.palette.ui.border}` },
        },
        '&:last-of-type': {
          borderRight: 'none',
        },
        transition: 'background-color 150ms ease',
        '&:hover': {
          backgroundColor: alpha(accent, 0.055),
        },
        '&:focus-visible': {
          outline: `2px solid ${accent}`,
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
          border: `1px solid ${alpha(accent, 0.42)}`,
          backgroundColor: alpha(accent, 0.075),
        }}
      >
        {icon}
      </Box>
      <Stack spacing={0.45} sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.75rem',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_HEADING,
            fontSize: { xs: '1.24rem', md: '1.38rem' },
            fontWeight: 800,
            lineHeight: 0.95,
            color: loading ? 'text.secondary' : 'text.primary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {loading ? '...' : value}
        </Typography>
        {loading ? (
          <LinearProgress sx={{ height: 4, borderRadius: 999 }} />
        ) : progress != null ? (
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{
              width: 'min(100%, 116px)',
              height: 4,
              borderRadius: 999,
              backgroundColor: alpha(theme.palette.text.primary, 0.08),
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                backgroundColor: accent,
              },
            }}
          />
        ) : null}
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.text.primary, 0.62),
            fontFamily: FONT_MONO,
            fontSize: '0.75rem',
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {helper}
        </Typography>
      </Stack>
    </Box>
  );
}

export function BlueprintOverview({
  blueprint,
  detailReady,
  projectedStats,
}: BlueprintOverviewProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const projectedMultiplier = Math.round(getPrimaryStatRatio(blueprint, projectedStats) * 100);

  return (
    <Paper
      id="blueprint-overview"
      component="section"
      aria-label={t('Blueprint overview', 'Synthese blueprint')}
      sx={{
        overflow: 'hidden',
        scrollMarginTop: 66,
        border: `1px solid ${theme.palette.ui.border}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.97)} 100%)`,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        <OverviewMetric
          icon={<BuildOutlinedIcon sx={{ fontSize: 18 }} />}
          label={t('Difficulty', 'Difficulte')}
          value={getComplexity(blueprint.slots.length, t)}
          helper={
            blueprint.slots.length === 1
              ? t('1 configurable part', '1 composant configurable')
              : `${blueprint.slots.length} ${t('configurable parts', 'composants configurables')}`
          }
          href="#blueprint-craft"
          tone="warning"
          loading={!detailReady}
          progress={Math.min(100, 22 + blueprint.slots.length * 12)}
        />
        <OverviewMetric
          icon={<AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />}
          label={t('Craft Time', 'Temps craft')}
          value={formatDuration(blueprint.craftTimeSecs)}
          helper={t('Per fabrication', 'Par fabrication')}
          href="#blueprint-craft"
          tone="neutral"
          loading={!detailReady}
        />
        <OverviewMetric
          icon={<SpeedOutlinedIcon sx={{ fontSize: 18 }} />}
          label={t('Multiplier', 'Multiplicateur')}
          value={`${projectedMultiplier}%`}
          helper={t('Primary stat impact', 'Impact stat principale')}
          href="#blueprint-craft"
          tone="secondary"
          loading={!detailReady}
          progress={Math.min(100, projectedMultiplier)}
        />
      </Box>
    </Paper>
  );
}
