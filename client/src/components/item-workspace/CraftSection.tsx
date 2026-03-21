import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import ShieldIcon from '@mui/icons-material/Shield';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SpeedIcon from '@mui/icons-material/Speed';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../ui/Button';
import { SlotCard } from './shared/SlotCard';
import { QualityScore } from './shared/QualityScore';
import { CombinedModifiers } from './shared/CombinedModifiers';
import { ResourceSummary } from './shared/ResourceSummary';
import { ModifierSparkline } from './shared/ModifierSparkline';
import { tokens } from '../../theme';
import { STAT_LABELS, ARMOR_DAMAGE_RESISTANCE_KEYS, GPP_LABELS } from '../../types';
import type { Blueprint, ItemStats, AggregatedResource, GppModifier } from '../../types';

/* ─── Helpers ─── */

function StatBox({ label, value, unit, color, highlight }: { label: string; value: string | number; unit?: string; color?: string; highlight?: boolean }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        backgroundColor: highlight ? (isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)') : 'transparent',
        borderColor: highlight ? 'primary.main' : 'divider',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontFamily: "'Share Tech Mono', monospace", color: color || 'text.primary', lineHeight: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
        {value}
        {unit && <Typography component="span" variant="caption" sx={{ ml: 0.5, fontSize: '0.7rem', opacity: 0.7 }}>{unit}</Typography>}
      </Typography>
    </Paper>
  );
}

function deduplicateModifiers(slots: Blueprint['slots']): GppModifier[] {
  const seen = new Set<string>();
  const result: GppModifier[] = [];
  for (const slot of slots) {
    for (const mod of slot.modifiers) {
      const key = `${mod.gppId}|${mod.qualityStart}|${mod.qualityEnd}|${mod.modAtMin}|${mod.modAtMax}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(mod);
      }
    }
  }
  return result;
}

/* ─── CraftSection ─── */

interface CraftSectionProps {
  blueprint: Blueprint;
  slotAssignments: Record<string, number | undefined>;
  assignQuality: (slotId: string, value: number | undefined) => void;
  clearAssignments: () => void;
  qualityScore: number;
  projectedStats: ItemStats;
  requiredResources: AggregatedResource[];
}

export function CraftSection({
  blueprint,
  slotAssignments,
  assignQuality,
  clearAssignments,
  qualityScore,
  projectedStats,
  requiredResources,
}: CraftSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isWeapon = blueprint.category === 'fps-weapon';
  const isMagazine = blueprint.category === 'fps-magazine';
  const isArmor = ['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(blueprint.category);
  const isBackpack = blueprint.category === 'fps-backpack';
  const uniqueModifiers = deduplicateModifiers(blueprint.slots);
  const dps = projectedStats.damage && projectedStats.rateOfFire ? Math.round((projectedStats.damage * projectedStats.rateOfFire) / 60) : 0;

  function fillSlots(mode: 'max' | 'minimum') {
    for (const slot of blueprint.slots) {
      assignQuality(slot.id, mode === 'max' ? 1000 : (slot.minQuality ?? 0));
    }
  }

  return (
    <Box component="section" aria-label={t('Craft simulator', 'Simulateur de craft')} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Craft Simulator', 'Simulateur de Craft')}
      </Typography>

      {/* Stats panel */}
      <Paper sx={{ p: 2, backgroundColor: isDark ? 'rgba(26, 34, 56, 0.4)' : 'rgba(0, 0, 0, 0.02)', border: `1px solid ${tokens.border}` }}>
        {isWeapon && (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
                <QualityScore score={qualityScore} />
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBox label="DPS" value={dps} color="primary.light" highlight />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBox label={t('Magazine', 'Chargeur')} value={projectedStats.magazineSize ?? '—'} unit="rds" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                <TrackChangesIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>{t('Ideal Range', 'Portee ideale')}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.875rem' }}>{projectedStats.idealCombatRange ?? projectedStats.effectiveRange ?? '—'}m</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                <SpeedIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>{t('Fire Rate', 'Cadence')}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.875rem' }}>{projectedStats.rateOfFire ?? '—'} RPM</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', height: '100%', px: 1 }}>
                {projectedStats.weaponType && <Chip label={projectedStats.weaponType} color="primary" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />}
                {projectedStats.ammoFlavor && <Chip label={projectedStats.ammoFlavor} color="secondary" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />}
                {projectedStats.projectileSpeed && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem', ml: 'auto' }}>
                    {t('Muzzle Velocity', 'Vitesse sortie')}: {projectedStats.projectileSpeed}m/s
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        )}

        {isMagazine && (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
                <QualityScore score={qualityScore} />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <StatBox label={t('Capacity', 'Capacite')} value={projectedStats.magazineSize ?? '—'} unit="rds" highlight />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem', mb: 0.5 }}>{t('Ammo Details', 'Details munitions')}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {projectedStats.ammoType && <Chip label={projectedStats.ammoType} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />}
                      {projectedStats.ammoFlavor && <Chip label={projectedStats.ammoFlavor} size="small" variant="outlined" color="secondary" sx={{ height: 24, fontSize: '0.75rem' }} />}
                    </Box>
                  </Box>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        )}

        {isArmor && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QualityScore score={qualityScore} />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 9 }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {projectedStats.armorType && <Chip label={projectedStats.armorType} color="primary" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />}
                  {projectedStats.armorSlot && <Chip label={projectedStats.armorSlot} color="secondary" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />}
                </Box>
                {ARMOR_DAMAGE_RESISTANCE_KEYS.some(key => (projectedStats[key] ?? 0) > 0) && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
                      <ShieldIcon sx={{ fontSize: '0.9rem' }} /> {t('Resistances', 'Resistances')}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
                      {ARMOR_DAMAGE_RESISTANCE_KEYS.map((key) => {
                        const val = projectedStats[key] ?? 0;
                        return (
                          <Paper key={key} variant="outlined" sx={{ p: 0.5, textAlign: 'center', borderColor: val > 0 ? tokens.borderStrong : tokens.border, backgroundColor: val > 0 ? 'rgba(52, 211, 153, 0.05)' : 'transparent' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              {STAT_LABELS[key]?.[lang].replace(' Resist.', '')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '0.75rem', color: val > 0 ? 'success.main' : 'text.disabled' }}>
                              {Math.round((typeof val === 'number' ? val : 0) * 100)}%
                            </Typography>
                          </Paper>
                        );
                      })}
                    </Box>
                  </Box>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThermostatIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>{t('Temp. Range', 'Plage Temp.')}</Typography>
                      <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem' }}>
                        {projectedStats.temperatureMin ?? '—'} / {projectedStats.temperatureMax ?? '—'}°C
                      </Typography>
                    </Box>
                  </Box>
                  {!isBackpack && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DirectionsRunIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>{t('Mobility', 'Mobilite')}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem', color: (projectedStats.wearMovementMultiplier ?? 1) < 1 ? 'warning.main' : 'text.primary' }}>
                          {projectedStats.wearMovementMultiplier ? `×${projectedStats.wearMovementMultiplier.toFixed(2)}` : '1.00'}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {isBackpack && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid', borderColor: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 800 }}>R</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>{t('Rad. Dissip.', 'Dissip. Rad.')}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem' }}>
                          {projectedStats.radiationDissipation ?? '0'} mRem/s
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Stack>
            </Grid>
          </Grid>
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

      {/* GPP Modifier sparklines */}
      {uniqueModifiers.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {uniqueModifiers.map((mod, idx) => (
            <Box key={`${mod.gppId}-${idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                {GPP_LABELS[mod.gppId]?.[lang] ?? mod.gppId}
              </Typography>
              <ModifierSparkline modifier={mod} />
            </Box>
          ))}
        </Box>
      )}

      {/* Top bar: actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('max')}>{t('Max quality', 'Qualite max')}</Button>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('minimum')}>{t('Minimum valid', 'Minimum valide')}</Button>
          <Button variant="ghost" size="sm" onClick={clearAssignments}>{t('Clear', 'Effacer')}</Button>
        </Box>
      </Box>

      {/* Slot grid */}
      <Box>
        <Typography
          variant="h6"
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem',
            textTransform: 'uppercase', letterSpacing: '.06em', mb: 1,
          }}
        >
          <SettingsIcon sx={{ fontSize: '1rem' }} /> {t('Parts', 'Composants')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: `repeat(${Math.min(blueprint.slots.length, 3)}, 1fr)`,
              lg: `repeat(${Math.min(blueprint.slots.length, 4)}, 1fr)`,
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

      {/* Bottom: Modifiers + Resources */}
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2,
          '& > *': { p: 1.5, border: `1px solid ${tokens.border}`, backgroundColor: tokens.surface1 },
        }}
      >
        <CombinedModifiers blueprint={blueprint} projectedStats={projectedStats} />
        <ResourceSummary entries={requiredResources} />
      </Box>
    </Box>
  );
}
