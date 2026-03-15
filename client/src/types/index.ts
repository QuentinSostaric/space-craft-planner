// ─── Lang (defined here to avoid circular deps) ───────────────────────────────
export type Lang = 'en' | 'fr';
export type LocalizedString = Record<Lang, string>;

// ─── localStorage keys ────────────────────────────────────────────────────────
export const LS_KEYS = {
  GOALS:           'sc-craft-goals',
  FAVORITES:       'sc-craft-favorites',
  LANG:            'sc-craft-lang',
  THEME:           'sc-craft-theme',
  DATASET_CHANNEL: 'sc-craft-dataset-channel',
  INVENTORY:       'sc-craft-inventory',
} as const;

// ─── Quality ─────────────────────────────────────────────────────────────────
/**
 * Named quality presets for UX — correspond to physical material grades in-game.
 * Internally quality is a numeric value on the game's 0–1000 scale.
 * GPP modifiers interpolate between startQuality=500 and endQuality=1000.
 *
 * chunks (300): below GPP threshold, no stat bonus
 * scraps (500): GPP startQuality, modAtStart (no improvement over base)
 * powder (1000): GPP endQuality, modAtMax (full bonus)
 */
export type QualityPreset = 'chunks' | 'scraps' | 'powder';

/** Nominal quality values on the game's 0–1000 scale */
export const QUALITY_PRESET_VALUE: Record<QualityPreset, number> = {
  chunks: 300,
  scraps: 500,
  powder: 1000,
};

export const QUALITY_PRESET_LABEL: Record<QualityPreset, LocalizedString> = {
  chunks: { en: 'Chunks', fr: 'Blocs' },
  scraps: { en: 'Scraps', fr: 'Débris' },
  powder: { en: 'Powder', fr: 'Poudre' },
};

export const QUALITY_PRESETS: QualityPreset[] = ['chunks', 'scraps', 'powder'];

/** Map a numeric quality value to the closest named preset */
export function qualityValueToPreset(value: number): QualityPreset {
  if (value >= 1000) return 'powder';
  if (value >= 500) return 'scraps';
  return 'chunks';
}

// ─── GPP (GameplayProperty) modifiers ────────────────────────────────────────
export interface GppModifier {
  gppId: string;
  /** Modifier multiplier at quality=500 (GPP startQuality) */
  modAtMin: number;
  /** Modifier multiplier at quality=1000 (GPP endQuality) */
  modAtMax: number;
}

// ─── Material slots ──────────────────────────────────────────────────────────
export interface MaterialSlot {
  id: string;
  label: LocalizedString;
  /** Fixed resource type required for this slot (e.g. "Torite") */
  requiredResource: string;
  /**
   * Minimum quality value on the game's 0–1000 scale, or null if no restriction.
   * Raw value from game XML (0, 300, 500 observed in data).
   */
  minQuality: number | null;
  /** Required quantity in SCU */
  quantityScu: number;
  /** GPP modifiers this slot contributes to the crafted item */
  modifiers: GppModifier[];
}

// ─── Item stats ──────────────────────────────────────────────────────────────
export interface ItemStats {
  // Weapons
  damage?: number;
  rateOfFire?: number;
  magazineSize?: number;
  effectiveRange?: number;
  recoilSmoothness?: number;  // multiplier, base 1.0 — lower is better
  recoilHandling?: number;    // multiplier, base 1.0 — lower is better
  recoilKick?: number;        // multiplier, base 1.0 — lower is better
  // Armor
  damageMitigation?: number;     // avg(kinetic + energy + thermal) resistance — GPP modifiable
  temperatureMin?: number;       // minimum comfortable temperature (°C)
  temperatureMax?: number;       // maximum comfortable temperature (°C)
  radiationDissipation?: number; // radiation dissipation rate — GPP modifiable
}

/**
 * Maps GPP property IDs to ItemStats keys.
 * GPP modifiers are applied multiplicatively to the matching base stat.
 */
export const GPP_TO_STAT: Partial<Record<string, keyof ItemStats>> = {
  GPP_Weapon_Damage:              'damage',
  GPP_Weapon_FireRate:            'rateOfFire',
  GPP_Weapon_Recoil_Smoothness:   'recoilSmoothness',
  GPP_Weapon_Recoil_Handling:     'recoilHandling',
  GPP_Weapon_Recoil_Kick:         'recoilKick',
  GPP_Armor_DamageMitigation:     'damageMitigation',
  GPP_Armor_TemperatureMin:       'temperatureMin',
  GPP_Armor_TemperatureMax:       'temperatureMax',
  GPP_Armor_RadiationDissipation: 'radiationDissipation',
};

export const STAT_LABELS: Record<keyof ItemStats, LocalizedString> = {
  damage:               { en: 'Damage',              fr: 'Dégâts' },
  rateOfFire:           { en: 'Rate of Fire',        fr: 'Cadence' },
  magazineSize:         { en: 'Magazine',             fr: 'Chargeur' },
  effectiveRange:       { en: 'Range',                fr: 'Portée' },
  recoilSmoothness:     { en: 'Recoil Smoothness',    fr: 'Fluidité recul' },
  recoilHandling:       { en: 'Recoil Handling',      fr: 'Gestion recul' },
  recoilKick:           { en: 'Recoil Kick',          fr: 'Recul' },
  damageMitigation:     { en: 'Dmg Mitigation',       fr: 'Mitigation' },
  temperatureMin:       { en: 'Temp. Min',            fr: 'Temp. Min' },
  temperatureMax:       { en: 'Temp. Max',            fr: 'Temp. Max' },
  radiationDissipation: { en: 'Radiation Dissip.',    fr: 'Dissip. Radiation' },
};

export const STAT_UNITS: Record<keyof ItemStats, string> = {
  damage:               'dmg',
  rateOfFire:           'rpm',
  magazineSize:         'rds',
  effectiveRange:       'm',
  recoilSmoothness:     '×',
  recoilHandling:       '×',
  recoilKick:           '×',
  damageMitigation:     '',
  temperatureMin:       '°C',
  temperatureMax:       '°C',
  radiationDissipation: 'mRem/s',
};

/** Stats where a lower projected value is an improvement */
export const STAT_LOWER_IS_BETTER = new Set<keyof ItemStats>([
  'recoilSmoothness', 'recoilHandling', 'recoilKick',
]);

// ─── Blueprint ───────────────────────────────────────────────────────────────
export type ItemCategory =
  | 'fps-weapon'
  | 'fps-magazine'
  | 'fps-armor'
  | 'fps-helmet'
  | 'fps-undersuit'
  | 'fps-backpack';

/** Includes UI-only filter values */
export type CategoryFilter = ItemCategory | 'all' | 'favorites';

export const CATEGORY_LABELS: Record<ItemCategory, LocalizedString> = {
  'fps-weapon':    { en: 'FPS Weapon',  fr: 'Arme FPS' },
  'fps-magazine':  { en: 'Magazine',    fr: 'Chargeur' },
  'fps-armor':     { en: 'FPS Armor',   fr: 'Armure FPS' },
  'fps-helmet':    { en: 'Helmet',      fr: 'Casque' },
  'fps-undersuit': { en: 'Undersuit',   fr: 'Combinaison' },
  'fps-backpack':  { en: 'Backpack',    fr: 'Sac à dos' },
};

export interface Blueprint {
  id: string;
  name: string;
  manufacturer: string;
  category: ItemCategory;
  craftTimeSecs: number;
  /** Base (shop) stats — keys match keyof ItemStats */
  baseStats: Record<string, number>;
  slots: MaterialSlot[];
}

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
  importedAt: string;
  updatedAt: string;
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

export interface GameDataset {
  channel: DatasetChannel;
  datasetId: string;
  label: string;
  version: string;
  branch: string | null;
  buildNumber: string | null;
  published: boolean;
  blueprints: Blueprint[];
  resources: Resource[];
  changelog: DatasetChangelog | null;
  dismantling: DismantlingData | null;
  importedAt: string;
  updatedAt: string;
}

// ─── App mode ────────────────────────────────────────────────────────────────
export type AppMode = 'craft' | 'dismantle';

// ─── Dismantling ─────────────────────────────────────────────────────────────
export interface DismantlingMeta {
  outputLabel: string;
  extractedAt: string;
  confidence: {
    globalProcess: string;
    uiResultShape: string;
    perItemYieldTable: string;
  };
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

export interface DismantlingData {
  meta: DismantlingMeta;
  fabricator: DismantlingFabricator;
  dismantling: {
    blueprint: DismantlingBlueprint;
    globalParams: DismantlingGlobalParams;
  };
}

// ─── Craft goal ──────────────────────────────────────────────────────────────
export interface CraftGoal {
  id: string;
  blueprintId: string;
  blueprintName: string;
  category: ItemCategory;
  /** Numeric quality value (0–1000) assigned per slot id */
  slotAssignments: Record<string, number | undefined>;
  quantity: number;
  qualityScore: number;
  projectedStats: ItemStats;
  createdAt: number;
}

// ─── Comparison ───────────────────────────────────────────────────────────────
export const COMPARISON_COLORS = ['#3b82f6', '#c084fc', '#34d399', '#fbbf24'] as const;

export interface ComparisonItem {
  id: string;
  blueprintId: string;
  blueprintName: string;
  category: ItemCategory;
  /** Numeric quality value (0–1000) per slot id */
  slotAssignments: Record<string, number | undefined>;
  projectedStats: ItemStats;
  baseStats: ItemStats;
  qualityScore: number;
  color: string;
}

// ─── Farm data ────────────────────────────────────────────────────────────────
export type FarmActivityType = 'mining' | 'salvage' | 'mission' | 'shop';

export const ACTIVITY_LABELS: Record<FarmActivityType, LocalizedString> = {
  mining:  { en: 'Mining',   fr: 'Mining' },
  salvage: { en: 'Salvage',  fr: 'Salvage' },
  mission: { en: 'Missions', fr: 'Missions' },
  shop:    { en: 'Shop',     fr: 'Boutique' },
};

export const ACTIVITY_ICONS: Record<FarmActivityType, string> = {
  mining:  '⛏',
  salvage: '🔧',
  mission: '📋',
  shop:    '🛒',
};

export const EFFICIENCY_LABELS: Record<'high' | 'medium' | 'low', LocalizedString> = {
  high:   { en: 'High',   fr: 'Haute' },
  medium: { en: 'Medium', fr: 'Moyenne' },
  low:    { en: 'Low',    fr: 'Faible' },
};

export interface FarmLocation {
  id: string;
  name: string;
  system: string;
  body?: string;
  type: FarmActivityType;
  efficiency: 'high' | 'medium' | 'low';
  description: LocalizedString;
  /** Resource names available at this location (e.g. "Iron", "Torite") */
  resourceIds: string[];
}

export interface AggregatedResource {
  resourceName: string;
  /** Numeric quality value (0–1000) assigned to this resource in goals */
  qualityValue: number;
  totalScu: number;
  locations: FarmLocation[];
  bestActivity: FarmActivityType;
}
