import { startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { alpha, useTheme } from '@mui/material/styles';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined';
import FlagIcon from '@mui/icons-material/Flag';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { BlueprintCard } from './BlueprintGrid';
import { AppGlyph } from './ui/AppGlyph';
import { CategoryBadge } from './ui/Badge';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { PageStatCard } from './ui/PageStatCard';
import { ScaleBadge } from './ui/RarityBadge';
import { StarCitizenLicensedIcon, getLocationIconName } from './ui/StarCitizenLicensedIcon';
import { loc, useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';
import {
  computeStatMaxima,
  formatProbabilityPercent,
  getStandingBucket,
  getMissionBlueprintDropChance,
  getMissionContractName,
  formatScaleLabel,
  formatStandingLabel,
  formatStandingSummary,
  ls,
  STANDING_OPTIONS,
} from '../utils/crafting';
import { missionPathFromSlug, missionSlugFromContract, missionSlugFromPathname, navigateToPath, toSlug } from '../utils/slug';
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';
import type {
  Blueprint,
  ItemCategory,
  MissionContract,
  MissionEmployerRef,
  MissionSort,
  MissionRequiredStanding,
  MissionRewardFactionGroup,
  Resource,
  LocalizedString,
  StandingBucket,
} from '../types';
import { FONT_HEADING } from '../theme';

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
  const seen = new Set<string>();
  const blueprintById = new Map(blueprints.map((bp) => [bp.id, bp]));
  const results: Blueprint[] = [];

  for (const rewardedBlueprint of contract.rewardedBlueprints) {
    if (seen.has(rewardedBlueprint.id)) {
      continue;
    }
    seen.add(rewardedBlueprint.id);
    const blueprint = blueprintById.get(rewardedBlueprint.id);
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
            color: 'text.disabled',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
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

function MissionsFilterBar({
  locations,
  scales,
  contractors,
  employers,
  factions,
  reputationActivities,
  rewardCategories,
  rewardManufacturers,
  rewardBlueprints,
  resourceObjectiveResources,
  selectedLocation: locationFilter,
  selectedScale: scaleFilter,
  selectedLegality: legalityFilter,
  selectedContractor: contractorFilter,
  selectedEmployer: employerFilter,
  selectedFaction: factionFilter,
  selectedReputationActivity: reputationActivityFilter,
  selectedStandingBucket: standingBucketFilter,
  selectedRewardCategory: rewardCategoryFilter,
  selectedRewardManufacturer: rewardManufacturerFilter,
  selectedRewardBlueprint: rewardBlueprintFilter,
  selectedResourceObjectiveResource: resourceObjectiveResourceFilter,
  selectedResourceObjectiveMode: resourceObjectiveMode,
  selectedSort: sortBy,
  search,
  onLocationChange,
  onScaleChange,
  onLegalityChange,
  onContractorChange,
  onEmployerChange,
  onFactionChange,
  onReputationActivityChange,
  onStandingBucketChange,
  onRewardCategoryChange,
  onRewardManufacturerChange,
  onRewardBlueprintChange,
  onResourceObjectiveResourceChange,
  onResourceObjectiveModeChange,
  onSortChange,
  onSearchChange,
}: {
  locations: string[];
  scales: string[];
  contractors: string[];
  employers: string[];
  factions: string[];
  reputationActivities: string[];
  rewardCategories: ItemCategory[];
  rewardManufacturers: string[];
  rewardBlueprints: string[];
  resourceObjectiveResources: string[];
  selectedLocation: string | null;
  selectedScale: string | null;
  selectedLegality: string;
  selectedContractor: string | null;
  selectedEmployer: string | null;
  selectedFaction: string | null;
  selectedReputationActivity: string | null;
  selectedStandingBucket: StandingBucket;
  selectedRewardCategory: ItemCategory | 'all';
  selectedRewardManufacturer: string | null;
  selectedRewardBlueprint: string | null;
  selectedResourceObjectiveResource: string | null;
  selectedResourceObjectiveMode: 'all' | 'with' | 'without';
  selectedSort: MissionSort;
  search: string;
  onLocationChange: (v: string | null) => void;
  onScaleChange: (v: string | null) => void;
  onLegalityChange: (v: string) => void;
  onContractorChange: (v: string | null) => void;
  onEmployerChange: (v: string | null) => void;
  onFactionChange: (v: string | null) => void;
  onReputationActivityChange: (v: string | null) => void;
  onStandingBucketChange: (v: StandingBucket) => void;
  onRewardCategoryChange: (v: ItemCategory | 'all') => void;
  onRewardManufacturerChange: (v: string | null) => void;
  onRewardBlueprintChange: (v: string | null) => void;
  onResourceObjectiveResourceChange: (v: string | null) => void;
  onResourceObjectiveModeChange: (v: 'all' | 'with' | 'without') => void;
  onSortChange: (v: MissionSort) => void;
  onSearchChange: (v: string) => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const hasActiveFilters =
    locationFilter !== null ||
    scaleFilter !== null ||
    contractorFilter !== null ||
    employerFilter !== null ||
    factionFilter !== null ||
    reputationActivityFilter !== null ||
    legalityFilter !== 'all' ||
    standingBucketFilter !== 'all' ||
    rewardCategoryFilter !== 'all' ||
    rewardManufacturerFilter !== null ||
    rewardBlueprintFilter !== null ||
    resourceObjectiveResourceFilter !== null ||
    resourceObjectiveMode !== 'all';

  const advancedFilterCount = [
    factionFilter !== null,
    standingBucketFilter !== 'all',
    rewardCategoryFilter !== 'all',
    rewardManufacturerFilter !== null,
    rewardBlueprintFilter !== null,
    resourceObjectiveResourceFilter !== null,
    resourceObjectiveMode !== 'all',
  ].filter(Boolean).length;

  return (
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
        alignItems={{ xs: 'flex-start', xl: 'center' }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.main', letterSpacing: '0.12em' }}
          >
            {t('Mission filters', 'Filtres missions', 'Missionsfilter')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(
              'Search contract pools first, then tighten rewards, standing, faction and resource objectives only when needed.',
              'Commence par rechercher les contrats, puis affine recompenses, reputation, faction et objectifs ressource seulement quand c est necessaire.',
              'Suche zuerst im Vertrags-Pool und verfeinere danach bei Bedarf Belohnungen, Ruf, Fraktion und Ressourcenziele.',
            )}
          </Typography>
        </Box>
        {hasActiveFilters && (
          <Button
            variant="outlined"
            startIcon={<FilterListOffOutlinedIcon />}
            onClick={() => {
              onLocationChange(null);
              onScaleChange(null);
              onContractorChange(null);
              onEmployerChange(null);
              onFactionChange(null);
              onReputationActivityChange(null);
              onLegalityChange('all');
              onStandingBucketChange('all');
              onRewardCategoryChange('all');
              onRewardManufacturerChange(null);
              onRewardBlueprintChange(null);
              onResourceObjectiveResourceChange(null);
              onResourceObjectiveModeChange('all');
            }}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {t('Reset filters', 'Reinitialiser', 'Filter zurucksetzen')}
          </Button>
        )}
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          type="search"
          size="small"
          placeholder={t('Search contracts...', 'Rechercher des contrats...')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <AppGlyph name="search" size={18} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: { xs: '1 1 100%', sm: '1 1 200px' }, '& .MuiInputBase-root': { fontSize: '0.875rem', height: 32 } }}
        />
        <FormControl
          size="small"
          sx={{ minWidth: { xs: '100%', sm: 210 }, '& .MuiInputBase-root': { height: 32, fontSize: '0.75rem' } }}
        >
          <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as MissionSort)}>
            {MISSION_SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {loc(option.label, lang)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ToggleButtonGroup
          value={legalityFilter}
          exclusive
          onChange={(_event, value) => { if (value) onLegalityChange(value); }}
          size="small"
          aria-label={t('Legality filter', 'Filtre de legalite')}
          sx={{ height: 32, '& .MuiToggleButton-root': { fontSize: '0.75rem', px: 1.5 } }}
        >
          <ToggleButton value="all">{t('All', 'Tous')}</ToggleButton>
          <ToggleButton value="lawful" sx={{ '&.Mui-selected': { color: theme.palette.success.main } }}>
            {t('Lawful', 'Legal')}
          </ToggleButton>
          <ToggleButton value="unlawful" sx={{ '&.Mui-selected': { color: theme.palette.error.main } }}>
            {t('Unlawful', 'Illegal')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          sx={{ width: { xs: '100%', lg: 'auto' } }}
        >
          <Autocomplete
            size="small"
            options={contractors}
            value={contractorFilter}
            onChange={(_event, value) => onContractorChange(value)}
            renderInput={(params) => <TextField {...params} placeholder={t('Contractor label', 'Label contractant')} sx={{ width: { xs: '100%', md: 180 }, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }} />}
            slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
          />
          <Autocomplete
            size="small"
            options={employers}
            value={employerFilter}
            onChange={(_event, value) => onEmployerChange(value)}
            renderInput={(params) => <TextField {...params} placeholder={t('Employer', 'Employeur')} sx={{ width: { xs: '100%', md: 180 }, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }} />}
            slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
          />
          <Autocomplete
            size="small"
            options={locations}
            value={locationFilter}
            onChange={(_event, value) => onLocationChange(value)}
            renderInput={(params) => <TextField {...params} placeholder={t('Location', 'Lieu')} sx={{ width: { xs: '100%', md: 150 }, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }} />}
            slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
          />
          <Autocomplete
            size="small"
            options={scales}
            getOptionLabel={(scale) => formatScaleLabel(scale, lang)}
            value={scaleFilter}
            onChange={(_event, value) => onScaleChange(value)}
            renderInput={(params) => <TextField {...params} placeholder={t('Scale', 'Echelle')} sx={{ width: { xs: '100%', md: 150 }, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }} />}
            slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
          />
          <Autocomplete
            size="small"
            options={reputationActivities}
            value={reputationActivityFilter}
            onChange={(_event, value) => onReputationActivityChange(value)}
            renderInput={(params) => <TextField {...params} placeholder={t('Reputation type / Activities', 'Type reputation / activites')} sx={{ width: { xs: '100%', md: 220 }, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }} />}
            slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
          />
        </Stack>
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<AppGlyph name="caret-up" size={18} />}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t('Advanced mission filters', 'Filtres mission avancés')}
            </Typography>
            {advancedFilterCount > 0 && (
              <Chip label={`${advancedFilterCount} ${t('active', 'actifs')}`} size="small" variant="outlined" color="primary" sx={{ height: 20, fontSize: '.65rem' }} />
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('Rewards, faction, standing, resources', 'Récompenses, faction, réputation, ressources')}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            <Autocomplete
              size="small"
              options={factions}
              value={factionFilter}
              onChange={(_event, value) => onFactionChange(value)}
              renderInput={(params) => <TextField {...params} placeholder={t('Faction / jurisdiction', 'Faction / juridiction')} />}
              slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
            />
            <FormControl size="small">
              <Select value={standingBucketFilter} onChange={(event) => onStandingBucketChange(event.target.value as StandingBucket)}>
                {STANDING_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {loc(option.label, lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select value={rewardCategoryFilter} onChange={(event) => onRewardCategoryChange(event.target.value as ItemCategory | 'all')}>
                <MenuItem value="all">{t('Any reward category', 'Toute catégorie de récompense')}</MenuItem>
                {rewardCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              options={rewardManufacturers}
              value={rewardManufacturerFilter}
              onChange={(_event, value) => onRewardManufacturerChange(value)}
              renderInput={(params) => <TextField {...params} placeholder={t('Reward manufacturer', 'Fabricant récompensé')} />}
              slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={rewardBlueprints}
              value={rewardBlueprintFilter}
              onChange={(_event, value) => onRewardBlueprintChange(value)}
              renderInput={(params) => <TextField {...params} placeholder={t('Reward blueprint', 'Blueprint récompensé')} />}
              slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={resourceObjectiveResources}
              value={resourceObjectiveResourceFilter}
              onChange={(_event, value) => onResourceObjectiveResourceChange(value)}
              renderInput={(params) => <TextField {...params} placeholder={t('Resource objective', 'Objectif ressource')} />}
              slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
            />
            <FormControl size="small">
              <Select value={resourceObjectiveMode} onChange={(event) => onResourceObjectiveModeChange(event.target.value as 'all' | 'with' | 'without')}>
                {RESOURCE_OBJECTIVE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {loc(option.label, lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}

function ContractCard({
  contract,
  group,
  onBlueprintClick,
  href,
  onOpen,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
  onBlueprintClick: (blueprintId: string) => void;
  href: string;
  onOpen: () => void;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const factionType = group.faction?.factionType?.toLowerCase() ?? '';
  const isUnlawful = factionType === 'unlawful';
  const standingLabel = contract.minimumRequiredStandings.length > 0 ? formatStandingSummary(contract.minimumRequiredStandings, lang) : null;
  const blueprintDropChance = getMissionBlueprintDropChance(contract);
  const blueprintCount = getMissionRewardedBlueprintCount(contract);
  const primaryLocation = getPrimaryMissionLocation(contract);
  const locationIconName = primaryLocation ? getLocationIconName(primaryLocation) : null;
  const heroAsset = getMissionHeroAsset(contract, group);
  const showHeroImage = Boolean(heroAsset) && !imgError;
  const activityKind = getMissionActivityKind(contract);
  const reputationActivity = getMissionReputationActivity(contract);
  const blueprintChanceValue = Math.max(0, Math.min(100, blueprintDropChance * 100));
  const activityLabel = (() => {
    switch (activityKind) {
      case 'combat':
        return t('Combat activity', 'Activite de combat');
      case 'recovery':
        return t('Recovery activity', 'Activite de recuperation');
      case 'objective':
      default:
        return t('Objective activity', 'Activite d objectif');
    }
  })();
  const activityShortLabel = (() => {
    switch (activityKind) {
      case 'combat':
        return t('Combat', 'Combat');
      case 'recovery':
        return t('Recovery', 'Recuperation');
      case 'objective':
      default:
        return t('Objective', 'Objectif');
    }
  })();
  return (
    <Card
      role="listitem"
      sx={{
        position: 'relative',
        height: { xs: 'auto', lg: 360, xl: 334 },
        minHeight: { xs: 'auto', lg: 360, xl: 334 },
        display: 'flex',
        borderColor: alpha(theme.palette.brand.blueLight, 0.22),
        background: `linear-gradient(115deg, ${alpha(theme.palette.brand.blue, 0.15)} 0%, ${alpha(theme.palette.background.default, 0.98)} 48%, ${alpha(theme.palette.common.black, 0.28)} 100%)`,
        overflow: 'hidden',
        transition: 'border-color 150ms, background-color 150ms, box-shadow 150ms, transform 150ms',
        '&:hover': {
          borderColor: alpha(theme.palette.secondary.main, 0.55),
          boxShadow: `0 20px 44px ${alpha(theme.palette.common.black, 0.32)}`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Box
        component="a"
        href={href}
        aria-label={t('Open mission dossier', 'Ouvrir le dossier mission')}
        onClick={(event) => {
          if (!shouldHandleInternalLinkClick(event)) return;
          event.preventDefault();
          onOpen();
        }}
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          cursor: 'pointer',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.secondary.main}`,
            outlineOffset: -2,
          },
        }}
      />
      <Box
        sx={{
          height: '100%',
          width: '100%',
          flex: 1,
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(148px, 35%) minmax(0, 1fr)' },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            minHeight: { xs: 190, sm: 210, lg: 0 },
            height: '100%',
            background: `
              radial-gradient(circle at 20% 12%, ${alpha(isUnlawful ? theme.palette.error.main : theme.palette.success.main, 0.18)}, transparent 24%),
              linear-gradient(135deg, ${alpha(isUnlawful ? theme.palette.error.dark : theme.palette.secondary.dark, 0.32)}, transparent 50%),
              linear-gradient(180deg, ${alpha(theme.palette.brand.blue, 0.18)} 0%, ${alpha(theme.palette.background.default, 0.96)} 100%)
            `,
            borderRight: { lg: `1px solid ${alpha(theme.palette.brand.blueLight, 0.18)}` },
            borderBottom: { xs: `1px solid ${alpha(theme.palette.brand.blueLight, 0.18)}`, lg: 0 },
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.black, 0.24)} 56%, ${alpha(theme.palette.common.black, 0.72)} 100%), linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.08)} 0%, ${alpha(theme.palette.common.black, 0.24)} 52%, ${alpha(theme.palette.common.black, 0.86)} 100%)` }} />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.42,
              backgroundImage: `
                linear-gradient(${alpha(theme.palette.common.white, 0.035)} 1px, transparent 1px),
                linear-gradient(90deg, ${alpha(theme.palette.common.white, 0.028)} 1px, transparent 1px),
                radial-gradient(circle at 72% 38%, ${alpha(theme.palette.secondary.main, 0.12)}, transparent 30%)
              `,
              backgroundSize: '42px 42px, 42px 42px, 100% 100%',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '-10%',
              right: '12%',
              bottom: '24%',
              height: 42,
              borderRadius: 1,
              transform: 'skewX(-18deg)',
              background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.black, 0.28)} 10%, ${alpha(theme.palette.common.black, 0.72)} 48%, ${alpha(theme.palette.secondary.main, 0.18)} 100%)`,
              borderTop: `1px solid ${alpha(theme.palette.brand.blueLight, 0.12)}`,
              borderBottom: `1px solid ${alpha(theme.palette.common.black, 0.5)}`,
              boxShadow: `0 16px 34px ${alpha(theme.palette.common.black, 0.42)}`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '8%',
              right: '32%',
              bottom: '36%',
              height: 10,
              transform: 'skewX(-18deg)',
              background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.brand.blueLight, 0.22)}, transparent)`,
              opacity: 0.65,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, ${alpha(theme.palette.background.default, 0.12)} 0%, transparent 42%, ${alpha(theme.palette.common.black, 0.48)} 100%)`,
            }}
          />

          <Box sx={{ position: 'absolute', top: 18, left: 18, right: 18, zIndex: 2, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Chip
              label={activityShortLabel}
              icon={<MissionActivityIcon kind={activityKind} size="0.95rem" />}
              size="small"
              title={activityLabel}
              sx={{
                height: 34,
                maxWidth: '72%',
                color: isUnlawful ? theme.palette.error.light : activityKind === 'recovery' ? theme.palette.success.light : theme.palette.secondary.light,
                backgroundColor: alpha(theme.palette.background.default, 0.58),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(isUnlawful ? theme.palette.error.main : theme.palette.secondary.main, 0.58)}`,
                borderRadius: 1,
                '& .MuiChip-label': { px: 0.9, fontFamily: FONT_HEADING, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' },
                '& .MuiChip-icon': { ml: '8px', mr: '-2px', color: 'inherit' },
              }}
            />
          </Box>

          <Box sx={{ width: '100%', height: '100%', p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showHeroImage ? (
              <CardMedia
                component="img"
                image={heroAsset!}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                sx={{
                  maxWidth: '52%',
                  maxHeight: '48%',
                  objectFit: 'contain',
                  filter: theme.palette.mode === 'dark'
                    ? 'drop-shadow(0 22px 30px rgba(0,0,0,0.62)) saturate(0.9)'
                    : 'drop-shadow(0 18px 28px rgba(0,0,0,0.2)) saturate(0.96)',
                  opacity: 0.28,
                  transition: 'transform 240ms ease, opacity 240ms ease',
                  '.MuiCard-root:hover &': {
                    transform: 'scale(1.05)',
                    opacity: 0.38,
                  },
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 92,
                  height: 92,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(
                    isUnlawful ? theme.palette.error.main : theme.palette.primary.main,
                    0.12,
                  ),
                  border: `1px solid ${alpha(
                    isUnlawful ? theme.palette.error.main : theme.palette.primary.main,
                    0.26,
                  )}`,
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: FONT_HEADING,
                    fontWeight: 700,
                    fontSize: '1.45rem',
                    letterSpacing: '0.04em',
                    color: isUnlawful ? theme.palette.error.light : theme.palette.primary.light,
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  {getEmployerInitials(getMissionEmployerName(contract, group))}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ position: 'absolute', left: 18, right: 18, bottom: 18, zIndex: 2, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 1.5 }}>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
              {showHeroImage ? (
                <Box
                  component="img"
                  src={heroAsset!}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sx={{
                    width: 38,
                    height: 38,
                    objectFit: 'contain',
                    flexShrink: 0,
                    filter: `drop-shadow(0 2px 8px ${alpha(theme.palette.common.black, 0.65)})`,
                  }}
                />
              ) : null}
              <Stack spacing={0.1} sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{
                    color: theme.palette.text.primary,
                    fontFamily: FONT_HEADING,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    lineHeight: 1,
                    textShadow: `0 1px 8px ${alpha(theme.palette.common.black, 0.65)}`,
                  }}
                >
                  {getMissionEmployerName(contract, group)}
                </Typography>
                <Typography
                  noWrap
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.68),
                    fontFamily: FONT_HEADING,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {group.contractorDisplayName}
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={0.65} alignItems="center" sx={{ color: isUnlawful ? theme.palette.error.light : theme.palette.success.light, flexShrink: 0 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isUnlawful ? theme.palette.error.main : theme.palette.success.main,
                  boxShadow: `0 0 0 3px ${alpha(isUnlawful ? theme.palette.error.main : theme.palette.success.main, 0.16)}`,
                }}
              />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {factionType === 'unlawful' ? t('Unlawful', 'Illegal') : t('Lawful', 'Legal')}
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            p: { xs: '14px', sm: '16px' },
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 116px' },
            gridTemplateRows: { xs: 'auto auto auto minmax(0, 1fr)', lg: 'auto auto minmax(84px, 1fr)' },
            columnGap: { xs: 0, lg: 1.2 },
            rowGap: 1,
            flex: 1,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <Stack spacing={0.35} sx={{ gridColumn: { xs: '1', lg: '1' }, minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.42rem', lg: '1.12rem', xl: '1.24rem' },
                lineHeight: 0.95,
                color: theme.palette.text.primary,
                textTransform: 'uppercase',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {getMissionContractName(contract)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: alpha(theme.palette.text.primary, 0.72),
                fontSize: '0.68rem',
                fontWeight: 600,
              }}
            >
              {group.contractorDisplayName}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: { xs: 'grid', lg: 'contents' },
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 116px' },
              gap: { xs: 1.25, lg: 1.2 },
              alignItems: 'stretch',
            }}
          >
            <Stack spacing={0.85} sx={{ minWidth: 0, gridColumn: { xs: '1', lg: '1' }, gridRow: { lg: '2' } }}>
              {primaryLocation && (
                <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0, color: 'text.secondary' }}>
                  {locationIconName ? (
                    <StarCitizenLicensedIcon name={locationIconName} size={18} dimmed />
                  ) : (
                    <PlaceOutlinedIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                  )}
                  <Stack direction="row" spacing={1.2} alignItems="baseline" sx={{ minWidth: 0 }}>
                    <Typography
                      noWrap
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontFamily: FONT_HEADING,
                        fontSize: { xs: '0.86rem', sm: '0.98rem', lg: '0.72rem', xl: '0.76rem' },
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {primaryLocation}
                    </Typography>
                    <Typography
                      noWrap
                      variant="caption"
                      sx={{
                        color: alpha(theme.palette.brand.blueLight, 0.68),
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {formatScaleLabel(contract.availability.derivedScale, lang)}
                    </Typography>
                  </Stack>
                </Stack>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, minWidth: 0, overflow: 'hidden', flexWrap: 'wrap' }}>
                <Chip
                  label={activityShortLabel}
                  icon={<MissionActivityIcon kind={activityKind} size="0.88rem" />}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 27,
                    borderRadius: 1,
                    color: isUnlawful ? theme.palette.error.light : activityKind === 'recovery' ? theme.palette.success.light : theme.palette.secondary.light,
                    borderColor: alpha(isUnlawful ? theme.palette.error.main : activityKind === 'recovery' ? theme.palette.success.main : theme.palette.secondary.main, 0.55),
                    backgroundColor: alpha(isUnlawful ? theme.palette.error.main : activityKind === 'recovery' ? theme.palette.success.main : theme.palette.secondary.main, 0.08),
                    '& .MuiChip-label': { fontFamily: FONT_HEADING, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
                    '& .MuiChip-icon': { ml: '7px', mr: '-2px' },
                  }}
                />
                {reputationActivity && (
                  <Chip
                    label={reputationActivity}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 27,
                      borderRadius: 1,
                      maxWidth: 210,
                      color: theme.palette.brand.blueLight,
                      borderColor: alpha(theme.palette.brand.blueLight, 0.32),
                      backgroundColor: alpha(theme.palette.brand.blueLight, 0.06),
                      '& .MuiChip-label': { fontFamily: FONT_HEADING, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
                    }}
                  />
                )}
                {standingLabel && (
                  <Chip
                    label={standingLabel}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 27,
                      borderRadius: 1,
                      maxWidth: 220,
                      color: theme.palette.warning.light,
                      borderColor: alpha(theme.palette.warning.main, 0.38),
                      backgroundColor: alpha(theme.palette.warning.main, 0.08),
                      '& .MuiChip-label': { fontFamily: FONT_HEADING, fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
                    }}
                  />
                )}
              </Box>
            </Stack>

            <Box
              sx={{
                border: `1px solid ${alpha(theme.palette.brand.blueLight, 0.18)}`,
                background: `linear-gradient(180deg, ${alpha(theme.palette.brand.blue, 0.1)}, ${alpha(theme.palette.common.black, 0.18)})`,
                borderRadius: 1,
                p: { xs: 1.5, lg: 1 },
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gridColumn: { xs: '1', lg: '2' },
                gridRow: { lg: '1 / span 3' },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography
                  variant="caption"
                  sx={{ color: alpha(theme.palette.text.primary, 0.62), textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', fontSize: { xs: '0.72rem', lg: '0.55rem' } }}
                >
                  {t('Blueprint chance', 'Chance blueprint', 'Blueprint-Chance')}
                </Typography>
                <Typography aria-hidden="true" sx={{ color: alpha(theme.palette.text.primary, 0.66), fontSize: '0.62rem', lineHeight: 1, border: `1px solid ${alpha(theme.palette.text.primary, 0.38)}`, borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  i
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontFamily: FONT_HEADING,
                  fontSize: { xs: '3rem', lg: '2.28rem' },
                  fontWeight: 800,
                  lineHeight: 0.85,
                  color: blueprintDropChance > 0 ? theme.palette.secondary.light : theme.palette.text.secondary,
                  mt: 0.7,
                }}
              >
                {blueprintDropChance > 0 ? formatProbabilityPercent(blueprintDropChance) : '-'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={blueprintChanceValue}
                sx={{
                  mt: 0.9,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: alpha(theme.palette.common.white, 0.07),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    backgroundColor: theme.palette.secondary.light,
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.62), display: 'block', mt: 0.8, fontSize: { xs: '0.82rem', lg: '0.58rem' }, letterSpacing: 0 }}>
                {t('From', 'Depuis')} {blueprintCount}-item blueprint pool
              </Typography>
              <Divider sx={{ my: 1, borderColor: alpha(theme.palette.brand.blueLight, 0.14) }} />
              <Stack direction="row" spacing={0.7} alignItems="center">
                <Inventory2OutlinedIcon sx={{ color: alpha(theme.palette.text.primary, 0.66), fontSize: { xs: 30, lg: 22 } }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: { xs: '0.68rem', lg: '0.5rem' }, display: 'block' }}>
                    {t('Potential blueprints', 'Blueprints potentiels')}
                  </Typography>
                  <Typography sx={{ color: theme.palette.secondary.light, fontFamily: FONT_HEADING, fontSize: { xs: '1.25rem', lg: '0.95rem' }, fontWeight: 800, lineHeight: 1 }}>
                    {blueprintCount}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant="text"
                component="a"
                href={href}
                endIcon={<KeyboardArrowRightIcon />}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!shouldHandleInternalLinkClick(event)) return;
                  event.preventDefault();
                  onOpen();
                }}
                sx={{
                  position: 'relative',
                  zIndex: 2,
                  mt: 'auto',
                  mx: -0.6,
                  mb: -0.7,
                  pt: 0.8,
                  fontSize: '0.62rem',
                  justifyContent: 'space-between',
                  color: alpha(theme.palette.text.primary, 0.78),
                  borderTop: `1px solid ${alpha(theme.palette.brand.blueLight, 0.13)}`,
                  borderRadius: 0,
                  '&:hover': {
                    color: theme.palette.secondary.light,
                    backgroundColor: alpha(theme.palette.secondary.main, 0.06),
                  },
                }}
              >
                {t('Open dossier', 'Ouvrir dossier')}
              </Button>
            </Box>
          </Box>

          {contract.rewardedBlueprints.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, minWidth: 0, minHeight: 0, mt: 0.2, gridColumn: { xs: '1', lg: '1' }, gridRow: { lg: '3' } }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.58rem',
                    color: alpha(theme.palette.text.primary, 0.58),
                    textTransform: 'uppercase',
                    letterSpacing: '0.13em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('Lootable blueprints', 'Blueprints recuperables')}
                </Typography>
                <Divider sx={{ flex: 1, borderColor: alpha(theme.palette.brand.blueLight, 0.16) }} />
              </Stack>
              <Box
                onClick={(event) => event.stopPropagation()}
                sx={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridAutoColumns: { xs: 150, sm: 164, lg: 116, xl: 132 },
                  gridTemplateRows: { xs: 'repeat(2, minmax(38px, 1fr))', sm: 'repeat(3, minmax(38px, 1fr))' },
                  gap: 0.55,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  flex: 1,
                  minHeight: { xs: 90, sm: 132 },
                  pb: 0.45,
                  pr: 0.35,
                  minWidth: 0,
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${alpha(theme.palette.brand.blueLight, 0.34)} transparent`,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-track': { backgroundColor: alpha(theme.palette.common.white, 0.025) },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: alpha(theme.palette.brand.blueLight, 0.34),
                    borderRadius: 999,
                  },
                }}
              >
                {contract.rewardedBlueprints.map((blueprint, index) => (
                  <Button
                    key={`${blueprint.id}-${index}`}
                    startIcon={blueprint.category ? <CategoryBadge category={blueprint.category} iconOnly /> : undefined}
                    size="small"
                    variant="outlined"
                    component="a"
                    href={`/item/${toSlug(blueprint.name)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!shouldHandleInternalLinkClick(event)) return;
                      event.preventDefault();
                      onBlueprintClick(blueprint.id);
                    }}
                    sx={{
                      minWidth: 0,
                      width: '100%',
                      minHeight: 38,
                      height: '100%',
                      px: 0.75,
                      justifyContent: 'flex-start',
                      color: theme.palette.text.primary,
                      borderColor: alpha(theme.palette.brand.blueLight, 0.2),
                      background: `linear-gradient(180deg, ${alpha(theme.palette.brand.blue, 0.12)}, ${alpha(theme.palette.common.black, 0.18)})`,
                      borderRadius: 1,
                      textTransform: 'none',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1.05,
                      letterSpacing: '0.02em',
                      '& .MuiButton-startIcon': { mr: 0.55, ml: 0, color: theme.palette.secondary.light },
                      '&:hover': {
                        borderColor: alpha(theme.palette.secondary.main, 0.55),
                        backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                      },
                    }}
                  >
                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textAlign: 'left' }}>
                      {blueprint.name}
                    </Box>
                  </Button>
                ))}
              </Box>
            </Box>
          )}

        </Box>
      </Box>
    </Card>
  );
}

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
            <Chip
              label={factionType === 'unlawful' ? t('Unlawful', 'Illegal') : t('Lawful', 'Legal')}
              size="small"
              color={factionType === 'unlawful' ? 'error' : 'success'}
              variant="outlined"
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            {t('Mission theater', 'Theatre de mission')}
          </Typography>
          <Typography variant="h3" sx={{ lineHeight: 0.95 }}>
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
                  <Chip
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
              <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
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
  statMaxima,
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
  statMaxima: ReturnType<typeof computeStatMaxima>;
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
  const localities = getMissionLocalities(contract);
  const missionBlueprints = useMemo(() => dedupeMissionBlueprints(contract, blueprints), [contract, blueprints]);
  const blueprintDropChance = getMissionBlueprintDropChance(contract);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' }, gap: { xs: 2, md: 3 }, alignItems: 'start' }}>
      <Stack spacing={2}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<AppGlyph name="arrow-left" size={18} />}
          onClick={onBack}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('Back to missions', 'Retour aux missions')}
        </Button>

        <MissionHero contract={contract} group={group} />

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2.25} divider={<Divider flexItem />}>
            <MissionFact icon={<BusinessOutlinedIcon fontSize="small" />} label={t('Mission name', 'Mission')} value={getMissionContractName(contract)} />
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
                    {employer?.sourcePageUrl && (
                      <Link
                        href={employer.sourcePageUrl}
                      target="_blank"
                      rel="noreferrer"
                      underline="hover"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}
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
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'primary.light',
                              fontSize: '0.7rem',
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
                                  fontSize: '0.75rem',
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
                      <Chip
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
                      <Chip
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
                          <Chip
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
            <Typography variant="caption" sx={{ color: 'text.disabled', letterSpacing: '0.14em' }}>
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
              <Chip label={`${missionBlueprints.length} ${t('lootable blueprints', 'blueprints recuperables')}`} size="small" />
              <Chip
                label={`${formatProbabilityPercent(blueprintDropChance)} ${t('blueprint chance', 'chance blueprint', 'Blueprint-Chance')}`}
                size="small"
                variant="outlined"
              />
              <Chip label={formatScaleLabel(contract.availability.derivedScale, lang)} size="small" variant="outlined" />
              {localities[0] && (() => {
                const iconName = getLocationIconName(localities[0]);
                return (
                  <Chip
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
                activeBlueprintId={null}
                isFavorite={favoriteIds.includes(blueprint.id)}
                isInInventory={inventoryIds.includes(blueprint.id)}
                statMaxima={statMaxima}
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

  // As soon as the slim chunk arrives, load all faction contracts in parallel.
  useEffect(() => {
    if (!missionRewards) return;
    for (const group of missionRewards.factionGroups) {
      if (group.id) void ensureFactionContractsLoaded(group.id);
    }
  }, [missionRewards, ensureFactionContractsLoaded]);

  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [scaleFilter, setScaleFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState('all');
  const [contractorFilter, setContractorFilter] = useState<string | null>(null);
  const [employerFilter, setEmployerFilter] = useState<string | null>(null);
  const [factionFilter, setFactionFilter] = useState<string | null>(null);
  const [reputationActivityFilter, setReputationActivityFilter] = useState<string | null>(null);
  const [standingBucketFilter, setStandingBucketFilter] = useState<StandingBucket>('all');
  const [rewardCategoryFilter, setRewardCategoryFilter] = useState<ItemCategory | 'all'>('all');
  const [rewardManufacturerFilter, setRewardManufacturerFilter] = useState<string | null>(null);
  const [rewardBlueprintFilter, setRewardBlueprintFilter] = useState<string | null>(null);
  const [resourceObjectiveResourceFilter, setResourceObjectiveResourceFilter] = useState<string | null>(null);
  const [resourceObjectiveMode, setResourceObjectiveMode] = useState<'all' | 'with' | 'without'>('all');
  const [sortBy, setSortBy] = useState<MissionSort>('name-asc');
  const [search, setSearch] = useState('');
  const [selectedMissionSlug, setSelectedMissionSlug] = useState<string | null>(() =>
    missionSlugFromPathname(window.location.pathname),
  );

  const resources = activeDataset.resources;
  const statMaxima = useMemo(() => computeStatMaxima(blueprints), [blueprints]);

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

  const allScales = useMemo(() => {
    const set = new Set<string>();
    for (const { contract } of allContracts) {
      set.add(contract.availability.derivedScale);
    }
    return [...set].sort();
  }, [allContracts]);

  const allContractors = useMemo(() => {
    const set = new Set<string>();
    for (const group of missionRewards?.factionGroups ?? []) {
      if (group.contractorDisplayName) {
        set.add(group.contractorDisplayName);
      }
    }
    for (const { group } of allContracts) {
      set.add(group.contractorDisplayName);
    }
    return [...set].sort();
  }, [allContracts, missionRewards]);

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

  const allReputationActivities = useMemo(() => {
    const set = new Set<string>();
    for (const { contract } of allContracts) {
      const activity = getMissionReputationActivity(contract);
      if (activity) {
        set.add(activity);
      }
    }
    return [...set].sort();
  }, [allContracts]);

  const allRewardCategories = useMemo(() => {
    const set = new Set<ItemCategory>();
    for (const { contract } of allContracts) {
      for (const blueprint of contract.rewardedBlueprints) {
        if (blueprint.category) {
          set.add(blueprint.category);
        }
      }
    }
    return [...set].sort();
  }, [allContracts]);

  const allRewardManufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const { contract } of allContracts) {
      for (const blueprint of contract.rewardedBlueprints) {
        if (blueprint.manufacturer) {
          set.add(blueprint.manufacturer);
        }
      }
    }
    return [...set].sort();
  }, [allContracts]);

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

  const allResourceObjectiveResources = useMemo(() => {
    const set = new Set<string>();
    for (const { contract } of allContracts) {
      for (const objective of contract.resourceObjectives) {
        if (objective.displayName) {
          set.add(objective.displayName);
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
      if (contractorFilter && group.contractorDisplayName !== contractorFilter) {
        return false;
      }
      if (employerFilter && employerName !== employerFilter) {
        return false;
      }
      if (factionFilter && factionName !== factionFilter) {
        return false;
      }
      if (locationFilter && !getMissionLocalities(contract).includes(locationFilter)) {
        return false;
      }
      if (scaleFilter && contract.availability.derivedScale !== scaleFilter) {
        return false;
      }
      if (reputationActivityFilter && getMissionReputationActivity(contract) !== reputationActivityFilter) {
        return false;
      }
      if (standingBucketFilter !== 'all' && getStandingBucket(maxStanding) !== standingBucketFilter) {
        return false;
      }
      if (
        rewardCategoryFilter !== 'all' &&
        !contract.rewardedBlueprints.some((rewardedBlueprint) => rewardedBlueprint.category === rewardCategoryFilter)
      ) {
        return false;
      }
      if (
        rewardManufacturerFilter &&
        !contract.rewardedBlueprints.some((rewardedBlueprint) => rewardedBlueprint.manufacturer === rewardManufacturerFilter)
      ) {
        return false;
      }
      if (
        rewardBlueprintFilter &&
        !contract.rewardedBlueprints.some((rewardedBlueprint) => rewardedBlueprint.name === rewardBlueprintFilter)
      ) {
        return false;
      }
      if (resourceObjectiveResourceFilter) {
        const hasResource = contract.resourceObjectives.some(
          (objective) => objective.displayName === resourceObjectiveResourceFilter,
        );
        if (!hasResource) {
          return false;
        }
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
    contractorFilter,
    employerFilter,
    factionFilter,
    legalityFilter,
    locationFilter,
    reputationActivityFilter,
    resourceObjectiveMode,
    resourceObjectiveResourceFilter,
    rewardBlueprintFilter,
    rewardCategoryFilter,
    rewardManufacturerFilter,
    scaleFilter,
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

  const factionsLoading = factionContractsLoadingIds.size > 0;

  if (missionRewardsLoading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <LinearProgress />
        <Box sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('Loading mission rewards...', 'Chargement des recompenses de mission...')}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (missionRewardsError) {
    return <Box sx={{ p: 3, color: 'error.main' }}><Typography>{missionRewardsError}</Typography></Box>;
  }

  if (!missionRewards || missionRewards.factionGroups.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <FlagIcon sx={{ mb: 1, opacity: 0.4, fontSize: '3rem' }} />
        <Typography variant="h6">{t('No mission data', 'Aucune donnee de mission')}</Typography>
        <DatasetTooOldNotice />
      </Box>
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
    <Box
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 0 auto' }}
    >
      {factionsLoading && <LinearProgress sx={{ flexShrink: 0 }} />}
      {!selectedMission && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
          <Box sx={{ p: { xs: 1.25, sm: 1.5, md: 2 } }}>
            <Stack spacing={1.25}>
            <Box>
              <Typography
                sx={{
                  fontFamily: FONT_HEADING,
                  fontWeight: 700,
                  fontSize: { xs: '1.9rem', md: '2.2rem' },
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                {t('Missions', 'Missions')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                {t(
                  'Explore contracts, faction employers and blueprint rewards across the published dataset.',
                  'Explorez les contrats, les employeurs de faction et les recompenses de blueprints du dataset publie.',
                )}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <PageStatCard
                label={t('Contracts', 'Contrats')}
                value={String(missionPageStats.contractCount)}
              />
              <PageStatCard
                label={t('Employers', 'Employeurs')}
                value={String(missionPageStats.employerCount)}
              />
              <PageStatCard
                label={t('Factions', 'Factions')}
                value={String(missionPageStats.factionCount)}
              />
              <PageStatCard
                label={t('Rewarded blueprints', 'Blueprints recompenses')}
                value={String(missionPageStats.rewardedBlueprintCount)}
              />
            </Box>
            </Stack>
          </Box>
          <MissionsFilterBar
            locations={allLocations}
            scales={allScales}
            contractors={allContractors}
            employers={allEmployers}
            factions={allFactions}
            reputationActivities={allReputationActivities}
            rewardCategories={allRewardCategories}
            rewardManufacturers={allRewardManufacturers}
            rewardBlueprints={allRewardBlueprints}
            resourceObjectiveResources={allResourceObjectiveResources}
            selectedLocation={locationFilter}
            selectedScale={scaleFilter}
            selectedLegality={legalityFilter}
            selectedContractor={contractorFilter}
            selectedEmployer={employerFilter}
            selectedFaction={factionFilter}
            selectedReputationActivity={reputationActivityFilter}
            selectedStandingBucket={standingBucketFilter}
            selectedRewardCategory={rewardCategoryFilter}
            selectedRewardManufacturer={rewardManufacturerFilter}
            selectedRewardBlueprint={rewardBlueprintFilter}
            selectedResourceObjectiveResource={resourceObjectiveResourceFilter}
            selectedResourceObjectiveMode={resourceObjectiveMode}
            selectedSort={sortBy}
            search={search}
            onLocationChange={setLocationFilter}
            onScaleChange={setScaleFilter}
            onLegalityChange={setLegalityFilter}
            onContractorChange={setContractorFilter}
            onEmployerChange={setEmployerFilter}
            onFactionChange={setFactionFilter}
            onReputationActivityChange={setReputationActivityFilter}
            onStandingBucketChange={setStandingBucketFilter}
            onRewardCategoryChange={setRewardCategoryFilter}
            onRewardManufacturerChange={setRewardManufacturerFilter}
            onRewardBlueprintChange={setRewardBlueprintFilter}
            onResourceObjectiveResourceChange={setResourceObjectiveResourceFilter}
            onResourceObjectiveModeChange={setResourceObjectiveMode}
            onSortChange={setSortBy}
            onSearchChange={setSearch}
          />
        </Box>
      )}
      <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 } }}>
        {selectedMission ? (
          <MissionDetail
            selection={selectedMission}
            blueprints={blueprints}
            favoriteIds={favoriteIds}
            inventoryIds={inventoryIds}
            resources={resources}
            statMaxima={statMaxima}
            onToggleFavorite={toggleFavorite}
            onToggleInventory={toggleInventory}
            onBack={() => {
              setSelectedMissionSlug(null);
              navigateToPath('/missions', { mainView: 'missions' });
            }}
            onBlueprintOpen={handleBlueprintClick}
          />
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }} aria-live="polite">
                {filteredContracts.length} {t('contracts', 'contrats')}
              </Typography>
            </Box>
            {filteredContracts.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }} role="status">
                {t('No contracts match your filters.', 'Aucun contrat ne correspond a tes filtres.')}
              </Typography>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      md: 'repeat(2, minmax(0, 1fr))',
                      xl: 'repeat(3, minmax(0, 1fr))',
                    },
                    gridAutoRows: { xs: 'auto', lg: '360px', xl: '334px' },
                    alignItems: 'stretch',
                    width: '100%',
                    gap: { xs: 1.25, md: 1.5 },
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
                      href={missionPathFromSlug(getMissionSlug(contract, group))}
                      onOpen={() => {
                        const missionSlug = getMissionSlug(contract, group);
                        startTransition(() => setSelectedMissionSlug(missionSlug));
                        navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
                      }}
                    />
                  ))}
                </Box>
                {visibleCount < filteredContracts.length && (
                  <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
                )}
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
