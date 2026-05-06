import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RecyclingOutlinedIcon from '@mui/icons-material/RecyclingOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import type { AcquisitionGraphEntry, AggregatedResource, Blueprint, ItemStats } from '../../types';
import { formatProbabilityPercent, formatResourceQuantity } from '../../utils/crafting';
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

type OverviewTone = 'craft' | 'acquisition' | 'materials' | 'dismantle';

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function getPrimaryCraftMetric(
  blueprint: Blueprint,
  projectedStats: ItemStats,
  qualityScore: number,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (blueprint.category === 'fps-weapon') {
    const dps =
      projectedStats.damage && projectedStats.rateOfFire
        ? Math.round((projectedStats.damage * projectedStats.rateOfFire) / 60)
        : 0;
    return {
      label: 'DPS',
      value: dps > 0 ? String(dps) : '-',
      helper: `${formatMinutes(blueprint.craftTimeSecs)} ${t('craft', 'craft')}`,
    };
  }

  if (blueprint.category === 'fps-magazine') {
    return {
      label: t('Capacity', 'Capacite'),
      value: projectedStats.magazineSize != null ? String(projectedStats.magazineSize) : '-',
      helper: `${formatMinutes(blueprint.craftTimeSecs)} ${t('craft', 'craft')}`,
    };
  }

  if (['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(blueprint.category)) {
    const mobility =
      typeof projectedStats.wearMovementMultiplier === 'number'
        ? `x${projectedStats.wearMovementMultiplier.toFixed(2)}`
        : '-';
    return {
      label: blueprint.category === 'fps-backpack' ? t('Radiation', 'Radiation') : t('Mobility', 'Mobilite'),
      value: blueprint.category === 'fps-backpack' ? String(projectedStats.radiationDissipation ?? 0) : mobility,
      helper: `${formatMinutes(blueprint.craftTimeSecs)} ${t('craft', 'craft')}`,
    };
  }

  return {
    label: t('Build index', 'Indice craft'),
    value: String(qualityScore),
    helper: `${formatMinutes(blueprint.craftTimeSecs)} ${t('craft', 'craft')}`,
  };
}

function getMaterialsSummary(
  resources: AggregatedResource[],
  lang: ReturnType<typeof useI18n>['lang'],
  t: ReturnType<typeof useI18n>['t'],
) {
  if (resources.length === 0) {
    return {
      value: '-',
      helper: t('No required materials', 'Aucun materiau requis'),
    };
  }

  const scuTotal = resources
    .filter((resource) => resource.quantityUnit === 'scu')
    .reduce((total, resource) => total + resource.totalScu, 0);
  const countTotal = resources
    .filter((resource) => resource.quantityUnit === 'count')
    .reduce((total, resource) => total + resource.totalScu, 0);
  const hasMixed = resources.some((resource) => resource.quantityUnit === 'mixed');
  const totals = [
    countTotal > 0 ? formatResourceQuantity(countTotal, 'count', lang) : null,
    scuTotal > 0 ? formatResourceQuantity(scuTotal, 'scu', lang) : null,
  ].filter(Boolean);
  const leadResources = resources
    .slice(0, 2)
    .map((resource) => resource.resourceName)
    .join(' / ');

  return {
    value: hasMixed || totals.length === 0
      ? `${resources.length} ${t('resources', 'ressources')}`
      : totals.join(' / '),
    helper: leadResources || `${resources.length} ${t('resources', 'ressources')}`,
  };
}

function OverviewTile({
  icon,
  label,
  value,
  helper,
  href,
  tone,
  loading = false,
  chips = [],
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper: ReactNode;
  href: string;
  tone: OverviewTone;
  loading?: boolean;
  chips?: string[];
}) {
  const theme = useTheme();
  const accentByTone: Record<OverviewTone, string> = {
    craft: theme.palette.primary.main,
    acquisition: theme.palette.secondary.main,
    materials: theme.palette.success.main,
    dismantle: theme.palette.warning.main,
  };
  const accent = accentByTone[tone];

  return (
    <Paper
      component="a"
      href={href}
      variant="outlined"
      sx={{
        position: 'relative',
        minWidth: 0,
        minHeight: { xs: 128, md: 142 },
        p: { xs: 1.25, md: 1.45 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        borderColor: alpha(accent, 0.26),
        background: `linear-gradient(160deg, ${alpha(accent, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 56%, ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.18 : 0.04)} 100%)`,
        transition: 'border-color 150ms, background-color 150ms, transform 150ms',
        '&:hover': {
          borderColor: alpha(accent, 0.58),
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${accent}`,
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: 10,
          top: 10,
          color: alpha(accent, 0.2),
          lineHeight: 0,
          pointerEvents: 'none',
        }}
      >
        {icon}
      </Box>

      <Stack spacing={0.85} sx={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontSize: '0.62rem',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_HEADING,
            fontSize: { xs: '1.55rem', md: '1.85rem' },
            fontWeight: 800,
            lineHeight: 0.9,
            color: loading ? 'text.secondary' : 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {loading ? '...' : value}
        </Typography>
        {loading && <LinearProgress sx={{ height: 4, borderRadius: 999 }} />}
      </Stack>

      <Stack spacing={0.75} sx={{ position: 'relative', zIndex: 1, minWidth: 0, mt: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.text.primary, 0.68),
            fontFamily: FONT_MONO,
            fontSize: '0.66rem',
            lineHeight: 1.35,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {helper}
        </Typography>
        {chips.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {chips.slice(0, 2).map((chip) => (
              <Chip
                key={chip}
                label={chip}
                size="small"
                variant="outlined"
                sx={{
                  height: 22,
                  maxWidth: '100%',
                  borderRadius: 1,
                  borderColor: alpha(accent, 0.34),
                  color: alpha(theme.palette.text.primary, 0.76),
                  '& .MuiChip-label': {
                    fontSize: '0.58rem',
                    fontWeight: 700,
                  },
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export function BlueprintOverview({
  blueprint,
  detailReady,
  qualityScore,
  projectedStats,
  acquisitionEntry,
  acquisitionLoading,
  resources,
  resourceDataLoading,
  dismantleTimeSecs,
  dismantleEfficiency,
}: BlueprintOverviewProps) {
  const { lang, t } = useI18n();
  const craftMetric = getPrimaryCraftMetric(blueprint, projectedStats, qualityScore, t);
  const materialSummary = getMaterialsSummary(resources, lang, t);
  const acquisitionLocalities = acquisitionEntry?.localities.slice(0, 2) ?? [];
  const recoveryPercent = Math.round(dismantleEfficiency * 100);

  return (
    <Box
      component="section"
      aria-label={t('Blueprint overview', 'Synthese blueprint')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        alignItems={{ xs: 'flex-start', sm: 'baseline' }}
        justifyContent="space-between"
      >
        <Typography variant="overline" sx={{ display: 'block' }}>
          {t('Blueprint Overview', 'Synthese blueprint')}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.62rem',
          }}
        >
          {blueprint.manufacturer}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1,
        }}
      >
        <OverviewTile
          icon={<BuildOutlinedIcon sx={{ fontSize: 52 }} />}
          label={craftMetric.label}
          value={craftMetric.value}
          helper={craftMetric.helper}
          href="#blueprint-craft"
          tone="craft"
          loading={!detailReady}
          chips={[
            `${qualityScore}/1000`,
            blueprint.slots.length === 1
              ? t('1 part', '1 composant')
              : `${blueprint.slots.length} ${t('parts', 'composants')}`,
          ]}
        />
        <OverviewTile
          icon={<FlagOutlinedIcon sx={{ fontSize: 52 }} />}
          label={t('Acquisition', 'Acquisition')}
          value={acquisitionEntry ? formatProbabilityPercent(acquisitionEntry.dropScore) : '-'}
          helper={
            acquisitionLoading
              ? t('Loading mission data', 'Chargement missions')
              : acquisitionEntry
              ? `${acquisitionEntry.contractCount} ${t('contracts', 'contrats')} / ${acquisitionEntry.factionCount} ${t('factions', 'factions')}`
              : t('No mission source', 'Aucune source mission')
          }
          href="#blueprint-acquisition"
          tone="acquisition"
          loading={acquisitionLoading}
          chips={acquisitionLocalities}
        />
        <OverviewTile
          icon={<Inventory2OutlinedIcon sx={{ fontSize: 52 }} />}
          label={t('Materials', 'Materiaux')}
          value={materialSummary.value}
          helper={!detailReady ? t('Loading requirements', 'Chargement requis') : materialSummary.helper}
          href="#blueprint-materials"
          tone="materials"
          loading={!detailReady || (resourceDataLoading && resources.length > 0)}
          chips={[
            resources.length === 1
              ? t('1 resource', '1 ressource')
              : `${resources.length} ${t('resources', 'ressources')}`,
          ]}
        />
        <OverviewTile
          icon={<RecyclingOutlinedIcon sx={{ fontSize: 52 }} />}
          label={t('Dismantling', 'Demontage')}
          value={dismantleTimeSecs > 0 ? `${recoveryPercent}%` : '-'}
          helper={
            dismantleTimeSecs > 0
              ? `${dismantleTimeSecs}s ${t('per job', 'par job')}`
              : t('No dismantling data', 'Aucune donnee demontage')
          }
          href="#blueprint-dismantling"
          tone="dismantle"
          loading={!detailReady}
          chips={dismantleTimeSecs > 0 ? [t('Same quality', 'Meme qualite')] : []}
        />
      </Box>
    </Box>
  );
}
