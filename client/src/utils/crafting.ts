import type {
  AcquisitionGraphEntry,
  AggregatedResource,
  Blueprint,
  CraftGoal,
  ItemCategory,
  Lang,
  MaterialSlot,
  MaterialSourceProvider,
  MaterialSources,
  MissionContract,
  MissionRewardsData,
  NumericItemStatKey,
} from '../types';
import { NUMERIC_ITEM_STAT_KEYS } from '../types';

const SCALE_LABELS: Record<string, { en: string; fr: string }> = {
  universe: { en: 'Universe-wide', fr: 'Univers entier' },
  system: { en: 'System-wide', fr: 'Systeme entier' },
  'planetary-cluster': { en: 'Planetary cluster', fr: 'Cluster planetaire' },
  'regional-sector': { en: 'Regional sector', fr: 'Secteur regional' },
  'specific-location': { en: 'Specific location', fr: 'Lieu specifique' },
  unknown: { en: 'Unknown scope', fr: 'Portee inconnue' },
};

export function formatScaleLabel(scale: string, lang: Lang): string {
  return SCALE_LABELS[scale]?.[lang] ?? (lang === 'fr' ? 'Portee inconnue' : 'Unknown scope');
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

export function formatStanding(contract: MissionContract, lang: Lang): string {
  if (contract.minimumRequiredStandings.length === 0) {
    return lang === 'fr'
      ? 'Aucun seuil explicite dans les contrats extraits'
      : 'No explicit standing gate in extracted contract data';
  }

  return contract.minimumRequiredStandings
    .map((standing) => {
      const base = [standing.factionName, standing.scopeName, standing.standingName]
        .filter(Boolean)
        .join(' - ');
      return standing.minReputation != null ? `${base} (${standing.minReputation})` : base;
    })
    .join(' | ');
}

export function formatLocations(contract: MissionContract, lang: Lang): string {
  if (contract.availability.explicitLocations.length > 0) {
    return contract.availability.explicitLocations.join(', ');
  }

  if (contract.availability.localities.length > 0) {
    return contract.availability.localities.join(', ');
  }

  return lang === 'fr' ? 'Aucun lieu explicite' : 'No explicit location';
}



export function clampQualityValue(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1000, Math.round(value)));
}

export function formatQualityToken(value: number): string {
  return `Q${Math.round(value)}`;
}

export function formatQualityLabel(value: number, lang: Lang): string {
  return lang === 'fr' ? `Qualite ${Math.round(value)}` : `Quality ${Math.round(value)}`;
}

export function summarizeAssignedQualities(
  qualityValues: number[],
  unassignedSlotCount: number,
  lang: Lang,
): string {
  if (qualityValues.length === 0) {
    return unassignedSlotCount > 0
      ? (lang === 'fr' ? 'Non selectionnee' : 'Unassigned')
      : (lang === 'fr' ? 'Aucune' : 'None');
  }

  const sorted = [...qualityValues].sort((left, right) => left - right);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const baseLabel = min === max ? formatQualityToken(min) : `${formatQualityToken(min)}-${formatQualityToken(max)}`;

  if (unassignedSlotCount > 0) {
    return lang === 'fr'
      ? `${baseLabel} (+${unassignedSlotCount} non selectionne)`
      : `${baseLabel} (+${unassignedSlotCount} unassigned)`;
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
    slots.map((slot) => ({
      resourceName: slot.requiredResource,
      quantityScu: slot.quantityScu,
      minQuality: slot.minQuality,
      assignedQuality: clampQualityValue(assignments[slot.id]),
    })),
  );
}

export function aggregateGoalResources(
  goals: CraftGoal[],
  blueprints: Blueprint[],
): AggregatedResource[] {
  const entries = [];

  for (const goal of goals) {
    const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);
    if (!blueprint) {
      continue;
    }

    for (const slot of blueprint.slots) {
      entries.push({
        resourceName: slot.requiredResource,
        quantityScu: slot.quantityScu * goal.quantity,
        minQuality: slot.minQuality,
        assignedQuality: clampQualityValue(goal.slotAssignments[slot.id]),
      });
    }
  }

  return aggregateResourceEntries(entries);
}


/** Key stats to show on cards per category */
export const CARD_STATS: Partial<Record<ItemCategory, Array<{ key: NumericItemStatKey; label: { en: string; fr: string } }>>> = {
  'fps-weapon': [
    { key: 'damage', label: { en: 'DPS', fr: 'DPS' } },
    { key: 'effectiveRange', label: { en: 'Range', fr: 'Portee' } },
  ],
  'fps-armor': [
    { key: 'damageResistanceKinetic', label: { en: 'Kinetic', fr: 'Cinetique' } },
    { key: 'damageResistanceEnergy', label: { en: 'Energy', fr: 'Energie' } },
  ],
  'fps-helmet': [
    { key: 'damageResistanceKinetic', label: { en: 'Kinetic', fr: 'Cinetique' } },
    { key: 'damageResistanceEnergy', label: { en: 'Energy', fr: 'Energie' } },
  ],
  'fps-magazine': [
    { key: 'magazineSize', label: { en: 'Capacity', fr: 'Capacite' } },
  ],
  'fps-undersuit': [
    { key: 'temperatureMin', label: { en: 'Temp Min', fr: 'Temp Min' } },
    { key: 'temperatureMax', label: { en: 'Temp Max', fr: 'Temp Max' } },
  ],
  // fps-backpack: no storage stat exists in ItemStats yet — deferred until data is available
};

/** Compute maximum value per stat key across all blueprints, for stat bar normalization. */
export function computeStatMaxima(blueprints: Blueprint[]): Map<NumericItemStatKey, number> {
  const maxima = new Map<NumericItemStatKey, number>();

  for (const bp of blueprints) {
    for (const key of NUMERIC_ITEM_STAT_KEYS) {
      const val = bp.baseStats[key];
      if (typeof val === 'number' && val > 0) {
        maxima.set(key, Math.max(maxima.get(key) ?? 0, val));
      }
    }
  }

  return maxima;
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
  return materialSources?.resources?.[resourceId]?.providers ?? [];
}
