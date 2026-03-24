import type {
  AcquisitionGraphEntry,
  AcquisitionStanding,
  AggregatedResource,
  Blueprint,
  CraftGoal,
  ItemCategory,
  Lang,
  MaterialSlot,
  MaterialSourceProvider,
  MaterialSources,
  MissionContract,
  MissionRequiredStanding,
  MissionRewardsData,
  NumericItemStatKey,
  PlannerResourceRequirements,
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
  return slot.requirementType !== 'item';
}

export function getSlotRequirementName(slot: MaterialSlot): string {
  return slot.requirementName || slot.requiredResource;
}

export function getSlotQuantityValue(slot: MaterialSlot): number {
  return slot.quantityUnit === 'count' ? slot.quantityValue : slot.quantityScu;
}

export function formatSlotQuantity(slot: MaterialSlot): string {
  const value = getSlotQuantityValue(slot);
  const rounded =
    value >= 10
      ? Math.round(value).toString()
      : value >= 1
        ? value.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
        : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

  return slot.quantityUnit === 'count' ? `x${rounded}` : `${rounded} SCU`;
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
      ? (lang === 'fr' ? 'Non selectionnee' : lang === 'de' ? 'Nicht zugewiesen' : 'Unassigned')
      : (lang === 'fr' ? 'Aucune' : lang === 'de' ? 'Keine' : 'None');
  }

  const sorted = [...qualityValues].sort((left, right) => left - right);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const baseLabel = min === max ? formatQualityToken(min) : `${formatQualityToken(min)}-${formatQualityToken(max)}`;

  if (unassignedSlotCount > 0) {
    if (lang === 'fr') return `${baseLabel} (+${unassignedSlotCount} non selectionne)`;
    if (lang === 'de') return `${baseLabel} (+${unassignedSlotCount} nicht zugewiesen)`;
    return `${baseLabel} (+${unassignedSlotCount} unassigned)`;
  }

  return baseLabel;
}

function aggregateResourceEntries(
  entries: Array<{
    resourceName: string;
    quantityScu: number;
    minQuality: number | null;
    assignedQuality: number | undefined;
  }>,
): AggregatedResource[] {
  const totals = new Map<string, AggregatedResource>();

  for (const entry of entries) {
    const current = totals.get(entry.resourceName) ?? {
      resourceName: entry.resourceName,
      totalScu: 0,
      minRequiredQuality: entry.minQuality ?? null,
      assignedQualityValues: [],
      unassignedSlotCount: 0,
      slotCount: 0,
    };

    current.totalScu += entry.quantityScu;
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
      quantityScu: slot.quantityScu,
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
        quantityScu: slot.quantityScu * goal.quantity,
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
    .filter(([resourceName, quantityScu]) => Boolean(resourceName) && Number.isFinite(quantityScu) && quantityScu > 0)
    .map(([resourceName, quantityScu]) => ({
      resourceName,
      quantityScu,
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
  // fps-backpack: no storage stat exists in ItemStats yet — deferred until data is available
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
      return providers;
    }
  }

  const matchedEntry = Object.values(materialSources.resources).find((entry) => {
    const displayName = entry?.displayName?.trim().toLowerCase();
    const id = entry?.id?.trim().toLowerCase();
    return displayName === normalizedLookup || id === normalizedLookup;
  });

  return matchedEntry?.providers ?? [];
}
