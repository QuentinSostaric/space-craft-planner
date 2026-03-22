import type {
  LocalizedString,
  ShipComponentEntry,
  ShipComponentPortEntry,
  ShipComponentResourceDelta,
} from '../types';

function ls(en: string, fr: string, de?: string): LocalizedString {
  return { en, fr, de };
}

function humanizeToken(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function trimNumber(value: number, maxFractionDigits = 2): string {
  return value
    .toFixed(maxFractionDigits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
}

function formatNumberWithUnit(
  value: number,
  unit: string,
  maxFractionDigits = 2,
): string {
  const rendered = trimNumber(value, maxFractionDigits);
  return unit ? `${rendered} ${unit}` : rendered;
}

function formatMultiplier(value: number): string {
  return `${trimNumber(value, 2)}x`;
}

function extractFirstNumber(value: string): number | null {
  const matched = value.match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return extractFirstNumber(value);
  }

  return null;
}

function readPath(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

type ShipComponentFactMap = Record<string, string>;

export function isDisplayableShipComponent(component: ShipComponentEntry): boolean {
  const id = String(component.id ?? '').toLowerCase();
  const name = String(component.name ?? '').trim();
  const displayType = String(component.displayType ?? '').trim();
  const normalizedName = name.toLowerCase();
  const hasManufacturer = Boolean(component.manufacturer);

  if (!name) {
    return false;
  }

  if (id.includes('template') || normalizedName.includes('template')) {
    return false;
  }

  if (!hasManufacturer && displayType && normalizedName === displayType.toLowerCase()) {
    return false;
  }

  return true;
}

function getStringAtPaths(
  component: ShipComponentEntry,
  facts: ShipComponentFactMap,
  factIds: readonly string[] = [],
  paths: readonly (readonly string[])[] = [],
): string | null {
  for (const factId of factIds) {
    const factValue = facts[factId];
    if (factValue) {
      return factValue;
    }
  }

  for (const path of paths) {
    const candidate = readPath(component, path);
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return null;
}

function getNumberAtPaths(
  component: ShipComponentEntry,
  facts: ShipComponentFactMap,
  factIds: readonly string[] = [],
  paths: readonly (readonly string[])[] = [],
): number | null {
  for (const factId of factIds) {
    const factValue = facts[factId];
    if (factValue) {
      return toFiniteNumber(factValue);
    }
  }

  for (const path of paths) {
    const candidate = readPath(component, path);
    const parsed = toFiniteNumber(candidate);
    if (parsed != null) {
      return parsed;
    }
  }

  return null;
}

function formatGridFootprint(component: ShipComponentEntry): string | null {
  const grid = component.identity?.inventoryOccupancy?.gridSize;
  if (!grid?.x || !grid?.y) {
    return null;
  }

  return `${grid.x} x ${grid.y}`;
}

function formatCompatibleHull(component: ShipComponentEntry): string | null {
  const tags = component.identity?.attachDef?.requiredTags ?? [];
  const firstTag = tags.find(Boolean);
  return humanizeToken(firstTag) ?? firstTag ?? null;
}

function formatSlotRange(port: ShipComponentPortEntry | null): string | null {
  if (!port) {
    return null;
  }

  const minSize = toFiniteNumber(port.minSize);
  const maxSize = toFiniteNumber(port.maxSize);
  if (minSize == null && maxSize == null) {
    return null;
  }

  if (minSize != null && maxSize != null && minSize === maxSize) {
    return `S${trimNumber(minSize, 0)}`;
  }

  return `S${trimNumber(minSize ?? 0, 0)}-S${trimNumber(maxSize ?? minSize ?? 0, 0)}`;
}

function getFirstPortByType(
  component: ShipComponentEntry,
  portType: string,
): ShipComponentPortEntry | null {
  const ports = component.ports?.entries ?? [];
  return ports.find((port) =>
    (port.types ?? []).some((typeEntry) => typeEntry.type === portType),
  ) ?? null;
}

function countPortsByType(component: ShipComponentEntry, portType: string): number | null {
  const ports = component.ports?.entries ?? [];
  const count = ports.filter((port) =>
    (port.types ?? []).some((typeEntry) => typeEntry.type === portType),
  ).length;

  return count > 0 ? count : null;
}

function getBestDeltaAmount(delta: ShipComponentResourceDelta): number | null {
  let best: number | null = null;

  for (const unit of delta.amountUnits ?? []) {
    const candidates = [
      unit.units,
      unit.standardResourceUnits,
      unit.standardCargoUnits,
    ];

    for (const candidate of candidates) {
      const parsed = toFiniteNumber(candidate);
      if (parsed == null) {
        continue;
      }

      best = best == null ? parsed : Math.max(best, parsed);
    }
  }

  return best;
}

function getPeakResourceDeltaAmount(
  component: ShipComponentEntry,
  mode: 'generation' | 'consumption',
  resource: string,
): number | null {
  const states = component.resources?.states ?? [];
  let maxAmount: number | null = null;

  for (const state of states) {
    for (const delta of state.deltas ?? []) {
      const endpoint = mode === 'generation' ? delta.generation : delta.consumption;
      if (endpoint?.resource !== resource) {
        continue;
      }

      const amount = getBestDeltaAmount(delta);
      if (amount == null) {
        continue;
      }

      maxAmount = maxAmount == null ? amount : Math.max(maxAmount, amount);
    }
  }

  return maxAmount;
}

export interface ShipScannerSignatureCurve {
  signatureId: string;
  label: LocalizedString;
  focusAngles: number[];
  contactSensitivity: number[];
  blobSensitivity: number[];
  pierceFactors: number[];
  isStandardCurve: boolean;
}

export const SHIP_SCANNER_FOCUS_ANGLES = [
  360,
  180,
  90,
  45,
  22.5,
  11.25,
  5.625,
  2.8125,
] as const;

const STANDARD_SCANNER_CONTACT_CURVE = [1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2] as const;
const STANDARD_SCANNER_BLOB_CURVE = [2, 2.1, 2.2, 2.4, 2.8, 3.2, 3.8, 5] as const;
const STANDARD_SCANNER_PIERCE_CURVE = [1, 1, 1, 1, 1, 1, 1, 1] as const;
const RS_SCANNER_CONTACT_CURVE = [2, 3, 4, 5, 6, 7, 8, 9] as const;
const RS_SCANNER_BLOB_CURVE = [10, 10, 10, 10, 10, 10, 10, 10] as const;

export const SHIP_SCANNER_SIGNATURE_CURVES: ShipScannerSignatureCurve[] = [
  {
    signatureId: 'ir',
    label: ls('IR signature', 'Signature IR', 'IR-Signatur'),
    focusAngles: [...SHIP_SCANNER_FOCUS_ANGLES],
    contactSensitivity: [...STANDARD_SCANNER_CONTACT_CURVE],
    blobSensitivity: [...STANDARD_SCANNER_BLOB_CURVE],
    pierceFactors: [...STANDARD_SCANNER_PIERCE_CURVE],
    isStandardCurve: true,
  },
  {
    signatureId: 'em',
    label: ls('EM signature', 'Signature EM', 'EM-Signatur'),
    focusAngles: [...SHIP_SCANNER_FOCUS_ANGLES],
    contactSensitivity: [...STANDARD_SCANNER_CONTACT_CURVE],
    blobSensitivity: [...STANDARD_SCANNER_BLOB_CURVE],
    pierceFactors: [...STANDARD_SCANNER_PIERCE_CURVE],
    isStandardCurve: true,
  },
  {
    signatureId: 'cs',
    label: ls('Cross-section', 'Section radar', 'Querschnitt'),
    focusAngles: [...SHIP_SCANNER_FOCUS_ANGLES],
    contactSensitivity: [...STANDARD_SCANNER_CONTACT_CURVE],
    blobSensitivity: [...STANDARD_SCANNER_BLOB_CURVE],
    pierceFactors: [...STANDARD_SCANNER_PIERCE_CURVE],
    isStandardCurve: true,
  },
  {
    signatureId: 'db',
    label: ls('dB signature', 'Signature dB', 'dB-Signatur'),
    focusAngles: [...SHIP_SCANNER_FOCUS_ANGLES],
    contactSensitivity: [...STANDARD_SCANNER_CONTACT_CURVE],
    blobSensitivity: [...STANDARD_SCANNER_BLOB_CURVE],
    pierceFactors: [...STANDARD_SCANNER_PIERCE_CURVE],
    isStandardCurve: true,
  },
  {
    signatureId: 'rs',
    label: ls('RS signature', 'Signature RS', 'RS-Signatur'),
    focusAngles: [...SHIP_SCANNER_FOCUS_ANGLES],
    contactSensitivity: [...RS_SCANNER_CONTACT_CURVE],
    blobSensitivity: [...RS_SCANNER_BLOB_CURVE],
    pierceFactors: [...STANDARD_SCANNER_PIERCE_CURVE],
    isStandardCurve: false,
  },
  {
    signatureId: 'id',
    label: ls('ID signature', 'Signature ID', 'ID-Signatur'),
    focusAngles: [...SHIP_SCANNER_FOCUS_ANGLES],
    contactSensitivity: [...STANDARD_SCANNER_CONTACT_CURVE],
    blobSensitivity: [...STANDARD_SCANNER_BLOB_CURVE],
    pierceFactors: [...STANDARD_SCANNER_PIERCE_CURVE],
    isStandardCurve: true,
  },
];

export type ShipComponentCardProfileStatus = 'now' | 'next' | 'later';

export type ShipComponentCardProfileKey =
  | 'scanner'
  | 'refueling-nozzle'
  | 'fuel-pod'
  | 'salvage-head'
  | 'salvage-modifier:scraper'
  | 'salvage-modifier:tractor'
  | 'salvage-modifier:buff'
  | 'mining-laser'
  | 'mining-module:active'
  | 'mining-module:passive'
  | 'powerplant'
  | 'cooler'
  | 'shield-generator'
  | 'quantum-drive'
  | 'radar'
  | 'ship-weapon'
  | 'missile-rack'
  | 'emp'
  | 'qed-qid'
  | 'jump-drive'
  | 'thruster'
  | 'fuel-tank'
  | 'fuel-intake'
  | 'battery'
  | 'computer';

export interface ShipComponentCardMetric {
  id: string;
  label: LocalizedString;
  value: string;
  sortValue?: number | null;
}

export interface ShipComponentCardProfile {
  key: ShipComponentCardProfileKey;
  family: string;
  status: ShipComponentCardProfileStatus;
  label: LocalizedString;
  heroMetricIds: string[];
  chipMetricIds: string[];
  detailMetricIds: string[];
  notes?: string;
}

export interface ShipComponentCardModel {
  profileKey: ShipComponentCardProfileKey;
  profile: ShipComponentCardProfile;
  factMap: ShipComponentFactMap;
  heroMetrics: ShipComponentCardMetric[];
  chipMetrics: ShipComponentCardMetric[];
  detailMetrics: ShipComponentCardMetric[];
  scannerMatrix: ShipScannerSignatureCurve[] | null;
}

type ShipComponentMetricContext = {
  component: ShipComponentEntry;
  facts: ShipComponentFactMap;
};

type ShipComponentMetricBuilder = (context: ShipComponentMetricContext) => ShipComponentCardMetric | null;

function buildShipComponentFactMap(component: ShipComponentEntry): ShipComponentFactMap {
  const map: ShipComponentFactMap = {};

  for (const fact of component.descriptionFacts ?? []) {
    if (!fact.id || !fact.value) {
      continue;
    }

    map[fact.id] = fact.value;
  }

  return map;
}

function buildMetric(
  id: string,
  label: LocalizedString,
  value: string,
  sortValue?: number | null,
): ShipComponentCardMetric {
  return { id, label, value, sortValue };
}

function metricFromString(
  id: string,
  label: LocalizedString,
  value: string | null,
  sortValue?: number | null,
): ShipComponentCardMetric | null {
  if (!value) {
    return null;
  }

  return buildMetric(id, label, value, sortValue ?? toFiniteNumber(value));
}

function buildFactOrPathMetric(
  id: string,
  label: LocalizedString,
  context: ShipComponentMetricContext,
  factIds: readonly string[] = [],
  paths: readonly (readonly string[])[] = [],
  formatter?: (value: string | number) => string | null,
): ShipComponentCardMetric | null {
  const raw = getStringAtPaths(context.component, context.facts, factIds, paths);
  if (!raw) {
    return null;
  }

  const parsedNumber = toFiniteNumber(raw);
  const formatted = formatter
    ? formatter(parsedNumber != null && raw === String(parsedNumber) ? parsedNumber : raw)
    : raw;

  return metricFromString(id, label, formatted, parsedNumber);
}

function formatMassMetric(value: string | number): string | null {
  const parsed = toFiniteNumber(value);
  if (parsed == null) {
    return typeof value === 'string' ? value : null;
  }

  return formatNumberWithUnit(parsed, 'kg');
}

function formatMetersMetric(value: string | number): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return formatNumberWithUnit(value, 'm');
}

function formatSecondsMetric(value: string | number): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return formatNumberWithUnit(value, 's');
}

function formatRawNumberMetric(value: string | number): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return trimNumber(value, 2);
}

const METRIC_BUILDERS: Record<string, ShipComponentMetricBuilder> = {
  standardSensitivity: () =>
    buildMetric(
      'standardSensitivity',
      ls('Standard sensitivity', 'Sensibilite standard', 'Standardempfindlichkeit'),
      `${trimNumber(STANDARD_SCANNER_CONTACT_CURVE[0], 2)}x -> ${trimNumber(STANDARD_SCANNER_CONTACT_CURVE[STANDARD_SCANNER_CONTACT_CURVE.length - 1], 2)}x`,
      STANDARD_SCANNER_CONTACT_CURVE[STANDARD_SCANNER_CONTACT_CURVE.length - 1],
    ),

  rsSensitivity: () =>
    buildMetric(
      'rsSensitivity',
      ls('RS sensitivity', 'Sensibilite RS', 'RS-Empfindlichkeit'),
      `${trimNumber(RS_SCANNER_CONTACT_CURVE[0], 2)}x -> ${trimNumber(RS_SCANNER_CONTACT_CURVE[RS_SCANNER_CONTACT_CURVE.length - 1], 2)}x`,
      RS_SCANNER_CONTACT_CURVE[RS_SCANNER_CONTACT_CURVE.length - 1],
    ),

  batterySlot: ({ component }) =>
    metricFromString(
      'batterySlot',
      ls('Battery slot', 'Slot batterie', 'Batterieslot'),
      formatSlotRange(getFirstPortByType(component, 'Battery')),
    ),

  focusAngleRange: () =>
    buildMetric(
      'focusAngleRange',
      ls('Focus angle', 'Angle de focus', 'Fokuswinkel'),
      `${trimNumber(SHIP_SCANNER_FOCUS_ANGLES[0], 4)}deg -> ${trimNumber(SHIP_SCANNER_FOCUS_ANGLES[SHIP_SCANNER_FOCUS_ANGLES.length - 1], 4)}deg`,
      SHIP_SCANNER_FOCUS_ANGLES[SHIP_SCANNER_FOCUS_ANGLES.length - 1],
    ),

  size: (context) =>
    buildFactOrPathMetric(
      'size',
      ls('Size', 'Taille', 'Grosse'),
      context,
      ['size'],
      [['identity', 'attachDef', 'size']],
      formatRawNumberMetric,
    ),

  grade: (context) =>
    buildFactOrPathMetric(
      'grade',
      ls('Grade', 'Grade', 'Klasse'),
      context,
      ['grade'],
      [['identity', 'attachDef', 'grade']],
      formatRawNumberMetric,
    ),

  mass: (context) =>
    buildFactOrPathMetric(
      'mass',
      ls('Mass', 'Masse', 'Masse'),
      context,
      [],
      [['systems', 'physics', 'mass']],
      formatMassMetric,
    ),

  safeFlowRate: (context) =>
    buildFactOrPathMetric(
      'safeFlowRate',
      ls('Safe flow rate', 'Debit securise', 'Sicherer Durchsatz'),
      context,
      ['safeFlowRate'],
    ),

  flowSpeedModifier: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'fuelNozzle', 'flowSpeedModifier']],
    );
    return value == null
      ? null
      : buildMetric(
          'flowSpeedModifier',
          ls('Flow speed mod.', 'Mod. vitesse debit', 'Durchsatzmod.'),
          formatMultiplier(value),
          value,
        );
  },

  tankCapacityModifier: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'fuelNozzle', 'fuelTankCapacityMultiplier']],
    );
    return value == null
      ? null
      : buildMetric(
          'tankCapacityModifier',
          ls('Tank capacity mod.', 'Mod. capacite reservoir', 'Tankkapazitatsmod.'),
          formatMultiplier(value),
          value,
        );
  },

  captureRadius: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'dockingTube', 'captureRadius']],
    );
    return value == null
      ? null
      : buildMetric(
          'captureRadius',
          ls('Capture radius', 'Rayon de capture', 'Andockradius'),
          formatNumberWithUnit(value, 'm'),
          value,
        );
  },

  fuelDamageMultiplier: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'fuelNozzle', 'fuelDamageMultiplier']],
    );
    return value == null
      ? null
      : buildMetric(
          'fuelDamageMultiplier',
          ls('Fuel damage mod.', 'Mod. degats carburant', 'Treibstoffschaden-Mod.'),
          formatMultiplier(value),
          value,
        );
  },

  capacity: ({ component, facts }) => {
    const factValue = facts.capacity;
    if (factValue) {
      return buildMetric('capacity', ls('Capacity', 'Capacite', 'Kapazitat'), factValue, extractFirstNumber(factValue));
    }

    const capacities = readPath(component, ['stats', 'resourceContainer', 'capacity']);
    if (Array.isArray(capacities)) {
      const firstEntry = capacities[0];
      if (firstEntry && typeof firstEntry === 'object') {
        const amount = toFiniteNumber((firstEntry as Record<string, unknown>).standardCargoUnits);
        if (amount != null) {
          return buildMetric(
            'capacity',
            ls('Capacity', 'Capacite', 'Kapazitat'),
            formatNumberWithUnit(amount, 'SCU'),
            amount,
          );
        }
      }
    }

    return null;
  },

  flowRate: (context) =>
    buildFactOrPathMetric(
      'flowRate',
      ls('Flow rate', 'Debit', 'Durchsatz'),
      context,
      ['flowRate'],
    ),

  gridFootprint: ({ component }) =>
    metricFromString(
      'gridFootprint',
      ls('Grid footprint', 'Empreinte grille', 'Raster-Fussabdruck'),
      formatGridFootprint(component),
    ),

  compatibleHull: ({ component }) =>
    metricFromString(
      'compatibleHull',
      ls('Compatible hull', 'Coque compatible', 'Kompatibler Rumpf'),
      formatCompatibleHull(component),
    ),

  modifierSlots: ({ component, facts }) => {
    const factValue = facts.moduleSlots ?? facts.moduleCapacity;
    if (factValue) {
      return buildMetric(
        'modifierSlots',
        ls('Modifier slots', 'Slots modules', 'Modulslots'),
        factValue,
        extractFirstNumber(factValue),
      );
    }

    const count = countPortsByType(component, 'SalvageModifier');
    return count == null
      ? null
      : buildMetric(
          'modifierSlots',
          ls('Modifier slots', 'Slots modules', 'Modulslots'),
          trimNumber(count, 0),
          count,
        );
  },

  maxRange: (context) =>
    buildFactOrPathMetric(
      'maxRange',
      ls('Max range', 'Portee max', 'Max. Reichweite'),
      context,
      ['maximumRange', 'maxRange'],
      [['stats', 'weaponComponent', 'weaponAIData', 'maxFiringRange']],
      formatMetersMetric,
    ),

  moduleCapacity: ({ component, facts }) => {
    if (facts.moduleCapacity) {
      return buildMetric(
        'moduleCapacity',
        ls('Module capacity', 'Capacite modules', 'Modulkapazitat'),
        facts.moduleCapacity,
        extractFirstNumber(facts.moduleCapacity),
      );
    }

    const count = countPortsByType(component, 'SalvageModifier');
    return count == null
      ? null
      : buildMetric(
          'moduleCapacity',
          ls('Module capacity', 'Capacite modules', 'Modulkapazitat'),
          trimNumber(count, 0),
          count,
        );
  },

  salvageMount: ({ component }) =>
    metricFromString(
      'salvageMount',
      ls('Mount', 'Montage', 'Aufnahme'),
      component.identity?.attachDef?.requiredTags?.includes('salvageMount')
        ? 'Salvage Mount'
        : null,
    ),

  extractionSpeed: (context) =>
    buildFactOrPathMetric(
      'extractionSpeed',
      ls('Extraction speed', 'Vitesse extraction', 'Extraktionsrate'),
      context,
      ['extractionSpeed'],
    ),

  extractionEfficiency: (context) =>
    buildFactOrPathMetric(
      'extractionEfficiency',
      ls('Extraction efficiency', 'Rendement extraction', 'Extraktionseffizienz'),
      context,
      ['extractionEfficiency'],
    ),

  radius: (context) =>
    buildFactOrPathMetric(
      'radius',
      ls('Radius', 'Rayon', 'Radius'),
      context,
      ['radius'],
    ),

  activationMethod: ({ component, facts }) => {
    const value = getStringAtPaths(
      component,
      facts,
      [],
      [['stats', 'attachableModifier', 'activationMethod']],
    );
    return metricFromString(
      'activationMethod',
      ls('Activation', 'Activation', 'Aktivierung'),
      humanizeToken(value),
    );
  },

  charges: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      ['uses'],
      [['stats', 'attachableModifier', 'charges']],
    );
    return value == null
      ? null
      : buildMetric(
          'charges',
          ls('Charges', 'Charges', 'Ladungen'),
          trimNumber(value, 0),
          value,
        );
  },

  subtype: ({ component, facts }) =>
    metricFromString(
      'subtype',
      ls('Subtype', 'Sous-type', 'Untertyp'),
      facts.itemType ?? component.displayType ?? humanizeToken(component.family),
    ),

  salvageSpeedMultiplier: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'weaponModifierBlocks', '0', 'weaponStats', 'salvageModifier', 'salvageSpeedMultiplier']],
    );
    return value == null
      ? null
      : buildMetric(
          'salvageSpeedMultiplier',
          ls('Speed multiplier', 'Mult. vitesse', 'Geschwindigkeitsfaktor'),
          formatMultiplier(value),
          value,
        );
  },

  radiusMultiplier: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'weaponModifierBlocks', '0', 'weaponStats', 'salvageModifier', 'radiusMultiplier']],
    );
    return value == null
      ? null
      : buildMetric(
          'radiusMultiplier',
          ls('Radius multiplier', 'Mult. rayon', 'Radiusfaktor'),
          formatMultiplier(value),
          value,
        );
  },

  efficiencyMultiplier: ({ component, facts }) => {
    const value = getNumberAtPaths(
      component,
      facts,
      [],
      [['stats', 'weaponModifierBlocks', '0', 'weaponStats', 'salvageModifier', 'extractionEfficiency']],
    );
    return value == null
      ? null
      : buildMetric(
          'efficiencyMultiplier',
          ls('Efficiency multiplier', 'Mult. rendement', 'Effizienzfaktor'),
          formatMultiplier(value),
          value,
        );
  },

  fullStrengthDistance: (context) =>
    buildFactOrPathMetric(
      'fullStrengthDistance',
      ls('Full-strength dist.', 'Distance pleine force', 'Volle-Starke-Distanz'),
      context,
      ['fullStrengthDistance'],
    ),

  maxAngle: (context) =>
    buildFactOrPathMetric(
      'maxAngle',
      ls('Max angle', 'Angle max', 'Max. Winkel'),
      context,
      ['maxAngle'],
    ),

  miningLaserPower: (context) =>
    buildFactOrPathMetric(
      'miningLaserPower',
      ls('Laser power', 'Puissance laser', 'Laserleistung'),
      context,
      ['miningLaserPower', 'extractionLaserPower'],
    ),

  optimalRange: (context) =>
    buildFactOrPathMetric(
      'optimalRange',
      ls('Optimal range', 'Portee optimale', 'Optimale Reichweite'),
      context,
      ['optimalRange'],
    ),

  moduleSlots: (context) =>
    buildFactOrPathMetric(
      'moduleSlots',
      ls('Module slots', 'Slots modules', 'Modulslots'),
      context,
      ['moduleSlots'],
      [],
      formatRawNumberMetric,
    ),

  resistance: (context) =>
    buildFactOrPathMetric(
      'resistance',
      ls('Resistance', 'Resistance', 'Widerstand'),
      context,
      ['resistance'],
    ),

  instability: (context) =>
    buildFactOrPathMetric(
      'instability',
      ls('Instability', 'Instabilite', 'Instabilitat'),
      context,
      ['laserInstability', 'instability'],
    ),

  chargeWindow: ({ component, facts }) =>
    metricFromString(
      'chargeWindow',
      ls('Charge window', 'Fenetre charge', 'Ladefenster'),
      facts.optimalChargeWindowRate ?? facts.optimalChargeWindowSize ?? getStringAtPaths(
        component,
        facts,
        [],
        [['stats', 'miningLaserComponent', 'throttleMinimum']],
      ),
    ),

  powerModifier: (context) =>
    buildFactOrPathMetric(
      'powerModifier',
      ls('Power modifier', 'Mod. puissance', 'Leistungsmod.'),
      context,
      ['extractionLaserPower', 'miningLaserPower'],
    ),

  duration: (context) =>
    buildFactOrPathMetric(
      'duration',
      ls('Duration', 'Duree', 'Dauer'),
      context,
      ['duration'],
      [],
      formatSecondsMetric,
    ),

  uses: (context) =>
    buildFactOrPathMetric(
      'uses',
      ls('Uses', 'Utilisations', 'Anwendungen'),
      context,
      ['uses'],
      [],
      formatRawNumberMetric,
    ),

  secondaryEffect: ({ facts }) => {
    const candidateIds = [
      'resistance',
      'catastrophicChargeRate',
      'shatterDamage',
      'laserInstability',
      'inertMaterialLevel',
      'optimalChargeWindowSize',
    ];

    for (const factId of candidateIds) {
      const value = facts[factId];
      if (!value) {
        continue;
      }

      const factLabel = humanizeToken(factId) ?? factId;
      return buildMetric(
        'secondaryEffect',
        ls('Secondary', 'Secondaire', 'Sekundar'),
        `${factLabel}: ${value}`,
      );
    }

    return null;
  },

  powerOutput: ({ component }) => {
    const value = getPeakResourceDeltaAmount(component, 'generation', 'Power');
    return value == null
      ? null
      : buildMetric(
          'powerOutput',
          ls('Power output', 'Sortie puissance', 'Leistungsausgabe'),
          trimNumber(value, 2),
          value,
        );
  },

  coolantConsumption: ({ component }) => {
    const value = getPeakResourceDeltaAmount(component, 'consumption', 'Coolant');
    return value == null
      ? null
      : buildMetric(
          'coolantConsumption',
          ls('Coolant draw', 'Conso. coolant', 'Kuhlmittelbedarf'),
          trimNumber(value, 2),
          value,
        );
  },

  emSignature: ({ component }) => {
    const value = getNumberAtPaths(component, {}, [], [['resources', 'states', '0', 'emSignature', 'nominalSignature']]);
    return value == null
      ? null
      : buildMetric(
          'emSignature',
          ls('EM signature', 'Signature EM', 'EM-Signatur'),
          trimNumber(value, 2),
          value,
        );
  },

  coolingOutput: ({ component }) => {
    const value = getPeakResourceDeltaAmount(component, 'generation', 'Coolant');
    return value == null
      ? null
      : buildMetric(
          'coolingOutput',
          ls('Cooling output', 'Sortie refroidissement', 'Kuhlleistung'),
          trimNumber(value, 2),
          value,
        );
  },

  powerConsumption: ({ component }) => {
    const value = getPeakResourceDeltaAmount(component, 'consumption', 'Power');
    return value == null
      ? null
      : buildMetric(
          'powerConsumption',
          ls('Power draw', 'Conso. puissance', 'Leistungsbedarf'),
          trimNumber(value, 2),
          value,
        );
  },

  irSignature: ({ component }) => {
    const value = getNumberAtPaths(component, {}, [], [['resources', 'states', '0', 'irSignature', 'nominalSignature']]);
    return value == null
      ? null
      : buildMetric(
          'irSignature',
          ls('IR signature', 'Signature IR', 'IR-Signatur'),
          trimNumber(value, 2),
          value,
        );
  },

  shieldHp: (context) =>
    buildFactOrPathMetric(
      'shieldHp',
      ls('Shield HP', 'PV bouclier', 'Schild-HP'),
      context,
      ['maxShieldHealth'],
      [['stats', 'shield', 'maxShieldHealth']],
      formatRawNumberMetric,
    ),

  regenPerSec: (context) =>
    buildFactOrPathMetric(
      'regenPerSec',
      ls('Regen / s', 'Regen / s', 'Reg. / s'),
      context,
      ['maxShieldRegen'],
      [['stats', 'shield', 'maxShieldRegen']],
      formatRawNumberMetric,
    ),

  regenDelay: (context) =>
    buildFactOrPathMetric(
      'regenDelay',
      ls('Regen delay', 'Delai regen', 'Reg.-Verzogerung'),
      context,
      ['regenDelay'],
      [['stats', 'shield', 'regenDelay']],
      formatSecondsMetric,
    ),

  powerDraw: ({ component, facts }) => {
    const value = getPeakResourceDeltaAmount(component, 'consumption', 'Power')
      ?? getNumberAtPaths(component, facts, ['powerDraw'], [['stats', 'powerDraw']]);
    return value == null
      ? null
      : buildMetric(
          'powerDraw',
          ls('Power draw', 'Conso. puissance', 'Leistungsbedarf'),
          trimNumber(value, 2),
          value,
        );
  },

  quantumSpeed: (context) =>
    buildFactOrPathMetric(
      'quantumSpeed',
      ls('Quantum speed', 'Vitesse quantique', 'Quantengeschwindigkeit'),
      context,
      ['quantumSpeed', 'driveSpeed'],
      [['stats', 'quantumDrive', 'splineJumpParams', 'driveSpeed']],
      formatRawNumberMetric,
    ),

  spoolUpTime: (context) =>
    buildFactOrPathMetric(
      'spoolUpTime',
      ls('Spool time', 'Temps spool', 'Spulzeit'),
      context,
      ['spoolUpTime'],
      [['stats', 'quantumDrive', 'splineJumpParams', 'spoolUpTime']],
      formatSecondsMetric,
    ),

  fuelRequirement: (context) =>
    buildFactOrPathMetric(
      'fuelRequirement',
      ls('Fuel requirement', 'Besoin carburant', 'Treibstoffbedarf'),
      context,
      ['quantumFuelRequirement'],
      [['stats', 'quantumDrive', 'quantumFuelRequirement']],
    ),

  cooldownTime: (context) =>
    buildFactOrPathMetric(
      'cooldownTime',
      ls('Cooldown', 'Recharge', 'Abklingzeit'),
      context,
      ['cooldownTime'],
      [['stats', 'quantumDrive', 'splineJumpParams', 'cooldownTime']],
      formatSecondsMetric,
    ),

  passiveSensitivity: (context) =>
    buildFactOrPathMetric(
      'passiveSensitivity',
      ls('Passive sensitivity', 'Sensibilite passive', 'Passive Empfindlichkeit'),
      context,
      ['passiveSensitivity', 'sensitivity'],
    ),

  pierce: (context) =>
    buildFactOrPathMetric(
      'pierce',
      ls('Pierce', 'Percement', 'Durchdringung'),
      context,
      ['pierce'],
    ),

  focusRange: (context) =>
    buildFactOrPathMetric(
      'focusRange',
      ls('Focus range', 'Portee focus', 'Fokusreichweite'),
      context,
      ['focusRange', 'passiveRange'],
    ),

  dps: (context) =>
    buildFactOrPathMetric(
      'dps',
      ls('DPS', 'DPS', 'DPS'),
      context,
      ['dps', 'damage'],
      [['stats', 'weapon', 'dps']],
      formatRawNumberMetric,
    ),

  ammoOrHeat: (context) =>
    buildFactOrPathMetric(
      'ammoOrHeat',
      ls('Ammo / heat', 'Munitions / chaleur', 'Munition / Hitze'),
      context,
      ['ammo', 'heat'],
    ),

  missileSize: (context) =>
    buildFactOrPathMetric(
      'missileSize',
      ls('Missile size', 'Taille missile', 'Raketengrosse'),
      context,
      ['missileSize'],
      [['stats', 'missileRack', 'missileSize']],
      formatRawNumberMetric,
    ),

  launchDelay: (context) =>
    buildFactOrPathMetric(
      'launchDelay',
      ls('Launch delay', 'Delai tir', 'Startverzogerung'),
      context,
      ['launchDelay'],
      [['stats', 'missileRack', 'launchDelay']],
      formatSecondsMetric,
    ),

  rackSize: (context) =>
    buildFactOrPathMetric(
      'rackSize',
      ls('Rack size', 'Taille rack', 'Gestellgrosse'),
      context,
      ['rackSize'],
      [['identity', 'attachDef', 'size']],
      formatRawNumberMetric,
    ),

  chargeTime: (context) =>
    buildFactOrPathMetric(
      'chargeTime',
      ls('Charge time', 'Temps charge', 'Ladezeit'),
      context,
      ['chargeTime'],
      [['stats', 'emp', 'chargeTime']],
      formatSecondsMetric,
    ),

  empRadius: (context) =>
    buildFactOrPathMetric(
      'empRadius',
      ls('EMP radius', 'Rayon EMP', 'EMP-Radius'),
      context,
      ['empRadius'],
      [['stats', 'emp', 'radius']],
      formatMetersMetric,
    ),

  distortionOutput: (context) =>
    buildFactOrPathMetric(
      'distortionOutput',
      ls('Distortion output', 'Sortie distortion', 'Verzerrungsleistung'),
      context,
      ['distortionOutput'],
      [['stats', 'emp', 'distortionOutput']],
      formatRawNumberMetric,
    ),

  snareRange: (context) =>
    buildFactOrPathMetric(
      'snareRange',
      ls('Snare range', 'Portee snare', 'Snare-Reichweite'),
      context,
      ['snareRange'],
      [['stats', 'qed', 'snareRange']],
      formatMetersMetric,
    ),

  dampenerRange: (context) =>
    buildFactOrPathMetric(
      'dampenerRange',
      ls('Dampener range', 'Portee dampener', 'Dampener-Reichweite'),
      context,
      ['dampenerRange'],
      [['stats', 'qed', 'dampenerRange']],
      formatMetersMetric,
    ),

  activationTime: (context) =>
    buildFactOrPathMetric(
      'activationTime',
      ls('Activation time', 'Temps activation', 'Aktivierungszeit'),
      context,
      ['activationTime'],
      [['stats', 'qed', 'activationTime']],
      formatSecondsMetric,
    ),

  calibrationTime: (context) =>
    buildFactOrPathMetric(
      'calibrationTime',
      ls('Calibration', 'Calibration', 'Kalibrierung'),
      context,
      ['calibrationTime'],
      [['stats', 'jumpDrive', 'calibrationTime']],
      formatSecondsMetric,
    ),

  jumpPrep: (context) =>
    buildFactOrPathMetric(
      'jumpPrep',
      ls('Jump prep', 'Preparation saut', 'Sprungvorbereitung'),
      context,
      ['jumpPrep'],
      [['stats', 'jumpDrive', 'jumpPrep']],
      formatSecondsMetric,
    ),

  thrust: (context) =>
    buildFactOrPathMetric(
      'thrust',
      ls('Thrust', 'Poussee', 'Schub'),
      context,
      ['thrust'],
      [['stats', 'thruster', 'thrust']],
      formatRawNumberMetric,
    ),

  responseTime: (context) =>
    buildFactOrPathMetric(
      'responseTime',
      ls('Response', 'Reponse', 'Ansprechzeit'),
      context,
      ['responseTime'],
      [['stats', 'thruster', 'responseTime']],
      formatSecondsMetric,
    ),

  fuelUse: (context) =>
    buildFactOrPathMetric(
      'fuelUse',
      ls('Fuel use', 'Conso. carburant', 'Treibstoffverbrauch'),
      context,
      ['fuelUse'],
      [['stats', 'thruster', 'fuelUse']],
    ),

  transferRate: (context) =>
    buildFactOrPathMetric(
      'transferRate',
      ls('Transfer rate', 'Debit transfert', 'Transferrate'),
      context,
      ['transferRate', 'flowRate'],
    ),

  intakeRate: (context) =>
    buildFactOrPathMetric(
      'intakeRate',
      ls('Intake rate', 'Debit intake', 'Aufnahmerate'),
      context,
      ['intakeRate'],
      [['stats', 'fuelIntake', 'intakeRate']],
    ),

  efficiency: (context) =>
    buildFactOrPathMetric(
      'efficiency',
      ls('Efficiency', 'Rendement', 'Effizienz'),
      context,
      ['efficiency'],
      [['stats', 'fuelIntake', 'efficiency']],
    ),

  operatingEnvelope: (context) =>
    buildFactOrPathMetric(
      'operatingEnvelope',
      ls('Operating envelope', 'Envelope operationnelle', 'Betriebsbereich'),
      context,
      ['operatingEnvelope'],
      [['stats', 'fuelIntake', 'operatingEnvelope']],
    ),

  rechargeRate: (context) =>
    buildFactOrPathMetric(
      'rechargeRate',
      ls('Recharge rate', 'Debit recharge', 'Laderate'),
      context,
      ['rechargeRate'],
      [['stats', 'battery', 'rechargeRate']],
    ),

  dischargeRate: (context) =>
    buildFactOrPathMetric(
      'dischargeRate',
      ls('Discharge rate', 'Debit decharge', 'Entladerate'),
      context,
      ['dischargeRate'],
      [['stats', 'battery', 'dischargeRate']],
    ),

  bladeSlots: (context) =>
    buildFactOrPathMetric(
      'bladeSlots',
      ls('Blade slots', 'Slots blade', 'Blade-Slots'),
      context,
      ['bladeSlots'],
      [['stats', 'computer', 'bladeSlots']],
      formatRawNumberMetric,
    ),

  role: ({ component, facts }) =>
    metricFromString(
      'role',
      ls('Role', 'Role', 'Rolle'),
      facts.role ?? component.displayType ?? null,
    ),

  signatureBias: ({ facts }) =>
    metricFromString(
      'signatureBias',
      ls('Signature bias', 'Biais signature', 'Signaturfokus'),
      facts.signatureBias ?? null,
    ),
};

export const SHIP_COMPONENT_CARD_PROFILES: Record<
  ShipComponentCardProfileKey,
  ShipComponentCardProfile
> = {
  scanner: {
    key: 'scanner',
    family: 'scanner',
    status: 'now',
    label: ls('Scanner', 'Scanner', 'Scanner'),
    heroMetricIds: ['standardSensitivity', 'rsSensitivity', 'batterySlot'],
    chipMetricIds: ['size', 'grade', 'focusAngleRange'],
    detailMetricIds: ['mass'],
    notes: 'Sensitivity is modeled as focus-tier progression. Focus values are angular scan cones, not radius values.',
  },
  'refueling-nozzle': {
    key: 'refueling-nozzle',
    family: 'refueling-nozzle',
    status: 'now',
    label: ls('Refueling nozzle', 'Bec de ravitaillement', 'Betankungsdusse'),
    heroMetricIds: ['safeFlowRate', 'flowSpeedModifier', 'tankCapacityModifier'],
    chipMetricIds: ['size', 'captureRadius', 'fuelDamageMultiplier'],
    detailMetricIds: ['mass', 'charges'],
  },
  'fuel-pod': {
    key: 'fuel-pod',
    family: 'fuel-pod',
    status: 'now',
    label: ls('Fuel pod', 'Pod carburant', 'Treibstofftank'),
    heroMetricIds: ['capacity', 'flowRate', 'mass'],
    chipMetricIds: ['size', 'gridFootprint', 'compatibleHull'],
    detailMetricIds: ['grade', 'charges'],
  },
  'salvage-head': {
    key: 'salvage-head',
    family: 'salvage-head',
    status: 'now',
    label: ls('Salvage head', 'Tete de salvage', 'Bergungskopf'),
    heroMetricIds: ['size', 'modifierSlots', 'maxRange'],
    chipMetricIds: ['moduleCapacity', 'mass', 'salvageMount'],
    detailMetricIds: ['grade', 'activationMethod'],
  },
  'salvage-modifier:scraper': {
    key: 'salvage-modifier:scraper',
    family: 'salvage-modifier',
    status: 'now',
    label: ls('Scraper modifier', 'Module scraper', 'Scraper-Modul'),
    heroMetricIds: ['extractionSpeed', 'extractionEfficiency', 'radius'],
    chipMetricIds: ['activationMethod', 'charges', 'subtype'],
    detailMetricIds: ['salvageSpeedMultiplier', 'radiusMultiplier', 'efficiencyMultiplier'],
  },
  'salvage-modifier:tractor': {
    key: 'salvage-modifier:tractor',
    family: 'salvage-modifier',
    status: 'now',
    label: ls('Tractor modifier', 'Module tracteur', 'Traktor-Modul'),
    heroMetricIds: ['maxRange', 'fullStrengthDistance', 'maxAngle'],
    chipMetricIds: ['activationMethod', 'charges', 'subtype'],
    detailMetricIds: ['mass'],
  },
  'salvage-modifier:buff': {
    key: 'salvage-modifier:buff',
    family: 'salvage-modifier',
    status: 'now',
    label: ls('Salvage buff', 'Buff de salvage', 'Bergungs-Buff'),
    heroMetricIds: ['salvageSpeedMultiplier', 'radiusMultiplier', 'efficiencyMultiplier'],
    chipMetricIds: ['activationMethod', 'subtype', 'charges'],
    detailMetricIds: ['mass'],
  },
  'mining-laser': {
    key: 'mining-laser',
    family: 'mining-laser',
    status: 'now',
    label: ls('Mining laser', 'Laser de minage', 'Bergbaulaser'),
    heroMetricIds: ['miningLaserPower', 'optimalRange', 'moduleSlots'],
    chipMetricIds: ['size', 'maxRange', 'resistance', 'instability', 'chargeWindow'],
    detailMetricIds: ['mass', 'grade', 'powerDraw'],
  },
  'mining-module:active': {
    key: 'mining-module:active',
    family: 'mining-module',
    status: 'now',
    label: ls('Active mining module', 'Module de minage actif', 'Aktives Bergbaumodul'),
    heroMetricIds: ['powerModifier', 'duration', 'uses'],
    chipMetricIds: ['resistance', 'subtype', 'secondaryEffect'],
    detailMetricIds: ['activationMethod', 'charges'],
  },
  'mining-module:passive': {
    key: 'mining-module:passive',
    family: 'mining-module',
    status: 'now',
    label: ls('Passive mining module', 'Module de minage passif', 'Passives Bergbaumodul'),
    heroMetricIds: ['powerModifier', 'chargeWindow', 'secondaryEffect'],
    chipMetricIds: ['activationMethod', 'charges', 'subtype'],
    detailMetricIds: ['mass'],
  },
  powerplant: {
    key: 'powerplant',
    family: 'powerplant',
    status: 'next',
    label: ls('Power plant', 'Centrale electrique', 'Kraftwerk'),
    heroMetricIds: ['powerOutput', 'coolantConsumption', 'emSignature'],
    chipMetricIds: ['size', 'grade', 'mass'],
    detailMetricIds: ['irSignature', 'powerDraw'],
  },
  cooler: {
    key: 'cooler',
    family: 'cooler',
    status: 'next',
    label: ls('Cooler', 'Refroidisseur', 'Kuhler'),
    heroMetricIds: ['coolingOutput', 'powerConsumption', 'irSignature'],
    chipMetricIds: ['size', 'grade', 'mass'],
    detailMetricIds: ['emSignature'],
  },
  'shield-generator': {
    key: 'shield-generator',
    family: 'shield-generator',
    status: 'next',
    label: ls('Shield generator', 'Generateur de bouclier', 'Schildgenerator'),
    heroMetricIds: ['shieldHp', 'regenPerSec', 'regenDelay'],
    chipMetricIds: ['size', 'grade', 'powerDraw'],
    detailMetricIds: ['mass'],
  },
  'quantum-drive': {
    key: 'quantum-drive',
    family: 'quantum-drive',
    status: 'next',
    label: ls('Quantum drive', 'Moteur quantique', 'Quantenantrieb'),
    heroMetricIds: ['quantumSpeed', 'spoolUpTime', 'fuelRequirement'],
    chipMetricIds: ['size', 'grade', 'cooldownTime'],
    detailMetricIds: ['powerDraw'],
  },
  radar: {
    key: 'radar',
    family: 'radar',
    status: 'next',
    label: ls('Radar', 'Radar', 'Radar'),
    heroMetricIds: ['passiveSensitivity', 'pierce', 'focusRange'],
    chipMetricIds: ['size', 'grade', 'signatureBias'],
    detailMetricIds: ['powerDraw'],
  },
  'ship-weapon': {
    key: 'ship-weapon',
    family: 'ship-weapon',
    status: 'next',
    label: ls('Ship weapon', 'Arme de vaisseau', 'Schiffswaffe'),
    heroMetricIds: ['dps', 'maxRange', 'ammoOrHeat'],
    chipMetricIds: ['size', 'grade', 'powerDraw'],
    detailMetricIds: ['mass'],
  },
  'missile-rack': {
    key: 'missile-rack',
    family: 'missile-rack',
    status: 'next',
    label: ls('Missile rack', 'Rack de missiles', 'Raketenhalterung'),
    heroMetricIds: ['missileSize', 'capacity', 'launchDelay'],
    chipMetricIds: ['rackSize', 'grade', 'mass'],
    detailMetricIds: ['size'],
  },
  emp: {
    key: 'emp',
    family: 'emp',
    status: 'next',
    label: ls('EMP', 'EMP', 'EMP'),
    heroMetricIds: ['chargeTime', 'empRadius', 'distortionOutput'],
    chipMetricIds: ['size', 'cooldownTime', 'powerDraw'],
    detailMetricIds: ['mass'],
  },
  'qed-qid': {
    key: 'qed-qid',
    family: 'qed-qid',
    status: 'next',
    label: ls('QED / QID', 'QED / QID', 'QED / QID'),
    heroMetricIds: ['snareRange', 'dampenerRange', 'activationTime'],
    chipMetricIds: ['size', 'cooldownTime', 'powerDraw'],
    detailMetricIds: ['mass'],
  },
  'jump-drive': {
    key: 'jump-drive',
    family: 'jump-drive',
    status: 'next',
    label: ls('Jump drive', 'Moteur de saut', 'Sprungantrieb'),
    heroMetricIds: ['calibrationTime', 'jumpPrep', 'cooldownTime'],
    chipMetricIds: ['size', 'grade', 'powerDraw'],
    detailMetricIds: ['mass'],
  },
  thruster: {
    key: 'thruster',
    family: 'thruster',
    status: 'later',
    label: ls('Thruster', 'Propulseur', 'Triebwerk'),
    heroMetricIds: ['thrust', 'responseTime', 'fuelUse'],
    chipMetricIds: ['size', 'grade', 'powerDraw'],
    detailMetricIds: ['mass'],
  },
  'fuel-tank': {
    key: 'fuel-tank',
    family: 'fuel-tank',
    status: 'later',
    label: ls('Fuel tank', 'Reservoir', 'Treibstofftank'),
    heroMetricIds: ['capacity', 'transferRate', 'mass'],
    chipMetricIds: ['size', 'grade', 'compatibleHull'],
    detailMetricIds: ['gridFootprint'],
  },
  'fuel-intake': {
    key: 'fuel-intake',
    family: 'fuel-intake',
    status: 'later',
    label: ls('Fuel intake', 'Prise carburant', 'Treibstoffaufnahme'),
    heroMetricIds: ['intakeRate', 'efficiency', 'operatingEnvelope'],
    chipMetricIds: ['size', 'grade', 'mass'],
    detailMetricIds: ['powerDraw'],
  },
  battery: {
    key: 'battery',
    family: 'battery',
    status: 'later',
    label: ls('Battery', 'Batterie', 'Batterie'),
    heroMetricIds: ['capacity', 'rechargeRate', 'dischargeRate'],
    chipMetricIds: ['size', 'grade', 'mass'],
    detailMetricIds: ['powerDraw'],
  },
  computer: {
    key: 'computer',
    family: 'computer',
    status: 'later',
    label: ls('Computer', 'Ordinateur', 'Computer'),
    heroMetricIds: ['bladeSlots', 'powerDraw', 'role'],
    chipMetricIds: ['size', 'grade', 'mass'],
    detailMetricIds: ['charges'],
  },
};

function isSalvageTractorVariant(facts: ShipComponentFactMap): boolean {
  const itemType = facts.itemType?.toLowerCase() ?? '';
  return itemType.includes('tractor') || Boolean(facts.maxRange || facts.maxAngle || facts.fullStrengthDistance);
}

function isSalvageScraperVariant(facts: ShipComponentFactMap): boolean {
  const itemType = facts.itemType?.toLowerCase() ?? '';
  return itemType.includes('scraper') || Boolean(facts.extractionSpeed || facts.extractionEfficiency || facts.radius);
}

function isActiveMiningModule(component: ShipComponentEntry, facts: ShipComponentFactMap): boolean {
  const itemType = facts.itemType?.toLowerCase() ?? '';
  if (itemType.includes('(active)')) {
    return true;
  }

  if (itemType.includes('(passive)')) {
    return false;
  }

  if (facts.duration || facts.uses) {
    return true;
  }

  const activationMethod = getStringAtPaths(
    component,
    facts,
    [],
    [['stats', 'attachableModifier', 'activationMethod']],
  );
  const charges = getNumberAtPaths(
    component,
    facts,
    [],
    [['stats', 'attachableModifier', 'charges']],
  );

  return activationMethod === 'ActivateOnDemand' && (charges ?? 0) > 1;
}

export function resolveShipComponentCardProfileKey(
  component: ShipComponentEntry,
): ShipComponentCardProfileKey {
  const family = (component.family ?? '').toLowerCase();
  const facts = buildShipComponentFactMap(component);

  switch (family) {
    case 'scanner':
      return 'scanner';
    case 'refueling-nozzle':
      return 'refueling-nozzle';
    case 'fuel-pod':
      return 'fuel-pod';
    case 'salvage-head':
      return 'salvage-head';
    case 'salvage-modifier':
      if (isSalvageTractorVariant(facts)) {
        return 'salvage-modifier:tractor';
      }
      if (isSalvageScraperVariant(facts)) {
        return 'salvage-modifier:scraper';
      }
      return 'salvage-modifier:buff';
    case 'mining-laser':
      return 'mining-laser';
    case 'mining-module':
      return isActiveMiningModule(component, facts)
        ? 'mining-module:active'
        : 'mining-module:passive';
    case 'powerplant':
      return 'powerplant';
    case 'cooler':
      return 'cooler';
    case 'shieldgenerator':
    case 'shield-generator':
      return 'shield-generator';
    case 'quantumdrive':
    case 'quantum-drive':
      return 'quantum-drive';
    case 'radar':
      return 'radar';
    case 'ship-weapon':
    case 'weapon':
      return 'ship-weapon';
    case 'missile-rack':
    case 'missile-racks':
      return 'missile-rack';
    case 'emp':
      return 'emp';
    case 'qed':
    case 'qid':
    case 'qed-qid':
      return 'qed-qid';
    case 'jumpdrive':
    case 'jump-drive':
      return 'jump-drive';
    case 'thruster':
    case 'thrusters':
      return 'thruster';
    case 'fuel-tank':
    case 'fueltank':
      return 'fuel-tank';
    case 'fuel-intake':
    case 'fuelintake':
      return 'fuel-intake';
    case 'battery':
    case 'batteries':
      return 'battery';
    case 'computer':
    case 'computers':
      return 'computer';
    default:
      return 'scanner';
  }
}

function buildMetricList(
  metricIds: string[],
  context: ShipComponentMetricContext,
): ShipComponentCardMetric[] {
  return metricIds
    .map((metricId) => METRIC_BUILDERS[metricId]?.(context) ?? null)
    .filter((metric): metric is ShipComponentCardMetric => Boolean(metric));
}

export function buildShipComponentMetrics(
  component: ShipComponentEntry,
  metricIds: string[],
): ShipComponentCardMetric[] {
  return buildMetricList(metricIds, {
    component,
    facts: buildShipComponentFactMap(component),
  });
}

export function buildShipComponentCardModel(
  component: ShipComponentEntry,
): ShipComponentCardModel {
  const factMap = buildShipComponentFactMap(component);
  const profileKey = resolveShipComponentCardProfileKey(component);
  const profile = SHIP_COMPONENT_CARD_PROFILES[profileKey];
  const context = { component, facts: factMap };

  return {
    profileKey,
    profile,
    factMap,
    heroMetrics: buildMetricList(profile.heroMetricIds, context),
    chipMetrics: buildMetricList(profile.chipMetricIds, context),
    detailMetrics: buildMetricList(profile.detailMetricIds, context),
    scannerMatrix: profileKey === 'scanner' ? SHIP_SCANNER_SIGNATURE_CURVES : null,
  };
}
