import { startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { alpha, useTheme } from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
import type {
  Blueprint,
  MissionContract,
  MissionEmployerRef,
  MissionSort,
  MissionRequiredStanding,
  MissionRewardFactionGroup,
  Resource,
  LocalizedString,
  StandingBucket,
} from '../types';
import { FONT_DISPLAY, FONT_MONO } from '../theme';

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
            color: 'text.secondary',
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
              'Search across every mission field, then use a few high-value filters for employer, theater, reward, standing and legality.',
              'Recherche dans tous les champs mission, puis utilise quelques filtres clés pour employeur, théâtre, récompense, réputation et légalité.',
              'Suche über alle Missionsfelder und nutze wenige starke Filter für Arbeitgeber, Einsatzraum, Belohnung, Ruf und Legalität.',
            )}
          </Typography>
        </Box>
        {hasActiveFilters && (
          <Button
            variant="outlined"
            startIcon={<FilterListOffOutlinedIcon />}
            onClick={() => {
              onLocationChange(null);
              onEmployerChange(null);
              onLegalityChange('all');
              onStandingBucketChange('all');
              onRewardBlueprintChange(null);
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
                <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
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
          <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as MissionSort)} inputProps={{ 'aria-label': t('Sort missions', 'Trier les missions') }}>
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, gap: 1 }}>
        <Autocomplete
          size="small"
          options={employers}
          value={employerFilter}
          onChange={(_event, value) => onEmployerChange(value)}
          renderInput={(params) => <TextField {...params} placeholder={t('Employer', 'Employeur')} sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 } }} />}
          slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
        />
        <Autocomplete
          size="small"
          options={locations}
          value={locationFilter}
          onChange={(_event, value) => onLocationChange(value)}
          renderInput={(params) => <TextField {...params} placeholder={t('Location', 'Lieu')} sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 } }} />}
          slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
        />
        <Autocomplete
          size="small"
          options={rewardBlueprints}
          value={rewardBlueprintFilter}
          onChange={(_event, value) => onRewardBlueprintChange(value)}
          renderInput={(params) => <TextField {...params} placeholder={t('Reward blueprint', 'Blueprint recompense')} sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 } }} />}
          slotProps={{ listbox: { sx: { fontSize: '0.75rem' } } }}
        />
        <FormControl size="small" sx={{ '& .MuiInputBase-root': { minHeight: 32, fontSize: '0.75rem' } }}>
          <Select value={standingBucketFilter} onChange={(event) => onStandingBucketChange(event.target.value as StandingBucket)} inputProps={{ 'aria-label': t('Standing requirement', 'Prérequis réputation') }}>
            {STANDING_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {loc(option.label, lang)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ '& .MuiInputBase-root': { minHeight: 32, fontSize: '0.75rem' } }}>
          <Select value={resourceObjectiveMode} onChange={(event) => onResourceObjectiveModeChange(event.target.value as 'all' | 'with' | 'without')} inputProps={{ 'aria-label': t('Resource objective filter', 'Filtre objectif ressource') }}>
            {RESOURCE_OBJECTIVE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {loc(option.label, lang)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Paper>
  );
}

function ContractRow({
  contract,
  group,
  onOpen,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
  onOpen: () => void;
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

  return (
    <Box
      component="tr"
      onClick={onOpen}
      sx={{
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(0,1fr) minmax(0,0.5fr) minmax(0,0.5fr) 80px' },
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: `1px solid ${theme.palette.ui.border}`,
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
        transition: 'background-color 120ms',
      }}
    >
      {/* Name + employer */}
      <Box component="td" sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.875rem', color: 'text.primary' }}>
          {contractName}
        </Typography>
        <Typography noWrap sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
          {employerName}{primaryLocation ? ` · ${primaryLocation}` : ''}
        </Typography>
      </Box>

      {/* Scale + legality — hidden xs */}
      <Box component="td" sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
        {scale && (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {formatScaleLabel(scale, lang)}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.72rem', color: isLawful ? 'success.main' : 'warning.main' }}>
          {isLawful ? t('Lawful', 'Légal') : t('Unlawful', 'Illégal')}
        </Typography>
      </Box>

      {/* Pool — hidden xs */}
      <Box component="td" sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {blueprintCount} bp
        </Typography>
      </Box>

      {/* Drop chance */}
      <Box component="td" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25, flexShrink: 0 }}>
        {dropChance > 0 && (
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.78rem', fontWeight: 700, color: 'primary.main' }}>
            {formatProbabilityPercent(dropChance)}
          </Typography>
        )}
        <ChevronRightIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
      </Box>
    </Box>
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
          onOpen();
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
                fontSize: '0.8125rem',
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
              fontSize: '0.625rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            {isUnlawful ? t('Illégal', 'Illégal') : t('Légal', 'Légal')}
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
            <Typography noWrap sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              {primaryLocation}
              {contract.availability.derivedScale && (
                <Box component="span" sx={{ ml: 0.75, color: 'text.disabled', fontSize: '0.75rem' }}>
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
                fontSize: '0.625rem',
                color: 'text.disabled',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {fact.label}
            </Typography>
            <Typography
              noWrap
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: '0.8125rem',
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
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'primary.main', fontWeight: 600 }}>
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
                      fontSize: '0.8125rem',
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
                        fontSize: '0.625rem',
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
                        fontSize: '0.6875rem',
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
        <Typography variant="body1" sx={{ fontWeight: 700 }}>{t('No mission data', 'Aucune donnee de mission')}</Typography>
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
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        p: { xs: 2, sm: 3 },
        maxWidth: 1600,
        mx: 'auto',
        animation: 'if-fade-in 240ms cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {factionsLoading && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }} />}

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
          {/* View header */}
          <Box>
            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: { xs: '1.75rem', md: '2rem' },
                letterSpacing: '-0.018em',
                lineHeight: 1.1,
                color: 'text.primary',
                mb: 0.5,
              }}
            >
              {t('Missions', 'Missions')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: '64ch' }}>
              {t(
                'Explore contracts, faction employers and blueprint rewards across the published dataset.',
                'Explorez les contrats, les employeurs de faction et les récompenses de blueprints du dataset publié.',
              )}
            </Typography>
          </Box>

          {/* Stat cards grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 1.5,
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
              label={t('Rewarded blueprints', 'Blueprints récompensés')}
              value={String(missionPageStats.rewardedBlueprintCount)}
            />
          </Box>

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
            <ToggleButtonGroup
              value={missionView}
              exclusive
              size="small"
              onChange={(_e, val) => { if (val) setMissionView(val as 'cards' | 'rows'); }}
              aria-label={t('View mode', 'Mode vue')}
              sx={{ '& .MuiToggleButton-root': { px: 1.25, py: 0.35, fontSize: '0.72rem', textTransform: 'none' } }}
            >
              <ToggleButton value="cards">{t('Cards', 'Cartes')}</ToggleButton>
              <ToggleButton value="rows">{t('Rows', 'Lignes')}</ToggleButton>
            </ToggleButtonGroup>
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
                      href={missionPathFromSlug(getMissionSlug(contract, group))}
                      onOpen={() => {
                        const missionSlug = getMissionSlug(contract, group);
                        startTransition(() => setSelectedMissionSlug(missionSlug));
                        navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
                      }}
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
                        onOpen={() => {
                          const missionSlug = getMissionSlug(contract, group);
                          startTransition(() => setSelectedMissionSlug(missionSlug));
                          navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
                        }}
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
    </Box>
  );
}
