import { Box, ButtonBase, IconButton, Paper, Skeleton, Typography, alpha, useTheme } from '../ui/system';
import type { Theme } from '../ui/system';
import { AppProgressBar } from './ui/feedback';
import {
  AddIcon,
  CheckIcon,
  Inventory2OutlinedIcon,
  PlaylistAddIcon,
  RemoveIcon,
  StarBorderIcon,
  StarIcon,
} from '../ui/icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL } from '../theme';
import { FieldDataBody, hasBlueprintFieldData } from './item-workspace/CraftSection';
import { StatImpactRadar } from './item-workspace/shared/StatImpactRadar';
import { ResourceIcon } from './ui/ResourceIcon';
import { AppButton } from './ui/controls';
import { AppOverlayPanel } from './ui/overlays';
import { PageLayout } from './ui/page';
import { RarityBadge } from './ui/RarityBadge';
import { WorkbenchHome } from './fabricator/WorkbenchHome';
import { BentoHero, BentoPanel } from './fabricator/BentoPanel';
import { BuildIndexKnob, SlotRow, SlotTableHeader, StatMeterRow, buildStatMeters } from './fabricator/CraftBench';
import { AcquisitionRoutes } from './fabricator/AcquisitionRoutes';
import type { Lane, LaneTier } from './fabricator/AcquisitionRoutes';
import {
  aggregateBlueprintResources,
  formatProbabilityPercent,
  formatResourceQuantity,
  getAcquisitionEntry,
} from '../utils/crafting';
import { itemSlugFromPathname, navigateToPath, toSlug } from '../utils/slug';
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';
import type {
  AcquisitionContract,
  AggregatedResource,
  MaterialSourceEntry,
  MaterialSources,
  AcquisitionFaction,
  AcquisitionGraphEntry,
  Blueprint,
  LocalizedString,
  MissionContract,
  MissionReputationScope,
  MissionStandingTier,
} from '../types';
import { CATEGORY_LABELS } from '../types';
import './fabricator/fabricator-focus.css';

const PROGRESS_KEY = 'if-acquisition-progress';
/** Which view the Projected result panel shows: the radar, or the stat meters. */
const RADAR_VIEW_KEY = 'if-fabricator-radar-view';

// ─── Progress persistence (reached reputation per faction/scope) ─────────────

type ProgressMap = Record<string, number>;

function readProgress(): ProgressMap {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeProgress(map: ProgressMap) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — progress simply won't persist
  }
}

// ─── Ladder computation ───────────────────────────────────────────────────────

function isRealTier(tier: MissionStandingTier): boolean {
  const name = tier.displayName ?? '';
  return name.length > 0 && !name.includes('PLACEHOLDER') && (tier.minReputation ?? -1) >= 0;
}

function contractTopStanding(contract: AcquisitionContract) {
  const standings = contract.minimumRequiredStandings ?? [];
  if (standings.length === 0) return null;
  return [...standings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0))[0];
}

function missionContractTopStanding(contract: MissionContract) {
  const standings = contract.minimumRequiredStandings ?? [];
  if (standings.length === 0) return null;
  return [...standings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0))[0];
}

function buildLane(
  faction: AcquisitionFaction,
  entryScopes: MissionReputationScope[],
  factionGroupId: string | null,
  factionContracts: MissionContract[] | undefined,
): Lane | null {
  const targets = faction.contracts ?? [];
  if (targets.length === 0) return null;

  // Resolve the reputation scope the target contracts are gated on.
  const scopeGuids = new Map<string, number>();
  for (const contract of targets) {
    const top = contractTopStanding(contract);
    const guid = top?.scopeGuid ?? top?.scopeName ?? null;
    if (guid) scopeGuids.set(guid, (scopeGuids.get(guid) ?? 0) + 1);
  }
  const mainScopeId = [...scopeGuids.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const scope = entryScopes.find((s) => s.guid === mainScopeId)
    ?? entryScopes.find((s) => s.scopeName === mainScopeId)
    ?? null;

  const ladder = (scope?.standings ?? [])
    .filter(isRealTier)
    .sort((a, b) => (a.minReputation ?? 0) - (b.minReputation ?? 0));

  const maxNeededReputation = Math.max(
    0,
    ...targets.map((c) => contractTopStanding(c)?.minReputation ?? 0),
  );

  // Keep the ladder from entry level up to the highest needed tier.
  const visible = ladder.filter((t) => (t.minReputation ?? 0) <= maxNeededReputation);
  const tiers: LaneTier[] = (visible.length > 0 ? visible : [{ displayName: null, minReputation: 0 } as MissionStandingTier])
    .map((tier) => {
      const rep = tier.minReputation ?? 0;
      const nextRep = ladder.find((t) => (t.minReputation ?? 0) > rep)?.minReputation ?? Number.POSITIVE_INFINITY;
      const targetContracts = targets.filter((c) => {
        const min = contractTopStanding(c)?.minReputation ?? 0;
        return min >= rep && min < nextRep;
      });
      const targetNames = new Set(targetContracts.map((c) => c.contractDebugName));
      const grindContracts = (factionContracts ?? []).filter((c) => {
        const top = missionContractTopStanding(c);
        const scopeId = top?.scopeGuid ?? c.reputationScope?.guid ?? c.reputationScope?.scopeName ?? null;
        if (mainScopeId && scopeId && scopeId !== mainScopeId) return false;
        const min = top?.minReputation ?? 0;
        return min >= rep && min < nextRep && !targetNames.has(c.contractDebugName ?? '');
      });
      // Pair each target with its full contract record so the row can show the
      // same reward pool as a grind row.
      const targetMissionContracts: Record<string, MissionContract> = {};
      for (const contract of factionContracts ?? []) {
        const name = contract.contractDebugName ?? '';
        if (name && targetNames.has(name)) targetMissionContracts[name] = contract;
      }
      return { tier, targetContracts, targetMissionContracts, grindContracts };
    });

  const bestChance = Math.max(0, ...targets.map((c) => c.maxChance ?? c.blueprintDropChance ?? 0));

  return {
    faction,
    factionGroupId,
    scope,
    scopeKey: `${factionGroupId ?? faction.contractorDisplayName ?? 'faction'}|${scope?.guid ?? scope?.scopeName ?? 'scope'}`,
    tiers,
    maxNeededReputation,
    bestChance,
  };
}

// ─── Material source lookup ──────────────────────────────────────────────────

function normalizeResourceKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function resolveMaterialSource(sources: MaterialSources | null, resourceName: string): MaterialSourceEntry | null {
  if (!sources) return null;
  const key = normalizeResourceKey(resourceName);
  if (sources.resources[key]) return sources.resources[key];
  for (const entry of Object.values(sources.resources)) {
    if (entry.displayName && normalizeResourceKey(entry.displayName) === key) return entry;
  }
  return null;
}

// ─── Small presentational pieces ─────────────────────────────────────────────

function gradeOf(score: number, theme: Theme): { label: LocalizedString; color: string } {
  if (score >= 800) return { label: { en: 'Excellent', fr: 'Excellent', de: 'Exzellent' }, color: theme.palette.success.main };
  if (score >= 600) return { label: { en: 'High', fr: 'Élevé', de: 'Hoch' }, color: theme.palette.primary.main };
  if (score >= 400) return { label: { en: 'Standard', fr: 'Standard', de: 'Standard' }, color: theme.palette.text.secondary };
  if (score >= 200) return { label: { en: 'Poor', fr: 'Médiocre', de: 'Mäßig' }, color: theme.palette.warning.main };
  return { label: { en: 'Defective', fr: 'Défectueux', de: 'Defekt' }, color: theme.palette.error.main };
}

/** KPI tile of the ribbon — label, big number, and either a meter or a hint. */
function KpiTile({
  label,
  value,
  hint,
  accent,
  meterPct,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
  meterPct?: number;
}) {
  return (
    <Paper
      sx={{
        position: 'relative',
        borderRadius: '5px',
        backgroundColor: 'ui.surface',
        px: 1.5,
        py: 0.875,
        minWidth: 0,
        overflow: 'hidden',
        boxShadow: `inset 2px 0 0 0 ${accent}`,
      }}
    >
      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.625, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: '1.1rem',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'text.primary',
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
      {meterPct != null ? (
        <Box sx={{ mt: 0.625, height: 3, borderRadius: '2px', backgroundColor: 'ui.surface3', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, meterPct))}%`, backgroundColor: accent, borderRadius: '2px' }} />
        </Box>
      ) : (
        <Typography
          sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled', mt: 0.5, lineHeight: 1.5 }}
        >
          {hint ?? ' '}
        </Typography>
      )}
    </Paper>
  );
}

/** Shared column template for the Materials & sourcing table. */
const MATERIAL_GRID = '18px minmax(0, 1fr) 68px 58px 24px';
/** Dismantle compares the minimum recipe composition with the nominal return. */
const DISMANTLE_GRID = '18px minmax(0, 1fr) 68px 68px';

const materialHeadSx = {
  fontFamily: FONT_MONO,
  fontSize: '0.56rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.disabled',
} as const;

// ─── Item description (clamped, expandable) ──────────────────────────────────

const DESCRIPTION_CLAMP_LINES = 2;

function ItemDescription({ blueprint }: { blueprint: Blueprint }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLElement | null>(null);
  const description = blueprint.identity?.descriptionBody ?? blueprint.identity?.description;

  /*
   * The toggle only appears when the text is actually clamped. Without the
   * measurement a one-line description still offered a control that visibly did
   * nothing — and making the paragraph itself the button meant screen readers
   * announced the entire blurb as the control's name.
   */
  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node || !description) {
      setOverflows(false);
      return;
    }
    const measure = () => setOverflows(node.scrollHeight - node.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [description, expanded]);

  if (!description) return null;

  return (
    <Box sx={{ mt: 0.5, maxWidth: '84ch' }}>
      <Typography
        ref={textRef}
        id={`item-description-${blueprint.id}`}
        sx={{
          fontSize: TEXT_LABEL,
          lineHeight: 1.5,
          color: 'text.secondary',
          ...(expanded ? {} : {
            display: '-webkit-box',
            WebkitLineClamp: DESCRIPTION_CLAMP_LINES,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        {description}
      </Typography>
      {(overflows || expanded) && (
        <ButtonBase
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={`item-description-${blueprint.id}`}
          sx={{
            mt: 0.25,
            fontFamily: FONT_MONO,
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'primary.main',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {expanded ? t('Less', 'Moins') : t('More', 'Plus')}
        </ButtonBase>
      )}
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FabricatorPage() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const {
    activeDataset,
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    ensureBlueprintDetailLoaded,
    ensureFactionContractsLoaded,
    ensureResourceDataLoaded,
    factionContractsByFactionId,
    inventoryIds,
    toggleInventory,
    favoriteIds,
    toggleFavorite,
    addGoal,
    goals,
    addPlannerResourceRequirement,
    dismantlingData,
    materialSources,
  } = useCraft();

  const blueprints = activeDataset.blueprints;

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const slug = itemSlugFromPathname(window.location.pathname);
    const initial = slug ? blueprints.find(bp => toSlug(bp.name) === slug) : blueprints.find(bp => bp.name === 'Vendetta HMG') ?? blueprints[0];
    return initial?.id ?? null;
  });
  const [requestedGoalId, setRequestedGoalId] = useState(() => new URLSearchParams(window.location.search).get('goal'));
  const [progress, setProgress] = useState<ProgressMap>(() => readProgress());
  /**
   * Transient confirmation on the Add-to-Planner button (design: 1.6s). Keyed
   * on the click timestamp, not a boolean: re-clicking while the confirmation
   * is still showing has to restart the window, and a boolean would not change
   * state and so would never re-run the effect.
   */
  const [plannedAt, setPlannedAt] = useState<number | null>(null);
  const [hasPlanned, setHasPlanned] = useState(false);
  const planned = plannedAt !== null;
  useEffect(() => {
    if (plannedAt === null) return;
    const timer = window.setTimeout(() => setPlannedAt(null), 1600);
    return () => window.clearTimeout(timer);
  }, [plannedAt]);
  const [radarOpen, setRadarOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(RADAR_VIEW_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleRadar = useCallback(() => setRadarOpen((previous) => !previous), []);
  // Persisting in an effect, not inside the updater: a state updater has to
  // stay pure — React may invoke it more than once, or discard the result.
  useEffect(() => {
    try {
      window.localStorage.setItem(RADAR_VIEW_KEY, radarOpen ? '1' : '0');
    } catch {
      // storage unavailable — the choice just won't survive a reload
    }
  }, [radarOpen]);

  // Local craft simulation state — independent from the /item workspace.
  const [qty, setQty] = useState(1);
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number | undefined>>({});
  const appliedConfiguration = useRef<string | null>(null);
  const assignQuality = useCallback((slotId: string, value: number | undefined) => {
    setSlotAssignments((prev) => ({ ...prev, [slotId]: value }));
  }, []);
  const clearAssignments = useCallback(() => setSlotAssignments({}), []);
  const requestedGoal = goals.find((goal) => goal.id === requestedGoalId && goal.blueprintId === selectedId);
  useEffect(() => {
    // A goal is an explicit handoff to this item's local simulator. Apply it
    // once per destination, including after a delayed account load; fetching
    // blueprint details or changing unrelated planner data must not erase edits.
    const configuration = `${activeDataset.datasetId}:${selectedId ?? ''}:${requestedGoalId ?? ''}:${requestedGoal ? 'saved' : 'default'}`;
    if (appliedConfiguration.current === configuration) return;
    appliedConfiguration.current = configuration;
    setSlotAssignments(requestedGoal ? { ...requestedGoal.slotAssignments } : {});
    setQty(requestedGoal ? Math.max(1, Math.min(99, Math.round(requestedGoal.quantity))) : 1);
    setHasPlanned(false);
  }, [selectedId, requestedGoalId, requestedGoal, activeDataset.datasetId]);

  useEffect(() => {
    if (activeDataset.datasetId) void ensureMissionRewardsLoaded();
  }, [activeDataset.datasetId, ensureMissionRewardsLoaded]);

  // Fabricator opens the standard Vendetta; deep links always select the requested item.
  // Deep links: /item/<slug> selects the blueprint here (the Fabricator IS
  // the item page); back/forward keep the selection in sync.
  useEffect(() => {
    const syncFromUrl = () => {
      setRequestedGoalId(new URLSearchParams(window.location.search).get('goal'));
      const slug = itemSlugFromPathname(window.location.pathname);
      if (!slug) {
        setSelectedId((blueprints.find(bp => bp.name === 'Vendetta HMG') ?? blueprints[0])?.id ?? null);
        return;
      }
      const fromUrl = blueprints.find((bp) => toSlug(bp.name) === slug);
      setSelectedId(fromUrl?.id ?? null);
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [blueprints]);

  const selected: Blueprint | null = useMemo(
    () => blueprints.find((bp) => bp.id === selectedId) ?? null,
    [blueprints, selectedId],
  );
  const detailReady = Boolean(selected?.detailsLoaded);

  // Home and item detail share the shell view, so the shell cannot reset this scroll itself.
  useEffect(() => {
    if (!window.location.hash) document.getElementById('main-content')?.scrollTo({ top: 0 });
  }, [selectedId]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || !detailReady) return;
    const section = document.getElementById(hash);
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView({ block: 'start' });
  }, [selectedId, detailReady]);

  useEffect(() => {
    if (selected && !selected.detailsLoaded) {
      void ensureBlueprintDetailLoaded(selected.id);
    }
  }, [selected, ensureBlueprintDetailLoaded]);

  useEffect(() => {
    if (selected) void ensureResourceDataLoaded();
  }, [selected, ensureResourceDataLoaded]);

  const { qualityScore, projectedStats } = useCraftSimulator(
    detailReady ? selected : null,
    slotAssignments,
  );

  const entry: AcquisitionGraphEntry | null = useMemo(
    () => (selected ? getAcquisitionEntry(missionRewards, selected.id) : null),
    [missionRewards, selected],
  );

  // Resolve faction group ids and lazily load their full contract pools.
  const factionGroupIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of missionRewards?.factionGroups ?? []) {
      if (group.contractorDisplayName) map.set(group.contractorDisplayName, group.id);
    }
    return map;
  }, [missionRewards?.factionGroups]);

  useEffect(() => {
    if (!entry) return;
    for (const faction of entry.factions) {
      const groupId = faction.contractorDisplayName ? factionGroupIdByName.get(faction.contractorDisplayName) : null;
      if (groupId) void ensureFactionContractsLoaded(groupId);
    }
  }, [entry, ensureFactionContractsLoaded, factionGroupIdByName]);

  const lanes: Lane[] = useMemo(() => {
    if (!entry) return [];
    const scopes = [...(missionRewards?.reputationScopesDetailed ?? [])];
    return entry.factions
      .map((faction) => {
        const groupId = faction.contractorDisplayName
          ? factionGroupIdByName.get(faction.contractorDisplayName) ?? null
          : null;
        return buildLane(faction, scopes, groupId, groupId ? factionContractsByFactionId[groupId] : undefined);
      })
      .filter((lane): lane is Lane => lane !== null)
      .sort((a, b) => b.bestChance - a.bestChance || a.maxNeededReputation - b.maxNeededReputation);
  }, [entry, factionContractsByFactionId, factionGroupIdByName, missionRewards?.reputationScopesDetailed]);

  const handleSelect = useCallback((bp: Blueprint | null) => {
    setSelectedId(bp?.id ?? null);
    const currentSlug = itemSlugFromPathname(window.location.pathname);
    if (bp) {
      const slug = toSlug(bp.name);
      if (currentSlug !== slug) navigateToPath(`/item/${slug}`, { blueprintId: bp.id });
    } else if (currentSlug) {
      navigateToPath('/');
    }
  }, []);

  const handleReach = useCallback((scopeKey: string, rep: number) => {
    setProgress((prev) => {
      const next = { ...prev, [scopeKey]: rep };
      writeProgress(next);
      return next;
    });
  }, []);

  // Suggestions for the empty state: easiest confirmed drops.
  const suggestions = useMemo(() => {
    if (!missionRewards) return [];
    return [...missionRewards.blueprintAcquisitionGraph]
      .sort((a, b) => b.dropScore - a.dropScore)
      .slice(0, 6);
  }, [missionRewards]);

  const requiredResources = useMemo<AggregatedResource[]>(
    () => (detailReady && selected ? aggregateBlueprintResources(selected.slots, slotAssignments) : []),
    [detailReady, selected, slotAssignments],
  );

  const totalRequiredScu = useMemo(
    () => requiredResources
      .filter((r) => r.quantityUnit !== 'count')
      .reduce((sum, r) => sum + r.totalScu, 0) * qty,
    [requiredResources, qty],
  );

  const fillSlots = useCallback((value: number | undefined) => {
    if (!selected) return;
    setSlotAssignments(() => {
      const next: Record<string, number | undefined> = {};
      for (const slot of selected.slots) next[slot.id] = value;
      return next;
    });
  }, [selected]);

  const dismantleEstimate = selected?.dismantle ?? null;
  const dismantleTimeSecs = dismantleEstimate?.dismantleTimeSecs
    ?? dismantlingData?.dismantling?.blueprint?.dismantleTimeSecs
    ?? 0;
  const dismantleEfficiency = dismantleEstimate?.efficiency
    ?? dismantlingData?.dismantling?.blueprint?.efficiency
    ?? 0;
  const dismantleIsDeterministic = dismantleEstimate?.deterministic !== false;

  /*
   * The dataset owns the nominal-yield algorithm. In particular, it unfolds item costs
   * (harvestable containers) into their resource composition and applies the game's
   * blacklist by GUID. Recomputing from the visible material rows dropped those item costs
   * on 254 blueprints and relied on fragile display-name matching.
   */
  const dismantleRows = useMemo(
    () => (dismantleEstimate?.returns ?? []).map((entry) => ({
      ...entry,
      costScu: entry.costScu * qty,
      yieldScu: entry.yieldScu * qty,
    })),
    [dismantleEstimate, qty],
  );
  const dismantleTotalCostScu = dismantleRows.reduce((sum, row) => sum + row.costScu, 0);
  const dismantleTotalYieldScu = dismantleRows.reduce((sum, row) => sum + row.yieldScu, 0);
  const dismantleEffectiveRatio = dismantleTotalCostScu > 0
    ? dismantleTotalYieldScu / dismantleTotalCostScu
    : null;
  const recoversNothing = dismantleIsDeterministic
    && dismantleRows.length > 0
    && dismantleRows.every((row) => row.yieldScu === 0);

  const showMaterials = detailReady && requiredResources.length > 0;
  const showDismantle = detailReady && Boolean(dismantleEstimate) && dismantleTimeSecs > 0;
  const closingPanelCount = [showMaterials, showDismantle, detailReady].filter(Boolean).length;
  const closingPanelSpan = closingPanelCount ? 12 / closingPanelCount : 12;

  const inInventory = selected ? inventoryIds.includes(selected.id) : false;
  const isFavorite = selected ? favoriteIds.includes(selected.id) : false;

  /*
   * `primaryVisual` is not reliably the item: for ~30% of the catalogue (the
   * CQ7 included) the importer falls back to the manufacturer's corporate photo
   * and stores it under both `primaryVisual` and `manufacturerLogo`. Showing
   * that as the hero claims a render exists when none does, so it is detected
   * by identity with the logo and de-emphasised rather than presented as art.
   */
  const manufacturerLogoUrl = selected?.media?.manufacturerLogo?.imageUrl ?? null;
  const primaryVisualUrl = selected?.media?.primaryVisual?.imageUrl ?? null;
  const itemRender = selected?.media?.image?.imageUrl
    ?? (primaryVisualUrl && primaryVisualUrl !== manufacturerLogoUrl ? primaryVisualUrl : null);
  const heroImage = itemRender ?? primaryVisualUrl ?? manufacturerLogoUrl;
  const heroIsManufacturer = !itemRender && Boolean(heroImage);
  const topStanding = entry?.standings?.length
    ? [...entry.standings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0))[0]
    : null;

  const validSlotCount = selected
    ? selected.slots.filter((slot) => {
        const value = slotAssignments[slot.id];
        return value !== undefined && (slot.minQuality == null || value >= slot.minQuality);
      }).length
    : 0;
  const allSlotsValid = Boolean(selected) && validSlotCount === (selected?.slots.length ?? 0);

  const grade = gradeOf(qualityScore, theme);
  const statMeters = detailReady && selected ? buildStatMeters(selected, projectedStats, lang) : [];
  const craftTimeLabel = selected
    ? selected.craftTimeSecs >= 60 ? `${Math.round(selected.craftTimeSecs / 60)}m` : `${selected.craftTimeSecs}s`
    : '—';
  const bestChance = lanes.length > 0 ? Math.max(0, ...lanes.map((l) => l.bestChance)) : 0;

  const ghostButtonSx = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    px: 1,
    fontFamily: FONT_MONO,
    fontWeight: 700,
    fontSize: '0.6875rem',
    color: 'text.secondary',
    '&:hover': { color: 'primary.main' },
  } as const;

  /*
   * 95% of the available width rather than a fixed cap: the work grid is 12
   * columns of cards, so the panels track the page and the old 1760px ceiling
   * stopped giving them room on large displays. The remaining 5% is what keeps
   * the cards off the window edge. Narrow viewports keep every pixel — there is
   * nothing to spare below lg.
   */
  return (
    <PageLayout
      width="full"
      sx={{ gap: 'var(--workspace-gap)' }}
    >
      {missionRewardsLoading && !missionRewards && !selected && (
        <Box sx={{ maxWidth: 640 }}>
          <AppProgressBar sx={{ mb: 1.5 }} />
          <Skeleton variant="rectangular" height={120} />
        </Box>
      )}

      {!selected && <WorkbenchHome onSelect={handleSelect} suggestions={suggestions} />}

      {selected && (
        <>
          <Box className="fabricator-breadcrumb" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <AppButton variant="ghost" size="sm" onClick={() => navigateToPath('/blueprints')}>
              ← {t('Blueprints', 'Blueprints', 'Baupläne')}
            </AppButton>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled' }}>
              {t('PRODUCTION / ITEM WORKSPACE', 'PRODUCTION / ATELIER OBJET', 'PRODUKTION / OBJEKTARBEITSPLATZ')}
            </Typography>
          </Box>
          {/* ── Identity + command strip ── */}
          <Paper key={`identity-${selected.id}`} className="workspace-identity"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.625,
              flexWrap: 'wrap',
              px: 1.5,
              py: 1.125,
              borderRadius: '5px',
              backgroundColor: 'ui.surface',
              boxShadow: `inset 3px 0 0 0 ${theme.palette.primary.main}`,
            }}
          >
            {heroImage && (
              <AppOverlayPanel
                ariaLabel={t('Blueprint visual', 'Visuel du blueprint')}
                trigger={
                  /*
                    Height is pinned to the 84px the identity text beside it
                    already measures, so the plate never makes the strip taller.
                    Width follows the image instead of being square: renders come
                    in two clusters, 16:9 landscape and the same ratio rotated to
                    portrait, so a fixed landscape plate would strand the portrait
                    half in a sliver surrounded by dead space. The bounds keep the
                    title from wandering — never narrower than the old square,
                    never wider than a full 16:9 at this height.

                    Sizing the height by `align-self: stretch` would loop here:
                    with no explicit width the image sets the width, aspect-ratio
                    turns that into height, and the strip blows out to ~500px.
                  */
                  <ButtonBase
                    aria-label={t('Enlarge the visual', 'Agrandir le visuel')}
                    sx={{
                      height: 84,
                      minWidth: 84,
                      maxWidth: 148,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      padding: '3px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.palette.ui.border}`,
                      backgroundColor: 'ui.bgElev',
                      overflow: 'hidden',
                      cursor: 'zoom-in',
                      transition: 'border-color 140ms ease',
                      // The plate clips, so scaling the image reads as a zoom
                      // into the frame rather than the frame itself growing.
                      '& img': { transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1)' },
                      '&:hover': { borderColor: theme.palette.ui.borderAccent },
                      '&:hover img': { transform: 'scale(1.06)' },
                    }}
                  >
                    {/*
                      Intrinsically sized rather than stretched to the box: the
                      caps fix the rendered height, the width then falls out of
                      the image's own ratio, and that width is what the plate
                      shrink-wraps to — so a 16:9 render fills the plate edge to
                      edge and only portrait ones sit letterboxed inside the
                      84px floor. Cropping to a square instead (`cover`) showed
                      the middle of a barrel and nothing identifiable.

                      Both caps have to be pixels, not percentages. A percentage
                      max-height is ignored while the browser computes intrinsic
                      width, so the plate would shrink-wrap to the image's full
                      natural width — it pinned to 148px for every item and
                      portrait renders overflowed to 249px tall and got clipped.
                      84px plate less 3px padding and 1px border each side is the
                      76px below; 148 less the same 8px is the 140.
                    */}
                    <Box
                      component="img"
                      src={heroImage}
                      alt=""
                      loading="lazy"
                      sx={{
                        maxWidth: 140,
                        maxHeight: 76,
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        ...(heroIsManufacturer ? { opacity: 0.5 } : null),
                      }}
                    />
                  </ButtonBase>
                }
              >
                <Box sx={{ display: 'grid', gap: 1, justifyItems: 'center', maxWidth: 'min(88vw, 440px)' }}>
                  <Box
                    component="img"
                    src={heroImage}
                    alt={selected.name}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '58vh',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      backgroundColor: 'ui.bgElev',
                    }}
                  />
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled', textAlign: 'center' }}>
                    {heroIsManufacturer
                      ? t('Manufacturer mark — no item render available', 'Marque du fabricant — aucun visuel de l’objet')
                      : selected.name}
                  </Typography>
                </Box>
              </AppOverlayPanel>
            )}
            {/*
              An explicit basis is what keeps the strip on one line: flex wraps
              on an item's hypothetical size, and letting the description set
              that (basis `auto`) would push the whole block below the image at
              every viewport width.
            */}
            <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125, flexWrap: 'wrap' }}>
                <Typography
                  component="h1"
                  sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: '1.28rem', letterSpacing: '-0.01em', lineHeight: 1, color: 'text.primary' }}
                >
                  {selected.name}
                </Typography>
                {selected.rarity && <RarityBadge rarity={selected.rarity} />}
              </Box>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.74rem', color: 'text.secondary', mt: 0.375 }}>
                {[
                  selected.manufacturer,
                  loc(CATEGORY_LABELS[selected.category], lang),
                  selected.baseStats.weaponType || selected.baseStats.armorType || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {selected.identity?.attachDef?.size != null && (
                  <Box component="span" sx={{ color: 'text.disabled' }}>
                    {' '}· {t('Size', 'Taille')} {selected.identity.attachDef.size}
                  </Box>
                )}
              </Typography>
              <ItemDescription blueprint={selected} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: { xs: 0, md: 'auto' }, flexWrap: 'wrap', maxWidth: '100%' }}>
              <AppButton
                variant="secondary"
                size="sm"
                startIcon={<Inventory2OutlinedIcon sx={{ fontSize: 14 }} />}
                ariaPressed={inInventory}
                onClick={() => toggleInventory(selected.id)}
                sx={{
                  minHeight: 34,
                  ...(inInventory
                    ? {
                        color: 'primary.main',
                        borderColor: theme.palette.ui.borderAccent,
                        backgroundColor: alpha(theme.palette.primary.main, 0.13),
                      }
                    : null),
                }}
              >
                {t('Owned', 'Possédé')}
              </AppButton>
              <IconButton
                size="small"
                aria-label={isFavorite ? t('Remove favourite', 'Retirer des favoris') : t('Favourite', 'Favori')}
                onClick={() => toggleFavorite(selected.id)}
                sx={{ color: isFavorite ? theme.palette.warning.main : 'text.secondary', minWidth: 34, minHeight: 34 }}
              >
                {isFavorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
              </IconButton>
              <Box
                role="group"
                aria-label={t('Craft quantity', 'Quantité à fabriquer')}
                sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.palette.ui.border}`, borderRadius: '7px' }}
              >
                <IconButton size="small" aria-label={t('Decrease quantity', 'Réduire la quantité')} onClick={() => setQty((q) => Math.max(1, q - 1))} sx={{ minWidth: 34, minHeight: 34 }}>
                  <RemoveIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Typography aria-live="polite" sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>
                  ×{qty}
                </Typography>
                <IconButton size="small" aria-label={t('Increase quantity', 'Augmenter la quantité')} onClick={() => setQty((q) => Math.min(99, q + 1))} sx={{ minWidth: 34, minHeight: 34 }}>
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              <AppButton
                variant="primary"
                size="sm"
                startIcon={planned ? <CheckIcon sx={{ fontSize: 14 }} /> : <AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => {
                  addGoal(qualityScore, projectedStats, qty, selected, slotAssignments);
                  setPlannedAt(Date.now());
                  setHasPlanned(true);
                }}
                sx={{
                  minHeight: 34,
                  transition: 'background-color 150ms ease',
                  ...(planned
                    ? {
                        backgroundColor: 'success.main',
                        borderColor: 'success.main',
                        '&:hover': { backgroundColor: 'success.main' },
                      }
                    : null),
                }}
              >
                {planned ? t('Added to planner', 'Ajouté au planner') : t('Add to Planner', 'Ajouter au Planner')}
              </AppButton>
              {hasPlanned && (
                <AppButton href="/planner#planner-production" variant="ghost" size="sm" onClick={(event) => {
                  if (!shouldHandleInternalLinkClick(event)) return;
                  event.preventDefault();
                  navigateToPath('/planner#planner-production');
                }}>
                  {t('Open planner', 'Ouvrir le planificateur', 'Planer öffnen')} ↗
                </AppButton>
              )}
            </Box>
          </Paper>

          {/* ── KPI ribbon ── */}
          <Box className="fabricator-kpi-ribbon" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.125 }}>
            <KpiTile
              label={t('Best drop chance', 'Meilleure chance')}
              value={!missionRewards ? '…' : entry ? formatProbabilityPercent(bestChance) : '—'}
              accent={theme.palette.domain.blue}
              meterPct={entry ? bestChance * 100 : 0}
            />
            <KpiTile
              label={t('Reputation needed', 'Réputation requise')}
              value={!missionRewards ? '…' : entry ? topStanding?.standingName ?? t('None', 'Aucune') : '—'}
              hint={t('to unlock a direct drop', 'pour débloquer un drop direct')}
              accent={theme.palette.domain.magenta}
            />
            <KpiTile
              label={t('Source contracts', 'Contrats sources')}
              value={!missionRewards ? '…' : entry ? String(entry.contractCount) : '0'}
              hint={`${lanes.length} ${t('factions', 'factions')}`}
              accent={theme.palette.domain.blue}
            />
            <KpiTile
              label={t('Localities', 'Localités')}
              value={!missionRewards ? '…' : entry ? String(entry.localityCount) : '0'}
              accent={theme.palette.domain.cyan}
            />
            <KpiTile
              label={t('Craft time', 'Temps de craft')}
              value={craftTimeLabel}
              hint={totalRequiredScu > 0 ? `${formatResourceQuantity(totalRequiredScu, 'scu', lang)} ${t('materials', 'matériaux')}` : undefined}
              accent={theme.palette.primary.main}
            />
          </Box>

          <Box component="nav" className="workspace-section-links fabricator-section-links" onClick={(event) => {
            const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
            const section = link ? document.getElementById(link.hash.slice(1)) : null;
            if (section instanceof HTMLDetailsElement) section.open = true;
          }} aria-label={t('Item sections', 'Sections de l’objet', 'Objektbereiche')}>
            {detailReady && <a href="#craft-configure">01 / {t('Configure', 'Configurer', 'Konfigurieren')}</a>}
            {detailReady && <a href="#craft-result">02 / {t('Result', 'Résultat', 'Ergebnis')}</a>}
            <a href="#craft-acquire">03 / {t('Acquire', 'Acquérir', 'Beschaffen')}</a>
            {showMaterials && <a href="#craft-materials">04 / {t('Materials', 'Matériaux', 'Materialien')}</a>}
            {showDismantle && <a href="#craft-dismantle">05 / {t('Dismantle', 'Démonter', 'Zerlegen')}</a>}
            {detailReady && <a href="#craft-data">06 / {t('Field data', 'Données objet', 'Objektdaten')}</a>}
          </Box>
          {/* ── Bento work grid ── */}
          {/*
            Cards stretch to their row rather than sizing to content: with three
            panels of unrelated natural heights sharing a band, `start` left a
            ragged bottom edge that read as accidental. Stretching gives every
            row a flat baseline, which is what makes the grid look deliberate.
          */}
          <Box key={`work-${selected.id}`} className="workspace-work-grid fabricator-dashboard" sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 1.5, alignItems: 'stretch' }}>
            {/* Craft simulator */}
            {detailReady ? (
              <BentoPanel
                accent={theme.palette.primary.main}
                id="craft-configure" title={t('Craft simulator', 'Simulateur de craft')}
                note={t('material quality · 0–1000', 'qualité des matériaux · 0–1000')}
                span={7}
                right={
                  <>
                    <Typography
                      sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: allSlotsValid ? 'success.main' : 'warning.main' }}
                    >
                      {validSlotCount}/{selected.slots.length} {t('valid', 'valides')}
                    </Typography>
                    <Box sx={{ display: 'inline-flex', border: `1px solid ${theme.palette.ui.borderStrong}`, borderRadius: '6px', overflow: 'hidden' }}>
                      <ButtonBase onClick={() => fillSlots(500)} title={t('Set every slot to 500', 'Mettre tous les slots à 500')} sx={ghostButtonSx}>
                        500
                      </ButtonBase>
                      <ButtonBase
                        onClick={() => fillSlots(1000)}
                        title={t('Max quality', 'Qualité max')}
                        sx={{ ...ghostButtonSx, borderLeft: `1px solid ${theme.palette.ui.border}` }}
                      >
                        MAX
                      </ButtonBase>
                      <ButtonBase
                        onClick={clearAssignments}
                        aria-label={t('Clear all slots', 'Vider tous les slots')}
                        title={t('Clear', 'Effacer')}
                        sx={{ ...ghostButtonSx, borderLeft: `1px solid ${theme.palette.ui.border}` }}
                      >
                        ✕
                      </ButtonBase>
                    </Box>
                  </>
                }
              >
                <SlotTableHeader />
                <Box role="list" aria-label={t('Material slots', 'Slots de matériaux')}>
                  {selected.slots.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      quality={slotAssignments[slot.id]}
                      onQualityChange={(value) => assignQuality(slot.id, value)}
                      category={selected.category}
                    />
                  ))}
                </Box>
              </BentoPanel>
            ) : (
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: '5px', gridColumn: { xs: 'span 12', lg: 'span 7' } }} />
            )}

            {/* Projected result */}
            {detailReady && (
              <BentoPanel
                accent={theme.palette.primary.main}
                id="craft-result" title={t('Projected result', 'Résultat prévu')}
                note={t('base → simulated · difference', 'base → simulation · écart')}
                span={5}
                right={
                  <ButtonBase
                    onClick={toggleRadar}
                    aria-pressed={radarOpen}
                    title={radarOpen
                      ? t('Show the stat meters', 'Afficher les barres de stats')
                      : t('Show the impact radar', 'Afficher le radar d’impact')}
                    sx={{
                      ...ghostButtonSx,
                      border: `1px solid ${radarOpen ? theme.palette.ui.borderAccent : theme.palette.ui.borderStrong}`,
                      borderRadius: '6px',
                      ...(radarOpen ? { color: 'primary.main', backgroundColor: alpha(theme.palette.primary.main, 0.13) } : null),
                    }}
                  >
                    {t('RADAR', 'RADAR')}
                  </ButtonBase>
                }
                bodySx={{ p: 1.75 }}
              >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, gap: 1.75, alignItems: 'start' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <BuildIndexKnob score={qualityScore} color={grade.color} />
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 20,
                        px: 1.125,
                        borderRadius: '6px',
                        backgroundColor: alpha(grade.color, 0.14),
                        border: `1px solid ${alpha(grade.color, 0.38)}`,
                        color: grade.color,
                        fontFamily: FONT_MONO,
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                      }}
                    >
                      {loc(grade.label, lang)} · Q{qualityScore}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, textAlign: 'center' }}>
                      <Box>
                        <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.74rem', color: 'text.secondary' }}>
                          {craftTimeLabel}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled' }}>
                          {t('craft', 'craft')}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.74rem', color: 'text.secondary' }}>
                          {totalRequiredScu > 0 ? formatResourceQuantity(totalRequiredScu, 'scu', lang) : '—'}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled' }}>
                          {t('materials', 'matériaux')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/*
                    The radar takes the meters' place rather than unfolding below
                    them: both read the same projection, so showing them at once
                    only made the panel taller than the card beside it.
                  */}
                  {radarOpen ? (
                    <Box className="if-appear" sx={{ minWidth: 0 }}>
                      <StatImpactRadar blueprint={selected} projectedStats={projectedStats} />
                    </Box>
                  ) : (
                    <Box className="if-appear" sx={{ minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: '9px 14px', alignContent: 'start' }}>
                      {statMeters.length > 0 ? (
                        statMeters.map((meter) => <StatMeterRow key={meter.key} meter={meter} />)
                      ) : (
                        <Typography sx={{ fontSize: TEXT_LABEL, color: 'text.disabled' }}>
                          {t('No modifiable stats', 'Aucune stat modifiable')}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </BentoPanel>
            )}

            {/* Acquisition routes */}
            {lanes.length > 0 ? (
              <AcquisitionRoutes
                id="craft-acquire"
                lanes={lanes}
                progress={progress}
                onReach={handleReach}
              />
            ) : (
              <BentoPanel accent={theme.palette.domain.blue} id="craft-acquire" title={t('Acquisition routes', 'Routes d’acquisition')} span={12} bodySx={{ p: 1.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {missionRewards
                    ? t(
                        'This blueprint is not rewarded by any known mission in the current dataset.',
                        'Ce blueprint n’est récompensé par aucune mission connue dans ce build du jeu.',
                      )
                    : t('Loading mission rewards…', 'Chargement des récompenses de mission…')}
                </Typography>
              </BentoPanel>
            )}

            {/* Materials & sourcing */}
            {showMaterials && (
              <BentoPanel
                accent={theme.palette.domain.green}
                id="craft-materials" title={t('Materials & sourcing', 'Matériaux & sourcing')}
                span={closingPanelSpan}
                right={
                  <BentoHero
                    value={totalRequiredScu > 0 ? formatResourceQuantity(totalRequiredScu, 'scu', lang) : String(requiredResources.length)}
                    unit={t('total', 'total')}
                  />
                }
              >
                {/* Column header — mirrors the slot table's density language. */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: MATERIAL_GRID,
                    gap: 1,
                    px: 1.5,
                    py: 0.625,
                    borderBottom: `1px solid ${theme.palette.ui.border}`,
                  }}
                >
                  <span />
                  <Typography sx={materialHeadSx}>{t('Top source', 'Source principale')}</Typography>
                  <Typography sx={{ ...materialHeadSx, textAlign: 'right' }}>{t('Need', 'Besoin')}</Typography>
                  <Typography sx={{ ...materialHeadSx, textAlign: 'right' }}>{t('System', 'Système')}</Typography>
                  <span />
                </Box>
                {requiredResources.map((resource) => {
                  const sourceEntry = resolveMaterialSource(materialSources, resource.resourceName);
                  const topProvider = sourceEntry?.providers
                    ?.slice()
                    .sort((a, b) => (b.groupProbabilityPct ?? 0) - (a.groupProbabilityPct ?? 0))[0];
                  return (
                    <Box
                      key={resource.resourceName}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: MATERIAL_GRID,
                        gap: 1,
                        alignItems: 'center',
                        px: 1.5,
                        py: 0.75,
                        borderBottom: `1px solid ${theme.palette.ui.border}`,
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
                      }}
                    >
                      <ResourceIcon name={resource.resourceName} size={18} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {resource.resourceName}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, minWidth: 0 }}>
                          <Typography
                            sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {topProvider?.providerDisplayName ?? t('No source data', 'Pas de source connue')}
                          </Typography>
                          {topProvider?.groupProbabilityPct != null && (
                            <Box
                              sx={{
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: 13,
                                px: 0.5,
                                borderRadius: '3px',
                                backgroundColor: alpha(theme.palette.domain.green, 0.15),
                                color: theme.palette.domain.green,
                                fontFamily: FONT_MONO,
                                fontSize: '0.54rem',
                                fontWeight: 700,
                              }}
                            >
                              {topProvider.groupProbabilityPct.toFixed(0)}%
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.76rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatResourceQuantity(resource.totalScu * qty, resource.quantityUnit, lang)}
                      </Typography>
                      <Typography
                        sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {topProvider?.system ?? '—'}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`${t('Add to planner', 'Ajouter au planner')} — ${resource.resourceName}`}
                        title={t('Add to planner', 'Ajouter au planner')}
                        onClick={() => addPlannerResourceRequirement(
                          resource.resourceName,
                          resource.totalScu * qty,
                          resource.quantityUnit === 'count' ? 'count' : 'scu',
                        )}
                        sx={{ p: 0.4, justifySelf: 'center' }}
                      >
                        <PlaylistAddIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </BentoPanel>
            )}

            {/* Nominal dismantle estimate */}
            {showDismantle && (
              <BentoPanel
                accent={theme.palette.domain.orange}
                id="craft-dismantle" title={t('Estimated dismantle return', 'Estimation du démontage')}
                span={closingPanelSpan}
                right={
                  <>
                    <Typography
                      title={t('Dismantle time', 'Temps de démontage')}
                      sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled' }}
                    >
                      {t('Time', 'Durée')}{' '}
                      {dismantleTimeSecs >= 60
                        ? `${Math.floor(dismantleTimeSecs / 60)}m ${dismantleTimeSecs % 60 ? `${dismantleTimeSecs % 60}s` : ''}`.trim()
                        : `${dismantleTimeSecs}s`}
                    </Typography>
                    <BentoHero
                      value={dismantleEffectiveRatio == null ? '—' : `${Math.round(dismantleEffectiveRatio * 100)}%`}
                      unit={t('estimated', 'estimé')}
                      color={theme.palette.domain.orange}
                    />
                  </>
                }
              >
                <Box sx={{ px: 1.5, py: 1.125, borderBottom: `1px solid ${theme.palette.ui.border}` }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 17,
                        px: 0.75,
                        border: `1px solid ${alpha(theme.palette.domain.orange, 0.5)}`,
                        borderRadius: '4px',
                        backgroundColor: alpha(theme.palette.domain.orange, 0.1),
                        color: theme.palette.domain.orange,
                        fontFamily: FONT_MONO,
                        fontSize: '0.52rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                      }}
                    >
                      {dismantleIsDeterministic
                        ? t('CALCULATED ESTIMATE', 'ESTIMATION CALCULÉE')
                        : t('VARIABLE RECIPE', 'RECETTE VARIABLE')}
                    </Box>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled' }}>
                      {qty > 1 ? t(`${qty} items`, `${qty} objets`) : t('per item', 'par objet')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      {dismantleIsDeterministic
                        ? t(
                            `Minimum recipe composition × ${Math.round(dismantleEfficiency * 100)}% base efficiency`,
                            `Composition minimale de la recette × ${Math.round(dismantleEfficiency * 100)} % d’efficacité de base`,
                          )
                        : t(
                            'This recipe contains a material choice, so it has no single return estimate.',
                            'Cette recette contient un choix de matériaux : elle n’a donc pas d’estimation unique.',
                          )}
                    </Typography>
                    {dismantleIsDeterministic && (
                      <Typography sx={{ flexShrink: 0, fontFamily: FONT_MONO, fontSize: '0.68rem', fontWeight: 800, color: theme.palette.domain.orange }}>
                        ≈ {formatResourceQuantity(dismantleTotalYieldScu, 'scu', lang)}
                      </Typography>
                    )}
                  </Box>
                  {dismantleIsDeterministic && (
                    <Typography
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: '0.56rem',
                        color: 'text.disabled',
                        mt: 0.375,
                      }}
                    >
                      {t(
                        'The game provides the efficiency and blacklist; material amounts are inferred from the blueprint composition.',
                        'Le jeu fournit l’efficacité et la blacklist ; les quantités sont déduites de la composition du blueprint.',
                      )}
                    </Typography>
                  )}
                </Box>

                {dismantleIsDeterministic && (
                  <>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: DISMANTLE_GRID,
                        gap: 1,
                        px: 1.5,
                        py: 0.625,
                        borderBottom: `1px solid ${theme.palette.ui.border}`,
                      }}
                    >
                      <span />
                      <Typography sx={materialHeadSx}>{t('Material', 'Matériau')}</Typography>
                      <Typography sx={{ ...materialHeadSx, textAlign: 'right' }}>{t('Recipe', 'Recette')}</Typography>
                      <Typography sx={{ ...materialHeadSx, textAlign: 'right' }}>{t('Estimate', 'Estimation')}</Typography>
                    </Box>
                    {dismantleRows.map((entry) => (
                      <Box
                        key={entry.name}
                        title={entry.blacklisted
                          ? t(
                              'Consumed by crafting but never returned by dismantling.',
                              'Consommé par le craft mais jamais rendu au démontage.',
                            )
                          : undefined}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: DISMANTLE_GRID,
                          gap: 1,
                          alignItems: 'center',
                          px: 1.5,
                          py: 0.75,
                          borderBottom: `1px solid ${theme.palette.ui.border}`,
                          opacity: entry.blacklisted ? 0.58 : 1,
                          '&:hover': { backgroundColor: alpha(theme.palette.domain.orange, 0.06) },
                        }}
                      >
                        <ResourceIcon name={entry.name} size={18} />
                        <Typography sx={{ minWidth: 0, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.name}
                          {entry.blacklisted && (
                            <Box component="span" sx={{ ml: 0.5, fontSize: '0.58rem', color: 'text.disabled', fontWeight: 500 }}>
                              {t('not recoverable', 'non récupérable')}
                            </Box>
                          )}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.68rem', color: 'text.secondary', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {formatResourceQuantity(entry.costScu, 'scu', lang)}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.76rem', fontWeight: 800, color: entry.blacklisted ? 'text.disabled' : theme.palette.domain.orange, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {entry.blacklisted ? '—' : formatResourceQuantity(entry.yieldScu, 'scu', lang)}
                        </Typography>
                      </Box>
                    ))}
                  </>
                )}
                <Typography
                  sx={{
                    px: 1.5,
                    py: 1,
                    fontFamily: FONT_MONO,
                    fontSize: '0.6875rem',
                    lineHeight: 1.45,
                    color: 'text.disabled',
                  }}
                >
                  {!dismantleIsDeterministic
                    ? t(
                        'Choose the recipe materials in game to know the composition that will be dismantled.',
                        'Choisissez les matériaux de la recette en jeu pour connaître la composition qui sera démontée.',
                      )
                    : recoversNothing
                    ? t(
                        'Every input of this recipe is blacklisted — dismantling returns nothing.',
                        'Tous les intrants de cette recette sont blacklistés — le démontage ne rend rien.',
                      )
                    : t(
                        'Nominal estimate only. The actual crafted instance may contain more allocated material; blacklisted resources always return zero.',
                        'Estimation nominale uniquement. L’objet fabriqué peut contenir davantage de matière allouée ; les ressources blacklistées rendent toujours zéro.',
                      )}
                </Typography>
              </BentoPanel>
            )}

            {/* Field data */}
            {detailReady && (
              <BentoPanel id="craft-data" title={t('Field data', 'Données objet', 'Objektdaten')} span={closingPanelSpan}
                bodySx={{ p: 1.5 }}>
                {hasBlueprintFieldData(selected) ? (
                  <FieldDataBody blueprint={selected} />
                ) : (
                  <Typography sx={{ fontSize: TEXT_LABEL, color: 'text.disabled' }}>
                    {t('No field data for this item', 'Aucune donnée objet pour cet item')}
                  </Typography>
                )}
              </BentoPanel>
            )}
          </Box>
        </>
      )}
    </PageLayout>
  );
}

export default FabricatorPage;
