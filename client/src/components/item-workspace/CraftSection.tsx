import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { useI18n } from '../../i18n/I18nContext';
import type { Blueprint, ItemStats } from '../../types';
import { Button } from '../ui/Button';
import { SlotCard } from './shared/SlotCard';
import { CombinedModifiers } from './shared/CombinedModifiers';
import { StatImpactRadar } from './shared/StatImpactRadar';
import { FONT_HEADING, FONT_MONO } from '../../theme';

interface CraftSectionProps {
  blueprint: Blueprint;
  slotAssignments: Record<string, number | undefined>;
  assignQuality: (slotId: string, value: number | undefined) => void;
  clearAssignments: () => void;
  qualityScore: number;
  projectedStats: ItemStats;
}

function QualityDial({ score }: { score: number }) {
  const { t } = useI18n();
  const theme = useTheme();
  const progress = Math.max(0, Math.min(100, score));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <Box sx={{ position: 'relative', width: 'min(100%, 230px)', aspectRatio: '230 / 150' }}>
        <svg viewBox="0 0 230 150" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="quality-dial-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={theme.palette.primary.main} />
              <stop offset="100%" stopColor={theme.palette.primary.light} />
            </linearGradient>
          </defs>
          <path
            d="M 32 118 A 83 83 0 0 1 198 118"
            fill="none"
            stroke={alpha(theme.palette.text.primary, 0.12)}
            strokeWidth="10"
            strokeLinecap="butt"
            pathLength={100}
          />
          <path
            d="M 32 118 A 83 83 0 0 1 198 118"
            fill="none"
            stroke="url(#quality-dial-gradient)"
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={`${progress} 100`}
            pathLength={100}
          />
        </svg>
        <Box
          sx={{
            position: 'absolute',
            inset: '42px 0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              fontFamily: FONT_HEADING,
              fontSize: { xs: '2.65rem', md: '3rem' },
              fontWeight: 800,
              lineHeight: 0.85,
            }}
          >
            {score}
            <Typography component="span" sx={{ ml: 0.25, fontFamily: FONT_HEADING, fontSize: '1.2rem', fontWeight: 800 }}>
              %
            </Typography>
          </Typography>
          <Typography
            variant="caption"
            sx={{
              mt: 0.65,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '0.62rem',
            }}
          >
            {t('Final Quality', 'Qualite finale')}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          mt: -1.2,
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'text.disabled',
        }}
      >
        <Typography variant="caption" sx={{ fontSize: '0.62rem' }}>0%</Typography>
        <Typography variant="caption" sx={{ fontSize: '0.62rem' }}>100%</Typography>
      </Box>
    </Box>
  );
}

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        px: 0.9,
        py: 0.75,
        minWidth: 0,
        backgroundColor: alpha(theme.palette.background.default, 0.22),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.disabled',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: '0.58rem',
          lineHeight: 1.15,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.4,
          fontFamily: FONT_MONO,
          fontWeight: 800,
          fontSize: '0.88rem',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
        {unit && (
          <Typography component="span" sx={{ ml: 0.35, color: 'text.secondary', fontSize: '0.62rem' }}>
            {unit}
          </Typography>
        )}
      </Typography>
    </Paper>
  );
}

function getKeyStats(
  blueprint: Blueprint,
  projectedStats: ItemStats,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (blueprint.category === 'fps-weapon') {
    const dps =
      projectedStats.damage && projectedStats.rateOfFire
        ? Math.round((projectedStats.damage * projectedStats.rateOfFire) / 60)
        : 0;
    return [
      { label: 'DPS', value: dps > 0 ? dps : '-' },
      { label: t('Fire Rate', 'Cadence'), value: projectedStats.rateOfFire ?? '-', unit: 'RPM' },
      { label: t('Range', 'Portee'), value: projectedStats.idealCombatRange ?? projectedStats.effectiveRange ?? '-', unit: 'm' },
    ];
  }

  if (blueprint.category === 'fps-magazine') {
    return [
      { label: t('Capacity', 'Capacite'), value: projectedStats.magazineSize ?? '-', unit: 'rds' },
    ];
  }

  if (['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(blueprint.category)) {
    const mobility =
      typeof projectedStats.wearMovementMultiplier === 'number'
        ? projectedStats.wearMovementMultiplier.toFixed(2)
        : '1.00';
    return [
      { label: t('Temp. Min', 'Temp. min'), value: projectedStats.temperatureMin ?? '-', unit: 'C' },
      { label: t('Temp. Max', 'Temp. max'), value: projectedStats.temperatureMax ?? '-', unit: 'C' },
      { label: blueprint.category === 'fps-backpack' ? t('Radiation', 'Radiation') : t('Mobility', 'Mobilite'), value: blueprint.category === 'fps-backpack' ? projectedStats.radiationDissipation ?? 0 : mobility, unit: blueprint.category === 'fps-backpack' ? 'mRem/s' : 'x' },
    ];
  }

  return [
    { label: t('Build index', 'Indice craft'), value: `${projectedStats.maxHealth ?? '-'}` },
  ];
}

export function CraftSection({
  blueprint,
  slotAssignments,
  assignQuality,
  clearAssignments,
  qualityScore,
  projectedStats,
}: CraftSectionProps) {
  const { t } = useI18n();
  const theme = useTheme();

  const fillSlots = useCallback((mode: 'max' | 'minimum') => {
    for (const slot of blueprint.slots) {
      assignQuality(slot.id, mode === 'max' ? 1000 : (slot.minQuality ?? 0));
    }
  }, [blueprint.slots, assignQuality]);

  const validAssignedCount = blueprint.slots.filter((slot) => {
    const value = slotAssignments[slot.id];
    return value !== undefined && (slot.minQuality == null || value >= slot.minQuality);
  }).length;
  const allPartsValid = validAssignedCount === blueprint.slots.length;
  const keyStats = getKeyStats(blueprint, projectedStats, t);

  return (
    <Box
      id="blueprint-craft"
      component="section"
      aria-label={t('Craft simulator', 'Simulateur de craft')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, scrollMarginTop: 66 }}
    >
      <Paper
        sx={{
          overflow: 'hidden',
          border: `1px solid ${theme.palette.ui.border}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.ui.surface2, 0.72)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        }}
      >
        <Box
          sx={{
            px: { xs: 1.15, md: 1.35 },
            py: 1,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
            borderBottom: `1px solid ${theme.palette.ui.border}`,
          }}
        >
          <Stack spacing={0.35}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.62rem',
                lineHeight: 1.15,
              }}
            >
              {blueprint.slots.length === 1
                ? t('1 configurable part', '1 composant configurable')
                : `${blueprint.slots.length} ${t('configurable parts', 'composants configurables')}`}
            </Typography>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              gap: 0.45,
              flexWrap: 'wrap',
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              p: 0.35,
              borderColor: alpha(theme.palette.primary.main, 0.18),
              backgroundColor: alpha(theme.palette.background.default, 0.22),
            }}
          >
            <Button variant="ghost" size="sm" onClick={() => fillSlots('max')}>
              {t('Max quality', 'Qualite max')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fillSlots('minimum')}>
              {t('Minimum valid', 'Minimum valide')}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAssignments}>
              {t('Clear', 'Effacer')}
            </Button>
          </Paper>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '270px minmax(0, 1fr)' },
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              p: { xs: 1.25, md: 1.45 },
              borderRight: { lg: `1px solid ${theme.palette.ui.border}` },
              borderBottom: { xs: `1px solid ${theme.palette.ui.border}`, lg: 'none' },
              background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.055)}, ${alpha(theme.palette.background.default, 0.12)})`,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                mb: 0.8,
              }}
            >
              {t('Quality', 'Qualite')}
            </Typography>
            <QualityDial score={qualityScore} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 0.7,
                mt: 1.2,
              }}
            >
              {keyStats.slice(0, 4).map((stat) => (
                <MiniStat
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  unit={stat.unit}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ minWidth: 0, p: { xs: 1, md: 1.2 } }}>
            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns: 'minmax(210px, 0.92fr) minmax(220px, 1fr) 74px minmax(92px, 118px) 34px',
                alignItems: 'center',
                gap: 1,
                px: 1,
                pb: 0.75,
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.62rem' }}>
                {t('Parts', 'Composants')}
              </Typography>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.62rem' }}>
                {t('Quality', 'Qualite')}
              </Typography>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.62rem', textAlign: 'right' }}>
                {t('Value', 'Valeur')}
              </Typography>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.62rem', textAlign: 'center' }}>
                {t('Qty', 'Qte')}
              </Typography>
              <Box />
            </Box>
            <Stack spacing={0.65}>
              {blueprint.slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  qualityValue={slotAssignments[slot.id]}
                  onQualityChange={(value) => assignQuality(slot.id, value)}
                  category={blueprint.category}
                />
              ))}
            </Stack>

            <Box
              sx={{
                mt: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
                color: 'text.secondary',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                {t('Total parts', 'Total composants')}: <Box component="span" sx={{ color: allPartsValid ? 'success.main' : 'text.primary', fontWeight: 800 }}>{validAssignedCount}</Box> / {blueprint.slots.length}
              </Typography>
              <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: allPartsValid ? 'success.main' : 'text.disabled' }}>
                <CheckCircleOutlineIcon sx={{ fontSize: '0.98rem' }} />
                <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                  {allPartsValid ? t('All parts valid', 'Tous les composants valides') : t('Waiting for valid parts', 'Composants valides attendus')}
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper
        component="section"
        aria-label={t('Advanced impact', 'Impact avance')}
        sx={{
          overflow: 'hidden',
          border: `1px solid ${theme.palette.ui.border}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.035)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        }}
      >
        <Box
          sx={{
            px: { xs: 1.15, md: 1.35 },
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.6,
            borderBottom: `1px solid ${theme.palette.ui.border}`,
          }}
        >
          <TuneOutlinedIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
          <Typography variant="overline" sx={{ lineHeight: 1 }}>
            {t('Advanced impact', 'Impact avance')}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)' },
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              p: { xs: 1.15, md: 1.35 },
              borderRight: { lg: `1px solid ${theme.palette.ui.border}` },
              borderBottom: { xs: `1px solid ${theme.palette.ui.border}`, lg: 'none' },
            }}
          >
            <CombinedModifiers blueprint={blueprint} projectedStats={projectedStats} />
          </Box>

          <Box sx={{ p: { xs: 1.15, md: 1.35 } }}>
            <StatImpactRadar blueprint={blueprint} projectedStats={projectedStats} />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
