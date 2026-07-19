import { Box, ButtonBase, Divider, IconButton, Paper, Skeleton, Typography, alpha, useTheme } from '../ui/system';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_SM } from '../theme';
import { FieldDataBody, hasBlueprintFieldData } from './item-workspace/CraftSection';
import { StatImpactRadar } from './item-workspace/shared/StatImpactRadar';
import { ResourceIcon } from './ui/ResourceIcon';
import { AppButton } from './ui/controls';
import { PageLayout } from './ui/page';
import { RarityBadge } from './ui/RarityBadge';
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

const LAST_BLUEPRINT_KEY = 'if-fabricator-last-blueprint';
const PROGRESS_KEY = 'if-acquisition-progress';
const MISSION_PICKS_KEY = 'if-fabricator-mission-picks';

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

/** Selected grind missions per `${scopeKey}|${tierRep}` — a personal to-do list. */
type MissionPicksMap = Record<string, string[]>;

function readMissionPicks(): MissionPicksMap {
  try {
    const raw = window.localStorage.getItem(MISSION_PICKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as MissionPicksMap) : {};
  } catch {
    return {};
  }
}

function writeMissionPicks(map: MissionPicksMap) {
  try {
    window.localStorage.setItem(MISSION_PICKS_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — picks simply won't persist
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
      return { tier, targetContracts, grindContracts };
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
  if (score >= 80) return { label: { en: 'Excellent', fr: 'Excellent', de: 'Exzellent' }, color: theme.palette.success.main };
  if (score >= 60) return { label: { en: 'High', fr: 'Élevé', de: 'Hoch' }, color: theme.palette.primary.main };
  if (score >= 40) return { label: { en: 'Standard', fr: 'Standard', de: 'Standard' }, color: theme.palette.text.secondary };
  if (score >= 20) return { label: { en: 'Poor', fr: 'Médiocre', de: 'Mäßig' }, color: theme.palette.warning.main };
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
        borderRadius: '9px',
        backgroundColor: 'ui.surface',
        px: 1.5,
        py: 1.125,
        minWidth: 0,
        overflow: 'hidden',
        boxShadow: `inset 2px 0 0 0 ${accent}`,
      }}
    >
      <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary', mb: 0.625, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: '1.3rem',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'text.primary',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </Typography>
      {meterPct != null ? (
        <Box sx={{ mt: 0.875, height: 3, borderRadius: '2px', backgroundColor: 'ui.surface3', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, meterPct))}%`, backgroundColor: accent, borderRadius: '2px' }} />
        </Box>
      ) : (
        <Typography
          sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.disabled', mt: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {hint ?? ' '}
        </Typography>
      )}
    </Paper>
  );
}

/** Shared column template for the Materials & sourcing table. */
const MATERIAL_GRID = '18px minmax(0, 1fr) 68px 58px 24px';

const materialHeadSx = {
  fontFamily: FONT_MONO,
  fontSize: '0.56rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.disabled',
} as const;

// ─── Item description (clamped, expandable) ──────────────────────────────────

function ItemDescription({ blueprint }: { blueprint: Blueprint }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const description = blueprint.identity?.descriptionBody ?? blueprint.identity?.description;
  if (!description) return null;
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? undefined : t('Click to expand', 'Cliquer pour déplier')}
        sx={{
          fontSize: TEXT_LABEL,
          lineHeight: 1.5,
          color: 'text.secondary',
          cursor: 'pointer',
          ...(expanded ? {} : {
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        {description}
      </Typography>
      <Divider sx={{ mt: 1.25 }} />
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
    addPlannerResourceRequirement,
    dismantlingData,
    materialSources,
  } = useCraft();

  const blueprints = activeDataset.blueprints;

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(LAST_BLUEPRINT_KEY);
    } catch {
      return null;
    }
  });
  const [progress, setProgress] = useState<ProgressMap>(() => readProgress());
  /**
   * Transient confirmation on the Add-to-Planner button (design: 1.6s). Keyed
   * on the click timestamp, not a boolean: re-clicking while the confirmation
   * is still showing has to restart the window, and a boolean would not change
   * state and so would never re-run the effect.
   */
  const [plannedAt, setPlannedAt] = useState<number | null>(null);
  const planned = plannedAt !== null;
  useEffect(() => {
    if (plannedAt === null) return;
    const timer = window.setTimeout(() => setPlannedAt(null), 1600);
    return () => window.clearTimeout(timer);
  }, [plannedAt]);
  const [missionPicks, setMissionPicks] = useState<MissionPicksMap>(() => readMissionPicks());
  const [radarOpen, setRadarOpen] = useState(false);

  const toggleMissionPick = useCallback((tierKey: string, contractName: string) => {
    setMissionPicks((prev) => {
      const current = prev[tierKey] ?? [];
      const nextList = current.includes(contractName)
        ? current.filter((name) => name !== contractName)
        : [...current, contractName];
      const next = { ...prev, [tierKey]: nextList };
      writeMissionPicks(next);
      return next;
    });
  }, []);

  /** Bulk-write whole tiers of picks — the routes panel owns which and why. */
  const setTierPicks = useCallback((entries: Record<string, string[]>) => {
    setMissionPicks((prev) => {
      const next = { ...prev, ...entries };
      writeMissionPicks(next);
      return next;
    });
  }, []);

  // Local craft simulation state — independent from the /item workspace.
  const [qty, setQty] = useState(1);
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number | undefined>>({});
  const assignQuality = useCallback((slotId: string, value: number | undefined) => {
    setSlotAssignments((prev) => ({ ...prev, [slotId]: value }));
  }, []);
  const clearAssignments = useCallback(() => setSlotAssignments({}), []);
  useEffect(() => {
    setSlotAssignments({});
    setQty(1);
  }, [selectedId]);

  useEffect(() => {
    if (activeDataset.datasetId) void ensureMissionRewardsLoaded();
  }, [activeDataset.datasetId, ensureMissionRewardsLoaded]);

  // Blueprint selection comes from the header search (which navigates to
  // /item/<slug>) or the suggestion cards below — the page carries no picker of
  // its own. The lootable-only scoping lives on the Blueprints library as the
  // "Obtainable" segment, which filters on the same acquisition graph.

  // Default selection: last viewed blueprint, else the CQ7 Rifle. A persisted
  // id can go stale across dataset switches — treat it like no selection.
  useEffect(() => {
    if (blueprints.length === 0) return;
    if (selectedId && blueprints.some((bp) => bp.id === selectedId)) return;
    if (itemSlugFromPathname(window.location.pathname)) return;
    const cq7 = blueprints.find((bp) => bp.name.toLowerCase() === 'cq7 rifle')
      ?? blueprints.find((bp) => bp.name.toLowerCase().includes('cq7'));
    if (cq7) setSelectedId(cq7.id);
  }, [blueprints, selectedId]);

  // Deep links: /item/<slug> selects the blueprint here (the Fabricator IS
  // the item page); back/forward keep the selection in sync.
  useEffect(() => {
    const syncFromUrl = () => {
      const slug = itemSlugFromPathname(window.location.pathname);
      if (!slug) return;
      const fromUrl = blueprints.find((bp) => toSlug(bp.name) === slug);
      if (fromUrl) setSelectedId(fromUrl.id);
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
    try {
      if (bp) window.localStorage.setItem(LAST_BLUEPRINT_KEY, bp.id);
      else window.localStorage.removeItem(LAST_BLUEPRINT_KEY);
    } catch {
      // best effort
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

  const dismantleTimeSecs = dismantlingData?.dismantling?.blueprint?.dismantleTimeSecs ?? 0;
  const dismantleEfficiency = dismantlingData?.dismantling?.blueprint?.efficiency ?? 0.5;

  const inInventory = selected ? inventoryIds.includes(selected.id) : false;
  const isFavorite = selected ? favoriteIds.includes(selected.id) : false;

  const heroImage = selected?.media?.primaryVisual?.imageUrl ?? selected?.media?.image?.imageUrl ?? null;
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
    fontSize: '0.64rem',
    color: 'text.secondary',
    '&:hover': { color: 'primary.main' },
  } as const;

  return (
    <PageLayout width="full" component="main" sx={{ maxWidth: 1760, gap: 1.125, py: 1.375, px: { xs: 1.25, md: 1.625 } }}>
      {missionRewardsLoading && !missionRewards && !selected && (
        <Box sx={{ maxWidth: 640 }}>
          <AppProgressBar sx={{ mb: 1.5 }} />
          <Skeleton variant="rectangular" height={120} />
        </Box>
      )}

      {/* Empty state: pitch + suggestions */}
      {!selected && (
        <Box sx={{ maxWidth: 900 }}>
          <Typography
            component="h1"
            sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: '1.28rem', letterSpacing: '-0.01em', color: 'text.primary' }}
          >
            {t('Select a blueprint', 'Sélectionnez un blueprint')}
          </Typography>
          <Typography sx={{ fontSize: TEXT_LABEL, color: 'text.secondary', mt: 0.5, mb: 2 }}>
            {t(
              'Pick a blueprint to simulate its craft and see the reputation path to unlock it.',
              'Choisis un blueprint pour simuler son craft et voir le chemin de réputation pour le débloquer.',
            )}
          </Typography>
          {missionRewards && (
            <>
          <Typography variant="overline" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
            {t('Easiest confirmed drops', 'Drops confirmés les plus accessibles')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1.25 }}>
            {suggestions.map((s) => (
              <Paper
                key={s.blueprint.id}
                component="button"
                type="button"
                onClick={() => {
                  const bp = blueprints.find((b) => b.id === s.blueprint.id);
                  if (bp) handleSelect(bp);
                }}
                variant="outlined"
                sx={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  p: 1.25,
                  transition: 'border-color 140ms ease',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>{s.blueprint.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.4 }}>
                  {[s.blueprint.manufacturer, s.blueprint.category].filter(Boolean).join(' / ')}
                </Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled' }}>
                  {s.contractCount} {t('contracts', 'contrats')} · {s.localityCount} {t('localities', 'localités')}
                </Typography>
              </Paper>
            ))}
          </Box>
            </>
          )}
        </Box>
      )}

      {selected && (
        <>
          {/* ── Identity + command strip ── */}
          <Paper
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.625,
              flexWrap: 'wrap',
              px: 1.5,
              py: 1.125,
              borderRadius: '9px',
              backgroundColor: 'ui.surface',
              boxShadow: `inset 3px 0 0 0 ${theme.palette.primary.main}`,
            }}
          >
            {heroImage && (
              <Box
                component="img"
                src={heroImage}
                alt=""
                sx={{ width: 46, height: 46, objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: `1px solid ${theme.palette.ui.border}` }}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
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
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto', flexShrink: 0 }}>
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
            </Box>
          </Paper>

          {/* ── KPI ribbon ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.125 }}>
            <KpiTile
              label={t('Best drop chance', 'Meilleure chance')}
              value={!missionRewards ? '…' : entry ? formatProbabilityPercent(bestChance) : '—'}
              accent={theme.palette.domain.blue}
              meterPct={entry ? bestChance * 100 : 0}
            />
            <KpiTile
              label={t('Reputation needed', 'Réputation requise')}
              value={!missionRewards ? '…' : topStanding?.standingName ?? t('None', 'Aucune')}
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

          {/* ── Bento work grid ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1.125, alignItems: 'start' }}>
            {/* Craft simulator */}
            {detailReady ? (
              <BentoPanel
                accent={theme.palette.primary.main}
                title={t('Craft simulator', 'Simulateur de craft')}
                note={t('assign material quality', 'assigne la qualité des matériaux')}
                span={7}
                right={
                  <>
                    <Typography
                      sx={{ fontFamily: FONT_MONO, fontSize: '0.66rem', color: allSlotsValid ? 'success.main' : 'warning.main' }}
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
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: '9px', gridColumn: { xs: 'span 12', lg: 'span 7' } }} />
            )}

            {/* Projected result */}
            {detailReady && (
              <BentoPanel
                accent={theme.palette.primary.main}
                title={t('Projected result', 'Résultat prévu')}
                note={t('live · updates with sliders', 'live · suit les sliders')}
                span={5}
                right={
                  <ButtonBase
                    onClick={() => setRadarOpen((v) => !v)}
                    aria-expanded={radarOpen}
                    sx={{ ...ghostButtonSx, border: `1px solid ${theme.palette.ui.borderStrong}`, borderRadius: '6px' }}
                  >
                    {t('RADAR', 'RADAR')} {radarOpen ? '▴' : '▾'}
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
                        fontSize: '0.66rem',
                      }}
                    >
                      {loc(grade.label, lang)} · Q{qualityScore}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, textAlign: 'center' }}>
                      <Box>
                        <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.74rem', color: 'text.secondary' }}>
                          {craftTimeLabel}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.disabled' }}>
                          {t('craft', 'craft')}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.74rem', color: 'text.secondary' }}>
                          {totalRequiredScu > 0 ? formatResourceQuantity(totalRequiredScu, 'scu', lang) : '—'}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.disabled' }}>
                          {t('materials', 'matériaux')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ minWidth: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: '9px 14px', alignContent: 'start' }}>
                    {statMeters.length > 0 ? (
                      statMeters.map((meter) => <StatMeterRow key={meter.key} meter={meter} />)
                    ) : (
                      <Typography sx={{ fontSize: TEXT_LABEL, color: 'text.disabled' }}>
                        {t('No modifiable stats', 'Aucune stat modifiable')}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {radarOpen && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${theme.palette.ui.border}` }}>
                    <StatImpactRadar blueprint={selected} projectedStats={projectedStats} />
                  </Box>
                )}
              </BentoPanel>
            )}

            {/* Acquisition routes */}
            {lanes.length > 0 ? (
              <AcquisitionRoutes
                lanes={lanes}
                progress={progress}
                onReach={handleReach}
                missionPicks={missionPicks}
                onToggleMissionPick={toggleMissionPick}
                onSetTierPicks={setTierPicks}
              />
            ) : (
              <BentoPanel accent={theme.palette.domain.blue} title={t('Acquisition routes', 'Routes d’acquisition')} span={12} bodySx={{ p: 1.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {missionRewards
                    ? t(
                        'This blueprint is not rewarded by any known mission in the current dataset.',
                        'Ce blueprint n’est récompensé par aucune mission connue dans le dataset actuel.',
                      )
                    : t('Loading mission rewards…', 'Chargement des récompenses de mission…')}
                </Typography>
              </BentoPanel>
            )}

            {/* Materials & sourcing */}
            {detailReady && requiredResources.length > 0 && (
              <BentoPanel
                accent={theme.palette.domain.green}
                title={t('Materials & sourcing', 'Matériaux & sourcing')}
                span={5}
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
                            sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
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
                        sx={{ fontFamily: FONT_MONO, fontSize: '0.64rem', color: 'text.disabled', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
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

            {/* Dismantle yield */}
            {detailReady && dismantleTimeSecs > 0 && requiredResources.length > 0 && (
              <BentoPanel
                accent={theme.palette.domain.orange}
                title={t('Dismantle yield', 'Rendement démontage')}
                span={4}
                right={
                  <>
                    <Typography
                      title={t('Dismantle time', 'Temps de démontage')}
                      sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.disabled' }}
                    >
                      {t('Time', 'Durée')}{' '}
                      {dismantleTimeSecs >= 60
                        ? `${Math.floor(dismantleTimeSecs / 60)}m ${dismantleTimeSecs % 60 ? `${dismantleTimeSecs % 60}s` : ''}`.trim()
                        : `${dismantleTimeSecs}s`}
                    </Typography>
                    <BentoHero value={`${Math.round(dismantleEfficiency * 100)}%`} unit={t('recovery', 'récup.')} color={theme.palette.domain.orange} />
                  </>
                }
                bodySx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '6px 14px' }}
              >
                <Typography
                  sx={{
                    gridColumn: '1 / -1',
                    fontFamily: FONT_MONO,
                    fontSize: '0.57rem',
                    lineHeight: 1.45,
                    color: 'text.disabled',
                  }}
                >
                  {t(
                    `Derived from the crafted item's runtime composition × ${dismantleEfficiency} — no static per-item table.`,
                    `Dérivé de la composition runtime de l’objet crafté × ${dismantleEfficiency} — pas de table statique par objet.`,
                  )}
                </Typography>
                {requiredResources.map((resource) => (
                  <Box key={resource.resourceName} sx={{ display: 'flex', alignItems: 'center', gap: 0.875, minWidth: 0 }}>
                    <ResourceIcon name={resource.resourceName} size={15} />
                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.74rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {resource.resourceName}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.74rem', fontWeight: 700 }}>
                      {formatResourceQuantity(Math.round(resource.totalScu * dismantleEfficiency * 1000) / 1000, resource.quantityUnit, lang)}
                    </Typography>
                  </Box>
                ))}
              </BentoPanel>
            )}

            {/* Field data */}
            {detailReady && (
              <BentoPanel title={t('Field data', 'Données objet')} span={3} bodySx={{ p: 1.5 }}>
                <ItemDescription blueprint={selected} />
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
