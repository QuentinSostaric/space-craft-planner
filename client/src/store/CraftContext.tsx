import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppMode,
  Blueprint,
  CategoryFilter,
  ComparisonItem,
  CraftGoal,
  DatasetChannel,
  DatasetSummary,
  DismantlingData,
  GameDataset,
  ItemStats,
  ItemTab,
  LegalityFilter,
  LibrarySegment,
  MissionRewardsData,
} from '../types';
import { COMPARISON_COLORS, LS_KEYS } from '../types';
import {
  fetchPublishedDataset,
  fetchPublishedDatasetIndex,
  fetchPublishedMissionRewards,
} from '../hooks/gameDataApi';
import { useLocalPersist } from '../hooks/useLocalPersist';

const EMPTY_DATASET: GameDataset = {
  channel: 'ptu',
  datasetId: '',
  label: '',
  version: '',
  branch: null,
  buildNumber: null,
  published: false,
  blueprintCount: 0,
  resourceCount: 0,
  blueprints: [],
  resources: [],
  changelog: null,
  dismantling: null,
  materialSources: null,
  missionRewards: null,
  importedAt: null,
  updatedAt: null,
};

interface CraftState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  activeItemTab: ItemTab;
  setActiveItemTab: (tab: ItemTab) => void;
  changelogOpen: boolean;
  setChangelogOpen: (open: boolean) => void;
  dismantlingData: DismantlingData | null;
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
  legalityFilter: LegalityFilter;
  locationFilter: string | null;
  setLibrarySegment: (segment: LibrarySegment) => void;
  setManufacturerFilter: (manufacturer: string | null) => void;
  setLegalityFilter: (legality: LegalityFilter) => void;
  setLocationFilter: (location: string | null) => void;
  favoriteIds: string[];
  inventoryIds: string[];
  slotAssignments: Record<string, number | undefined>;
  goals: CraftGoal[];
  plannerOpen: boolean;
  comparisonItems: ComparisonItem[];
  comparisonOpen: boolean;
  setActiveBlueprint: (bp: Blueprint | null) => void;
  setActiveDatasetChannel: (channel: DatasetChannel) => Promise<void>;
  refreshDatasets: () => Promise<void>;
  ensureMissionRewardsLoaded: (channel?: DatasetChannel) => Promise<void>;
  setCategoryFilter: (cat: CategoryFilter) => void;
  setSearchQuery: (q: string) => void;
  toggleFavorite: (blueprintId: string) => void;
  toggleInventory: (blueprintId: string) => void;
  assignQuality: (slotId: string, quality: number | undefined) => void;
  clearAssignments: () => void;
  addGoal: (score: number, projectedStats: ItemStats, quantity?: number) => void;
  removeGoal: (goalId: string) => void;
  updateGoalQuantity: (goalId: string, quantity: number) => void;
  updateGoal: (
    goalId: string,
    slotAssignments: Record<string, number | undefined>,
    qualityScore: number,
    projectedStats: ItemStats,
  ) => void;
  selectGoalBlueprint: (goalId: string) => void;
  openPlanner: () => void;
  closePlanner: () => void;
  addToComparison: (score: number, projectedStats: ItemStats) => void;
  removeFromComparison: (id: string) => void;
  clearComparison: () => void;
  openComparison: () => void;
  closeComparison: () => void;
}

const CraftContext = createContext<CraftState | null>(null);

export function CraftProvider({ children }: { children: ReactNode }) {
  const [preferredChannel, setPreferredChannel] = useLocalPersist<DatasetChannel>(
    LS_KEYS.DATASET_CHANNEL,
    'ptu',
  );
  const [activeDataset, setActiveDataset] = useState<GameDataset>(EMPTY_DATASET);
  const [availableDatasets, setAvailableDatasets] = useState<DatasetSummary[]>([]);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [missionRewardsByChannel, setMissionRewardsByChannel] = useState<
    Partial<Record<DatasetChannel, MissionRewardsData | null>>
  >({});
  const [missionRewardsLoading, setMissionRewardsLoading] = useState(false);
  const [missionRewardsError, setMissionRewardsError] = useState<string | null>(null);
  const [activeBlueprint, setActiveBlueprintRaw] = useState<Blueprint | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySegment, setLibrarySegment] = useState<LibrarySegment>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState<LegalityFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number | undefined>>({});
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('craft');
  const [activeItemTab, setActiveItemTab] = useState<ItemTab>('overview');
  const [changelogOpen, setChangelogOpen] = useState(false);

  const activeMissionRewards = activeDataset.missionRewards ?? null;
  const dismantlingData = activeDataset.dismantling ?? null;

  const [rawGoals, setGoals] = useLocalPersist<CraftGoal[]>(LS_KEYS.GOALS, []);
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
  const [favoriteIds, setFavoriteIds] = useLocalPersist<string[]>(LS_KEYS.FAVORITES, []);
  const [inventoryIds, setInventoryIds] = useLocalPersist<string[]>(LS_KEYS.INVENTORY, []);

  const blueprints = activeDataset.blueprints;
  const activeChannel = activeDataset.channel;

  const applyDataset = useCallback(
    (
      dataset: GameDataset,
      datasets: DatasetSummary[],
      errorMessage: string | null,
    ) => {
      const cachedMissionRewards = missionRewardsByChannel[dataset.channel];
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
        setPreferredChannel(dataset.channel);
        setSlotAssignments({});
        setActiveBlueprintRaw((previous) =>
          previous ? dataset.blueprints.find((blueprint) => blueprint.id === previous.id) ?? null : null,
        );
      });
    },
    [missionRewardsByChannel, setPreferredChannel],
  );

  const loadChannel = useCallback(
    async (channel: DatasetChannel, datasets: DatasetSummary[]) => {
      const dataset = await fetchPublishedDataset(channel);
      applyDataset(dataset, datasets, null);
      return dataset;
    },
    [applyDataset],
  );

  const refreshDatasets = useCallback(async () => {
    setDatasetLoading(true);

    try {
      const index = await fetchPublishedDatasetIndex();

      if (index.datasets.length === 0 || !index.defaultChannel) {
        setDatasetError('No published dataset is available yet.');
        setDatasetLoading(false);
        return;
      }

      const availableChannels = new Set(index.datasets.map((dataset) => dataset.channel));
      const channelToLoad = availableChannels.has(preferredChannel)
        ? preferredChannel
        : index.defaultChannel;

      await loadChannel(channelToLoad, index.datasets);
    } catch (error) {
      setDatasetError(error instanceof Error ? error.message : 'Failed to load published datasets.');
    } finally {
      setDatasetLoading(false);
    }
  }, [loadChannel, preferredChannel]);

  useEffect(() => {
    void refreshDatasets();
  }, [refreshDatasets]);

  const ensureMissionRewardsLoaded = useCallback(
    async (requestedChannel?: DatasetChannel) => {
      const channel = requestedChannel ?? activeDataset.channel;
      const summary = availableDatasets.find((dataset) => dataset.channel === channel);

      if (!summary?.hasMissionRewards) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(missionRewardsByChannel, channel)) {
        return;
      }

      setMissionRewardsLoading(true);
      setMissionRewardsError(null);

      try {
        const missionRewards = await fetchPublishedMissionRewards(channel);
        startTransition(() => {
          setMissionRewardsByChannel((previous) => ({ ...previous, [channel]: missionRewards }));
          setActiveDataset((previous) =>
            previous.channel === channel
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
    [activeDataset.channel, availableDatasets, missionRewardsByChannel],
  );

  const setActiveDatasetChannel = useCallback(
    async (channel: DatasetChannel) => {
      if (channel === activeDataset.channel && availableDatasets.length > 0 && !datasetError) {
        return;
      }

      const datasets = availableDatasets.length > 0 ? availableDatasets : await fetchPublishedDatasetIndex().then((index) => index.datasets);

      setDatasetLoading(true);
      try {
        await loadChannel(channel, datasets);
      } catch (error) {
        setDatasetError(error instanceof Error ? error.message : 'Failed to switch dataset.');
      } finally {
        setDatasetLoading(false);
      }
    },
    [activeDataset.channel, availableDatasets, datasetError, loadChannel],
  );

  const setActiveBlueprint = useCallback((bp: Blueprint | null) => {
    setActiveBlueprintRaw(bp);
    setSlotAssignments({});
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
      setPlannerOpen(true);
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
  const openPlanner = useCallback(() => setPlannerOpen(true), []);
  const closePlanner = useCallback(() => setPlannerOpen(false), []);

  return (
    <CraftContext.Provider
      value={{
        appMode,
        setAppMode,
        activeItemTab,
        setActiveItemTab,
        changelogOpen,
        setChangelogOpen,
        dismantlingData,
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
        legalityFilter,
        locationFilter,
        setLibrarySegment,
        setManufacturerFilter,
        setLegalityFilter,
        setLocationFilter,
        favoriteIds,
        inventoryIds,
        slotAssignments,
        goals,
        plannerOpen,
        comparisonItems,
        comparisonOpen,
        setActiveBlueprint,
        setActiveDatasetChannel,
        refreshDatasets,
        ensureMissionRewardsLoaded,
        setCategoryFilter,
        setSearchQuery,
        toggleFavorite,
        toggleInventory,
        assignQuality,
        clearAssignments,
        addGoal,
        removeGoal,
        updateGoalQuantity,
        updateGoal,
        selectGoalBlueprint,
        openPlanner,
        closePlanner,
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
