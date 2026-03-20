import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FlagIcon from '@mui/icons-material/Flag';
import ShieldIcon from '@mui/icons-material/Shield';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SpeedIcon from '@mui/icons-material/Speed';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../ui/Button';
import { QualityScore } from './shared/QualityScore';
import { CombinedModifiers } from './shared/CombinedModifiers';
import { ResourceSummary } from './shared/ResourceSummary';
import { tokens } from '../../theme';
import { STAT_LABELS, ARMOR_DAMAGE_RESISTANCE_KEYS } from '../../types';
import type { Blueprint, ItemStats, AggregatedResource, MissionContract, ItemTab } from '../../types';

/* ─── StatBox ───────────────────────────────────────────────────────────── */

function StatBox({ label, value, unit, color, highlight }: { label: string; value: string | number; unit?: string; color?: string; highlight?: boolean }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
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
        backgroundColor: highlight 
          ? (isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)')
          : 'transparent',
        borderColor: highlight ? 'primary.main' : 'divider',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontFamily: "'Share Tech Mono', monospace", color: color || 'text.primary', lineHeight: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
        {value}
        {unit && <Typography component="span" variant="caption" sx={{ ml: 0.5, fontSize: '.6rem', opacity: 0.7 }}>{unit}</Typography>}
      </Typography>
    </Paper>
  );
}

/* ─── WeaponStatsDisplay ────────────────────────────────────────────────── */

function WeaponStatsDisplay({ stats, score }: { stats: ItemStats; score: number }) {
  const { t } = useI18n();
  const dps = stats.damage && stats.rateOfFire ? Math.round((stats.damage * stats.rateOfFire) / 60) : 0;

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
          <QualityScore score={score} />
        </Paper>
      </Grid>
      
      <Grid size={{ xs: 6, sm: 4 }}>
        <StatBox label="DPS" value={dps} color="primary.light" highlight />
      </Grid>
      
      <Grid size={{ xs: 6, sm: 4 }}>
        <StatBox label={t('Magazine', 'Chargeur')} value={stats.magazineSize ?? '—'} unit="rds" />
      </Grid>

      <Grid size={{ xs: 6, sm: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
          <TrackChangesIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '.6rem' }}>{t('Ideal Range', 'Portee ideale')}</Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.85rem' }}>{stats.idealCombatRange ?? stats.effectiveRange ?? '—'}m</Typography>
          </Box>
        </Box>
      </Grid>
      
      <Grid size={{ xs: 6, sm: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
          <SpeedIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '.6rem' }}>{t('Fire Rate', 'Cadence')}</Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.85rem' }}>{stats.rateOfFire ?? '—'} RPM</Typography>
          </Box>
        </Box>
      </Grid>
      
      <Grid size={{ xs: 12, sm: 6 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', height: '100%', px: 1 }}>
          {stats.weaponType && <Chip label={stats.weaponType} color="primary" variant="outlined" sx={{ height: 20, fontSize: '.6rem' }} />}
          {stats.ammoFlavor && <Chip label={stats.ammoFlavor} color="secondary" variant="outlined" sx={{ height: 20, fontSize: '.6rem' }} />}
          {stats.projectileSpeed && (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '.65rem', ml: 'auto' }}>
              {t('Muzzle Velocity', 'Vitesse sortie')}: {stats.projectileSpeed}m/s
            </Typography>
          )}
        </Box>
      </Grid>
    </Grid>
  );
}

/* ─── MagazineStatsDisplay ──────────────────────────────────────────────── */

function MagazineStatsDisplay({ stats, score }: { stats: ItemStats; score: number }) {
  const { t } = useI18n();

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
          <QualityScore score={score} />
        </Paper>
      </Grid>
      
      <Grid size={{ xs: 12, sm: 8 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <StatBox label={t('Capacity', 'Capacite')} value={stats.magazineSize ?? '—'} unit="rds" highlight />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '.6rem', mb: 0.5 }}>{t('Ammo Details', 'Details munitions')}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {stats.ammoType && <Chip label={stats.ammoType} size="small" variant="outlined" sx={{ height: 18, fontSize: '.55rem' }} />}
                {stats.ammoFlavor && <Chip label={stats.ammoFlavor} size="small" variant="outlined" color="secondary" sx={{ height: 18, fontSize: '.55rem' }} />}
              </Box>
            </Box>
          </Box>
        </Stack>
      </Grid>
    </Grid>
  );
}

/* ─── ArmorStatsDisplay ─────────────────────────────────────────────────── */

function ArmorStatsDisplay({ stats, score, category }: { stats: ItemStats; score: number; category: string }) {
  const { lang, t } = useI18n();
  
  const hasResistances = ARMOR_DAMAGE_RESISTANCE_KEYS.some(key => (stats[key] ?? 0) > 0);
  const isBackpack = category === 'fps-backpack';

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 3 }}>
        <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <QualityScore score={score} />
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, sm: 9 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {stats.armorType && <Chip label={stats.armorType} color="primary" variant="outlined" sx={{ height: 20, fontSize: '.6rem' }} />}
            {stats.armorSlot && <Chip label={stats.armorSlot} color="secondary" variant="outlined" sx={{ height: 20, fontSize: '.6rem' }} />}
          </Box>

          {hasResistances && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
                <ShieldIcon sx={{ fontSize: '0.9rem' }} /> {t('Resistances', 'Resistances')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
                {ARMOR_DAMAGE_RESISTANCE_KEYS.map((key) => {
                  const val = stats[key] ?? 0;
                  return (
                    <Paper key={key} variant="outlined" sx={{ p: 0.5, textAlign: 'center', borderColor: val > 0 ? tokens.borderStrong : tokens.border, backgroundColor: val > 0 ? 'rgba(52, 211, 153, 0.05)' : 'transparent' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.5rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {STAT_LABELS[key]?.[lang].replace(' Resist.', '')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '.7rem', color: val > 0 ? 'success.main' : 'text.disabled' }}>
                        {Math.round(val * 100)}%
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
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '.6rem' }}>{t('Temp. Range', 'Plage Temp.')}</Typography>
                <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.75rem' }}>
                  {stats.temperatureMin ?? '—'} / {stats.temperatureMax ?? '—'}°C
                </Typography>
              </Box>
            </Box>
            {!isBackpack && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DirectionsRunIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '.6rem' }}>{t('Mobility', 'Mobilite')}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.75rem', color: (stats.wearMovementMultiplier ?? 1) < 1 ? 'warning.main' : 'text.primary' }}>
                    {stats.wearMovementMultiplier ? `×${stats.wearMovementMultiplier.toFixed(2)}` : '1.00'}
                  </Typography>
                </Box>
              </Box>
            )}
            {isBackpack && (
               <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid', borderColor: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ fontSize: '.5rem', fontWeight: 800 }}>R</Typography>
                 </Box>
                 <Box>
                   <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '.6rem' }}>{t('Rad. Dissip.', 'Dissip. Rad.')}</Typography>
                   <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.75rem' }}>
                     {stats.radiationDissipation ?? '0'} mRem/s
                   </Typography>
                 </Box>
               </Box>
            )}
          </Box>
        </Stack>
      </Grid>
    </Grid>
  );
}

/* ─── OverviewTab ───────────────────────────────────────────────────────── */

interface OverviewTabProps {
  blueprint: Blueprint;
  qualityScore: number;
  projectedStats: ItemStats;
  requiredResources: AggregatedResource[];
  acquisitionContracts: MissionContract[];
  setActiveItemTab: (tab: ItemTab) => void;
  qty: number;
  setQty: (val: number) => void;
  onAddGoal: () => void;
  onAddToComparison: () => void;
  canAddToComparison: boolean;
  nextComparisonColor: string;
  comparisonCount: number;
  onOpenComparison: () => void;
}

export function OverviewTab({
  blueprint,
  qualityScore,
  projectedStats,
  requiredResources,
  acquisitionContracts,
  setActiveItemTab,
  qty,
  setQty,
  onAddGoal,
  onAddToComparison,
  canAddToComparison,
  nextComparisonColor,
  comparisonCount,
  onOpenComparison,
}: OverviewTabProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isWeapon = blueprint.category === 'fps-weapon';
  const isMagazine = blueprint.category === 'fps-magazine';
  const isArmor = ['fps-armor', 'fps-helmet', 'fps-undersuit', 'fps-backpack'].includes(blueprint.category);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '.1em', fontSize: '.65rem', fontWeight: 700 }}>
          {t('Performance Profile', 'Profil de performance')}
        </Typography>
        <Paper sx={{ p: 2, backgroundColor: isDark ? 'rgba(26, 34, 56, 0.4)' : 'rgba(0, 0, 0, 0.02)', border: `1px solid ${tokens.border}` }}>
          {isWeapon && <WeaponStatsDisplay stats={projectedStats} score={qualityScore} />}
          {isMagazine && <MagazineStatsDisplay stats={projectedStats} score={qualityScore} />}
          {isArmor && <ArmorStatsDisplay stats={projectedStats} score={qualityScore} category={blueprint.category} />}
          {!isWeapon && !isMagazine && !isArmor && (
             <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
               <QualityScore score={qualityScore} />
               <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                 {t('Standard utility item.', 'Objet utilitaire standard.')}
               </Typography>
             </Box>
          )}
        </Paper>
      </Box>

      <CombinedModifiers blueprint={blueprint} projectedStats={projectedStats} />
      
      <ResourceSummary entries={requiredResources} />

      {/* Acquisition summary in overview */}
      {acquisitionContracts.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }} component="section">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <FlagIcon sx={{ fontSize: '1rem' }} />
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", fontSize: '.85rem', color: 'text.primary' }}>
                  {t('Mission Sources', 'Sources de missions')}
                </Typography>
              </Box>
              <Chip label={acquisitionContracts.length} size="small" color="primary" sx={{ fontSize: '.6rem', height: 18, minWidth: 18 }} />
            </Box>
            <Button variant="ghost" size="sm" onClick={() => setActiveItemTab('acquisition')}>
              {t('View all contracts', 'Voir tous les contrats')} <ArrowForwardIcon sx={{ fontSize: '.8rem', ml: 0.5 }} />
            </Button>
          </Box>
        </Paper>
      )}

      <Divider />

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, border: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '.65rem' }}>{t('Qty', 'Qte')}</Typography>
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 40, textAlign: 'center', padding: '4px 0', fontSize: '.85rem' } } }}
            sx={{ 
              width: 48,
              '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } }
            }}
          />
        </Box>
        <Box sx={{ flex: 2 }}>
          <Button variant="gradient" size="md" fullWidth onClick={onAddGoal}>
            {t('Add to Planner', 'Ajouter au planificateur')}
          </Button>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Button variant="secondary" size="md" fullWidth
            onClick={onAddToComparison}
            disabled={!canAddToComparison}
            style={{ position: 'relative', overflow: 'hidden' } as React.CSSProperties}>
            {canAddToComparison && (
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: nextComparisonColor, mr: 0.5 }} aria-hidden="true" />
            )}
            <span>{t('Compare', 'Comparer')}</span>
            {!canAddToComparison && <Typography component="span" sx={{ fontSize: '.6rem', ml: 0.5, opacity: 0.6 }}>max 4</Typography>}
          </Button>
        </Box>
      </Box>
      
      {comparisonCount > 0 && (
        <Chip
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>{comparisonCount} {t('in comparison', 'en comparaison')}</span>
            </Box>
          }
          variant="outlined"
          onClick={onOpenComparison}
          aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonCount})`}
          sx={{ cursor: 'pointer', alignSelf: 'center' }}
        />
      )}
    </Stack>
  );
}
