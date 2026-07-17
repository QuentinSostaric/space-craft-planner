import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_SM } from '../theme';
import { CraftSection, FieldDataBody, hasBlueprintFieldData } from './item-workspace/CraftSection';
import { Panel } from './ui/Panel';
import { PageStatCard } from './ui/PageStatCard';
import { RarityBadge } from './ui/RarityBadge';
import { formatProbabilityPercent, getAcquisitionEntry } from '../utils/crafting';
import type {
  AcquisitionContract,
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
  const theme = useTheme();
  const { t } = useI18n();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pickedSet = useMemo(() => new Set(picked), [picked]);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={(event) => setAnchor(event.currentTarget)}
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
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 380, width: 340 } } }}
      >
        {contracts.map((contract) => {
          const name = contract.contractDebugName ?? '';
          const rewardCount = contract.rewardedBlueprints?.length ?? 0;
          return (
            <MenuItem
              key={name}
              dense
              onClick={() => onToggle(name)}
              sx={{ alignItems: 'flex-start', py: 0.6, whiteSpace: 'normal' }}
            >
              <Checkbox
                size="small"
                checked={pickedSet.has(name)}
                disableRipple
                sx={{ p: 0, mr: 1, mt: 0.15 }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.25 }}>
                  {contractDisplayName(contract)}
                </Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled', lineHeight: 1.3 }}>
                  {missionSecondaryLine(contract)}
                </Typography>
                {rewardCount > 0 && (
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: theme.palette.domain.violet, lineHeight: 1.3 }}>
                    {rewardCount} {t('blueprints in reward pool', 'blueprints dans le pool de récompense')}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </>
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
                    <Chip
                      size="small"
                      label={t('Next', 'Suivant')}
                      sx={{ height: 17, fontSize: '0.625rem', fontWeight: 700, backgroundColor: alpha(magenta, 0.16), color: magenta, flexShrink: 0 }}
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
  const { t } = useI18n();
  const {
    activeDataset,
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    ensureBlueprintDetailLoaded,
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
    setActiveBlueprint,
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
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number | undefined>>({});
  const assignQuality = useCallback((slotId: string, value: number | undefined) => {
    setSlotAssignments((prev) => ({ ...prev, [slotId]: value }));
  }, []);
  const clearAssignments = useCallback(() => setSlotAssignments({}), []);
  useEffect(() => {
    setSlotAssignments({});
  }, [selectedId]);

  useEffect(() => {
    if (activeDataset.datasetId) void ensureMissionRewardsLoaded();
  }, [activeDataset.datasetId, ensureMissionRewardsLoaded]);

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

  const requiredResources = useMemo(() => {
    if (!selected?.requiredResourceIds?.length) return [];
    return selected.requiredResourceIds
      .map((id) => activeDataset.resources.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [activeDataset.resources, selected?.requiredResourceIds]);

  const heroImage = selected?.media?.primaryVisual?.imageUrl ?? selected?.media?.image?.imageUrl ?? null;
  const topStanding = entry?.standings?.length
    ? [...entry.standings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0))[0]
    : null;

  const openWorkspace = useCallback(() => {
    if (selected) setActiveBlueprint(selected);
  }, [selected, setActiveBlueprint]);

  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 2 }, flex: 1, width: '100%', maxWidth: 1700, mx: 'auto' }}>
      {/* Toolbar row: search + inline hero strip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        <Autocomplete
          options={blueprints}
          value={selected}
          onChange={(_e, bp) => handleSelect(bp)}
          getOptionLabel={(bp) => bp.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('Search a blueprint…', 'Rechercher un blueprint…')}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
          renderOption={(props, bp) => {
            const { key, ...rest } = props;
            return (
              <Box key={bp.id} component="li" {...rest} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{bp.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {[bp.manufacturer, bp.category].filter(Boolean).join(' / ')}
                </Typography>
              </Box>
            );
          }}
          sx={{ width: { xs: '100%', sm: 340 }, '& .MuiInputBase-root': { height: 40 } }}
        />

        {selected && (
          <>
            {heroImage && (
              <Box
                component="img"
                src={heroImage}
                alt={selected.name}
                sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1, border: `1px solid ${theme.palette.ui.border}`, flexShrink: 0 }}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1.0625rem', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', lineHeight: 1.2 }}>
                {selected.manufacturer}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              {selected.rarity && <RarityBadge rarity={selected.rarity} />}
              <Chip size="small" label={selected.category} sx={{ height: 20, fontSize: TEXT_LABEL_SM }} />
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={openWorkspace}
              endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
              sx={{ ml: 'auto', flexShrink: 0 }}
            >
              {t('Full workspace', 'Workspace complet')}
            </Button>
          </>
        )}
      </Box>

      {missionRewardsLoading && !missionRewards && !selected && (
        <Box sx={{ maxWidth: 640 }}>
          <LinearProgress sx={{ mb: 1.5 }} />
          <Skeleton variant="rectangular" height={120} />
        </Box>
      )}

      {/* Empty state: pitch + suggestions */}
      {!selected && (
        <Box sx={{ maxWidth: 900 }}>
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            {t('Fabricator', 'Fabricator')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
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
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: theme.palette.domain.blue }}>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' }, gap: 1.25, mb: 1.5 }}>
            <PageStatCard
              label={t('Best drop chance', 'Meilleure chance')}
              value={entry ? formatProbabilityPercent(Math.max(0, ...lanes.map((l) => l.bestChance))) : '—'}
              domain="blue"
              icon={<FlagOutlinedIcon sx={{ fontSize: 16 }} />}
            />
            <PageStatCard
              label={t('Reputation needed', 'Réputation requise')}
              value={topStanding?.standingName ?? t('None', 'Aucune')}
              domain="magenta"
            />
            <PageStatCard
              label={t('Source contracts', 'Contrats sources')}
              value={entry ? String(entry.contractCount) : '0'}
              domain="blue"
            />
            <PageStatCard
              label={t('Localities', 'Localités')}
              value={entry ? String(entry.localityCount) : '0'}
              domain="cyan"
              icon={<PlaceOutlinedIcon sx={{ fontSize: 16 }} />}
            />
            <PageStatCard
              label={t('Craft time', 'Temps de craft')}
              value={selected.craftTimeSecs >= 60 ? `${Math.round(selected.craftTimeSecs / 60)}m` : `${selected.craftTimeSecs}s`}
              domain="violet"
            />
            <PageStatCard
              label={t('Material slots', 'Slots matériaux')}
              value={String(selected.slotCount ?? selected.slots.length)}
              domain="violet"
            />
          </Box>

          {/* Main dense grid: simulation + reputation left, info right */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 380px' }, gap: 1.5, alignItems: 'start' }}>
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
            </Stack>

            {/* Right rail: side panels */}
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              {requiredResources.length > 0 && (
                <Panel
                  eyebrow={t('Materials', 'Matériaux')}
                  title={t('Required resources', 'Ressources requises')}
                  accent={theme.palette.domain.green}
                  heroValue={String(requiredResources.length)}
                  dense
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {requiredResources.map((resource) => (
                      <Chip
                        key={resource.id}
                        size="small"
                        icon={<ScienceOutlinedIcon sx={{ fontSize: 12 }} />}
                        label={resource.name}
                        sx={{ fontSize: TEXT_LABEL_SM }}
                      />
                    ))}
                  </Box>
                </Panel>
              )}

              {detailReady && selected && hasBlueprintFieldData(selected) && (
                <Panel
                  eyebrow={t('Field Data', 'Données objet')}
                  title={t('Item details', 'Détails de l’objet')}
                  accent={theme.palette.domain.cyan}
                  dense
                >
                  <FieldDataBody blueprint={selected} />
                </Panel>
              )}
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );
}

export default FabricatorPage;
