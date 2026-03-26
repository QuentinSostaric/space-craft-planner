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
  DatasetSummary,
  DismantlingData,
  GameDataset,
  ItemStats,
  LegalityFilter,
  LibrarySegment,
  MaterialSlotQuantityUnit,
  MaterialSources,
  MissionRewardsData,
  PlannerResourceRequirements,
  RarityFilter,
  ResourceMethod,
  ResourceProgress,
  SlotCountFilter,
  StandingBucket,
} from '../types';
import { COMPARISON_COLORS, LS_KEYS } from '../types';
import {
  fetchPublishedDatasetById,
  fetchPublishedDatasetIndex,
  fetchPublishedMissionRewardsById,
} from '../hooks/gameDataApi';
import { useLocalPersist } from '../hooks/useLocalPersist';

const EMPTY_DATASET: GameDataset = {
  channel: 'ptu',
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
  const dateA = Date.parse(a.importedAt ?? '') || 0;
  const dateB = Date.parse(b.importedAt ?? '') || 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }

  const buildA = Number(a.buildNumber ?? 0);
  const buildB = Number(b.buildNumber ?? 0);
  if (buildA !== buildB) {
    return buildB - buildA;
  }

  return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
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

export function CraftProvider({ children }: { children: ReactNode }) {
  const [, setPreferredDatasetIds] = useLocalPersist<
    Partial<Record<DatasetChannel, string>>
  >(LS_KEYS.DATASET_SELECTIONS, {});
  const [activeDataset, setActiveDataset] = useState<GameDataset>(EMPTY_DATASET);
  const [availableDatasets, setAvailableDatasets] = useState<DatasetSummary[]>([]);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [missionRewardsByDatasetId, setMissionRewardsByDatasetId] = useState<
    Record<string, MissionRewardsData | null>
  >({});
  const [missionRewardsLoading, setMissionRewardsLoading] = useState(false);
  const [missionRewardsError, setMissionRewardsError] = useState<string | null>(null);
  const [activeBlueprint, setActiveBlueprintRaw] = useState<Blueprint | null>(null);
  // Slug from URL on initial mount — resolved once blueprints load
  const pendingSlugRef = useRef<string | null>(itemSlugFromPathname(window.location.pathname));
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySegment, setLibrarySegment] = useState<LibrarySegment>('all');
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
  const [inventoryIds, setInventoryIds] = useLocalPersist<string[]>(LS_KEYS.INVENTORY, [
    'bp_craft_behr_pistol_ballistic_01',
    'bp_craft_behr_pistol_ballistic_01_mag',
    'bp_craft_behr_rifle_ballistic_01',
    'bp_craft_behr_rifle_ballistic_01_mag',
  ]);

  const blueprints = activeDataset.blueprints;
  const activeChannel = activeDataset.channel;

  const applyDataset = useCallback(
    (
      dataset: GameDataset,
      datasets: DatasetSummary[],
      errorMessage: string | null,
    ) => {
      const cachedMissionRewards = missionRewardsByDatasetId[dataset.datasetId];
      startTransition(() => {
        setActiveDataset({
          ...dataset,
          missionRewards:
            cachedMissionRewards !== undefined
              ? cachedMissionRewards
              : dataset.missionRewards ?? null,
        });
        setAvailableDatasets(datasets);
        setDatasetError(errorMessage);
        setMissionRewardsError(null);
        setPreferredDatasetIds((previous) => ({
          ...previous,
          [dataset.channel]: dataset.datasetId,
        }));
        if (dataset.missionRewards != null) {
          setMissionRewardsByDatasetId((previous) =>
            Object.prototype.hasOwnProperty.call(previous, dataset.datasetId)
              ? previous
              : { ...previous, [dataset.datasetId]: dataset.missionRewards ?? null },
          );
        }
        setSlotAssignments({});
        setActiveBlueprintRaw((previous) =>
          previous ? dataset.blueprints.find((blueprint) => blueprint.id === previous.id) ?? null : null,
        );
      });
    },
    [missionRewardsByDatasetId, setPreferredDatasetIds],
  );

  const loadDataset = useCallback(
    async (summary: DatasetSummary, datasets: DatasetSummary[]) => {
      const dataset = await fetchPublishedDatasetById(summary.datasetId, summary.channel);
      applyDataset(dataset, datasets, null);
      return dataset;
    },
    [applyDataset],
  );

  const refreshDatasets = useCallback(async () => {
    setDatasetLoading(true);

    try {
      const index = await fetchPublishedDatasetIndex();

      if (index.datasets.length === 0) {
        setDatasetError('No published dataset is available yet.');
        setDatasetLoading(false);
        return;
      }

      const sortedDatasets = [...index.datasets].sort(compareDatasetSummaries);
      const currentDataset = activeDataset.datasetId
        ? sortedDatasets.find((dataset) => dataset.datasetId === activeDataset.datasetId) ?? null
        : null;
      const targetDataset = currentDataset ?? sortedDatasets[0] ?? null;

      if (!targetDataset) {
        throw new Error('No published dataset is available.');
      }

      await loadDataset(targetDataset, sortedDatasets);
    } catch (error) {
      setDatasetError(error instanceof Error ? error.message : 'Failed to load published datasets.');
    } finally {
      setDatasetLoading(false);
    }
  }, [activeDataset.datasetId, loadDataset]);

  useEffect(() => {
    void refreshDatasets();
  }, [refreshDatasets]);

  const ensureMissionRewardsLoaded = useCallback(
    async (requestedDatasetId?: string) => {
      const datasetId = requestedDatasetId ?? activeDataset.datasetId;
      const summary = availableDatasets.find((dataset) => dataset.datasetId === datasetId);

      if (!summary?.hasMissionRewards) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(missionRewardsByDatasetId, datasetId)) {
        return;
      }

      setMissionRewardsLoading(true);
      setMissionRewardsError(null);

      try {
        const missionRewards = await fetchPublishedMissionRewardsById(summary.datasetId, summary.channel);
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
        setMissionRewardsLoading(false);
      }
    },
    [activeDataset.datasetId, availableDatasets, missionRewardsByDatasetId],
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
    setActiveBlueprintRaw(bp);
    setSlotAssignments({});
    if (bp) {
      navigateToPath(`/item/${toSlug(bp.name)}`, { blueprintId: bp.id });
    } else if (itemSlugFromPathname(window.location.pathname)) {
      navigateToPath('/');
    }
  }, []);

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
        if (missionRewards) {
          for (const group of missionRewards.factionGroups) {
            for (const contract of group.contracts) {
              for (const bp of contract.rewardedBlueprints) {
                obtainableIds.add(bp.id);
              }
            }
          }
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
