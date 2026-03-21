export type Lang = 'en' | 'fr';
export type LocalizedString = Record<Lang, string>;

export const LS_KEYS = {
  GOALS: 'sc-craft-goals',
  FAVORITES: 'sc-craft-favorites',
  LANG: 'sc-craft-lang',
  THEME: 'sc-craft-theme',
  DATASET_CHANNEL: 'sc-craft-dataset-channel',
  INVENTORY: 'sc-craft-inventory',
  NAV_COLLAPSED: 'sc-craft-nav-collapsed',
} as const;

export interface GppModifier {
  gppId: string;
  modAtMin: number;
  modAtMax: number;
  qualityStart: number;
  qualityEnd: number;
  occurrenceCount: number;
}

export interface MaterialSlot {
  id: string;
  label: LocalizedString;
  requiredResource: string;
  minQuality: number | null;
  quantityScu: number;
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
  GPP_Weapon_Damage: { en: 'Damage', fr: 'Degats' },
  GPP_Weapon_FireRate: { en: 'Rate of Fire', fr: 'Cadence' },
  GPP_Weapon_Recoil_Smoothness: { en: 'Recoil Smoothness', fr: 'Fluidite recul' },
  GPP_Weapon_Recoil_Handling: { en: 'Recoil Handling', fr: 'Gestion recul' },
  GPP_Weapon_Recoil_Kick: { en: 'Recoil Kick', fr: 'Recul' },
  GPP_Armor_DamageMitigation: { en: 'Damage Resistance', fr: 'Resistance' },
  GPP_Armor_TemperatureMin: { en: 'Min Temperature', fr: 'Temperature min' },
  GPP_Armor_TemperatureMax: { en: 'Max Temperature', fr: 'Temperature max' },
  GPP_Armor_RadiationDissipation: { en: 'Radiation Dissipation', fr: 'Dissipation radiation' },
};

export const STAT_LABELS: Record<keyof ItemStats, LocalizedString> = {
  damage: { en: 'Damage', fr: 'Degats' },
  rateOfFire: { en: 'Rate of Fire', fr: 'Cadence' },
  magazineSize: { en: 'Magazine', fr: 'Chargeur' },
  effectiveRange: { en: 'Range', fr: 'Portee' },
  recoilSmoothness: { en: 'Recoil Smoothness', fr: 'Fluidite recul' },
  recoilHandling: { en: 'Recoil Handling', fr: 'Gestion recul' },
  recoilKick: { en: 'Recoil Kick', fr: 'Recul' },
  damageResistanceKinetic: { en: 'Kinetic Resist.', fr: 'Resist. cinetique' },
  damageResistanceEnergy: { en: 'Energy Resist.', fr: 'Resist. energie' },
  damageResistanceThermal: { en: 'Thermal Resist.', fr: 'Resist. thermique' },
  damageResistanceDistortion: { en: 'Distortion Resist.', fr: 'Resist. distortion' },
  damageResistanceBiochemical: { en: 'Biochemical Resist.', fr: 'Resist. biochimique' },
  damageResistanceStun: { en: 'Stun Resist.', fr: 'Resist. etourdissement' },
  temperatureMin: { en: 'Temp. Min', fr: 'Temp. min' },
  temperatureMax: { en: 'Temp. Max', fr: 'Temp. max' },
  radiationDissipation: { en: 'Radiation Dissip.', fr: 'Dissip. radiation' },
  
  weaponType: { en: 'Weapon Type', fr: 'Type d\'arme' },
  ammoType: { en: 'Ammo Type', fr: 'Type de munition' },
  ammoFlavor: { en: 'Ammo Flavor', fr: 'Saveur munition' },
  projectileSpeed: { en: 'Muzzle Velocity', fr: 'Vitesse de sortie' },
  idealCombatRange: { en: 'Ideal Range', fr: 'Portee ideale' },
  
  armorType: { en: 'Armor Type', fr: 'Type d\'armure' },
  armorSlot: { en: 'Armor Slot', fr: 'Slot d\'armure' },
  wearMovementMultiplier: { en: 'Movement Multiplier', fr: 'Mult. mouvement' },
  wearSprintMultiplier: { en: 'Sprint Multiplier', fr: 'Mult. sprint' },
  wearAimingMultiplier: { en: 'Aiming Multiplier', fr: 'Mult. visee' },
  radiationCapacity: { en: 'Radiation Capacity', fr: 'Capacite radiation' },
  impactForceResistance: { en: 'Impact Resistance', fr: 'Resist. impact' },
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

export const CATEGORY_LABELS: Record<ItemCategory, LocalizedString> = {
  'fps-weapon': { en: 'FPS Weapon', fr: 'Arme FPS' },
  'fps-magazine': { en: 'Magazine', fr: 'Chargeur' },
  'fps-armor': { en: 'FPS Armor', fr: 'Armure FPS' },
  'fps-helmet': { en: 'Helmet', fr: 'Casque' },
  'fps-undersuit': { en: 'Undersuit', fr: 'Combinaison' },
  'fps-backpack': { en: 'Backpack', fr: 'Sac a dos' },
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

export interface Blueprint {
  id: string;
  name: string;
  manufacturer: string;
  category: ItemCategory;
  craftTimeSecs: number;
  baseStats: ItemStats;
  slots: MaterialSlot[];
  media?: BlueprintMedia;
  rarity?: 'legendary' | 'rare' | 'common';
}

export type Rarity = 'legendary' | 'rare' | 'common';

export interface Resource {
  id: string;
  name: string;
  description: string;
  color: string;
}

export type DatasetChannel = 'live' | 'ptu';

export interface DatasetSummary {
  channel: DatasetChannel;
  datasetId: string;
  label: string;
  version: string;
  branch: string | null;
  buildNumber: string | null;
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
  explicitItemRewardContractCount: number;
  craftResourceRewardContractCount: number;
}

export interface MissionRewardFaction {
  slug: string | null;
  displayName: string | null;
  factionType: string | null;
}

export interface MissionReputationScope {
  scopeName: string | null;
  displayName: string | null;
}

export interface MissionRequiredStanding {
  factionName: string | null;
  scopeName: string | null;
  standingName: string | null;
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

export interface MissionContract {
  contractFile: string | null;
  handlerDebugName: string | null;
  contractDebugName: string | null;
  contractType: string | null;
  contractorDisplayName: string | null;
  faction: MissionRewardFaction | null;
  reputationScope: MissionReputationScope | null;
  minimumRequiredStandings: MissionRequiredStanding[];
  availability: MissionAvailability;
  rewardedBlueprints: MissionRewardBlueprint[];
  itemAwards: MissionItemAward[];
}

export interface MissionRewardFactionGroup {
  contractorDisplayName: string;
  faction: MissionRewardFaction | null;
  reputationScopes: MissionReputationScope[];
  contractCount: number;
  contracts: MissionContract[];
}

export interface MissionRewardsData {
  summary: MissionRewardSummary | null;
  conclusions: MissionRewardConclusions | null;
  factionGroups: MissionRewardFactionGroup[];
  blueprintAcquisitionGraph: AcquisitionGraphEntry[];
}

export interface AcquisitionStanding {
  factionName: string;
  scopeName: string | null;
  standingName: string | null;
  minReputation: number | null;
}

export interface AcquisitionContract {
  contractDebugName: string;
  contractType: string | null;
  availability: MissionAvailability;
  minimumRequiredStandings: AcquisitionStanding[];
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
  providerDisplayName: string;
  providerType: string;
  system: string | null;
  tier: string | null;
  groupProbabilityPct: number | null;
  craftOnlyProbabilityPct: number | null;
  labelConfidence: string;
}

export interface MaterialSourceEntry {
  providers: MaterialSourceProvider[];
}

export interface MaterialSources {
  resources: Record<string, MaterialSourceEntry>;
  providers: MaterialSourceProvider[];
}

export interface GameDataset {
  channel: DatasetChannel;
  datasetId: string;
  label: string;
  version: string;
  branch: string | null;
  buildNumber: string | null;
  published: boolean;
  blueprintCount: number;
  resourceCount: number;
  blueprints: Blueprint[];
  resources: Resource[];
  changelog: DatasetChangelog | null;
  dismantling: DismantlingData | null;
  materialSources: MaterialSources | null;
  missionRewards: MissionRewardsData | null;
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
  minRequiredQuality: number | null;
  assignedQualityValues: number[];
  unassignedSlotCount: number;
  slotCount: number;
}
