import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { itemSlugFromPathname, navigateToPath, toSlug } from '../utils/slug';
import type {
  AppMode,
  Blueprint,
  BlueprintSort,
  CategoryFilter,
  CraftTimeBucket,
  ComparisonItem,
  CraftGoal,
  DatasetChannel,
  DatasetChangelog,
  DatasetSummary,
  DismantlingData,
  GameDataset,
  ItemStats,
  LegalityFilter,
  LibrarySegment,
  MaterialSlotQuantityUnit,
  MaterialSources,
  MissionContract,
  MissionRewardsData,
  PlannerResourceRequirements,
  RarityFilter,
  ResourceMethod,
  ResourceInsight,
  ResourceProgress,
  ShipComponentsDataset,
  SlotCountFilter,
  StandingBucket,
} from '../types';
import { COMPARISON_COLORS, LS_KEYS } from '../types';
import {
  fetchFactionContracts,
  fetchPublishedBlueprintDetailById,
  fetchPublishedChangelogById,
  fetchPublishedDatasetById,
  fetchPublishedDatasetIndex,
  fetchPublishedResourceDataById,
  fetchPublishedMissionRewardsById,
  fetchPublishedShipComponentsById,
} from '../hooks/gameDataApi';
import { useLocalPersist } from '../hooks/useLocalPersist';

const EMPTY_DATASET: GameDataset = {
  channel: 'live',
  datasetId: '',
  label: '',
  version: '',
  branch: null,
  buildNumber: null,
  buildDateStamp: null,
  buildTimeStamp: null,
  published: false,
  blueprintCount: 0,
  resourceCount: 0,
  hasDismantling: false,
  hasMissionRewards: false,
  hasResourceData: false,
  hasShipComponents: false,
  hasChangelog: false,
  blueprints: [],
  resources: [],
  resourceInsights: null,
  changelog: null,
  dismantling: null,
  materialSources: null,
  missionRewards: null,
  shipComponents: null,
  importedAt: null,
  updatedAt: null,
};

const DEFAULT_INVENTORY_IDS = [
  'bp_craft_behr_pistol_ballistic_01',
  'bp_craft_behr_pistol_ballistic_01_mag',
  'bp_craft_behr_rifle_ballistic_01',
  'bp_craft_behr_rifle_ballistic_01_mag',
  'bp_craft_cds_armor_light_arms_01_01_01',
  'bp_craft_cds_armor_light_core_01_01_01',
  'bp_craft_cds_armor_light_helmet_01_01_01',
  'bp_craft_cds_armor_light_legs_01_01_01',
] as const;

const INVENTORY_SEED_VERSION = 1;

type DatasetSelectionsStorage =
  | Partial<Record<DatasetChannel, string>>
  | {
      activeChannel?: DatasetChannel | null;
      ids?: Partial<Record<DatasetChannel, string>> | null;
    };

interface DatasetSelections {
  activeChannel: DatasetChannel | null;
  ids: Partial<Record<DatasetChannel, string>>;
}

interface ResourceDataChunkState {
  resourceInsights: ResourceInsight[] | null;
  materialSources: MaterialSources | null;
}

interface CraftState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  changelogOpen: boolean;
  setChangelogOpen: (open: boolean) => void;
  dismantlingData: DismantlingData | null;
  materialSources: MaterialSources | null;
  activeBlueprint: Blueprint | null;
  blueprints: Blueprint[];
  activeDataset: GameDataset;
  availableDatasets: DatasetSummary[];
  activeChannel: DatasetChannel;
  missionRewards: MissionRewardsData | null;
  missionRewardsLoading: boolean;
  missionRewardsError: string | null;
  resourceDataLoading: boolean;
  changelogLoading: boolean;
  datasetLoading: boolean;
  datasetError: string | null;
  categoryFilter: CategoryFilter;
  searchQuery: string;
  librarySegment: LibrarySegment;
  manufacturerFilter: string | null;
  shipComponentFamilyFilter: string | null;
  shipComponentProfileFilter: string | null;
  shipComponentSizeFilter: string | null;
  shipComponentGradeFilter: string | null;
  legalityFilter: LegalityFilter;
  locationFilter: string | null;
  materialFilter: string | null;
  rarityFilter: RarityFilter;
  slotCountFilter: SlotCountFilter;
  craftTimeFilter: CraftTimeBucket;
  weaponTypeFilter: string | null;
  ammoTypeFilter: string | null;
  ammoFlavorFilter: string | null;
  armorTypeFilter: string | null;
  armorSlotFilter: string | null;
  acquisitionEmployerFilter: string | null;
  acquisitionScaleFilter: string | null;
  acquisitionStandingFilter: StandingBucket;
  blueprintSort: BlueprintSort;
  setLibrarySegment: (segment: LibrarySegment) => void;
  setManufacturerFilter: (manufacturer: string | null) => void;
  setShipComponentFamilyFilter: (family: string | null) => void;
  setShipComponentProfileFilter: (profile: string | null) => void;
  setShipComponentSizeFilter: (size: string | null) => void;
  setShipComponentGradeFilter: (grade: string | null) => void;
  setLegalityFilter: (legality: LegalityFilter) => void;
  setLocationFilter: (location: string | null) => void;
  setMaterialFilter: (material: string | null) => void;
  setRarityFilter: (rarity: RarityFilter) => void;
  setSlotCountFilter: (count: SlotCountFilter) => void;
  setCraftTimeFilter: (bucket: CraftTimeBucket) => void;
  setWeaponTypeFilter: (weaponType: string | null) => void;
  setAmmoTypeFilter: (ammoType: string | null) => void;
  setAmmoFlavorFilter: (ammoFlavor: string | null) => void;
  setArmorTypeFilter: (armorType: string | null) => void;
  setArmorSlotFilter: (armorSlot: string | null) => void;
  setAcquisitionEmployerFilter: (employer: string | null) => void;
  setAcquisitionScaleFilter: (scale: string | null) => void;
  setAcquisitionStandingFilter: (bucket: StandingBucket) => void;
  setBlueprintSort: (sort: BlueprintSort) => void;
  favoriteIds: string[];
  inventoryIds: string[];
  slotAssignments: Record<string, number | undefined>;
  goals: CraftGoal[];
  plannerResourceRequirements: PlannerResourceRequirements;
  resourceProgress: Record<string, ResourceProgress>;
  comparisonItems: ComparisonItem[];
  comparisonOpen: boolean;
  setActiveBlueprint: (bp: Blueprint | null) => void;
  setActiveDatasetChannel: (channel: DatasetChannel) => Promise<void>;
  setActiveDatasetId: (datasetId: string) => Promise<void>;
  refreshDatasets: () => Promise<void>;
  ensureMissionRewardsLoaded: (datasetId?: string) => Promise<void>;
  ensureFactionContractsLoaded: (factionId: string, datasetId?: string) => Promise<void>;
  factionContractsByFactionId: Record<string, MissionContract[]>;
  factionContractsLoadingIds: ReadonlySet<string>;
  ensureResourceDataLoaded: (datasetId?: string) => Promise<void>;
  ensureShipComponentsLoaded: (datasetId?: string) => Promise<void>;
  ensureChangelogLoaded: (datasetId?: string) => Promise<void>;
  ensureBlueprintDetailLoaded: (blueprintId: string, datasetId?: string) => Promise<void>;
  setCategoryFilter: (cat: CategoryFilter) => void;
  setSearchQuery: (q: string) => void;
  toggleFavorite: (blueprintId: string) => void;
  toggleInventory: (blueprintId: string) => void;
  assignQuality: (slotId: string, quality: number | undefined) => void;
  clearAssignments: () => void;
  addGoal: (score: number, projectedStats: ItemStats, quantity?: number) => void;
  ensureGoal: (score: number, projectedStats: ItemStats, quantity?: number) => void;
  removeGoal: (goalId: string) => void;
  updateGoalQuantity: (goalId: string, quantity: number) => void;
  updateGoal: (
    goalId: string,
    slotAssignments: Record<string, number | undefined>,
    qualityScore: number,
    projectedStats: ItemStats,
  ) => void;
  selectGoalBlueprint: (goalId: string) => void;
  addPlannerResourceRequirement: (
    resourceName: string,
    quantity: number,
    quantityUnit?: MaterialSlotQuantityUnit,
  ) => void;
  clearPlannerResourceRequirement: (resourceName: string) => void;
  setResourceCollected: (resourceName: string, amount: number) => void;
  setResourceMethod: (resourceName: string, method: ResourceMethod | null) => void;
  resetResourceProgress: () => void;
  addToComparison: (score: number, projectedStats: ItemStats) => void;
  removeFromComparison: (id: string) => void;
  clearComparison: () => void;
  openComparison: () => void;
  closeComparison: () => void;
}

const CraftContext = createContext<CraftState | null>(null);

function compareDatasetSummaries(a: DatasetSummary, b: DatasetSummary): number {
  const buildA = Number(a.buildNumber ?? 0);
  const buildB = Number(b.buildNumber ?? 0);
  if (buildA !== buildB) {
    return buildB - buildA;
  }

  const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
  const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }

  return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
}

function pickDefaultDataset(datasets: DatasetSummary[]): DatasetSummary | null {
  if (datasets.length === 0) return null;
  const liveDatasets = datasets.filter((d) => d.channel === 'live').sort(compareDatasetSummaries);
  if (liveDatasets.length > 0) return liveDatasets[0];
  return [...datasets].sort(compareDatasetSummaries)[0] ?? null;
}

function isDatasetChannel(value: unknown): value is DatasetChannel {
  return value === 'live' || value === 'ptu';
}

function normalizeDatasetSelections(
  selections: DatasetSelectionsStorage | null | undefined,
): DatasetSelections {
  if (!selections || typeof selections !== 'object') {
    return { activeChannel: null, ids: {} };
  }

  if ('activeChannel' in selections || 'ids' in selections) {
    const idsSource =
      selections.ids && typeof selections.ids === 'object'
        ? selections.ids
        : {};

    return {
      activeChannel: isDatasetChannel(selections.activeChannel)
        ? selections.activeChannel
        : null,
      ids: Object.fromEntries(
        Object.entries(idsSource).filter(
          ([channel, datasetId]) =>
            isDatasetChannel(channel)
            && typeof datasetId === 'string'
            && datasetId.trim().length > 0,
        ),
      ) as Partial<Record<DatasetChannel, string>>,
    };
  }

  return {
    activeChannel: null,
    ids: Object.fromEntries(
      Object.entries(selections).filter(
        ([channel, datasetId]) =>
          isDatasetChannel(channel)
          && typeof datasetId === 'string'
          && datasetId.trim().length > 0,
      ),
    ) as Partial<Record<DatasetChannel, string>>,
  };
}

function findDatasetById(
  datasets: DatasetSummary[],
  datasetId: string | null | undefined,
): DatasetSummary | null {
  if (!datasetId) {
    return null;
  }

  return datasets.find((dataset) => dataset.datasetId === datasetId) ?? null;
}

function pickDatasetForChannel(
  channel: DatasetChannel,
  datasets: DatasetSummary[],
  preferredDatasetId?: string | null,
): DatasetSummary | null {
  const preferredDataset = datasets.find(
    (dataset) => dataset.channel === channel && dataset.datasetId === preferredDatasetId,
  );
  if (preferredDataset) {
    return preferredDataset;
  }

  const channelDatasets = datasets
    .filter((dataset) => dataset.channel === channel)
    .sort(compareDatasetSummaries);

  if (channelDatasets.length === 0) {
    return null;
  }

  return channelDatasets[0];
}

function pickStoredDataset(
  datasets: DatasetSummary[],
  selections: DatasetSelections,
): DatasetSummary | null {
  if (selections.activeChannel) {
    const activeChannelDataset = findDatasetById(
      datasets,
      selections.ids[selections.activeChannel],
    );
    if (activeChannelDataset) {
      return activeChannelDataset;
    }
  }

  const storedDatasets = Object.values(selections.ids)
    .map((datasetId) => findDatasetById(datasets, datasetId))
    .filter((dataset): dataset is DatasetSummary => Boolean(dataset))
    .sort(compareDatasetSummaries);

  return storedDatasets[0] ?? null;
}

type PlannerResourceRequirementsStorage = Record<
  string,
  number | { quantity?: number | null; quantityUnit?: MaterialSlotQuantityUnit | null }
>;

function normalizePlannerResourceRequirements(
  requirements: PlannerResourceRequirementsStorage,
): PlannerResourceRequirements {
  return Object.fromEntries(
    Object.entries(requirements)
      .map(([resourceName, value]) => {
        if (typeof value === 'number') {
          const quantity = Math.round(Math.max(0, value) * 1000) / 1000;
          return quantity > 0
            ? [resourceName, { quantity, quantityUnit: 'scu' as const }]
            : null;
        }

        const quantity = Math.round(Math.max(0, Number(value?.quantity ?? 0)) * 1000) / 1000;
        if (quantity <= 0) {
          return null;
        }

        return [
          resourceName,
          {
            quantity,
            quantityUnit: value?.quantityUnit === 'count' ? 'count' : 'scu',
          },
        ];
      })
      .filter(
        (
          entry,
        ): entry is [string, PlannerResourceRequirements[string]] => Array.isArray(entry),
      ),
  );
}

function replaceBlueprintInList(
  blueprints: Blueprint[],
  nextBlueprint: Blueprint,
): Blueprint[] {
  return blueprints.map((blueprint) =>
    blueprint.id === nextBlueprint.id ? nextBlueprint : blueprint,
  );
}

function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return record;
  }

  const next = { ...record };
  delete next[key];
  return next;
}

function getDatasetRevisionStamp(
  dataset: Pick<GameDataset, 'updatedAt' | 'importedAt'> | Pick<DatasetSummary, 'updatedAt' | 'importedAt'>,
): string | null {
  return dataset.updatedAt ?? dataset.importedAt ?? null;
}

export function CraftProvider({ children }: { children: ReactNode }) {
  const [rawDatasetSelections, setDatasetSelections] = useLocalPersist<DatasetSelectionsStorage>(
    LS_KEYS.DATASET_SELECTIONS,
    {},
  );
  const [activeDataset, setActiveDataset] = useState<GameDataset>(EMPTY_DATASET);
  const [availableDatasets, setAvailableDatasets] = useState<DatasetSummary[]>([]);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const datasetInflightRef = useRef<Set<string>>(new Set());
  const refreshInflightRef = useRef(false);
  const missionRewardsInflightRef = useRef<Set<string>>(new Set());
  const missionRewardsByDatasetIdRef = useRef<Record<string, MissionRewardsData | null>>({});
  const datasetRevisionByIdRef = useRef<Record<string, string | null>>({});
  const [missionRewardsByDatasetId, setMissionRewardsByDatasetId] = useState<
    Record<string, MissionRewardsData | null>
  >({});
  const [missionRewardsLoading, setMissionRewardsLoading] = useState(false);
  const [missionRewardsError, setMissionRewardsError] = useState<string | null>(null);

  // Per-faction contracts — keyed by factionId (stable slug).
  // A factionId present in this map means the contracts are loaded (or confirmed empty).
  const factionContractsInflightRef = useRef<Set<string>>(new Set());
  const factionContractsByFactionIdRef = useRef<Record<string, MissionContract[]>>({});
  const [factionContractsByFactionId, setFactionContractsByFactionId] = useState<
    Record<string, MissionContract[]>
  >({});
  // IDs currently in-flight so the UI can show per-faction loading spinners.
  const [factionContractsLoadingIds, setFactionContractsLoadingIds] = useState<Set<string>>(
    new Set(),
  );
  const resourceDataInflightRef = useRef<Set<string>>(new Set());
  const resourceDataByDatasetIdRef = useRef<Record<string, ResourceDataChunkState>>({});
  const [resourceDataByDatasetId, setResourceDataByDatasetId] = useState<
    Record<string, ResourceDataChunkState>
  >({});
  const [resourceDataLoading, setResourceDataLoading] = useState(false);
  const shipComponentsInflightRef = useRef<Set<string>>(new Set());
  const shipComponentsByDatasetIdRef = useRef<Record<string, ShipComponentsDataset | null>>({});
  const [shipComponentsByDatasetId, setShipComponentsByDatasetId] = useState<
    Record<string, ShipComponentsDataset | null>
  >({});
  const changelogInflightRef = useRef<Set<string>>(new Set());
  const changelogByDatasetIdRef = useRef<Record<string, DatasetChangelog | null>>({});
  const [changelogByDatasetId, setChangelogByDatasetId] = useState<
    Record<string, DatasetChangelog | null>
  >({});
  const [changelogLoading, setChangelogLoading] = useState(false);
  const blueprintDetailsInflightRef = useRef<Set<string>>(new Set());
  const blueprintDetailsByDatasetIdRef = useRef<Record<string, Record<string, Blueprint>>>({});
  const [blueprintDetailsByDatasetId, setBlueprintDetailsByDatasetId] = useState<
    Record<string, Record<string, Blueprint>>
  >({});
  const [activeBlueprint, setActiveBlueprintRaw] = useState<Blueprint | null>(null);
  // Slug from URL on initial mount — resolved once blueprints load
  const pendingSlugRef = useRef<string | null>(itemSlugFromPathname(window.location.pathname));
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySegment, setLibrarySegment] = useState<LibrarySegment>('obtainable');
  const [manufacturerFilter, setManufacturerFilter] = useState<string | null>(null);
  const [shipComponentFamilyFilter, setShipComponentFamilyFilter] = useState<string | null>(null);
  const [shipComponentProfileFilter, setShipComponentProfileFilter] = useState<string | null>(null);
  const [shipComponentSizeFilter, setShipComponentSizeFilter] = useState<string | null>(null);
  const [shipComponentGradeFilter, setShipComponentGradeFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState<LegalityFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [slotCountFilter, setSlotCountFilter] = useState<SlotCountFilter>('all');
  const [craftTimeFilter, setCraftTimeFilter] = useState<CraftTimeBucket>('all');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<string | null>(null);
  const [ammoTypeFilter, setAmmoTypeFilter] = useState<string | null>(null);
  const [ammoFlavorFilter, setAmmoFlavorFilter] = useState<string | null>(null);
  const [armorTypeFilter, setArmorTypeFilter] = useState<string | null>(null);
  const [armorSlotFilter, setArmorSlotFilter] = useState<string | null>(null);
  const [acquisitionEmployerFilter, setAcquisitionEmployerFilter] = useState<string | null>(null);
  const [acquisitionScaleFilter, setAcquisitionScaleFilter] = useState<string | null>(null);
  const [acquisitionStandingFilter, setAcquisitionStandingFilter] = useState<StandingBucket>('all');
  const [blueprintSort, setBlueprintSort] = useState<BlueprintSort>('name-asc');
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number | undefined>>({});
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('craft');
  const [changelogOpen, setChangelogOpen] = useState(false);
  const datasetSelections = useMemo(
    () => normalizeDatasetSelections(rawDatasetSelections),
    [rawDatasetSelections],
  );

  const activeMissionRewards = activeDataset.missionRewards ?? null;
  const dismantlingData = activeDataset.dismantling ?? null;
  const materialSources = activeDataset.materialSources ?? null;

  const [rawGoals, setGoals] = useLocalPersist<CraftGoal[]>(LS_KEYS.GOALS, []);
  const [rawPlannerResourceRequirements, setPlannerResourceRequirements] = useLocalPersist<PlannerResourceRequirementsStorage>(
    LS_KEYS.PLANNER_RESOURCE_REQUIREMENTS,
    {},
  );
  const [resourceProgress, setResourceProgressRaw] = useLocalPersist<Record<string, ResourceProgress>>(
    LS_KEYS.RESOURCE_PROGRESS,
    {},
  );
  // Migrate legacy goals: coerce qualityScore to number, normalize slot assignments
  // (old data may have stored Quality strings like "CMR" instead of numeric values)
  const LEGACY_QUALITY_VALUE: Record<string, number> = { CMR: 1000, CMP: 500, CMS: 300 };
  const goals = useMemo(
    () => rawGoals.map((g) => ({
      ...g,
      qualityScore: typeof g.qualityScore === 'number' ? g.qualityScore : 0,
      slotAssignments: Object.fromEntries(
        Object.entries(g.slotAssignments ?? {}).map(([k, v]) => [
          k,
          typeof v === 'number' ? v : (typeof v === 'string' ? (LEGACY_QUALITY_VALUE[v] ?? undefined) : undefined),
        ]),
      ),
    })),
    [rawGoals], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const plannerResourceRequirements = useMemo(
    () => normalizePlannerResourceRequirements(rawPlannerResourceRequirements),
    [rawPlannerResourceRequirements],
  );
  const [favoriteIds, setFavoriteIds] = useLocalPersist<string[]>(LS_KEYS.FAVORITES, []);
  const [inventoryIds, setInventoryIds] = useLocalPersist<string[]>(
    LS_KEYS.INVENTORY,
    [...DEFAULT_INVENTORY_IDS],
  );
  const [inventorySeedVersion, setInventorySeedVersion] = useLocalPersist<number>(
    LS_KEYS.INVENTORY_SEED_VERSION,
    0,
  );

  useEffect(() => {
    if (inventorySeedVersion >= INVENTORY_SEED_VERSION) {
      return;
    }

    setInventoryIds((previous) => [...new Set([...DEFAULT_INVENTORY_IDS, ...previous])]);
    setInventorySeedVersion(INVENTORY_SEED_VERSION);
  }, [inventorySeedVersion, setInventoryIds, setInventorySeedVersion]);

  const blueprints = activeDataset.blueprints;
  const activeChannel = activeDataset.channel;

  // Keep refs in sync so callbacks can read them without being deps
  missionRewardsByDatasetIdRef.current = missionRewardsByDatasetId;
  factionContractsByFactionIdRef.current = factionContractsByFactionId;
  resourceDataByDatasetIdRef.current = resourceDataByDatasetId;
  shipComponentsByDatasetIdRef.current = shipComponentsByDatasetId;
  changelogByDatasetIdRef.current = changelogByDatasetId;
  blueprintDetailsByDatasetIdRef.current = blueprintDetailsByDatasetId;

  const hydrateBlueprintsWithDetails = useCallback(
    (datasetId: string, datasetBlueprints: Blueprint[]) => {
      const detailsById = blueprintDetailsByDatasetIdRef.current[datasetId] ?? {};
      return datasetBlueprints.map((blueprint) => detailsById[blueprint.id] ?? blueprint);
    },
    [],
  );

  const applyDataset = useCallback(
    (
      dataset: GameDataset,
      datasets: DatasetSummary[],
      errorMessage: string | null,
    ) => {
      const incomingRevision = getDatasetRevisionStamp(dataset);
      const cachedRevision = datasetRevisionByIdRef.current[dataset.datasetId] ?? null;
      const datasetRevisionChanged =
        cachedRevision !== null &&
        incomingRevision !== null &&
        cachedRevision !== incomingRevision;
      const hasMissionRewardsCache =
        !datasetRevisionChanged &&
        Object.prototype.hasOwnProperty.call(missionRewardsByDatasetIdRef.current, dataset.datasetId);
      const cachedMissionRewards = missionRewardsByDatasetIdRef.current[dataset.datasetId];
      const hasResourceDataCache = Object.prototype.hasOwnProperty.call(
        resourceDataByDatasetIdRef.current,
        dataset.datasetId,
      ) && !datasetRevisionChanged;
      const cachedResourceData = resourceDataByDatasetIdRef.current[dataset.datasetId];
      const hasShipComponentsCache = Object.prototype.hasOwnProperty.call(
        shipComponentsByDatasetIdRef.current,
        dataset.datasetId,
      ) && !datasetRevisionChanged;
      const cachedShipComponents = shipComponentsByDatasetIdRef.current[dataset.datasetId];
      const hasChangelogCache = Object.prototype.hasOwnProperty.call(
        changelogByDatasetIdRef.current,
        dataset.datasetId,
      ) && !datasetRevisionChanged;
      const cachedChangelog = changelogByDatasetIdRef.current[dataset.datasetId];
      const hydratedBlueprints = datasetRevisionChanged
        ? dataset.blueprints
        : hydrateBlueprintsWithDetails(dataset.datasetId, dataset.blueprints);
      datasetRevisionByIdRef.current[dataset.datasetId] = incomingRevision;
      startTransition(() => {
        if (datasetRevisionChanged) {
          setMissionRewardsByDatasetId((previous) => omitRecordKey(previous, dataset.datasetId));
          setResourceDataByDatasetId((previous) => omitRecordKey(previous, dataset.datasetId));
          setShipComponentsByDatasetId((previous) => omitRecordKey(previous, dataset.datasetId));
          setChangelogByDatasetId((previous) => omitRecordKey(previous, dataset.datasetId));
          setBlueprintDetailsByDatasetId((previous) => omitRecordKey(previous, dataset.datasetId));
        }

        setActiveDataset({
          ...dataset,
          blueprints: hydratedBlueprints,
          resourceInsights: hasResourceDataCache
            ? cachedResourceData?.resourceInsights ?? null
            : dataset.resourceInsights ?? null,
          materialSources: hasResourceDataCache
            ? cachedResourceData?.materialSources ?? null
            : dataset.materialSources ?? null,
          missionRewards:
            hasMissionRewardsCache
              ? cachedMissionRewards
              : dataset.missionRewards ?? null,
          shipComponents: hasShipComponentsCache
            ? cachedShipComponents ?? null
            : dataset.shipComponents ?? null,
          changelog: hasChangelogCache
            ? cachedChangelog ?? null
            : dataset.changelog ?? null,
        });
        setAvailableDatasets(datasets);
        setDatasetError(errorMessage);
        setMissionRewardsError(null);
        setDatasetSelections((previous) => {
          const normalizedSelections = normalizeDatasetSelections(previous);
          return {
            activeChannel: dataset.channel,
            ids: {
              ...normalizedSelections.ids,
              [dataset.channel]: dataset.datasetId,
            },
          };
        });
        if (dataset.missionRewards != null) {
          setMissionRewardsByDatasetId((previous) =>
            Object.prototype.hasOwnProperty.call(previous, dataset.datasetId)
              ? previous
              : { ...previous, [dataset.datasetId]: dataset.missionRewards ?? null },
          );
        }
        if (dataset.resourceInsights != null || dataset.materialSources != null) {
          setResourceDataByDatasetId((previous) =>
            Object.prototype.hasOwnProperty.call(previous, dataset.datasetId)
              ? previous
              : {
                  ...previous,
                  [dataset.datasetId]: {
                    resourceInsights: dataset.resourceInsights ?? null,
                    materialSources: dataset.materialSources ?? null,
                  },
                },
          );
        }
        if (dataset.shipComponents != null) {
          setShipComponentsByDatasetId((previous) =>
            Object.prototype.hasOwnProperty.call(previous, dataset.datasetId)
              ? previous
              : { ...previous, [dataset.datasetId]: dataset.shipComponents ?? null },
          );
        }
        if (dataset.changelog != null) {
          setChangelogByDatasetId((previous) =>
            Object.prototype.hasOwnProperty.call(previous, dataset.datasetId)
              ? previous
              : { ...previous, [dataset.datasetId]: dataset.changelog ?? null },
          );
        }
        setSlotAssignments({});
        setActiveBlueprintRaw((previous) =>
          previous ? hydratedBlueprints.find((blueprint) => blueprint.id === previous.id) ?? null : null,
        );
      });
    },
    [hydrateBlueprintsWithDetails, setDatasetSelections],
  );

  const loadDataset = useCallback(
    async (summary: DatasetSummary, datasets: DatasetSummary[]) => {
      if (datasetInflightRef.current.has(summary.datasetId)) {
        return undefined;
      }
      datasetInflightRef.current.add(summary.datasetId);
      try {
        const dataset = await fetchPublishedDatasetById(summary.datasetId, summary.channel);
        applyDataset(dataset, datasets, null);
        return dataset;
      } finally {
        datasetInflightRef.current.delete(summary.datasetId);
      }
    },
    [applyDataset],
  );

  const refreshDatasets = useCallback(async () => {
    if (refreshInflightRef.current) return;
    refreshInflightRef.current = true;
    setDatasetLoading(true);

    try {
      const index = await fetchPublishedDatasetIndex();

      if (index.datasets.length === 0) {
        setDatasetError('No published dataset is available yet.');
        setDatasetLoading(false);
        return;
      }

      const sortedDatasets = [...index.datasets].sort(compareDatasetSummaries);
      const currentDataset = findDatasetById(sortedDatasets, activeDataset.datasetId);
      const storedDataset = pickStoredDataset(sortedDatasets, datasetSelections);
      const targetDataset = currentDataset ?? storedDataset ?? pickDefaultDataset(sortedDatasets);

      if (!targetDataset) {
        throw new Error('No published dataset is available.');
      }

      await loadDataset(targetDataset, sortedDatasets);
    } catch (error) {
      setDatasetError(error instanceof Error ? error.message : 'Failed to load published datasets.');
    } finally {
      setDatasetLoading(false);
      refreshInflightRef.current = false;
    }
  }, [activeDataset.datasetId, datasetSelections, loadDataset]);

  useEffect(() => {
    void refreshDatasets();
  }, []);

  const ensureMissionRewardsLoaded = useCallback(
    async (requestedDatasetId?: string) => {
      const datasetId = requestedDatasetId ?? activeDataset.datasetId;
      const summary = availableDatasets.find((dataset) => dataset.datasetId === datasetId);
      const targetDatasetId = summary?.datasetId ?? datasetId;
      const targetChannel =
        summary?.channel ??
        (activeDataset.datasetId === datasetId ? activeDataset.channel : undefined);

      if (!summary?.hasMissionRewards && !activeDataset.hasMissionRewards) {
        return;
      }

      if (!targetChannel) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(missionRewardsByDatasetIdRef.current, datasetId)) {
        return;
      }

      if (missionRewardsInflightRef.current.has(datasetId)) {
        return;
      }
      missionRewardsInflightRef.current.add(datasetId);

      setMissionRewardsLoading(true);
      setMissionRewardsError(null);

      try {
        const missionRewards = await fetchPublishedMissionRewardsById(targetDatasetId, targetChannel);
        startTransition(() => {
          setMissionRewardsByDatasetId((previous) => ({ ...previous, [datasetId]: missionRewards }));
          setActiveDataset((previous) =>
            previous.datasetId === datasetId
              ? { ...previous, missionRewards }
              : previous,
          );
        });
      } catch (error) {
        setMissionRewardsError(
          error instanceof Error ? error.message : 'Failed to load mission rewards.',
        );
      } finally {
        missionRewardsInflightRef.current.delete(datasetId);
        setMissionRewardsLoading(false);
      }
    },
    [activeDataset.datasetId, activeDataset.hasMissionRewards, availableDatasets],
  );

  const ensureFactionContractsLoaded = useCallback(
    async (factionId: string, requestedDatasetId?: string) => {
      if (!factionId) return;

      const datasetId = requestedDatasetId ?? activeDataset.datasetId;

      if (Object.prototype.hasOwnProperty.call(factionContractsByFactionIdRef.current, factionId)) {
        return;
      }
      if (factionContractsInflightRef.current.has(factionId)) {
        return;
      }
      factionContractsInflightRef.current.add(factionId);
      setFactionContractsLoadingIds((prev) => new Set([...prev, factionId]));

      try {
        const channel =
          availableDatasets.find((d) => d.datasetId === datasetId)?.channel ??
          (activeDataset.datasetId === datasetId ? activeDataset.channel : undefined);

        const chunk = await fetchFactionContracts(datasetId, factionId, channel);
        const contracts = chunk?.contracts ?? [];
        startTransition(() => {
          setFactionContractsByFactionId((previous) => ({ ...previous, [factionId]: contracts }));
        });
      } catch {
        // On error, store empty array so we don't retry indefinitely.
        startTransition(() => {
          setFactionContractsByFactionId((previous) => ({ ...previous, [factionId]: [] }));
        });
      } finally {
        factionContractsInflightRef.current.delete(factionId);
        setFactionContractsLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(factionId);
          return next;
        });
      }
    },
    [activeDataset.datasetId, activeDataset.channel, availableDatasets],
  );

  const ensureResourceDataLoaded = useCallback(
    async (requestedDatasetId?: string) => {
      const datasetId = requestedDatasetId ?? activeDataset.datasetId;
      const summary = availableDatasets.find((dataset) => dataset.datasetId === datasetId);
      const targetDatasetId = summary?.datasetId ?? datasetId;
      const targetChannel =
        summary?.channel ??
        (activeDataset.datasetId === datasetId ? activeDataset.channel : undefined);

      if (!summary?.hasResourceData && !activeDataset.hasResourceData) {
        return;
      }

      if (!targetChannel) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(resourceDataByDatasetIdRef.current, datasetId)) {
        return;
      }

      if (resourceDataInflightRef.current.has(datasetId)) {
        return;
      }
      resourceDataInflightRef.current.add(datasetId);
      setResourceDataLoading(true);

      try {
        const resourceData = await fetchPublishedResourceDataById(targetDatasetId, targetChannel);
        const nextResourceData: ResourceDataChunkState = {
          resourceInsights: resourceData?.resourceInsights ?? null,
          materialSources: resourceData?.materialSources ?? null,
        };

        startTransition(() => {
          setResourceDataByDatasetId((previous) => ({ ...previous, [datasetId]: nextResourceData }));
          setActiveDataset((previous) =>
            previous.datasetId === datasetId
              ? {
                  ...previous,
                  resourceInsights: nextResourceData.resourceInsights,
                  materialSources: nextResourceData.materialSources,
                }
              : previous,
          );
        });
      } finally {
        resourceDataInflightRef.current.delete(datasetId);
        setResourceDataLoading(false);
      }
    },
    [activeDataset.datasetId, activeDataset.hasResourceData, availableDatasets],
  );

  const ensureShipComponentsLoaded = useCallback(
    async (requestedDatasetId?: string) => {
      const datasetId = requestedDatasetId ?? activeDataset.datasetId;
      const summary = availableDatasets.find((dataset) => dataset.datasetId === datasetId);
      const targetDatasetId = summary?.datasetId ?? datasetId;
      const targetChannel =
        summary?.channel ??
        (activeDataset.datasetId === datasetId ? activeDataset.channel : undefined);

      if (!summary?.hasShipComponents && !activeDataset.hasShipComponents) {
        return;
      }

      if (!targetChannel) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(shipComponentsByDatasetIdRef.current, datasetId)) {
        return;
      }

      if (shipComponentsInflightRef.current.has(datasetId)) {
        return;
      }
      shipComponentsInflightRef.current.add(datasetId);

      try {
        const shipComponents = await fetchPublishedShipComponentsById(targetDatasetId, targetChannel);
        startTransition(() => {
          setShipComponentsByDatasetId((previous) => ({
            ...previous,
            [datasetId]: shipComponents?.shipComponents ?? null,
          }));
          setActiveDataset((previous) =>
            previous.datasetId === datasetId
              ? { ...previous, shipComponents: shipComponents?.shipComponents ?? null }
              : previous,
          );
        });
      } finally {
        shipComponentsInflightRef.current.delete(datasetId);
      }
    },
    [activeDataset.datasetId, activeDataset.hasShipComponents, availableDatasets],
  );

  const ensureChangelogLoaded = useCallback(
    async (requestedDatasetId?: string) => {
      const datasetId = requestedDatasetId ?? activeDataset.datasetId;
      const summary = availableDatasets.find((dataset) => dataset.datasetId === datasetId);
      const targetDatasetId = summary?.datasetId ?? datasetId;
      const targetChannel =
        summary?.channel ??
        (activeDataset.datasetId === datasetId ? activeDataset.channel : undefined);

      if (!summary?.hasChangelog && !activeDataset.hasChangelog) {
        return;
      }

      if (!targetChannel) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(changelogByDatasetIdRef.current, datasetId)) {
        return;
      }

      if (changelogInflightRef.current.has(datasetId)) {
        return;
      }
      changelogInflightRef.current.add(datasetId);
      setChangelogLoading(true);

      try {
        const changelog = await fetchPublishedChangelogById(targetDatasetId, targetChannel);
        startTransition(() => {
          setChangelogByDatasetId((previous) => ({ ...previous, [datasetId]: changelog }));
          setActiveDataset((previous) =>
            previous.datasetId === datasetId
              ? { ...previous, changelog }
              : previous,
          );
        });
      } finally {
        changelogInflightRef.current.delete(datasetId);
        setChangelogLoading(false);
      }
    },
    [activeDataset.datasetId, activeDataset.hasChangelog, availableDatasets],
  );

  const ensureBlueprintDetailLoaded = useCallback(
    async (blueprintId: string, requestedDatasetId?: string) => {
      const datasetId = requestedDatasetId ?? activeDataset.datasetId;
      if (!blueprintId || !datasetId) {
        return;
      }

      if (blueprintDetailsByDatasetIdRef.current[datasetId]?.[blueprintId]) {
        return;
      }

      const inflightKey = `${datasetId}::${blueprintId}`;
      if (blueprintDetailsInflightRef.current.has(inflightKey)) {
        return;
      }
      blueprintDetailsInflightRef.current.add(inflightKey);

      try {
        const blueprint = await fetchPublishedBlueprintDetailById(datasetId, blueprintId);
        if (!blueprint) {
          return;
        }

        startTransition(() => {
          setBlueprintDetailsByDatasetId((previous) => ({
            ...previous,
            [datasetId]: {
              ...(previous[datasetId] ?? {}),
              [blueprintId]: blueprint,
            },
          }));
          setActiveDataset((previous) => {
            if (previous.datasetId !== datasetId) {
              return previous;
            }

            return {
              ...previous,
              blueprints: replaceBlueprintInList(previous.blueprints, blueprint),
            };
          });
          setActiveBlueprintRaw((previous) =>
            previous?.id === blueprintId ? blueprint : previous,
          );
        });
      } finally {
        blueprintDetailsInflightRef.current.delete(inflightKey);
      }
    },
    [activeDataset.datasetId],
  );

  const setActiveDatasetChannel = useCallback(
    async (channel: DatasetChannel) => {
      if (channel === activeDataset.channel && availableDatasets.length > 0 && !datasetError) {
        return;
      }

      const datasets = availableDatasets.length > 0
        ? [...availableDatasets].sort(compareDatasetSummaries)
        : await fetchPublishedDatasetIndex().then((index) => [...index.datasets].sort(compareDatasetSummaries));

      const targetDataset = pickDatasetForChannel(
        channel,
        datasets,
        datasetSelections.ids[channel],
      );

      if (!targetDataset) {
        setDatasetError(`No published dataset is available for channel "${channel}".`);
        return;
      }

      setDatasetLoading(true);
      try {
        await loadDataset(targetDataset, datasets);
      } catch (error) {
        setDatasetError(error instanceof Error ? error.message : 'Failed to switch dataset.');
      } finally {
        setDatasetLoading(false);
      }
    },
    [activeDataset.channel, availableDatasets, datasetError, datasetSelections.ids, loadDataset],
  );

  const setActiveDatasetId = useCallback(
    async (datasetId: string) => {
      if (!datasetId) {
        return;
      }

      if (datasetId === activeDataset.datasetId && availableDatasets.length > 0 && !datasetError) {
        return;
      }

      const datasets = availableDatasets.length > 0
        ? [...availableDatasets].sort(compareDatasetSummaries)
        : await fetchPublishedDatasetIndex().then((index) => [...index.datasets].sort(compareDatasetSummaries));
      const targetDataset = datasets.find((dataset) => dataset.datasetId === datasetId);

      if (!targetDataset) {
        setDatasetError(`Unknown dataset "${datasetId}".`);
        return;
      }

      setDatasetLoading(true);
      try {
        await loadDataset(targetDataset, datasets);
      } catch (error) {
        setDatasetError(error instanceof Error ? error.message : 'Failed to switch dataset.');
      } finally {
        setDatasetLoading(false);
      }
    },
    [activeDataset.datasetId, availableDatasets, datasetError, loadDataset],
  );

  const setActiveBlueprint = useCallback((bp: Blueprint | null) => {
    const nextBlueprint = bp
      ? blueprintDetailsByDatasetIdRef.current[activeDataset.datasetId]?.[bp.id]
        ?? activeDataset.blueprints.find((blueprint) => blueprint.id === bp.id)
        ?? bp
      : null;
    setActiveBlueprintRaw(nextBlueprint);
    setSlotAssignments({});
    if (nextBlueprint) {
      navigateToPath(`/item/${toSlug(nextBlueprint.name)}`, { blueprintId: nextBlueprint.id });
    } else if (itemSlugFromPathname(window.location.pathname)) {
      navigateToPath('/');
    }
  }, [activeDataset.blueprints, activeDataset.datasetId]);

  const toggleFavorite = useCallback(
    (blueprintId: string) => {
      setFavoriteIds((prev) =>
        prev.includes(blueprintId) ? prev.filter((id) => id !== blueprintId) : [...prev, blueprintId],
      );
    },
    [setFavoriteIds],
  );

  const toggleInventory = useCallback(
    (blueprintId: string) => {
      setInventoryIds((prev) =>
        prev.includes(blueprintId) ? prev.filter((id) => id !== blueprintId) : [...prev, blueprintId],
      );
    },
    [setInventoryIds],
  );

  const assignQuality = useCallback((slotId: string, quality: number | undefined) => {
    setSlotAssignments((prev) => ({ ...prev, [slotId]: quality }));
  }, []);

  const clearAssignments = useCallback(() => setSlotAssignments({}), []);

  const setResourceCollected = useCallback(
    (resourceName: string, amount: number) => {
      setResourceProgressRaw((prev) => ({
        ...prev,
        [resourceName]: { ...(prev[resourceName] ?? { method: null }), collected: amount },
      }));
    },
    [setResourceProgressRaw],
  );

  const setResourceMethod = useCallback(
    (resourceName: string, method: ResourceMethod | null) => {
      setResourceProgressRaw((prev) => ({
        ...prev,
        [resourceName]: { ...(prev[resourceName] ?? { collected: 0 }), method },
      }));
    },
    [setResourceProgressRaw],
  );

  const resetResourceProgress = useCallback(() => {
    setResourceProgressRaw({});
  }, [setResourceProgressRaw]);

  const addPlannerResourceRequirement = useCallback(
    (
      resourceName: string,
      quantity: number,
      quantityUnit: MaterialSlotQuantityUnit = 'scu',
    ) => {
      const normalizedName = resourceName.trim();
      const normalizedQuantity = Math.round(Math.max(0, quantity) * 1000) / 1000;
      if (!normalizedName || normalizedQuantity <= 0) {
        return;
      }

      setPlannerResourceRequirements((prev) => ({
        ...prev,
        [normalizedName]: {
          quantity:
            Math.round(
              (((normalizePlannerResourceRequirements(prev)[normalizedName]?.quantity) ?? 0) + normalizedQuantity)
              * 1000,
            ) / 1000,
          quantityUnit,
        },
      }));
    },
    [setPlannerResourceRequirements],
  );

  const clearPlannerResourceRequirement = useCallback(
    (resourceName: string) => {
      setPlannerResourceRequirements((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, resourceName)) {
          return prev;
        }

        const next = { ...prev };
        delete next[resourceName];
        return next;
      });
    },
    [setPlannerResourceRequirements],
  );

  const addGoal = useCallback(
    (qualityScore: number, projectedStats: ItemStats, quantity = 1) => {
      if (!activeBlueprint) return;

      const goal: CraftGoal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        blueprintId: activeBlueprint.id,
        blueprintName: activeBlueprint.name,
        category: activeBlueprint.category,
        slotAssignments: { ...slotAssignments },
        quantity,
        qualityScore,
        projectedStats,
        createdAt: Date.now(),
      };

      setGoals((prev) => [goal, ...prev]);
    },
    [activeBlueprint, slotAssignments, setGoals],
  );

  const ensureGoal = useCallback(
    (qualityScore: number, projectedStats: ItemStats, quantity = 1) => {
      if (!activeBlueprint) return;

      setGoals((prev) => {
        if (prev.some((goal) => goal.blueprintId === activeBlueprint.id)) {
          return prev;
        }

        const goal: CraftGoal = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          blueprintId: activeBlueprint.id,
          blueprintName: activeBlueprint.name,
          category: activeBlueprint.category,
          slotAssignments: { ...slotAssignments },
          quantity,
          qualityScore,
          projectedStats,
          createdAt: Date.now(),
        };

        return [goal, ...prev];
      });
    },
    [activeBlueprint, slotAssignments, setGoals],
  );

  const removeGoal = useCallback((goalId: string) => {
    setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
  }, [setGoals]);

  const updateGoalQuantity = useCallback((goalId: string, quantity: number) => {
    setGoals((prev) => prev.map((goal) => (goal.id === goalId ? { ...goal, quantity } : goal)));
  }, [setGoals]);

  const updateGoal = useCallback(
    (
      goalId: string,
      updatedAssignments: Record<string, number | undefined>,
      qualityScore: number,
      projectedStats: ItemStats,
    ) => {
      setGoals((prev) =>
        prev.map((goal) =>
          goal.id === goalId
            ? { ...goal, slotAssignments: updatedAssignments, qualityScore, projectedStats }
            : goal,
        ),
      );
    },
    [setGoals],
  );

  const selectGoalBlueprint = useCallback(
    (goalId: string) => {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      const bp = blueprints.find((b) => b.id === goal.blueprintId);
      if (!bp) return;
      setActiveBlueprintRaw(bp);
      setSlotAssignments({ ...goal.slotAssignments });
    },
    [goals, blueprints],
  );

  const addToComparison = useCallback(
    (qualityScore: number, projectedStats: ItemStats) => {
      if (!activeBlueprint || comparisonItems.length >= 4) return;

      const color = COMPARISON_COLORS[comparisonItems.length];
      const baseStats = Object.fromEntries(Object.entries(activeBlueprint.baseStats)) as ItemStats;
      const item: ComparisonItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        blueprintId: activeBlueprint.id,
        blueprintName: activeBlueprint.name,
        category: activeBlueprint.category,
        slotAssignments: { ...slotAssignments },
        projectedStats,
        baseStats,
        qualityScore,
        color,
      };

      setComparisonItems((prev) => [...prev, item]);
      setComparisonOpen(true);
    },
    [activeBlueprint, comparisonItems.length, slotAssignments],
  );

  const removeFromComparison = useCallback((id: string) => {
    setComparisonItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return filtered.map((item, index) => ({ ...item, color: COMPARISON_COLORS[index] }));
    });
  }, []);

  const clearComparison = useCallback(() => setComparisonItems([]), []);
  const openComparison = useCallback(() => setComparisonOpen(true), []);
  const closeComparison = useCallback(() => setComparisonOpen(false), []);
  // Resolve initial URL slug once blueprints are available
  useEffect(() => {
    if (blueprints.length === 0 || !pendingSlugRef.current) return;
    const slug = pendingSlugRef.current;
    pendingSlugRef.current = null;
    const bp = blueprints.find((b) => toSlug(b.name) === slug) ?? null;
    if (bp) setActiveBlueprintRaw(bp);
  }, [blueprints]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const slug = itemSlugFromPathname(window.location.pathname);
      if (!slug) {
        setActiveBlueprintRaw(null);
        setSlotAssignments({});
        return;
      }
      const bp = blueprints.find((b) => toSlug(b.name) === slug) ?? null;
      if (bp) {
        setActiveBlueprintRaw(bp);
        setSlotAssignments({});
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [blueprints]);

  return (
    <CraftContext.Provider
      value={{
        appMode,
        setAppMode,
        changelogOpen,
        setChangelogOpen,
        dismantlingData,
        materialSources,
        activeBlueprint,
        blueprints,
        activeDataset,
        availableDatasets,
        activeChannel,
        missionRewards: activeMissionRewards,
        missionRewardsLoading,
        missionRewardsError,
        resourceDataLoading,
        changelogLoading,
        datasetLoading,
        datasetError,
        categoryFilter,
        searchQuery,
        librarySegment,
        manufacturerFilter,
        shipComponentFamilyFilter,
        shipComponentProfileFilter,
        shipComponentSizeFilter,
        shipComponentGradeFilter,
        legalityFilter,
        locationFilter,
        materialFilter,
        rarityFilter,
        slotCountFilter,
        craftTimeFilter,
        weaponTypeFilter,
        ammoTypeFilter,
        ammoFlavorFilter,
        armorTypeFilter,
        armorSlotFilter,
        acquisitionEmployerFilter,
        acquisitionScaleFilter,
        acquisitionStandingFilter,
        blueprintSort,
        setLibrarySegment,
        setManufacturerFilter,
        setShipComponentFamilyFilter,
        setShipComponentProfileFilter,
        setShipComponentSizeFilter,
        setShipComponentGradeFilter,
        setLegalityFilter,
        setLocationFilter,
        setMaterialFilter,
        setRarityFilter,
        setSlotCountFilter,
        setCraftTimeFilter,
        setWeaponTypeFilter,
        setAmmoTypeFilter,
        setAmmoFlavorFilter,
        setArmorTypeFilter,
        setArmorSlotFilter,
        setAcquisitionEmployerFilter,
        setAcquisitionScaleFilter,
        setAcquisitionStandingFilter,
        setBlueprintSort,
        favoriteIds,
        inventoryIds,
        slotAssignments,
        goals,
        plannerResourceRequirements,
        resourceProgress,
        comparisonItems,
        comparisonOpen,
        setActiveBlueprint,
        setActiveDatasetChannel,
        setActiveDatasetId,
        refreshDatasets,
        ensureMissionRewardsLoaded,
        ensureFactionContractsLoaded,
        factionContractsByFactionId,
        factionContractsLoadingIds,
        ensureResourceDataLoaded,
        ensureShipComponentsLoaded,
        ensureChangelogLoaded,
        ensureBlueprintDetailLoaded,
        setCategoryFilter,
        setSearchQuery,
        toggleFavorite,
        toggleInventory,
        assignQuality,
        clearAssignments,
        addGoal,
        ensureGoal,
        removeGoal,
        updateGoalQuantity,
        updateGoal,
        selectGoalBlueprint,
        addPlannerResourceRequirement,
        clearPlannerResourceRequirement,
        setResourceCollected,
        setResourceMethod,
        resetResourceProgress,
        addToComparison,
        removeFromComparison,
        clearComparison,
        openComparison,
        closeComparison,
      }}
    >
      {children}
    </CraftContext.Provider>
  );
}

export function useCraft(): CraftState {
  const context = useContext(CraftContext);
  if (!context) {
    throw new Error('useCraft must be used inside CraftProvider');
  }

  return context;
}

export function useFilteredBlueprints(): Blueprint[] {
  const { blueprints, categoryFilter, searchQuery, favoriteIds, missionRewards } = useCraft();

  return useMemo(
    () => {
      let obtainableIds: Set<string> | null = null;
      if (categoryFilter === 'obtainable') {
        obtainableIds = new Set<string>();
        for (const entry of missionRewards?.blueprintAcquisitionGraph ?? []) {
          obtainableIds.add(entry.blueprint.id);
        }
      }

      return blueprints.filter((blueprint) => {
        if (categoryFilter === 'favorites') {
          return favoriteIds.includes(blueprint.id);
        }

        if (categoryFilter === 'obtainable') {
          return obtainableIds!.has(blueprint.id);
        }

        if (categoryFilter !== 'all' && blueprint.category !== categoryFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const normalizedQuery = searchQuery.toLowerCase();
          return (
            blueprint.name.toLowerCase().includes(normalizedQuery) ||
            blueprint.manufacturer.toLowerCase().includes(normalizedQuery)
          );
        }

        return true;
      }).sort((a, b) => a.name.localeCompare(b.name));
    },
    [blueprints, categoryFilter, searchQuery, favoriteIds, missionRewards],
  );
}
