import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import ShieldIcon from '@mui/icons-material/Shield';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { loc, useI18n } from '../../i18n/I18nContext';
import { ARMOR_DAMAGE_RESISTANCE_KEYS, STAT_LABELS } from '../../types';
import type { Blueprint, ItemStats } from '../../types';
import { Button } from '../ui/Button';
import { SlotCard } from './shared/SlotCard';
import { CombinedModifiers } from './shared/CombinedModifiers';
import { QualityScore } from './shared/QualityScore';
import { StatImpactRadar } from './shared/StatImpactRadar';

function StatBox({
  label,
  value,
  unit,
  color,
  highlight,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  highlight?: boolean;
}) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: highlight ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
        borderColor: highlight ? 'primary.main' : 'divider',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
          mb: 0.5,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{
          fontFamily: "'Share Tech Mono', monospace",
          color: color || 'text.primary',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
        }}
      >
        {value}
        {unit && (
          <Typography
            component="span"
            variant="caption"
            sx={{ ml: 0.5, fontSize: '0.7rem', opacity: 0.7 }}
          >
            {unit}
          </Typography>
        )}
      </Typography>
    </Paper>
  );
}

interface CraftSectionProps {
  blueprint: Blueprint;
  slotAssignments: Record<string, number | undefined>;
  assignQuality: (slotId: string, value: number | undefined) => void;
  clearAssignments: () => void;
  qualityScore: number;
  projectedStats: ItemStats;
}

export function CraftSection({
  blueprint,
  slotAssignments,
  assignQuality,
  clearAssignments,
  qualityScore,
  projectedStats,
}: CraftSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();

  const isWeapon = blueprint.category === 'fps-weapon';
  const isMagazine = blueprint.category === 'fps-magazine';
  const isArmor = ['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(
    blueprint.category,
  );
  const isBackpack = blueprint.category === 'fps-backpack';
  const dps =
    projectedStats.damage && projectedStats.rateOfFire
      ? Math.round((projectedStats.damage * projectedStats.rateOfFire) / 60)
      : 0;

  const fillSlots = useCallback((mode: 'max' | 'minimum') => {
    for (const slot of blueprint.slots) {
      assignQuality(slot.id, mode === 'max' ? 1000 : (slot.minQuality ?? 0));
    }
  }, [blueprint.slots, assignQuality]);

  const rangeValue = projectedStats.idealCombatRange ?? projectedStats.effectiveRange ?? '-';
  const fireRateValue = projectedStats.rateOfFire ?? '-';
  const magazineValue = projectedStats.magazineSize ?? '-';
  const tempMinValue = projectedStats.temperatureMin ?? '-';
  const tempMaxValue = projectedStats.temperatureMax ?? '-';
  const mobilityValue =
    typeof projectedStats.wearMovementMultiplier === 'number'
      ? projectedStats.wearMovementMultiplier.toFixed(2)
      : '1.00';
  const radiationValue = projectedStats.radiationDissipation ?? 0;

  return (
    <Box
      component="section"
      aria-label={t('Craft simulator', 'Simulateur de craft')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Craft Simulator', 'Simulateur de craft')}
      </Typography>

      <Paper
        sx={{
          p: { xs: 1.5, md: 2 },
          backgroundColor: theme.palette.ui.surface2,
          border: `1px solid ${theme.palette.ui.border}`,
        }}
      >
        {isWeapon && (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <QualityScore score={qualityScore} />
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatBox label="DPS" value={dps} color="primary.light" highlight />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatBox label={t('Fire Rate', 'Cadence')} value={fireRateValue} unit="RPM" />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <StatBox label={t('Range', 'Portee')} value={rangeValue} unit="m" />
            </Grid>
          </Grid>
        )}

        {isMagazine && (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <QualityScore score={qualityScore} />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <StatBox label={t('Capacity', 'Capacite')} value={magazineValue} unit="rds" />
            </Grid>
          </Grid>
        )}

        {isArmor && (
          <Stack spacing={1.5}>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QualityScore score={qualityScore} />
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <StatBox label={t('Temp. Min', 'Temp. min')} value={tempMinValue} unit="C" />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <StatBox label={t('Temp. Max', 'Temp. max')} value={tempMaxValue} unit="C" />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <StatBox
                  label={
                    isBackpack
                      ? t('Radiation', 'Radiation')
                      : t('Mobility', 'Mobilite')
                  }
                  value={isBackpack ? radiationValue : mobilityValue}
                  unit={isBackpack ? 'mRem/s' : 'x'}
                />
              </Grid>
            </Grid>

            {ARMOR_DAMAGE_RESISTANCE_KEYS.some((key) => (projectedStats[key] ?? 0) > 0) && (
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    fontFamily: "'Khand', sans-serif",
                    mb: 0.75,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  <ShieldIcon sx={{ fontSize: '0.9rem' }} />
                  {t('Resistances', 'Resistances')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
                    gap: 0.5,
                  }}
                >
                  {ARMOR_DAMAGE_RESISTANCE_KEYS.map((key) => {
                    const value = projectedStats[key] ?? 0;
                    return (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{
                          p: 0.5,
                          textAlign: 'center',
                          borderColor:
                            value > 0 ? theme.palette.ui.borderStrong : theme.palette.ui.border,
                          backgroundColor:
                            value > 0 ? alpha(theme.palette.success.main, 0.05) : 'transparent',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.65rem',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                          }}
                        >
                          {loc(STAT_LABELS[key], lang).replace(' Resist.', '').replace('Resist. ', '')}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: value > 0 ? 'success.main' : 'text.disabled',
                          }}
                        >
                          {Math.round((typeof value === 'number' ? value : 0) * 100)}%
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </Box>
            )}

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                  <ThermostatIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}
                    >
                      {t('Climate Profile', 'Profil climatique')}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem' }}
                    >
                      {tempMinValue} / {tempMaxValue} C
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                  <DirectionsRunIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}
                    >
                      {isBackpack ? t('Radiation', 'Radiation') : t('Mobility', 'Mobilite')}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem' }}
                    >
                      {isBackpack ? `${radiationValue} mRem/s` : `x${mobilityValue}`}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        )}

        {!isWeapon && !isMagazine && !isArmor && (
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <QualityScore score={qualityScore} />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              {t('Standard utility item.', 'Objet utilitaire standard.')}
            </Typography>
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('max')}>
            {t('Max quality', 'Qualite max')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('minimum')}>
            {t('Minimum valid', 'Minimum valide')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAssignments}>
            {t('Clear', 'Effacer')}
          </Button>
        </Box>
      </Box>

      <Box>
        <Typography
          variant="h6"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: '.9rem',
            letterSpacing: '.06em',
            mb: 1,
          }}
        >
          <SettingsIcon sx={{ fontSize: '1rem' }} />
          {t('Parts', 'Composants')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: `repeat(${Math.min(blueprint.slots.length, 4)}, 1fr)`,
              xl: `repeat(${Math.min(blueprint.slots.length, 5)}, 1fr)`,
            },
            gap: 1,
          }}
        >
          {blueprint.slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              qualityValue={slotAssignments[slot.id]}
              onQualityChange={(value) => assignQuality(slot.id, value)}
              category={blueprint.category}
            />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)' },
          gap: 2,
        }}
      >
        <Box
          sx={{
            p: 1.5,
            border: `1px solid ${theme.palette.ui.border}`,
            backgroundColor: theme.palette.ui.surface1,
          }}
        >
          <CombinedModifiers blueprint={blueprint} projectedStats={projectedStats} />
        </Box>

        <Box
          sx={{
            p: 1.5,
            border: `1px solid ${theme.palette.ui.border}`,
            backgroundColor: theme.palette.ui.surface1,
          }}
        >
          <StatImpactRadar blueprint={blueprint} projectedStats={projectedStats} />
        </Box>
      </Box>
    </Box>
  );
}
