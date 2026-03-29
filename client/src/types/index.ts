export type Lang = 'en' | 'fr' | 'de';
export interface LocalizedString {
  en: string;
  fr: string;
  de?: string;
}

export const LS_KEYS = {
  GOALS: 'sc-craft-goals',
  PLANNER_GOAL_ORDER: 'sc-craft-planner-goal-order',
  PLANNER_RESOURCE_REQUIREMENTS: 'sc-craft-planner-resource-requirements',
  PLANNER_RESOURCE_ORDER: 'sc-craft-planner-resource-order',
  FAVORITES: 'sc-craft-favorites',
  LANG: 'sc-craft-lang',
  THEME: 'sc-craft-theme',
  DATASET_SELECTIONS: 'sc-craft-dataset-selections',
  INVENTORY: 'sc-craft-inventory',
  INVENTORY_SEED_VERSION: 'sc-craft-inventory-seed-version',
  NAV_COLLAPSED: 'sc-craft-nav-collapsed',
  RESOURCE_PROGRESS: 'sc-craft-resource-progress',
  ORGANIZATIONS_ACCORDIONS: 'sc-craft-organizations-accordions',
} as const;

export interface GppModifier {
  gppId: string;
  modAtMin: number;
  modAtMax: number;
  qualityStart: number;
  qualityEnd: number;
  occurrenceCount: number;
}

export type MaterialSlotRequirementType = 'resource' | 'item';
export type MaterialSlotQuantityUnit = 'scu' | 'count';
export type ResourceSourceMethod = 'ship-mining' | 'hand-mining';

export interface MaterialSlot {
  id: string;
  label: LocalizedString;
  requirementType: MaterialSlotRequirementType;
  requirementName: string;
  requiredResource: string;
  requiredItem: string | null;
  requiredItemClass: string | null;
  minQuality: number | null;
  quantityScu: number;
  quantityValue: number;
  quantityUnit: MaterialSlotQuantityUnit;
  quantityMultiplier: number | null;
  modifiers: GppModifier[];
}

export interface ItemStats {
  damage?: number;
  rateOfFire?: number;
  magazineSize?: number;
  effectiveRange?: number;
  recoilSmoothness?: number;
  recoilHandling?: number;
  recoilKick?: number;
  damageResistanceKinetic?: number;
  damageResistanceEnergy?: number;
  damageResistanceThermal?: number;
  damageResistanceDistortion?: number;
  damageResistanceBiochemical?: number;
  damageResistanceStun?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  radiationDissipation?: number;

  // Weapon-specific categorical & tactical stats
  weaponType?: string;
  ammoType?: string;
  ammoFlavor?: string;
  projectileSpeed?: number;
  idealCombatRange?: number;

  // Armor-specific categorical & tactical stats
  armorType?: string;
  armorSlot?: string;
  wearMovementMultiplier?: number;
  wearSprintMultiplier?: number;
  wearAimingMultiplier?: number;
  radiationCapacity?: number;
  impactForceResistance?: number;
}

export type NumericItemStatKey = {
  [K in keyof ItemStats]-?: Exclude<ItemStats[K], undefined> extends number ? K : never;
}[keyof ItemStats];

export const NUMERIC_ITEM_STAT_KEYS = [
  'damage',
  'rateOfFire',
  'magazineSize',
  'effectiveRange',
  'recoilSmoothness',
  'recoilHandling',
  'recoilKick',
  'damageResistanceKinetic',
  'damageResistanceEnergy',
  'damageResistanceThermal',
  'damageResistanceDistortion',
  'damageResistanceBiochemical',
  'damageResistanceStun',
  'temperatureMin',
  'temperatureMax',
  'radiationDissipation',
  'projectileSpeed',
  'idealCombatRange',
  'wearMovementMultiplier',
  'wearSprintMultiplier',
  'wearAimingMultiplier',
  'radiationCapacity',
  'impactForceResistance',
] as const satisfies readonly NumericItemStatKey[];

export function isNumericItemStatKey(key: keyof ItemStats): key is NumericItemStatKey {
  return (NUMERIC_ITEM_STAT_KEYS as readonly string[]).includes(key);
}

export const ARMOR_DAMAGE_RESISTANCE_KEYS = [
  'damageResistanceKinetic',
  'damageResistanceEnergy',
  'damageResistanceThermal',
  'damageResistanceDistortion',
  'damageResistanceBiochemical',
  'damageResistanceStun',
] as const satisfies readonly NumericItemStatKey[];

export const DIRECT_GPP_TO_STAT: Partial<Record<string, NumericItemStatKey>> = {
  GPP_Weapon_Damage: 'damage',
  GPP_Weapon_FireRate: 'rateOfFire',
  GPP_Weapon_Recoil_Smoothness: 'recoilSmoothness',
  GPP_Weapon_Recoil_Handling: 'recoilHandling',
  GPP_Weapon_Recoil_Kick: 'recoilKick',
  GPP_Armor_TemperatureMin: 'temperatureMin',
  GPP_Armor_TemperatureMax: 'temperatureMax',
  GPP_Armor_RadiationDissipation: 'radiationDissipation',
};

export const GPP_LABELS: Record<string, LocalizedString> = {
  GPP_Weapon_Damage: { en: 'Damage', fr: 'Degats', de: 'Schaden' },
  GPP_Weapon_FireRate: { en: 'Rate of Fire', fr: 'Cadence', de: 'Feuerrate' },
  GPP_Weapon_Recoil_Smoothness: { en: 'Recoil Smoothness', fr: 'Fluidite recul', de: 'Rückstoßglätte' },
  GPP_Weapon_Recoil_Handling: { en: 'Recoil Handling', fr: 'Gestion recul', de: 'Rückstoßkontrolle' },
  GPP_Weapon_Recoil_Kick: { en: 'Recoil Kick', fr: 'Recul', de: 'Rückstoß' },
  GPP_Armor_DamageMitigation: { en: 'Damage Resistance', fr: 'Resistance', de: 'Schadensresistenz' },
  GPP_Armor_TemperatureMin: { en: 'Min Temperature', fr: 'Temperature min', de: 'Min. Temperatur' },
  GPP_Armor_TemperatureMax: { en: 'Max Temperature', fr: 'Temperature max', de: 'Max. Temperatur' },
  GPP_Armor_RadiationDissipation: { en: 'Radiation Dissipation', fr: 'Dissipation radiation', de: 'Strahlungsableitung' },
};

export const STAT_LABELS: Record<keyof ItemStats, LocalizedString> = {
  damage: { en: 'Damage', fr: 'Degats', de: 'Schaden' },
  rateOfFire: { en: 'Rate of Fire', fr: 'Cadence', de: 'Feuerrate' },
  magazineSize: { en: 'Magazine', fr: 'Chargeur', de: 'Magazin' },
  effectiveRange: { en: 'Range', fr: 'Portee', de: 'Reichweite' },
  recoilSmoothness: { en: 'Recoil Smoothness', fr: 'Fluidite recul', de: 'Rückstoßglätte' },
  recoilHandling: { en: 'Recoil Handling', fr: 'Gestion recul', de: 'Rückstoßkontrolle' },
  recoilKick: { en: 'Recoil Kick', fr: 'Recul', de: 'Rückstoß' },
  damageResistanceKinetic: { en: 'Kinetic Resist.', fr: 'Resist. cinetique', de: 'Kinet. Resist.' },
  damageResistanceEnergy: { en: 'Energy Resist.', fr: 'Resist. energie', de: 'Energie-Resist.' },
  damageResistanceThermal: { en: 'Thermal Resist.', fr: 'Resist. thermique', de: 'Therm. Resist.' },
  damageResistanceDistortion: { en: 'Distortion Resist.', fr: 'Resist. distortion', de: 'Verzerr.-Resist.' },
  damageResistanceBiochemical: { en: 'Biochemical Resist.', fr: 'Resist. biochimique', de: 'Bioch. Resist.' },
  damageResistanceStun: { en: 'Stun Resist.', fr: 'Resist. etourdissement', de: 'Betäub.-Resist.' },
  temperatureMin: { en: 'Temp. Min', fr: 'Temp. min', de: 'Temp. Min' },
  temperatureMax: { en: 'Temp. Max', fr: 'Temp. max', de: 'Temp. Max' },
  radiationDissipation: { en: 'Radiation Dissip.', fr: 'Dissip. radiation', de: 'Strahl.-Ableit.' },

  weaponType: { en: 'Weapon Type', fr: 'Type d\'arme', de: 'Waffentyp' },
  ammoType: { en: 'Ammo Type', fr: 'Type de munition', de: 'Munitionstyp' },
  ammoFlavor: { en: 'Ammo Flavor', fr: 'Saveur munition', de: 'Munitionsart' },
  projectileSpeed: { en: 'Muzzle Velocity', fr: 'Vitesse de sortie', de: 'Mündungsgeschw.' },
  idealCombatRange: { en: 'Ideal Range', fr: 'Portee ideale', de: 'Ideale Reichweite' },

  armorType: { en: 'Armor Type', fr: 'Type d\'armure', de: 'Rüstungstyp' },
  armorSlot: { en: 'Armor Slot', fr: 'Slot d\'armure', de: 'Rüstungsslot' },
  wearMovementMultiplier: { en: 'Movement Multiplier', fr: 'Mult. mouvement', de: 'Bewegungsfaktor' },
  wearSprintMultiplier: { en: 'Sprint Multiplier', fr: 'Mult. sprint', de: 'Sprintfaktor' },
  wearAimingMultiplier: { en: 'Aiming Multiplier', fr: 'Mult. visee', de: 'Zielfaktor' },
  radiationCapacity: { en: 'Radiation Capacity', fr: 'Capacite radiation', de: 'Strahlungskapazität' },
  impactForceResistance: { en: 'Impact Resistance', fr: 'Resist. impact', de: 'Aufprallresistenz' },
};

export const STAT_UNITS: Record<keyof ItemStats, string> = {
  damage: 'dmg',
  rateOfFire: 'rpm',
  magazineSize: 'rds',
  effectiveRange: 'm',
  recoilSmoothness: 'x',
  recoilHandling: 'x',
  recoilKick: 'x',
  damageResistanceKinetic: '%',
  damageResistanceEnergy: '%',
  damageResistanceThermal: '%',
  damageResistanceDistortion: '%',
  damageResistanceBiochemical: '%',
  damageResistanceStun: '%',
  temperatureMin: 'C',
  temperatureMax: 'C',
  radiationDissipation: 'mRem/s',
  
  weaponType: '',
  ammoType: '',
  ammoFlavor: '',
  projectileSpeed: 'm/s',
  idealCombatRange: 'm',
  
  armorType: '',
  armorSlot: '',
  wearMovementMultiplier: 'x',
  wearSprintMultiplier: 'x',
  wearAimingMultiplier: 'x',
  radiationCapacity: 'mRem',
  impactForceResistance: 'x',
};

export const STAT_PERCENT_KEYS = new Set<NumericItemStatKey>([
  'damageResistanceKinetic',
  'damageResistanceEnergy',
  'damageResistanceThermal',
  'damageResistanceDistortion',
  'damageResistanceBiochemical',
  'damageResistanceStun',
]);

export const STAT_LOWER_IS_BETTER = new Set<NumericItemStatKey>([
  'recoilSmoothness',
  'recoilHandling',
  'recoilKick',
]);

export type ItemCategory =
  | 'fps-weapon'
  | 'fps-magazine'
  | 'fps-armor'
  | 'fps-helmet'
  | 'fps-undersuit'
  | 'fps-backpack';

export type CategoryFilter = ItemCategory | 'all' | 'favorites' | 'obtainable';

export type LibrarySegment = 'all' | 'inventory' | 'favorites' | 'obtainable';

export type LegalityFilter = 'all' | 'lawful' | 'unlawful';

export type ResourceMethod = 'mission' | 'mining' | 'dismantle' | 'buy';

export interface ResourceProgress {
  collected: number;       // Generic collected amount, interpreted through the resource quantity unit
  method: ResourceMethod | null;
}

export interface PlannerResourceRequirement {
  quantity: number;
  quantityUnit: MaterialSlotQuantityUnit;
}

export type PlannerResourceRequirements = Record<string, PlannerResourceRequirement>;

export type RarityFilter = 'all' | Rarity | 'unknown';
export type SlotCountFilter = 'all' | '1' | '2' | '3';
export type CraftTimeBucket = 'all' | '<=60' | '61-120' | '121-180' | '180+';
export type StandingBucket = 'all' | 'none' | '1-999' | '1000-4999' | '5000-14999' | '15000+';
export type BlueprintSort =
  | 'name-asc'
  | 'manufacturer-asc'
  | 'craft-time-asc'
  | 'craft-time-desc'
  | 'slot-count-desc'
  | 'rarity-desc'
  | 'acquisition-desc'
  | 'damage-desc'
  | 'range-desc'
  | 'rate-of-fire-desc'
  | 'magazine-desc'
  | 'kinetic-desc'
  | 'energy-desc'
  | 'temp-max-desc';
export type MissionSort =
  | 'name-asc'
  | 'employer-asc'
  | 'standing-asc'
  | 'standing-desc'
  | 'scale-asc'
  | 'location-asc'
  | 'blueprint-count-asc'
  | 'blueprint-count-desc'
  | 'chance-desc';

export const CATEGORY_LABELS: Record<ItemCategory, LocalizedString> = {
  'fps-weapon': { en: 'FPS Weapon', fr: 'Arme FPS', de: 'FPS-Waffe' },
  'fps-magazine': { en: 'Magazine', fr: 'Chargeur', de: 'Magazin' },
  'fps-armor': { en: 'FPS Armor', fr: 'Armure FPS', de: 'FPS-Rüstung' },
  'fps-helmet': { en: 'Helmet', fr: 'Casque', de: 'Helm' },
  'fps-undersuit': { en: 'Undersuit', fr: 'Combinaison', de: 'Unteranzug' },
  'fps-backpack': { en: 'Backpack', fr: 'Sac a dos', de: 'Rucksack' },
};

export interface BlueprintMediaAsset {
  imageUrl: string | null;
  sourcePageUrl: string | null;
  sourceSite: string | null;
}

export interface BlueprintMedia {
  image: BlueprintMediaAsset | null;
  manufacturerLogo: BlueprintMediaAsset | null;
  primaryVisual: BlueprintMediaAsset | null;
}

export interface BlueprintIdentityFact {
  id?: string;
  label?: string;
  value?: string;
}

export interface BlueprintInventoryOccupancy {
  microScu?: number;
  dimensions?: {
    x?: number;
    y?: number;
    z?: number;
  };
  gridSize?: {
    x?: number;
    y?: number;
  };
}

export interface BlueprintAttachDef {
  type?: string;
  subType?: string;
  size?: number;
  grade?: number;
  tags?: string[];
  requiredTags?: string[];
}

export interface BlueprintIdentity {
  entitySlug?: string;
  entityPath?: string;
  displayNameKey?: string;
  shortName?: string;
  shortNameKey?: string;
  description?: string;
  descriptionKey?: string;
  descriptionBody?: string;
  descriptionFacts?: BlueprintIdentityFact[];
  displayIcon?: string;
  inventoryOccupancy?: BlueprintInventoryOccupancy;
  attachDef?: BlueprintAttachDef;
}

export interface Blueprint {
  id: string;
  name: string;
  manufacturer: string;
  category: ItemCategory;
  craftTimeSecs: number;
  baseStats: ItemStats;
  slots: MaterialSlot[];
  identity?: BlueprintIdentity;
  media?: BlueprintMedia;
  rarity?: 'legendary' | 'rare' | 'common';
  detailsLoaded?: boolean;
}

export type Rarity = 'legendary' | 'rare' | 'common';

export interface Resource {
  id: string;
  name: string;
  description: string;
  color: string;
  visualKind: ResourceVisualKind | null;
  visual: BlueprintMediaAsset | null;
  visualStatus: string | null;
  visualNotes: string | null;
}

export type ResourceVisualKind = 'metal' | 'mineral' | 'crystal' | 'ice';

export interface ResourceInsight {
  resourceId: string;
  providerCount: number;
  systems: string[];
  providerTypes: Array<'planetary' | 'asteroid' | 'other'>;
  sourceMethods: ResourceSourceMethod[];
  missionObjectiveContractCount: number;
  missionEmployers: string[];
  missionLocations: string[];
  blueprintUsageCount: number;
  blueprintCategoryCounts: Partial<Record<ItemCategory, number>>;
  blueprintIds: string[];
  totalScuPerCraftSum: number;
}

export type DatasetChannel = 'live' | 'ptu';

export interface DatasetSummary {
  channel: DatasetChannel;
  datasetId: string;
  label: string;
  version: string;
  branch: string | null;
  buildNumber: string | null;
  buildDateStamp: string | null;
  buildTimeStamp: string | null;
  published: boolean;
  blueprintCount: number;
  resourceCount: number;
  hasDismantling: boolean;
  hasMissionRewards: boolean;
  missionRewardContractCount: number;
  missionRewardFactionGroupCount: number;
  importedAt: string | null;
  updatedAt: string | null;
  hasChangelog: boolean;
  hasResourceData?: boolean;
  hasShipComponents?: boolean;
}

export interface DatasetDiffEntry {
  id: string;
  name?: string;
  nameBefore?: string;
  nameAfter?: string;
  category?: string;
  categoryBefore?: string;
  categoryAfter?: string;
  changedFields?: string[];
}

export interface DatasetChangelogSection {
  added: DatasetDiffEntry[];
  removed: DatasetDiffEntry[];
  changed: DatasetDiffEntry[];
  unchangedCount: number;
}

export interface DatasetChangelog {
  comparedAgainstChannel: 'live';
  comparedAgainstDatasetId: string;
  comparedAgainstVersion: string;
  generatedAt: string;
  summary: {
    blueprints: {
      added: number;
      removed: number;
      changed: number;
      unchanged: number;
    };
    resources: {
      added: number;
      removed: number;
      changed: number;
      unchanged: number;
    };
  };
  blueprints: DatasetChangelogSection;
  resources: DatasetChangelogSection;
}

export type AppMode = 'craft' | 'dismantle' | 'missions';

export interface DismantlingMeta {
  extractedAt: string | null;
  confidence: {
    globalProcess: string;
    uiResultShape: string;
    perItemYieldTable: string;
  } | null;
}

export interface FabricatorQueue {
  debugName: string;
  maxJobsInProgress: number;
  maxJobsWaiting: number;
}

export interface DismantlingFabricator {
  displayName: string;
  inventoryOccupancyScu: number;
  queues: FabricatorQueue[];
}

export interface DismantlingBlueprint {
  efficiency: number;
  dismantleTimeSecs: number;
}

export interface DismantlingGlobalParams {
  defaultCompositionQuality: number;
  refiningQualityUnitMultiplier: number;
}

export interface DismantlingPerItemYieldModel {
  resolved: boolean;
  reason: string | null;
  observedRuntimeFields: string[];
}

export interface DismantlingData {
  meta: DismantlingMeta | null;
  fabricator: DismantlingFabricator | null;
  dismantling: {
    blueprint: DismantlingBlueprint | null;
    globalParams: DismantlingGlobalParams | null;
    gameplayProperties?: Record<string, unknown> | null;
    ui?: Record<string, unknown> | null;
    perItemYieldModel?: DismantlingPerItemYieldModel | null;
  } | null;
}

export interface MissionRewardConclusions {
  hasExplicitBlueprintRewardContracts: boolean;
  hasExplicitCraftResourceRewardContracts: boolean;
  notes: string[];
}

export interface MissionRewardSummary {
  blueprintRewardContractCount: number;
  blueprintRewardContractFileCount: number;
  uniqueBlueprintPoolCount: number;
  uniqueRewardedBlueprintCount: number;
  factionGroupCount: number;
  reputationScopeCount?: number;
  explicitItemRewardContractCount: number;
  craftResourceRewardContractCount: number;
  resourceObjectiveContractCount?: number;
}

export interface MissionRewardFaction {
  slug: string | null;
  displayName: string | null;
  factionType: string | null;
}

export interface MissionStandingTier {
  guid?: string | null;
  key?: string | null;
  displayName: string | null;
  displayNameToken?: string | null;
  minReputation: number | null;
  gated?: boolean | null;
  order?: number | null;
}

export interface MissionReputationScope {
  guid?: string | null;
  scopeName: string | null;
  displayName: string | null;
  displayNameToken?: string | null;
  initialReputation?: number | null;
  reputationCeiling?: number | null;
  standingCount?: number | null;
  standings?: MissionStandingTier[];
}

export interface MissionRequiredStanding {
  factionName: string | null;
  factionSlug?: string | null;
  scopeGuid?: string | null;
  scopeKey?: string | null;
  scopeName: string | null;
  scopeDisplayNameToken?: string | null;
  standingGuid?: string | null;
  standingKey?: string | null;
  standingName: string | null;
  standingDisplayNameToken?: string | null;
  minReputation: number | null;
}

export interface MissionAvailability {
  derivedScale: string;
  localities: string[];
  explicitLocations: string[];
  hasHandlerAvailabilityRules: boolean;
}

export interface MissionRewardBlueprint {
  id: string;
  name: string;
  category: ItemCategory | null;
  manufacturer: string | null;
  chance?: number;
  normalizedWeight?: number;
}

export interface MissionItemAward {
  amount: number;
  entitySlug: string | null;
}

export interface MissionResourceObjective {
  resourceId: string;
  displayName: string;
  minScu: number;
  maxScu: number;
  maxContainerSize: number;
}

export interface MissionEmployerRef {
  displayName: string | null;
  canonicalEmployer: string | null;
  logo: BlueprintMediaAsset | null;
  icon: BlueprintMediaAsset | null;
  sourcePageUrl: string | null;
  status: string | null;
  notes: string | null;
}

export interface MissionText {
  token?: string | null;
  template?: string | null;
  renderedText?: string | null;
  displayText?: string | null;
  variants?: string[];
  placeholders?: string[];
  resolutionStatus?: string | null;
}

export interface MissionContract {
  contractFile: string | null;
  handlerDebugName: string | null;
  contractDebugName: string | null;
  contractType: string | null;
  title?: MissionText | null;
  description?: MissionText | null;
  contractorDisplayName: string | null;
  employer?: MissionEmployerRef | null;
  faction: MissionRewardFaction | null;
  reputationScope: MissionReputationScope | null;
  minimumRequiredStandings: MissionRequiredStanding[];
  availability: MissionAvailability;
  blueprintDropChance?: number | null;
  rewardedBlueprints: MissionRewardBlueprint[];
  itemAwards: MissionItemAward[];
  resourceObjectives: MissionResourceObjective[];
}

export interface MissionRewardFactionGroup {
  /** Stable URL-safe slug, derived from contractorDisplayName. Present on all new datasets. */
  id: string;
  contractorDisplayName: string;
  employer?: MissionEmployerRef | null;
  faction: MissionRewardFaction | null;
  reputationScopes: MissionReputationScope[];
  contractCount: number;
  /** Absent in new slim datasets — contracts are fetched lazily per faction. */
  contracts?: MissionContract[];
}

export interface MissionRewardsData {
  summary: MissionRewardSummary | null;
  conclusions: MissionRewardConclusions | null;
  reputationScopesDetailed?: MissionReputationScope[];
  factionGroups: MissionRewardFactionGroup[];
  blueprintAcquisitionGraph: AcquisitionGraphEntry[];
  /** Maps resourceId → factionId[] for planner lazy-loading. Present on new datasets. */
  resourceObjectiveIndex?: Record<string, string[]>;
}

export interface FactionContractsChunk {
  datasetId: string;
  factionId: string;
  contracts: MissionContract[];
}

export interface AcquisitionStanding {
  factionName: string | null;
  factionSlug?: string | null;
  scopeGuid?: string | null;
  scopeKey?: string | null;
  scopeName: string | null;
  scopeDisplayNameToken?: string | null;
  standingGuid?: string | null;
  standingKey?: string | null;
  standingName: string | null;
  standingDisplayNameToken?: string | null;
  minReputation: number | null;
}

export interface AcquisitionContract {
  contractDebugName: string;
  contractType: string | null;
  title?: MissionText | null;
  availability: MissionAvailability;
  minimumRequiredStandings: AcquisitionStanding[];
  blueprintDropChance?: number | null;
  expectedRewardShare: number | null;
  maxChance: number | null;
}

export interface AcquisitionFaction {
  contractorDisplayName: string | null;
  faction: { slug: string | null; displayName: string | null; factionType: string | null } | null;
  contractCount: number;
  localityCount: number;
  maxReputation: number;
  derivedScales: string[];
  localities: string[];
  standings: AcquisitionStanding[];
  contracts: AcquisitionContract[];
}

export interface AcquisitionGraphEntry {
  blueprint: {
    id: string;
    name: string;
    category: string;
    manufacturer: string;
  };
  contractCount: number;
  factionCount: number;
  localityCount: number;
  dropScore: number;
  maxReputation: number | null;
  derivedScales: string[];
  localities: string[];
  standings: AcquisitionStanding[];
  factions: AcquisitionFaction[];
}

export interface MaterialSourceProvider {
  providerId?: string;
  providerDisplayName: string;
  providerType: string;
  sourceMethod?: ResourceSourceMethod | null;
  mineableGroupName?: string | null;
  system: string | null;
  tier: string | null;
  rawRelativeProbability?: number | null;
  providerProbabilityPct?: number | null;
  groupProbabilityPct: number | null;
  craftOnlyProbabilityPct: number | null;
  labelConfidence: string;
  providerPath?: string | null;
}

export interface MaterialSourceEntry {
  id?: string;
  displayName?: string;
  sourceMethods?: ResourceSourceMethod[];
  providers: MaterialSourceProvider[];
}

export interface MaterialSources {
  resources: Record<string, MaterialSourceEntry>;
  providers: MaterialSourceProvider[];
  summary?: {
    providerCount?: number;
    resourceCount?: number;
    localizedProviderCount?: number;
    technicalProviderCount?: number;
    providerTypes?: Record<string, number>;
    sourceMethods?: Record<string, number>;
    systems?: string[];
  };
}

export interface ShipComponentReference {
  guid: string;
  path: string | null;
}

export interface ShipComponentAttachDef extends BlueprintAttachDef {
  manufacturerRecord?: string | null;
}

export interface ShipComponentInventoryOccupancy extends BlueprintInventoryOccupancy {
  standardCargoUnits?: number | null;
  standardResourceUnits?: number | null;
}

export interface ShipComponentDamageResistance {
  multiplier?: number | null;
  threshold?: number | null;
  damageCap?: number | null;
  damageType?: string | null;
}

export interface ShipComponentPortType {
  type?: string | null;
  subType?: string | null;
}

export interface ShipComponentPortEntry {
  name?: string | null;
  displayNameKey?: string | null;
  portTags?: string[];
  requiredPortTags?: string[];
  flags?: string[];
  minSize?: number | null;
  maxSize?: number | null;
  resourceLinkToParent?: boolean | null;
  types?: ShipComponentPortType[] | null;
}

export interface ShipComponentSignatureState {
  nominalSignature?: number | null;
  decayRate?: number | null;
}

export interface ShipComponentPowerRange {
  start?: number | null;
  modifier?: number | null;
  registerRange?: number | null;
}

export interface ShipComponentResourceAmountUnit {
  units?: number | null;
  standardCargoUnits?: number | null;
  standardResourceUnits?: number | null;
  unitTag?: string | null;
  unitType?: string | null;
}

export interface ShipComponentResourceEndpoint {
  resource?: string | null;
}

export interface ShipComponentResourceDelta {
  deltaTag?: string | null;
  deltaType?: string | null;
  minimumConsumptionFraction?: number | null;
  generation?: ShipComponentResourceEndpoint | null;
  consumption?: ShipComponentResourceEndpoint | null;
  amountUnits?: ShipComponentResourceAmountUnit[] | null;
  dynamicAmountOverride?: Array<Record<string, unknown>> | null;
}

export interface ShipComponentResourceState {
  name?: string | null;
  emSignature?: ShipComponentSignatureState | null;
  irSignature?: ShipComponentSignatureState | null;
  powerRanges?: Record<string, ShipComponentPowerRange | null> | null;
  deltas?: ShipComponentResourceDelta[] | null;
}

export interface ShipComponentEntry {
  id: string;
  name: string | null;
  family: string | null;
  category: string | null;
  manufacturer: string | null;
  media?: BlueprintMedia | null;
  displayType?: string | null;
  shortName?: string | null;
  description?: string | null;
  descriptionBody?: string | null;
  descriptionFacts?: BlueprintIdentityFact[] | null;
  identity?: {
    sourceFile?: string | null;
    recordId?: string | null;
    recordPath?: string | null;
    componentTypes?: string[] | null;
    displayNameKey?: string | null;
    shortNameKey?: string | null;
    descriptionKey?: string | null;
    attachDef?: ShipComponentAttachDef | null;
    inventoryOccupancy?: ShipComponentInventoryOccupancy | null;
  } | null;
  systems?: {
    displayIcon?: string | null;
    purchasable?: Record<string, unknown> | null;
    physics?: {
      mass?: number | null;
    } | null;
    health?: {
      health?: number | null;
      damageCap?: number | null;
      detachFromItemPortOnDeath?: boolean | null;
      detachFromEntityOnDeath?: boolean | null;
      destroySelfOnDeath?: boolean | null;
      isSalvageable?: boolean | null;
      isRepairable?: boolean | null;
      salvageDamageModifier?: number | null;
      damageResistances?: Record<string, ShipComponentDamageResistance> | null;
    } | null;
    degradation?: Record<string, unknown> | null;
    distortion?: Record<string, unknown> | null;
    thermal?: Record<string, unknown> | null;
    itemControl?: Record<string, unknown> | null;
  } | null;
  ports?: {
    container?: Record<string, unknown> | null;
    entries?: ShipComponentPortEntry[] | null;
  } | null;
  resources?: {
    network?: Record<string, unknown> | null;
    states?: ShipComponentResourceState[] | null;
    selfRepair?: Record<string, unknown> | null;
  } | null;
  stats?: Record<string, unknown> | null;
  references?: ShipComponentReference[] | null;
}

export interface ShipComponentsDataset {
  summary: {
    componentCount?: number | null;
    scannedCandidateRecordCount?: number | null;
    unclassifiedCandidateRecordCount?: number | null;
    familyCounts?: Record<string, number> | null;
  } | null;
  entries: ShipComponentEntry[];
}

export interface DatasetResourceDataChunk {
  datasetId: string;
  resourceInsights: ResourceInsight[] | null;
  materialSources: MaterialSources | null;
}

export interface DatasetShipComponentsChunk {
  datasetId: string;
  shipComponents: ShipComponentsDataset | null;
}

export interface DatasetChangelogChunk {
  datasetId: string;
  changelog: DatasetChangelog | null;
}

export interface DatasetMissionRewardsChunk {
  datasetId: string;
  missionRewards: MissionRewardsData | null;
}

export interface DatasetBlueprintDetailChunk {
  datasetId: string;
  blueprint: Blueprint | null;
}

export interface GameDataset {
  channel: DatasetChannel;
  datasetId: string;
  label: string;
  version: string;
  branch: string | null;
  buildNumber: string | null;
  buildDateStamp: string | null;
  buildTimeStamp: string | null;
  published: boolean;
  blueprintCount: number;
  resourceCount: number;
  hasDismantling: boolean;
  hasMissionRewards: boolean;
  hasResourceData: boolean;
  hasShipComponents: boolean;
  hasChangelog: boolean;
  blueprints: Blueprint[];
  manufacturers?: Array<{
    manufacturer: string;
    canonicalManufacturer?: string | null;
    logo?: BlueprintMediaAsset | null;
    icon?: BlueprintMediaAsset | null;
    sourcePageUrl?: string | null;
    status?: string | null;
    notes?: string | null;
  }>;
  resources: Resource[];
  resourceInsights: ResourceInsight[] | null;
  changelog: DatasetChangelog | null;
  dismantling: DismantlingData | null;
  materialSources: MaterialSources | null;
  missionRewards: MissionRewardsData | null;
  shipComponents: ShipComponentsDataset | null;
  importedAt: string | null;
  updatedAt: string | null;
}

export interface CraftGoal {
  id: string;
  blueprintId: string;
  blueprintName: string;
  category: ItemCategory;
  slotAssignments: Record<string, number | undefined>;
  quantity: number;
  qualityScore: number;
  projectedStats: ItemStats;
  createdAt: number;
}

export const COMPARISON_COLORS = ['#3b82f6', '#c084fc', '#34d399', '#fbbf24'] as const;

export interface ComparisonItem {
  id: string;
  blueprintId: string;
  blueprintName: string;
  category: ItemCategory;
  slotAssignments: Record<string, number | undefined>;
  projectedStats: ItemStats;
  baseStats: ItemStats;
  qualityScore: number;
  color: string;
}

export interface AggregatedResource {
  resourceName: string;
  totalScu: number;
  quantityUnit: MaterialSlotQuantityUnit | 'mixed';
  minRequiredQuality: number | null;
  assignedQualityValues: number[];
  unassignedSlotCount: number;
  slotCount: number;
}
