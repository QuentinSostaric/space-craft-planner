import { useEffect, useMemo, useState } from 'react';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { alpha, useTheme } from '@mui/material/styles';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import { BlueprintCard } from './BlueprintGrid';
import { AppGlyph } from './ui/AppGlyph';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { ScaleBadge } from './ui/RarityBadge';
import { PageStatCard } from './ui/PageStatCard';
import { ResourceIcon } from './ui/ResourceIcon';
import { isResourceSlot } from '../utils/crafting';
import {
  StarCitizenLicensedIcon,
  getLocationIconName,
  getMaterialProviderIconName,
} from './ui/StarCitizenLicensedIcon';
import { useCraft } from '../store/CraftContext';
import { useAuth } from '../auth/AuthContext';
import { loc, useI18n } from '../i18n/I18nContext';
import {
  CATEGORY_LABELS,
  type Blueprint,
  type ItemCategory,
  type Lang,
  type LocalizedString,
  type MaterialSourceProvider,
  type MissionContract,
  type MissionRewardFactionGroup,
  type Resource,
  type ResourceInsight,
} from '../types';
import {
  computeStatMaxima,
  formatProbabilityPercent,
  formatMaterialProviderConfidence,
  formatMaterialProviderType,
  formatMaterialSourceMethod,
  formatMineableGroupName,
  formatQualityLabel,
  formatResourceQuantity,
  formatScaleLabel,
  formatStandingSummary,
  getMissionBlueprintDropChance,
  getMissionContractName,
  getMaterialProviderProbabilityPct,
  getMaterialProviders,
  getResourceQuantityInputStep,
  getSlotQuantityValue,
  clampQualityValue,
  ls,
} from '../utils/crafting';
import {
  missionPathFromSlug,
  missionSlugFromContract,
  navigateToPath,
  resourcePathFromSlug,
  resourceSlugFromPathname,
} from '../utils/slug';
import { FONT_HEADING } from '../theme';

type ResourceSort = 'name-asc' | 'providers-desc' | 'missions-desc' | 'blueprints-desc';
type ResourceFamilyFilter = 'all' | 'metal' | 'mineral' | 'crystal' | 'ice';
type ResourceSourceTypeFilter = 'all' | 'planetary' | 'asteroid';
type ResourceMissionFilter = 'all' | 'mission-linked' | 'no-mission';

interface FlatMissionContract {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
}

interface ResourceCardProps {
  resource: Resource;
  insight: ResourceInsight | null;
  onOpen: () => void;
  onAddToPlanner: () => void;
  onAddToInventory: () => void;
  addToInventoryLabel: string;
}

interface ResourceInventoryDialogState {
  resourceId: string;
  resourceName: string;
  quantityUnit: 'scu' | 'count';
  quantity: number;
  quality: string;
}

interface ResourceIdentityPanelProps {
  resource: Resource;
  insight: ResourceInsight | null;
  resourceProgress: { collected: number; method: string | null } | null;
  craftDemandQuantity: number;
  craftDemandUnit: 'scu' | 'count' | 'mixed';
  onBack: () => void;
}

const RESOURCE_SORT_OPTIONS: Array<{
  value: ResourceSort;
  label: LocalizedString;
}> = [
  { value: 'name-asc', label: ls('Name', 'Nom', 'Name') },
  { value: 'providers-desc', label: ls('Most providers', 'Plus de sources', 'Meiste Quellen') },
  { value: 'missions-desc', label: ls('Most mission demand', 'Plus de missions', 'Meiste Missionsnachfrage') },
  { value: 'blueprints-desc', label: ls('Most blueprint usage', 'Plus de blueprints', 'Meiste Blueprint-Nutzung') },
];

function simplifyProviderType(
  providerType: string | null | undefined,
): 'planetary' | 'asteroid' | 'other' {
  if (providerType === 'asteroid-hotspot') {
    return 'asteroid';
  }

  if (providerType === 'body-provider') {
    return 'planetary';
  }

  return 'other';
}

function formatScu(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (amount >= 10) return `${Math.round(amount)} SCU`;
  if (amount >= 1) return `${amount.toFixed(1)} SCU`;
  return `${amount.toFixed(2)} SCU`;
}

export function formatProbability(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  const amount = Number(value);
  if (amount >= 10) {
    return `${Math.round(amount)}%`;
  }
  return `${amount.toFixed(1)}%`;
}

function getResourceFamilyLabel(
  family: ResourceFamilyFilter,
  lang: Lang,
): string {
  const labels: Record<ResourceFamilyFilter, { en: string; fr: string; de?: string }> = {
    all: { en: 'All', fr: 'Toutes', de: 'Alle' },
    metal: { en: 'Metal', fr: 'Metal', de: 'Metall' },
    mineral: { en: 'Mineral', fr: 'Mineral', de: 'Mineral' },
    crystal: { en: 'Crystal', fr: 'Cristal', de: 'Kristall' },
    ice: { en: 'Ice', fr: 'Glace', de: 'Eis' },
  };

  return loc(labels[family], lang);
}

function getSourceTypeLabel(
  type: ResourceSourceTypeFilter,
  lang: Lang,
): string {
  const labels: Record<ResourceSourceTypeFilter, { en: string; fr: string; de?: string }> = {
    all: { en: 'All', fr: 'Toutes', de: 'Alle' },
    planetary: { en: 'Planetary', fr: 'Planetaires', de: 'Planetar' },
    asteroid: { en: 'Asteroid', fr: 'Asteroides', de: 'Asteroid' },
  };

  return loc(labels[type], lang);
}

function buildFallbackResourceInsights(
  resources: Resource[],
  blueprints: Blueprint[],
  allContracts: FlatMissionContract[],
  materialSources: ReturnType<typeof useCraft>['materialSources'],
): ResourceInsight[] {
  const insightMap = new Map<string, ResourceInsight>(
    resources.map((resource) => [
      resource.id,
      {
        resourceId: resource.id,
        providerCount: 0,
        systems: [],
        providerTypes: [],
        sourceMethods: [],
        missionObjectiveContractCount: 0,
        missionEmployers: [],
        missionLocations: [],
        blueprintUsageCount: 0,
        blueprintCategoryCounts: {},
        blueprintIds: [],
        totalScuPerCraftSum: 0,
      },
    ]),
  );

  for (const resource of resources) {
    const providers = getMaterialProviders(materialSources, resource.id);
    const systems = [
      ...new Set(
        providers
          .map((provider) => provider.system)
          .filter(Boolean) as string[],
      ),
    ].sort((left, right) => left.localeCompare(right));
    const providerTypes = [
      ...new Set(
        providers.map((provider) => simplifyProviderType(provider.providerType)),
      ),
    ].sort((left, right) => left.localeCompare(right)) as Array<
      'planetary' | 'asteroid' | 'other'
    >;
    const sourceMethods = [
      ...new Set(
        providers
          .map((provider) => provider.sourceMethod)
          .filter(Boolean) as Array<'ship-mining' | 'hand-mining'>,
      ),
    ].sort((left, right) => left.localeCompare(right));

    insightMap.set(resource.id, {
      ...insightMap.get(resource.id)!,
      providerCount: providers.length,
      systems,
      providerTypes,
      sourceMethods,
    });
  }

  for (const blueprint of blueprints) {
    const seenResourceIds = new Set<string>();
    for (const slot of blueprint.slots) {
      if (!isResourceSlot(slot)) {
        continue;
      }

      const resourceId = slot.requiredResource
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const current = insightMap.get(resourceId);
      if (!current) continue;

      current.totalScuPerCraftSum = Number(
        (current.totalScuPerCraftSum + getSlotQuantityValue(slot)).toFixed(4),
      );

      if (seenResourceIds.has(resourceId)) continue;

      seenResourceIds.add(resourceId);
      current.blueprintIds.push(blueprint.id);
      current.blueprintUsageCount = current.blueprintIds.length;
      current.blueprintCategoryCounts = {
        ...current.blueprintCategoryCounts,
        [blueprint.category]:
          (current.blueprintCategoryCounts[blueprint.category] ?? 0) + 1,
      };
    }
  }

  for (const { contract, group } of allContracts) {
    const locations = [
      ...new Set([
        ...contract.availability.localities,
        ...contract.availability.explicitLocations,
      ]),
    ].sort((left, right) => left.localeCompare(right));
    const employerName =
      contract.employer?.displayName ??
      group.employer?.displayName ??
      contract.contractorDisplayName ??
      group.contractorDisplayName ??
      null;

    const seenResourceIds = new Set<string>();
    for (const objective of contract.resourceObjectives) {
      const resourceId = objective.resourceId;
      if (!resourceId || seenResourceIds.has(resourceId)) continue;

      seenResourceIds.add(resourceId);
      const current = insightMap.get(resourceId);
      if (!current) continue;

      current.missionObjectiveContractCount += 1;
      current.missionEmployers = employerName
        ? [...new Set([...current.missionEmployers, employerName])].sort((left, right) =>
            left.localeCompare(right),
          )
        : current.missionEmployers;
      current.missionLocations = [
        ...new Set([...current.missionLocations, ...locations]),
      ].sort((left, right) => left.localeCompare(right));
    }
  }

  for (const insight of insightMap.values()) {
    insight.blueprintIds.sort((left, right) => left.localeCompare(right));
  }

  return resources
    .map((resource) => insightMap.get(resource.id)!)
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
}

function summarizeResourceCraftDemand(
  resourceId: string,
  blueprints: Blueprint[],
): { quantity: number; quantityUnit: 'scu' | 'count' | 'mixed' } {
  let quantity = 0;
  let quantityUnit: 'scu' | 'count' | null = null;
  let mixed = false;

  for (const blueprint of blueprints) {
    for (const slot of blueprint.slots) {
      if (!isResourceSlot(slot)) {
        continue;
      }

      const slotResourceId = slot.requiredResource
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (slotResourceId !== resourceId) {
        continue;
      }

      const slotUnit = slot.quantityUnit === 'count' ? 'count' : 'scu';
      quantity += getSlotQuantityValue(slot);

      if (!quantityUnit) {
        quantityUnit = slotUnit;
      } else if (quantityUnit !== slotUnit) {
        mixed = true;
      }
    }
  }

  return {
    quantity,
    quantityUnit: mixed ? 'mixed' : quantityUnit ?? 'scu',
  };
}

function ResourceFact({ label, value }: { label: string; value: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1.25,
        minWidth: 0,
        flex: '1 1 120px',
        backgroundColor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.disabled',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function ResourceCard({
  resource,
  insight,
  onOpen,
  onAddToPlanner,
  onAddToInventory,
  addToInventoryLabel,
}: ResourceCardProps) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const imageUrl = resource.visual?.imageUrl ?? null;
  const showImage = Boolean(imageUrl && !imgError);
  const systems = insight?.systems ?? [];

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'primary.main',
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 12px 28px ${alpha('#000', 0.45)}`
              : `0 12px 28px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      <CardActionArea
        onClick={onOpen}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box
          sx={{
            position: 'relative',
            height: { xs: 148, sm: 164, md: 180 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderBottom: 1,
            borderColor: 'divider',
            background: `linear-gradient(180deg, ${alpha(resource.color, 0.22)} 0%, ${alpha(
              theme.palette.background.paper,
              0.1,
            )} 100%)`,
          }}
        >
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
            <Chip
              label={getResourceFamilyLabel(
                (resource.visualKind ?? 'all') as ResourceFamilyFilter,
                lang,
              )}
              size="small"
              sx={{
                backgroundColor: alpha(theme.palette.background.default, 0.75),
                color: 'text.primary',
                borderColor: alpha(resource.color, 0.5),
              }}
            />
          </Box>
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
            <Chip
              size="small"
              color={insight?.missionObjectiveContractCount ? 'primary' : 'default'}
              label={
                insight?.missionObjectiveContractCount
                  ? t('Mission-linked', 'Liee aux missions')
                  : t('No missions', 'Sans mission')
              }
            />
          </Box>
          {showImage ? (
            <CardMedia
              component="img"
              image={imageUrl!}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              <ResourceIcon name={resource.name} size={72} shimmer={false} />
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
          <Box>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: '1.15rem',
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {resource.name}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.75,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '2.8em',
              }}
            >
              {resource.description}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <ResourceFact label={t('Providers', 'Sources')} value={String(insight?.providerCount ?? 0)} />
            <ResourceFact label={t('Missions', 'Missions')} value={String(insight?.missionObjectiveContractCount ?? 0)} />
            <ResourceFact label={t('Blueprints', 'Blueprints')} value={String(insight?.blueprintUsageCount ?? 0)} />
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 'auto' }}>
            {systems.slice(0, 3).map((system) => {
              const iconName = getLocationIconName(system);
              return (
                <Chip
                  key={system}
                  size="small"
                  icon={
                    iconName ? <StarCitizenLicensedIcon name={iconName} size={14} dimmed /> : undefined
                  }
                  label={system}
                />
              );
            })}
            {systems.length > 3 && <Chip size="small" label={`+${systems.length - 3}`} />}
          </Stack>
        </Box>
      </CardActionArea>
      <Divider />
      <Box sx={{ p: { xs: 1.15, sm: 1.35 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 0.8,
          }}
        >
          <Button
            variant="outlined"
            fullWidth
            onClick={onAddToPlanner}
            startIcon={<PlaylistAddOutlinedIcon />}
            sx={{
              minHeight: { xs: 38, sm: 40 },
              px: { xs: 1.1, sm: 1.4 },
              borderColor: alpha(theme.palette.primary.main, 0.28),
              backgroundColor: alpha(theme.palette.background.default, 0.2),
              textTransform: 'none',
              fontWeight: 700,
              fontSize: { xs: '0.76rem', sm: '0.82rem' },
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t('Add to Planner', 'Ajouter au planificateur')}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={onAddToInventory}
            startIcon={<Inventory2OutlinedIcon />}
            sx={{
              minHeight: { xs: 38, sm: 40 },
              px: { xs: 1.1, sm: 1.4 },
              borderColor: alpha(theme.palette.secondary.main, 0.3),
              backgroundColor: alpha(theme.palette.secondary.main, 0.08),
              textTransform: 'none',
              fontWeight: 700,
              fontSize: { xs: '0.76rem', sm: '0.82rem' },
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {addToInventoryLabel}
          </Button>
        </Box>
      </Box>
    </Card>
  );
}

function ResourcesFilterBar({
  search,
  onSearchChange,
  familyFilter,
  onFamilyFilterChange,
  systemFilter,
  onSystemFilterChange,
  sourceTypeFilter,
  onSourceTypeFilterChange,
  missionFilter,
  onMissionFilterChange,
  blueprintCategoryFilter,
  onBlueprintCategoryFilterChange,
  sortBy,
  onSortByChange,
  systems,
  blueprintCategories,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  familyFilter: ResourceFamilyFilter;
  onFamilyFilterChange: (value: ResourceFamilyFilter) => void;
  systemFilter: string | null;
  onSystemFilterChange: (value: string | null) => void;
  sourceTypeFilter: ResourceSourceTypeFilter;
  onSourceTypeFilterChange: (value: ResourceSourceTypeFilter) => void;
  missionFilter: ResourceMissionFilter;
  onMissionFilterChange: (value: ResourceMissionFilter) => void;
  blueprintCategoryFilter: ItemCategory | null;
  onBlueprintCategoryFilterChange: (value: ItemCategory | null) => void;
  sortBy: ResourceSort;
  onSortByChange: (value: ResourceSort) => void;
  systems: string[];
  blueprintCategories: ItemCategory[];
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const hasActiveFilters =
    search.trim().length > 0 ||
    familyFilter !== 'all' ||
    systemFilter !== null ||
    sourceTypeFilter !== 'all' ||
    missionFilter !== 'all' ||
    blueprintCategoryFilter !== null;

  const resetFilters = () => {
    onSearchChange('');
    onFamilyFilterChange('all');
    onSystemFilterChange(null);
    onSourceTypeFilterChange('all');
    onMissionFilterChange('all');
    onBlueprintCategoryFilterChange(null);
  };

  const content = (
    <Stack spacing={1.25}>
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
            {t('Resource filters', 'Filtres ressources', 'Ressourcenfilter')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(
              'Search the dataset, focus a family, then narrow sources, mission links or blueprint usage.',
              'Recherche dans le dataset, cible une famille puis affine les sources, les liens mission ou l usage blueprint.',
              'Durchsuche den Datensatz, fokussiere eine Familie und verfeinere danach Quellen, Missionsbezug oder Blueprint-Nutzung.',
            )}
          </Typography>
        </Box>
        {hasActiveFilters && (
          <Button
            variant="outlined"
            startIcon={<FilterListOffOutlinedIcon />}
            onClick={resetFilters}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {t('Reset filters', 'Reinitialiser', 'Filter zurucksetzen')}
          </Button>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(260px, 1fr) minmax(190px, 220px)',
          },
          gap: 1,
          alignItems: 'center',
        }}
      >
        <TextField
          type="search"
          size="small"
          placeholder={t('Search resources...', 'Rechercher des ressources...')}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <AppGlyph name="search" size={18} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: 0,
            '& .MuiInputBase-root': { fontSize: '.8rem', height: 32 },
          }}
        />
        <FormControl
          size="small"
          sx={{
            minWidth: { xs: '100%', sm: 220 },
            '& .MuiInputBase-root': { height: 32, fontSize: '.75rem' },
          }}
        >
          <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as ResourceSort)} inputProps={{ 'aria-label': t('Sort by', 'Trier par') }}>
            {RESOURCE_SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {loc(option.label, lang)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <ToggleButtonGroup
        value={familyFilter}
        exclusive
        onChange={(_event, value) => value && onFamilyFilterChange(value)}
        size="small"
        sx={{
          width: { xs: '100%', sm: 'auto' },
          alignSelf: 'flex-start',
          display: { xs: 'grid', sm: 'inline-flex' },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
          gridAutoRows: { xs: 'minmax(32px, auto)', sm: 'auto' },
          '& .MuiToggleButton-root': {
            px: { xs: 0.75, sm: 1.25 },
            minHeight: 32,
            minWidth: 0,
            fontSize: { xs: '.62rem', sm: '.68rem' },
            lineHeight: 1.1,
            whiteSpace: 'normal',
          },
        }}
      >
        {(['all', 'metal', 'mineral', 'crystal', 'ice'] as ResourceFamilyFilter[]).map((family) => (
          <ToggleButton key={family} value={family}>
            {getResourceFamilyLabel(family, lang)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <Autocomplete
          size="small"
          options={systems}
          value={systemFilter}
          onChange={(_event, value) => onSystemFilterChange(value)}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('System', 'Système')}
              placeholder={t('System', 'Systeme')}
              sx={{ '& .MuiInputBase-root': { fontSize: '.75rem', height: 32 } }}
            />
          )}
        />
        <ToggleButtonGroup
          value={sourceTypeFilter}
          exclusive
          onChange={(_event, value) => value && onSourceTypeFilterChange(value)}
          size="small"
          sx={{
            width: '100%',
            height: 32,
            '& .MuiToggleButton-root': {
              flex: 1,
              minWidth: 0,
              fontSize: '.62rem',
              px: 0.75,
              lineHeight: 1.1,
            },
          }}
        >
          {(['all', 'planetary', 'asteroid'] as ResourceSourceTypeFilter[]).map((type) => (
            <ToggleButton key={type} value={type}>
              {getSourceTypeLabel(type, lang)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={missionFilter}
          exclusive
          onChange={(_event, value) => value && onMissionFilterChange(value)}
          size="small"
          sx={{
            width: '100%',
            height: 32,
            '& .MuiToggleButton-root': {
              flex: 1,
              minWidth: 0,
              fontSize: '.62rem',
              px: 0.75,
              lineHeight: 1.1,
            },
          }}
        >
          <ToggleButton value="all">{t('All', 'Toutes')}</ToggleButton>
          <ToggleButton value="mission-linked">{t('Mission-linked', 'Liees')}</ToggleButton>
          <ToggleButton value="no-mission">{t('No mission', 'Sans mission')}</ToggleButton>
        </ToggleButtonGroup>
        <Autocomplete
          size="small"
          options={blueprintCategories}
          value={blueprintCategoryFilter}
          onChange={(_event, value) => onBlueprintCategoryFilterChange(value)}
          getOptionLabel={(value) => loc(CATEGORY_LABELS[value], lang) ?? value}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('Blueprint', 'Blueprint')}
              placeholder={t('Blueprint category', 'Categorie blueprint')}
              sx={{ '& .MuiInputBase-root': { fontSize: '.75rem', height: 32 } }}
            />
          )}
        />
      </Box>
    </Stack>
  );

  if (!isCompact) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.25, md: 1.5 },
          borderColor: alpha(theme.palette.primary.main, 0.14),
          backgroundColor: alpha(theme.palette.background.default, 0.24),
        }}
      >
        {content}
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 0.75,
        borderColor: alpha(theme.palette.primary.main, 0.14),
        backgroundColor: alpha(theme.palette.background.default, 0.24),
      }}
    >
      <Accordion
        disableGutters
        defaultExpanded
        sx={{
          backgroundColor: 'transparent',
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<AppGlyph name="caret-up" size={18} />}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">{t('Resource filters', 'Filtres de ressources')}</Typography>
            {hasActiveFilters && (
              <Chip size="small" variant="outlined" color="primary" label={t('Active', 'Actifs', 'Aktiv')} />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>{content}</AccordionDetails>
      </Accordion>
    </Paper>
  );
}

function ResourceIdentityPanel({
  resource,
  insight,
  resourceProgress,
  craftDemandQuantity,
  craftDemandUnit,
  onBack,
}: ResourceIdentityPanelProps) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(resource.visual?.imageUrl && !imgError);
  const craftDemandLabel =
    craftDemandUnit === 'mixed'
      ? `${craftDemandQuantity.toFixed(2)} ${t('mixed', 'mixte')}`
      : formatResourceQuantity(craftDemandQuantity, craftDemandUnit, lang, 'long');

  useEffect(() => {
    setImgError(false);
  }, [resource.id]);

  return (
    <Stack spacing={2}>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<AppGlyph name="arrow-left" size={18} />}
        onClick={onBack}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('Back to resources', 'Retour aux ressources')}
      </Button>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'relative',
            minHeight: 260,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'stretch',
            background: `radial-gradient(circle at top, ${alpha(resource.color, 0.35)} 0%, ${alpha(
              theme.palette.background.default,
              0.18,
            )} 58%, transparent 100%)`,
          }}
        >
          {showImage ? (
            <CardMedia
              component="img"
              image={resource.visual!.imageUrl!}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.95,
              }}
            />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ResourceIcon name={resource.name} size={96} shimmer={false} />
            </Box>
          )}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              p: 2.5,
              background: 'linear-gradient(180deg, transparent 0%, rgba(7,10,18,0.85) 100%)',
            }}
          >
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.25 }}>
              {resource.visualKind && (
                <Chip
                  label={getResourceFamilyLabel(resource.visualKind as ResourceFamilyFilter, lang)}
                  size="small"
                />
              )}
              {(insight?.sourceMethods ?? []).map((sourceMethod) => (
                <Chip
                  key={sourceMethod}
                  label={formatMaterialSourceMethod(sourceMethod, lang)}
                  size="small"
                  variant="outlined"
                />
              ))}
              <Chip
                label={
                  insight?.missionObjectiveContractCount
                    ? t('Mission-linked', 'Liee aux missions')
                    : t('No mission demand', 'Sans demande mission')
                }
                color={insight?.missionObjectiveContractCount ? 'primary' : 'default'}
                size="small"
              />
            </Stack>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '2.4rem' },
                lineHeight: 0.95,
                textTransform: 'uppercase',
              }}
            >
              {resource.name}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1, maxWidth: 42 * 8 }}>
              {resource.description}
            </Typography>
          </Box>
        </Box>

          <Stack spacing={2} sx={{ p: 2.25 }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <ResourceFact label={t('Providers', 'Sources')} value={String(insight?.providerCount ?? 0)} />
              <ResourceFact label={t('Systems', 'Systemes')} value={String(insight?.systems.length ?? 0)} />
              <ResourceFact label={t('Mission contracts', 'Contrats mission')} value={String(insight?.missionObjectiveContractCount ?? 0)} />
              <ResourceFact label={t('Blueprint usage', 'Usage blueprint')} value={String(insight?.blueprintUsageCount ?? 0)} />
              <ResourceFact label={t('Craft demand', 'Demande craft')} value={craftDemandLabel} />
            </Stack>

          {resourceProgress && (
            <>
              <Divider />
              <Stack spacing={0.75}>
                <Typography variant="overline">{t('Resource progress', 'Progression ressource')}</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label={`${t('Collected', 'Collecte')}: ${
                      craftDemandUnit === 'mixed'
                        ? resourceProgress.collected.toFixed(2)
                        : formatResourceQuantity(resourceProgress.collected, craftDemandUnit, lang, 'long')
                    }`}
                  />
                  {resourceProgress.method && (
                    <Chip label={`${t('Method', 'Methode')}: ${resourceProgress.method}`} variant="outlined" />
                  )}
                </Stack>
              </Stack>
            </>
          )}

          {resource.visualNotes && (
            <>
              <Divider />
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {resource.visualNotes}
              </Typography>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function ResourceSourcesSection({
  providers,
  hasMaterialSourceData,
}: {
  providers: MaterialSourceProvider[];
  hasMaterialSourceData: boolean;
}) {
  const { t, lang } = useI18n();
  const groupedProviders = useMemo(() => {
    const groups = new Map<'planetary' | 'asteroid' | 'other', MaterialSourceProvider[]>();
    for (const provider of providers) {
      const type = simplifyProviderType(provider.providerType);
      const list = groups.get(type) ?? [];
      list.push(provider);
      groups.set(type, list);
    }

    return [...groups.entries()]
      .map(([type, list]) => [
        type,
        [...list].sort(
          (left, right) =>
            (getMaterialProviderProbabilityPct(right) ?? 0) -
              (getMaterialProviderProbabilityPct(left) ?? 0) ||
            String(left.providerDisplayName ?? '').localeCompare(String(right.providerDisplayName ?? '')),
        ),
      ] as const)
      .sort(([left], [right]) => left.localeCompare(right));
  }, [providers]);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ScienceOutlinedIcon sx={{ color: 'secondary.main', fontSize: '1.1rem' }} />
          <Typography variant="overline">{t('Best Sources', 'Meilleures sources')}</Typography>
        </Stack>
        {!hasMaterialSourceData ? (
          <DatasetTooOldNotice />
        ) : providers.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('No provider data available for this resource.', 'Aucune source connue pour cette ressource.')}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {groupedProviders.map(([type, list]) => {
              const iconName = type === 'asteroid' ? 'asteroid' : type === 'planetary' ? 'planet' : null;

              return (
                <Paper key={type} variant="outlined" sx={{ p: 1.25, backgroundColor: 'background.default' }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {iconName && <StarCitizenLicensedIcon name={iconName} size={16} dimmed />}
                      <Typography variant="subtitle2">
                        {type === 'asteroid'
                          ? t('Asteroid sources', 'Sources asteroidales')
                          : type === 'planetary'
                            ? t('Planetary sources', 'Sources planetaires')
                            : t('Other sources', 'Autres sources')}
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {list.map((provider) => {
                        const providerIcon = getMaterialProviderIconName(
                          provider.providerType,
                          provider.providerDisplayName,
                          provider.system,
                        );
                        const providerProbabilityPct = getMaterialProviderProbabilityPct(provider);

                        return (
                          <Paper
                            key={`${provider.providerId ?? provider.providerDisplayName}-${provider.system ?? 'unknown'}`}
                            variant="outlined"
                            sx={{ p: 1.25, backgroundColor: 'background.paper' }}
                          >
                            <Stack
                              direction={{ xs: 'column', md: 'row' }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', md: 'center' }}
                            >
                              <Stack spacing={0.4}>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  {providerIcon && <StarCitizenLicensedIcon name={providerIcon} size={14} dimmed />}
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {provider.providerDisplayName}
                                  </Typography>
                                  {provider.system && <Chip size="small" variant="outlined" label={provider.system} />}
                                </Stack>
                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={formatMaterialProviderType(provider.providerType, lang)}
                                  />
                                  {provider.sourceMethod && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={formatMaterialSourceMethod(provider.sourceMethod, lang)}
                                    />
                                  )}
                                  {provider.mineableGroupName && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={formatMineableGroupName(provider.mineableGroupName)}
                                    />
                                  )}
                                </Stack>
                              </Stack>
                              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                {providerProbabilityPct != null && (
                                  <Chip
                                    size="small"
                                    label={`${t('Share', 'Part')}: ${providerProbabilityPct}%`}
                                  />
                                )}
                                {provider.tier && (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`${t('Tier', 'Tier')}: ${provider.tier}`}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={formatMaterialProviderConfidence(provider.labelConfidence, lang)}
                                />
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function ResourceMissionSection({
  selection,
  resourceId,
  missionRewardsLoading,
  hasMissionRewardData,
}: {
  selection: Array<{ contract: MissionContract; group: MissionRewardFactionGroup }>;
  resourceId: string;
  missionRewardsLoading: boolean;
  hasMissionRewardData: boolean;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <RouteOutlinedIcon sx={{ color: 'secondary.main', fontSize: '1.1rem' }} />
          <Typography variant="overline">{t('Mission Demand', 'Demande mission')}</Typography>
        </Stack>
        {missionRewardsLoading ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('Loading mission data...', 'Chargement des donnees mission...')}
          </Typography>
        ) : !hasMissionRewardData ? (
          <DatasetTooOldNotice />
        ) : selection.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('No mission objectives currently reference this resource.', 'Aucun objectif de mission ne reference actuellement cette ressource.')}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {selection.map(({ contract, group }) => {
              const objective =
                contract.resourceObjectives.find((entry) => entry.resourceId === resourceId) ??
                contract.resourceObjectives[0];
              const missionSlug = missionSlugFromContract(
                contract.contractDebugName,
                group.contractorDisplayName,
              );
              const employerName =
                contract.employer?.displayName ??
                group.employer?.displayName ??
                contract.contractorDisplayName ??
                group.contractorDisplayName;
              const primaryLocation =
                contract.availability.localities[0] ??
                contract.availability.explicitLocations[0] ??
                null;
              const standingSummary = formatStandingSummary(
                contract.minimumRequiredStandings,
                lang,
              );
              const blueprintDropChance = getMissionBlueprintDropChance(contract);

              return (
                <Card key={`${contract.contractFile ?? 'contract'}-${contract.contractDebugName ?? 'debug'}`}>
                  <CardActionArea
                    onClick={() =>
                      navigateToPath(missionPathFromSlug(missionSlug), {
                        missionSlug,
                        mainView: 'missions',
                      })
                    }
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 1.25,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {getMissionContractName(contract)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                          {employerName}
                        </Typography>
                      </Box>
                      <ScaleBadge
                        scale={contract.availability.derivedScale}
                        label={formatScaleLabel(contract.availability.derivedScale, lang)}
                      />
                    </Stack>

                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {primaryLocation && (
                        <Chip
                          size="small"
                          icon={
                            getLocationIconName(primaryLocation) ? (
                              <StarCitizenLicensedIcon
                                name={getLocationIconName(primaryLocation)!}
                                size={14}
                                dimmed
                              />
                            ) : undefined
                          }
                          label={primaryLocation}
                        />
                      )}
                      {standingSummary && (
                        <Chip size="small" variant="outlined" label={standingSummary} />
                      )}
                      {blueprintDropChance > 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${formatProbabilityPercent(blueprintDropChance)} ${t('chance', 'chance')}`}
                        />
                      )}
                      {objective && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            objective.minScu === objective.maxScu
                              ? formatScu(objective.minScu)
                              : `${formatScu(objective.minScu)}-${formatScu(objective.maxScu)}`
                          }
                        />
                      )}
                    </Stack>

                    <Divider flexItem />
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.72) }}>
                      {contract.rewardedBlueprints.length} {t('lootable blueprints', 'blueprints lootables')}
                    </Typography>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function ResourceBlueprintUsageSection({
  resourceId,
  blueprints,
  resources,
  onOpenBlueprint,
}: {
  resourceId: string;
  blueprints: Blueprint[];
  resources: Resource[];
  onOpenBlueprint: (blueprint: Blueprint) => void;
}) {
  const { t, lang } = useI18n();
  const { favoriteIds, inventoryIds, toggleFavorite, toggleInventory } = useCraft();
  const statMaxima = useMemo(() => computeStatMaxima(blueprints), [blueprints]);
  const categoryOptions = useMemo(
    () =>
      [...new Set(blueprints.map((blueprint) => blueprint.category))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [blueprints],
  );
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');

  useEffect(() => {
    setCategoryFilter('all');
  }, [resourceId]);

  const filteredBlueprints = useMemo(() => {
    if (categoryFilter === 'all') {
      return blueprints;
    }
    return blueprints.filter((blueprint) => blueprint.category === categoryFilter);
  }, [blueprints, categoryFilter]);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={1}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ViewInArOutlinedIcon sx={{ color: 'secondary.main', fontSize: '1.1rem' }} />
            <Typography variant="overline">{t('Used In Blueprints', 'Utilisee dans les blueprints')}</Typography>
          </Stack>
          {categoryOptions.length > 1 && (
            <ToggleButtonGroup
              value={categoryFilter}
              exclusive
              onChange={(_event, value) => value && setCategoryFilter(value)}
              size="small"
              sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { px: 1.25, fontSize: '0.72rem' } }}
            >
              <ToggleButton value="all">{t('All', 'Toutes')}</ToggleButton>
              {categoryOptions.map((category) => (
                <ToggleButton key={category} value={category}>
                  {loc(CATEGORY_LABELS[category], lang)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Stack>

        {filteredBlueprints.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('No blueprint currently uses this resource.', 'Aucun blueprint n utilise actuellement cette ressource.')}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
              gap: { xs: 1.25, md: 1.5 },
            }}
          >
            {filteredBlueprints.map((blueprint) => (
              <BlueprintCard
                key={blueprint.id}
                blueprint={blueprint}
                activeBlueprintId={null}
                isFavorite={favoriteIds.includes(blueprint.id)}
                isInInventory={inventoryIds.includes(blueprint.id)}
                statMaxima={statMaxima}
                resources={resources}
                onSelect={(bp) => { if (bp) onOpenBlueprint(bp); }}
                onToggleFavorite={toggleFavorite}
                onToggleInventory={toggleInventory}
              />
            ))}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function resourceGetColumns(containerWidth: number): number {
  if (containerWidth >= 1536) return 4; // xl
  if (containerWidth >= 1200) return 3; // lg
  if (containerWidth >= 600)  return 2; // sm (covers md — no md CSS breakpoint)
  return 1;
}

export function ResourcesPage() {
  const {
    activeDataset,
    addPlannerResourceRequirement,
    blueprints,
    ensureResourceDataLoaded,
    ensureMissionRewardsLoaded,
    materialSources,
    missionRewards,
    missionRewardsLoading,
    resourceDataLoading,
    resourceProgress,
    setActiveBlueprint,
  } = useCraft();
  const { t, lang } = useI18n();
  const { account, updateInventoryResources } = useAuth();
  const theme = useTheme();
  const resources = activeDataset.resources;

  const [selectedResourceSlug, setSelectedResourceSlug] = useState<string | null>(() =>
    resourceSlugFromPathname(window.location.pathname),
  );
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<ResourceFamilyFilter>('all');
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<ResourceSourceTypeFilter>('all');
  const [missionFilter, setMissionFilter] = useState<ResourceMissionFilter>('all');
  const [blueprintCategoryFilter, setBlueprintCategoryFilter] = useState<ItemCategory | null>(null);
  const [sortBy, setSortBy] = useState<ResourceSort>('name-asc');
  const [inventoryDialog, setInventoryDialog] = useState<ResourceInventoryDialogState | null>(null);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const allContracts = useMemo<FlatMissionContract[]>(() => {
    if (!missionRewards) return [];
    return missionRewards.factionGroups.flatMap((group) =>
      (group.contracts ?? []).map((contract) => ({ contract, group })),
    );
  }, [missionRewards]);

  useEffect(() => {
    void ensureResourceDataLoaded();
  }, [ensureResourceDataLoaded]);

  useEffect(() => {
    void ensureMissionRewardsLoaded();
  }, [ensureMissionRewardsLoaded]);

  const resourceInsights = useMemo(
    () =>
      activeDataset.resourceInsights ??
      buildFallbackResourceInsights(resources, blueprints, allContracts, materialSources),
    [activeDataset.resourceInsights, allContracts, blueprints, materialSources, resources],
  );

  const resourceInsightById = useMemo(
    () => new Map(resourceInsights.map((insight) => [insight.resourceId, insight])),
    [resourceInsights],
  );

  const resourcePlannerUnitById = useMemo(
    () =>
      new Map(
        resources.map((resource) => {
          const demand = summarizeResourceCraftDemand(resource.id, blueprints);
          return [resource.id, demand.quantityUnit === 'count' ? 'count' : 'scu'] as const;
        }),
      ),
    [blueprints, resources],
  );

  const openInventoryDialog = (resource: Resource) => {
    const quantityUnit = resourcePlannerUnitById.get(resource.id) ?? 'scu';
    const defaultQuantity = quantityUnit === 'count' ? 1 : 0.01;

    if (!account) {
      navigateToPath('/account', { mainView: 'account' });
      return;
    }

    setInventoryNotice(null);
    setInventoryError(null);
    setInventoryDialog({
      resourceId: resource.id,
      resourceName: resource.name,
      quantityUnit,
      quantity: defaultQuantity,
      quality: '',
    });
  };

  const closeInventoryDialog = () => {
    if (!inventoryBusy) {
      setInventoryDialog(null);
    }
  };

  const submitInventoryDialog = async () => {
    if (!account || !inventoryDialog) {
      return;
    }

    const normalizedQuantity =
      inventoryDialog.quantityUnit === 'count'
        ? Math.max(1, Math.round(Number(inventoryDialog.quantity) || 0))
        : Math.max(0.001, Math.round((Number(inventoryDialog.quantity) || 0) * 1000) / 1000);
    const normalizedQuality = clampQualityValue(
      inventoryDialog.quality.trim() ? Number(inventoryDialog.quality) : undefined,
    );

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setInventoryError(
        t(
          'Enter a valid quantity before adding this resource to the inventory.',
          'Saisis une quantite valide avant d ajouter cette ressource a l inventaire.',
          'Gib eine gultige Menge ein, bevor du diese Ressource zum Inventar hinzufugst.',
        ),
      );
      return;
    }

    setInventoryBusy(true);
    setInventoryError(null);

    try {
      const nowIso = new Date().toISOString();
      await updateInventoryResources([
        ...(account.inventoryResources ?? []),
        {
          id: globalThis.crypto.randomUUID(),
          resourceId: inventoryDialog.resourceId,
          resourceName: inventoryDialog.resourceName,
          quantity: normalizedQuantity,
          quantityUnit: inventoryDialog.quantityUnit,
          quality: normalizedQuality ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ]);
      setInventoryDialog(null);
      setInventoryNotice(
        t(
          `${inventoryDialog.resourceName} was added to the account inventory.`,
          `${inventoryDialog.resourceName} a ete ajoutee a l inventaire du compte.`,
          `${inventoryDialog.resourceName} wurde dem Konto-Inventar hinzugefugt.`,
        ),
      );
    } catch (error) {
      setInventoryError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update the resource inventory.',
              'La mise a jour de l inventaire de ressources a echoue.',
              'Das Ressourceninventar konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setInventoryBusy(false);
    }
  };

  const systems = useMemo(
    () =>
      [...new Set(resourceInsights.flatMap((insight) => insight.systems))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [resourceInsights],
  );

  const blueprintCategories = useMemo(
    () =>
      [
        ...new Set(
          resourceInsights.flatMap(
            (insight) => Object.keys(insight.blueprintCategoryCounts) as ItemCategory[],
          ),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [resourceInsights],
  );

  useEffect(() => {
    const syncSelectedResourceFromPath = () => {
      setSelectedResourceSlug(resourceSlugFromPathname(window.location.pathname));
    };

    syncSelectedResourceFromPath();
    window.addEventListener('popstate', syncSelectedResourceFromPath);
    return () => window.removeEventListener('popstate', syncSelectedResourceFromPath);
  }, []);

  const selectedResource = useMemo(() => {
    if (!selectedResourceSlug) return null;

    return (
      resources.find((resource) => resource.id === selectedResourceSlug) ??
      resources.find(
        (resource) =>
          resource.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === selectedResourceSlug,
      ) ??
      null
    );
  }, [resources, selectedResourceSlug]);

  useEffect(() => {
    if (!selectedResourceSlug || selectedResource || resources.length === 0) return;
    setSelectedResourceSlug(null);
    navigateToPath('/resources', { mainView: 'resources' });
  }, [resources.length, selectedResource, selectedResourceSlug]);

  const filteredResources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = resources.filter((resource) => {
      const insight = resourceInsightById.get(resource.id) ?? null;
      const haystack = [
        resource.name,
        resource.description,
        ...(insight?.systems ?? []),
        ...(insight?.missionEmployers ?? []),
        ...(insight?.missionLocations ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
      if (familyFilter !== 'all' && resource.visualKind !== familyFilter) return false;
      if (systemFilter && !(insight?.systems ?? []).includes(systemFilter)) return false;
      if (
        sourceTypeFilter !== 'all' &&
        !(insight?.providerTypes ?? []).includes(sourceTypeFilter)
      ) {
        return false;
      }
      if (
        missionFilter === 'mission-linked' &&
        (insight?.missionObjectiveContractCount ?? 0) <= 0
      ) {
        return false;
      }
      if (
        missionFilter === 'no-mission' &&
        (insight?.missionObjectiveContractCount ?? 0) > 0
      ) {
        return false;
      }
      if (
        blueprintCategoryFilter &&
        !(insight?.blueprintCategoryCounts?.[blueprintCategoryFilter] ?? 0)
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((left, right) => {
      const leftInsight = resourceInsightById.get(left.id) ?? null;
      const rightInsight = resourceInsightById.get(right.id) ?? null;

      switch (sortBy) {
        case 'providers-desc':
          return (rightInsight?.providerCount ?? 0) - (leftInsight?.providerCount ?? 0) || left.name.localeCompare(right.name);
        case 'missions-desc':
          return (rightInsight?.missionObjectiveContractCount ?? 0) - (leftInsight?.missionObjectiveContractCount ?? 0) || left.name.localeCompare(right.name);
        case 'blueprints-desc':
          return (rightInsight?.blueprintUsageCount ?? 0) - (leftInsight?.blueprintUsageCount ?? 0) || left.name.localeCompare(right.name);
        case 'name-asc':
        default:
          return left.name.localeCompare(right.name);
      }
    });
  }, [
    blueprintCategoryFilter,
    familyFilter,
    missionFilter,
    resourceInsightById,
    resources,
    search,
    sortBy,
    sourceTypeFilter,
    systemFilter,
  ]);

  const { sentinelRef, visibleCount } =
    useInfiniteScroll(filteredResources, {
      getColumns: resourceGetColumns,
      getScrollRoot: getMainContentScrollRoot,
    });

  const resourceStats = useMemo(() => {
    const systemCount = new Set(resourceInsights.flatMap((insight) => insight.systems)).size;
    const missionLinkedCount = resourceInsights.filter(
      (insight) => insight.missionObjectiveContractCount > 0,
    ).length;
    const providerCount =
      materialSources?.summary?.providerCount ??
      resourceInsights.reduce((sum, insight) => sum + insight.providerCount, 0);

    return {
      resourceCount: resources.length,
      systemCount,
      missionLinkedCount,
      providerCount,
    };
  }, [materialSources, resourceInsights, resources.length]);

  const selectedInsight = selectedResource
    ? resourceInsightById.get(selectedResource.id) ?? null
    : null;
  const selectedProviders = useMemo(
    () => (selectedResource ? getMaterialProviders(materialSources, selectedResource.id) : []),
    [materialSources, selectedResource],
  );
  const selectedMissionDemand = useMemo(() => {
    if (!selectedResource) return [];

    return allContracts
      .filter(({ contract }) =>
        contract.resourceObjectives.some((objective) => objective.resourceId === selectedResource.id),
      )
      .sort((left, right) =>
        getMissionContractName(left.contract).localeCompare(
          getMissionContractName(right.contract),
        ),
      );
  }, [allContracts, selectedResource]);
  const selectedBlueprints = useMemo(() => {
    if (!selectedInsight) return [];

    const blueprintIdSet = new Set(selectedInsight.blueprintIds);
    return blueprints.filter((blueprint) => blueprintIdSet.has(blueprint.id));
  }, [blueprints, selectedInsight]);
  const selectedCraftDemand = useMemo(
    () =>
      selectedResource
        ? summarizeResourceCraftDemand(selectedResource.id, selectedBlueprints)
        : { quantity: 0, quantityUnit: 'scu' as const },
    [selectedBlueprints, selectedResource],
  );
  const selectedProgress =
    (selectedResource &&
      (resourceProgress[selectedResource.name] ?? resourceProgress[selectedResource.id])) ??
    null;

  if (selectedResource) {
    return (
      <Box
        sx={{
          p: { xs: 1.25, sm: 1.5, md: 2, xl: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        <ResourceIdentityPanel
          resource={selectedResource}
          insight={selectedInsight}
          resourceProgress={selectedProgress}
          craftDemandQuantity={selectedCraftDemand.quantity}
          craftDemandUnit={selectedCraftDemand.quantityUnit}
          onBack={() => {
            setSelectedResourceSlug(null);
            navigateToPath('/resources', { mainView: 'resources' });
          }}
        />

        <Stack spacing={2}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.5, md: 2 },
              background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 100%)`,
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
              <ResourceFact label={t('Systems', 'Systemes')} value={(selectedInsight?.systems ?? []).join(', ') || '—'} />
              <ResourceFact label={t('Mission employers', 'Employeurs mission')} value={String(selectedInsight?.missionEmployers.length ?? 0)} />
              <ResourceFact label={t('Source families', 'Familles de source')} value={(selectedInsight?.providerTypes ?? []).join(', ') || '—'} />
            </Stack>
          </Paper>

          <ResourceSourcesSection
            providers={selectedProviders}
            hasMaterialSourceData={Boolean(materialSources?.resources) || resourceDataLoading}
          />
          <ResourceMissionSection
            selection={selectedMissionDemand}
            resourceId={selectedResource.id}
            missionRewardsLoading={missionRewardsLoading}
            hasMissionRewardData={Boolean(missionRewards)}
          />

          <ResourceBlueprintUsageSection
            resourceId={selectedResource.id}
            blueprints={selectedBlueprints}
            resources={resources}
            onOpenBlueprint={setActiveBlueprint}
          />
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', flex: '1 0 auto', minHeight: 0 }}
    >
      <Box
        sx={{
          p: { xs: 1.25, sm: 1.5, md: 2 },
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
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
              {t('Resources', 'Ressources')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
              {t(
                'Browse material demand, provider coverage and mission pull across the published dataset.',
                'Parcourez la demande en materiaux, la couverture des sources et la pression mission du dataset publie.',
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
            <PageStatCard label={t('Resources', 'Ressources')} value={String(resourceStats.resourceCount)} />
            <PageStatCard label={t('Systems', 'Systemes')} value={String(resourceStats.systemCount)} />
            <PageStatCard label={t('Mission-linked', 'Liees aux missions')} value={String(resourceStats.missionLinkedCount)} />
            <PageStatCard label={t('Providers', 'Sources')} value={String(resourceStats.providerCount)} />
          </Box>

          {(inventoryNotice || inventoryError) && (
            <Alert severity={inventoryError ? 'error' : 'success'} variant="outlined">
              {inventoryError ?? inventoryNotice}
            </Alert>
          )}
        </Stack>
      </Box>

      <ResourcesFilterBar
        search={search}
        onSearchChange={setSearch}
        familyFilter={familyFilter}
        onFamilyFilterChange={setFamilyFilter}
        systemFilter={systemFilter}
        onSystemFilterChange={setSystemFilter}
        sourceTypeFilter={sourceTypeFilter}
        onSourceTypeFilterChange={setSourceTypeFilter}
        missionFilter={missionFilter}
        onMissionFilterChange={setMissionFilter}
        blueprintCategoryFilter={blueprintCategoryFilter}
        onBlueprintCategoryFilterChange={setBlueprintCategoryFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        systems={systems}
        blueprintCategories={blueprintCategories}
      />

      <Box
        sx={{
          p: { xs: 1.25, sm: 1.5, md: 2, xl: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {filteredResources.length} {t('resources', 'ressources')}
        </Typography>

        {filteredResources.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <ImageNotSupportedOutlinedIcon sx={{ fontSize: '2rem', mb: 1, color: 'text.disabled' }} />
            <Typography variant="body1" sx={{ mb: 0.75 }}>
              {t('No resource matches the current filters.', 'Aucune ressource ne correspond aux filtres actuels.')}
            </Typography>
            <Typography variant="body2">
              {t('Broaden the search or clear one of the active filters.', 'Elargissez la recherche ou retirez un des filtres actifs.')}
            </Typography>
          </Paper>
        ) : (
          <>
            <Box
              role="list"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gap: { xs: 1.25, md: 1.5, xl: 2 },
              }}
            >
              {filteredResources.slice(0, visibleCount).map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  insight={resourceInsightById.get(resource.id) ?? null}
                  onOpen={() => {
                    setSelectedResourceSlug(resource.id);
                    navigateToPath(resourcePathFromSlug(resource.id), {
                      resourceId: resource.id,
                      mainView: 'resources',
                    });
                  }}
                  onAddToPlanner={() =>
                    addPlannerResourceRequirement(
                      resource.name,
                      1,
                      resourcePlannerUnitById.get(resource.id) ?? 'scu',
                    )}
                  onAddToInventory={() => {
                    openInventoryDialog(resource);
                  }}
                  addToInventoryLabel={
                    account
                      ? t('Add to inventory', 'Ajouter a l inventaire')
                      : t('Sign in for inventory', 'Connexion pour l inventaire')
                  }
                />
              ))}
            </Box>
            {visibleCount < filteredResources.length && (
              <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
            )}
          </>
        )}
      </Box>

      <Dialog
        open={Boolean(inventoryDialog)}
        onClose={closeInventoryDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {inventoryDialog
            ? t(
                `Add ${inventoryDialog.resourceName} to inventory`,
                `Ajouter ${inventoryDialog.resourceName} a l inventaire`,
                `${inventoryDialog.resourceName} zum Inventar hinzufugen`,
              )
            : t('Add resource to inventory', 'Ajouter la ressource a l inventaire')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {inventoryError && (
              <Alert severity="error" variant="outlined">
                {inventoryError}
              </Alert>
            )}

            <TextField
              label={t('Quantity', 'Quantite', 'Menge')}
              type="number"
              value={inventoryDialog?.quantity ?? ''}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value);
                setInventoryDialog((current) =>
                  current
                    ? {
                        ...current,
                        quantity: Number.isFinite(nextQuantity) ? nextQuantity : current.quantity,
                      }
                    : current,
                );
              }}
              inputProps={{
                min: inventoryDialog?.quantityUnit === 'count' ? 1 : 0.001,
                step: getResourceQuantityInputStep(inventoryDialog?.quantityUnit ?? 'scu'),
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {inventoryDialog?.quantityUnit === 'count'
                      ? t('items', 'objets', 'Teile')
                      : 'SCU'}
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label={t('Quality (optional)', 'Qualite (optionnelle)', 'Qualitat (optional)')}
              type="number"
              value={inventoryDialog?.quality ?? ''}
              onChange={(event) => {
                const nextQuality = event.target.value;
                setInventoryDialog((current) =>
                  current
                    ? {
                        ...current,
                        quality: nextQuality,
                      }
                    : current,
                );
              }}
              inputProps={{ min: 0, max: 1000, step: 1 }}
              helperText={
                inventoryDialog?.quality.trim()
                  ? formatQualityLabel(
                      clampQualityValue(Number(inventoryDialog.quality)) ?? 0,
                      lang,
                    )
                  : t(
                      'Leave empty if the resource quality is unknown.',
                      'Laisse vide si la qualite de la ressource est inconnue.',
                      'Leer lassen, wenn die Ressourcenqualitat unbekannt ist.',
                    )
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" onClick={closeInventoryDialog} disabled={inventoryBusy}>
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </Button>
          <Button variant="contained" onClick={() => { void submitInventoryDialog(); }} disabled={inventoryBusy}>
            {inventoryBusy
              ? t('Saving...', 'Enregistrement...', 'Speichere...')
              : t('Add entry', 'Ajouter l entree', 'Eintrag hinzufugen')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
