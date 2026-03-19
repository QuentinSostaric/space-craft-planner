import { useEffect, useMemo, useState } from 'react';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MuiBadge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import FlagIcon from '@mui/icons-material/Flag';
import SettingsIcon from '@mui/icons-material/Settings';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import { useCraft } from '../store/CraftContext';
import { useI18n, loc } from '../i18n/I18nContext';
import { useCraftSimulator, gppModifier } from '../hooks/useCraftSimulator';
import { CategoryBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { ResourceIcon } from './ui/ResourceIcon';
import { tokens } from '../theme';
import {
  COMPARISON_COLORS,
  GPP_LABELS,
  STAT_LABELS,
  STAT_LOWER_IS_BETTER,
} from '../types';
import type {
  AggregatedResource,
  ItemStats,
  ItemTab,
  MaterialSlot,
  MissionContract,
} from '../types';
import {
  aggregateBlueprintResources,
  clampQualityValue,
  findMissionContractsForBlueprint,
  formatLocations,
  formatScaleLabel,
  formatStanding,
  summarizeAssignedQualities,
} from '../utils/crafting';

/* ─── SlotCard (craft tab) ──────────────────────────────────────────────── */

function SlotCard({
  slot,
  qualityValue,
  onQualityChange,
}: {
  slot: MaterialSlot;
  qualityValue: number | undefined;
  onQualityChange: (value: number | undefined) => void;
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
        return { gppId: modifier.gppId, label, pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
      })
      .filter(Boolean);
  }, [isAssigned, lang, qualityValue, slot.modifiers]);

  return (
    <Card
      sx={{
        backgroundColor: isAssigned ? tokens.surface2 : tokens.surface1,
        borderColor: isAssigned ? tokens.borderStrong : tokens.border,
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ResourceIcon name={slot.requiredResource} size={20} />
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", flex: 1 }}>
            {loc(slot.label, lang)}
          </Typography>
          {slot.minQuality != null && slot.minQuality > 0 && (
            <Typography
              variant="caption"
              sx={{ color: 'warning.main', fontFamily: "'Share Tech Mono', monospace" }}
              title={t(`Minimum quality ${slot.minQuality}`, `Qualite minimale ${slot.minQuality}`)}
            >
              Min {slot.minQuality}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '.6rem', letterSpacing: '.1em' }}>
              {t('RESOURCE', 'RESSOURCE')}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '.78rem' }}>{slot.requiredResource}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '.6rem', letterSpacing: '.1em' }}>SCU</Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.78rem' }}>
              {slot.quantityScu}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '.6rem', letterSpacing: '.1em' }}>
              {t('ASSIGNED QUALITY', 'QUALITE ASSIGNEE')}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 600 }}>
              {isAssigned ? Math.round(currentQuality) : t('None', 'Aucune')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Slider
              min={0}
              max={1000}
              value={currentQuality}
              onChange={(_e, val) => onQualityChange(clampQualityValue(val as number))}
              aria-label={t(`Quality slider for ${slot.requiredResource}`, `Curseur de qualite pour ${slot.requiredResource}`)}
              sx={{ flex: 1 }}
              size="small"
            />
            <TextField
              type="number"
              size="small"
              value={currentQuality}
              onChange={(e) => onQualityChange(clampQualityValue(Number(e.target.value)))}
              slotProps={{ htmlInput: { min: 0, max: 1000, style: { width: 48, textAlign: 'center', padding: '4px 6px' } } }}
              aria-label={t(`Quality value for ${slot.requiredResource}`, `Valeur de qualite pour ${slot.requiredResource}`)}
              sx={{ width: 64 }}
            />
            <IconButton
              onClick={() => onQualityChange(undefined)}
              aria-label={t(`Clear quality for ${slot.requiredResource}`, `Effacer la qualite pour ${slot.requiredResource}`)}
              size="small"
              sx={{ fontSize: '.65rem' }}
            >
              <CloseIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
        </Box>
        {modifiers.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {modifiers.map((m) => (
              <Typography
                key={m.gppId}
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.25,
                  border: `1px solid ${tokens.border}`,
                  fontSize: '.62rem',
                  color: m.isNeutral ? 'text.secondary' : m.isImproved ? 'success.main' : 'error.main',
                }}
              >
                {m.label} <strong>{m.pct > 0 ? '+' : ''}{m.pct.toFixed(2)}%</strong>
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── QualityScore ring ─────────────────────────────────────────────────── */

const TIER_COLORS: Record<string, string> = {
  excellent: tokens.success,
  good: tokens.blue,
  fair: tokens.warning,
  poor: tokens.danger,
};

function QualityScore({ score }: { score: number }) {
  const { t } = useI18n();
  const tier = score >= 80 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'fair' : 'poor';
  const labels = {
    excellent: t('Excellent', 'Excellent'),
    good: t('Good', 'Bon'),
    fair: t('Fair', 'Moyen'),
    poor: t('Poor', 'Faible'),
  };
  const tierColor = TIER_COLORS[tier];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} aria-label={`${t('Build index', 'Indice de build')}: ${score}/100`}>
      <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg viewBox="0 0 44 44" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke={tokens.border} strokeWidth="3" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={tierColor} strokeWidth="3"
            strokeDasharray={`${(score / 100) * 113.1} 113.1`} strokeDashoffset="0"
            strokeLinecap="butt" transform="rotate(-90 22 22)" />
        </svg>
        <Typography
          variant="caption"
          sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '.7rem',
          }}
        >
          {score}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>
          {t('Build index', 'Indice de build')}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: tierColor, fontSize: '.78rem' }}>
          {labels[tier]}
        </Typography>
      </Box>
    </Box>
  );
}

/* ─── CombinedModifiers ─────────────────────────────────────────────────── */

function CombinedModifiers({ blueprint, projectedStats }: { blueprint: { baseStats: ItemStats }; projectedStats: ItemStats }) {
  const { lang, t } = useI18n();
  const statKeys = Object.keys(blueprint.baseStats) as (keyof ItemStats)[];
  const rows = statKeys
    .map((key) => {
      const base = blueprint.baseStats[key] ?? 0;
      const projected = projectedStats[key] ?? base;
      if (base === 0) return null;
      const pct = ((projected as number) / base - 1) * 100;
      const isImproved = STAT_LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;
      return { key, label: STAT_LABELS[key]?.[lang] ?? String(key), base, projected: projected as number, pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
    })
    .filter(Boolean) as Array<{ key: keyof ItemStats; label: string; base: number; projected: number; pct: number; isImproved: boolean; isNeutral: boolean }>;

  if (rows.length === 0) return null;
  return (
    <Box component="section">
      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
        <ElectricBoltIcon sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'text-bottom' }} /> {t('Final Combined Modifiers', 'Modificateurs combines')}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={t('Stats modifiers', 'Modificateurs de stats')}>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell sx={{ fontSize: '.72rem', py: 0.5, borderBottom: `1px solid ${tokens.border}` }}>
                  {r.label}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.7rem', py: 0.5, color: 'text.secondary', borderBottom: `1px solid ${tokens.border}` }}>
                  {r.base.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.7rem', py: 0.5, borderBottom: `1px solid ${tokens.border}` }}>
                  {r.projected.toFixed(2)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontWeight: 600,
                    fontSize: '.7rem',
                    py: 0.5,
                    borderBottom: `1px solid ${tokens.border}`,
                    color: r.isNeutral ? 'text.secondary' : r.isImproved ? 'success.main' : 'error.main',
                  }}
                >
                  {r.pct > 0 ? '+' : ''}{r.pct.toFixed(2)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

/* ─── ResourceSummary ───────────────────────────────────────────────────── */

function ResourceSummary({ entries }: { entries: AggregatedResource[] }) {
  const { lang, t } = useI18n();
  if (entries.length === 0) return null;
  return (
    <Box component="section">
      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
        {t('Required Resources', 'Ressources necessaires')}
      </Typography>
      <List dense disablePadding aria-label={t('Required resources', 'Ressources necessaires')}>
        {entries.map((entry) => (
          <ListItem key={entry.resourceName} disablePadding sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ResourceIcon name={entry.resourceName} size={16} />
            </ListItemIcon>
            <ListItemText
              primary={entry.resourceName}
              secondary={summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
              slotProps={{
                primary: { variant: 'body2', sx: { fontSize: '.78rem' } },
                secondary: { variant: 'caption', sx: { fontSize: '.6rem' } },
              }}
            />
            <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.65rem', ml: 1, flexShrink: 0 }}>
              ×{entry.totalScu.toFixed(2)} SCU
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

/* ─── AcquisitionSources ────────────────────────────────────────────────── */

function AcquisitionSources({ contracts, loading }: { contracts: MissionContract[]; loading: boolean }) {
  const { lang, t } = useI18n();
  if (loading) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Typography>{t('Loading mission data...', 'Chargement des missions...')}</Typography>
      </Box>
    );
  }
  if (contracts.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>{t('No known contract reward for this blueprint.', 'Aucune recompense de contrat connue pour ce blueprint.')}</Typography>
      </Box>
    );
  }
  return (
    <List disablePadding>
      {contracts.map((contract) => (
        <ListItem
          key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
          sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '.78rem' }}>
              {contract.contractDebugName ?? 'Unknown contract'}
            </Typography>
            <Chip
              label={formatScaleLabel(contract.availability.derivedScale, lang)}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ fontSize: '.58rem', height: 20 }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.68rem' }}>
            {contract.contractorDisplayName ?? contract.faction?.displayName ?? 'Unknown'}{' — '}{formatLocations(contract, lang)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.68rem' }}>
            {formatStanding(contract, lang)}
          </Typography>
        </ListItem>
      ))}
    </List>
  );
}

/* ─── DismantleTab ──────────────────────────────────────────────────────── */

const CONFIDENCE_COLORS: Record<string, string> = {
  high: tokens.success,
  medium: tokens.warning,
  low: tokens.danger,
};

function DismantleTab() {
  const { dismantlingData } = useCraft();
  const { t } = useI18n();
  const dismantling = dismantlingData?.dismantling ?? null;

  if (!dismantlingData || !dismantling?.blueprint || !dismantling.globalParams) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>{t('No dismantling data available for this dataset.', 'Aucune donnee de demontage disponible pour ce dataset.')}</Typography>
      </Box>
    );
  }

  const { fabricator, meta } = dismantlingData;
  const dismantleBlueprint = dismantling.blueprint;
  const globalParams = dismantling.globalParams;
  const perItemYieldModel = dismantling.perItemYieldModel ?? null;
  const observedFields = perItemYieldModel?.observedRuntimeFields ?? [];

  const stats = [
    { label: t('Efficiency', 'Efficacite'), value: `${Math.round(dismantleBlueprint.efficiency * 100)}%` },
    { label: t('Time', 'Temps'), value: `${dismantleBlueprint.dismantleTimeSecs}s` },
    { label: t('Default quality', 'Qualite par defaut'), value: String(globalParams.defaultCompositionQuality) },
    { label: t('Quality multiplier', 'Multiplicateur qualite'), value: `×${globalParams.refiningQualityUnitMultiplier}` },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stats grid */}
      <Box component="section" aria-label={t('Dismantling stats', 'Stats de demontage')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
        {stats.map((s) => (
          <Paper key={s.label} variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>
              {s.label}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '.9rem' }}>
              {s.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {fabricator && (
        <Box component="section">
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
            {t('Fabricator', 'Fabricateur')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.75rem', mb: 0.5 }}>
            {fabricator.displayName} — {fabricator.inventoryOccupancyScu} SCU
          </Typography>
          {fabricator.queues.length > 0 && (
            <List dense disablePadding>
              {fabricator.queues.map((q) => (
                <ListItem key={q.debugName} disablePadding sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={`${q.debugName}: ${q.maxJobsInProgress} ${t('active', 'actifs')}, ${q.maxJobsWaiting} ${t('queued', 'en attente')}`}
                    slotProps={{ primary: { variant: 'caption', sx: { fontSize: '.7rem' } } }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      {perItemYieldModel && (
        <Box component="section">
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
            {t('Per-item yield model', 'Modele de rendement par item')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.75rem' }}>
            {perItemYieldModel.resolved
              ? t('Resolved', 'Resolu')
              : t('Unresolved — yields cannot be predicted per item yet.', 'Non resolu — les rendements par item ne sont pas encore previsibles.')}
          </Typography>
          {perItemYieldModel.reason && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.68rem' }}>{perItemYieldModel.reason}</Typography>
          )}
          {observedFields.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.68rem' }}>
              {t('Observed fields', 'Champs observes')}: {observedFields.join(', ')}
            </Typography>
          )}
        </Box>
      )}

      {meta?.confidence && (
        <Box component="section">
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
            {t('Extraction confidence', 'Confiance extraction')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0.5, alignItems: 'center' }}>
            {([
              [t('Global process', 'Processus global'), meta.confidence.globalProcess],
              [t('UI shape', 'Forme UI'), meta.confidence.uiResultShape],
              [t('Per-item table', 'Table par item'), meta.confidence.perItemYieldTable],
            ] as [string, string][]).map(([label, level]) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography variant="caption" sx={{ fontSize: '.7rem' }}>{label}</Typography>
                <Chip
                  label={level}
                  size="small"
                  sx={{
                    fontSize: '.58rem',
                    height: 18,
                    color: CONFIDENCE_COLORS[level] ?? 'text.secondary',
                    borderColor: CONFIDENCE_COLORS[level] ?? tokens.border,
                  }}
                  variant="outlined"
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/* ─── Tab definitions ───────────────────────────────────────────────────── */

const TAB_ORDER: ItemTab[] = ['overview', 'craft', 'acquisition', 'dismantle'];

/* ─── ItemWorkspace (main export) ───────────────────────────────────────── */

export function ItemWorkspace() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    activeItemTab,
    setActiveItemTab,
    slotAssignments,
    assignQuality,
    clearAssignments,
    inventoryIds,
    toggleInventory,
    favoriteIds,
    toggleFavorite,
    addGoal,
    addToComparison,
    comparisonItems,
    openComparison,
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    dismantlingData,
  } = useCraft();
  const { t } = useI18n();
  const { qualityScore, projectedStats } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [activeBlueprint, ensureMissionRewardsLoaded]);

  const acquisitionContracts = useMemo(
    () => activeBlueprint ? findMissionContractsForBlueprint(missionRewards, activeBlueprint.id) : [],
    [activeBlueprint, missionRewards],
  );

  const requiredResources = useMemo(
    () => activeBlueprint ? aggregateBlueprintResources(activeBlueprint.slots, slotAssignments) : [],
    [activeBlueprint, slotAssignments],
  );

  // Determine visible tabs
  const visibleTabs = useMemo(() => {
    const tabs: ItemTab[] = ['overview', 'craft'];
    if (missionRewards && acquisitionContracts.length > 0) tabs.push('acquisition');
    if (dismantlingData) tabs.push('dismantle');
    return tabs;
  }, [missionRewards, acquisitionContracts.length, dismantlingData]);

  // Clamp active tab if current tab is not visible
  const effectiveTab = visibleTabs.includes(activeItemTab) ? activeItemTab : 'overview';

  if (!activeBlueprint) {
    return null; // handled by parent
  }

  const craftMinutes = Math.round(activeBlueprint.craftTimeSecs / 60);
  const isLooted = inventoryIds.includes(activeBlueprint.id);
  const isFavorite = favoriteIds.includes(activeBlueprint.id);
  const canAddToComparison = comparisonItems.length < 4;
  const nextColor = COMPARISON_COLORS[comparisonItems.length];

  function fillSlots(mode: 'max' | 'minimum') {
    if (!activeBlueprint) return;
    for (const slot of activeBlueprint.slots) {
      assignQuality(slot.id, mode === 'max' ? 1000 : (slot.minQuality ?? 0));
    }
  }

  const tabLabels: Record<ItemTab, string> = {
    overview: t('Overview', 'Apercu'),
    craft: t('Craft', 'Craft'),
    acquisition: t('Acquisition', 'Acquisition'),
    dismantle: t('Dismantle', 'Demontage'),
  };

  return (
    <Box
      component="section"
      aria-label={`${t('Item workspace', 'Espace item')} - ${activeBlueprint.name}`}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Context bar */}
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => setActiveBlueprint(null)}>
          <ArrowBackIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> {t('Library', 'Bibliothèque')}
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <CategoryBadge category={activeBlueprint.category} iconOnly />
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              fontSize: '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeBlueprint.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {activeBlueprint.manufacturer}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 1 }}>
            <TimerIcon sx={{ fontSize: '.8rem', color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {craftMinutes}m
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            onClick={() => toggleInventory(activeBlueprint.id)}
            aria-pressed={isLooted}
            size="small"
            sx={{
              fontSize: '.7rem',
              ...(isLooted && { color: 'primary.main', backgroundColor: 'rgba(139, 92, 246, 0.1)' }),
            }}
          >
            {isLooted ? <CheckCircleIcon sx={{ fontSize: '1.1rem' }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
          <IconButton
            onClick={() => toggleFavorite(activeBlueprint.id)}
            aria-pressed={isFavorite}
            size="small"
            sx={{
              fontSize: '.85rem',
              ...(isFavorite && { color: 'warning.main' }),
            }}
          >
            {isFavorite ? <StarIcon sx={{ fontSize: '1.2rem' }} /> : <StarBorderIcon sx={{ fontSize: '1.2rem' }} />}
          </IconButton>
        </Box>
      </Box>

      {/* Tab bar */}
      <Tabs
        value={effectiveTab}
        onChange={(_e, val) => setActiveItemTab(val as ItemTab)}
        aria-label={t('Item sections', 'Sections item')}
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, minHeight: 36 }}
      >
        {TAB_ORDER.filter((tab) => visibleTabs.includes(tab)).map((tab) => (
          <Tab
            key={tab}
            value={tab}
            label={
              tab === 'acquisition' && acquisitionContracts.length > 0 ? (
                <MuiBadge badgeContent={acquisitionContracts.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '.5rem', minWidth: 14, height: 14 } }}>
                  {tabLabels[tab]}
                </MuiBadge>
              ) : tabLabels[tab]
            }
            sx={{ minHeight: 36, py: 0.5 }}
          />
        ))}
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }} role="tabpanel">
        <Container maxWidth="sm" disableGutters>
          {effectiveTab === 'overview' && (
            <Stack spacing={2}>
              <QualityScore score={qualityScore} />
              <CombinedModifiers blueprint={activeBlueprint} projectedStats={projectedStats} />
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
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{t('Qty', 'Qte')}</Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                    slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 48, textAlign: 'center', padding: '4px 6px' } } }}
                    sx={{ width: 64 }}
                  />
                </Box>
                <Button variant="gradient" size="md" fullWidth onClick={() => addGoal(qualityScore, projectedStats, qty)}>
                  {t('Add to Planner', 'Ajouter au planificateur')}
                </Button>
                <Button variant="secondary" size="md" fullWidth
                  onClick={() => addToComparison(qualityScore, projectedStats)}
                  disabled={!canAddToComparison}
                  style={{ position: 'relative', overflow: 'hidden' } as React.CSSProperties}>
                  {canAddToComparison && (
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: nextColor, mr: 0.5 }} aria-hidden="true" />
                  )}
                  <CompareArrowsIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> {t('Compare', 'Comparer')}
                  {!canAddToComparison && <Typography component="span" sx={{ fontSize: '.7rem', ml: 0.5, opacity: 0.6 }}>max 4</Typography>}
                </Button>
                {comparisonItems.length > 0 && (
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {comparisonItems.map((item) => (
                          <Box key={item.id} component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} aria-hidden="true" />
                        ))}
                        <span>{comparisonItems.length} {t('in comparison', 'en comparaison')}</span>
                      </Box>
                    }
                    variant="outlined"
                    onClick={openComparison}
                    aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonItems.length})`}
                    sx={{ cursor: 'pointer' }}
                  />
                )}
              </Stack>
            </Stack>
          )}

          {effectiveTab === 'craft' && (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <QualityScore score={qualityScore} />
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button variant="ghost" size="sm" onClick={() => fillSlots('max')}>{t('Max quality', 'Qualite max')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => fillSlots('minimum')}>{t('Minimum valid', 'Minimum valide')}</Button>
                  <Button variant="ghost" size="sm" onClick={clearAssignments}>{t('Clear', 'Effacer')}</Button>
                </Box>
              </Box>

              <Typography
                variant="h6"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em' }}
              >
                <SettingsIcon sx={{ fontSize: '1rem' }} /> {t('Parts', 'Composants')}
              </Typography>
              <Stack spacing={1}>
                {activeBlueprint.slots.map((slot) => (
                  <SlotCard key={slot.id} slot={slot} qualityValue={slotAssignments[slot.id]}
                    onQualityChange={(value) => assignQuality(slot.id, value)} />
                ))}
              </Stack>
              <CombinedModifiers blueprint={activeBlueprint} projectedStats={projectedStats} />
              <ResourceSummary entries={requiredResources} />
            </Stack>
          )}

          {effectiveTab === 'acquisition' && (
            <AcquisitionSources contracts={acquisitionContracts} loading={missionRewardsLoading} />
          )}

          {effectiveTab === 'dismantle' && (
            <DismantleTab />
          )}
        </Container>
      </Box>
    </Box>
  );
}
