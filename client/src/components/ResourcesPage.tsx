import { Box, Divider, Paper, Stack, Typography, alpha, useTheme } from '../ui/system';
import { Card, CardActionArea, CardMedia } from './ui/primitives';
import { AppChip } from './ui/data-display/AppChip';
import { AppAlert } from './ui/feedback';
import { ImageNotSupportedOutlinedIcon, Inventory2OutlinedIcon, PlaylistAddOutlinedIcon, ChevronRightOutlinedIcon, RouteOutlinedIcon, ScienceOutlinedIcon, ViewInArOutlinedIcon } from '../ui/icons';
import { useEffect, useMemo, useState } from 'react';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { BlueprintCard } from './BlueprintGrid';
import { AppGlyph } from './ui/AppGlyph';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { ScaleBadge } from './ui/RarityBadge';
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
import { FONT_HEADING, TEXT_LABEL } from '../theme';
import { AppButton } from './ui/controls/AppButton';
import { AppSelect } from './ui/controls/AppSelect';
import { AppTextField } from './ui/controls/AppTextField';
import { SurfaceState } from './ui/feedback/SurfaceState';
import { AppDialog } from './ui/overlays/AppDialog';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import './resources/resources.css';

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
  craftDemandQuantity: number | null;
  craftDemandCoverage: { loaded: number; total: number } | null;
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
  if (!resource.visualKind) return null;

  return (
    <AppChip
      size="small"
      variant="outlined"
      label={getResourceFamilyLabel(resource.visualKind as ResourceFamilyFilter, lang)}
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

function ResourceMobileList({ resources, resourceInsightById, onOpen }: {
  resources: Resource[];
  resourceInsightById: Map<string, ResourceInsight>;
  onOpen: (resource: Resource) => void;
}) {
  const { t, lang } = useI18n();
  return <div className="resource-register" role="list">
    {resources.map((resource) => {
      const insight = resourceInsightById.get(resource.id);
      return <div key={resource.id} role="listitem">
        <button type="button" className="resource-register-row" onClick={() => onOpen(resource)}
          aria-label={t(`Open ${resource.name} details`, `Ouvrir les détails de ${resource.name}`, `${resource.name} öffnen`)}>
          <ResourceThumbnail resource={resource} size={48} />
          <span className="resource-register-identity"><strong>{resource.name}</strong>
            <span>{[resource.visualKind && getResourceFamilyLabel(resource.visualKind as ResourceFamilyFilter, lang), insight?.systems.join(', ') || t('Location unknown', 'Lieu inconnu', 'Ort unbekannt')].filter(Boolean).join(' · ')}</span>
          </span>
          <ChevronRightOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        </button>
      </div>;
    })}
  </div>;
}

function ResourcePreviewPanel({ resource, insight, providers, linkedBlueprints, onOpen, onAddToPlanner, onAddToInventory, onOpenBlueprint }: {
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
  if (!resource) return null;
  const bestProviders = [...providers].sort((left, right) =>
    (getMaterialProviderProbabilityPct(right) ?? -1) - (getMaterialProviderProbabilityPct(left) ?? -1)
    || String(left.providerDisplayName ?? '').localeCompare(String(right.providerDisplayName ?? '')),
  ).slice(0, 3);
  return <aside className="resource-inspector" aria-label={t(`${resource.name} preview`, `Aperçu de ${resource.name}`, `${resource.name} Vorschau`)}>
    <div className="resource-inspector-identity">
      <ResourceThumbnail key={resource.id} resource={resource} size={92} />
      <div><ResourceFamilyChip resource={resource} /><h2>{resource.name}</h2>
        <ResourceSystemsChips systems={insight?.systems ?? []} />
      </div>
    </div>
    <div className="resource-inspector-section">
      <div className="resource-section-heading"><h3>{t('Where to find it', 'Où la trouver', 'Fundorte')}</h3>
        <span>{providers.length} {t('sources', 'sources', 'Quellen')}</span>
      </div>
      {bestProviders.length ? <div className="resource-shortlist">{bestProviders.map((provider, index) => {
        const icon = getMaterialProviderIconName(provider.providerType, provider.providerDisplayName, provider.system);
        const share = getMaterialProviderProbabilityPct(provider);
        return <div className="resource-shortlist-row" key={`${provider.providerId ?? provider.providerDisplayName}-${index}`}>
          <span className="resource-source-icon">{icon ? <StarCitizenLicensedIcon name={icon} size={24} /> : <ScienceOutlinedIcon />}</span>
          <div><strong>{provider.providerDisplayName}</strong><small>{[provider.system, provider.sourceMethod && formatMaterialSourceMethod(provider.sourceMethod, lang)].filter(Boolean).join(' · ')}</small></div>
          {share != null && <span className="resource-share" title={t('Resource share', 'Part de la ressource', 'Ressourcenanteil')}>{share}%</span>}
        </div>;
      })}</div> : <p className="resource-muted">{t('No known source yet.', 'Aucune source connue pour le moment.', 'Noch keine bekannte Quelle.')}</p>}
      <AppButton fullWidth variant="primary" href={resourcePathFromSlug(resource.id)} onClick={(event) => {
        if (!shouldHandleInternalLinkClick(event)) return;
        event.preventDefault();
        onOpen(resource);
      }} endIcon={<ChevronRightOutlinedIcon />}>
        {t('Open resource guide', 'Ouvrir la fiche ressource', 'Ressourcenübersicht öffnen')}
      </AppButton>
    </div>
    <div className="resource-inspector-actions">
      <AppButton variant="secondary" size="sm" startIcon={<PlaylistAddOutlinedIcon />} onClick={() => onAddToPlanner(resource)}>{t('Plan collection', 'Planifier la collecte', 'Sammlung planen')}</AppButton>
      <AppButton variant="ghost" size="sm" startIcon={<Inventory2OutlinedIcon />} onClick={() => onAddToInventory(resource)}>{t('Add to inventory', 'Ajouter au stock', 'Zum Bestand')}</AppButton>
    </div>
    <details key={resource.id} className="resource-disclosure">
      <summary>{t('Uses & properties', 'Usages et propriétés', 'Verwendung & Eigenschaften')}<span>{insight?.blueprintUsageCount ?? 0} bp · {insight?.missionObjectiveContractCount ?? 0} {t('missions', 'missions', 'Missionen')}</span></summary>
      <div className="resource-disclosure-content"><p className="resource-muted">{resource.description || t('No description available.', 'Aucune description disponible.', 'Keine Beschreibung verfügbar.')}</p>
        <div className="resource-fact-line"><span>{t('Systems', 'Systèmes', 'Systeme')}</span><strong>{insight?.systems.length ?? 0}</strong></div>
        {linkedBlueprints.length > 0 && <div className="resource-linked-items">{linkedBlueprints.map((blueprint) => <AppButton key={blueprint.id} variant="ghost" size="sm" onClick={() => onOpenBlueprint(blueprint)} endIcon={<ChevronRightOutlinedIcon />} sx={{ justifyContent: 'space-between', width: '100%', textAlign: 'left' }}>{blueprint.name}</AppButton>)}</div>}
      </div>
    </details>
  </aside>;
}

function ResourceIdentityPanel({ resource, insight, resourceProgress, craftDemandQuantity, craftDemandCoverage, craftDemandUnit, onBack }: ResourceIdentityPanelProps) {
  const { t, lang } = useI18n();
  const amount = craftDemandQuantity == null ? null : new Intl.NumberFormat(lang, { maximumFractionDigits: 4 }).format(craftDemandQuantity);
  const quantityLabel = amount == null ? t('Unknown', 'Inconnu', 'Unbekannt')
    : craftDemandUnit === 'scu' ? `${amount} SCU`
      : craftDemandUnit === 'count' ? `${amount} ${t('items', 'objets', 'Teile')}`
        : `${amount} ${t('mixed', 'mixte', 'gemischt')}`;
  const craftDemandLabel = craftDemandCoverage
    ? `${quantityLabel} · ${t(
        `${craftDemandCoverage.loaded}/${craftDemandCoverage.total} recipes loaded`,
        `${craftDemandCoverage.loaded}/${craftDemandCoverage.total} recettes chargées`,
        `${craftDemandCoverage.loaded}/${craftDemandCoverage.total} Rezepte geladen`,
      )}${craftDemandQuantity == null ? '' : ` (${t('partial', 'partiel', 'teilweise')})`}`
    : quantityLabel;
  return <Stack spacing={1.25}>
    <AppButton variant="ghost" size="sm" startIcon={<AppGlyph name="arrow-left" size={18} />} onClick={onBack} sx={{ alignSelf: 'flex-start' }}>
      {t('Back to resources', 'Retour aux ressources', 'Zurück zu Ressourcen')}
    </AppButton>
    <section className="resource-detail-identity">
      <ResourceThumbnail key={resource.id} resource={resource} size={132} />
      <div className="resource-detail-title"><ResourceFamilyChip resource={resource} /><h1>{resource.name}</h1>
        <ResourceSystemsChips systems={insight?.systems ?? []} />
        <p className="resource-muted">{(insight?.sourceMethods ?? []).map((method) => formatMaterialSourceMethod(method, lang)).join(' · ')}</p>
      </div>
    </section>
    {resourceProgress && <div className="resource-progress-summary"><Inventory2OutlinedIcon />
      <div><strong>{craftDemandUnit === 'mixed' ? resourceProgress.collected.toFixed(2) : formatResourceQuantity(resourceProgress.collected, craftDemandUnit, lang, 'long')} {t('collected', 'collectés', 'gesammelt')}</strong>
        {resourceProgress.method && <small>{resourceProgress.method}</small>}
      </div>
    </div>}
    <details className="resource-disclosure">
      <summary>{t('Properties & uses', 'Propriétés et usages', 'Eigenschaften & Verwendung')}</summary>
      <div className="resource-disclosure-content">
        {resource.description && <p className="resource-muted">{resource.description}</p>}
        {[
          [t('Sources', 'Sources', 'Quellen'), String(insight?.providerCount ?? 0)],
          [t('Systems', 'Systèmes', 'Systeme'), (insight?.systems ?? []).join(', ') || '—'],
          [t('Missions', 'Missions', 'Missionen'), String(insight?.missionObjectiveContractCount ?? 0)],
          [t('Blueprints', 'Blueprints', 'Blueprints'), String(insight?.blueprintUsageCount ?? 0)],
          [t('Combined blueprint demand', 'Cumul des recettes', 'Gesamtbedarf der Rezepte'), craftDemandLabel],
          [t('Mission employers', 'Employeurs des missions', 'Auftraggeber'), (insight?.missionEmployers ?? []).join(', ') || '—'],
          [t('Source types', 'Types de sources', 'Quellentypen'), (insight?.providerTypes ?? []).map((type) => type === 'other' ? t('Other', 'Autres', 'Andere') : getSourceTypeLabel(type, lang)).join(', ') || '—'],
        ].map(([label, value]) => <div className="resource-fact-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        {resource.visualNotes && <p className="resource-muted resource-visual-note">{resource.visualNotes}</p>}
      </div>
    </details>
  </Stack>;
}

function ResourceSourcesSection({ providers, hasMaterialSourceData }: { providers: MaterialSourceProvider[]; hasMaterialSourceData: boolean }) {
  const { t, lang } = useI18n();
  const groupedProviders = useMemo(() => {
    const groups = new Map<'planetary' | 'asteroid' | 'other', MaterialSourceProvider[]>();
    for (const provider of providers) {
      const type = simplifyProviderType(provider.providerType);
      groups.set(type, [...(groups.get(type) ?? []), provider]);
    }
    return [...groups.entries()].map(([type, list]) => [type, [...list].sort((a, b) =>
      (getMaterialProviderProbabilityPct(b) ?? -1) - (getMaterialProviderProbabilityPct(a) ?? -1)
      || String(a.providerDisplayName ?? '').localeCompare(String(b.providerDisplayName ?? '')),
    )] as const).sort(([a], [b]) => a.localeCompare(b));
  }, [providers]);
  return <section className="resource-source-section">
    {!hasMaterialSourceData ? <DatasetTooOldNotice /> : !providers.length
      ? <SurfaceState icon={<ScienceOutlinedIcon />} title={t('No known source', 'Aucune source connue', 'Keine bekannte Quelle')} description={t('Check missions and blueprints for other uses of this resource.', 'Consultez les missions et blueprints pour les autres usages de cette ressource.', 'Missionen und Blueprints zeigen weitere Verwendungen dieser Ressource.')} />
      : groupedProviders.map(([type, list]) => <div key={type} className="resource-source-group">
        <div className="resource-section-heading"><h2>{type === 'asteroid' ? t('Asteroids', 'Astéroïdes', 'Asteroiden') : type === 'planetary' ? t('Planets & moons', 'Planètes et lunes', 'Planeten & Monde') : t('Other sources', 'Autres sources', 'Andere Quellen')}</h2><span>{list.length}</span></div>
        {list.map((provider, index) => {
          const icon = getMaterialProviderIconName(provider.providerType, provider.providerDisplayName, provider.system);
          const share = getMaterialProviderProbabilityPct(provider);
          return <details className="resource-source-row" key={`${provider.providerId ?? provider.providerDisplayName}-${index}`}>
            <summary>
              <span className="resource-source-icon">{icon ? <StarCitizenLicensedIcon name={icon} size={28} /> : <ScienceOutlinedIcon />}</span>
              <span className="resource-source-name"><strong>{provider.providerDisplayName}</strong><small>{[provider.system, provider.sourceMethod && formatMaterialSourceMethod(provider.sourceMethod, lang)].filter(Boolean).join(' · ')}</small></span>
              {share != null && <span className="resource-share"><strong>{share}%</strong><small>{t('share', 'part', 'Anteil')}</small></span>}
              <ChevronRightOutlinedIcon className="resource-disclosure-chevron" sx={{ fontSize: 18 }} />
            </summary>
            <div className="resource-disclosure-content">
              {[
                [t('Source type', 'Type de source', 'Quellentyp'), formatMaterialProviderType(provider.providerType, lang)],
                [t('Deposit', 'Gisement', 'Vorkommen'), provider.mineableGroupName ? formatMineableGroupName(provider.mineableGroupName) : null],
                [t('Tier', 'Palier', 'Stufe'), provider.tier],
                [t('Location confidence', 'Précision du lieu', 'Ortsgenauigkeit'), formatMaterialProviderConfidence(provider.labelConfidence, lang)],
              ].filter(([, value]) => value != null).map(([label, value]) => <div className="resource-fact-line" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
          </details>;
        })}
      </div>)}
  </section>;
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
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
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
  const [detailSection, setDetailSection] = useState<'sources' | 'missions' | 'blueprints'>('sources');
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
  const [plannedResourceName, setPlannedResourceName] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setLocalInventoryResources(readLocalInventoryResources());
    }
  }, [account]);

  const allContracts = useMemo<FlatMissionContract[]>(() => {
    if (!missionRewards) return [];
    return missionRewards.factionGroups.flatMap((group) =>
      (factionContractsByFactionId[group.id] ?? group.contracts ?? []).map((contract) => ({ contract, group })),
    );
  }, [missionRewards, factionContractsByFactionId]);

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
    const frame = window.requestAnimationFrame(() => {
      const main = getMainContentScrollRoot();
      main?.focus({ preventScroll: true });
      main?.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedResource?.id]);

  // New datasets expose a small resource-to-faction index; load only the
  // relevant contract chunks when the player opens the Missions section.
  const selectedMissionGroups = useMemo(() => {
    if (!selectedResource || !missionRewards) return [];
    const ids = missionRewards.resourceObjectiveIndex?.[selectedResource.id];
    if (ids) {
      const relevantIds = new Set(ids);
      return missionRewards.factionGroups.filter((group) => relevantIds.has(group.id));
    }
    return missionRewards.factionGroups;
  }, [selectedResource, missionRewards]);
  const missingMissionGroups = useMemo(() => selectedMissionGroups.filter((group) =>
    !group.contracts?.length && group.contractCount > 0 && !Object.prototype.hasOwnProperty.call(factionContractsByFactionId, group.id),
  ), [selectedMissionGroups, factionContractsByFactionId]);
  useEffect(() => {
    if (detailSection !== 'missions') return;
    for (const group of missingMissionGroups) void ensureFactionContractsLoaded(group.id);
  }, [detailSection, missingMissionGroups, ensureFactionContractsLoaded]);

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
    setDetailSection('sources');
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
    setPlannedResourceName(resource.name);
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
  const selectedCraftDemand = useMemo(() => {
    const demand = selectedResource
      ? summarizeResourceCraftDemand(selectedResource.id, selectedBlueprints)
      : { quantity: 0, quantityUnit: 'scu' as const };
    const publishedInsight = activeDataset.resourceInsights?.find((entry) => entry.resourceId === selectedResource?.id);
    // The exporter sums quantityScu before publishing the slim blueprint catalog.
    // Its positive SCU aggregate remains valid when no recipe slots are loaded.
    if (publishedInsight && Number.isFinite(publishedInsight.totalScuPerCraftSum)
      && publishedInsight.totalScuPerCraftSum > 0 && demand.quantityUnit === 'scu') {
      return { quantity: publishedInsight.totalScuPerCraftSum, quantityUnit: 'scu' as const, coverage: null };
    }
    const total = selectedInsight?.blueprintUsageCount ?? selectedBlueprints.length;
    const loaded = selectedBlueprints.filter((blueprint) => blueprint.slots.some((slot) =>
      isResourceSlot(slot) && slot.requiredResource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === selectedResource?.id,
    )).length;
    return {
      ...demand,
      quantity: loaded === 0 && total > 0 ? null : demand.quantity,
      coverage: loaded < total ? { loaded, total } : null,
    };
  }, [activeDataset.resourceInsights, selectedBlueprints, selectedInsight, selectedResource]);
  const selectedProgress =
    (selectedResource &&
      (resourceProgress[selectedResource.name] ?? resourceProgress[selectedResource.id])) ??
    null;

  const plannerNoticeView = plannedResourceName && <AppAlert severity="success">
    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" useFlexGap flexWrap="wrap">
      <span>{t(`${plannedResourceName} added to your collection plan.`, `${plannedResourceName} ajouté à votre collecte.`, `${plannedResourceName} zum Sammelplan hinzugefügt.`)}</span>
      <AppButton size="sm" variant="ghost" href="/planner#planner-production" onClick={(event) => {
        if (!shouldHandleInternalLinkClick(event)) return;
        event.preventDefault();
        navigateToPath('/planner#planner-production', { mainView: 'planner' });
      }}>{t('View planner', 'Voir le planificateur', 'Planer öffnen')}</AppButton>
    </Stack>
  </AppAlert>;

  const inventoryDialogView = (
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
            label={`${t('Quantity', 'Quantité', 'Menge')} (${inventoryDialog?.quantityUnit === 'count' ? t('items', 'objets', 'Teile') : 'SCU'})`}
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
  );

  if (selectedResource) {
    return <PageLayout width="wide">
      {plannerNoticeView}
      {(inventoryNotice || inventoryError) && <AppAlert severity={inventoryError ? 'error' : 'success'}>{inventoryError ?? inventoryNotice}</AppAlert>}
      <div className="resource-detail-layout">
        <aside>
          <ResourceIdentityPanel resource={selectedResource} insight={selectedInsight} resourceProgress={selectedProgress} craftDemandQuantity={selectedCraftDemand.quantity} craftDemandCoverage={selectedCraftDemand.coverage} craftDemandUnit={selectedCraftDemand.quantityUnit}
            onBack={() => { setSelectedResourceSlug(null); navigateToPath('/resources', { mainView: 'resources' }); }} />
          <div className="resource-detail-actions">
            <AppButton fullWidth variant="primary" startIcon={<PlaylistAddOutlinedIcon />} onClick={() => addResourceToPlanner(selectedResource)}>{t('Plan collection', 'Planifier la collecte', 'Sammlung planen')}</AppButton>
            <AppButton fullWidth variant="secondary" startIcon={<Inventory2OutlinedIcon />} onClick={() => openInventoryDialog(selectedResource)}>{t('Add to inventory', 'Ajouter au stock', 'Zum Bestand hinzufügen')}</AppButton>
          </div>
        </aside>
        <div className="resource-detail-content">
          <nav className="resource-detail-nav" aria-label={t('Resource guide', 'Fiche ressource', 'Ressourcenübersicht')}>
            {([
              ['sources', t('Where to find it', 'Où la trouver', 'Fundorte'), selectedProviders.length, <ScienceOutlinedIcon />],
              ['missions', t('Missions', 'Missions', 'Missionen'), missingMissionGroups.length || missionRewardsLoading ? selectedInsight?.missionObjectiveContractCount || '…' : selectedMissionDemand.length, <RouteOutlinedIcon />],
              ['blueprints', t('Blueprints', 'Blueprints', 'Blueprints'), selectedBlueprints.length, <ViewInArOutlinedIcon />],
            ] as const).map(([id, label, count, icon]) => <AppButton key={id} size="sm" variant={detailSection === id ? 'primary' : 'ghost'} ariaPressed={detailSection === id} startIcon={icon} onClick={() => setDetailSection(id)}>{label} <span className="resource-nav-count">{count}</span></AppButton>)}
          </nav>
          {detailSection === 'sources' && <ResourceSourcesSection key={selectedResource.id} providers={selectedProviders} hasMaterialSourceData={Boolean(materialSources?.resources) || resourceDataLoading} />}
          {detailSection === 'missions' && <ResourceMissionSection selection={selectedMissionDemand} resourceId={selectedResource.id} missionRewardsLoading={missionRewardsLoading || missingMissionGroups.length > 0} hasMissionRewardData={Boolean(missionRewards)} />}
          {detailSection === 'blueprints' && <ResourceBlueprintUsageSection resourceId={selectedResource.id} blueprints={selectedBlueprints} resources={resources} onOpenBlueprint={setActiveBlueprint} />}
        </div>
      </div>
      {inventoryDialogView}
    </PageLayout>;
  }


  return (
    <PageLayout
      width="wide"
      sx={{ animation: 'if-fade-in 280ms cubic-bezier(0.22,1,0.36,1) both' }}
    >
      <PageHeader variant="compact" title={t('Resources', 'Ressources', 'Ressourcen')}
        description={t('Find a material. Choose a source. Plan your collection.', 'Trouvez un matériau, choisissez une source, préparez votre collecte.', 'Material finden, Quelle wählen, Sammlung planen.')}
        actions={<details className="resource-catalog-summary"><summary>{resourceStats.resourceCount} {t('resources', 'ressources', 'Ressourcen')}</summary><div>
          <ResourceFact label={t('Systems', 'Systèmes', 'Systeme')} value={String(resourceStats.systemCount)} />
          <ResourceFact label={t('Mission-linked', 'Liées aux missions', 'Missionsbezogen')} value={String(resourceStats.missionLinkedCount)} />
          <ResourceFact label={t('Sources', 'Sources', 'Quellen')} value={String(resourceStats.providerCount)} />
        </div></details>} />

      {(inventoryNotice || inventoryError) && (
        <AppAlert severity={inventoryError ? 'error' : 'success'}>
          {inventoryError ?? inventoryNotice}
        </AppAlert>
      )}

      {plannerNoticeView}

      <div className="resource-filter-bar">
        <AppTextField type="search" placeholder={t('Search resources…', 'Rechercher une ressource…', 'Ressource suchen…')} value={search} onValueChange={setSearch} ariaLabel={t('Search resources', 'Rechercher des ressources', 'Ressourcen suchen')} fieldSx={{ flex: '1 1 230px', minWidth: 0 }} />
        <AppSelect<ResourceFamilyFilter> label={t('Family', 'Famille', 'Familie')} value={familyFilter}
          options={(['all', 'metal', 'mineral', 'crystal', 'ice', 'crafting-slot'] as ResourceFamilyFilter[]).map((family) => ({ value: family, label: getResourceFamilyLabel(family, lang) }))}
          onValueChange={(value) => value && setFamilyFilter(value)} fieldSx={{ minWidth: 150 }} />
        <details className="resource-filter-options"><summary>{t('Filters & sort', 'Filtres et tri', 'Filter & Sortierung')}{sourceTypeFilter !== 'all' || sortBy !== 'name-asc' ? ' •' : ''}</summary>
          <div><AppSelect<ResourceSourceTypeFilter> label={t('Source type', 'Type de source', 'Quellentyp')} value={sourceTypeFilter}
            options={(['all', 'planetary', 'asteroid'] as ResourceSourceTypeFilter[]).map((type) => ({ value: type, label: getSourceTypeLabel(type, lang) }))}
            onValueChange={(value) => value && setSourceTypeFilter(value)} />
          <AppSelect<ResourceSort> label={t('Sort resources', 'Trier les ressources', 'Ressourcen sortieren')} value={sortBy}
            options={RESOURCE_SORT_OPTIONS.map((option) => ({ value: option.value, label: loc(option.label, lang) }))}
            onValueChange={(value) => value && setSortBy(value)} /></div>
        </details>
      </div>

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
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(280px, 340px)' },
              gap: { xs: 1.5, lg: 2 },
              alignItems: 'flex-start',
            }}
          >
            <div className="resource-register-desktop">
              <div className="resource-section-heading"><h2>{filteredResources.length} {t('resources', 'ressources', 'Ressourcen')}</h2><span>{t('Select to explore', 'Sélectionnez pour explorer', 'Zum Erkunden auswählen')}</span></div>
              <div className="resource-register" role="list">
                {renderedResources.map((resource) => {
                  const insight = resourceInsightById.get(resource.id);
                  const selected = previewResource?.id === resource.id;
                  return <div role="listitem" key={resource.id}>
                    <button type="button" className="resource-register-row" aria-pressed={selected}
                      aria-label={t(`Explore ${resource.name}`, `Explorer ${resource.name}`, `${resource.name} erkunden`)} onClick={() => setPreviewResourceId(resource.id)}>
                      <ResourceThumbnail resource={resource} size={48} />
                      <span className="resource-register-identity"><strong>{resource.name}</strong>{resource.visualKind && <span>{getResourceFamilyLabel(resource.visualKind as ResourceFamilyFilter, lang)}</span>}</span>
                      <span className="resource-register-location"><strong>{insight?.systems.join(', ') || '—'}</strong><small>{insight?.providerCount ?? 0} {t('sources', 'sources', 'Quellen')}</small></span>
                      <ChevronRightOutlinedIcon sx={{ fontSize: 18, color: selected ? 'primary.main' : 'text.secondary' }} />
                    </button>
                  </div>;
                })}
              </div>
            </div>

            {/* Mobile list */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <ResourceMobileList
                resources={renderedResources}
                resourceInsightById={resourceInsightById}
                onOpen={openResourceDetail}
              />
            </Box>

            {/* Preview panel */}
            <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 12 }}>
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

      {inventoryDialogView}
    </PageLayout>
  );
}
