import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
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
import { CraftSection } from './item-workspace/CraftSection';
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

// ─── Reputation lane (one faction) ───────────────────────────────────────────

function ReputationLane({
  lane,
  reachedReputation,
  onReach,
}: {
  lane: Lane;
  reachedReputation: number;
  onReach: (rep: number) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const magenta = theme.palette.domain.magenta;
  const blue = theme.palette.domain.blue;

  const remainingTiers = lane.tiers.filter((lt) => (lt.tier.minReputation ?? 0) > reachedReputation).length;

  return (
    <Panel
      eyebrow={lane.scope?.displayName ?? lane.scope?.scopeName ?? t('Reputation', 'Réputation')}
      title={lane.faction.contractorDisplayName ?? t('Faction', 'Faction')}
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
    >
      <Stack spacing={0}>
        {lane.tiers.map((laneTier, index) => {
          const rep = laneTier.tier.minReputation ?? 0;
          const reached = rep <= reachedReputation;
          const isNext = !reached && lane.tiers.findIndex((lt) => (lt.tier.minReputation ?? 0) > reachedReputation) === index;
          const hasTargets = laneTier.targetContracts.length > 0;
          const isLast = index === lane.tiers.length - 1;

          return (
            <Box key={`${rep}-${laneTier.tier.displayName ?? index}`} sx={{ display: 'flex', gap: 1.25, position: 'relative' }}>
              {/* Rail: node + connector */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => onReach(reached ? rep - 1 : rep)}
                  aria-label={`${laneTier.tier.displayName ?? rep} — ${reached ? t('reached', 'atteint') : t('mark as reached', 'marquer comme atteint')}`}
                  sx={{
                    border: 'none',
                    background: 'none',
                    p: 0,
                    mt: 0.3,
                    cursor: 'pointer',
                    lineHeight: 0,
                    color: reached ? theme.palette.success.main : isNext ? magenta : theme.palette.text.disabled,
                  }}
                >
                  {reached
                    ? <CheckCircleIcon sx={{ fontSize: 16 }} />
                    : <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />}
                </Box>
                {!isLast && (
                  <Box sx={{ flex: 1, width: 2, my: 0.3, borderRadius: 1, backgroundColor: reached ? alpha(theme.palette.success.main, 0.45) : theme.palette.ui.border }} />
                )}
              </Box>

              {/* Tier content */}
              <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 1.1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: isNext ? 700 : 600, fontSize: '0.8125rem', color: reached ? 'text.secondary' : 'text.primary' }}>
                    {laneTier.tier.displayName ?? t('Entry', 'Départ')}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled' }}>
                    {rep.toLocaleString()}
                  </Typography>
                  {isNext && (
                    <Chip
                      size="small"
                      label={t('Next step', 'Prochaine étape')}
                      sx={{ height: 17, fontSize: '0.625rem', fontWeight: 700, backgroundColor: alpha(magenta, 0.16), color: magenta }}
                    />
                  )}
                </Box>

                {/* Contracts that drop the blueprint at this tier */}
                {laneTier.targetContracts.map((contract) => (
                  <Paper
                    key={contract.contractDebugName}
                    variant="outlined"
                    sx={{
                      mt: 0.6,
                      px: 1,
                      py: 0.65,
                      borderColor: alpha(blue, 0.4),
                      boxShadow: `inset 2px 0 0 0 ${blue}`,
                      backgroundColor: alpha(blue, 0.05),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 0 }}>
                        {contractDisplayName(contract)}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, fontWeight: 700, color: blue, flexShrink: 0 }}>
                        {formatProbabilityPercent(contract.maxChance ?? contract.blueprintDropChance ?? 0)}
                      </Typography>
                    </Box>
                    {(contract.availability?.localities?.length ?? 0) > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
                        <PlaceOutlinedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary' }}>
                          {contract.availability.localities.join(' · ')}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                ))}

                {/* Grind pool */}
                {!hasTargets && laneTier.grindContracts.length > 0 && (
                  <Typography sx={{ mt: 0.3, fontSize: TEXT_LABEL, color: 'text.secondary' }}>
                    {laneTier.grindContracts.length}{' '}
                    {laneTier.grindContracts.length === 1
                      ? t('contract to raise reputation', 'contrat pour monter la réputation')
                      : t('contracts to raise reputation', 'contrats pour monter la réputation')}
                  </Typography>
                )}
                {hasTargets && laneTier.grindContracts.length > 0 && (
                  <Typography sx={{ mt: 0.3, fontSize: TEXT_LABEL_SM, color: 'text.disabled' }}>
                    +{laneTier.grindContracts.length} {t('other contracts at this tier', 'autres contrats à ce palier')}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
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

          {/* Main dense grid: simulation left, acquisition + info right */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 380px' }, gap: 1.5, alignItems: 'start' }}>
            {/* Craft simulation — the full slots + expected result experience */}
            <Box sx={{ minWidth: 0 }}>
              {detailReady && selected ? (
                <CraftSection
                  blueprint={selected}
                  slotAssignments={slotAssignments}
                  assignQuality={assignQuality}
                  clearAssignments={clearAssignments}
                  qualityScore={qualityScore}
                  projectedStats={projectedStats}
                />
              ) : (
                <Stack spacing={1.5}>
                  <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
                  <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
                </Stack>
              )}
            </Box>

            {/* Right rail: reputation path + side panels */}
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              {entry ? (
                lanes.map((lane) => (
                  <ReputationLane
                    key={lane.scopeKey}
                    lane={lane}
                    reachedReputation={progress[lane.scopeKey] ?? -1}
                    onReach={(rep) => handleReach(lane.scopeKey, rep)}
                  />
                ))
              ) : (
                <Panel
                  eyebrow={t('Acquisition', 'Obtention')}
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

              {entry && entry.localities.length > 0 && (
                <Panel
                  eyebrow={t('Where', 'Où')}
                  title={t('Mission localities', 'Localités des missions')}
                  accent={theme.palette.domain.cyan}
                  heroValue={String(entry.localities.length)}
                  dense
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {entry.localities.map((locality) => (
                      <Chip
                        key={locality}
                        size="small"
                        icon={<PlaceOutlinedIcon sx={{ fontSize: 12 }} />}
                        label={locality}
                        sx={{ fontSize: TEXT_LABEL_SM }}
                      />
                    ))}
                  </Box>
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
