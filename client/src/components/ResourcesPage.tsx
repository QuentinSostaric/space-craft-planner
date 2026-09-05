import { Box, Divider, IconButton, Paper, Stack, Typography, alpha, useTheme } from '../ui/system';
import { Card, CardActionArea, CardMedia, Table, TableBody, TableCell, TableHead, TableRow } from './ui/primitives';
import { AppTooltip } from './ui/overlays';
import { AppChip } from './ui/data-display/AppChip';
import { AppAlert } from './ui/feedback';
import { ImageNotSupportedOutlinedIcon, Inventory2OutlinedIcon, PlaylistAddOutlinedIcon, ChevronRightOutlinedIcon, RouteOutlinedIcon, ScienceOutlinedIcon, ViewInArOutlinedIcon } from '../ui/icons';
import { useEffect, useMemo, useState } from 'react';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { BlueprintCard } from './BlueprintGrid';
import { AppGlyph } from './ui/AppGlyph';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { ScaleBadge } from './ui/RarityBadge';
import { PageStatCard } from './ui/PageStatCard';
import { ResourceIcon } from './ui/ResourceIcon';
import { isPlaceholderResource, isResourceSlot } from '../utils/crafting';
import {
  StarCitizenLicensedIcon,
  getLocationIconName,
  getMaterialProviderIconName,
} from './ui/StarCitizenLicensedIcon';
import { useCraft } from '../store/CraftContext';
import { useAuth } from '../auth/AuthContext';
import { readLocalInventoryResources, writeLocalInventoryResources } from '../auth/localAccountImport';
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
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';
import { FONT_DISPLAY, FONT_HEADING, FONT_MONO, TEXT_LABEL, TEXT_LABEL_LG, TEXT_LABEL_SM } from '../theme';
import { AppButton } from './ui/controls/AppButton';
import { AppSelect } from './ui/controls/AppSelect';
import { AppTextField } from './ui/controls/AppTextField';
import { SurfaceState } from './ui/feedback/SurfaceState';
import { AppDialog } from './ui/overlays/AppDialog';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import { ResponsiveFilters } from './ui/page/ResponsiveFilters';

type ResourceSort = 'name-asc' | 'providers-desc' | 'missions-desc' | 'blueprints-desc';
type ResourceFamilyFilter = 'all' | 'metal' | 'mineral' | 'crystal' | 'ice' | 'crafting-slot';
type ResourceSourceTypeFilter = 'all' | 'planetary' | 'asteroid';
type ResourceMissionFilter = 'all' | 'mission-linked' | 'no-mission';

interface FlatMissionContract {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
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
    'crafting-slot': { en: 'Crafting part', fr: 'Piece de craft', de: 'Fertigungsteil' },
  };

  return loc(labels[family] ?? labels.all, lang);
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
          color: 'text.secondary',
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

function ResourceThumbnail({ resource, size = 44 }: { resource: Resource; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = resource.visual?.imageUrl ?? null;
  const showImage = Boolean(imageUrl && !imgError);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: 1,
        borderColor: alpha(resource.color, 0.36),
        borderRadius: 1,
        backgroundColor: 'background.default',
      }}
    >
      {showImage ? (
        <CardMedia
          component="img"
          image={imageUrl!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <ResourceIcon name={resource.name} size={Math.max(24, size - 12)} shimmer={false} />
      )}
    </Box>
  );
}

function ResourceFamilyChip({ resource }: { resource: Resource }) {
  const { lang } = useI18n();
  const theme = useTheme();

  return (
    <AppChip
      size="small"
      variant="outlined"
      label={getResourceFamilyLabel((resource.visualKind ?? 'all') as ResourceFamilyFilter, lang)}
      sx={{
        height: 24,
        borderColor: alpha(resource.color, 0.48),
        color: alpha(theme.palette.text.primary, 0.9),
        backgroundColor: alpha(resource.color, 0.1),
        px: 0.9,
        fontFamily: FONT_HEADING,
        fontWeight: 700,
        fontSize: TEXT_LABEL,
      }}
    />
  );
}

function ResourceSystemsChips({ systems }: { systems: string[] }) {
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {systems.slice(0, 2).map((system) => {
        const iconName = getLocationIconName(system);
        return (
          <AppChip
            key={system}
            size="small"
            icon={iconName ? <StarCitizenLicensedIcon name={iconName} size={13} dimmed /> : undefined}
            label={system}
            sx={{ height: 22, maxWidth: 112, px: 0.75 }}
          />
        );
      })}
      {systems.length > 2 ? <AppChip size="small" label={`+${systems.length - 2}`} sx={{ height: 22 }} /> : null}
    </Stack>
  );
}

function ResourceMobileList({
  resources,
  resourceInsightById,
  onOpen,
  onAddToPlanner,
  onAddToInventory,
}: {
  resources: Resource[];
  resourceInsightById: Map<string, ResourceInsight>;
  onOpen: (resource: Resource) => void;
  onAddToPlanner: (resource: Resource) => void;
  onAddToInventory: (resource: Resource) => void;
}) {
  const { t } = useI18n();

  return (
    <Stack role="list" spacing={1}>
      {resources.map((resource) => {
        const insight = resourceInsightById.get(resource.id) ?? null;
        return (
          <Paper
            key={resource.id}
            variant="outlined"
            role="listitem"
            sx={{ p: 1, backgroundColor: 'background.paper' }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ResourceThumbnail resource={resource} size={42} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    sx={{
                      fontFamily: FONT_HEADING,
                      fontWeight: 700,
                      fontSize: '0.98rem',
                      lineHeight: 1,
                    }}
                  >
                    {resource.name}
                  </Typography>
                  <ResourceSystemsChips systems={insight?.systems ?? []} />
                </Box>
                <AppButton
                  size="small"
                  variant="outlined"
                  ariaLabel={t('Open resource detail', 'Ouvrir la fiche ressource', 'Ressourcendetail offnen')}
                  onClick={() => onOpen(resource)}
                  sx={{ minWidth: 34, width: 34, p: 0 }}
                >
                  <ChevronRightOutlinedIcon fontSize="small" />
                </AppButton>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }}>
                <ResourceFact label={t('Sources', 'Sources')} value={String(insight?.providerCount ?? 0)} />
                <ResourceFact label={t('Missions', 'Missions')} value={String(insight?.missionObjectiveContractCount ?? 0)} />
                <ResourceFact label={t('Blueprints', 'Blueprints')} value={String(insight?.blueprintUsageCount ?? 0)} />
              </Box>
              <Stack direction="row" spacing={0.75}>
                <AppButton
                  size="small"
                  variant="outlined"
                  startIcon={<PlaylistAddOutlinedIcon />}
                  onClick={() => onAddToPlanner(resource)}
                  sx={{ flex: 1, minWidth: 0, fontSize: TEXT_LABEL }}
                >
                  {t('Planner', 'Planifier', 'Planer')}
                </AppButton>
                <AppButton
                  size="small"
                  variant="outlined"
                  startIcon={<Inventory2OutlinedIcon />}
                  onClick={() => onAddToInventory(resource)}
                  sx={{ flex: 1, minWidth: 0, fontSize: TEXT_LABEL }}
                >
                  {t('Inventory', 'Inventaire', 'Inventar')}
                </AppButton>
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

function ResourcePreviewPanel({
  resource,
  insight,
  providers,
  linkedBlueprints,
  onOpen,
  onAddToPlanner,
  onAddToInventory,
  onOpenBlueprint,
}: {
  resource: Resource | null;
  insight: ResourceInsight | null;
  providers: MaterialSourceProvider[];
  linkedBlueprints: Blueprint[];
  onOpen: (resource: Resource) => void;
  onAddToPlanner: (resource: Resource) => void;
  onAddToInventory: (resource: Resource) => void;
  onOpenBlueprint: (blueprint: Blueprint) => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [resource?.id]);

  if (!resource) {
    return null;
  }

  const showImage = Boolean(resource.visual?.imageUrl && !imgError);
  const sortedProviders = [...providers]
    .sort(
      (left, right) =>
        (getMaterialProviderProbabilityPct(right) ?? 0) -
          (getMaterialProviderProbabilityPct(left) ?? 0) ||
        String(left.providerDisplayName ?? '').localeCompare(String(right.providerDisplayName ?? '')),
    )
    .slice(0, 4);

  return (
    <Paper
      variant="outlined"
      sx={{
        position: { lg: 'sticky' },
        top: { lg: 16 },
        overflow: 'hidden',
        backgroundColor: alpha(theme.palette.background.paper, 0.9),
      }}
    >
      <Box sx={{ p: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: FONT_HEADING,
                  fontWeight: 700,
                  fontSize: '1.45rem',
                  lineHeight: 0.95,
                }}
              >
                {resource.name}
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                <ResourceFamilyChip resource={resource} />
              </Box>
            </Box>
            <AppButton
              size="small"
              variant="outlined"
              ariaLabel={t('Open resource detail', 'Ouvrir la fiche ressource', 'Ressourcendetail offnen')}
              onClick={() => onOpen(resource)}
              sx={{ minWidth: 34, width: 34, p: 0, flexShrink: 0 }}
            >
              <ChevronRightOutlinedIcon fontSize="small" />
            </AppButton>
          </Stack>

          <Box
            sx={{
              height: 150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              background: `linear-gradient(180deg, ${alpha(resource.color, 0.24)} 0%, ${alpha(
                theme.palette.background.default,
                0.3,
              )} 100%)`,
            }}
          >
            {showImage ? (
              <CardMedia
                component="img"
                image={resource.visual!.imageUrl!}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ResourceIcon name={resource.name} size={88} shimmer={false} />
            )}
          </Box>

          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {resource.description ||
              t(
                'No description available for this resource.',
                'Aucune description disponible pour cette ressource.',
                'Keine Beschreibung fur diese Ressource verfugbar.',
              )}
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
            <ResourceFact label={t('Sources', 'Sources')} value={String(insight?.providerCount ?? 0)} />
            <ResourceFact label={t('Missions', 'Missions')} value={String(insight?.missionObjectiveContractCount ?? 0)} />
            <ResourceFact label={t('Blueprints', 'Blueprints')} value={String(insight?.blueprintUsageCount ?? 0)} />
            <ResourceFact label={t('Systems', 'Systemes')} value={String(insight?.systems.length ?? 0)} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
            <AppButton
              size="small"
              variant="outlined"
              startIcon={<PlaylistAddOutlinedIcon />}
              onClick={() => onAddToPlanner(resource)}
              sx={{ minWidth: 0, fontSize: TEXT_LABEL }}
            >
              {t('Planner', 'Planifier', 'Planer')}
            </AppButton>
            <AppButton
              size="small"
              variant="outlined"
              startIcon={<Inventory2OutlinedIcon />}
              onClick={() => onAddToInventory(resource)}
              sx={{ minWidth: 0, fontSize: TEXT_LABEL }}
            >
              {t('Inventory', 'Inventaire', 'Inventar')}
            </AppButton>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ p: 1.75 }}>
        <Stack spacing={1.25}>
          <Typography
            sx={{
              fontFamily: FONT_HEADING,
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            {t('Best Sources', 'Meilleures sources', 'Beste Quellen')}
          </Typography>
          {sortedProviders.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('No provider data available.', 'Aucune source connue.', 'Keine Quellen verfugbar.')}
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {sortedProviders.map((provider) => {
                const providerProbabilityPct = getMaterialProviderProbabilityPct(provider);
                return (
                  <Box
                    key={`${provider.providerId ?? provider.providerDisplayName}-${provider.system ?? 'unknown'}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 1,
                      alignItems: 'center',
                      py: 0.75,
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                      '&:last-of-type': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {provider.providerDisplayName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                        {provider.system ?? formatMaterialProviderType(provider.providerType, lang)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      {providerProbabilityPct != null
                        ? `${providerProbabilityPct}%`
                        : formatMaterialProviderConfidence(provider.labelConfidence, lang)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Box>

      {linkedBlueprints.length > 0 && (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Box
            sx={{
              px: 1.75,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              component="h2"
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            >
              {t('Used In', 'Utilisée dans')}
            </Typography>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.disabled' }}>
              {linkedBlueprints.length} bp
            </Typography>
          </Box>
          <Box
            sx={{
              maxHeight: 220,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: (th) => `${alpha(th.palette.primary.main, 0.25)} transparent`,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: (th) => alpha(th.palette.primary.main, 0.25), borderRadius: 99 },
            }}
          >
            {linkedBlueprints.map((blueprint) => (
              <Box
                key={blueprint.id}
                component="button"
                type="button"
                aria-label={`${t('Open blueprint', 'Ouvrir le blueprint')} ${blueprint.name}`}
                onClick={() => onOpenBlueprint(blueprint)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 14px',
                  alignItems: 'center',
                  gap: 0.75,
                  width: '100%',
                  px: 1.75,
                  py: 0.75,
                  textAlign: 'left',
                  bgcolor: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  color: 'text.primary',
                  transition: 'background-color 120ms',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: (th) => alpha(th.palette.primary.main, 0.07) },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 600,
                      fontSize: TEXT_LABEL_LG,
                      lineHeight: 1.25,
                      color: 'text.primary',
                    }}
                  >
                    {blueprint.name}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{
                      fontFamily: FONT_MONO,
                      fontSize: TEXT_LABEL_SM,
                      color: 'text.secondary',
                    }}
                  >
                    {loc(CATEGORY_LABELS[blueprint.category], lang)}
                  </Typography>
                </Box>
                <ChevronRightOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
              </Box>
            ))}
          </Box>
        </Box>
      )}
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
      <AppButton
        variant="ghost"
        startIcon={<AppGlyph name="arrow-left" size={18} />}
        onClick={onBack}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('Back to resources', 'Retour aux ressources')}
      </AppButton>

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
                <AppChip
                  label={getResourceFamilyLabel(resource.visualKind as ResourceFamilyFilter, lang)}
                  size="small"
                />
              )}
              {(insight?.sourceMethods ?? []).map((sourceMethod) => (
                <AppChip
                  key={sourceMethod}
                  label={formatMaterialSourceMethod(sourceMethod, lang)}
                  size="small"
                  variant="outlined"
                />
              ))}
              <AppChip
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
              component="h1"
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '2.4rem' },
                lineHeight: 0.95,
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
                  <AppChip
                    label={`${t('Collected', 'Collecte')}: ${
                      craftDemandUnit === 'mixed'
                        ? resourceProgress.collected.toFixed(2)
                        : formatResourceQuantity(resourceProgress.collected, craftDemandUnit, lang, 'long')
                    }`}
                  />
                  {resourceProgress.method && (
                    <AppChip label={`${t('Method', 'Methode')}: ${resourceProgress.method}`} variant="outlined" />
                  )}
                </Stack>
              </Stack>
            </>
          )}

          {resource.visualNotes && (
            <>
              <Divider />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
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
          <Typography component="h2" variant="overline">{t('Best Sources', 'Meilleures sources')}</Typography>
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
                                  {provider.system && <AppChip size="small" variant="outlined" label={provider.system} />}
                                </Stack>
                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                  <AppChip
                                    size="small"
                                    variant="outlined"
                                    label={formatMaterialProviderType(provider.providerType, lang)}
                                  />
                                  {provider.sourceMethod && (
                                    <AppChip
                                      size="small"
                                      variant="outlined"
                                      label={formatMaterialSourceMethod(provider.sourceMethod, lang)}
                                    />
                                  )}
                                  {provider.mineableGroupName && (
                                    <AppChip
                                      size="small"
                                      variant="outlined"
                                      label={formatMineableGroupName(provider.mineableGroupName)}
                                    />
                                  )}
                                </Stack>
                              </Stack>
                              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                {providerProbabilityPct != null && (
                                  <AppChip
                                    size="small"
                                    label={`${t('Share', 'Part')}: ${providerProbabilityPct}%`}
                                  />
                                )}
                                {provider.tier && (
                                  <AppChip
                                    size="small"
                                    variant="outlined"
                                    label={`${t('Tier', 'Tier')}: ${provider.tier}`}
                                  />
                                )}
                                <AppChip
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
          <Typography component="h2" variant="overline">{t('Mission Demand', 'Demande mission')}</Typography>
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
                    component="a"
                    href={missionPathFromSlug(missionSlug)}
                    onClick={(event) => {
                      if (!shouldHandleInternalLinkClick(event)) return;
                      event.preventDefault();
                      navigateToPath(missionPathFromSlug(missionSlug), {
                        missionSlug,
                        mainView: 'missions',
                      });
                    }}
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
                        <AppChip
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
                        <AppChip size="small" variant="outlined" label={standingSummary} />
                      )}
                      {blueprintDropChance > 0 && (
                        <AppChip
                          size="small"
                          variant="outlined"
                          label={`${formatProbabilityPercent(blueprintDropChance)} ${t('chance', 'chance')}`}
                        />
                      )}
                      {objective && (
                        <AppChip
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
            <Typography component="h2" variant="overline">{t('Used In Blueprints', 'Utilisee dans les blueprints')}</Typography>
          </Stack>
          {categoryOptions.length > 1 && (
            <Box
              role="group"
              aria-label={t('Filter blueprints by category', 'Filtrer les blueprints par catégorie')}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
            >
              <AppButton
                size="sm"
                variant={categoryFilter === 'all' ? 'primary' : 'secondary'}
                ariaPressed={categoryFilter === 'all'}
                onClick={() => setCategoryFilter('all')}
                sx={{ fontSize: TEXT_LABEL }}
              >
                {t('All', 'Toutes')}
              </AppButton>
              {categoryOptions.map((category) => (
                <AppButton
                  key={category}
                  size="sm"
                  variant={categoryFilter === category ? 'primary' : 'secondary'}
                  ariaPressed={categoryFilter === category}
                  onClick={() => setCategoryFilter(category)}
                  sx={{ fontSize: TEXT_LABEL }}
                >
                  {loc(CATEGORY_LABELS[category], lang)}
                </AppButton>
              ))}
            </Box>
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
                isActive={false}
                isFavorite={favoriteIds.includes(blueprint.id)}
                isInInventory={inventoryIds.includes(blueprint.id)}
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
  const resources = useMemo(
    () => activeDataset.resources.filter((resource) => !isPlaceholderResource(resource)),
    [activeDataset.resources],
  );
  const [localInventoryResources, setLocalInventoryResources] = useState(() =>
    readLocalInventoryResources(),
  );

  const [selectedResourceSlug, setSelectedResourceSlug] = useState<string | null>(() =>
    resourceSlugFromPathname(window.location.pathname),
  );
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<ResourceFamilyFilter>('all');
  const [systemFilter] = useState<string | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<ResourceSourceTypeFilter>('all');
  const [missionFilter] = useState<ResourceMissionFilter>('all');
  const [blueprintCategoryFilter] = useState<ItemCategory | null>(null);
  const [sortBy, setSortBy] = useState<ResourceSort>('name-asc');
  const [previewResourceId, setPreviewResourceId] = useState<string | null>(null);
  const [inventoryDialog, setInventoryDialog] = useState<ResourceInventoryDialogState | null>(null);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setLocalInventoryResources(readLocalInventoryResources());
    }
  }, [account]);

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

  const visibleResourceIds = useMemo(() => new Set(resources.map((resource) => resource.id)), [resources]);
  const visibleResourceInsights = useMemo(
    () => resourceInsights.filter((insight) => visibleResourceIds.has(insight.resourceId)),
    [resourceInsights, visibleResourceIds],
  );

  const resourceInsightById = useMemo(
    () => new Map(visibleResourceInsights.map((insight) => [insight.resourceId, insight])),
    [visibleResourceInsights],
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
    if (!inventoryDialog) {
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
      const nextEntry = {
        id: globalThis.crypto.randomUUID(),
        resourceId: inventoryDialog.resourceId,
        resourceName: inventoryDialog.resourceName,
        quantity: normalizedQuantity,
        quantityUnit: inventoryDialog.quantityUnit,
        quality: normalizedQuality ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      if (account) {
        await updateInventoryResources([
          ...(account.inventoryResources ?? []),
          nextEntry,
        ]);
      } else {
        const nextLocalInventoryResources = writeLocalInventoryResources([
          ...localInventoryResources,
          nextEntry,
        ]);
        setLocalInventoryResources(nextLocalInventoryResources);
      }
      setInventoryDialog(null);
      setInventoryNotice(
        t(
          account
            ? `${inventoryDialog.resourceName} was added to the account inventory.`
            : `${inventoryDialog.resourceName} was added to the local inventory.`,
          account
            ? `${inventoryDialog.resourceName} a ete ajoutee a l inventaire du compte.`
            : `${inventoryDialog.resourceName} a ete ajoutee a l inventaire local.`,
          account
            ? `${inventoryDialog.resourceName} wurde dem Konto-Inventar hinzugefugt.`
            : `${inventoryDialog.resourceName} wurde dem lokalen Inventar hinzugefugt.`,
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
  const renderedResources = filteredResources.slice(0, visibleCount);
  const previewResource =
    renderedResources.find((resource) => resource.id === previewResourceId) ??
    renderedResources[0] ??
    null;
  const previewInsight = previewResource
    ? resourceInsightById.get(previewResource.id) ?? null
    : null;
  const previewProviders = useMemo(
    () => (previewResource ? getMaterialProviders(materialSources, previewResource.id) : []),
    [materialSources, previewResource],
  );
  const previewLinkedBlueprints = useMemo(() => {
    if (!previewInsight) return [];
    const idSet = new Set(previewInsight.blueprintIds);
    return blueprints.filter((bp) => idSet.has(bp.id));
  }, [blueprints, previewInsight]);

  useEffect(() => {
    if (!previewResourceId && filteredResources.length > 0) {
      setPreviewResourceId(filteredResources[0].id);
      return;
    }
    if (
      previewResourceId &&
      filteredResources.length > 0 &&
      !filteredResources.some((resource) => resource.id === previewResourceId)
    ) {
      setPreviewResourceId(filteredResources[0].id);
    }
  }, [filteredResources, previewResourceId]);

  const openResourceDetail = (resource: Resource) => {
    setSelectedResourceSlug(resource.id);
    navigateToPath(resourcePathFromSlug(resource.id), {
      resourceId: resource.id,
      mainView: 'resources',
    });
  };

  const addResourceToPlanner = (resource: Resource) => {
    addPlannerResourceRequirement(
      resource.name,
      1,
      resourcePlannerUnitById.get(resource.id) ?? 'scu',
    );
  };

  const resourceStats = useMemo(() => {
    const systemCount = new Set(visibleResourceInsights.flatMap((insight) => insight.systems)).size;
    const missionLinkedCount = visibleResourceInsights.filter(
      (insight) => insight.missionObjectiveContractCount > 0,
    ).length;
    const providerCount =
      materialSources?.summary?.providerCount ??
      visibleResourceInsights.reduce((sum, insight) => sum + insight.providerCount, 0);

    return {
      resourceCount: resources.length,
      systemCount,
      missionLinkedCount,
      providerCount,
    };
  }, [materialSources, resources.length, visibleResourceInsights]);

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
      <PageLayout
        width="wide"
        sx={{ animation: 'if-fade-in 280ms cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: '300px minmax(0, 1fr)' },
            gap: 'var(--workspace-gap)',
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
                bgcolor: 'ui.surface',
                borderColor: 'ui.border',
                borderRadius: 2,
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <ResourceFact label={t('Systems', 'Systèmes')} value={(selectedInsight?.systems ?? []).join(', ') || '—'} />
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
      </PageLayout>
    );
  }

  const tableHeaderCellSx = {
    fontFamily: FONT_MONO,
    fontSize: TEXT_LABEL_SM,
    color: 'text.secondary',
    fontWeight: 600,
    borderColor: 'ui.border',
  };

  return (
    <PageLayout
      width="wide"
      sx={{ animation: 'if-fade-in 280ms cubic-bezier(0.22,1,0.36,1) both' }}
    >
      <PageHeader
        eyebrow={t('Dataset', 'Dataset')}
        title={t('Resources', 'Ressources')}
        description={t(
          'Browse material demand, provider coverage and mission pull across the published dataset.',
          'Parcourez la demande en matériaux, la couverture des sources et la pression mission du dataset publié.',
        )}
        stats={
          <>
            <PageStatCard label={t('Resources', 'Ressources')} value={String(resourceStats.resourceCount)} domain="green" />
            <PageStatCard label={t('Systems', 'Systèmes')} value={String(resourceStats.systemCount)} domain="cyan" />
            <PageStatCard label={t('Mission-linked', 'Liées aux missions')} value={String(resourceStats.missionLinkedCount)} domain="blue" />
            <PageStatCard label={t('Providers', 'Sources')} value={String(resourceStats.providerCount)} domain="cyan" />
          </>
        }
      />

      {(inventoryNotice || inventoryError) && (
        <AppAlert severity={inventoryError ? 'error' : 'success'}>
          {inventoryError ?? inventoryNotice}
        </AppAlert>
      )}

      <ResponsiveFilters
        title={t('Resource filters and sorting', 'Filtres et tri des ressources')}
        triggerLabel={t('Filters and sort', 'Filtres et tri')}
        closeLabel={t('Show results', 'Afficher les résultats')}
        dismissLabel={t('Close filters', 'Fermer les filtres')}
        summary={
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {getResourceFamilyLabel(familyFilter, lang)} · {getSourceTypeLabel(sourceTypeFilter, lang)} ·{' '}
            {loc(RESOURCE_SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? RESOURCE_SORT_OPTIONS[0].label, lang)}
          </Typography>
        }
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 1.5,
            flexWrap: 'wrap',
            p: 1.5,
            bgcolor: 'ui.surface',
            border: '1px solid',
            borderColor: 'ui.border',
            borderRadius: 2,
          }}
        >
          <AppTextField
            type="search"
            placeholder={t('Search resources...', 'Rechercher des ressources...')}
            value={search}
            onValueChange={setSearch}
            ariaLabel={t('Search resources', 'Rechercher des ressources')}
            sx={{ height: 34, fontSize: TEXT_LABEL_LG }}
            fieldSx={{ flex: '1 1 200px', minWidth: 0 }}
          />
          <Box
            role="group"
            aria-label={t('Filter by resource family', 'Filtrer par famille de ressource')}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
          >
            {(['all', 'metal', 'mineral', 'crystal', 'ice', 'crafting-slot'] as ResourceFamilyFilter[]).map((family) => (
              <AppButton
                key={family}
                size="sm"
                variant={familyFilter === family ? 'primary' : 'secondary'}
                ariaPressed={familyFilter === family}
                onClick={() => setFamilyFilter(family)}
                sx={{ fontSize: TEXT_LABEL }}
              >
                {getResourceFamilyLabel(family, lang)}
              </AppButton>
            ))}
          </Box>
          <Box
            role="group"
            aria-label={t('Filter by source type', 'Filtrer par type de source')}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
          >
            {(['all', 'planetary', 'asteroid'] as ResourceSourceTypeFilter[]).map((type) => (
              <AppButton
                key={type}
                size="sm"
                variant={sourceTypeFilter === type ? 'primary' : 'secondary'}
                ariaPressed={sourceTypeFilter === type}
                onClick={() => setSourceTypeFilter(type)}
                sx={{ fontSize: TEXT_LABEL }}
              >
                {getSourceTypeLabel(type, lang)}
              </AppButton>
            ))}
          </Box>
          <AppSelect<ResourceSort>
            label={t('Sort resources', 'Trier les ressources')}
            value={sortBy}
            options={RESOURCE_SORT_OPTIONS.map((option) => ({ value: option.value, label: loc(option.label, lang) }))}
            onValueChange={(value) => value && setSortBy(value)}
            sx={{ minWidth: 170, height: 34, fontSize: TEXT_LABEL_LG }}
            fieldSx={{ minWidth: { xs: 0, md: 170 } }}
            partSx={{ input: { py: 0.5 }, trigger: { width: 32 } }}
          />
        </Box>
      </ResponsiveFilters>

      {/* Resource list */}
      {resourceDataLoading && resources.length === 0 ? (
        <SurfaceState
          tone="loading"
          title={t('Loading resources', 'Chargement des ressources')}
          description={t('Preparing material and provider data.', 'Préparation des données de matériaux et de sources.')}
        />
      ) : filteredResources.length === 0 ? (
        <SurfaceState
          icon={<ImageNotSupportedOutlinedIcon sx={{ fontSize: '2rem' }} />}
          title={t('No resource matches the current filters.', 'Aucune ressource ne correspond aux filtres actuels.')}
          description={t('Broaden the search or clear one of the active filters.', 'Élargissez la recherche ou retirez un des filtres actifs.')}
        />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 280px' },
              gap: { xs: 1.5, lg: 2 },
              alignItems: 'flex-start',
            }}
          >
            {/* Desktop table */}
            <Paper
              variant="outlined"
              sx={{ bgcolor: 'ui.surface', borderColor: 'ui.border', borderRadius: 2, overflow: 'hidden', display: { xs: 'none', md: 'block' } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'ui.border', bgcolor: 'background.paper' }}>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
                  {filteredResources.length} {t('resources', 'ressources')}
                </Typography>
              </Box>
              <Table size="small" sx={{ tableLayout: 'fixed', '& th, & td': { px: 1, overflowWrap: 'anywhere' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell component="th" scope="col" sx={{ ...tableHeaderCellSx, width: '30%' }}>{t('Material', 'Matériau')}</TableCell>
                    <TableCell component="th" scope="col" sx={{ ...tableHeaderCellSx, display: { xs: 'none', md: 'table-cell' } }}>{t('Family', 'Famille')}</TableCell>
                    <TableCell component="th" scope="col" sx={{ ...tableHeaderCellSx, display: { xs: 'none', lg: 'table-cell' } }}>{t('Source', 'Source')}</TableCell>
                    <TableCell component="th" scope="col" sx={tableHeaderCellSx}>{t('Providers', 'Sources')}</TableCell>
                    <TableCell component="th" scope="col" sx={tableHeaderCellSx}>{t('Missions', 'Missions')}</TableCell>
                    <TableCell component="th" scope="col" sx={tableHeaderCellSx}>{t('Blueprints', 'Blueprints')}</TableCell>
                    <TableCell component="th" scope="col" sx={{ ...tableHeaderCellSx, textAlign: 'right', width: 110 }}>{t('Actions', 'Actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {renderedResources.map((resource) => {
                    const insight = resourceInsightById.get(resource.id) ?? null;
                    const isSelected = previewResource?.id === resource.id;
                    return (
                      <TableRow
                        key={resource.id}
                        hover
                        sx={{
                          borderLeft: '2px solid',
                          borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                          bgcolor: isSelected ? (th) => alpha(th.palette.primary.main, 0.06) : 'transparent',
                          '&:hover': { bgcolor: (th) => alpha(th.palette.primary.main, 0.06) },
                          '& td': { borderColor: 'ui.border' },
                        }}
                      >
                        <TableCell sx={{ borderColor: 'ui.border' }}>
                          <AppButton
                            href={resourcePathFromSlug(resource.id)}
                            variant="ghost"
                            ariaLabel={t(`Open ${resource.name} details`, `Ouvrir les détails de ${resource.name}`)}
                            onClick={(event) => {
                              if (!shouldHandleInternalLinkClick(event)) return;
                              event.preventDefault();
                              openResourceDetail(resource);
                            }}
                            sx={{ width: '100%', justifyContent: 'flex-start', p: 0, textAlign: 'left' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 1,
                                  bgcolor: alpha(resource.color, 0.12),
                                  color: resource.color,
                                  border: `1px solid ${alpha(resource.color, 0.35)}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  overflow: 'hidden',
                                }}
                              >
                                {resource.visual?.imageUrl ? (
                                  <CardMedia
                                    component="img"
                                    image={resource.visual.imageUrl}
                                    alt=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <ResourceIcon name={resource.name} size={18} shimmer={false} />
                                )}
                              </Box>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }} noWrap>
                                  {resource.name}
                                </Typography>
                                {resource.description && (
                                  <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }} noWrap>
                                    {resource.description}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </AppButton>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'ui.border', display: { xs: 'none', md: 'table-cell' } }}>
                          <ResourceFamilyChip resource={resource} />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'ui.border', display: { xs: 'none', lg: 'table-cell' } }}>
                          {(insight?.sourceMethods ?? []).length > 0 ? (
                            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                              {(insight?.sourceMethods ?? []).map((method) => (
                                <AppChip
                                  key={method}
                                  size="small"
                                  variant="outlined"
                                  label={formatMaterialSourceMethod(method, lang)}
                                  sx={{ height: 20, px: 0.75, fontSize: TEXT_LABEL_SM }}
                                />
                              ))}
                            </Stack>
                          ) : (
                            <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.875rem', color: 'text.disabled' }}>—</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'ui.border' }}>
                          <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.875rem' }}>
                            {insight?.providerCount ?? 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'ui.border' }}>
                          <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.875rem' }}>
                            {insight?.missionObjectiveContractCount ?? 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'ui.border' }}>
                          <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.875rem' }}>
                            {insight?.blueprintUsageCount ?? 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'ui.border' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <AppTooltip content={t('Preview resource', 'Prévisualiser la ressource')}>
                              <IconButton
                                size="small"
                                aria-label={t(`Preview ${resource.name}`, `Prévisualiser ${resource.name}`)}
                                aria-pressed={isSelected}
                                onClick={() => setPreviewResourceId(resource.id)}
                                sx={{ display: { xs: 'none', lg: 'inline-flex' }, color: isSelected ? 'primary.main' : 'text.disabled', '&:hover': { color: 'primary.main' } }}
                              >
                                <ScienceOutlinedIcon sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            </AppTooltip>
                            <AppTooltip content={t('Add to planner', 'Ajouter au planificateur')}>
                              <IconButton
                                size="small"
                                aria-label={t(`Add ${resource.name} to planner`, `Ajouter ${resource.name} au planificateur`)}
                                onClick={() => addResourceToPlanner(resource)}
                                sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                              >
                                <PlaylistAddOutlinedIcon sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            </AppTooltip>
                            <AppTooltip content={t('Open resource detail', 'Ouvrir la fiche ressource')}>
                              <IconButton
                                size="small"
                                aria-label={t(`Open ${resource.name} details`, `Ouvrir les détails de ${resource.name}`)}
                                onClick={() => openResourceDetail(resource)}
                                sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                              >
                                <ChevronRightOutlinedIcon sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            </AppTooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>

            {/* Mobile list */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <ResourceMobileList
                resources={renderedResources}
                resourceInsightById={resourceInsightById}
                onOpen={openResourceDetail}
                onAddToPlanner={addResourceToPlanner}
                onAddToInventory={openInventoryDialog}
              />
            </Box>

            {/* Preview panel */}
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <ResourcePreviewPanel
                resource={previewResource}
                insight={previewInsight}
                providers={previewProviders}
                linkedBlueprints={previewLinkedBlueprints}
                onOpen={openResourceDetail}
                onAddToPlanner={addResourceToPlanner}
                onAddToInventory={openInventoryDialog}
                onOpenBlueprint={setActiveBlueprint}
              />
            </Box>
          </Box>
          {visibleCount < filteredResources.length && (
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
          )}
        </>
      )}

      <AppDialog
        open={Boolean(inventoryDialog)}
        onOpenChange={(open) => {
          if (!open) closeInventoryDialog();
        }}
        title={
          inventoryDialog
            ? t(
                `Add ${inventoryDialog.resourceName} to inventory`,
                `Ajouter ${inventoryDialog.resourceName} a l inventaire`,
                `${inventoryDialog.resourceName} zum Inventar hinzufugen`,
              )
            : t('Add resource to inventory', 'Ajouter la ressource a l inventaire')
        }
        closeLabel={t('Close inventory dialog', 'Fermer la fenêtre d inventaire')}
        dismissable={!inventoryBusy}
        width="min(28rem, calc(100vw - 2rem))"
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <AppButton variant="secondary" onClick={closeInventoryDialog} disabled={inventoryBusy}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </AppButton>
            <AppButton variant="primary" onClick={() => { void submitInventoryDialog(); }} disabled={inventoryBusy}>
              {inventoryBusy
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Add entry', 'Ajouter l entree', 'Eintrag hinzufugen')}
            </AppButton>
          </Box>
        }
      >
        <Stack spacing={2}>
          {inventoryError && (
            <AppAlert severity="error">
              {inventoryError}
            </AppAlert>
          )}

          <AppTextField
            label={t('Quantity', 'Quantite', 'Menge')}
            type="number"
            value={String(inventoryDialog?.quantity ?? '')}
            onValueChange={(value) => {
              const nextQuantity = Number(value);
              setInventoryDialog((current) =>
                current
                  ? {
                      ...current,
                      quantity: Number.isFinite(nextQuantity) ? nextQuantity : current.quantity,
                    }
                  : current,
              );
            }}
            ariaLabel={`${t('Quantity', 'Quantite', 'Menge')} (${inventoryDialog?.quantityUnit === 'count' ? t('items', 'objets', 'Teile') : 'SCU'})`}
          />

          <AppTextField
            label={t('Quality (optional)', 'Qualite (optionnelle)', 'Qualitat (optional)')}
            type="number"
            value={inventoryDialog?.quality ?? ''}
            onValueChange={(value) => {
              setInventoryDialog((current) =>
                current
                  ? {
                      ...current,
                      quality: value,
                    }
                  : current,
              );
            }}
            ariaLabel={t('Quality (optional)', 'Qualite (optionnelle)', 'Qualitat (optional)')}
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
      </AppDialog>
    </PageLayout>
  );
}
