import { startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { alpha, useTheme } from '@mui/material/styles';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { BlueprintCard } from './BlueprintGrid';
import { CategoryBadge } from './ui/Badge';
import { PageStatCard } from './ui/PageStatCard';
import { ScaleBadge } from './ui/RarityBadge';
import { StarCitizenLicensedIcon, getLocationIconName } from './ui/StarCitizenLicensedIcon';
import { StatBar } from './ui/StatBar';
import { useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';
import {
  computeStatMaxima,
  formatContractName,
  formatScaleLabel,
  formatStandingLabel,
  formatStandingSummary,
} from '../utils/crafting';
import { missionPathFromSlug, missionSlugFromContract, missionSlugFromPathname, navigateToPath } from '../utils/slug';
import type {
  Blueprint,
  ItemCategory,
  MissionContract,
  MissionEmployerRef,
  MissionSort,
  MissionRequiredStanding,
  MissionRewardFactionGroup,
  Resource,
  StandingBucket,
} from '../types';

const MISSION_SORT_OPTIONS: { value: MissionSort; labelEn: string; labelFr: string }[] = [
  { value: 'name-asc', labelEn: 'Mission name', labelFr: 'Nom de mission' },
  { value: 'employer-asc', labelEn: 'Employer', labelFr: 'Employeur' },
  { value: 'standing-asc', labelEn: 'Lowest standing', labelFr: 'Réputation croissante' },
  { value: 'standing-desc', labelEn: 'Highest standing', labelFr: 'Réputation décroissante' },
  { value: 'scale-asc', labelEn: 'Scale', labelFr: 'Portée' },
  { value: 'location-asc', labelEn: 'Location', labelFr: 'Lieu' },
  { value: 'blueprint-count-asc', labelEn: 'Fewest blueprints', labelFr: 'Moins de blueprints' },
  { value: 'blueprint-count-desc', labelEn: 'Most blueprints', labelFr: 'Plus de blueprints' },
  { value: 'chance-desc', labelEn: 'Best chance', labelFr: 'Meilleure chance' },
];

const STANDING_OPTIONS: { value: StandingBucket; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'Any standing', labelFr: 'Toute réputation' },
  { value: 'none', labelEn: 'No standing gate', labelFr: 'Sans prérequis' },
  { value: '1-999', labelEn: '1-999', labelFr: '1-999' },
  { value: '1000-4999', labelEn: '1k-4.9k', labelFr: '1k-4,9k' },
  { value: '5000-14999', labelEn: '5k-14.9k', labelFr: '5k-14,9k' },
  { value: '15000+', labelEn: '15k+', labelFr: '15k+' },
];

const RESOURCE_OBJECTIVE_OPTIONS = [
  { value: 'all', labelEn: 'All missions', labelFr: 'Toutes les missions' },
  { value: 'with', labelEn: 'With resource goals', labelFr: 'Avec objectifs ressource' },
  { value: 'without', labelEn: 'Without resource goals', labelFr: 'Sans objectifs ressource' },
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

function getMissionMaxChance(contract: MissionContract): number {
  return Math.max(0, ...contract.rewardedBlueprints.map((rewardedBlueprint) => rewardedBlueprint.chance ?? 0));
}

function getMissionRewardedBlueprintCount(contract: MissionContract): number {
  return new Set(
    contract.rewardedBlueprints
      .map((rewardedBlueprint) => rewardedBlueprint.id)
      .filter(Boolean),
  ).size;
}

function getStandingBucket(value: number | null | undefined): StandingBucket {
  if (value == null || value <= 0) return 'none';
  if (value <= 999) return '1-999';
  if (value <= 4999) return '1000-4999';
  if (value <= 14999) return '5000-14999';
  return '15000+';
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
    <Box component="section" aria-label={t('Mission filters', 'Filtres de mission')} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                  <SearchIcon sx={{ fontSize: '1.1rem' }} />
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
                {t(option.labelEn, option.labelFr)}
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
          {hasActiveFilters && (
            <Chip
              label={t('Clear', 'Effacer')}
              size="small"
              variant="outlined"
              onDelete={() => {
                onLocationChange(null);
                onScaleChange(null);
                onContractorChange(null);
                onEmployerChange(null);
                onFactionChange(null);
                onLegalityChange('all');
                onStandingBucketChange('all');
                onRewardCategoryChange('all');
                onRewardManufacturerChange(null);
                onRewardBlueprintChange(null);
                onResourceObjectiveResourceChange(null);
                onResourceObjectiveModeChange('all');
              }}
              sx={{ height: 24, fontSize: '.6rem' }}
            />
          )}
        </Stack>
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
                    {t(option.labelEn, option.labelFr)}
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
                    {t(option.labelEn, option.labelFr)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

function ContractCard({
  contract,
  group,
  onBlueprintClick,
  onOpen,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
  onBlueprintClick: (blueprintId: string) => void;
  onOpen: () => void;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const factionType = group.faction?.factionType?.toLowerCase() ?? '';
  const isUnlawful = factionType === 'unlawful';
  const maxStanding = getMissionMaxStanding(contract);
  const standingLabel = contract.minimumRequiredStandings.length > 0 ? formatStandingSummary(contract.minimumRequiredStandings, lang) : null;
  const maxChance = getMissionMaxChance(contract);
  const visibleBlueprints = contract.rewardedBlueprints.slice(0, 3);
  const blueprintOverflow = contract.rewardedBlueprints.length - 3;
  const primaryLocation = getPrimaryMissionLocation(contract);
  const locationIconName = primaryLocation ? getLocationIconName(primaryLocation) : null;
  const heroAsset = getMissionHeroAsset(contract, group);
  const showHeroImage = Boolean(heroAsset) && !imgError;
  const activityKind = getMissionActivityKind(contract);
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

  return (
    <Card
      role="listitem"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: theme.palette.ui.border,
        backgroundColor: theme.palette.ui.surface1,
        transition: 'border-color 150ms, background-color 150ms, transform 150ms',
        '&:hover': {
          borderColor: theme.palette.ui.borderStrong,
          backgroundColor: theme.palette.ui.surface2,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ height: '100%', alignItems: 'stretch' }}>
        <Box
          sx={{
            position: 'relative',
            height: { xs: 132, sm: 146 },
            background: `linear-gradient(160deg, ${alpha(
              isUnlawful ? theme.palette.error.main : theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.12 : 0.08,
            )}, ${alpha(theme.palette.brand.blue, theme.palette.mode === 'dark' ? 0.14 : 0.08)} 58%, ${alpha(
              theme.palette.background.default,
              0.45,
            )})`,
            borderBottom: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top right, ${alpha(theme.palette.common.white, 0.08)}, transparent 45%)` }} />

          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
            <ScaleBadge scale={contract.availability.derivedScale} label={formatScaleLabel(contract.availability.derivedScale, lang)} />
          </Box>

          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {primaryLocation && (
              <Chip
                label={primaryLocation}
                size="small"
                variant="outlined"
                icon={locationIconName ? <StarCitizenLicensedIcon name={locationIconName} size={14} dimmed /> : undefined}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  backgroundColor: alpha(theme.palette.background.paper, 0.5),
                  backdropFilter: 'blur(8px)',
                  '& .MuiChip-icon': { ml: '6px' },
                }}
              />
            )}
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: isUnlawful ? theme.palette.error.main : theme.palette.success.main,
              }}
              title={factionType || undefined}
            />
          </Box>

          <Box sx={{ position: 'absolute', right: 12, bottom: 12, zIndex: 1 }}>
            <Box
              title={activityLabel}
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.background.paper, 0.65),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
                boxShadow: `0 8px 18px ${alpha(theme.palette.common.black, 0.22)}`,
              }}
            >
              <MissionActivityIcon kind={activityKind} />
            </Box>
          </Box>

          <Box sx={{ width: '100%', height: '100%', p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showHeroImage ? (
              <CardMedia
                component="img"
                image={heroAsset!}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                sx={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  p: 1.5,
                  filter: theme.palette.mode === 'dark'
                    ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.4))'
                    : 'drop-shadow(0 10px 20px rgba(0,0,0,0.12))',
                  opacity: 0.96,
                  transition: 'transform 220ms ease',
                  '.MuiCardActionArea-root:hover &': {
                    transform: 'scale(1.04)',
                  },
                }}
              />
            ) : (
              <Stack spacing={1} alignItems="center" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                <MissionActivityIcon kind={activityKind} size="2rem" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {activityLabel}
                </Typography>
              </Stack>
            )}
          </Box>
        </Box>

        <Box sx={{ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1 }}>
          <Box>
            <Typography
              sx={{
                fontFamily: "'Khand', sans-serif",
                fontWeight: 700,
                fontSize: '1rem',
                lineHeight: 1.1,
                color: theme.palette.text.primary,
                textTransform: 'uppercase',
              }}
            >
              {formatContractName(contract.contractDebugName)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.brand.blueLight,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {group.contractorDisplayName} // {group.faction?.displayName ?? group.contractorDisplayName}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {standingLabel && (
              <StatBar
                label={t('Standing', 'Reputation', 'Ruf')}
                value={standingLabel}
                fill={Math.min(maxStanding / 15000, 1) * 100}
              />
            )}
            {maxChance > 0 && (
              <StatBar
                label={t('Chance', 'Chance', 'Chance')}
                value={`${Math.round(maxChance * 100)}%`}
                fill={maxChance * 100}
              />
            )}
          </Box>

          {contract.rewardedBlueprints.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color: theme.palette.text.disabled,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {t('Lootable blueprints', 'Blueprints recuperables')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {visibleBlueprints.map((blueprint, index) => (
                  <Chip
                    key={`${blueprint.id}-${index}`}
                    label={blueprint.name}
                    icon={blueprint.category ? <CategoryBadge category={blueprint.category} iconOnly /> : undefined}
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                      event.stopPropagation();
                      onBlueprintClick(blueprint.id);
                    }}
                    sx={{
                      cursor: 'pointer',
                      height: 24,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
                    }}
                  />
                ))}
                {blueprintOverflow > 0 && (
                  <Chip label={`+${blueprintOverflow}`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />
                )}
              </Box>
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em', pt: 0.5 }}
          >
            {t('Open mission dossier', 'Ouvrir le dossier mission')}
          </Typography>
        </Box>
      </CardActionArea>
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
            {formatContractName(contract.contractDebugName)}
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
              <Typography sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, mt: 0.5 }}>
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
}: {
  selection: FlatContract;
  blueprints: Blueprint[];
  favoriteIds: string[];
  inventoryIds: string[];
  resources: Resource[];
  statMaxima: ReturnType<typeof computeStatMaxima>;
  onBack: () => void;
  onBlueprintOpen: (blueprintId: string) => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { contract, group } = selection;
  const employer = getMissionEmployer(contract, group);
  const employerAssetUrl = getMissionEmployerAssetUrl(employer);
  const localities = getMissionLocalities(contract);
  const missionBlueprints = useMemo(() => dedupeMissionBlueprints(contract, blueprints), [contract, blueprints]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' }, gap: { xs: 2, md: 3 }, alignItems: 'start' }}>
      <Stack spacing={2}>
        <Button variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start' }}>
          {t('Back to missions', 'Retour aux missions')}
        </Button>

        <MissionHero contract={contract} group={group} />

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2.25} divider={<Divider flexItem />}>
            <MissionFact icon={<BusinessOutlinedIcon fontSize="small" />} label={t('Mission name', 'Mission')} value={formatContractName(contract.contractDebugName)} />
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
              {formatContractName(contract.contractDebugName)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 720 }}>
              {t(
                'Loot table view for this contract. Click any blueprint card to jump to the craft workspace.',
                'Vue des blueprints obtenables sur ce contrat. Clique sur une carte pour ouvrir son espace de craft.',
              )}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip label={`${missionBlueprints.length} ${t('lootable blueprints', 'blueprints recuperables')}`} size="small" />
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
              />
            ))}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function missionGetColumns(containerWidth: number): number {
  if (containerWidth >= 1200) return 4; // lg + xl
  if (containerWidth >= 900)  return 3; // md
  if (containerWidth >= 600)  return 2; // sm
  return 1;
}

export function MissionsPanel() {
  const {
    missionRewards,
    missionRewardsLoading,
    missionRewardsError,
    blueprints,
    favoriteIds,
    inventoryIds,
    setActiveBlueprint,
    activeDataset,
  } = useCraft();
  const { t } = useI18n();

  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [scaleFilter, setScaleFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState('all');
  const [contractorFilter, setContractorFilter] = useState<string | null>(null);
  const [employerFilter, setEmployerFilter] = useState<string | null>(null);
  const [factionFilter, setFactionFilter] = useState<string | null>(null);
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
    if (!missionRewards) {
      return [];
    }
    const results: FlatContract[] = [];
    for (const group of missionRewards.factionGroups) {
      for (const contract of group.contracts) {
        results.push({ contract, group });
      }
    }
    return results.sort((a, b) =>
      formatContractName(a.contract.contractDebugName).localeCompare(formatContractName(b.contract.contractDebugName)),
    );
  }, [missionRewards]);

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
    for (const { group } of allContracts) {
      set.add(group.contractorDisplayName);
    }
    return [...set].sort();
  }, [allContracts]);

  const allEmployers = useMemo(() => {
    const set = new Set<string>();
    for (const { contract, group } of allContracts) {
      set.add(getMissionEmployerName(contract, group));
    }
    return [...set].sort();
  }, [allContracts]);

  const allFactions = useMemo(() => {
    const set = new Set<string>();
    for (const { group, contract } of allContracts) {
      const label = group.faction?.displayName ?? contract.faction?.displayName;
      if (label) {
        set.add(label);
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
        contract.contractDebugName ?? '',
        contract.contractorDisplayName ?? '',
        group.contractorDisplayName,
        employerName,
        factionName ?? '',
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
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'standing-asc':
          return getMissionMaxStanding(left.contract) - getMissionMaxStanding(right.contract)
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'standing-desc':
          return getMissionMaxStanding(right.contract) - getMissionMaxStanding(left.contract)
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'scale-asc':
          return getScaleRank(left.contract.availability.derivedScale) - getScaleRank(right.contract.availability.derivedScale)
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'location-asc':
          return String(getPrimaryMissionLocation(left.contract) ?? '').localeCompare(String(getPrimaryMissionLocation(right.contract) ?? ''), undefined, { numeric: true, sensitivity: 'base' })
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'blueprint-count-asc':
          return getMissionRewardedBlueprintCount(left.contract) - getMissionRewardedBlueprintCount(right.contract)
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'blueprint-count-desc':
          return getMissionRewardedBlueprintCount(right.contract) - getMissionRewardedBlueprintCount(left.contract)
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'chance-desc':
          return getMissionMaxChance(right.contract) - getMissionMaxChance(left.contract)
            || formatContractName(left.contract.contractDebugName).localeCompare(formatContractName(right.contract.contractDebugName), undefined, { numeric: true, sensitivity: 'base' });
        case 'name-asc':
        default:
          return formatContractName(left.contract.contractDebugName).localeCompare(
            formatContractName(right.contract.contractDebugName),
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

  const { scrollContainerRef, sentinelRef, visibleCount } =
    useInfiniteScroll(filteredContracts, { getColumns: missionGetColumns });

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
        <Typography variant="body2">
          {t('Mission rewards are not available for this dataset.', 'Les recompenses de mission ne sont pas disponibles pour ce dataset.')}
        </Typography>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!selectedMission && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
          <Box sx={{ p: { xs: 1.25, sm: 1.5, md: 2 } }}>
            <Stack spacing={1.25}>
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Khand', sans-serif",
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
      <Box ref={scrollContainerRef} sx={{ p: { xs: 1.25, sm: 2, md: 3 }, flex: 1, overflow: 'auto' }}>
        {selectedMission ? (
          <MissionDetail
            selection={selectedMission}
            blueprints={blueprints}
            favoriteIds={favoriteIds}
            inventoryIds={inventoryIds}
            resources={resources}
            statMaxima={statMaxima}
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
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: { xs: 1.25, sm: 1.5, md: 2 },
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
