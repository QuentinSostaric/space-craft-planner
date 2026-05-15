import type {
  AcquisitionGraphEntry,
  AcquisitionStanding,
  AggregatedResource,
  Blueprint,
  CraftGoal,
  ItemCategory,
  Lang,
  LocalizedString,
  MaterialSlot,
  MaterialSlotQuantityUnit,
  MaterialSourceProvider,
  MaterialSources,
  MissionContract,
  MissionRequiredStanding,
  MissionRewardsData,
  NumericItemStatKey,
  PlannerResourceRequirements,
  Resource,
  ResourceSourceMethod,
  StandingBucket,
} from '../types';
import { NUMERIC_ITEM_STAT_KEYS } from '../types';
import { loc } from '../i18n/I18nContext';

const SCALE_LABELS: Record<string, { en: string; fr: string; de?: string }> = {
  universe: { en: 'Universe-wide', fr: 'Univers entier', de: 'Universweit' },
  system: { en: 'System-wide', fr: 'Systeme entier', de: 'Systemweit' },
  'planetary-cluster': { en: 'Planetary cluster', fr: 'Cluster planetaire', de: 'Planetarer Cluster' },
  'regional-sector': { en: 'Regional sector', fr: 'Secteur regional', de: 'Regionaler Sektor' },
  'specific-location': { en: 'Specific location', fr: 'Lieu specifique', de: 'Bestimmter Ort' },
  unknown: { en: 'Unknown scope', fr: 'Portee inconnue', de: 'Unbekannte Reichweite' },
};

export function formatScaleLabel(scale: string, lang: Lang): string {
  return SCALE_LABELS[scale] ? loc(SCALE_LABELS[scale], lang) : loc(SCALE_LABELS.unknown, lang);
}

const CONTRACT_PREFIXES = [
  'SCItemPurchasableBP_',
  'SCItemPurchasable_',
  'MissionBuying_',
  'Mission_',
  'SCItem_',
  'BP_',
];

export function formatContractName(debugName: string | null): string {
  if (!debugName) return '—';
  let name = debugName;
  for (const prefix of CONTRACT_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }
  return name.replace(/_/g, ' ').trim();
}

type MissionNameLike = {
  contractDebugName?: string | null;
  title?: {
    displayText?: string | null;
    template?: string | null;
  } | null;
};

export function getMissionContractName(contract: MissionNameLike | null | undefined): string {
  const displayText = contract?.title?.displayText?.trim();
  if (displayText) {
    return displayText;
  }

  const template = contract?.title?.template?.trim();
  if (template) {
    return template;
  }

  return formatContractName(contract?.contractDebugName ?? null);
}

type MissionChanceLike = {
  blueprintDropChance?: number | null;
  rewardedBlueprints?: Array<{
    chance?: number | null;
  }> | null;
};

function clampProbability(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(value, 1));
}

export function getMissionBlueprintDropChance(
  contract: MissionChanceLike | null | undefined,
): number {
  const explicitChance = clampProbability(contract?.blueprintDropChance);
  if (explicitChance != null) {
    return explicitChance;
  }

  return Math.max(
    0,
    ...(contract?.rewardedBlueprints ?? []).map(
      (rewardedBlueprint) => clampProbability(rewardedBlueprint?.chance) ?? 0,
    ),
  );
}

export function formatProbabilityPercent(value: number | null | undefined): string {
  const probability = clampProbability(value);
  if (probability == null) {
    return '—';
  }

  const roundedPercent = Math.round(probability * 1000) / 10;
  return Number.isInteger(roundedPercent)
    ? `${roundedPercent.toFixed(0)}%`
    : `${roundedPercent.toFixed(1)}%`;
}

type StandingLike = MissionRequiredStanding | AcquisitionStanding;

function getStandingNameOnly(standing: StandingLike): string | null {
  return standing.standingName?.trim() || null;
}

export function formatStandingLabel(standing: StandingLike, _lang: Lang): string {
  const segments = [standing.factionName, standing.scopeName, standing.standingName]
    .map((segment) => segment?.trim())
    .filter(Boolean);

  return segments.join(' - ');
}

export function formatStandingSummary(standings: StandingLike[], lang: Lang): string {
  if (standings.length === 0) {
    if (lang === 'fr') return 'Aucun seuil explicite dans les contrats extraits';
    if (lang === 'de') return 'Keine explizite Rufschwelle in den extrahierten Vertragsdaten';
    return 'No explicit standing gate in extracted contract data';
  }

  const uniqueNames = [...new Set(
    standings
      .map(getStandingNameOnly)
      .filter((value): value is string => Boolean(value)),
  )];

  if (uniqueNames.length > 0) {
    return uniqueNames.join(' | ');
  }

  return standings
    .map((standing) => formatStandingLabel(standing, lang))
    .filter(Boolean)
    .join(' | ');
}

export function formatStanding(contract: MissionContract, lang: Lang): string {
  if (contract.minimumRequiredStandings.length === 0) {
    if (lang === 'fr') return 'Aucun seuil explicite dans les contrats extraits';
    if (lang === 'de') return 'Keine explizite Rufschwelle in den extrahierten Vertragsdaten';
    return 'No explicit standing gate in extracted contract data';
  }

  return contract.minimumRequiredStandings
    .map((standing) => formatStandingLabel(standing, lang))
    .filter(Boolean)
    .join(' | ');
}

export function formatLocations(contract: MissionContract, lang: Lang): string {
  if (contract.availability.explicitLocations.length > 0) {
    return contract.availability.explicitLocations.join(', ');
  }

  if (contract.availability.localities.length > 0) {
    return contract.availability.localities.join(', ');
  }

  if (lang === 'fr') return 'Aucun lieu explicite';
  if (lang === 'de') return 'Kein expliziter Ort';
  return 'No explicit location';
}



export function clampQualityValue(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1000, Math.round(value)));
}

export function isResourceSlot(slot: MaterialSlot): boolean {
  return Boolean(slot.requiredResource?.trim()) && !isPlaceholderResourceSlot(slot);
}

function normalizeResourceId(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isPlaceholderResourceSlot(slot: MaterialSlot): boolean {
  if (slot.isPlaceholderResource) return true;
  const normalized = normalizeResourceId(slot.requiredResource ?? slot.requirementName ?? '');
  const labelId = normalizeResourceId(slot.label?.en ?? slot.label?.fr ?? '');
  return (
    normalized === 'case' ||
    normalized === 'containment-matrix' ||
    normalized === 'shell' ||
    (Boolean(normalized) && normalized === labelId)
  );
}

export function isPlaceholderResource(
  resource: Pick<Resource, 'id' | 'isPlaceholder' | 'visualKind' | 'visualStatus'>,
): boolean {
  if (resource.isPlaceholder || resource.visualStatus === 'placeholder-slot') return true;
  if (resource.visualKind === 'crafting-slot') return true;
  return resource.id === 'case' || resource.id === 'containment-matrix' || resource.id === 'shell';
}

export function getSlotRequirementName(slot: MaterialSlot): string {
  return slot.requirementName || slot.requiredResource;
}

export function getSlotQuantityValue(slot: MaterialSlot): number {
  return slot.quantityUnit === 'count' ? slot.quantityValue : slot.quantityScu;
}

export function formatQuantityValue(
  value: number | null | undefined,
  quantityUnit: MaterialSlotQuantityUnit | 'mixed',
): string {
  const amount = Number(value ?? 0);
  const precision = quantityUnit === 'count' ? 2 : 3;
  const wholeNumberThreshold = quantityUnit === 'count' ? 100 : 10;

  if (amount >= wholeNumberThreshold) {
    return Math.round(amount).toString();
  }

  if (amount >= 1) {
    return amount
      .toFixed(precision)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*[1-9])0+$/, '$1');
  }

  return amount.toFixed(precision).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatResourceQuantity(
  value: number | null | undefined,
  quantityUnit: MaterialSlotQuantityUnit | 'mixed',
  lang: Lang,
  style: 'compact' | 'long' = 'compact',
): string {
  const formattedValue = formatQuantityValue(value, quantityUnit);

  if (quantityUnit === 'count') {
    if (style === 'long') {
      if (lang === 'fr') return `${formattedValue} objets`;
      if (lang === 'de') return `${formattedValue} Teile`;
      return `${formattedValue} items`;
    }

    return `x${formattedValue}`;
  }

  if (quantityUnit === 'mixed') {
    return formattedValue;
  }

  return `${formattedValue} SCU`;
}

export function getResourceQuantityInputStep(
  quantityUnit: MaterialSlotQuantityUnit | 'mixed',
): number {
  return quantityUnit === 'count' ? 1 : 0.01;
}

export function formatSlotQuantity(slot: MaterialSlot): string {
  return formatResourceQuantity(getSlotQuantityValue(slot), slot.quantityUnit, 'en');
}

export function formatQualityToken(value: number): string {
  return `Q${Math.round(value)}`;
}

export function formatQualityLabel(value: number, lang: Lang): string {
  if (lang === 'fr') return `Qualite ${Math.round(value)}`;
  if (lang === 'de') return `Qualitat ${Math.round(value)}`;
  return `Quality ${Math.round(value)}`;
}

export function summarizeAssignedQualities(
  qualityValues: number[],
  unassignedSlotCount: number,
  lang: Lang,
): string {
  if (qualityValues.length === 0) {
    return unassignedSlotCount > 0
      ? (lang === 'fr' ? 'Aucune qualite selectionnee' : lang === 'de' ? 'Keine Qualitat gewahlt' : 'No quality selected')
      : (lang === 'fr' ? 'Aucune' : lang === 'de' ? 'Keine' : 'None');
  }

  const sorted = [...qualityValues].sort((left, right) => left - right);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const baseLabel = min === max ? formatQualityToken(min) : `${formatQualityToken(min)}-${formatQualityToken(max)}`;

  if (unassignedSlotCount > 0) {
    if (lang === 'fr') return `${baseLabel} (+${unassignedSlotCount} sans qualite)`;
    if (lang === 'de') return `${baseLabel} (+${unassignedSlotCount} ohne Qualitat)`;
    return `${baseLabel} (+${unassignedSlotCount} no quality)`;
  }

  return baseLabel;
}

const MATERIAL_PROVIDER_TYPE_LABELS: Record<string, LocalizedString> = {
  'asteroid-hotspot': { en: 'Asteroid hotspot', fr: 'Hotspot d asteroid', de: 'Asteroiden-Hotspot' },
  'body-provider': { en: 'Planetary body', fr: 'Corps planetaire', de: 'Planetarer Himmelskorper' },
};

const MATERIAL_SOURCE_METHOD_LABELS: Record<ResourceSourceMethod, LocalizedString> = {
  'ship-mining': { en: 'Ship mining', fr: 'Minage vaisseau', de: 'Schiffsbergbau' },
  'vehicle-mining': { en: 'Vehicle mining', fr: 'Minage vehicule', de: 'Fahrzeugbergbau' },
  'hand-mining': { en: 'Hand mining', fr: 'Minage FPS', de: 'Handbergbau' },
};

const MATERIAL_PROVIDER_CONFIDENCE_LABELS: Record<string, LocalizedString> = {
  'localized-starmap-record': { en: 'Mapped location', fr: 'Lieu cartographie', de: 'Kartierter Ort' },
  'localized-known-key': { en: 'Known location key', fr: 'Cle de lieu connue', de: 'Bekannter Orts-Schlussel' },
  'technical-provider-code': { en: 'Internal provider code', fr: 'Code technique interne', de: 'Interner Provider-Code' },
};

const MATERIAL_PROVIDER_CONFIDENCE_ORDER: Record<string, number> = {
  'localized-starmap-record': 0,
  'localized-known-key': 1,
  'technical-provider-code': 2,
};

export function formatMaterialProviderType(providerType: string | null | undefined, lang: Lang): string {
  if (!providerType) {
    return lang === 'fr' ? 'Inconnu' : lang === 'de' ? 'Unbekannt' : 'Unknown';
  }

  const label = MATERIAL_PROVIDER_TYPE_LABELS[providerType];
  if (label) {
    return loc(label, lang);
  }

  return providerType;
}

export function formatMaterialProviderConfidence(confidence: string | null | undefined, lang: Lang): string {
  if (!confidence) {
    return lang === 'fr' ? 'Inconnue' : lang === 'de' ? 'Unbekannt' : 'Unknown';
  }

  const label = MATERIAL_PROVIDER_CONFIDENCE_LABELS[confidence];
  if (label) {
    return loc(label, lang);
  }

  return confidence;
}

export function formatMaterialSourceMethod(
  sourceMethod: ResourceSourceMethod | string | null | undefined,
  lang: Lang,
): string {
  if (!sourceMethod) {
    return lang === 'fr' ? 'Inconnue' : lang === 'de' ? 'Unbekannt' : 'Unknown';
  }

  const label = MATERIAL_SOURCE_METHOD_LABELS[sourceMethod as ResourceSourceMethod];
  if (label) {
    return loc(label, lang);
  }

  return sourceMethod;
}

export function formatMineableGroupName(groupName: string | null | undefined): string {
  if (!groupName) {
    return 'Unknown';
  }

  return groupName
    .replace(/[_-]+/g, ' ')
    .trim();
}

export function getMaterialProviderProbabilityPct(
  provider: MaterialSourceProvider,
): number | null {
  return provider.providerProbabilityPct
    ?? provider.groupProbabilityPct
    ?? provider.craftOnlyProbabilityPct
    ?? null;
}

export function sortMaterialProviders(providers: MaterialSourceProvider[]): MaterialSourceProvider[] {
  return [...providers].sort((left, right) => {
    const probabilityDelta =
      (right.providerProbabilityPct ?? right.craftOnlyProbabilityPct ?? right.groupProbabilityPct ?? -1)
      - (left.providerProbabilityPct ?? left.craftOnlyProbabilityPct ?? left.groupProbabilityPct ?? -1);

    if (probabilityDelta !== 0) {
      return probabilityDelta;
    }

    const confidenceDelta =
      (MATERIAL_PROVIDER_CONFIDENCE_ORDER[left.labelConfidence] ?? 99)
      - (MATERIAL_PROVIDER_CONFIDENCE_ORDER[right.labelConfidence] ?? 99);

    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    const systemDelta = String(left.system ?? '').localeCompare(String(right.system ?? ''));
    if (systemDelta !== 0) {
      return systemDelta;
    }

    return String(left.providerDisplayName ?? '').localeCompare(String(right.providerDisplayName ?? ''));
  });
}

function aggregateResourceEntries(
  entries: Array<{
    resourceName: string;
    quantityValue: number;
    quantityUnit: MaterialSlotQuantityUnit;
    minQuality: number | null;
    assignedQuality: number | undefined;
  }>,
): AggregatedResource[] {
  const totals = new Map<string, AggregatedResource>();

  for (const entry of entries) {
    const current = totals.get(entry.resourceName) ?? {
      resourceName: entry.resourceName,
      totalScu: 0,
      quantityUnit: entry.quantityUnit,
      minRequiredQuality: entry.minQuality ?? null,
      assignedQualityValues: [],
      unassignedSlotCount: 0,
      slotCount: 0,
    };

    current.totalScu += entry.quantityValue;
    current.quantityUnit =
      current.quantityUnit === entry.quantityUnit ? current.quantityUnit : 'mixed';
    current.slotCount += 1;
    current.minRequiredQuality = Math.max(current.minRequiredQuality ?? 0, entry.minQuality ?? 0) || null;

    if (entry.assignedQuality === undefined) {
      current.unassignedSlotCount += 1;
    } else if (!current.assignedQualityValues.includes(entry.assignedQuality)) {
      current.assignedQualityValues.push(entry.assignedQuality);
    }

    totals.set(entry.resourceName, current);
  }

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      assignedQualityValues: [...entry.assignedQualityValues].sort((left, right) => left - right),
      totalScu: Math.round(entry.totalScu * 1000) / 1000,
    }))
    .sort((left, right) => {
      if (right.totalScu !== left.totalScu) {
        return right.totalScu - left.totalScu;
      }
      return left.resourceName.localeCompare(right.resourceName);
    });
}

export function aggregateBlueprintResources(
  slots: MaterialSlot[],
  assignments: Record<string, number | undefined>,
): AggregatedResource[] {
  return aggregateResourceEntries(
    slots
      .filter(isResourceSlot)
      .map((slot) => ({
      resourceName: slot.requiredResource,
      quantityValue: getSlotQuantityValue(slot),
      quantityUnit: slot.quantityUnit,
      minQuality: slot.minQuality,
      assignedQuality: clampQualityValue(assignments[slot.id]),
      })),
  );
}

function collectGoalResourceEntries(goals: CraftGoal[], blueprints: Blueprint[]) {
  const entries = [];

  for (const goal of goals) {
    const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);
    if (!blueprint) {
      continue;
    }

    for (const slot of blueprint.slots) {
      if (!isResourceSlot(slot)) {
        continue;
      }

      entries.push({
        resourceName: slot.requiredResource,
        quantityValue: getSlotQuantityValue(slot) * goal.quantity,
        quantityUnit: slot.quantityUnit,
        minQuality: slot.minQuality,
        assignedQuality: clampQualityValue(goal.slotAssignments[slot.id]),
      });
    }
  }

  return entries;
}

export function aggregateGoalResources(
  goals: CraftGoal[],
  blueprints: Blueprint[],
): AggregatedResource[] {
  return aggregateResourceEntries(collectGoalResourceEntries(goals, blueprints));
}

export function aggregatePlannedResources(
  goals: CraftGoal[],
  blueprints: Blueprint[],
  plannerResourceRequirements: PlannerResourceRequirements,
): AggregatedResource[] {
  const manualEntries = Object.entries(plannerResourceRequirements)
    .filter(([resourceName, requirement]) =>
      Boolean(resourceName) &&
      Number.isFinite(requirement?.quantity) &&
      Number(requirement.quantity) > 0,
    )
    .map(([resourceName, requirement]) => ({
      resourceName,
      quantityValue: requirement.quantity,
      quantityUnit: requirement.quantityUnit ?? 'scu',
      minQuality: null,
      assignedQuality: undefined,
    }));

  return aggregateResourceEntries([
    ...collectGoalResourceEntries(goals, blueprints),
    ...manualEntries,
  ]);
}


/** Key stats to show on cards per category */
export const CARD_STATS: Partial<Record<ItemCategory, Array<{ key: NumericItemStatKey; label: { en: string; fr: string; de?: string } }>>> = {
  'fps-weapon': [
    { key: 'damage', label: { en: 'DPS', fr: 'DPS', de: 'DPS' } },
    { key: 'effectiveRange', label: { en: 'Range', fr: 'Portee', de: 'Reichweite' } },
  ],
  'fps-armor': [
    { key: 'damageResistanceKinetic', label: { en: 'Kinetic', fr: 'Cinetique', de: 'Kinetik' } },
    { key: 'damageResistanceEnergy', label: { en: 'Energy', fr: 'Energie', de: 'Energie' } },
  ],
  'fps-helmet': [
    { key: 'damageResistanceKinetic', label: { en: 'Kinetic', fr: 'Cinetique', de: 'Kinetik' } },
    { key: 'damageResistanceEnergy', label: { en: 'Energy', fr: 'Energie', de: 'Energie' } },
  ],
  'fps-magazine': [
    { key: 'magazineSize', label: { en: 'Capacity', fr: 'Capacite', de: 'Kapazitat' } },
  ],
  'fps-undersuit': [
    { key: 'temperatureMin', label: { en: 'Temp Min', fr: 'Temp Min' } },
    { key: 'temperatureMax', label: { en: 'Temp Max', fr: 'Temp Max' } },
  ],
  'fuel-nozzle': [
    { key: 'hydrogenFlowSpeed', label: { en: 'H2 Flow', fr: 'Debit H2', de: 'H2-Fluss' } },
    { key: 'quantumFlowSpeed', label: { en: 'QT Flow', fr: 'Debit QT', de: 'QT-Fluss' } },
    { key: 'maxHealth', label: { en: 'Health', fr: 'PV', de: 'Health' } },
  ],
  // fps-backpack: no storage stat exists in ItemStats yet; deferred until data is available.
};

/** Compute maximum value per stat key per category across all blueprints, for stat bar normalization. */
export function computeStatMaxima(blueprints: Blueprint[]): Map<ItemCategory, Map<NumericItemStatKey, number>> {
  const categoryMaxima = new Map<ItemCategory, Map<NumericItemStatKey, number>>();

  for (const bp of blueprints) {
    if (!categoryMaxima.has(bp.category)) {
      categoryMaxima.set(bp.category, new Map<NumericItemStatKey, number>());
    }
    const maxima = categoryMaxima.get(bp.category)!;

    for (const key of NUMERIC_ITEM_STAT_KEYS) {
      const val = bp.baseStats[key];
      if (typeof val === 'number') {
        // For temperatures, we might want special handling if they can be negative
        // but for most stats val > 0 is a good filter.
        if (val !== 0) {
          const absoluteVal = Math.abs(val);
          maxima.set(key, Math.max(maxima.get(key) ?? 0, absoluteVal));
        }
      }
    }
  }

  return categoryMaxima;
}

export function getAcquisitionEntry(
  missionRewards: MissionRewardsData | null,
  blueprintId: string,
): AcquisitionGraphEntry | null {
  return missionRewards?.blueprintAcquisitionGraph?.find(
    (e) => e.blueprint.id === blueprintId,
  ) ?? null;
}

export function getMaterialProviders(
  materialSources: MaterialSources | null,
  resourceId: string,
): MaterialSourceProvider[] {
  if (!materialSources?.resources || !resourceId) {
    return [];
  }

  const normalizedLookup = String(resourceId)
    .trim()
    .toLowerCase();

  const candidates = [
    resourceId,
    normalizedLookup,
    normalizedLookup.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    normalizedLookup.replace(/[^a-z0-9]+/g, ''),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const providers = materialSources.resources[candidate]?.providers;
    if (providers?.length) {
      return sortMaterialProviders(providers);
    }
  }

  const matchedEntry = Object.values(materialSources.resources).find((entry) => {
    const displayName = entry?.displayName?.trim().toLowerCase();
    const id = entry?.id?.trim().toLowerCase();
    return displayName === normalizedLookup || id === normalizedLookup;
  });

  return matchedEntry?.providers ? sortMaterialProviders(matchedEntry.providers) : [];
}

// ---------------------------------------------------------------------------
// Shared standing helpers (used by BlueprintGrid, MissionsPanel, BlueprintExplorer)
// ---------------------------------------------------------------------------

export function ls(en: string, fr: string, de?: string): LocalizedString {
  return { en, fr, de };
}

export function getStandingBucket(value: number | null | undefined): StandingBucket {
  if (value == null || value <= 0) return 'none';
  if (value <= 999) return '1-999';
  if (value <= 4999) return '1000-4999';
  if (value <= 14999) return '5000-14999';
  return '15000+';
}

export const STANDING_OPTIONS: Array<{ value: StandingBucket; label: LocalizedString }> = [
  { value: 'all', label: ls('Any standing', 'Toute réputation', 'Beliebiger Ruf') },
  { value: 'none', label: ls('No standing gate', 'Sans prérequis', 'Keine Rufschwelle') },
  { value: '1-999', label: ls('1-999', '1-999', '1-999') },
  { value: '1000-4999', label: ls('1k-4.9k', '1k-4,9k', '1k-4,9k') },
  { value: '5000-14999', label: ls('5k-14.9k', '5k-14,9k', '5k-14,9k') },
  { value: '15000+', label: ls('15k+', '15k+', '15k+') },
];
