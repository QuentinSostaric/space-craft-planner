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
import { FilterProvider } from './FilterContext';
import { useAuth } from '../auth/AuthContext';
import { itemSlugFromPathname, navigateToPath, toSlug } from '../utils/slug';
import type {
  AppMode,
  Blueprint,
  ComparisonItem,
  CraftGoal,
  DatasetChannel,
  DatasetChangelog,
  DatasetSummary,
  DismantlingData,
  GameDataset,
  ItemStats,
  MaterialSlotQuantityUnit,
  MaterialSources,
  MissionContract,
  MissionRewardsData,
  PlannerResourceRequirements,
  PlannerTodoItem,
  PlannerTodoSource,
  ResourceMethod,
  ResourceInsight,
  ResourceProgress,
  ShipComponentsDataset,
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

export const DEFAULT_INVENTORY_IDS = [
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
const DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS = 1_200;

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
  favoriteIds: string[];
  inventoryIds: string[];
  slotAssignments: Record<string, number | undefined>;
  goals: CraftGoal[];
  plannerTodoItems: PlannerTodoItem[];
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
  toggleFavorite: (blueprintId: string) => void;
  toggleInventory: (blueprintId: string) => void;
  replaceLocalBlueprintCollections: (nextState: {
    favoriteBlueprintIds?: string[];
    inventoryBlueprintIds?: string[];
  }) => void;
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
  addPlannerTodoItem: (item: {
    title: string;
    description?: string | null;
    source?: PlannerTodoSource;
    relatedBlueprintId?: string | null;
    relatedBlueprintName?: string | null;
  }) => void;
  updatePlannerTodoItem: (
    todoId: string,
    updates: {
      title?: string;
      description?: string | null;
      relatedBlueprintId?: string | null;
      relatedBlueprintName?: string | null;
    },
  ) => void;
  togglePlannerTodoItem: (todoId: string) => void;
  removePlannerTodoItem: (todoId: string) => void;
  clearCompletedPlannerTodoItems: () => void;
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

// Legacy goal migration: map old Quality string codes to numeric scores.
// Module-scoped so it has a stable identity (it was previously redeclared on
// every render, forcing an eslint-disable on the migration useMemo deps).
const LEGACY_QUALITY_VALUE: Record<string, number> = { CMR: 1000, CMP: 500, CMS: 300 };

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
): DatasetSummary | null {
  const channelDatasets = datasets
    .filter((dataset) => dataset.channel === channel)
    .sort(compareDatasetSummaries);

  if (channelDatasets.length === 0) {
    return null;
  }

  return channelDatasets[0];
}

function pickStoredChannelDataset(
  datasets: DatasetSummary[],
  selections: DatasetSelections,
): DatasetSummary | null {
  if (selections.activeChannel) {
    const activeChannelDataset = pickDatasetForChannel(selections.activeChannel, datasets);
    if (activeChannelDataset) {
      return activeChannelDataset;
    }
  }

  const storedDatasets = Object.entries(selections.ids)
    .map(([channel]) =>
      isDatasetChannel(channel) ? pickDatasetForChannel(channel, datasets) : null,
    )
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

function normalizePlannerTodoSource(value: unknown): PlannerTodoSource {
  return String(value ?? '').trim().toLowerCase() === 'mission-blueprint'
    ? 'mission-blueprint'
    : 'manual';
}

function normalizePlannerTodoItems(items: PlannerTodoItem[] | null | undefined): PlannerTodoItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const byId = new Map<string, PlannerTodoItem>();
  for (const item of items) {
    const id = String(item?.id ?? '').trim();
    const title = String(item?.title ?? '').trim();
    if (!id || !title) {
      continue;
    }

    const createdAt = Number(item.createdAt);
    const completedAt = item.completedAt == null ? null : Number(item.completedAt);
    byId.set(id, {
      id,
      title,
      description: item.description ? String(item.description) : null,
      source: normalizePlannerTodoSource(item.source),
      relatedBlueprintId: item.relatedBlueprintId ? String(item.relatedBlueprintId) : null,
      relatedBlueprintName: item.relatedBlueprintName ? String(item.relatedBlueprintName) : null,
      completed: Boolean(item.completed),
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      completedAt: Number.isFinite(completedAt) ? completedAt : null,
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    return right.createdAt - left.createdAt;
  });
}

function createPlannerTodoId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const { account, syncAccountState } = useAuth();
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

  const [rawGoals, setLocalGoals] = useLocalPersist<CraftGoal[]>(LS_KEYS.GOALS, []);
  const [rawPlannerTodoItems, setLocalPlannerTodoItems] = useLocalPersist<PlannerTodoItem[]>(
    LS_KEYS.PLANNER_TODO_ITEMS,
    [],
  );
  const [rawPlannerResourceRequirements, setLocalPlannerResourceRequirements] = useLocalPersist<PlannerResourceRequirementsStorage>(
    LS_KEYS.PLANNER_RESOURCE_REQUIREMENTS,
    {},
  );
  const [rawResourceProgress, setLocalResourceProgress] = useLocalPersist<Record<string, ResourceProgress>>(
    LS_KEYS.RESOURCE_PROGRESS,
    {},
  );
  // Migrate legacy goals: coerce qualityScore to number, normalize slot assignments
  // (old data may have stored Quality strings like "CMR" instead of numeric values)
  const localGoals = useMemo(
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
    [rawGoals],
  );
  const localPlannerResourceRequirements = useMemo(
    () => normalizePlannerResourceRequirements(rawPlannerResourceRequirements),
    [rawPlannerResourceRequirements],
  );
  const localPlannerTodoItems = useMemo(
    () => normalizePlannerTodoItems(rawPlannerTodoItems),
    [rawPlannerTodoItems],
  );
  const [localFavoriteIds, setLocalFavoriteIds] = useLocalPersist<string[]>(LS_KEYS.FAVORITES, []);
  const [localInventoryIds, setLocalInventoryIds] = useLocalPersist<string[]>(
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

    if (account) {
      return;
    }

    setLocalInventoryIds((previous) => [...new Set([...DEFAULT_INVENTORY_IDS, ...previous])]);
    setInventorySeedVersion(INVENTORY_SEED_VERSION);
  }, [account, inventorySeedVersion, setInventorySeedVersion, setLocalInventoryIds]);

  const goals = account?.planner.goals ?? localGoals;
  const plannerTodoItems = account?.planner.todoItems ?? localPlannerTodoItems;
  const plannerResourceRequirements =
    account?.planner.resourceRequirements ?? localPlannerResourceRequirements;
  const resourceProgress = account?.planner.resourceProgress ?? rawResourceProgress;
  const favoriteIds = account?.favoriteBlueprintIds ?? localFavoriteIds;
  const inventoryIds = account?.inventoryBlueprintIds ?? localInventoryIds;

  const blueprints = activeDataset.blueprints;
  const activeChannel = activeDataset.channel;

  const syncAuthenticatedAccountSnapshot = useCallback(
    async (
      updater: (snapshot: {
        favoriteBlueprintIds: string[];
        inventoryBlueprintIds: string[];
        planner: {
          goals: CraftGoal[];
          todoItems: PlannerTodoItem[];
          resourceRequirements: PlannerResourceRequirements;
          resourceProgress: Record<string, ResourceProgress>;
        };
      }) => {
        favoriteBlueprintIds: string[];
        inventoryBlueprintIds: string[];
        planner: {
          goals: CraftGoal[];
          todoItems: PlannerTodoItem[];
          resourceRequirements: PlannerResourceRequirements;
          resourceProgress: Record<string, ResourceProgress>;
        };
      },
      options?: {
        flushAfterMs?: number;
      },
    ) => {
      if (!account) {
        return;
      }

      const nextSnapshot = updater({
        favoriteBlueprintIds: [...account.favoriteBlueprintIds],
        inventoryBlueprintIds: [...account.inventoryBlueprintIds],
        planner: {
          goals: [...account.planner.goals],
          todoItems: [...(account.planner.todoItems ?? [])],
          resourceRequirements: { ...account.planner.resourceRequirements },
          resourceProgress: { ...account.planner.resourceProgress },
        },
      });

      await syncAccountState({
        favoriteBlueprintIds: [...new Set(nextSnapshot.favoriteBlueprintIds)],
        inventoryBlueprintIds: [...new Set(nextSnapshot.inventoryBlueprintIds)],
        planner: {
          goals: nextSnapshot.planner.goals,
          todoItems: normalizePlannerTodoItems(nextSnapshot.planner.todoItems),
          resourceRequirements: nextSnapshot.planner.resourceRequirements,
          resourceProgress: nextSnapshot.planner.resourceProgress,
        },
      }, options);
    },
    [account, syncAccountState],
  );

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
      const activeChannelDataset = pickDatasetForChannel(activeDataset.channel, sortedDatasets);
      const storedDataset = pickStoredChannelDataset(sortedDatasets, datasetSelections);
      const targetDataset = activeDataset.datasetId
        ? activeChannelDataset ?? storedDataset ?? pickDefaultDataset(sortedDatasets)
        : storedDataset ?? pickDefaultDataset(sortedDatasets);

      if (!targetDataset) {
        throw new Error('No published dataset is available.');
      }

      await loadDataset(targetDataset, sortedDatasets);
    } catch (error) {
      setDatasetError(error instanceof Error ? error.message : 'Failed to load published dataset.');
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
    [activeDataset.channel, availableDatasets, datasetError, loadDataset],
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
      const requestedDataset = findDatasetById(datasets, datasetId);
      const targetDataset = requestedDataset
        ? pickDatasetForChannel(requestedDataset.channel, datasets)
        : null;

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
      navigateToPath('/blueprints');
    }
  }, [activeDataset.blueprints, activeDataset.datasetId]);

  const toggleFavorite = useCallback(
    (blueprintId: string) => {
      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          favoriteBlueprintIds: snapshot.favoriteBlueprintIds.includes(blueprintId)
            ? snapshot.favoriteBlueprintIds.filter((id) => id !== blueprintId)
            : [...snapshot.favoriteBlueprintIds, blueprintId],
        }));
        return;
      }

      setLocalFavoriteIds((prev) =>
        prev.includes(blueprintId) ? prev.filter((id) => id !== blueprintId) : [...prev, blueprintId],
      );
    },
    [account, setLocalFavoriteIds, syncAuthenticatedAccountSnapshot],
  );

  const toggleInventory = useCallback(
    (blueprintId: string) => {
      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          inventoryBlueprintIds: snapshot.inventoryBlueprintIds.includes(blueprintId)
            ? snapshot.inventoryBlueprintIds.filter((id) => id !== blueprintId)
            : [...snapshot.inventoryBlueprintIds, blueprintId],
        }));
        return;
      }

      setLocalInventoryIds((prev) =>
        prev.includes(blueprintId) ? prev.filter((id) => id !== blueprintId) : [...prev, blueprintId],
      );
    },
    [account, setLocalInventoryIds, syncAuthenticatedAccountSnapshot],
  );

  const replaceLocalBlueprintCollections = useCallback(
    (nextState: { favoriteBlueprintIds?: string[]; inventoryBlueprintIds?: string[] }) => {
      if (Array.isArray(nextState.favoriteBlueprintIds)) {
        setLocalFavoriteIds([
          ...new Set(
            nextState.favoriteBlueprintIds
              .map((entry) => String(entry ?? '').trim())
              .filter(Boolean),
          ),
        ]);
      }

      if (Array.isArray(nextState.inventoryBlueprintIds)) {
        setLocalInventoryIds([
          ...new Set(
            nextState.inventoryBlueprintIds
              .map((entry) => String(entry ?? '').trim())
              .filter(Boolean),
          ),
        ]);
      }
    },
    [setLocalFavoriteIds, setLocalInventoryIds],
  );

  const assignQuality = useCallback((slotId: string, quality: number | undefined) => {
    setSlotAssignments((prev) => ({ ...prev, [slotId]: quality }));
  }, []);

  const clearAssignments = useCallback(() => setSlotAssignments({}), []);

  const setResourceCollected = useCallback(
    (resourceName: string, amount: number) => {
      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            resourceProgress: {
              ...snapshot.planner.resourceProgress,
              [resourceName]: {
                ...(snapshot.planner.resourceProgress[resourceName] ?? { method: null }),
                collected: amount,
              },
            },
          },
        }), { flushAfterMs: DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS });
        return;
      }

      setLocalResourceProgress((prev) => ({
        ...prev,
        [resourceName]: { ...(prev[resourceName] ?? { method: null }), collected: amount },
      }));
    },
    [account, setLocalResourceProgress, syncAuthenticatedAccountSnapshot],
  );

  const setResourceMethod = useCallback(
    (resourceName: string, method: ResourceMethod | null) => {
      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            resourceProgress: {
              ...snapshot.planner.resourceProgress,
              [resourceName]: {
                ...(snapshot.planner.resourceProgress[resourceName] ?? { collected: 0 }),
                method,
              },
            },
          },
        }), { flushAfterMs: DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS });
        return;
      }

      setLocalResourceProgress((prev) => ({
        ...prev,
        [resourceName]: { ...(prev[resourceName] ?? { collected: 0 }), method },
      }));
    },
    [account, setLocalResourceProgress, syncAuthenticatedAccountSnapshot],
  );

  const resetResourceProgress = useCallback(() => {
    if (account) {
      void syncAuthenticatedAccountSnapshot((snapshot) => ({
        ...snapshot,
        planner: {
          ...snapshot.planner,
          resourceProgress: {},
        },
      }));
      return;
    }

    setLocalResourceProgress({});
  }, [account, setLocalResourceProgress, syncAuthenticatedAccountSnapshot]);

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

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            resourceRequirements: {
              ...snapshot.planner.resourceRequirements,
              [normalizedName]: {
                quantity:
                  Math.round(
                    ((((snapshot.planner.resourceRequirements[normalizedName]?.quantity) ?? 0) + normalizedQuantity)
                    * 1000),
                  ) / 1000,
                quantityUnit,
              },
            },
          },
        }), { flushAfterMs: DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS });
        return;
      }

      setLocalPlannerResourceRequirements((prev) => ({
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
    [account, setLocalPlannerResourceRequirements, syncAuthenticatedAccountSnapshot],
  );

  const clearPlannerResourceRequirement = useCallback(
    (resourceName: string) => {
      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => {
          if (!Object.prototype.hasOwnProperty.call(snapshot.planner.resourceRequirements, resourceName)) {
            return snapshot;
          }

          const nextResourceRequirements = { ...snapshot.planner.resourceRequirements };
          delete nextResourceRequirements[resourceName];

          return {
            ...snapshot,
            planner: {
              ...snapshot.planner,
              resourceRequirements: nextResourceRequirements,
            },
          };
        });
        return;
      }

      setLocalPlannerResourceRequirements((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, resourceName)) {
          return prev;
        }

        const next = { ...prev };
        delete next[resourceName];
        return next;
      });
    },
    [account, setLocalPlannerResourceRequirements, syncAuthenticatedAccountSnapshot],
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

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            goals: [goal, ...snapshot.planner.goals],
          },
        }));
        return;
      }

      setLocalGoals((prev) => [goal, ...prev]);
    },
    [account, activeBlueprint, setLocalGoals, slotAssignments, syncAuthenticatedAccountSnapshot],
  );

  const ensureGoal = useCallback(
    (qualityScore: number, projectedStats: ItemStats, quantity = 1) => {
      if (!activeBlueprint) return;

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => {
          if (snapshot.planner.goals.some((goal) => goal.blueprintId === activeBlueprint.id)) {
            return snapshot;
          }

          const ensuredGoal: CraftGoal = {
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

          return {
            ...snapshot,
            planner: {
              ...snapshot.planner,
              goals: [ensuredGoal, ...snapshot.planner.goals],
            },
          };
        });
        return;
      }

      setLocalGoals((prev) => {
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
    [account, activeBlueprint, setLocalGoals, slotAssignments, syncAuthenticatedAccountSnapshot],
  );

  const removeGoal = useCallback((goalId: string) => {
    if (account) {
      void syncAuthenticatedAccountSnapshot((snapshot) => ({
        ...snapshot,
        planner: {
          ...snapshot.planner,
          goals: snapshot.planner.goals.filter((goal) => goal.id !== goalId),
        },
      }));
      return;
    }

    setLocalGoals((prev) => prev.filter((goal) => goal.id !== goalId));
  }, [account, setLocalGoals, syncAuthenticatedAccountSnapshot]);

  const updateGoalQuantity = useCallback((goalId: string, quantity: number) => {
    if (account) {
      void syncAuthenticatedAccountSnapshot((snapshot) => ({
        ...snapshot,
        planner: {
          ...snapshot.planner,
          goals: snapshot.planner.goals.map((goal) =>
            goal.id === goalId ? { ...goal, quantity } : goal,
          ),
        },
      }), { flushAfterMs: DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS });
      return;
    }

    setLocalGoals((prev) => prev.map((goal) => (goal.id === goalId ? { ...goal, quantity } : goal)));
  }, [account, setLocalGoals, syncAuthenticatedAccountSnapshot]);

  const updateGoal = useCallback(
    (
      goalId: string,
      updatedAssignments: Record<string, number | undefined>,
      qualityScore: number,
      projectedStats: ItemStats,
    ) => {
      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            goals: snapshot.planner.goals.map((goal) =>
              goal.id === goalId
                ? { ...goal, slotAssignments: updatedAssignments, qualityScore, projectedStats }
                : goal,
            ),
          },
        }), { flushAfterMs: DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS });
        return;
      }

      setLocalGoals((prev) =>
        prev.map((goal) =>
          goal.id === goalId
            ? { ...goal, slotAssignments: updatedAssignments, qualityScore, projectedStats }
            : goal,
        ),
      );
    },
    [account, setLocalGoals, syncAuthenticatedAccountSnapshot],
  );

  const addPlannerTodoItem = useCallback(
    ({
      title,
      description = null,
      source = 'manual',
      relatedBlueprintId = null,
      relatedBlueprintName = null,
    }: {
      title: string;
      description?: string | null;
      source?: PlannerTodoSource;
      relatedBlueprintId?: string | null;
      relatedBlueprintName?: string | null;
    }) => {
      const normalizedTitle = String(title ?? '').trim();
      if (!normalizedTitle) {
        return;
      }

      const todoItem: PlannerTodoItem = {
        id: createPlannerTodoId(),
        title: normalizedTitle,
        description: description ? String(description).trim() || null : null,
        source: normalizePlannerTodoSource(source),
        relatedBlueprintId: relatedBlueprintId ? String(relatedBlueprintId) : null,
        relatedBlueprintName: relatedBlueprintName ? String(relatedBlueprintName) : null,
        completed: false,
        createdAt: Date.now(),
        completedAt: null,
      };

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            todoItems: normalizePlannerTodoItems([todoItem, ...snapshot.planner.todoItems]),
          },
        }));
        return;
      }

      setLocalPlannerTodoItems((prev) => normalizePlannerTodoItems([todoItem, ...prev]));
    },
    [account, setLocalPlannerTodoItems, syncAuthenticatedAccountSnapshot],
  );

  const updatePlannerTodoItem = useCallback(
    (
      todoId: string,
      updates: {
        title?: string;
        description?: string | null;
        relatedBlueprintId?: string | null;
        relatedBlueprintName?: string | null;
      },
    ) => {
      const applyUpdates = (items: PlannerTodoItem[]) =>
        normalizePlannerTodoItems(
          items.map((item) => {
            if (item.id !== todoId) {
              return item;
            }

            const nextTitle =
              updates.title == null ? item.title : String(updates.title).trim() || item.title;
            return {
              ...item,
              title: nextTitle,
              description:
                updates.description === undefined
                  ? item.description
                  : updates.description
                    ? String(updates.description).trim() || null
                    : null,
              relatedBlueprintId:
                updates.relatedBlueprintId === undefined
                  ? item.relatedBlueprintId
                  : updates.relatedBlueprintId
                    ? String(updates.relatedBlueprintId)
                    : null,
              relatedBlueprintName:
                updates.relatedBlueprintName === undefined
                  ? item.relatedBlueprintName
                  : updates.relatedBlueprintName
                    ? String(updates.relatedBlueprintName)
                    : null,
            };
          }),
        );

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            todoItems: applyUpdates(snapshot.planner.todoItems),
          },
        }), { flushAfterMs: DEFAULT_CONNECTED_CONTINUOUS_FLUSH_MS });
        return;
      }

      setLocalPlannerTodoItems((prev) => applyUpdates(prev));
    },
    [account, setLocalPlannerTodoItems, syncAuthenticatedAccountSnapshot],
  );

  const togglePlannerTodoItem = useCallback(
    (todoId: string) => {
      const applyToggle = (items: PlannerTodoItem[]) =>
        normalizePlannerTodoItems(
          items.map((item) =>
            item.id === todoId
              ? {
                  ...item,
                  completed: !item.completed,
                  completedAt: item.completed ? null : Date.now(),
                }
              : item,
          ),
        );

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            todoItems: applyToggle(snapshot.planner.todoItems),
          },
        }));
        return;
      }

      setLocalPlannerTodoItems((prev) => applyToggle(prev));
    },
    [account, setLocalPlannerTodoItems, syncAuthenticatedAccountSnapshot],
  );

  const removePlannerTodoItem = useCallback(
    (todoId: string) => {
      const applyRemoval = (items: PlannerTodoItem[]) =>
        normalizePlannerTodoItems(items.filter((item) => item.id !== todoId));

      if (account) {
        void syncAuthenticatedAccountSnapshot((snapshot) => ({
          ...snapshot,
          planner: {
            ...snapshot.planner,
            todoItems: applyRemoval(snapshot.planner.todoItems),
          },
        }));
        return;
      }

      setLocalPlannerTodoItems((prev) => applyRemoval(prev));
    },
    [account, setLocalPlannerTodoItems, syncAuthenticatedAccountSnapshot],
  );

  const clearCompletedPlannerTodoItems = useCallback(() => {
    const applyClear = (items: PlannerTodoItem[]) =>
      normalizePlannerTodoItems(items.filter((item) => !item.completed));

    if (account) {
      void syncAuthenticatedAccountSnapshot((snapshot) => ({
        ...snapshot,
        planner: {
          ...snapshot.planner,
          todoItems: applyClear(snapshot.planner.todoItems),
        },
      }));
      return;
    }

    setLocalPlannerTodoItems((prev) => applyClear(prev));
  }, [account, setLocalPlannerTodoItems, syncAuthenticatedAccountSnapshot]);

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

  // Memoize the context value so its identity only changes when one of the
  // underlying state slices changes — not on every CraftProvider render (e.g.
  // when an ancestor re-renders). The action callbacks below are all useCallback
  // wrapped and the setters come from useState/useLocalPersist, so they are
  // referentially stable and don't churn this memo.
  const contextValue = useMemo<CraftState>(
    () => ({
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
      favoriteIds,
      inventoryIds,
      slotAssignments,
      goals,
      plannerTodoItems,
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
      toggleFavorite,
      toggleInventory,
      replaceLocalBlueprintCollections,
      assignQuality,
      clearAssignments,
      addGoal,
      ensureGoal,
      removeGoal,
      updateGoalQuantity,
      updateGoal,
      addPlannerTodoItem,
      updatePlannerTodoItem,
      togglePlannerTodoItem,
      removePlannerTodoItem,
      clearCompletedPlannerTodoItems,
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
    }),
    [
      appMode, setAppMode, changelogOpen, setChangelogOpen, dismantlingData, materialSources,
      activeBlueprint, blueprints, activeDataset, availableDatasets, activeChannel,
      activeMissionRewards, missionRewardsLoading, missionRewardsError, resourceDataLoading,
      changelogLoading, datasetLoading, datasetError, favoriteIds, inventoryIds, slotAssignments,
      goals, plannerTodoItems, plannerResourceRequirements, resourceProgress, comparisonItems,
      comparisonOpen, setActiveBlueprint, setActiveDatasetChannel, setActiveDatasetId, refreshDatasets,
      ensureMissionRewardsLoaded, ensureFactionContractsLoaded, factionContractsByFactionId,
      factionContractsLoadingIds, ensureResourceDataLoaded, ensureShipComponentsLoaded,
      ensureChangelogLoaded, ensureBlueprintDetailLoaded, toggleFavorite, toggleInventory,
      replaceLocalBlueprintCollections, assignQuality, clearAssignments, addGoal, ensureGoal,
      removeGoal, updateGoalQuantity, updateGoal, addPlannerTodoItem, updatePlannerTodoItem,
      togglePlannerTodoItem, removePlannerTodoItem, clearCompletedPlannerTodoItems, selectGoalBlueprint,
      addPlannerResourceRequirement, clearPlannerResourceRequirement, setResourceCollected,
      setResourceMethod, resetResourceProgress, addToComparison, removeFromComparison, clearComparison,
      openComparison, closeComparison,
    ],
  );

  return (
    <CraftContext.Provider value={contextValue}>
      <FilterProvider>{children}</FilterProvider>
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
