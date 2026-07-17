import { Box, Divider, IconButton, Paper, Skeleton, Stack, Typography, alpha, useTheme } from '../ui/system';
import { AppProgressBar } from './ui/feedback';
import { CheckCircleIcon, ExpandMoreIcon, RadioButtonUncheckedIcon, ChevronRightIcon, PlaceOutlinedIcon, FlagOutlinedIcon, Inventory2OutlinedIcon, StarIcon, StarBorderIcon, PlaylistAddIcon, AddIcon, RemoveIcon } from '../ui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_LG, TEXT_LABEL_SM } from '../theme';
import { CraftSection, FieldDataBody, hasBlueprintFieldData } from './item-workspace/CraftSection';
import { ResourceIcon } from './ui/ResourceIcon';
import { AppAutocomplete, AppButton, AppCheckbox } from './ui/controls';
import { AppOverlayPanel } from './ui/overlays';
import { AppChip } from './ui/data-display/AppChip';
import { PageHeader, PageLayout } from './ui/page';
import { Panel } from './ui/Panel';
import { PageStatCard } from './ui/PageStatCard';
import { RarityBadge } from './ui/RarityBadge';
import { aggregateBlueprintResources, formatProbabilityPercent, formatResourceQuantity, getAcquisitionEntry } from '../utils/crafting';
import { itemSlugFromPathname, navigateToPath, toSlug } from '../utils/slug';
import type {
  AcquisitionContract,
  AggregatedResource,
  MaterialSourceEntry,
  MaterialSources,
  AcquisitionFaction,
  AcquisitionGraphEntry,
  Blueprint,
  MissionContract,
  MissionReputationScope,
  MissionStandingTier,
} from '../types';

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

function contractDisplayName(contract: { title?: { displayText?: string | null; template?: string | null } | null; contractDebugName?: string | null }): string {
  const display = contract.title?.displayText?.trim() || contract.title?.template?.trim();
  if (display) return display.replace(/~mission\((\w+)\)/g, '<$1>');
  const debug = contract.contractDebugName ?? '';
  return debug.replace(/_/g, ' ').trim() || 'Contract';
}

interface LaneTier {
  tier: MissionStandingTier;
  /** Contracts that can reward the selected blueprint, unlocked exactly at this tier. */
  targetContracts: AcquisitionContract[];
  /** Other contracts of the same faction/scope unlocked at this tier (reputation grind pool). */
  grindContracts: MissionContract[];
}

interface Lane {
  faction: AcquisitionFaction;
  factionGroupId: string | null;
  scope: MissionReputationScope | null;
  scopeKey: string;
  tiers: LaneTier[];
  /** Reputation threshold of the highest tier needed to unlock every target contract. */
  maxNeededReputation: number;
  bestChance: number;
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

// ─── Mission multi-select (grind pool of one tier) ───────────────────────────

function missionSecondaryLine(contract: MissionContract): string {
  const parts: string[] = [];
  const localities = contract.availability?.localities ?? [];
  if (localities.length > 0) parts.push(localities.join(' · '));
  if (contract.contractType) parts.push(contract.contractType.replace(/Contract$/, ''));
  return parts.join('  —  ');
}

function MissionPickMenu({
  contracts,
  picked,
  onToggle,
}: {
  contracts: MissionContract[];
  picked: string[];
  onToggle: (contractName: string) => void;
}) {
  const { t } = useI18n();
  const pickedSet = useMemo(() => new Set(picked), [picked]);

  return (
    <AppOverlayPanel
      ariaLabel={t('Pick missions to grind', 'Choisir les missions a grind')}
      partSx={{ content: { maxHeight: 380, width: 340, overflowY: 'auto', p: 0.5 } }}
      trigger={
        <AppButton
          variant="secondary"
          size="sm"
          aria-expanded={false}
          endIcon={<ExpandMoreIcon sx={{ fontSize: 15 }} />}
          sx={{
            width: '100%',
            justifyContent: 'space-between',
            px: 1,
            py: 0.4,
            fontSize: TEXT_LABEL,
            fontWeight: 600,
            color: picked.length > 0 ? 'primary.main' : 'text.secondary',
            borderColor: picked.length > 0 ? 'primary.main' : 'ui.borderStrong',
          }}
        >
          {picked.length > 0
            ? `${picked.length}/${contracts.length} ${t('missions picked', 'missions choisies')}`
            : `${contracts.length} ${t('missions to grind', 'missions de grind')}`}
        </AppButton>
      }
    >
      <Box component="ul" role="group" aria-label={t('Missions', 'Missions')} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {contracts.map((contract) => {
          const name = contract.contractDebugName ?? '';
          const rewardCount = contract.rewardedBlueprints?.length ?? 0;
          return (
            <Box
              key={name}
              component="li"
              sx={{
                px: 1,
                py: 0.6,
                borderRadius: 0.75,
                '&:hover': { backgroundColor: 'ui.surface2' },
              }}
            >
              <AppCheckbox
                checked={pickedSet.has(name)}
                onCheckedChange={() => onToggle(name)}
                sx={{ width: '100%', alignItems: 'flex-start' }}
                label={
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.25 }}>
                      {contractDisplayName(contract)}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled', lineHeight: 1.3 }}>
                      {missionSecondaryLine(contract)}
                    </Typography>
                    {rewardCount > 0 && (
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary', lineHeight: 1.3 }}>
                        {rewardCount} {t('blueprints in reward pool', 'blueprints dans le pool de récompense')}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </Box>
          );
        })}
      </Box>
    </AppOverlayPanel>
  );
}

// ─── Reputation lane (one faction) — horizontal tier pipeline ────────────────

function ReputationLane({
  lane,
  reachedReputation,
  onReach,
  missionPicks,
  onToggleMissionPick,
}: {
  lane: Lane;
  reachedReputation: number;
  onReach: (rep: number) => void;
  missionPicks: MissionPicksMap;
  onToggleMissionPick: (tierKey: string, contractName: string) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const magenta = theme.palette.domain.magenta;
  const blue = theme.palette.domain.blue;

  const remainingTiers = lane.tiers.filter((lt) => (lt.tier.minReputation ?? 0) > reachedReputation).length;
  const scopeName = lane.scope?.displayName ?? lane.scope?.scopeName;

  return (
    <Panel
      eyebrow={t('Reputation', 'Réputation')}
      title={
        scopeName
          ? `${lane.faction.contractorDisplayName ?? t('Faction', 'Faction')} — ${scopeName}`
          : lane.faction.contractorDisplayName ?? t('Faction', 'Faction')
      }
      subtitle={
        remainingTiers === 0
          ? t('Target tier reached — farm the highlighted contracts', 'Palier cible atteint — farme les contrats en surbrillance')
          : `${remainingTiers} ${remainingTiers === 1 ? t('tier to climb', 'palier à grimper') : t('tiers to climb', 'paliers à grimper')}`
      }
      accent={magenta}
      heroValue={formatProbabilityPercent(lane.bestChance)}
      heroUnit={t('best drop', 'meilleur drop')}
      collapsible
      dense
      noPad
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', px: 1.5, py: 1.25, gap: 0.5 }}>
        {lane.tiers.map((laneTier, index) => {
          const rep = laneTier.tier.minReputation ?? 0;
          const reached = rep <= reachedReputation;
          const isNext = !reached && lane.tiers.findIndex((lt) => (lt.tier.minReputation ?? 0) > reachedReputation) === index;
          const hasTargets = laneTier.targetContracts.length > 0;
          const isLast = index === lane.tiers.length - 1;
          const tierKey = `${lane.scopeKey}|${rep}`;

          return (
            <Box key={`${rep}-${laneTier.tier.displayName ?? index}`} sx={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
              {/* Tier column */}
              <Box
                sx={{
                  width: 250,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  p: 1,
                  borderRadius: 1.5,
                  border: `1px solid ${isNext ? alpha(magenta, 0.45) : theme.palette.ui.border}`,
                  backgroundColor: isNext
                    ? alpha(magenta, 0.05)
                    : reached
                      ? alpha(theme.palette.success.main, 0.04)
                      : 'transparent',
                }}
              >
                {/* Tier header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onReach(reached ? rep - 1 : rep)}
                    aria-label={`${laneTier.tier.displayName ?? rep} — ${reached ? t('reached', 'atteint') : t('mark as reached', 'marquer comme atteint')}`}
                    sx={{
                      border: 'none',
                      background: 'none',
                      p: 0,
                      cursor: 'pointer',
                      lineHeight: 0,
                      flexShrink: 0,
                      color: reached ? theme.palette.success.main : isNext ? magenta : theme.palette.text.disabled,
                    }}
                  >
                    {reached
                      ? <CheckCircleIcon sx={{ fontSize: 17 }} />
                      : <RadioButtonUncheckedIcon sx={{ fontSize: 17 }} />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: isNext ? 700 : 600, fontSize: '0.8125rem', lineHeight: 1.15, color: reached ? 'text.secondary' : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {laneTier.tier.displayName ?? t('Entry', 'Départ')}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled', lineHeight: 1.2 }}>
                      {rep.toLocaleString()} rep
                    </Typography>
                  </Box>
                  {isNext && (
                    <AppChip
                      size="sm"
                      label={t('Next', 'Suivant')}
                      sx={{ height: 20, fontSize: '0.625rem', fontWeight: 700, backgroundColor: alpha(magenta, 0.16), color: magenta, flexShrink: 0 }}
                    />
                  )}
                </Box>

                {/* Grind missions multi-select */}
                {laneTier.grindContracts.length > 0 ? (
                  <MissionPickMenu
                    contracts={laneTier.grindContracts}
                    picked={missionPicks[tierKey] ?? []}
                    onToggle={(contractName) => onToggleMissionPick(tierKey, contractName)}
                  />
                ) : !hasTargets ? (
                  <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled' }}>
                    {t('No grind contracts listed here', 'Aucun contrat de grind listé ici')}
                  </Typography>
                ) : null}

                {/* Contracts that drop the blueprint at this tier */}
                {hasTargets && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 'auto' }}>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: blue }}>
                      {t('Drops the blueprint', 'Droppe le blueprint')}
                    </Typography>
                    {laneTier.targetContracts.map((contract) => (
                      <Paper
                        key={contract.contractDebugName}
                        variant="outlined"
                        sx={{
                          px: 0.9,
                          py: 0.55,
                          borderColor: alpha(blue, 0.4),
                          boxShadow: `inset 2px 0 0 0 ${blue}`,
                          backgroundColor: alpha(blue, 0.05),
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.75 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.7188rem', lineHeight: 1.25, minWidth: 0 }}>
                            {contractDisplayName(contract)}
                          </Typography>
                          <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, fontWeight: 700, color: blue, flexShrink: 0 }}>
                            {formatProbabilityPercent(contract.maxChance ?? contract.blueprintDropChance ?? 0)}
                          </Typography>
                        </Box>
                        {(contract.availability?.localities?.length ?? 0) > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.2 }}>
                            <PlaceOutlinedIcon sx={{ fontSize: 10, color: 'text.disabled', flexShrink: 0 }} />
                            <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.625rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {contract.availability.localities.join(' · ')}
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Connector to the next tier */}
              {!isLast && (
                <Box sx={{ display: 'flex', alignItems: 'center', px: 0.25 }}>
                  <ChevronRightIcon sx={{ fontSize: 18, color: reached ? theme.palette.success.main : 'text.disabled' }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Panel>
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
  const [missionPicks, setMissionPicks] = useState<MissionPicksMap>(() => readMissionPicks());

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

  const [lootableOnly, setLootableOnly] = useState(true);
  const [blueprintQuery, setBlueprintQuery] = useState('');

  const lootableIds = useMemo(
    () => new Set((missionRewards?.blueprintAcquisitionGraph ?? []).map((e) => e.blueprint.id)),
    [missionRewards],
  );

  // Search list, restricted to mission-lootable blueprints while the toggle is
  // on (falls back to the full list until mission rewards are known).
  const searchOptions = useMemo(() => {
    const available = lootableOnly && lootableIds.size > 0
      ? blueprints.filter((bp) => lootableIds.has(bp.id))
      : blueprints;
    const query = blueprintQuery.trim().toLowerCase();
    if (!query) return available;
    return available.filter((bp) =>
      [bp.name, bp.manufacturer, bp.category].filter(Boolean).join(' ').toLowerCase().includes(query),
    );
  }, [blueprints, blueprintQuery, lootableOnly, lootableIds]);

  // Default selection: last viewed blueprint, else the CQ7 Rifle.
  useEffect(() => {
    if (selectedId || blueprints.length === 0) return;
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

  const dismantleTimeSecs = dismantlingData?.dismantling?.blueprint?.dismantleTimeSecs ?? 0;
  const dismantleEfficiency = dismantlingData?.dismantling?.blueprint?.efficiency ?? 0.5;

  const inInventory = selected ? inventoryIds.includes(selected.id) : false;
  const isFavorite = selected ? favoriteIds.includes(selected.id) : false;

  const heroImage = selected?.media?.primaryVisual?.imageUrl ?? selected?.media?.image?.imageUrl ?? null;
  const topStanding = entry?.standings?.length
    ? [...entry.standings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0))[0]
    : null;

  return (
    <PageLayout width="full" component="main" sx={{ maxWidth: 1700, gap: 1.5, py: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 } }}>
      <PageHeader
        variant="compact"
        eyebrow={t('Fabricator', 'Fabricator')}
        title={selected?.name ?? t('Select a blueprint', 'Sélectionnez un blueprint')}
        description={selected ? [selected.manufacturer, selected.category].filter(Boolean).join(' · ') : t(
          'Pick a blueprint to simulate its craft and see the reputation path to unlock it.',
          'Choisis un blueprint pour simuler son craft et voir le chemin de réputation pour le débloquer.',
        )}
        meta={selected ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {heroImage && <Box component="img" src={heroImage} alt="" sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 1, border: `1px solid ${theme.palette.ui.border}` }} />}
            {selected.rarity && <RarityBadge rarity={selected.rarity} />}
            <AppChip size="sm" label={selected.category} />
          </Box>
        ) : undefined}
        actions={selected ? (
          <>
            <IconButton size="small" aria-label={inInventory ? t('Remove from inventory', 'Retirer de l’inventaire') : t('Add to inventory', 'Ajouter à l’inventaire')} onClick={() => toggleInventory(selected.id)} sx={{ color: inInventory ? 'primary.main' : 'text.secondary', minWidth: 44, minHeight: 44 }}>
              <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" aria-label={isFavorite ? t('Remove favourite', 'Retirer des favoris') : t('Favourite', 'Favori')} onClick={() => toggleFavorite(selected.id)} sx={{ color: isFavorite ? theme.palette.warning.main : 'text.secondary', minWidth: 44, minHeight: 44 }}>
              {isFavorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <Box role="group" aria-label={t('Craft quantity', 'Quantité à fabriquer')} sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.palette.ui.border}`, borderRadius: 0.75 }}>
              <IconButton size="small" aria-label={t('Decrease quantity', 'Réduire la quantité')} onClick={() => setQty((q) => Math.max(1, q - 1))} sx={{ minWidth: 44, minHeight: 44 }}><RemoveIcon sx={{ fontSize: 14 }} /></IconButton>
              <Typography aria-live="polite" sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>×{qty}</Typography>
              <IconButton size="small" aria-label={t('Increase quantity', 'Augmenter la quantité')} onClick={() => setQty((q) => Math.min(99, q + 1))} sx={{ minWidth: 44, minHeight: 44 }}><AddIcon sx={{ fontSize: 14 }} /></IconButton>
            </Box>
            <AppButton variant="primary" size="sm" startIcon={<PlaylistAddIcon sx={{ fontSize: 14 }} />} onClick={() => addGoal(qualityScore, projectedStats, qty, selected, slotAssignments)} sx={{ minHeight: 44 }}>
              {t('Planner', 'Planner')}
            </AppButton>
          </>
        ) : undefined}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <AppAutocomplete
          value={selected}
          suggestions={searchOptions}
          onValueChange={(value) => {
            if (value && typeof value === 'object') handleSelect(value);
          }}
          onQueryChange={setBlueprintQuery}
          getOptionLabel={(bp) => `${bp.name} — ${[bp.manufacturer, bp.category].filter(Boolean).join(' · ')}`}
          selectedItemTemplate={(bp) => bp.name}
          itemTemplate={(bp) => (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{bp.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>{[bp.manufacturer, bp.category].filter(Boolean).join(' / ')}</Typography>
            </Box>
          )}
          forceSelection
          placeholder={t('Search a blueprint…', 'Rechercher un blueprint…')}
          ariaLabel={t('Search blueprints', 'Rechercher des blueprints')}
          sx={{ width: { xs: '100%', sm: 380 }, minHeight: 44 }}
        />
        <AppCheckbox
          label={<Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary' }}>{t('Lootable only', 'Lootable only')}</Typography>}
          checked={lootableOnly}
          onCheckedChange={setLootableOnly}
          description={t('Only blueprints obtainable from missions', 'Seulement les blueprints obtenables via missions')}
        />
      </Box>

      {missionRewardsLoading && !missionRewards && !selected && (
        <Box sx={{ maxWidth: 640 }}>
          <AppProgressBar sx={{ mb: 1.5 }} />
          <Skeleton variant="rectangular" height={120} />
        </Box>
      )}

      {/* Empty state: pitch + suggestions */}
      {!selected && (
        <Box sx={{ maxWidth: 900 }}>
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
          {/* Stat row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', xl: 'repeat(5, 1fr)' }, gap: 1.25, mb: 1.5 }}>
            <PageStatCard
              label={t('Best drop chance', 'Meilleure chance')}
              value={!missionRewards ? '…' : entry ? formatProbabilityPercent(Math.max(0, ...lanes.map((l) => l.bestChance))) : '—'}
              domain="blue"
              icon={<FlagOutlinedIcon sx={{ fontSize: 16 }} />}
            />
            <PageStatCard
              label={t('Reputation needed', 'Réputation requise')}
              value={!missionRewards ? '…' : topStanding?.standingName ?? t('None', 'Aucune')}
              domain="magenta"
            />
            <PageStatCard
              label={t('Source contracts', 'Contrats sources')}
              value={!missionRewards ? '…' : entry ? String(entry.contractCount) : '0'}
              domain="blue"
            />
            <PageStatCard
              label={t('Localities', 'Localités')}
              value={!missionRewards ? '…' : entry ? String(entry.localityCount) : '0'}
              domain="cyan"
              icon={<PlaceOutlinedIcon sx={{ fontSize: 16 }} />}
            />
            <PageStatCard
              label={t('Craft time', 'Temps de craft')}
              value={selected.craftTimeSecs >= 60 ? `${Math.round(selected.craftTimeSecs / 60)}m` : `${selected.craftTimeSecs}s`}
              accent={theme.palette.primary.main}
            />
          </Box>

          {/* Main dense grid: simulation + reputation left, info right */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 380px' }, gap: 1.5 }}>
            {/* Craft simulation, then the reputation pipeline right below the slots */}
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              {detailReady && selected ? (
                <CraftSection
                  blueprint={selected}
                  slotAssignments={slotAssignments}
                  assignQuality={assignQuality}
                  clearAssignments={clearAssignments}
                  qualityScore={qualityScore}
                  projectedStats={projectedStats}
                  hideFieldData
                  hideReference
                />
              ) : (
                <Stack spacing={1.5}>
                  <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
                  <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
                </Stack>
              )}

              {entry ? (
                lanes.map((lane) => (
                  <ReputationLane
                    key={lane.scopeKey}
                    lane={lane}
                    reachedReputation={progress[lane.scopeKey] ?? -1}
                    onReach={(rep) => handleReach(lane.scopeKey, rep)}
                    missionPicks={missionPicks}
                    onToggleMissionPick={toggleMissionPick}
                  />
                ))
              ) : (
                <Panel
                  eyebrow={t('Reputation', 'Réputation')}
                  title={t('Missions', 'Missions')}
                  accent={theme.palette.domain.blue}
                  dense
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {missionRewards
                      ? t(
                          'This blueprint is not rewarded by any known mission in the current dataset.',
                          'Ce blueprint n’est récompensé par aucune mission connue dans le dataset actuel.',
                        )
                      : t('Loading mission rewards…', 'Chargement des récompenses de mission…')}
                  </Typography>
                </Panel>
              )}
              {detailReady && selected && requiredResources.length > 0 && (
                <Panel
                  eyebrow={t('Materials', 'Matériaux')}
                  title={t('Required resources & sourcing', 'Ressources requises & sourcing')}
                  accent={theme.palette.domain.green}
                  heroValue={totalRequiredScu > 0 ? formatResourceQuantity(totalRequiredScu, 'scu', lang) : String(requiredResources.length)}
                  dense
                >
                  <Stack spacing={0.75}>
                    {requiredResources.map((resource) => {
                      const sourceEntry = resolveMaterialSource(materialSources, resource.resourceName);
                      const topProvider = sourceEntry?.providers
                        ?.slice()
                        .sort((a, b) => (b.groupProbabilityPct ?? 0) - (a.groupProbabilityPct ?? 0))[0];
                      return (
                        <Box key={resource.resourceName} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <ResourceIcon name={resource.resourceName} size={16} />
                          <Typography sx={{ fontWeight: 600, fontSize: TEXT_LABEL_LG, flexShrink: 0 }}>
                            {resource.resourceName}
                          </Typography>
                          <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, color: 'text.primary', fontWeight: 700, flexShrink: 0 }}>
                            {formatResourceQuantity(resource.totalScu * qty, resource.quantityUnit, lang)}
                          </Typography>
                          <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ml: 'auto' }}>
                            {topProvider
                              ? `${topProvider.providerDisplayName}${topProvider.system ? ` · ${topProvider.system}` : ''}${topProvider.groupProbabilityPct != null ? ` · ${topProvider.groupProbabilityPct.toFixed(1)}%` : ''}`
                              : t('No source data', 'Pas de source connue')}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={t('Add to planner', 'Ajouter au planner')}
                            title={t('Add to planner', 'Ajouter au planner')}
                            onClick={() => addPlannerResourceRequirement(
                              resource.resourceName,
                              resource.totalScu * qty,
                              resource.quantityUnit === 'count' ? 'count' : 'scu',
                            )}
                            sx={{ p: 0.4, flexShrink: 0 }}
                          >
                            <PlaylistAddIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Stack>
                </Panel>
              )}
            </Stack>

            {/* Right rail: side panels */}
            <Stack spacing={1.5} sx={{ minWidth: 0, height: '100%' }}>
              {detailReady && selected && (
                <Panel
                  eyebrow={t('Static data', 'Données statiques')}
                  title={t('Item details', 'Détails de l’objet')}
                  dense
                  sx={{ flex: 1 }}
                >
                  <ItemDescription blueprint={selected} />
                  {hasBlueprintFieldData(selected) && <FieldDataBody blueprint={selected} />}
                </Panel>
              )}

              {detailReady && selected && dismantleTimeSecs > 0 && requiredResources.length > 0 && (
                <Panel
                  eyebrow={t('Dismantling', 'Démontage')}
                  title={t('Recovered materials', 'Matériaux récupérés')}
                  accent={theme.palette.domain.orange}
                  heroValue={`${Math.round(dismantleEfficiency * 100)}%`}
                  heroUnit={t('recovery', 'récup.')}
                  collapsible
                  defaultCollapsed
                  dense
                >
                  <Stack spacing={0.6}>
                    {requiredResources.map((resource) => (
                      <Box key={resource.resourceName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ResourceIcon name={resource.resourceName} size={14} />
                        <Typography sx={{ fontSize: TEXT_LABEL, fontWeight: 600, minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {resource.resourceName}
                        </Typography>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, fontWeight: 700, color: 'text.primary' }}>
                          {formatResourceQuantity(Math.round(resource.totalScu * dismantleEfficiency * 1000) / 1000, resource.quantityUnit, lang)}
                        </Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, borderTop: `1px solid ${theme.palette.ui.border}` }}>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {t('Dismantle time', 'Temps de démontage')}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, fontWeight: 700 }}>
                        {dismantleTimeSecs >= 60 ? `${Math.floor(dismantleTimeSecs / 60)}m ${dismantleTimeSecs % 60 ? `${dismantleTimeSecs % 60}s` : ''}`.trim() : `${dismantleTimeSecs}s`}
                      </Typography>
                    </Box>
                  </Stack>
                </Panel>
              )}
            </Stack>
          </Box>
        </>
      )}
    </PageLayout>
  );
}

export default FabricatorPage;
