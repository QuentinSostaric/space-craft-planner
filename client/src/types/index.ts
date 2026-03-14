// ─── Lang (defined here to avoid circular deps) ───────────────────────────────
export type Lang = 'en' | 'fr';
export type LocalizedString = Record<Lang, string>;

// ─── localStorage keys ────────────────────────────────────────────────────────
export const LS_KEYS = {
  GOALS:     'sc-craft-goals',
  FAVORITES: 'sc-craft-favorites',
  LANG:      'sc-craft-lang',
  THEME:     'sc-craft-theme',
  DATASET_CHANNEL: 'sc-craft-dataset-channel',
} as const;

// ─── Quality ─────────────────────────────────────────────────────────────────
export type Quality = 'CMR' | 'CMP' | 'CMS';

export const QUALITY_LABEL: Record<Quality, LocalizedString> = {
  CMR: { en: 'Powder', fr: 'Poudre' },
  CMP: { en: 'Scraps', fr: 'Débris' },
  CMS: { en: 'Chunks', fr: 'Blocs' },
};

/** Official in-game English names for quality tiers */
export const GAME_QUALITY_NAMES: Record<Quality, string> = {
  CMR: 'Powder',
  CMP: 'Scraps',
  CMS: 'Chunks',
};

/** Numeric rank: higher = better quality */
export const QUALITY_ORDER: Record<Quality, number> = {
  CMR: 3,
  CMP: 2,
  CMS: 1,
};

/** Numeric value used in GPP modifier interpolation (500=CMS, 750=CMP, 1000=CMR) */
export const QUALITY_NUMERIC: Record<Quality, number> = {
  CMR: 1000,
  CMP: 750,
  CMS: 500,
};

// ─── GPP (GameplayProperty) modifiers ────────────────────────────────────────
export interface GppModifier {
  gppId: string;
  /** Modifier multiplier at minimum quality (CMS, numeric 500) */
  modAtMin: number;
  /** Modifier multiplier at maximum quality (CMR, numeric 1000) */
  modAtMax: number;
}

// ─── Material slots ──────────────────────────────────────────────────────────
export interface MaterialSlot {
  id: string;
  label: LocalizedString;
  /** Fixed resource required for this slot (e.g. "Torite") */
  requiredResource: string;
  /** Minimum quality tier allowed, or null if any quality works */
  minQuality: Quality | null;
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
  recoilSmoothness?: number;
  recoilHandling?: number;
  recoilKick?: number;
  // Armor
  damageMitigation?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  radiationDissipation?: number;
}

/**
 * Maps GPP property IDs to ItemStats keys.
 * GPP modifiers are applied multiplicatively to the matching base stat.
 */
export const GPP_TO_STAT: Partial<Record<string, keyof ItemStats>> = {
  GPP_Weapon_Damage:            'damage',
  GPP_Weapon_FireRate:          'rateOfFire',
  GPP_Weapon_Recoil_Smoothness: 'recoilSmoothness',
  GPP_Weapon_Recoil_Handling:   'recoilHandling',
  GPP_Weapon_Recoil_Kick:       'recoilKick',
  GPP_Armor_DamageMitigation:   'damageMitigation',
  GPP_Armor_TemperatureMin:     'temperatureMin',
  GPP_Armor_TemperatureMax:     'temperatureMax',
  GPP_Armor_RadiationDissipation: 'radiationDissipation',
};

export const STAT_LABELS: Record<keyof ItemStats, LocalizedString> = {
  damage:               { en: 'Damage',            fr: 'Dégâts' },
  rateOfFire:           { en: 'Rate of Fire',      fr: 'Cadence' },
  magazineSize:         { en: 'Magazine',           fr: 'Chargeur' },
  effectiveRange:       { en: 'Range',              fr: 'Portée' },
  recoilSmoothness:     { en: 'Recoil Smoothness',  fr: 'Fluidité recul' },
  recoilHandling:       { en: 'Recoil Handling',    fr: 'Gestion recul' },
  recoilKick:           { en: 'Recoil Kick',        fr: 'Recul' },
  damageMitigation:     { en: 'Dmg Mitigation',     fr: 'Mitigation' },
  temperatureMin:       { en: 'Temp. Resistance Min', fr: 'Résistance Temp. Min' },
  temperatureMax:       { en: 'Temp. Resistance Max', fr: 'Résistance Temp. Max' },
  radiationDissipation: { en: 'Radiation',           fr: 'Radiation' },
};

export const STAT_UNITS: Record<keyof ItemStats, string> = {
  damage:               'dmg',
  rateOfFire:           'rpm',
  magazineSize:         'rds',
  effectiveRange:       'm',
  recoilSmoothness:     '×',
  recoilHandling:       '×',
  recoilKick:           '×',
  damageMitigation:     '%',
  temperatureMin:       '°C',
  temperatureMax:       '°C',
  radiationDissipation: '×',
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
  importedAt: string;
  updatedAt: string;
}

// ─── Craft goal ──────────────────────────────────────────────────────────────
export interface CraftGoal {
  id: string;
  blueprintId: string;
  blueprintName: string;
  category: ItemCategory;
  /** Quality tier assigned per slot id */
  slotAssignments: Record<string, Quality | undefined>;
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
  slotAssignments: Record<string, Quality | undefined>;
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
  quality: Quality;
  totalScu: number;
  locations: FarmLocation[];
  bestActivity: FarmActivityType;
}
