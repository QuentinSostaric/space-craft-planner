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
  Blueprint,
  CategoryFilter,
  ComparisonItem,
  CraftGoal,
  DatasetChannel,
  DatasetSummary,
  GameDataset,
  ItemStats,
  Quality,
} from '../types';
import { COMPARISON_COLORS, LS_KEYS } from '../types';
import { BLUEPRINTS as LOCAL_BLUEPRINTS } from '../data/blueprints';
import { fetchPublishedDataset, fetchPublishedDatasetIndex } from '../hooks/gameDataApi';
import { useLocalPersist } from '../hooks/useLocalPersist';

const LOCAL_FALLBACK_DATASET: GameDataset = {
  channel: 'ptu',
  datasetId: 'local-static-alpha-4.7',
  label: 'Local fallback dataset',
  version: 'Alpha 4.7',
  branch: null,
  buildNumber: null,
  published: true,
  blueprints: LOCAL_BLUEPRINTS as Blueprint[],
  resources: [],
  changelog: null,
  importedAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

interface CraftState {
  activeBlueprint: Blueprint | null;
  blueprints: Blueprint[];
  activeDataset: GameDataset;
  availableDatasets: DatasetSummary[];
  activeChannel: DatasetChannel;
  datasetSource: 'local' | 'remote';
  datasetLoading: boolean;
  datasetError: string | null;
  categoryFilter: CategoryFilter;
  searchQuery: string;
  favoriteIds: string[];
  slotAssignments: Record<string, Quality | undefined>;
  goals: CraftGoal[];
  plannerOpen: boolean;
  comparisonItems: ComparisonItem[];
  comparisonOpen: boolean;
  setActiveBlueprint: (bp: Blueprint | null) => void;
  setActiveDatasetChannel: (channel: DatasetChannel) => Promise<void>;
  refreshDatasets: () => Promise<void>;
  setCategoryFilter: (cat: CategoryFilter) => void;
  setSearchQuery: (q: string) => void;
  toggleFavorite: (blueprintId: string) => void;
  assignQuality: (slotId: string, quality: Quality | undefined) => void;
  clearAssignments: () => void;
  addGoal: (score: number, projectedStats: ItemStats, quantity?: number) => void;
  removeGoal: (goalId: string) => void;
  updateGoalQuantity: (goalId: string, quantity: number) => void;
  updateGoal: (
    goalId: string,
    slotAssignments: Record<string, Quality | undefined>,
    qualityScore: number,
    projectedStats: ItemStats,
  ) => void;
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
  const [activeDataset, setActiveDataset] = useState<GameDataset>(LOCAL_FALLBACK_DATASET);
  const [availableDatasets, setAvailableDatasets] = useState<DatasetSummary[]>([]);
  const [datasetSource, setDatasetSource] = useState<'local' | 'remote'>('local');
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [activeBlueprint, setActiveBlueprintRaw] = useState<Blueprint | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [slotAssignments, setSlotAssignments] = useState<Record<string, Quality | undefined>>({});
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [goals, setGoals] = useLocalPersist<CraftGoal[]>(LS_KEYS.GOALS, []);
  const [favoriteIds, setFavoriteIds] = useLocalPersist<string[]>(LS_KEYS.FAVORITES, []);

  const blueprints = activeDataset.blueprints;
  const activeChannel = activeDataset.channel;

  const applyDataset = useCallback(
    (
      dataset: GameDataset,
      datasets: DatasetSummary[],
      source: 'local' | 'remote',
      errorMessage: string | null,
    ) => {
      startTransition(() => {
        setActiveDataset(dataset);
        setAvailableDatasets(datasets);
        setDatasetSource(source);
        setDatasetError(errorMessage);
        setPreferredChannel(dataset.channel);
        setSlotAssignments({});
        setActiveBlueprintRaw((previous) =>
          previous ? dataset.blueprints.find((blueprint) => blueprint.id === previous.id) ?? null : null,
        );
      });
    },
    [setPreferredChannel],
  );

  const loadChannel = useCallback(
    async (channel: DatasetChannel, datasets: DatasetSummary[]) => {
      const dataset = await fetchPublishedDataset(channel);
      applyDataset(dataset, datasets, 'remote', null);
      return dataset;
    },
    [applyDataset],
  );

  const refreshDatasets = useCallback(async () => {
    setDatasetLoading(true);

    try {
      const index = await fetchPublishedDatasetIndex();

      if (index.datasets.length === 0 || !index.defaultChannel) {
        applyDataset(
          LOCAL_FALLBACK_DATASET,
          [],
          'local',
          'No published dataset is available yet. Falling back to local static data.',
        );
        return;
      }

      const availableChannels = new Set(index.datasets.map((dataset) => dataset.channel));
      const channelToLoad = availableChannels.has(preferredChannel)
        ? preferredChannel
        : index.defaultChannel;

      await loadChannel(channelToLoad, index.datasets);
    } catch (error) {
      applyDataset(
        LOCAL_FALLBACK_DATASET,
        [],
        'local',
        error instanceof Error ? error.message : 'Failed to load published datasets.',
      );
    } finally {
      setDatasetLoading(false);
    }
  }, [applyDataset, loadChannel, preferredChannel]);

  useEffect(() => {
    void refreshDatasets();
  }, [refreshDatasets]);

  const setActiveDatasetChannel = useCallback(
    async (channel: DatasetChannel) => {
      if (channel === activeDataset.channel && datasetSource === 'remote') {
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
    [activeDataset.channel, availableDatasets, datasetSource, loadChannel],
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

  const assignQuality = useCallback((slotId: string, quality: Quality | undefined) => {
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
      updatedAssignments: Record<string, Quality | undefined>,
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
        activeBlueprint,
        blueprints,
        activeDataset,
        availableDatasets,
        activeChannel,
        datasetSource,
        datasetLoading,
        datasetError,
        categoryFilter,
        searchQuery,
        favoriteIds,
        slotAssignments,
        goals,
        plannerOpen,
        comparisonItems,
        comparisonOpen,
        setActiveBlueprint,
        setActiveDatasetChannel,
        refreshDatasets,
        setCategoryFilter,
        setSearchQuery,
        toggleFavorite,
        assignQuality,
        clearAssignments,
        addGoal,
        removeGoal,
        updateGoalQuantity,
        updateGoal,
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
  const { blueprints, categoryFilter, searchQuery, favoriteIds } = useCraft();

  return useMemo(
    () =>
      blueprints.filter((blueprint) => {
        if (categoryFilter === 'favorites') {
          return favoriteIds.includes(blueprint.id);
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
      }),
    [blueprints, categoryFilter, searchQuery, favoriteIds],
  );
}
