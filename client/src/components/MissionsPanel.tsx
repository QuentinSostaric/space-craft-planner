import { Box, Divider, Paper, Stack, Typography, alpha, useTheme } from '../ui/system';
import { Card, Link } from './ui/primitives';
import { AppProgressBar } from './ui/feedback';
import { AppChip } from './ui/data-display/AppChip';
import { BusinessOutlinedIcon, FilterListOffOutlinedIcon, FlagIcon, ImageNotSupportedOutlinedIcon, LeaderboardOutlinedIcon, MilitaryTechOutlinedIcon, PaidOutlinedIcon, ChevronRightIcon, OpenInNewIcon, PlaceOutlinedIcon, PublicOutlinedIcon, TravelExploreOutlinedIcon, VerifiedOutlinedIcon } from '../ui/icons';
import { memo, startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { BlueprintCard } from './BlueprintGrid';
import { AppGlyph } from './ui/AppGlyph';
import { AppButton, AppSelect, AppTextField } from './ui/controls';
import { SurfaceState } from './ui/feedback';
import { PageHeader, PageLayout, ResponsiveFilters } from './ui/page';
import { CategoryBadge } from './ui/Badge';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { PageStatCard } from './ui/PageStatCard';
import { Panel } from './ui/Panel';
import { ScaleBadge } from './ui/RarityBadge';
import { StarCitizenLicensedIcon, getLocationIconName } from './ui/StarCitizenLicensedIcon';
import { loc, useI18n } from '../i18n/I18nContext';
import { formatUec } from './fabricator/AcquisitionRoutes';
import { useCraft } from '../store/CraftContext';
import {
  formatProbabilityPercent,
  getStandingBucket,
  getMissionBlueprintDropChance,
  getMissionContractName,
  formatScaleLabel,
  formatStandingLabel,
  ls,
  STANDING_OPTIONS,
} from '../utils/crafting';
import { missionPathFromSlug, missionSlugFromContract, missionSlugFromPathname, navigateToPath, toSlug } from '../utils/slug';
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';
import { sanitizeExternalHttpsUrl } from '../utils/urlSafety';
import type {
  Blueprint,
  MissionContract,
  MissionEmployerRef,
  MissionSort,
  MissionRequiredStanding,
  MissionPayouts,
  MissionRewardFactionGroup,
  Resource,
  LocalizedString,
  StandingBucket,
} from '../types';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_LG, TEXT_LABEL_SM} from '../theme';

const FONT_HEADING = FONT_DISPLAY;

const MISSION_SORT_OPTIONS: { value: MissionSort; label: LocalizedString }[] = [
  { value: 'name-asc', label: ls('Mission name', 'Nom de mission', 'Missionsname') },
  { value: 'employer-asc', label: ls('Employer', 'Employeur', 'Arbeitgeber') },
  { value: 'standing-asc', label: ls('Lowest standing', 'Réputation croissante', 'Niedrigster Ruf') },
  { value: 'standing-desc', label: ls('Highest standing', 'Réputation décroissante', 'Höchster Ruf') },
  { value: 'scale-asc', label: ls('Scale', 'Portée', 'Reichweite') },
  { value: 'location-asc', label: ls('Location', 'Lieu', 'Ort') },
  { value: 'blueprint-count-asc', label: ls('Fewest blueprints', 'Moins de blueprints', 'Wenigste Blueprints') },
  { value: 'blueprint-count-desc', label: ls('Most blueprints', 'Plus de blueprints', 'Meiste Blueprints') },
  { value: 'chance-desc', label: ls('Best chance', 'Meilleure chance', 'Beste Chance') },
];

const RESOURCE_OBJECTIVE_OPTIONS = [
  { value: 'all', label: ls('All missions', 'Toutes les missions', 'Alle Missionen') },
  { value: 'with', label: ls('With resource goals', 'Avec objectifs ressource', 'Mit Ressourcenzielen') },
  { value: 'without', label: ls('Without resource goals', 'Sans objectifs ressource', 'Ohne Ressourcenziele') },
] as const;

interface FlatContract {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
}

function getContractKey(contract: MissionContract): string {
  return [
    contract.contractFile,
    contract.handlerDebugName,
    contract.contractDebugName,
    contract.contractorDisplayName,
  ]
    .filter(Boolean)
    .join('::');
}

function getMissionLocalities(contract: MissionContract): string[] {
  return [...new Set([
    ...contract.availability.localities,
    ...contract.availability.explicitLocations,
  ])];
}

function getPrimaryMissionLocation(contract: MissionContract): string | null {
  return getMissionLocalities(contract)[0] ?? null;
}

function getMissionEmployer(contract: MissionContract, group: MissionRewardFactionGroup): MissionEmployerRef | null {
  return contract.employer ?? group.employer ?? null;
}

function getMissionEmployerAssetUrl(employer: MissionEmployerRef | null | undefined): string | null {
  return employer?.logo?.imageUrl ?? employer?.icon?.imageUrl ?? null;
}

function getMissionEmployerName(contract: MissionContract, group: MissionRewardFactionGroup): string {
  return getMissionEmployer(contract, group)?.displayName ?? group.contractorDisplayName;
}

function getMissionSlug(contract: MissionContract, group: MissionRewardFactionGroup): string {
  return missionSlugFromContract(contract.contractDebugName, group.contractorDisplayName);
}

function getMissionHeroAsset(contract: MissionContract, group: MissionRewardFactionGroup): string | null {
  const employer = getMissionEmployer(contract, group);
  return getMissionEmployerAssetUrl(employer);
}

function getEmployerInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

type MissionActivityKind = 'combat' | 'recovery' | 'objective';

function getMissionActivityKind(contract: MissionContract): MissionActivityKind {
  if (contract.resourceObjectives.length > 0) {
    return 'objective';
  }

  const haystack = `${contract.contractDebugName ?? ''} ${contract.handlerDebugName ?? ''}`.toLowerCase();
  if (/(eliminate|kill|clear|bounty|assassinate|hunt|hostile|combat)/.test(haystack)) {
    return 'combat';
  }
  if (/(retrieve|recover|search|investigate|survey|locate|blackbox|explore)/.test(haystack)) {
    return 'recovery';
  }

  return 'objective';
}

function MissionActivityIcon({
  kind,
  size = '1.15rem',
}: {
  kind: MissionActivityKind;
  size?: string;
}) {
  switch (kind) {
    case 'combat':
      return <MilitaryTechOutlinedIcon sx={{ fontSize: size }} />;
    case 'recovery':
      return <TravelExploreOutlinedIcon sx={{ fontSize: size }} />;
    case 'objective':
    default:
      return <FlagIcon sx={{ fontSize: size }} />;
  }
}

function dedupeMissionBlueprints(contract: MissionContract, blueprints: Blueprint[]): Blueprint[] {
  const neededIds = new Set(contract.rewardedBlueprints.map((rewarded) => rewarded.id));
  if (neededIds.size === 0) {
    return [];
  }

  // Index only the blueprints this contract actually rewards, rather than
  // materializing a Map of the entire catalog just to resolve a handful of ids.
  const neededById = new Map<string, Blueprint>();
  for (const blueprint of blueprints) {
    if (neededIds.has(blueprint.id)) {
      neededById.set(blueprint.id, blueprint);
      if (neededById.size === neededIds.size) {
        break;
      }
    }
  }

  const seen = new Set<string>();
  const results: Blueprint[] = [];
  for (const rewardedBlueprint of contract.rewardedBlueprints) {
    if (seen.has(rewardedBlueprint.id)) {
      continue;
    }
    seen.add(rewardedBlueprint.id);
    const blueprint = neededById.get(rewardedBlueprint.id);
    if (blueprint) {
      results.push(blueprint);
    }
  }

  return results;
}

function getMissionMaxStanding(contract: MissionContract): number {
  return Math.max(0, ...contract.minimumRequiredStandings.map((standing) => standing.minReputation ?? 0));
}

function getMissionReputationActivity(contract: MissionContract): string | null {
  const primaryScope = contract.reputationScope?.displayName?.trim()
    || contract.reputationScope?.scopeName?.trim();
  if (primaryScope) {
    return primaryScope;
  }

  for (const standing of contract.minimumRequiredStandings) {
    const standingScope = standing.scopeName?.trim() || standing.scopeKey?.trim();
    if (standingScope) {
      return standingScope;
    }
  }

  return null;
}

function getMissionRewardedBlueprintCount(contract: MissionContract): number {
  return new Set(
    contract.rewardedBlueprints
      .map((rewardedBlueprint) => rewardedBlueprint.id)
      .filter(Boolean),
  ).size;
}

function getScaleRank(scale: string): number {
  switch (scale) {
    case 'specific-location':
      return 0;
    case 'regional-sector':
      return 1;
    case 'planetary-cluster':
      return 2;
    case 'system':
      return 3;
    case 'universe':
      return 4;
    default:
      return 5;
  }
}

function MissionFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ color: 'secondary.main', mt: '2px', lineHeight: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
          }}
        >
          {label}
        </Typography>
        <Box sx={{ color: 'text.primary' }}>
          {typeof value === 'string' ? (
            <Typography variant="body2">{value}</Typography>
          ) : (
            value
          )}
        </Box>
      </Box>
    </Stack>
  );
}

/**
 * Payout facts for one contract.
 *
 * Contract generator missions carry no aUEC: the game computes the payout server-side from
 * the difficulty tiers. So this shows an amount only when the contract declares one, the
 * difficulty band otherwise, and — separately labelled — the employer's declared range,
 * which comes from that employer's other missions and is never this contract's pay.
 */
function MissionPayoutFact({
  contract,
  group,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
}) {
  const { t, lang } = useI18n();
  const explicitReward = contract.payout?.rewardUec ?? null;
  const difficulty = contract.difficulty ?? null;
  const employerRange = group.payoutRange ?? null;

  if (explicitReward === null && !difficulty && !employerRange) {
    return null;
  }

  return (
    <MissionFact
      icon={<PaidOutlinedIcon fontSize="small" />}
      label={t('Payout', 'Paiement')}
      value={
        <Stack spacing={0.5}>
          {explicitReward !== null && explicitReward > 0 ? (
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatUec(explicitReward)}</Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('Calculated in game from difficulty', 'Calculé en jeu selon la difficulté')}
            </Typography>
          )}
          {difficulty && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('Difficulty', 'Difficulté')}: {lang === 'fr' ? difficulty.label.fr : difficulty.label.en}
              {' '}({difficulty.weightedRank}/{difficulty.maxRank})
            </Typography>
          )}
          {employerRange && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {t('This employer pays', 'Cet employeur paie')} {formatUec(employerRange.minRewardUec)}
              {' – '}{formatUec(employerRange.maxRewardUec)}
              {' '}({t('across', 'sur')} {employerRange.missionCount} {t('missions', 'missions')})
            </Typography>
          )}
        </Stack>
      }
    />
  );
}

const PAYOUT_PAGE_SIZE = 25;

/**
 * The mission broker missions that declare a real aUEC reward.
 *
 * These are a different set from the contracts listed below on this page: contract
 * generator missions reward blueprints but never declare an amount, while these declare an
 * amount but never reward blueprints. Keeping them in their own section avoids implying
 * that either number applies to the other.
 */
function MissionPayoutsSection({ payouts }: { payouts: MissionPayouts | null }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const matching = useMemo(
    () =>
      category
        ? payouts?.missions.filter((mission) => mission.category === category) ?? []
        : payouts?.missions ?? [],
    [payouts, category],
  );
  const visible = expanded ? matching : matching.slice(0, PAYOUT_PAGE_SIZE);

  if (!payouts || payouts.missionCount === 0) {
    return null;
  }

  return (
    <Panel
      component="section"
      title={t('Mission payouts', 'Paiements de mission')}
      titleComponent="h2"
      variant="raised"
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t(
          'Missions that declare a reward in the game files. Contracts rewarding blueprints compute their payout in game and are listed separately below.',
          'Missions déclarant une récompense dans les fichiers du jeu. Les contrats récompensant des blueprints calculent leur paiement en jeu et sont listés séparément ci-dessous.',
        )}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.5, mt: 1.5 }}>
        <PageStatCard label={t('Missions', 'Missions')} value={String(payouts.missionCount)} domain="blue" />
        <PageStatCard label={t('Median', 'Médiane')} value={formatUec(payouts.medianRewardUec)} domain="magenta" />
        <PageStatCard label={t('Highest', 'Maximum')} value={formatUec(payouts.maxRewardUec)} />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
        <AppChip
          label={t('All', 'Toutes')}
          size="sm"
          color={category === null ? 'primary' : undefined}
          variant={category === null ? 'filled' : 'outlined'}
          onClick={() => setCategory(null)}
        />
        {payouts.categories.map((name) => (
          <AppChip
            key={name}
            label={name}
            size="sm"
            color={category === name ? 'primary' : undefined}
            variant={category === name ? 'filled' : 'outlined'}
            onClick={() => setCategory(name)}
          />
        ))}
      </Box>

      <Stack spacing={0} sx={{ mt: 1.5 }}>
        {visible.map((mission) => (
          <Box
            key={mission.id}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1.5,
              py: 0.75,
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mission.title}
                {mission.titleIsTemplated && (
                  <Box component="span" sx={{ color: 'text.disabled' }} title={t(
                    'The game fills this title in at runtime.',
                    'Le jeu complète ce titre au runtime.',
                  )}> *</Box>
                )}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {[mission.giver, mission.lawful ? t('Lawful', 'Légale') : t('Unlawful', 'Illégale')]
                  .filter(Boolean)
                  .join(' · ')}
                {mission.buyInUec > 0 && ` · ${t('Buy-in', 'Mise')} ${formatUec(mission.buyInUec)}`}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontFamily: FONT_MONO, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {formatUec(mission.rewardUec)}
              {mission.maxRewardUec != null && ` – ${formatUec(mission.maxRewardUec)}`}
              {mission.plusBonuses && '+'}
            </Typography>
          </Box>
        ))}
      </Stack>

      {matching.length > visible.length && (
        <AppButton variant="secondary" size="sm" onClick={() => setExpanded(true)} sx={{ mt: 1.5 }}>
          {t('Show all', 'Tout afficher')} ({matching.length})
        </AppButton>
      )}
    </Panel>
  );
}

function MissionsFilterBar({
  locations,
  employers,
  rewardBlueprints,
  selectedLocation: locationFilter,
  selectedLegality: legalityFilter,
  selectedEmployer: employerFilter,
  selectedStandingBucket: standingBucketFilter,
  selectedRewardBlueprint: rewardBlueprintFilter,
  selectedResourceObjectiveMode: resourceObjectiveMode,
  selectedSort: sortBy,
  search,
  onLocationChange,
  onLegalityChange,
  onEmployerChange,
  onStandingBucketChange,
  onRewardBlueprintChange,
  onResourceObjectiveModeChange,
  onSortChange,
  onSearchChange,
}: {
  locations: string[];
  employers: string[];
  rewardBlueprints: string[];
  selectedLocation: string | null;
  selectedLegality: string;
  selectedEmployer: string | null;
  selectedStandingBucket: StandingBucket;
  selectedRewardBlueprint: string | null;
  selectedResourceObjectiveMode: 'all' | 'with' | 'without';
  selectedSort: MissionSort;
  search: string;
  onLocationChange: (v: string | null) => void;
  onLegalityChange: (v: string) => void;
  onEmployerChange: (v: string | null) => void;
  onStandingBucketChange: (v: StandingBucket) => void;
  onRewardBlueprintChange: (v: string | null) => void;
  onResourceObjectiveModeChange: (v: 'all' | 'with' | 'without') => void;
  onSortChange: (v: MissionSort) => void;
  onSearchChange: (v: string) => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const hasActiveFilters =
    locationFilter !== null ||
    employerFilter !== null ||
    legalityFilter !== 'all' ||
    standingBucketFilter !== 'all' ||
    rewardBlueprintFilter !== null ||
    resourceObjectiveMode !== 'all';
  const compactControlSx = { minHeight: 32, fontSize: TEXT_LABEL };
  const stringOptions = (options: string[]) => options.map((value) => ({ label: value, value }));
  const resetFilters = () => {
    onLocationChange(null);
    onEmployerChange(null);
    onLegalityChange('all');
    onStandingBucketChange('all');
    onRewardBlueprintChange(null);
    onResourceObjectiveModeChange('all');
  };

  const filters = (
    <Paper
      variant="outlined"
      component="section"
      aria-label={t('Mission filters', 'Filtres de mission')}
      sx={{
        p: { xs: 1.25, md: 1.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        borderColor: alpha(theme.palette.primary.main, 0.14),
        backgroundColor: alpha(theme.palette.background.default, 0.24),
      }}
    >
      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', xl: 'center' }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'secondary.main', letterSpacing: '0.12em' }}>
            {t('Mission filters', 'Filtres missions', 'Missionsfilter')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(
              'Search across every mission field, then filter by employer, theater, reward, standing and legality.',
              'Recherchez dans tous les champs, puis filtrez par employeur, théâtre, récompense, réputation et légalité.',
              'Suche über alle Missionsfelder und filtere nach Arbeitgeber, Einsatzraum, Belohnung, Ruf und Legalität.',
            )}
          </Typography>
        </Box>
        {hasActiveFilters && (
          <AppButton
            variant="secondary"
            size="sm"
            icon={<FilterListOffOutlinedIcon />}
            onClick={resetFilters}
            ariaLabel={t('Reset mission filters', 'Réinitialiser les filtres de mission')}
            sx={{ whiteSpace: 'nowrap', alignSelf: { xs: 'flex-start', xl: 'center' } }}
          >
            {t('Reset filters', 'Réinitialiser', 'Filter zurücksetzen')}
          </AppButton>
        )}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(210px, 0.45fr)' }, gap: 1 }}>
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: 'text.secondary', lineHeight: 0, pointerEvents: 'none' }}>
            <AppGlyph name="search" size={18} />
          </Box>
          <AppTextField
            type="search"
            placeholder={t('Search contracts...', 'Rechercher des contrats...')}
            value={search}
            onValueChange={onSearchChange}
            ariaLabel={t('Search missions', 'Rechercher des missions')}
            sx={{ ...compactControlSx, width: '100%', pl: 4 }}
          />
        </Box>
        <AppSelect
          value={sortBy}
          options={MISSION_SORT_OPTIONS.map((option) => ({ value: option.value, label: loc(option.label, lang) }))}
          onValueChange={(value) => { if (value) onSortChange(value); }}
          ariaLabel={t('Sort missions', 'Trier les missions')}
          sx={compactControlSx}
        />
      </Box>

      <Box role="group" aria-label={t('Legality filter', 'Filtre de légalité')} sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: t('All', 'Tous') },
          { value: 'lawful', label: t('Lawful', 'Légal') },
          { value: 'unlawful', label: t('Unlawful', 'Illégal') },
        ].map((option) => (
          <AppButton
            key={option.value}
            variant={legalityFilter === option.value ? 'primary' : 'secondary'}
            size="sm"
            ariaPressed={legalityFilter === option.value}
            ariaLabel={`${t('Show', 'Afficher')} ${option.label.toLowerCase()}`}
            onClick={() => onLegalityChange(option.value)}
          >
            {option.label}
          </AppButton>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, gap: 1 }}>
        <AppSelect
          value={employerFilter}
          options={stringOptions(employers)}
          onValueChange={onEmployerChange}
          placeholder={t('Employer', 'Employeur')}
          ariaLabel={t('Filter by employer', 'Filtrer par employeur')}
          clearable
          filterable
          sx={compactControlSx}
        />
        <AppSelect
          value={locationFilter}
          options={stringOptions(locations)}
          onValueChange={onLocationChange}
          placeholder={t('Location', 'Lieu')}
          ariaLabel={t('Filter by location', 'Filtrer par lieu')}
          clearable
          filterable
          sx={compactControlSx}
        />
        <AppSelect
          value={rewardBlueprintFilter}
          options={stringOptions(rewardBlueprints)}
          onValueChange={onRewardBlueprintChange}
          placeholder={t('Reward blueprint', 'Blueprint récompense')}
          ariaLabel={t('Filter by reward blueprint', 'Filtrer par blueprint récompense')}
          clearable
          filterable
          sx={compactControlSx}
        />
        <AppSelect
          value={standingBucketFilter}
          options={STANDING_OPTIONS.map((option) => ({ value: option.value, label: loc(option.label, lang) }))}
          onValueChange={(value) => { if (value) onStandingBucketChange(value); }}
          ariaLabel={t('Standing requirement', 'Prérequis réputation')}
          sx={compactControlSx}
        />
        <AppSelect
          value={resourceObjectiveMode}
          options={RESOURCE_OBJECTIVE_OPTIONS.map((option) => ({ value: option.value, label: loc(option.label, lang) }))}
          onValueChange={(value) => { if (value) onResourceObjectiveModeChange(value); }}
          ariaLabel={t('Resource objective filter', 'Filtre objectif ressource')}
          sx={compactControlSx}
        />
      </Box>
    </Paper>
  );

  return (
    <ResponsiveFilters
      title={t('Mission filters and sort', 'Filtres et tri des missions')}
      triggerLabel={t('Filters and sort', 'Filtres et tri')}
      closeLabel={t('Show missions', 'Afficher les missions')}
      dismissLabel={t('Close mission filters', 'Fermer les filtres de mission')}
      summary={hasActiveFilters ? t('Filters active', 'Filtres actifs') : t('All missions', 'Toutes les missions')}
    >
      {filters}
    </ResponsiveFilters>
  );
}

const ContractRow = memo(function ContractRow({
  contract,
  group,
  onOpen,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
  onOpen: (contract: MissionContract, group: MissionRewardFactionGroup) => void;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const contractName = getMissionContractName(contract) ?? t('Unnamed contract', 'Contrat sans nom');
  const employerName = getMissionEmployerName(contract, group);
  const primaryLocation = getPrimaryMissionLocation(contract);
  const blueprintCount = getMissionRewardedBlueprintCount(contract);
  const dropChance = getMissionBlueprintDropChance(contract);
  const isLawful = (group.faction?.factionType?.toLowerCase() ?? '') !== 'unlawful';
  const scale = contract.availability.derivedScale;
  const href = missionPathFromSlug(getMissionSlug(contract, group));

  return (
    <Box
      component="tr"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0,1fr) minmax(0,0.5fr) minmax(0,0.5fr) 96px' },
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: `1px solid ${theme.palette.ui.border}`,
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
        transition: 'background-color 120ms',
      }}
    >
      <Box component="td" sx={{ minWidth: 0 }}>
        <Box
          component="a"
          href={href}
          onClick={(event) => {
            if (!shouldHandleInternalLinkClick(event)) return;
            event.preventDefault();
            onOpen(contract, group);
          }}
          aria-label={`${t('Open mission dossier', 'Ouvrir le dossier mission')}: ${contractName}`}
          sx={{
            display: 'inline-block',
            maxWidth: '100%',
            color: 'text.primary',
            textDecoration: 'none',
            '&:hover': { color: 'primary.main', textDecoration: 'underline' },
            '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
          }}
        >
          <Typography noWrap sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.875rem', color: 'inherit' }}>
            {contractName}
          </Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: TEXT_LABEL, color: 'text.secondary' }}>
          {employerName}{primaryLocation ? ` · ${primaryLocation}` : ''}
        </Typography>
      </Box>

      <Box component="td" sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
        {scale && (
          <Typography sx={{ fontSize: TEXT_LABEL, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {formatScaleLabel(scale, lang)}
          </Typography>
        )}
        <Typography sx={{ fontSize: TEXT_LABEL, color: isLawful ? 'success.main' : 'warning.main' }}>
          {isLawful ? t('Lawful', 'Légal') : t('Unlawful', 'Illégal')}
        </Typography>
      </Box>

      <Box component="td" sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
        <Typography sx={{ fontSize: TEXT_LABEL, color: 'text.secondary' }}>
          {blueprintCount} bp
        </Typography>
      </Box>

      <Box component="td" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75, flexShrink: 0 }}>
        {dropChance > 0 && (
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.78rem', fontWeight: 700, color: 'primary.main' }}>
            {formatProbabilityPercent(dropChance)}
          </Typography>
        )}
        <Box
          component="a"
          href={href}
          onClick={(event) => {
            if (!shouldHandleInternalLinkClick(event)) return;
            event.preventDefault();
            onOpen(contract, group);
          }}
          aria-label={`${t('Open mission dossier', 'Ouvrir le dossier mission')}: ${contractName}`}
          sx={{ display: 'inline-flex', color: 'text.secondary', p: 0.5, borderRadius: 1 }}
        >
          <ChevronRightIcon sx={{ fontSize: '1rem' }} />
        </Box>
      </Box>
    </Box>
  );
});

const ContractCard = memo(function ContractCard({
  contract,
  group,
  onBlueprintClick,
  onOpen,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
  onBlueprintClick: (blueprintId: string) => void;
  onOpen: (contract: MissionContract, group: MissionRewardFactionGroup) => void;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const href = missionPathFromSlug(getMissionSlug(contract, group));
  const factionType = group.faction?.factionType?.toLowerCase() ?? '';
  const isUnlawful = factionType === 'unlawful';
  const blueprintDropChance = getMissionBlueprintDropChance(contract);
  const blueprintCount = getMissionRewardedBlueprintCount(contract);
  const primaryLocation = getPrimaryMissionLocation(contract);
  const locationIconName = primaryLocation ? getLocationIconName(primaryLocation) : null;
  const activityKind = getMissionActivityKind(contract);
  const employerName = getMissionEmployerName(contract, group);
  const employerLogoUrl = getMissionHeroAsset(contract, group);
  const initials = getEmployerInitials(employerName);
  const factionColor = isUnlawful ? theme.palette.warning.main : theme.palette.primary.main;
  const maxStanding = getMissionMaxStanding(contract);
  const topStanding = contract.minimumRequiredStandings.length > 0
    ? [...contract.minimumRequiredStandings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0))[0]
    : null;
  const standingLabel = maxStanding > 0 && topStanding
    ? (topStanding.standingName?.trim() || topStanding.scopeName?.trim() || null)
    : null;

  return (
    <Card
      role="listitem"
      aria-label={getMissionContractName(contract)}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderColor: 'ui.border',
        bgcolor: 'ui.surface',
        overflow: 'hidden',
        transition: 'border-color 150ms, box-shadow 150ms, transform 150ms',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.55),
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.28)}`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      {/* Clickable overlay */}
      <Box
        component="a"
        href={href}
        aria-label={t('Open mission dossier', 'Ouvrir le dossier mission')}
        onClick={(event) => {
          if (!shouldHandleInternalLinkClick(event)) return;
          event.preventDefault();
          onOpen(contract, group);
        }}
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          cursor: 'pointer',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      />

      {/* Colored top stripe */}
      <Box sx={{ height: 3, bgcolor: isUnlawful ? 'warning.main' : 'primary.main', opacity: 0.85, flexShrink: 0 }} />

      {/* Card head */}
      <Box sx={{ p: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {/* Eyebrow row: faction glyph + name + legal badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {/* Employer logo or initials fallback */}
            {employerLogoUrl ? (
              <Box
                component="img"
                src={employerLogoUrl}
                alt={employerName}
                sx={{
                  width: 36,
                  height: 36,
                  objectFit: 'contain',
                  borderRadius: 0.75,
                  flexShrink: 0,
                  filter: `drop-shadow(0 2px 6px ${alpha(theme.palette.common.black, 0.5)})`,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  bgcolor: alpha(factionColor, 0.14),
                  color: factionColor,
                  border: `1px solid ${alpha(factionColor, 0.42)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {initials}
              </Box>
            )}
            <Typography
              noWrap
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: TEXT_LABEL_LG,
                color: 'text.secondary',
                minWidth: 0,
              }}
            >
              {employerName}
            </Typography>
          </Box>
          {/* Legal badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.875,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: isUnlawful ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.primary.main, 0.1),
              color: isUnlawful ? 'warning.main' : 'primary.main',
              fontFamily: FONT_MONO,
              fontSize: TEXT_LABEL_SM,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            {isUnlawful ? t('Unlawful', 'Illégal') : t('Lawful', 'Légal')}
          </Box>
        </Box>

        {/* Mission title */}
        <Typography
          component="h3"
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: '1rem',
            lineHeight: 1.25,
            color: 'text.primary',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {getMissionContractName(contract)}
        </Typography>

        {/* Location row */}
        {primaryLocation && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, color: 'text.secondary' }}>
            {locationIconName ? (
              <StarCitizenLicensedIcon name={locationIconName} size={14} dimmed />
            ) : (
              <PlaceOutlinedIcon sx={{ fontSize: 14 }} />
            )}
            <Typography noWrap sx={{ fontSize: TEXT_LABEL_LG, color: 'text.secondary' }}>
              {primaryLocation}
              {contract.availability.derivedScale && (
                <Box component="span" sx={{ ml: 0.75, color: 'text.disabled', fontSize: TEXT_LABEL }}>
                  · {formatScaleLabel(contract.availability.derivedScale, lang)}
                </Box>
              )}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Facts grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: '1px solid',
          borderColor: 'ui.border',
          bgcolor: 'background.paper',
        }}
      >
        {[
          {
            label: t('Pool', 'Pool'),
            value: `${blueprintCount} bp`,
          },
          {
            label: t('Scale', 'Portée'),
            value: contract.availability.derivedScale
              ? formatScaleLabel(contract.availability.derivedScale, lang)
              : '—',
          },
          {
            label: t('Standing', 'Réputation'),
            value: standingLabel ?? (maxStanding > 0 ? String(maxStanding) : t('None', 'Aucune')),
          },
        ].map((fact, i) => (
          <Box
            key={i}
            sx={{
              p: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              borderRight: i < 2 ? '1px solid' : 'none',
              borderColor: 'ui.border',
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: TEXT_LABEL_SM,
                color: 'text.secondary',
              }}
            >
              {fact.label}
            </Typography>
            <Typography
              noWrap
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: TEXT_LABEL_LG,
                color: 'text.primary',
              }}
            >
              {fact.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Blueprint pool section */}
      {contract.rewardedBlueprints.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid', borderColor: 'ui.border', flex: 1, minHeight: 0 }}>
          {/* Pool header */}
          <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('Pool', 'Pool')} · {blueprintCount} {t('blueprints', 'blueprints')}
            </Typography>
            {blueprintDropChance > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 4,
                    borderRadius: 99,
                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${Math.min(blueprintDropChance * 100, 100)}%`,
                      bgcolor: 'primary.main',
                      borderRadius: 99,
                    }}
                  />
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'primary.main', fontWeight: 600 }}>
                  {formatProbabilityPercent(blueprintDropChance)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Pool list */}
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: 'relative',
              zIndex: 2,
              overflowY: 'auto',
              maxHeight: 264,
              scrollbarWidth: 'thin',
              scrollbarColor: `${alpha(theme.palette.primary.main, 0.28)} transparent`,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.primary.main, 0.28), borderRadius: 99 },
            }}
          >
            {contract.rewardedBlueprints.map((blueprint, index) => {
              const rarityColor = alpha(theme.palette.primary.main, 0.7);
              const bpChance = blueprintDropChance > 0 && blueprintCount > 0
                ? blueprintDropChance / blueprintCount
                : null;

              return (
                <Box
                  key={`${blueprint.id}-${index}`}
                  component="a"
                  href={`/item/${toSlug(blueprint.name)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!shouldHandleInternalLinkClick(event)) return;
                    event.preventDefault();
                    onBlueprintClick(blueprint.id);
                  }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '3px 20px 1fr auto auto 20px',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.875,
                    textDecoration: 'none',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.5),
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                  }}
                >
                  {/* Rarity stripe */}
                  <Box sx={{ width: 3, height: 28, borderRadius: 99, bgcolor: rarityColor, flexShrink: 0 }} />
                  {/* Category icon */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
                    {blueprint.category ? (
                      <CategoryBadge category={blueprint.category} iconOnly />
                    ) : (
                      <MissionActivityIcon kind={activityKind} size="1rem" />
                    )}
                  </Box>
                  {/* Name */}
                  <Typography
                    noWrap
                    sx={{
                      fontSize: TEXT_LABEL_LG,
                      fontWeight: 500,
                      color: 'text.primary',
                      minWidth: 0,
                    }}
                  >
                    {blueprint.name}
                  </Typography>
                  {/* Manufacturer */}
                  {blueprint.manufacturer && (
                    <Typography
                      noWrap
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: TEXT_LABEL_SM,
                        color: 'text.disabled',
                        flexShrink: 0,
                        maxWidth: 64,
                      }}
                    >
                      {blueprint.manufacturer}
                    </Typography>
                  )}
                  {/* Chance */}
                  {bpChance !== null && (
                    <Typography
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: TEXT_LABEL_SM,
                        color: 'primary.main',
                        fontWeight: 600,
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {formatProbabilityPercent(bpChance)}
                    </Typography>
                  )}
                  {/* Chevron */}
                  <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Card>
  );
});

function MissionHero({
  contract,
  group,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const employer = getMissionEmployer(contract, group);
  const heroAsset = getMissionHeroAsset(contract, group);
  const factionType = contract.faction?.factionType?.toLowerCase() ?? group.faction?.factionType?.toLowerCase() ?? '';
  const isUnlawful = factionType === 'unlawful';
  const locations = getMissionLocalities(contract);
  const primaryLocation = locations[0] ?? t('Unknown theater', 'Theatre inconnu');

  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'relative',
        minHeight: { xs: 240, md: 320 },
        overflow: 'hidden',
        p: { xs: 2, md: 3 },
        background: isUnlawful
          ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.2)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 48%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 42%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
        borderColor: theme.palette.ui.borderStrong,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.2)}, transparent 35%),
            radial-gradient(circle at bottom left, ${alpha(theme.palette.secondary.main, 0.16)}, transparent 32%)
          `,
          pointerEvents: 'none',
        }}
      />

      {heroAsset ? (
        <Box
          component="img"
          src={heroAsset}
          alt={employer?.displayName ?? primaryLocation}
          loading="lazy"
          referrerPolicy="no-referrer"
          sx={{
            position: 'absolute',
            right: { xs: -20, md: -8 },
            bottom: { xs: -20, md: -12 },
            width: { xs: 140, md: 220 },
            height: { xs: 140, md: 220 },
            objectFit: 'contain',
            opacity: 0.18,
            filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.35))',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <Box
          sx={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            color: alpha(theme.palette.text.primary, 0.12),
            pointerEvents: 'none',
          }}
        >
          <ImageNotSupportedOutlinedIcon sx={{ fontSize: 96 }} />
        </Box>
      )}

      <Stack sx={{ position: 'relative', zIndex: 1, height: '100%', justifyContent: 'space-between' }}>
        <Stack spacing={1.25}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <ScaleBadge scale={contract.availability.derivedScale} label={formatScaleLabel(contract.availability.derivedScale, lang)} />
            <AppChip
              label={factionType === 'unlawful' ? t('Unlawful', 'Illegal') : t('Lawful', 'Legal')}
              size="small"
              color={factionType === 'unlawful' ? 'error' : 'success'}
              variant="outlined"
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            {t('Mission theater', 'Theatre de mission')}
          </Typography>
          <Typography variant="h2" sx={{ lineHeight: 0.95 }}>
            {primaryLocation}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
            {getMissionContractName(contract)}
          </Typography>
        </Stack>

        <Stack spacing={1.25}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {locations.map((location) => {
                const iconName = getLocationIconName(location);
                return (
                  <AppChip
                    key={location}
                    label={location}
                    size="small"
                    variant="outlined"
                    icon={iconName ? <StarCitizenLicensedIcon name={iconName} size={14} dimmed /> : undefined}
                  />
                );
              })}
            </Box>
          <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {t('Employer', 'Employeur')}
              </Typography>
              <Typography sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, mt: 0.5 }}>
                {employer?.displayName ?? group.contractorDisplayName}
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
}

function MissionDetail({
  selection,
  blueprints,
  favoriteIds,
  inventoryIds,
  resources,
  onBack,
  onBlueprintOpen,
  onToggleFavorite,
  onToggleInventory,
}: {
  selection: FlatContract;
  blueprints: Blueprint[];
  favoriteIds: string[];
  inventoryIds: string[];
  resources: Resource[];
  onBack: () => void;
  onBlueprintOpen: (blueprintId: string) => void;
  onToggleFavorite: (blueprintId: string) => void;
  onToggleInventory: (blueprintId: string) => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { contract, group } = selection;
  const employer = getMissionEmployer(contract, group);
  const employerAssetUrl = getMissionEmployerAssetUrl(employer);
  const employerSourceUrl = sanitizeExternalHttpsUrl(employer?.sourcePageUrl);
  const localities = getMissionLocalities(contract);
  const missionBlueprints = useMemo(() => dedupeMissionBlueprints(contract, blueprints), [contract, blueprints]);
  const blueprintDropChance = getMissionBlueprintDropChance(contract);

  return (
    <>
      <PageHeader
        variant="compact"
        eyebrow={t('Mission dossier', 'Dossier de mission')}
        title={getMissionContractName(contract)}
        description={`${employer?.displayName ?? group.contractorDisplayName}${localities[0] ? ` · ${localities[0]}` : ''}`}
        actions={(
          <AppButton
            variant="secondary"
            size="sm"
            icon={<AppGlyph name="arrow-left" size={18} />}
            onClick={onBack}
            ariaLabel={t('Back to missions', 'Retour aux missions')}
          >
            {t('Back to missions', 'Retour aux missions')}
          </AppButton>
        )}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' }, gap: { xs: 2, md: 3 }, alignItems: 'start' }}>
        <Stack spacing={2}>
          <MissionHero contract={contract} group={group} />

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2.25} divider={<Divider flexItem />}>
            <MissionFact icon={<BusinessOutlinedIcon fontSize="small" />} label={t('Mission name', 'Mission')} value={getMissionContractName(contract)} />
            <MissionPayoutFact contract={contract} group={group} />
              <MissionFact
                icon={<VerifiedOutlinedIcon fontSize="small" />}
                label={t('Employer', 'Employeur')}
                value={
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      {employerAssetUrl && (
                        <Box
                          component="img"
                          src={employerAssetUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          sx={{
                            width: 44,
                            height: 44,
                            p: 0.75,
                            objectFit: 'contain',
                            borderRadius: 1.25,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            backgroundColor: (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0.75),
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Typography variant="body2">{employer?.displayName ?? group.contractorDisplayName}</Typography>
                    </Stack>
                    {employerSourceUrl && (
                      <Link
                        href={employerSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: TEXT_LABEL }}
                      >
                        {t('Open source page', 'Ouvrir la source')}
                        <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
                      </Link>
                    )}
                </Stack>
              }
            />
            <MissionFact
              icon={<PublicOutlinedIcon fontSize="small" />}
              label={t('Jurisdiction', 'Juridiction')}
              value={
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    {group.faction?.displayName ?? t('Unknown faction', 'Faction inconnue')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {formatScaleLabel(contract.availability.derivedScale, lang)}
                  </Typography>
                </Stack>
              }
            />
            {group.reputationScopes.length > 0 && group.reputationScopes.some((scope) => scope.standings && scope.standings.length > 0) && (
              <MissionFact
                icon={<LeaderboardOutlinedIcon fontSize="small" />}
                label={t('Reputation tracks', 'Voies de reputation', 'Reputationswege')}
                value={
                  <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                    {group.reputationScopes
                      .filter((scope, index, arr) =>
                        scope.standings && scope.standings.length > 0 &&
                        arr.findIndex((s) => (s.displayName ?? s.scopeName) === (scope.displayName ?? scope.scopeName)) === index,
                      )
                      .map((scope) => (
                        <Stack key={scope.guid ?? scope.scopeName} spacing={0.25} sx={{ minWidth: 140 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              color: 'primary.light',
                              fontSize: TEXT_LABEL,
                            }}
                          >
                            {scope.displayName ?? scope.scopeName}
                          </Typography>
                          {scope.standings!
                            .filter((tier) => (tier.minReputation ?? 0) >= 0)
                            .sort((a, b) => (a.minReputation ?? 0) - (b.minReputation ?? 0))
                            .map((tier, ti) => (
                              <Typography
                                key={tier.guid ?? ti}
                                variant="body2"
                                sx={{
                                  fontSize: TEXT_LABEL,
                                  color: 'text.secondary',
                                  lineHeight: 1.5,
                                }}
                              >
                                {tier.displayName}
                              </Typography>
                            ))}
                        </Stack>
                      ))}
                  </Stack>
                }
              />
            )}
            <MissionFact
              icon={<PlaceOutlinedIcon fontSize="small" />}
              label={t('Locations', 'Lieux')}
              value={
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {localities.length > 0 ? localities.map((location) => {
                    const iconName = getLocationIconName(location);
                    return (
                      <AppChip
                        key={location}
                        label={location}
                        size="small"
                        variant="outlined"
                        icon={iconName ? <StarCitizenLicensedIcon name={iconName} size={14} dimmed /> : undefined}
                      />
                    );
                  }) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t('No locality data', 'Aucune localisation')}
                    </Typography>
                  )}
                </Stack>
              }
            />
            <MissionFact
              icon={<MilitaryTechOutlinedIcon fontSize="small" />}
              label={t('Standing requirements', 'Conditions de reputation')}
              value={
                contract.minimumRequiredStandings.length > 0 ? (
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {contract.minimumRequiredStandings.map((standing: MissionRequiredStanding, index) => (
                      <AppChip
                        key={`${standing.factionName ?? 'standing'}-${index}`}
                        label={formatStandingLabel(standing, lang)}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('No standing gate', 'Aucune restriction')}
                  </Typography>
                )
              }
            />
            {contract.rewardedBlueprints.length > 0 && (
              <MissionFact
                icon={<VerifiedOutlinedIcon fontSize="small" />}
                label={t('Blueprint chance', 'Chance blueprint', 'Blueprint-Chance')}
                value={formatProbabilityPercent(blueprintDropChance)}
              />
            )}
            {(contract.resourceObjectives.length > 0 || contract.itemAwards.length > 0) && (
              <MissionFact
                icon={<TravelExploreOutlinedIcon fontSize="small" />}
                label={t('Operational notes', 'Notes operationnelles')}
                value={
                  <Stack spacing={0.75}>
                    {contract.resourceObjectives.length > 0 && (
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {contract.resourceObjectives.map((objective) => (
                          <AppChip
                            key={`${objective.resourceId}-${objective.minScu}-${objective.maxScu}`}
                            label={`${objective.displayName} ${objective.minScu}-${objective.maxScu} SCU`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    )}
                    {contract.itemAwards.length > 0 && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {contract.itemAwards.length} {t('item awards', 'recompenses d objet')}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            )}
          </Stack>
        </Paper>
      </Stack>

      <Stack spacing={2}>
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
          }}
        >
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.14em' }}>
              {t('Blueprint rewards', 'Recompenses blueprint')}
            </Typography>
            <Typography variant="h4" sx={{ lineHeight: 0.95 }}>
              {getMissionContractName(contract)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 720 }}>
              {t(
                'Loot table view for this contract. Click any blueprint card to jump to the craft workspace.',
                'Vue des blueprints obtenables sur ce contrat. Clique sur une carte pour ouvrir son espace de craft.',
              )}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <AppChip label={`${missionBlueprints.length} ${t('lootable blueprints', 'blueprints recuperables')}`} size="small" />
              <AppChip
                label={`${formatProbabilityPercent(blueprintDropChance)} ${t('blueprint chance', 'chance blueprint', 'Blueprint-Chance')}`}
                size="small"
                variant="outlined"
              />
              <AppChip label={formatScaleLabel(contract.availability.derivedScale, lang)} size="small" variant="outlined" />
              {localities[0] && (() => {
                const iconName = getLocationIconName(localities[0]);
                return (
                  <AppChip
                    label={localities[0]}
                    size="small"
                    variant="outlined"
                    icon={iconName ? <StarCitizenLicensedIcon name={iconName} size={14} dimmed /> : undefined}
                  />
                );
              })()}
            </Stack>
          </Stack>
        </Paper>

        {missionBlueprints.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'No blueprint rewards are linked to this mission in the current dataset.',
                'Aucune recompense blueprint n est liee a cette mission dans le dataset actuel.',
              )}
            </Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
              gap: 3,
            }}
            role="list"
            aria-label={t('Lootable blueprint list', 'Liste des blueprints recuperables')}
          >
            {missionBlueprints.map((blueprint) => (
              <BlueprintCard
                key={blueprint.id}
                blueprint={blueprint}
                isActive={false}
                isFavorite={favoriteIds.includes(blueprint.id)}
                isInInventory={inventoryIds.includes(blueprint.id)}
                resources={resources}
                onSelect={(bp) => { if (bp) onBlueprintOpen(bp.id); }}
                onToggleFavorite={onToggleFavorite}
                onToggleInventory={onToggleInventory}
              />
            ))}
          </Box>
        )}
        </Stack>
      </Box>
    </>
  );
}

function missionGetColumns(containerWidth: number): number {
  if (containerWidth >= 1200) return 3;
  if (containerWidth >= 760) return 2;
  return 1;
}

export function MissionsPanel() {
  const {
    missionRewards,
    missionRewardsLoading,
    missionRewardsError,
    ensureMissionRewardsLoaded,
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
    factionContractsLoadingIds,
    blueprints,
    favoriteIds,
    inventoryIds,
    setActiveBlueprint,
    toggleFavorite,
    toggleInventory,
    activeDataset,
  } = useCraft();
  const { t } = useI18n();

  useEffect(() => {
    void ensureMissionRewardsLoaded();
  }, [ensureMissionRewardsLoaded]);

  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState('all');
  const [employerFilter, setEmployerFilter] = useState<string | null>(null);
  const [standingBucketFilter, setStandingBucketFilter] = useState<StandingBucket>('all');
  const [rewardBlueprintFilter, setRewardBlueprintFilter] = useState<string | null>(null);
  const [resourceObjectiveMode, setResourceObjectiveMode] = useState<'all' | 'with' | 'without'>('all');
  const [sortBy, setSortBy] = useState<MissionSort>('name-asc');
  const [search, setSearch] = useState('');
  const [missionView, setMissionView] = useState<'cards' | 'rows'>('cards');
  const [selectedMissionSlug, setSelectedMissionSlug] = useState<string | null>(() =>
    missionSlugFromPathname(window.location.pathname),
  );

  useEffect(() => {
    if (!missionRewards) return;

    const requestedFactionId = selectedMissionSlug ? null : missionRewards.factionGroups[0]?.id ?? null;
    if (requestedFactionId) {
      void ensureFactionContractsLoaded(requestedFactionId);
    }
  }, [missionRewards, selectedMissionSlug, ensureFactionContractsLoaded]);

  const resources = activeDataset.resources;
  const allContracts = useMemo<FlatContract[]>(() => {
    if (!missionRewards) return [];
    const results: FlatContract[] = [];
    for (const group of missionRewards.factionGroups) {
      // New datasets: contracts are lazy-loaded per faction.
      // Old datasets (backward compat): contracts are still embedded.
      const contracts = factionContractsByFactionId[group.id] ?? group.contracts ?? [];
      for (const contract of contracts) {
        results.push({ contract, group });
      }
    }
    return results.sort((a, b) =>
      getMissionContractName(a.contract).localeCompare(getMissionContractName(b.contract)),
    );
  }, [missionRewards, factionContractsByFactionId]);

  const allLocations = useMemo(() => {
    const set = new Set<string>();
    for (const { contract } of allContracts) {
      for (const location of getMissionLocalities(contract)) {
        set.add(location);
      }
    }
    return [...set].sort();
  }, [allContracts]);

  const allEmployers = useMemo(() => {
    const set = new Set<string>();
    for (const group of missionRewards?.factionGroups ?? []) {
      const employerLabel = group.employer?.displayName ?? group.contractorDisplayName;
      if (employerLabel) {
        set.add(employerLabel);
      }
    }
    for (const { contract, group } of allContracts) {
      set.add(getMissionEmployerName(contract, group));
    }
    return [...set].sort();
  }, [allContracts, missionRewards]);

  const allFactions = useMemo(() => {
    const set = new Set<string>();
    for (const group of missionRewards?.factionGroups ?? []) {
      const label = group.faction?.displayName;
      if (label) {
        set.add(label);
      }
    }
    for (const { group, contract } of allContracts) {
      const label = group.faction?.displayName ?? contract.faction?.displayName;
      if (label) {
        set.add(label);
      }
    }
    return [...set].sort();
  }, [allContracts, missionRewards]);

  const allRewardBlueprints = useMemo(() => {
    const set = new Set<string>();
    for (const { contract } of allContracts) {
      for (const blueprint of contract.rewardedBlueprints) {
        if (blueprint.name) {
          set.add(blueprint.name);
        }
      }
    }
    return [...set].sort();
  }, [allContracts]);

  const searchLower = search.toLowerCase().trim();

  const filteredContracts = useMemo<FlatContract[]>(() => {
    const filtered = allContracts.filter(({ contract, group }) => {
      const employerName = getMissionEmployerName(contract, group);
      const factionName = group.faction?.displayName ?? contract.faction?.displayName ?? null;
      const maxStanding = getMissionMaxStanding(contract);

      if (legalityFilter !== 'all') {
        const factionType = group.faction?.factionType?.toLowerCase() ?? null;
        const isExplicitlyUnlawful = factionType === 'unlawful';
        if (legalityFilter === 'unlawful' && !isExplicitlyUnlawful) {
          return false;
        }
        if (legalityFilter === 'lawful' && isExplicitlyUnlawful) {
          return false;
        }
      }
      if (employerFilter && employerName !== employerFilter) {
        return false;
      }
      if (locationFilter && !getMissionLocalities(contract).includes(locationFilter)) {
        return false;
      }
      if (standingBucketFilter !== 'all' && getStandingBucket(maxStanding) !== standingBucketFilter) {
        return false;
      }
      if (
        rewardBlueprintFilter &&
        !contract.rewardedBlueprints.some((rewardedBlueprint) => rewardedBlueprint.name === rewardBlueprintFilter)
      ) {
        return false;
      }
      if (resourceObjectiveMode === 'with' && contract.resourceObjectives.length === 0) {
        return false;
      }
      if (resourceObjectiveMode === 'without' && contract.resourceObjectives.length > 0) {
        return false;
      }
      if (!searchLower) {
        return true;
      }
      const haystack = [
        getMissionContractName(contract),
        contract.contractDebugName ?? '',
        contract.contractorDisplayName ?? '',
        group.contractorDisplayName,
        employerName,
        factionName ?? '',
        getMissionReputationActivity(contract) ?? '',
        ...getMissionLocalities(contract),
        ...contract.rewardedBlueprints.map((rewardedBlueprint) => rewardedBlueprint.name),
        ...contract.rewardedBlueprints.map((rewardedBlueprint) => rewardedBlueprint.manufacturer ?? ''),
        ...contract.resourceObjectives.map((objective) => objective.displayName),
      ].join(' ').toLowerCase();
      return haystack.includes(searchLower);
    });

    return filtered.sort((left, right) => {
      switch (sortBy) {
        case 'employer-asc':
          return getMissionEmployerName(left.contract, left.group).localeCompare(getMissionEmployerName(right.contract, right.group), undefined, { numeric: true, sensitivity: 'base' })
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'standing-asc':
          return getMissionMaxStanding(left.contract) - getMissionMaxStanding(right.contract)
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'standing-desc':
          return getMissionMaxStanding(right.contract) - getMissionMaxStanding(left.contract)
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'scale-asc':
          return getScaleRank(left.contract.availability.derivedScale) - getScaleRank(right.contract.availability.derivedScale)
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'location-asc':
          return String(getPrimaryMissionLocation(left.contract) ?? '').localeCompare(String(getPrimaryMissionLocation(right.contract) ?? ''), undefined, { numeric: true, sensitivity: 'base' })
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'blueprint-count-asc':
          return getMissionRewardedBlueprintCount(left.contract) - getMissionRewardedBlueprintCount(right.contract)
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'blueprint-count-desc':
          return getMissionRewardedBlueprintCount(right.contract) - getMissionRewardedBlueprintCount(left.contract)
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'chance-desc':
          return getMissionBlueprintDropChance(right.contract) - getMissionBlueprintDropChance(left.contract)
            || getMissionContractName(left.contract).localeCompare(getMissionContractName(right.contract), undefined, { numeric: true, sensitivity: 'base' });
        case 'name-asc':
        default:
          return getMissionContractName(left.contract).localeCompare(
            getMissionContractName(right.contract),
            undefined,
            { numeric: true, sensitivity: 'base' },
          );
      }
    });
  }, [
    allContracts,
    employerFilter,
    legalityFilter,
    locationFilter,
    resourceObjectiveMode,
    rewardBlueprintFilter,
    searchLower,
    sortBy,
    standingBucketFilter,
  ]);

  const { sentinelRef, visibleCount } =
    useInfiniteScroll(filteredContracts, {
      getColumns: missionGetColumns,
      getScrollRoot: getMainContentScrollRoot,
    });

  useEffect(() => {
    if (!missionRewards || selectedMissionSlug) return;
    if (factionContractsLoadingIds.size > 0) return;

    const loadedFactionIds = new Set(Object.keys(factionContractsByFactionId));
    const nextFaction = missionRewards.factionGroups.find(
      (group) => group.id && !loadedFactionIds.has(group.id),
    );
    if (!nextFaction?.id) return;

    const shouldLoadNext =
      search.trim().length > 0 ||
      filteredContracts.length <= visibleCount + 6;
    if (shouldLoadNext) {
      void ensureFactionContractsLoaded(nextFaction.id);
    }
  }, [
    factionContractsByFactionId,
    factionContractsLoadingIds.size,
    filteredContracts.length,
    missionRewards,
    search,
    selectedMissionSlug,
    visibleCount,
    ensureFactionContractsLoaded,
  ]);

  useEffect(() => {
    const syncSelectedMissionFromPath = () => {
      setSelectedMissionSlug(missionSlugFromPathname(window.location.pathname));
    };

    syncSelectedMissionFromPath();
    window.addEventListener('popstate', syncSelectedMissionFromPath);
    return () => window.removeEventListener('popstate', syncSelectedMissionFromPath);
  }, []);

  const selectedMission = useMemo(() => {
    if (!selectedMissionSlug) {
      return null;
    }
    return allContracts.find(({ contract, group }) => getMissionSlug(contract, group) === selectedMissionSlug) ?? null;
  }, [allContracts, selectedMissionSlug]);

  const handleBlueprintClick = useCallback((blueprintId: string) => {
    const blueprint = blueprints.find((candidate) => candidate.id === blueprintId);
    if (blueprint) {
      startTransition(() => setActiveBlueprint(blueprint));
    }
  }, [blueprints, setActiveBlueprint]);

  // Stable across renders so memoized ContractCard/ContractRow don't re-render
  // the whole visible list when the panel re-renders for unrelated reasons.
  const handleSelectContract = useCallback(
    (contract: MissionContract, group: MissionRewardFactionGroup) => {
      const missionSlug = getMissionSlug(contract, group);
      startTransition(() => setSelectedMissionSlug(missionSlug));
      navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
    },
    [setSelectedMissionSlug],
  );

  const factionsLoading = factionContractsLoadingIds.size > 0;

  if (missionRewardsLoading) {
    return (
      <PageLayout width="wide">
        <SurfaceState
          tone="loading"
          title={t('Loading mission rewards...', 'Chargement des récompenses de mission...')}
        />
      </PageLayout>
    );
  }

  if (missionRewardsError) {
    return (
      <PageLayout width="wide">
        <SurfaceState
          tone="error"
          title={t('Mission rewards unavailable', 'Récompenses de mission indisponibles')}
          description={missionRewardsError}
        />
      </PageLayout>
    );
  }

  if (!missionRewards || missionRewards.factionGroups.length === 0) {
    return (
      <PageLayout width="wide">
        <SurfaceState
          title={t('No mission data', 'Aucune donnée de mission')}
          icon={<FlagIcon sx={{ opacity: 0.55, fontSize: '3rem' }} />}
          description={<DatasetTooOldNotice />}
        />
      </PageLayout>
    );
  }

  const summary = missionRewards.summary;
  const missionPageStats = {
    contractCount: summary?.blueprintRewardContractCount ?? allContracts.length,
    employerCount: allEmployers.length,
    factionCount: summary?.factionGroupCount ?? allFactions.length,
    rewardedBlueprintCount: summary?.uniqueRewardedBlueprintCount ?? 0,
  };

  return (
    <PageLayout
      width="wide"
      sx={{ animation: 'if-fade-in 240ms cubic-bezier(0.22,1,0.36,1) both' }}
    >
      {factionsLoading && <AppProgressBar sx={{ position: 'fixed', top: 0, left: 0, right: 0, borderRadius: 0, zIndex: 9999 }} />}

      {selectedMission ? (
        <MissionDetail
          selection={selectedMission}
          blueprints={blueprints}
          favoriteIds={favoriteIds}
          inventoryIds={inventoryIds}
          resources={resources}
          onToggleFavorite={toggleFavorite}
          onToggleInventory={toggleInventory}
          onBack={() => {
            setSelectedMissionSlug(null);
            navigateToPath('/missions', { mainView: 'missions' });
          }}
          onBlueprintOpen={handleBlueprintClick}
        />
      ) : (
        <>
          {/*
            A slug that resolves to nothing used to drop the user on the full
            index with no explanation, so a broken deep link was indistinguishable
            from a working one — and the acquisition rail links here by deriving
            slugs, which is exactly the case that can go stale. This stays a
            notice rather than an error page because faction contracts load
            lazily, so "no match yet" is not the same as "no such mission".
          */}
          {selectedMissionSlug && (
            <SurfaceState
              tone="error"
              title={t('Mission not found', 'Mission introuvable')}
              description={t(
                `Nothing in this dataset matches “${selectedMissionSlug}”. Showing every contract instead.`,
                `Rien dans ce dataset ne correspond à « ${selectedMissionSlug} ». Affichage de tous les contrats à la place.`,
              )}
            />
          )}
          <PageHeader
            title={t('Missions', 'Missions')}
            description={t(
              'Explore contracts, faction employers and blueprint rewards across the published dataset.',
              'Explorez les contrats, les employeurs de faction et les récompenses de blueprints du dataset publié.',
            )}
            stats={(
              <>
                <PageStatCard label={t('Contracts', 'Contrats')} value={String(missionPageStats.contractCount)} domain="blue" />
                <PageStatCard label={t('Employers', 'Employeurs')} value={String(missionPageStats.employerCount)} domain="magenta" />
                <PageStatCard label={t('Factions', 'Factions')} value={String(missionPageStats.factionCount)} domain="magenta" />
                <PageStatCard label={t('Rewarded blueprints', 'Blueprints récompensés')} value={String(missionPageStats.rewardedBlueprintCount)} />
              </>
            )}
          />

          <MissionPayoutsSection payouts={missionRewards?.missionPayouts ?? null} />

          {/* Filter bar */}
          <MissionsFilterBar
            locations={allLocations}
            employers={allEmployers}
            rewardBlueprints={allRewardBlueprints}
            selectedLocation={locationFilter}
            selectedLegality={legalityFilter}
            selectedEmployer={employerFilter}
            selectedStandingBucket={standingBucketFilter}
            selectedRewardBlueprint={rewardBlueprintFilter}
            selectedResourceObjectiveMode={resourceObjectiveMode}
            selectedSort={sortBy}
            search={search}
            onLocationChange={setLocationFilter}
            onLegalityChange={setLegalityFilter}
            onEmployerChange={setEmployerFilter}
            onStandingBucketChange={setStandingBucketFilter}
            onRewardBlueprintChange={setRewardBlueprintFilter}
            onResourceObjectiveModeChange={setResourceObjectiveMode}
            onSortChange={setSortBy}
            onSearchChange={setSearch}
          />

          {/* Results count + view toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontFamily: FONT_MONO }}
              aria-live="polite"
            >
              {filteredContracts.length} {t('contracts', 'contrats')}
            </Typography>
            <Box role="group" aria-label={t('View mode', 'Mode d’affichage')} sx={{ display: 'flex', gap: 0.75 }}>
              <AppButton
                variant={missionView === 'cards' ? 'primary' : 'secondary'}
                size="sm"
                ariaPressed={missionView === 'cards'}
                onClick={() => setMissionView('cards')}
              >
                {t('Cards', 'Cartes')}
              </AppButton>
              <AppButton
                variant={missionView === 'rows' ? 'primary' : 'secondary'}
                size="sm"
                ariaPressed={missionView === 'rows'}
                onClick={() => setMissionView('rows')}
              >
                {t('Rows', 'Lignes')}
              </AppButton>
            </Box>
          </Box>

          {/* Contract grid / rows */}
          {filteredContracts.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }} role="status">
              {t('No contracts match your filters.', 'Aucun contrat ne correspond à tes filtres.')}
            </Typography>
          ) : (
            <>
              {missionView === 'cards' ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                      xl: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 2,
                    alignItems: 'start',
                  }}
                  role="list"
                  aria-label={t('Contract list', 'Liste des contrats')}
                >
                  {filteredContracts.slice(0, visibleCount).map(({ contract, group }) => (
                    <ContractCard
                      key={getContractKey(contract)}
                      contract={contract}
                      group={group}
                      onBlueprintClick={handleBlueprintClick}
                      onOpen={handleSelectContract}
                    />
                  ))}
                </Box>
              ) : (
                <Box
                  component="table"
                  sx={{ width: '100%', borderCollapse: 'collapse' }}
                  role="list"
                  aria-label={t('Contract list', 'Liste des contrats')}
                >
                  <Box component="tbody">
                    {filteredContracts.slice(0, visibleCount).map(({ contract, group }) => (
                      <ContractRow
                        key={getContractKey(contract)}
                        contract={contract}
                        group={group}
                        onOpen={handleSelectContract}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {visibleCount < filteredContracts.length && (
                <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
              )}
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}
