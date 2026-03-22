import { useEffect, useMemo, useState } from 'react';
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
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import { BlueprintCard } from './BlueprintGrid';
import { ScaleBadge } from './ui/RarityBadge';
import { PageStatCard } from './ui/PageStatCard';
import { ResourceIcon } from './ui/ResourceIcon';
import {
  StarCitizenLicensedIcon,
  getLocationIconName,
  getMaterialProviderIconName,
} from './ui/StarCitizenLicensedIcon';
import { useCraft } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import {
  CATEGORY_LABELS,
  type Blueprint,
  type ItemCategory,
  type Lang,
  type MaterialSourceProvider,
  type MissionContract,
  type MissionRewardFactionGroup,
  type Resource,
  type ResourceInsight,
} from '../types';
import {
  computeStatMaxima,
  formatContractName,
  formatScaleLabel,
  formatStandingSummary,
  getMaterialProviders,
} from '../utils/crafting';
import {
  missionPathFromSlug,
  missionSlugFromContract,
  navigateToPath,
  resourcePathFromSlug,
  resourceSlugFromPathname,
} from '../utils/slug';

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
}

interface ResourceIdentityPanelProps {
  resource: Resource;
  insight: ResourceInsight | null;
  resourceProgress: { collected: number; method: string | null } | null;
  onBack: () => void;
}

const RESOURCE_SORT_OPTIONS: Array<{
  value: ResourceSort;
  labelEn: string;
  labelFr: string;
}> = [
  { value: 'name-asc', labelEn: 'Name', labelFr: 'Nom' },
  { value: 'providers-desc', labelEn: 'Most providers', labelFr: 'Plus de sources' },
  { value: 'missions-desc', labelEn: 'Most mission demand', labelFr: 'Plus de missions' },
  { value: 'blueprints-desc', labelEn: 'Most blueprint usage', labelFr: 'Plus de blueprints' },
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

function formatProbability(value: number | null | undefined): string {
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

    insightMap.set(resource.id, {
      ...insightMap.get(resource.id)!,
      providerCount: providers.length,
      systems,
      providerTypes,
    });
  }

  for (const blueprint of blueprints) {
    const seenResourceIds = new Set<string>();
    for (const slot of blueprint.slots) {
      const resourceId = slot.requiredResource
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const current = insightMap.get(resourceId);
      if (!current) continue;

      current.totalScuPerCraftSum = Number(
        (current.totalScuPerCraftSum + slot.quantityScu).toFixed(4),
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

function ResourceCard({ resource, insight, onOpen }: ResourceCardProps) {
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
                fontFamily: "'Khand', sans-serif",
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

  const content = (
    <Stack spacing={1}>
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
                  <SearchIcon sx={{ fontSize: '1.1rem' }} />
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
                {t(option.labelEn, option.labelFr)}
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
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Accordion disableGutters defaultExpanded sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle2">{t('Resource filters', 'Filtres de ressources')}</Typography>
          <Chip size="small" label={t('Compact mobile', 'Mobile compact')} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{content}</AccordionDetails>
    </Accordion>
  );
}

function ResourceIdentityPanel({
  resource,
  insight,
  resourceProgress,
  onBack,
}: ResourceIdentityPanelProps) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(resource.visual?.imageUrl && !imgError);

  useEffect(() => {
    setImgError(false);
  }, [resource.id]);

  return (
    <Stack spacing={2}>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<ArrowBackIcon />}
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
                fontFamily: "'Khand', sans-serif",
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
            <ResourceFact label={t('Combined craft volume', 'Volume craft cumule')} value={formatScu(insight?.totalScuPerCraftSum ?? 0)} />
          </Stack>

          {resourceProgress && (
            <>
              <Divider />
              <Stack spacing={0.75}>
                <Typography variant="overline">{t('Resource progress', 'Progression ressource')}</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={`${t('Collected', 'Collecte')}: ${formatScu(resourceProgress.collected)}`} />
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
}: {
  providers: MaterialSourceProvider[];
}) {
  const { t } = useI18n();
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
            (right.craftOnlyProbabilityPct ?? right.groupProbabilityPct ?? 0) -
              (left.craftOnlyProbabilityPct ?? left.groupProbabilityPct ?? 0) ||
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
        {providers.length === 0 ? (
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
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {provider.tier ?? t('Unknown tier', 'Tier inconnu')}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                <Chip size="small" label={`${t('Craft', 'Craft')}: ${formatProbability(provider.craftOnlyProbabilityPct)}`} />
                                <Chip size="small" variant="outlined" label={`${t('Pool', 'Pool')}: ${formatProbability(provider.groupProbabilityPct)}`} />
                                <Chip size="small" variant="outlined" label={provider.labelConfidence} />
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
}: {
  selection: Array<{ contract: MissionContract; group: MissionRewardFactionGroup }>;
  resourceId: string;
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
        {selection.length === 0 ? (
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
                          {formatContractName(contract.contractDebugName)}
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
  const { favoriteIds, inventoryIds } = useCraft();
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
              />
            ))}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export function ResourcesPage() {
  const {
    activeDataset,
    blueprints,
    materialSources,
    missionRewards,
    resourceProgress,
    setActiveBlueprint,
  } = useCraft();
  const { t } = useI18n();
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

  const allContracts = useMemo<FlatMissionContract[]>(() => {
    if (!missionRewards) return [];
    return missionRewards.factionGroups.flatMap((group) =>
      group.contracts.map((contract) => ({ contract, group })),
    );
  }, [missionRewards]);

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
        formatContractName(left.contract.contractDebugName).localeCompare(
          formatContractName(right.contract.contractDebugName),
        ),
      );
  }, [allContracts, selectedResource]);
  const selectedBlueprints = useMemo(() => {
    if (!selectedInsight) return [];

    const blueprintIdSet = new Set(selectedInsight.blueprintIds);
    return blueprints.filter((blueprint) => blueprintIdSet.has(blueprint.id));
  }, [blueprints, selectedInsight]);
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

          <ResourceSourcesSection providers={selectedProviders} />
          <ResourceMissionSection
            selection={selectedMissionDemand}
            resourceId={selectedResource.id}
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
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
                fontFamily: "'Khand', sans-serif",
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
          <Box
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
            {filteredResources.map((resource) => (
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
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
