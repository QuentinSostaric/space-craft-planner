import { Box, ButtonBase, Typography, alpha, useTheme } from '../../ui/system';
import type { Theme } from '../../ui/system';
import { CheckCircleIcon, ChevronRightIcon, PlaceOutlinedIcon, RadioButtonUncheckedIcon } from '../../ui/icons';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import { formatProbabilityPercent } from '../../utils/crafting';
import type {
  AcquisitionContract,
  AcquisitionFaction,
  MissionContract,
  MissionReputationScope,
  MissionStandingTier,
} from '../../types';
import { BentoHero, BentoPanel } from './BentoPanel';

export interface LaneTier {
  tier: MissionStandingTier;
  /** Contracts that can reward the selected blueprint, unlocked exactly at this tier. */
  targetContracts: AcquisitionContract[];
  /** Other contracts of the same faction/scope unlocked at this tier (reputation grind pool). */
  grindContracts: MissionContract[];
}

export interface Lane {
  faction: AcquisitionFaction;
  factionGroupId: string | null;
  scope: MissionReputationScope | null;
  scopeKey: string;
  tiers: LaneTier[];
  /** Reputation threshold of the highest tier needed to unlock every target contract. */
  maxNeededReputation: number;
  bestChance: number;
}

export function contractDisplayName(contract: {
  title?: { displayText?: string | null; template?: string | null } | null;
  contractDebugName?: string | null;
}): string {
  const display = contract.title?.displayText?.trim() || contract.title?.template?.trim();
  if (display) return display.replace(/~mission\((\w+)\)/g, '<$1>');
  const debug = contract.contractDebugName ?? '';
  return debug.replace(/_/g, ' ').trim() || 'Contract';
}

/**
 * Stable identity for a grind contract — used for pick persistence and React
 * keys. `contractDebugName` is nullable, and `?? ''` would collapse every
 * unnamed contract in a tier onto one another; fall through the remaining id
 * fields before resorting to position.
 */
export function contractKey(contract: MissionContract, index: number): string {
  return contract.contractDebugName?.trim()
    || contract.contractFile?.trim()
    || contract.handlerDebugName?.trim()
    || `idx:${index}`;
}

function missionSecondaryLine(contract: MissionContract): string {
  const parts: string[] = [];
  const giver = contract.contractorDisplayName ?? contract.employer?.displayName ?? null;
  if (giver) parts.push(giver);
  const localities = contract.availability?.localities ?? [];
  if (localities.length > 0) parts.push(localities.join(' · '));
  return parts.join(' · ');
}

// ─── Activity classification ─────────────────────────────────────────────────

/**
 * The dataset carries no activity taxonomy — every contract is a
 * `CareerContract` — but the contract name encodes the job well enough to give
 * each quest the visual activity cue the design calls for.
 */
type Activity = 'combat' | 'mining' | 'hauling' | 'recon' | 'salvage' | 'unknown';

/** Built once — rebuilding all five trees per row allocated ~5× what it used. */
const ACTIVITY_PATHS: Record<Activity, ReactNode> = {
  combat: (
    <>
      <circle cx="12" cy="12" r="6" />
      <line x1="12" y1="1" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="1" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="23" y2="12" />
    </>
  ),
  hauling: (
    <>
      <rect x="4" y="6" width="16" height="13" rx="1" />
      <line x1="4" y1="10" x2="20" y2="10" />
    </>
  ),
  mining: (
    <>
      <path d="M4 20l9-9" />
      <path d="M9 4c4 0 7 3 7 7" />
      <path d="M14.5 3c3 0 5 2 5 5" />
    </>
  ),
  recon: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  salvage: (
    <>
      <path d="M4 17h16" />
      <path d="M7 17l2-9h6l2 9" />
      <line x1="10" y1="11" x2="14" y2="11" />
    </>
  ),
  unknown: (
    <>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="16" x2="12" y2="16.01" />
      <path d="M9.5 9.5a2.6 2.6 0 1 1 2.9 2.6v1.2" />
    </>
  ),
};

const ACTIVITY_PATTERNS: [Activity, RegExp][] = [
  ['mining', /\bmin(e|ing)|\bore\b|deposit|extract|prospect|quantanium/i],
  ['salvage', /salvage|reclaim|scrap|wreck|derelict/i],
  ['hauling', /cargo|haul|deliver|supply|transport|convoy|freight/i],
  ['recon', /scan|recon|patrol|survey|investigat|locate|search|data|blackbox|retriev|missing|distress/i],
  ['combat', /eliminat|destroy|defend|bounty|threat|attack|raid|ambush|assault|clear|outlaw|headhunter|wipe|kill|defea|protect|halt|reduce|takeb?ack/i],
];

/**
 * The dataset has no activity taxonomy, so this is an inference from the
 * contract name. When nothing matches we say so rather than defaulting to
 * Combat — asserting a specific activity we have no evidence for would send
 * players to the wrong job.
 */
export function classifyActivity(contract: { contractDebugName?: string | null; title?: { displayText?: string | null; template?: string | null } | null }): Activity {
  const haystack = `${contractDisplayName(contract)} ${contract.contractDebugName ?? ''}`;
  for (const [activity, pattern] of ACTIVITY_PATTERNS) {
    if (pattern.test(haystack)) return activity;
  }
  return 'unknown';
}

function ActivityIcon({ activity }: { activity: Activity }) {
  const theme = useTheme();
  const { t } = useI18n();
  const color = {
    combat: theme.palette.domain.blue,
    hauling: theme.palette.domain.cyan,
    mining: theme.palette.domain.green,
    recon: theme.palette.primary.main,
    salvage: theme.palette.domain.orange,
    unknown: theme.palette.text.disabled,
  }[activity];
  const label = {
    combat: t('Combat', 'Combat', 'Kampf'),
    hauling: t('Hauling', 'Transport', 'Transport'),
    mining: t('Mining', 'Minage', 'Bergbau'),
    recon: t('Recon', 'Reconnaissance', 'Aufklärung'),
    salvage: t('Salvage', 'Récupération', 'Bergung'),
    unknown: t('Activity unknown', 'Activité inconnue', 'Aktivität unbekannt'),
  }[activity];
  return (
    <Box
      title={label}
      aria-hidden
      sx={{
        flexShrink: 0,
        width: 18,
        height: 18,
        borderRadius: '5px',
        backgroundColor: alpha(color, 0.14),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        {ACTIVITY_PATHS[activity]}
      </svg>
    </Box>
  );
}

/** One selectable grind contract inside a tier column. */
function GrindRow({
  contract,
  picked,
  onToggle,
}: {
  contract: MissionContract;
  picked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const rewardCount = contract.rewardedBlueprints?.length ?? 0;
  const green = theme.palette.domain.green;

  return (
    <ButtonBase
      onClick={onToggle}
      role="checkbox"
      aria-checked={picked}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        textAlign: 'left',
        px: 1,
        py: 0.75,
        borderRadius: '7px',
        border: `1px solid ${picked ? theme.palette.ui.borderAccent : 'transparent'}`,
        backgroundColor: picked ? alpha(theme.palette.primary.main, 0.13) : 'transparent',
        transition: 'background-color 120ms ease, border-color 120ms ease',
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
      }}
    >
      <Box sx={{ flexShrink: 0, lineHeight: 0, color: picked ? 'primary.main' : 'text.disabled' }}>
        {picked ? <CheckCircleIcon sx={{ fontSize: 15 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 15 }} />}
      </Box>
      <ActivityIcon activity={classifyActivity(contract)} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: '0.72rem',
            lineHeight: 1.2,
            color: 'text.primary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {contractDisplayName(contract)}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: '0.56rem',
            color: 'text.disabled',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {missionSecondaryLine(contract) || t('No locality data', 'Pas de localité connue')}
        </Typography>
      </Box>
      {rewardCount > 0 && (
        <Box
          title={t('Blueprints in the reward pool', 'Blueprints dans le pool de récompense')}
          sx={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            height: 16,
            px: 0.75,
            borderRadius: '4px',
            backgroundColor: alpha(green, 0.15),
            color: green,
            fontFamily: FONT_MONO,
            fontSize: '0.56rem',
            fontWeight: 700,
          }}
        >
          +{rewardCount} BP
        </Box>
      )}
    </ButtonBase>
  );
}

/** A contract that drops the selected blueprint — the endpoint of a route. */
function TargetRow({ contract }: { contract: AcquisitionContract }) {
  const theme = useTheme();
  const { t } = useI18n();
  const blue = theme.palette.domain.blue;
  const localities = contract.availability?.localities ?? [];

  return (
    <Box
      sx={{
        px: 1.125,
        py: 0.875,
        borderRadius: '7px',
        border: `1px solid ${alpha(blue, 0.4)}`,
        backgroundColor: alpha(blue, 0.09),
        boxShadow: `inset 2px 0 0 0 ${blue}`,
      }}
    >
      <Typography
        sx={{
          fontFamily: FONT_MONO,
          fontSize: '0.54rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: blue,
          mb: 0.375,
        }}
      >
        {t('Drops the blueprint', 'Droppe le blueprint')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
        <ActivityIcon activity={classifyActivity(contract)} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.primary', minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contractDisplayName(contract)}
        </Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.72rem', fontWeight: 700, color: blue, flexShrink: 0 }}>
          {formatProbabilityPercent(contract.maxChance ?? contract.blueprintDropChance ?? 0)}
        </Typography>
      </Box>
      {localities.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.25 }}>
          <PlaceOutlinedIcon sx={{ fontSize: 10, color: 'text.disabled', flexShrink: 0 }} />
          <Typography
            sx={{
              fontFamily: FONT_MONO,
              fontSize: '0.58rem',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {localities.join(' · ')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * The acquisition panel: one horizontal route per faction, selected through the
 * pill row. A route reads left-to-right as the tiers to climb, each tier being a
 * pool of grind contracts to pick from, ending on the contracts that drop the
 * blueprint.
 */
export function AcquisitionRoutes({
  lanes,
  progress,
  onReach,
  missionPicks,
  onToggleMissionPick,
  onSetTierPicks,
}: {
  lanes: Lane[];
  progress: Record<string, number>;
  onReach: (scopeKey: string, rep: number) => void;
  missionPicks: Record<string, string[]>;
  onToggleMissionPick: (tierKey: string, contractName: string) => void;
  /** Bulk-write whole tiers at once — used to apply and to undo Max rewards. */
  onSetTierPicks: (entries: Record<string, string[]>) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const magenta = theme.palette.domain.magenta;
  const blue = theme.palette.domain.blue;

  // Track the route by its stable scopeKey, not by index: `lanes` is rebuilt
  // every time a lazy faction-contract fetch resolves, and an index-based reset
  // would snap the user back to the first route mid-interaction.
  const [routeKey, setRouteKey] = useState<string | null>(null);
  const lane = lanes.find((l) => l.scopeKey === routeKey) ?? lanes[0] ?? null;

  /** scopeKeys of the lanes whose picks are currently driven by "Max rewards". */
  const [maxRewardsKeys, setMaxRewardsKeys] = useState<ReadonlySet<string>>(new Set());
  /**
   * Picks captured before Max rewards rewrote them, keyed by lane scopeKey so
   * enabling the toggle on one lane never orphans another lane's snapshot.
   */
  const picksBeforeMaxRef = useRef<Record<string, Record<string, string[]>>>({});
  const maxRewards = lane != null && maxRewardsKeys.has(lane.scopeKey);

  const reachedReputation = lane ? progress[lane.scopeKey] ?? -1 : -1;

  /** Blueprints the picked grind contracts unlock along the way. */
  const alsoUnlocks = useMemo(() => {
    if (!lane) return 0;
    const names = new Set<string>();
    for (const laneTier of lane.tiers) {
      const picked = missionPicks[`${lane.scopeKey}|${laneTier.tier.minReputation ?? 0}`] ?? [];
      laneTier.grindContracts.forEach((contract, index) => {
        if (!picked.includes(contractKey(contract, index))) return;
        for (const bp of contract.rewardedBlueprints ?? []) names.add(bp.id);
      });
    }
    names.delete('');
    return names.size;
  }, [lane, missionPicks]);

  const pickedCount = useMemo(() => {
    if (!lane) return 0;
    return lane.tiers.reduce(
      (sum, laneTier) => sum + (missionPicks[`${lane.scopeKey}|${laneTier.tier.minReputation ?? 0}`] ?? []).length,
      0,
    );
  }, [lane, missionPicks]);

  if (!lane) return null;

  const activeLane = lane;
  const tierKeyOf = (laneTier: LaneTier) => `${activeLane.scopeKey}|${laneTier.tier.minReputation ?? 0}`;

  /** Apply Max rewards, remembering the previous picks so it can be undone. */
  const toggleMaxRewards = () => {
    if (maxRewards) {
      const snapshot = picksBeforeMaxRef.current[activeLane.scopeKey];
      if (snapshot) onSetTierPicks(snapshot);
      delete picksBeforeMaxRef.current[activeLane.scopeKey];
      setMaxRewardsKeys((prev) => {
        const next = new Set(prev);
        next.delete(activeLane.scopeKey);
        return next;
      });
      return;
    }
    const before: Record<string, string[]> = {};
    const next: Record<string, string[]> = {};
    for (const laneTier of activeLane.tiers) {
      if (laneTier.grindContracts.length === 0) continue;
      const key = tierKeyOf(laneTier);
      before[key] = missionPicks[key] ?? [];
      let bestIndex = 0;
      laneTier.grindContracts.forEach((contract, index) => {
        const rewards = contract.rewardedBlueprints?.length ?? 0;
        if (rewards > (laneTier.grindContracts[bestIndex].rewardedBlueprints?.length ?? 0)) bestIndex = index;
      });
      next[key] = [contractKey(laneTier.grindContracts[bestIndex], bestIndex)];
    }
    picksBeforeMaxRef.current[activeLane.scopeKey] = before;
    onSetTierPicks(next);
    setMaxRewardsKeys((prev) => new Set(prev).add(activeLane.scopeKey));
  };

  const bestOverall = Math.max(0, ...lanes.map((l) => l.bestChance));

  return (
    <BentoPanel
      accent={magenta}
      title={t('Acquisition routes', 'Routes d’acquisition')}
      note={`${lanes.length} ${lanes.length === 1 ? t('faction drops this', 'faction droppe ça') : t('factions drop this', 'factions droppent ça')}`}
      span={12}
      right={<BentoHero value={formatProbabilityPercent(bestOverall)} unit={t('best drop', 'meilleur drop')} color={magenta} />}
    >
      {/* Route selector */}
      <Box
        role="tablist"
        aria-label={t('Acquisition routes', 'Routes d’acquisition')}
        sx={{
          display: 'flex',
          gap: 0.875,
          flexWrap: 'wrap',
          px: 1.25,
          py: 1.125,
          borderBottom: (tt: Theme) => `1px solid ${tt.palette.ui.border}`,
        }}
      >
        {lanes.map((candidate) => {
          const active = candidate === lane;
          const ready = (progress[candidate.scopeKey] ?? -1) >= candidate.maxNeededReputation;
          return (
            <ButtonBase
              key={candidate.scopeKey}
              role="tab"
              aria-selected={active}
              onClick={() => setRouteKey(candidate.scopeKey)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.25,
                px: 1.125,
                py: 0.75,
                borderRadius: '7px',
                border: `1px solid ${active ? alpha(magenta, 0.45) : theme.palette.ui.borderStrong}`,
                backgroundColor: active ? alpha(magenta, 0.13) : 'transparent',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.68rem', color: 'text.primary' }}>
                  {candidate.faction.contractorDisplayName ?? t('Faction', 'Faction')}
                </Typography>
                {ready && (
                  <Box
                    title={t('Tier already reached', 'Palier déjà atteint')}
                    sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'success.main' }}
                  />
                )}
              </Box>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.56rem', color: active ? magenta : 'text.disabled' }}>
                {candidate.scope?.displayName ?? candidate.scope?.scopeName ?? '—'} ·{' '}
                {formatProbabilityPercent(candidate.bestChance)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {/* Route pipeline — real datasets can list many contracts per rank, so the
          pipeline scrolls inside the panel instead of pushing the rest of the
          bento grid far below the fold. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.75,
          px: 1.5,
          py: 1.375,
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: { xs: 420, lg: 520 },
          overscrollBehavior: 'contain',
        }}
      >
        {lane.tiers.map((laneTier, index) => {
          const rep = laneTier.tier.minReputation ?? 0;
          const reached = rep <= reachedReputation;
          const isNext = !reached && lane.tiers.findIndex((lt) => (lt.tier.minReputation ?? 0) > reachedReputation) === index;
          const isTarget = laneTier.targetContracts.length > 0;
          const tierKey = `${lane.scopeKey}|${rep}`;
          const picked = missionPicks[tierKey] ?? [];
          const isLast = index === lane.tiers.length - 1;

          return (
            <Box key={tierKey} sx={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
              <Box sx={{ width: 256, display: 'flex', flexDirection: 'column', gap: 0.625 }}>
                {/* Tier head */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 17 }}>
                  <ButtonBase
                    onClick={() => onReach(lane.scopeKey, reached ? rep - 1 : rep)}
                    aria-label={`${laneTier.tier.displayName ?? rep} — ${reached ? t('reached', 'atteint') : t('mark as reached', 'marquer comme atteint')}`}
                    sx={{
                      lineHeight: 0,
                      flexShrink: 0,
                      color: reached ? 'success.main' : isNext ? magenta : 'text.disabled',
                    }}
                  >
                    {reached ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />}
                  </ButtonBase>
                  <Typography
                    sx={{
                      fontFamily: FONT_MONO,
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: isTarget ? blue : 'text.secondary',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {isTarget ? t('Drops the blueprint', 'Droppe le blueprint') : `${t('Rank', 'Rang')} ${index + 1}`}
                  </Typography>
                  <Typography
                    sx={{
                      ml: 'auto',
                      flexShrink: 0,
                      fontFamily: FONT_MONO,
                      fontSize: '0.54rem',
                      fontWeight: 700,
                      color: isTarget ? blue : reached ? 'success.main' : isNext ? magenta : 'text.disabled',
                    }}
                  >
                    {isTarget
                      ? reached ? t('REACHED', 'ATTEINT') : t('TARGET', 'CIBLE')
                      : reached ? t('REACHED', 'ATTEINT') : isNext ? t('NEXT', 'SUIVANT') : t('LOCKED', 'VERROUILLÉ')}
                  </Typography>
                </Box>

                <Typography
                  sx={{
                    fontFamily: FONT_MONO,
                    fontSize: '0.58rem',
                    color: isTarget ? 'text.secondary' : 'text.disabled',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {laneTier.tier.displayName ?? t('Entry', 'Départ')} · {rep.toLocaleString()} rep
                  {!reached && rep > Math.max(0, reachedReputation) && (
                    <Box component="span" sx={{ color: magenta }}>
                      {' '}· +{(rep - Math.max(0, reachedReputation)).toLocaleString()}
                    </Box>
                  )}
                </Typography>

                {laneTier.grindContracts.length > 0 && (
                  <Typography
                    sx={{
                      fontFamily: FONT_MONO,
                      fontSize: '0.54rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'text.disabled',
                    }}
                  >
                    {picked.length > 0
                      ? `${picked.length} ${t('picked', 'choisies')}`
                      : t('pick any', 'choisis-en')}
                  </Typography>
                )}

                {laneTier.targetContracts.map((contract, targetIndex) => (
                  <TargetRow key={contract.contractDebugName ?? `target:${targetIndex}`} contract={contract} />
                ))}

                {laneTier.grindContracts.length > 0 ? (
                  <Box role="group" aria-label={t('Missions to grind', 'Missions de grind')} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {laneTier.grindContracts.map((contract, contractIndex) => {
                      const id = contractKey(contract, contractIndex);
                      return (
                        <GrindRow
                          key={id}
                          contract={contract}
                          picked={picked.includes(id)}
                          onToggle={() => onToggleMissionPick(tierKey, id)}
                        />
                      );
                    })}
                  </Box>
                ) : !isTarget ? (
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                    {t('No grind contracts listed here', 'Aucun contrat de grind listé ici')}
                  </Typography>
                ) : null}
              </Box>

              {!isLast && (
                <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'center', px: 0.25, flexShrink: 0 }}>
                  <ChevronRightIcon sx={{ fontSize: 16, color: reached ? theme.palette.success.main : theme.palette.text.disabled }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Route summary */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexWrap: 'wrap',
          px: 1.25,
          py: 1.125,
          borderTop: (tt: Theme) => `1px solid ${tt.palette.ui.border}`,
        }}
      >
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.secondary' }}>
          {lane.tiers.length} {t('steps', 'étapes')} · {pickedCount} {t('missions picked', 'missions choisies')} ·{' '}
          {t('also unlocks', 'débloque aussi')}{' '}
          <Box component="span" sx={{ color: theme.palette.domain.green, fontWeight: 700 }}>
            +{alsoUnlocks} {t('blueprints', 'blueprints')}
          </Box>
        </Typography>
        <ButtonBase
          onClick={toggleMaxRewards}
          role="switch"
          aria-checked={maxRewards}
          aria-label={t('Max rewards', 'Récompenses max')}
          sx={{
            ml: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            color: maxRewards ? 'primary.main' : 'text.secondary',
            fontSize: '0.64rem',
            fontWeight: 600,
            '&:hover': { color: 'primary.main' },
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 26,
              height: 15,
              borderRadius: '999px',
              flexShrink: 0,
              position: 'relative',
              backgroundColor: maxRewards ? 'primary.main' : 'ui.surface3',
              transition: 'background-color 150ms ease',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 2,
                left: maxRewards ? 13 : 2,
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: '#fff',
                transition: 'left 150ms ease',
              }}
            />
          </Box>
          {t('Max rewards', 'Récompenses max')}
        </ButtonBase>
      </Box>
    </BentoPanel>
  );
}
