import type { BlueprintIdentityFact, LocalizedString, ShipComponentEntry } from '../types';
import {
  buildShipComponentCardModel,
  buildShipComponentMetrics,
  type ShipComponentCardMetric,
  type ShipComponentCardProfileKey,
  type ShipScannerSignatureCurve,
} from './shipComponents';

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

function formatMicroScu(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  if (Math.abs(value) >= 1000) {
    const compact = value / 1000;
    const digits = Number.isInteger(compact) ? 0 : 1;
    return `${compact.toFixed(digits)}K microSCU`;
  }

  return `${value} microSCU`;
}

function formatGridSize(
  gridSize: { x?: number | null; y?: number | null } | null | undefined,
): string | null {
  if (!gridSize?.x || !gridSize?.y) {
    return null;
  }

  return `${gridSize.x} x ${gridSize.y}`;
}

function formatDimensionsMm(
  dimensions: { x?: number | null; y?: number | null; z?: number | null } | null | undefined,
): string | null {
  if (!dimensions?.x || !dimensions?.y || !dimensions?.z) {
    return null;
  }

  const values = [dimensions.x, dimensions.y, dimensions.z].map((value) =>
    Math.round(value * 1000),
  );

  return `${values[0]} x ${values[1]} x ${values[2]} mm`;
}

export type ShipComponentLeftColumnSectionKind =
  | 'brief'
  | 'field-data'
  | 'metric-grid'
  | 'scanner-matrix'
  | 'technical-tags';

interface ShipComponentLeftColumnSectionLayout {
  id: string;
  kind: ShipComponentLeftColumnSectionKind;
  label: LocalizedString;
  metricIds?: string[];
  factIds?: string[];
  includeCommonMetrics?: boolean;
  maxFacts?: number;
}

export interface ShipComponentCommonMetric {
  id: string;
  label: LocalizedString;
  value: string;
}

export interface ShipComponentLeftColumnSectionModel {
  id: string;
  kind: ShipComponentLeftColumnSectionKind;
  label: LocalizedString;
  description?: string | null;
  metrics?: ShipComponentCardMetric[];
  facts?: BlueprintIdentityFact[];
  commonMetrics?: ShipComponentCommonMetric[];
  scannerMatrix?: ShipScannerSignatureCurve[] | null;
  technicalTags?: string[];
}

export interface ShipComponentLeftColumnModel {
  profileKey: ShipComponentCardProfileKey;
  title: string;
  kicker: string;
  manufacturer: string | null;
  manufacturerLogoUrl: string | null;
  imageUrl: string | null;
  typeChips: string[];
  badges: string[];
  shortName: string | null;
  description: string | null;
  notes: string | null;
  sections: ShipComponentLeftColumnSectionModel[];
}

const BRIEF_SECTION = (): ShipComponentLeftColumnSectionLayout => ({
  id: 'brief',
  kind: 'brief',
  label: ls('Item brief', 'Fiche composant', 'Komponentenbrief'),
});

const TECHNICAL_TAGS_SECTION = (): ShipComponentLeftColumnSectionLayout => ({
  id: 'technical-tags',
  kind: 'technical-tags',
  label: ls('Technical tags', 'Tags techniques', 'Technische Tags'),
});

function createMetricGridSection(
  id: string,
  label: LocalizedString,
  metricIds: string[],
): ShipComponentLeftColumnSectionLayout {
  return {
    id,
    kind: 'metric-grid',
    label,
    metricIds,
  };
}

function createFieldDataSection(
  id: string,
  label: LocalizedString,
  options: {
    metricIds?: string[];
    factIds?: string[];
    includeCommonMetrics?: boolean;
    maxFacts?: number;
  } = {},
): ShipComponentLeftColumnSectionLayout {
  return {
    id,
    kind: 'field-data',
    label,
    metricIds: options.metricIds ?? [],
    factIds: options.factIds ?? [],
    includeCommonMetrics: options.includeCommonMetrics ?? false,
    maxFacts: options.maxFacts ?? 6,
  };
}

function createScannerMatrixSection(): ShipComponentLeftColumnSectionLayout {
  return {
    id: 'scanner-matrix',
    kind: 'scanner-matrix',
    label: ls('Signature matrix', 'Matrice signatures', 'Signaturmatrix'),
  };
}

export const SHIP_COMPONENT_LEFT_COLUMN_LAYOUTS: Record<
  ShipComponentCardProfileKey,
  ShipComponentLeftColumnSectionLayout[]
> = {
  scanner: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'detection-suite',
      ls('Detection suite', 'Suite detection', 'Erfassungsprofil'),
      ['standardSensitivity', 'rsSensitivity', 'batterySlot', 'focusAngleRange'],
    ),
    createScannerMatrixSection(),
    createFieldDataSection(
      'scanner-integration',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['mass'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'refueling-nozzle': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'transfer-profile',
      ls('Transfer profile', 'Profil transfert', 'Transferprofil'),
      ['safeFlowRate', 'flowSpeedModifier', 'tankCapacityModifier', 'captureRadius', 'fuelDamageMultiplier'],
    ),
    createFieldDataSection(
      'nozzle-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['mass', 'charges'],
        factIds: ['itemType'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'fuel-pod': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'storage-profile',
      ls('Storage profile', 'Profil stockage', 'Speicherprofil'),
      ['capacity', 'flowRate', 'mass', 'gridFootprint', 'compatibleHull'],
    ),
    createFieldDataSection(
      'fuel-pod-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['grade'],
        factIds: ['itemType', 'capacity', 'flowRate'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'salvage-head': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'beam-profile',
      ls('Beam profile', 'Profil beam', 'Strahlprofil'),
      ['size', 'modifierSlots', 'maxRange', 'moduleCapacity', 'salvageMount'],
    ),
    createFieldDataSection(
      'salvage-head-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['mass', 'grade'],
        factIds: ['itemType', 'moduleCapacity', 'size'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'salvage-modifier:scraper': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'scraper-profile',
      ls('Scraper profile', 'Profil scraper', 'Scraper-Profil'),
      ['extractionSpeed', 'extractionEfficiency', 'radius', 'salvageSpeedMultiplier', 'efficiencyMultiplier'],
    ),
    createFieldDataSection(
      'scraper-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['activationMethod', 'charges', 'subtype', 'mass'],
        factIds: ['itemType', 'extractionSpeed', 'extractionEfficiency', 'radius'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'salvage-modifier:tractor': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'tractor-profile',
      ls('Tractor profile', 'Profil tracteur', 'Traktorprofil'),
      ['maxRange', 'fullStrengthDistance', 'maxAngle', 'activationMethod', 'charges'],
    ),
    createFieldDataSection(
      'tractor-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['subtype', 'mass'],
        factIds: ['itemType', 'maxRange', 'fullStrengthDistance', 'maxAngle'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'salvage-modifier:buff': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'buff-profile',
      ls('Buff profile', 'Profil buff', 'Buff-Profil'),
      ['salvageSpeedMultiplier', 'radiusMultiplier', 'efficiencyMultiplier', 'activationMethod', 'charges'],
    ),
    createFieldDataSection(
      'buff-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['subtype', 'mass'],
        factIds: ['itemType'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'mining-laser': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'laser-profile',
      ls('Laser profile', 'Profil laser', 'Laserprofil'),
      ['miningLaserPower', 'optimalRange', 'maxRange', 'moduleSlots', 'chargeWindow'],
    ),
    createMetricGridSection(
      'rock-tuning',
      ls('Rock tuning', 'Tuning roche', 'Gesteinstuning'),
      ['resistance', 'instability', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'mining-laser-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        factIds: ['itemType', 'size', 'grade', 'resistance', 'laserInstability'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'mining-module:active': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'active-module-profile',
      ls('Effect profile', 'Profil effet', 'Effektprofil'),
      ['powerModifier', 'duration', 'uses', 'resistance', 'secondaryEffect'],
    ),
    createFieldDataSection(
      'active-module-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['activationMethod', 'charges', 'subtype', 'mass'],
        factIds: ['itemType', 'duration', 'uses', 'resistance', 'shatterDamage'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'mining-module:passive': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'passive-module-profile',
      ls('Effect profile', 'Profil effet', 'Effektprofil'),
      ['powerModifier', 'chargeWindow', 'secondaryEffect', 'resistance', 'mass'],
    ),
    createFieldDataSection(
      'passive-module-field-data',
      ls('Field data', 'Donnees terrain', 'Felddaten'),
      {
        metricIds: ['activationMethod', 'charges', 'subtype'],
        factIds: ['itemType', 'optimalChargeWindowSize', 'resistance', 'inertMaterialLevel'],
        includeCommonMetrics: true,
      },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  powerplant: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'power-core',
      ls('Power core', 'Coeur puissance', 'Leistungskern'),
      ['powerOutput', 'coolantConsumption', 'emSignature', 'irSignature', 'powerDraw'],
    ),
    createFieldDataSection(
      'powerplant-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade', 'mass'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  cooler: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'cooling-profile',
      ls('Cooling profile', 'Profil refroidissement', 'Kuhlprofil'),
      ['coolingOutput', 'powerConsumption', 'irSignature', 'emSignature', 'mass'],
    ),
    createFieldDataSection(
      'cooler-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'shield-generator': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'shield-profile',
      ls('Shield profile', 'Profil bouclier', 'Schildprofil'),
      ['shieldHp', 'regenPerSec', 'regenDelay', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'shield-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'quantum-drive': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'quantum-profile',
      ls('Quantum profile', 'Profil quantique', 'Quantenprofil'),
      ['quantumSpeed', 'spoolUpTime', 'fuelRequirement', 'cooldownTime', 'powerDraw'],
    ),
    createFieldDataSection(
      'quantum-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade', 'mass'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  radar: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'radar-profile',
      ls('Radar profile', 'Profil radar', 'Radarprofil'),
      ['passiveSensitivity', 'pierce', 'focusRange', 'signatureBias', 'powerDraw'],
    ),
    createFieldDataSection(
      'radar-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade', 'mass'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'ship-weapon': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'weapon-profile',
      ls('Weapon profile', 'Profil arme', 'Waffenprofil'),
      ['dps', 'maxRange', 'ammoOrHeat', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'weapon-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'missile-rack': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'rack-profile',
      ls('Rack profile', 'Profil rack', 'Rackprofil'),
      ['missileSize', 'capacity', 'launchDelay', 'rackSize', 'mass'],
    ),
    createFieldDataSection(
      'rack-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  emp: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'emp-profile',
      ls('EMP profile', 'Profil EMP', 'EMP-Profil'),
      ['chargeTime', 'empRadius', 'distortionOutput', 'cooldownTime', 'powerDraw'],
    ),
    createFieldDataSection(
      'emp-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'mass'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'qed-qid': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'qed-profile',
      ls('QED profile', 'Profil QED', 'QED-Profil'),
      ['snareRange', 'dampenerRange', 'activationTime', 'cooldownTime', 'powerDraw'],
    ),
    createFieldDataSection(
      'qed-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'mass'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'jump-drive': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'jump-profile',
      ls('Jump profile', 'Profil saut', 'Sprungprofil'),
      ['calibrationTime', 'jumpPrep', 'cooldownTime', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'jump-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  thruster: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'thruster-profile',
      ls('Thruster profile', 'Profil propulseur', 'Triebwerksprofil'),
      ['thrust', 'responseTime', 'fuelUse', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'thruster-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'fuel-tank': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'tank-profile',
      ls('Tank profile', 'Profil reservoir', 'Tankprofil'),
      ['capacity', 'transferRate', 'mass', 'compatibleHull', 'gridFootprint'],
    ),
    createFieldDataSection(
      'tank-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  'fuel-intake': [
    BRIEF_SECTION(),
    createMetricGridSection(
      'intake-profile',
      ls('Intake profile', 'Profil intake', 'Ansaugprofil'),
      ['intakeRate', 'efficiency', 'operatingEnvelope', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'intake-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  battery: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'battery-profile',
      ls('Battery profile', 'Profil batterie', 'Batterieprofil'),
      ['capacity', 'rechargeRate', 'dischargeRate', 'powerDraw', 'mass'],
    ),
    createFieldDataSection(
      'battery-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
  computer: [
    BRIEF_SECTION(),
    createMetricGridSection(
      'computer-profile',
      ls('Computer profile', 'Profil ordinateur', 'Computerprofil'),
      ['bladeSlots', 'powerDraw', 'role', 'charges', 'mass'],
    ),
    createFieldDataSection(
      'computer-field-data',
      ls('Integration data', 'Donnees integration', 'Integrationsdaten'),
      { metricIds: ['size', 'grade'], includeCommonMetrics: true },
    ),
    TECHNICAL_TAGS_SECTION(),
  ],
};

function buildCommonMetrics(component: ShipComponentEntry): ShipComponentCommonMetric[] {
  const inventory = component.identity?.inventoryOccupancy;
  const attachDef = component.identity?.attachDef;
  const metrics: ShipComponentCommonMetric[] = [];
  const inventoryVolume =
    inventory?.standardCargoUnits != null
      ? `${inventory.standardCargoUnits} SCU`
      : inventory?.standardResourceUnits != null
        ? `${inventory.standardResourceUnits} SRU`
        : formatMicroScu(inventory?.microScu);
  const gridSize = formatGridSize(inventory?.gridSize);
  const footprint = formatDimensionsMm(inventory?.dimensions);
  const attachProfile = [humanizeToken(attachDef?.type), humanizeToken(attachDef?.subType)]
    .filter(Boolean)
    .join(' / ');

  if (inventoryVolume) {
    metrics.push({
      id: 'inventoryVolume',
      label: ls('Inventory volume', 'Volume inventaire', 'Inventarvolumen'),
      value: inventoryVolume,
    });
  }

  if (gridSize) {
    metrics.push({
      id: 'gridSize',
      label: ls('Grid size', 'Taille grille', 'Rastergrosse'),
      value: gridSize,
    });
  }

  if (footprint) {
    metrics.push({
      id: 'footprint',
      label: ls('Footprint', 'Encombrement', 'Abmessungen'),
      value: footprint,
    });
  }

  if (attachProfile) {
    metrics.push({
      id: 'attachProfile',
      label: ls('Attach profile', 'Profil equipement', 'Anbauprofil'),
      value: attachProfile,
    });
  }

  return metrics;
}

function buildTechnicalTags(component: ShipComponentEntry): string[] {
  const attachDef = component.identity?.attachDef;
  const tags = new Set<string>();

  if (attachDef?.size != null) {
    tags.add(`Size ${attachDef.size}`);
  }

  if (attachDef?.grade != null) {
    tags.add(`Grade ${attachDef.grade}`);
  }

  for (const tag of [...(attachDef?.tags ?? []), ...(attachDef?.requiredTags ?? [])]) {
    const rendered = humanizeToken(tag) ?? tag;
    if (rendered) {
      tags.add(rendered);
    }
  }

  return [...tags];
}

function buildTypeChips(component: ShipComponentEntry, profileLabel: string): string[] {
  const chips = new Set<string>();
  const renderedDisplayType = component.displayType?.trim();
  const factItemType = (component.descriptionFacts ?? []).find((fact) => fact.id === 'itemType')?.value?.trim();

  if (renderedDisplayType) {
    chips.add(renderedDisplayType);
  }

  if (factItemType && factItemType !== renderedDisplayType) {
    chips.add(factItemType);
  }

  const attachSubType = humanizeToken(component.identity?.attachDef?.subType);
  if (attachSubType && attachSubType !== renderedDisplayType) {
    chips.add(attachSubType);
  }

  chips.add(profileLabel);

  return [...chips];
}

function pickFacts(
  component: ShipComponentEntry,
  factIds: string[] = [],
  maxFacts = 6,
): BlueprintIdentityFact[] {
  const facts = (component.descriptionFacts ?? []).filter(
    (fact) => fact.label && fact.value && fact.id !== 'manufacturer',
  );

  if (factIds.length === 0) {
    return facts.slice(0, maxFacts);
  }

  const ordered = factIds
    .map((factId) => facts.find((fact) => fact.id === factId) ?? null)
    .filter((fact): fact is BlueprintIdentityFact => Boolean(fact));

  return ordered.slice(0, maxFacts);
}

export function buildShipComponentLeftColumnModel(
  component: ShipComponentEntry,
): ShipComponentLeftColumnModel {
  const cardModel = buildShipComponentCardModel(component);
  const layout = SHIP_COMPONENT_LEFT_COLUMN_LAYOUTS[cardModel.profileKey];
  const manufacturerLogoUrl = component.media?.manufacturerLogo?.imageUrl ?? null;
  const imageUrl =
    component.media?.primaryVisual?.imageUrl ??
    component.media?.image?.imageUrl ??
    manufacturerLogoUrl;
  const shortName =
    component.shortName &&
    component.name &&
    component.shortName.trim().toLowerCase() !== component.name.trim().toLowerCase()
      ? component.shortName
      : null;
  const description = component.descriptionBody ?? component.description ?? null;
  const profileLabel = cardModel.profile.label.en;
  const commonMetrics = buildCommonMetrics(component);
  const technicalTags = buildTechnicalTags(component);
  const badges = [
    profileLabel,
    component.identity?.attachDef?.size != null ? `Size ${component.identity.attachDef.size}` : null,
    component.identity?.attachDef?.grade != null ? `Grade ${component.identity.attachDef.grade}` : null,
  ].filter((value): value is string => Boolean(value));
  const sections: ShipComponentLeftColumnSectionModel[] = [];

  for (const section of layout) {
    if (section.kind === 'brief') {
      if (!description) {
        continue;
      }

      sections.push({
        id: section.id,
        kind: section.kind,
        label: section.label,
        description,
      });
      continue;
    }

    if (section.kind === 'scanner-matrix') {
      if (!cardModel.scannerMatrix?.length) {
        continue;
      }

      sections.push({
        id: section.id,
        kind: section.kind,
        label: section.label,
        scannerMatrix: cardModel.scannerMatrix,
      });
      continue;
    }

    if (section.kind === 'technical-tags') {
      if (technicalTags.length === 0) {
        continue;
      }

      sections.push({
        id: section.id,
        kind: section.kind,
        label: section.label,
        technicalTags,
      });
      continue;
    }

    const metrics = buildShipComponentMetrics(component, section.metricIds ?? []);
    const facts = pickFacts(component, section.factIds ?? [], section.maxFacts ?? 6);
    const sectionCommonMetrics = section.includeCommonMetrics ? commonMetrics : [];

    if (metrics.length === 0 && facts.length === 0 && sectionCommonMetrics.length === 0) {
      continue;
    }

    sections.push({
      id: section.id,
      kind: section.kind,
      label: section.label,
      metrics,
      facts,
      commonMetrics: sectionCommonMetrics,
    });
  }

  return {
    profileKey: cardModel.profileKey,
    title: component.name ?? cardModel.profile.label.en,
    kicker: shortName ?? `${profileLabel} dossier`,
    manufacturer: component.manufacturer ?? null,
    manufacturerLogoUrl,
    imageUrl,
    typeChips: buildTypeChips(component, profileLabel),
    badges,
    shortName,
    description,
    notes: cardModel.profile.notes ?? null,
    sections,
  };
}
