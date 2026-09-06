import { Box, ButtonBase, Paper, Typography, alpha, useTheme } from '../../ui/system';
import { CheckCircleIcon, ChevronRightIcon, PlaceOutlinedIcon, RadioButtonUncheckedIcon } from '../../ui/icons';
import { useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { missionPathFromSlug, missionSlugFromContract, navigateToPath, toSlug } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import { formatProbabilityPercent } from '../../utils/crafting';
import type {
  AcquisitionContract,
  AcquisitionFaction,
  Lang,
  MissionContract,
  MissionReputationScope,
  MissionStandingTier,
} from '../../types';
import { BentoHero, BentoPanel } from './BentoPanel';
import { AppOverlayPanel } from '../ui/overlays';

export interface LaneTier {
  tier: MissionStandingTier;
  /** Contracts that can reward the selected blueprint, unlocked exactly at this tier. */
  targetContracts: AcquisitionContract[];
  /**
   * Full contract records for those targets, keyed by `contractDebugName`. The
   * acquisition graph's target entries carry only a drop chance, not a reward
   * pool, so the pool has to come from the faction's own contract list — where
   * the same contract also exists, just filtered out of `grindContracts`.
   */
  targetMissionContracts: Record<string, MissionContract>;
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

/**
 * Click handling shared by every link in the panel — contract rows and the
 * blueprints inside a reward pool alike.
 *
 * Middle click never reaches this at all — browsers dispatch `auxclick` for it
 * — which is exactly why these have to be real anchors carrying a real href;
 * that is what makes open-in-new-tab work. `shouldHandleInternalLinkClick` lets
 * the modified clicks through for the same reason.
 */
function spaLinkHandler(href: string, state: Record<string, unknown>) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleInternalLinkClick(event)) return;
    event.preventDefault();
    navigateToPath(href, state);
  };
}

const handleMissionClick = (href: string) => spaLinkHandler(href, { mainView: 'missions' });

export function formatUec(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US').replace(/,/g, ' ')} aUEC`;
}

/**
 * Builds the "Giver · Locality · Pay" line under a mission row.
 *
 * These contracts declare no aUEC of their own — the game computes the payout server-side
 * from the difficulty tiers — so the pay segment shows an explicit amount only when a
 * contract actually declares one. Otherwise it falls back to the difficulty band, which is
 * what drives the payout, rather than inventing a number.
 */
function missionSecondaryLine(
  contract: MissionContract,
  t: (en: string, fr: string) => string,
  lang: Lang,
): string {
  const parts: string[] = [];
  const giver = contract.contractorDisplayName ?? contract.employer?.displayName ?? null;
  if (giver) parts.push(giver);
  const localities = contract.availability?.localities ?? [];
  if (localities.length > 0) parts.push(localities.join(' · '));

  const explicitReward = contract.payout?.rewardUec ?? null;
  if (explicitReward !== null && explicitReward > 0) {
    parts.push(formatUec(explicitReward));
  } else if (contract.difficulty) {
    const label = lang === 'fr' ? contract.difficulty.label.fr : contract.difficulty.label.en;
    parts.push(`${t('Difficulty', 'Difficulté')}: ${label}`);
  }

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

/** The blueprints a contract can hand out, listed inside the badge's panel. */
function RewardPool({ contract }: { contract: MissionContract }) {
  const theme = useTheme();
  const { t } = useI18n();
  const green = theme.palette.domain.green;
  const rewards = contract.rewardedBlueprints ?? [];
  // Best odds first — that is the order a player cares about.
  const sorted = [...rewards].sort((a, b) => (b.chance ?? 0) - (a.chance ?? 0));

  return (
    <Box sx={{ minWidth: 232, maxWidth: 320, maxHeight: 300, overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <Typography
        sx={{
          fontFamily: FONT_MONO,
          fontSize: '0.54rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'text.disabled',
          px: 0.75,
          pb: 0.625,
        }}
      >
        {t('Reward pool', 'Pool de récompense')} · {sorted.length}
      </Typography>
      {sorted.map((blueprint, index) => {
        // The Fabricator resolves /item/<slug> by name, and carries the id in
        // history state so the page can select without waiting on the match.
        const href = `/item/${toSlug(blueprint.name)}`;
        return (
        <Box
          key={blueprint.id || `${blueprint.name}-${index}`}
          component="a"
          href={href}
          onClick={spaLinkHandler(href, { blueprintId: blueprint.id, mainView: 'fabricator' })}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.875,
            px: 0.75,
            py: 0.5,
            borderRadius: '5px',
            borderTop: index === 0 ? 'none' : `1px solid ${theme.palette.ui.border}`,
            color: 'inherit',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'background-color 140ms ease',
            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
            '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: '-2px' },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {blueprint.name}
            </Typography>
            {blueprint.manufacturer && (
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.56rem', color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {blueprint.manufacturer}
              </Typography>
            )}
          </Box>
          {blueprint.chance != null && (
            <Typography sx={{ flexShrink: 0, fontFamily: FONT_MONO, fontSize: '0.62rem', fontWeight: 700, color: green }}>
              {formatProbabilityPercent(blueprint.chance)}
            </Typography>
          )}
        </Box>
        );
      })}
    </Box>
  );
}

/** One grind contract inside a tier column — a link through to its mission page. */
function GrindRow({ contract }: { contract: MissionContract }) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const rewardCount = contract.rewardedBlueprints?.length ?? 0;
  const green = theme.palette.domain.green;
  const href = missionPathFromSlug(
    missionSlugFromContract(contract.contractDebugName, contract.contractorDisplayName),
  );

  return (
    /*
     * Two controls that read as one. The row is a link to the mission and the
     * trailing badge is a button that opens the reward list, so they cannot be
     * nested — an anchor may not contain a button, and assistive tech would
     * announce a single confused control. They share a frame instead: the
     * divider and the outline stay invisible until the row is hovered, and each
     * half lights its own ground, so the seam only appears when it becomes
     * useful. The shift is on the frame so both halves move together.
     */
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: '7px',
        border: '1px solid transparent',
        overflow: 'hidden',
        transition: 'border-color 140ms ease, transform 140ms cubic-bezier(0.22,1,0.36,1)',
        '&:hover': {
          borderColor: theme.palette.ui.borderAccent,
          transform: 'translateX(2px)',
        },
        '&:hover .sc-row-split': { borderLeftColor: theme.palette.ui.border },
      }}
    >
      <Box
        component="a"
        href={href}
        onClick={handleMissionClick(href)}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textAlign: 'left',
          px: 1,
          py: 0.75,
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background-color 140ms ease',
          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: '-2px' },
        }}
      >
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
          {missionSecondaryLine(contract, t, lang) || t('No locality data', 'Pas de localité connue')}
        </Typography>
      </Box>
      </Box>

      {rewardCount > 0 && (
        <AppOverlayPanel
          ariaLabel={t('Blueprints in the reward pool', 'Blueprints dans le pool de récompense')}
          /* The rank card clips, so the panel has to escape it. */
          appendTo={typeof document === 'undefined' ? undefined : document.body}
          trigger={
            <ButtonBase
              className="sc-row-split"
              aria-label={t(
                `${rewardCount} blueprints in the reward pool — show them`,
                `${rewardCount} blueprints dans le pool de récompense — les afficher`,
              )}
              sx={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                px: 0.875,
                borderLeft: '1px solid transparent',
                color: green,
                fontFamily: FONT_MONO,
                fontSize: '0.56rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 140ms ease, border-color 140ms ease',
                '&:hover': { backgroundColor: alpha(green, 0.16) },
                '&:focus-visible': { outline: `2px solid ${green}`, outlineOffset: '-2px' },
              }}
            >
              +{rewardCount} BP
            </ButtonBase>
          }
        >
          <RewardPool contract={contract} />
        </AppOverlayPanel>
      )}
    </Box>
  );
}

/** A contract that drops the selected blueprint — the endpoint of a route. */
function TargetRow({
  contract,
  contractorDisplayName,
  missionContract,
}: {
  contract: AcquisitionContract;
  /*
   * The slug is built from contractor + contract name, and unlike a
   * MissionContract an AcquisitionContract carries no contractor of its own —
   * it comes from the lane's faction, so the caller has to supply it.
   */
  contractorDisplayName: string | null;
  /** Full record for the same contract, when the faction pool has been loaded. */
  missionContract?: MissionContract;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const blue = theme.palette.domain.blue;
  const localities = contract.availability?.localities ?? [];
  const href = missionPathFromSlug(
    missionSlugFromContract(contract.contractDebugName, contractorDisplayName),
  );
  const rewardCount = missionContract?.rewardedBlueprints?.length ?? 0;

  return (
    /* Same split frame as a grind row, in the target's blue. */
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: '7px',
        border: `1px solid ${alpha(blue, 0.4)}`,
        backgroundColor: alpha(blue, 0.09),
        boxShadow: `inset 2px 0 0 0 ${blue}`,
        overflow: 'hidden',
        transition: 'border-color 140ms ease, transform 140ms cubic-bezier(0.22,1,0.36,1)',
        '&:hover': {
          borderColor: alpha(blue, 0.7),
          transform: 'translateX(2px)',
        },
        '&:hover .sc-row-split': { borderLeftColor: alpha(blue, 0.45) },
      }}
    >
      <Box
        component="a"
        href={href}
        onClick={handleMissionClick(href)}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'block',
          px: 1.125,
          py: 0.875,
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background-color 140ms ease',
          '&:hover': { backgroundColor: alpha(blue, 0.14) },
          '&:focus-visible': { outline: `2px solid ${blue}`, outlineOffset: '-2px' },
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

      {missionContract && rewardCount > 0 && (
        <AppOverlayPanel
          ariaLabel={t('Blueprints in the reward pool', 'Blueprints dans le pool de récompense')}
          appendTo={typeof document === 'undefined' ? undefined : document.body}
          trigger={
            <ButtonBase
              className="sc-row-split"
              aria-label={t(
                `${rewardCount} blueprints in the reward pool — show them`,
                `${rewardCount} blueprints dans le pool de récompense — les afficher`,
              )}
              sx={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                px: 0.875,
                borderLeft: '1px solid transparent',
                color: blue,
                fontFamily: FONT_MONO,
                fontSize: '0.56rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 140ms ease, border-color 140ms ease',
                '&:hover': { backgroundColor: alpha(blue, 0.2) },
                '&:focus-visible': { outline: `2px solid ${blue}`, outlineOffset: '-2px' },
              }}
            >
              +{rewardCount} BP
            </ButtonBase>
          }
        >
          <RewardPool contract={missionContract} />
        </AppOverlayPanel>
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
  id,
  lanes,
  progress,
  onReach,
}: {
  id?: string;
  lanes: Lane[];
  progress: Record<string, number>;
  onReach: (scopeKey: string, rep: number) => void;
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

  const reachedReputation = lane ? progress[lane.scopeKey] ?? -1 : -1;

  /** Every distinct blueprint the grind pool of this route can hand out. */
  const alsoUnlocks = useMemo(() => {
    if (!lane) return 0;
    const names = new Set<string>();
    for (const laneTier of lane.tiers) {
      for (const contract of laneTier.grindContracts) {
        for (const bp of contract.rewardedBlueprints ?? []) names.add(bp.id);
      }
    }
    names.delete('');
    return names.size;
  }, [lane]);

  const missionCount = useMemo(
    () => (lane ? lane.tiers.reduce((sum, laneTier) => sum + laneTier.grindContracts.length, 0) : 0),
    [lane],
  );

  if (!lane) return null;

  const bestOverall = Math.max(0, ...lanes.map((l) => l.bestChance));

  return (
    /*
     * One panel again, so the section sits in the grid like everything else
     * instead of leaving a gap where a card should be — but the rail inside it
     * is a recessed tray rather than more card surface. `bgElev` sits below
     * `surface` in both themes, so the rank cards read as raised *in* the panel
     * instead of stacking a second frame on top of it, which is what makes a
     * card-inside-a-card look accidental.
     *
     * Each rank is still its own card, and rank count is data-driven (ladders
     * run 2 to 6 deep), which is why the tray scrolls rather than the ranks
     * taking fixed grid spans.
     */
    <BentoPanel
      id={id}
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

      {/*
        The tray. Darker ground plus a hairline top and bottom rule is what
        turns the rail into a well the rank cards sit inside; without the tone
        change the nesting just reads as two borders.
      */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 0.75,
          px: 1.25,
          py: 1.25,
          overflowX: 'auto',
          overscrollBehavior: 'contain',
          backgroundColor: 'ui.bgElev',
          borderTop: `1px solid ${theme.palette.ui.border}`,
          borderBottom: `1px solid ${theme.palette.ui.border}`,
        }}
      >
        {lane.tiers.map((laneTier, index) => {
          const rep = laneTier.tier.minReputation ?? 0;
          const reached = rep <= reachedReputation;
          const isNext = !reached && lane.tiers.findIndex((lt) => (lt.tier.minReputation ?? 0) > reachedReputation) === index;
          const isTarget = laneTier.targetContracts.length > 0;
          const tierKey = `${lane.scopeKey}|${rep}`;
          const isLast = index === lane.tiers.length - 1;
          const statusColor = isTarget
            ? blue
            : reached
              ? theme.palette.success.main
              : isNext
                ? magenta
                : theme.palette.ui.borderStrong;

          return (
            <Box key={tierKey} sx={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
              <Paper
                /* Replays when the route changes, since the key carries scopeKey. */
                className="if-appear"
                sx={{
                  width: 268,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '9px',
                  backgroundColor: 'ui.surface',
                  overflow: 'hidden',
                  maxHeight: { xs: 300, lg: 336 },
                  boxShadow: `inset 2px 0 0 0 ${statusColor}`,
                  // Marking a rank reached recolours the tick — ease it.
                  transition: 'box-shadow 200ms ease, border-color 200ms ease',
                }}
              >
                {/* Rank head */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.125,
                    py: 0.875,
                    borderBottom: `1px solid ${theme.palette.ui.border}`,
                  }}
                >
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
                    px: 1.125,
                    pt: 0.75,
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

                {/*
                  Contracts scroll inside their own card rather than the rail.
                  The rows must not shrink: flex children default to
                  `flex-shrink: 1`, so once a rank listed more contracts than the
                  card is tall they compressed into each other instead of
                  overflowing, and the list rendered as overlapping text.
                */}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    px: 1.125,
                    py: 0.75,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    '& > *': { flexShrink: 0 },
                  }}
                >
                  {laneTier.targetContracts.map((contract, targetIndex) => (
                    <TargetRow
                      key={contract.contractDebugName ?? `target:${targetIndex}`}
                      contract={contract}
                      contractorDisplayName={lane.faction.contractorDisplayName}
                      missionContract={laneTier.targetMissionContracts[contract.contractDebugName]}
                    />
                  ))}
                  {laneTier.grindContracts.length > 0
                    ? laneTier.grindContracts.map((contract, contractIndex) => (
                        <GrindRow key={contractKey(contract, contractIndex)} contract={contract} />
                      ))
                    : !isTarget && (
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                          {t('No grind contracts listed here', 'Aucun contrat de grind listé ici')}
                        </Typography>
                      )}
                </Box>
                <ButtonBase
                  onClick={() => onReach(lane.scopeKey, reached ? rep - 1 : rep)}
                  aria-pressed={reached}
                  aria-label={`${laneTier.tier.displayName ?? rep} — ${reached ? t('undo reached rank', 'annuler le rang atteint', 'erreichten Rang zurücknehmen') : t('mark as reached', 'marquer comme atteint', 'als erreicht markieren')}`}
                  sx={{ minHeight: 34, flexShrink: 0, px: 1.125, py: 0.75, display: 'flex', justifyContent: 'center', gap: 0.75, borderTop: `1px solid ${theme.palette.ui.border}`, color: reached ? 'success.main' : 'text.secondary', fontSize: '0.6875rem', '&:hover': { backgroundColor: 'ui.surface2' } }}
                >
                  {reached ? <CheckCircleIcon sx={{ fontSize: 15 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 15 }} />}
                  {reached ? t('Rank reached · undo', 'Rang atteint · annuler', 'Rang erreicht · zurücknehmen') : t('I have reached this rank', 'J’ai atteint ce rang', 'Ich habe diesen Rang erreicht')}
                </ButtonBase>
              </Paper>

              {!isLast && (
                <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'center', px: 0.25, flexShrink: 0 }}>
                  <ChevronRightIcon sx={{ fontSize: 16, color: reached ? theme.palette.success.main : theme.palette.text.disabled }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Route summary — aggregates across the ranks, so it sits under the tray. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', px: 1.25, py: 1.125 }}>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', color: 'text.secondary' }}>
          {lane.tiers.length} {t('steps', 'étapes')} · {missionCount} {t('missions', 'missions')} ·{' '}
          {/*
            This counts the union of rewards across the whole grind pool, which
            is only obtainable by running every listed mission — so it is
            labelled as the pool, not as something the route hands you.
          */}
          <Box component="span" sx={{ color: theme.palette.domain.green, fontWeight: 700 }}>
            {alsoUnlocks} {t('blueprints', 'blueprints')}
          </Box>{' '}
          {t('in the reward pool', 'dans le pool de récompense')}
        </Typography>
      </Box>
    </BentoPanel>
  );
}
