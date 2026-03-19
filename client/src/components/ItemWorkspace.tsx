import { useEffect, useMemo, useState } from 'react';
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
              ✕
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

function QualityScore({ score }: { score: number }) {
  const { t } = useI18n();
  const tier = score >= 80 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'fair' : 'poor';
  const labels = {
    excellent: t('Excellent', 'Excellent'),
    good: t('Good', 'Bon'),
    fair: t('Fair', 'Moyen'),
    poor: t('Poor', 'Faible'),
  };
  return (
    <div className="quality-score" aria-label={`${t('Build index', 'Indice de build')}: ${score}/100`}>
      <div className="quality-score__ring" style={{ '--score': score } as React.CSSProperties}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle className="quality-score__track" cx="22" cy="22" r="18" />
          <circle className={`quality-score__fill quality-score__fill--${tier}`} cx="22" cy="22" r="18"
            strokeDasharray={`${(score / 100) * 113.1} 113.1`} strokeDashoffset="0" />
        </svg>
        <span className="quality-score__value">{score}</span>
      </div>
      <div className="quality-score__label">
        <span className="quality-score__title">{t('Build index', 'Indice de build')}</span>
        <span className={`quality-score__tier quality-score__tier--${tier}`}>{labels[tier]}</span>
      </div>
    </div>
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
      return { key, label: STAT_LABELS[key]?.[lang] ?? String(key), pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
    })
    .filter(Boolean) as Array<{ key: keyof ItemStats; label: string; pct: number; isImproved: boolean; isNeutral: boolean }>;

  if (rows.length === 0) return null;
  return (
    <section className="combined-mods">
      <h3 className="combined-mods__title"><span aria-hidden="true">⚡</span> {t('Final Combined Modifiers', 'Modificateurs combines')}</h3>
      <div className="combined-mods__list">
        {rows.map((r) => (
          <div key={r.key} className="combined-mods__row">
            <span className="combined-mods__stat">{r.label}</span>
            <span className={['combined-mods__val', !r.isNeutral && (r.isImproved ? 'combined-mods__val--better' : 'combined-mods__val--worse')].filter(Boolean).join(' ')}>
              {r.pct > 0 ? '+' : ''}{r.pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── ResourceSummary ───────────────────────────────────────────────────── */

function ResourceSummary({ entries }: { entries: AggregatedResource[] }) {
  const { lang, t } = useI18n();
  if (entries.length === 0) return null;
  return (
    <section className="sim-resources">
      <h3 className="sim-resources__title">{t('Required Resources', 'Ressources necessaires')}</h3>
      <ul className="res-list" aria-label={t('Required resources', 'Ressources necessaires')}>
        {entries.map((entry) => (
          <li key={entry.resourceName} className="res-item">
            <ResourceIcon name={entry.resourceName} size={16} />
            <span className="res-item__name">{entry.resourceName}</span>
            <span className="res-item__quality">{summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}</span>
            <span className="res-item__qty">&times;{entry.totalScu.toFixed(2)} SCU</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── AcquisitionSources ────────────────────────────────────────────────── */

function AcquisitionSources({ contracts, loading }: { contracts: MissionContract[]; loading: boolean }) {
  const { lang, t } = useI18n();
  if (loading) {
    return <div className="acq-sources"><p className="acq-sources__loading">{t('Loading mission data...', 'Chargement des missions...')}</p></div>;
  }
  if (contracts.length === 0) {
    return (
      <div className="acq-sources acq-sources--empty">
        <p className="acq-sources__empty">{t('No known contract reward for this blueprint.', 'Aucune recompense de contrat connue pour ce blueprint.')}</p>
      </div>
    );
  }
  return (
    <div className="acq-sources">
      <ul className="acq-sources__list">
        {contracts.map((contract) => (
          <li key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`} className="acq-sources__item">
            <div className="acq-sources__item-head">
              <span className="acq-sources__item-name">{contract.contractDebugName ?? 'Unknown contract'}</span>
              <span className="acq-sources__item-scale">{formatScaleLabel(contract.availability.derivedScale, lang)}</span>
            </div>
            <p className="acq-sources__item-meta">
              {contract.contractorDisplayName ?? contract.faction?.displayName ?? 'Unknown'}{' - '}{formatLocations(contract, lang)}
            </p>
            <p className="acq-sources__item-meta">{formatStanding(contract, lang)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── DismantleTab ──────────────────────────────────────────────────────── */

function DismantleTab() {
  const { dismantlingData } = useCraft();
  const { t } = useI18n();
  const dismantling = dismantlingData?.dismantling ?? null;

  if (!dismantlingData || !dismantling?.blueprint || !dismantling.globalParams) {
    return (
      <div className="dismantle dismantle--empty">
        <p>{t('No dismantling data available for this dataset.', 'Aucune donnee de demontage disponible pour ce dataset.')}</p>
      </div>
    );
  }

  const { fabricator, meta } = dismantlingData;
  const dismantleBlueprint = dismantling.blueprint;
  const globalParams = dismantling.globalParams;
  const perItemYieldModel = dismantling.perItemYieldModel ?? null;
  const observedFields = perItemYieldModel?.observedRuntimeFields ?? [];

  return (
    <div className="dismantle">
      <section className="dismantle__stats" aria-label={t('Dismantling stats', 'Stats de demontage')}>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Efficiency', 'Efficacite')}</span>
          <span className="dismantle__stat-value">{Math.round(dismantleBlueprint.efficiency * 100)}%</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Time', 'Temps')}</span>
          <span className="dismantle__stat-value">{dismantleBlueprint.dismantleTimeSecs}s</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Default quality', 'Qualite par defaut')}</span>
          <span className="dismantle__stat-value">{globalParams.defaultCompositionQuality}</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Quality multiplier', 'Multiplicateur qualite')}</span>
          <span className="dismantle__stat-value">&times;{globalParams.refiningQualityUnitMultiplier}</span>
        </div>
      </section>

      {fabricator && (
        <section className="dismantle__fabricator">
          <h3 className="dismantle__section-title">{t('Fabricator', 'Fabricateur')}</h3>
          <p className="dismantle__meta">{fabricator.displayName} — {fabricator.inventoryOccupancyScu} SCU</p>
          {fabricator.queues.length > 0 && (
            <ul className="dismantle__queues">
              {fabricator.queues.map((q) => (
                <li key={q.debugName} className="dismantle__queue">
                  {q.debugName}: {q.maxJobsInProgress} {t('active', 'actifs')}, {q.maxJobsWaiting} {t('queued', 'en attente')}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {perItemYieldModel && (
        <section className="dismantle__yield">
          <h3 className="dismantle__section-title">{t('Per-item yield model', 'Modele de rendement par item')}</h3>
          <p className="dismantle__meta">
            {perItemYieldModel.resolved
              ? t('Resolved', 'Resolu')
              : t('Unresolved — yields cannot be predicted per item yet.', 'Non resolu — les rendements par item ne sont pas encore previsibles.')}
          </p>
          {perItemYieldModel.reason && <p className="dismantle__meta">{perItemYieldModel.reason}</p>}
          {observedFields.length > 0 && (
            <p className="dismantle__meta">{t('Observed fields', 'Champs observes')}: {observedFields.join(', ')}</p>
          )}
        </section>
      )}

      {meta?.confidence && (
        <section className="dismantle__confidence-section">
          <h3 className="dismantle__section-title">{t('Extraction confidence', 'Confiance extraction')}</h3>
          <div className="dismantle__confidence-grid">
            <span>{t('Global process', 'Processus global')}</span>
            <span className={`dismantle__confidence dismantle__confidence--${meta.confidence.globalProcess}`}>{meta.confidence.globalProcess}</span>
            <span>{t('UI shape', 'Forme UI')}</span>
            <span className={`dismantle__confidence dismantle__confidence--${meta.confidence.uiResultShape}`}>{meta.confidence.uiResultShape}</span>
            <span>{t('Per-item table', 'Table par item')}</span>
            <span className={`dismantle__confidence dismantle__confidence--${meta.confidence.perItemYieldTable}`}>{meta.confidence.perItemYieldTable}</span>
          </div>
        </section>
      )}
    </div>
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
        className="workspace__context"
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
          ← {t('Library', 'Bibliothèque')}
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
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            ⏱ {craftMinutes}m
          </Typography>
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
            {isLooted ? '◉' : '◎'}
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
            {isFavorite ? '★' : '☆'}
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
        {effectiveTab === 'overview' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="simulator__score-row">
              <QualityScore score={qualityScore} />
            </div>
            <CombinedModifiers blueprint={activeBlueprint} projectedStats={projectedStats} />
            <ResourceSummary entries={requiredResources} />

            {/* Acquisition summary in overview */}
            {acquisitionContracts.length > 0 && (
              <section className="overview__acq-summary">
                <h3 className="overview__section-title">
                  <span aria-hidden="true">⚑</span> {t('Mission Sources', 'Sources de missions')}
                  <span className="overview__section-count">{acquisitionContracts.length}</span>
                </h3>
                <button className="overview__link-btn" onClick={() => setActiveItemTab('acquisition')}>
                  {t('View all contracts', 'Voir tous les contrats')} →
                </button>
              </section>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                📋 {t('Add to Planner', 'Ajouter au planificateur')}
              </Button>
              <Button variant="secondary" size="md" fullWidth
                onClick={() => addToComparison(qualityScore, projectedStats)}
                disabled={!canAddToComparison}
                style={{ position: 'relative', overflow: 'hidden' } as React.CSSProperties}>
                {canAddToComparison && <span className="btn-compare__dot" style={{ background: nextColor }} aria-hidden="true" />}
                ◇ {t('Compare', 'Comparer')}
                {!canAddToComparison && <span style={{ fontSize: '.7rem', marginLeft: 4, opacity: 0.6 }}>max 4</span>}
              </Button>
              {comparisonItems.length > 0 && (
                <button className="stats-panel__cmp-badge" onClick={openComparison}
                  aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonItems.length})`}>
                  {comparisonItems.map((item) => (
                    <span key={item.id} className="stats-panel__cmp-dot" style={{ background: item.color }} aria-hidden="true" />
                  ))}
                  <span>{comparisonItems.length} {t('in comparison', 'en comparaison')}</span>
                </button>
              )}
            </Box>
          </Box>
        )}

        {effectiveTab === 'craft' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em' }}
            >
              <span aria-hidden="true">⚙</span> {t('Parts', 'Composants')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activeBlueprint.slots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} qualityValue={slotAssignments[slot.id]}
                  onQualityChange={(value) => assignQuality(slot.id, value)} />
              ))}
            </Box>
            <CombinedModifiers blueprint={activeBlueprint} projectedStats={projectedStats} />
            <ResourceSummary entries={requiredResources} />
          </Box>
        )}

        {effectiveTab === 'acquisition' && (
          <AcquisitionSources contracts={acquisitionContracts} loading={missionRewardsLoading} />
        )}

        {effectiveTab === 'dismantle' && (
          <DismantleTab />
        )}
      </Box>
    </Box>
  );
}
