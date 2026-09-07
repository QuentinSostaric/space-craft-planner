import { useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '../../analytics/posthog';
import { useAuth } from '../../auth/AuthContext';
import {
  computeLocalAccountImportPlan,
  readLocalAccountCollections,
  writeLocalInventoryResources,
} from '../../auth/localAccountImport';
import { useScLog } from '../../hooks/ScLogSyncContext';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useI18n } from '../../i18n/I18nContext';
import { isTauriRuntime } from '../../services/apiBaseUrl';
import {
  requestRsiLinkChallenge,
  type AccountInventoryResourceEntry,
  type AccountInventoryResourceQuantityUnit,
  type RsiLinkChallenge,
} from '../../services/authService';
import { readCustomScPaths, resolveScPaths, SC_PATHS_CHANGED } from '../../services/scInstallPaths';
import { DEFAULT_INVENTORY_IDS, useCraft } from '../../store/CraftContext';
import { useTheme } from '../../ui/system';
import {
  formatResourceQuantity,
  getObtainableBlueprintIds,
  isPlaceholderResource,
  isResourceSlot,
} from '../../utils/crafting';
import {
  ACCOUNT_BLUEPRINT_BATCH_SIZE,
  ALL_RESOURCES_SHARE_OPTION,
  blurFocusedElement,
  normalizeBatchResourceQuantity,
  normalizeOrganizationSidInput,
  parseResourceQuality,
  readAuthError,
  RESOURCE_BATCH_SCU_STEP,
  sortAccountLibrary,
  type AccountAssetFilter,
  type AccountLibraryEntry,
  type ResourceBatchDraftRow,
  type ResourceBulkShareDraft,
} from './accountHelpers';
import { useAccountConfirmation } from './useAccountConfirmation';
import { useAccountLibraryPreferences, useAccountNavigation } from './useAccountNavigation';

export function useAccountController() {
  const { t, lang } = useI18n();
  const {
    enabled,
    loading,
    user,
    citizenIdLoginEnabled,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    account,
    optimisticState,
    syncStatus,
    syncError,
    authError: desktopAuthError,
    copyLiveDataToPtu,
    loginWithCitizenId,
    logout,
    deleteAccount,
    syncAccountState,
    refreshSession,
    flushPendingMutations,
    linkRsiAccount,
    linkRsiAccountWithCitizenId,
    unlinkRsiAccount,
    updateOnboardingState,
    updateInventoryResources,
    queueInventoryResourcesUpdate,
    queueAccountStateUpdate,
    updateOrganizationBlueprintShares,
    updateOrganizationResourceShares,
    addOrganization,
    removeOrganization,
    claimOrganization,
    deleteOrganization,
    setOrganizationBlueprintSharing,
    respondToCraftRequest,
  } = useAuth();
  const {
    activeBlueprint,
    activeDataset,
    blueprints,
    favoriteIds,
    inventoryIds,
    toggleFavorite,
    toggleInventory,
    setActiveBlueprint,
    missionRewards,
    ensureMissionRewardsLoaded,
    replaceLocalBlueprintCollections,
  } = useCraft();
  const theme = useTheme();
  const isDesktop = isTauriRuntime();
  const { sync, watcher } = useScLog();
  const urlAuthError = useMemo(() => readAuthError(), []);
  const deleteAction = useAsyncAction();
  const { preferences, updatePreferences } = useAccountLibraryPreferences();
  const {
    filter: assetFilter,
    search: assetSearch,
    sort: assetSort,
    sharing: sharingFilter,
    view: assetView,
  } = preferences;
  const setAssetFilter = (filter: AccountAssetFilter) => updatePreferences({ filter });
  const setAssetSearch = (search: string) => updatePreferences({ search });
  const { confirmation, requestConfirmation, resolveConfirmation } = useAccountConfirmation();
  const sessionAction = useAsyncAction();
  const handleRefresh = () =>
    sessionAction.run(
      async () => {
        await flushPendingMutations();
        await refreshSession();
      },
      t(
        'Unable to refresh your account.',
        'Impossible d’actualiser le compte.',
        'Konto konnte nicht aktualisiert werden.',
      ),
    );
  const handleLogout = () =>
    sessionAction.run(
      logout,
      t('Unable to sign out.', 'Impossible de se déconnecter.', 'Abmeldung fehlgeschlagen.'),
    );
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [importModalDismissed, setImportModalDismissed] = useState(false);
  const importAction = useAsyncAction();
  const copyLiveToPtuAction = useAsyncAction();
  const onboardingAction = useAsyncAction();
  const [rsiDialogOpen, setRsiDialogOpen] = useState(false);
  const [rsiChallenge, setRsiChallenge] = useState<RsiLinkChallenge | null>(null);
  const rsiCode = rsiChallenge?.code ?? '';
  const [rsiHandleInput, setRsiHandleInput] = useState('');
  const rsiAction = useAsyncAction();
  const rsiVerifyInFlightRef = useRef(false);
  const [rsiCopyFeedback, setRsiCopyFeedback] = useState<string | null>(null);
  const rsiUnlinkAction = useAsyncAction();
  useEffect(() => {
    if (!rsiChallenge) return;
    const timer = window.setTimeout(
      () => {
        setRsiChallenge(null);
        setRsiCopyFeedback(null);
      },
      Math.max(0, Date.parse(rsiChallenge.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [rsiChallenge]);
  const [blueprintCollectionError, setBlueprintCollectionError] = useState<string | null>(null);
  const [sharedBlueprintError, setSharedBlueprintError] = useState<string | null>(null);
  const [shareDialogBlueprintId, setShareDialogBlueprintId] = useState<string | null>(null);
  const [shareDialogSelection, setShareDialogSelection] = useState<string[]>([]);
  const [sharedBlueprintBusyId, setSharedBlueprintBusyId] = useState<string | null>(null);
  const [resourceCollectionError, setResourceCollectionError] = useState<string | null>(null);
  const [resourceCollectionNotice, setResourceCollectionNotice] = useState<string | null>(null);
  const [shareDialogResourceEntryId, setShareDialogResourceEntryId] = useState<string | null>(null);
  const [shareDialogResourceSelection, setShareDialogResourceSelection] = useState<string[]>([]);
  const [sharedResourceBusyId, setSharedResourceBusyId] = useState<string | null>(null);
  const [resourceBatchDialogOpen, setResourceBatchDialogOpen] = useState(false);
  const [resourceBatchRows, setResourceBatchRows] = useState<ResourceBatchDraftRow[]>([]);
  const [resourceBatchBusy, setResourceBatchBusy] = useState(false);
  const [resourceBatchError, setResourceBatchError] = useState<string | null>(null);
  const [resourceBulkShareDialogOpen, setResourceBulkShareDialogOpen] = useState(false);
  const [resourceBulkShareDraft, setResourceBulkShareDraft] = useState<ResourceBulkShareDraft>({
    organizationSid: '',
    resourceId: ALL_RESOURCES_SHARE_OPTION,
    minQuality: '',
    maxQuality: '',
  });
  const [resourceBulkShareBusy, setResourceBulkShareBusy] = useState(false);
  const [resourceBulkShareError, setResourceBulkShareError] = useState<string | null>(null);
  const [organizationSidInput, setOrganizationSidInput] = useState('');
  const [organizationAddBusy, setOrganizationAddBusy] = useState(false);
  const [organizationActionSid, setOrganizationActionSid] = useState<string | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [organizationClaimDialogSid, setOrganizationClaimDialogSid] = useState<string | null>(null);
  const [organizationDeleteDialogSid, setOrganizationDeleteDialogSid] = useState<string | null>(null);
  const [organizationSharingDialogState, setOrganizationSharingDialogState] = useState<{
    sid: string;
    enabled: boolean;
  } | null>(null);
  const [craftRequestActionId, setCraftRequestActionId] = useState<string | null>(null);
  const [craftRequestError, setCraftRequestError] = useState<string | null>(null);
  const [craftRequestNotice, setCraftRequestNotice] = useState<string | null>(null);
  const [visibleBlueprintCount, setVisibleBlueprintCount] = useState(ACCOUNT_BLUEPRINT_BATCH_SIZE);
  const [localAccountCollections, setLocalAccountCollections] = useState(() => readLocalAccountCollections());

  const { activeTab, setActiveTab } = useAccountNavigation();

  // Custom SC installation paths (settings tab)
  const [customPaths, setCustomPaths] = useState<Array<{ id: string; label: string; path: string }>>(() => {
    try {
      return readCustomScPaths();
    } catch {
      return [];
    }
  });
  const [customPathInput, setCustomPathInput] = useState('');
  const [customPathLabel, setCustomPathLabel] = useState<string>('LIVE');
  const [watcherError, setWatcherError] = useState<string | null>(() => {
    try {
      readCustomScPaths();
      return null;
    } catch {
      return t(
        'Saved installation paths could not be read. Add them again below.',
        'Les chemins enregistrés sont illisibles. Ajoute-les à nouveau ci-dessous.',
        'Gespeicherte Installationspfade sind ungültig. Füge sie unten erneut hinzu.',
      );
    }
  });
  const [watcherBusy, setWatcherBusy] = useState(false);
  const resolvedLivePath =
    resolveScPaths(sync.installPaths ?? { live: null, ptu: null }, customPaths).find(
      (entry) => entry.scope === 'live',
    )?.path ?? null;

  const saveCustomPaths = (next: typeof customPaths) => {
    try {
      localStorage.setItem('sc-custom-install-paths', JSON.stringify(next));
      setCustomPaths(next);
      setWatcherError(null);
      window.dispatchEvent(new Event(SC_PATHS_CHANGED));
      return true;
    } catch {
      setWatcherError(
        t(
          'Unable to save installation paths in this browser.',
          'Impossible d’enregistrer les chemins dans ce navigateur.',
          'Installationspfade konnten nicht gespeichert werden.',
        ),
      );
      return false;
    }
  };
  const addCustomPath = () => {
    const path = customPathInput.trim();
    if (!path) return;
    if (
      resolveScPaths({ live: null, ptu: null }, [
        ...customPaths,
        { id: 'candidate', label: customPathLabel, path },
      ]).length <= customPaths.length
    ) {
      setWatcherError(
        t(
          'This installation path is already saved.',
          'Ce chemin d’installation est déjà enregistré.',
          'Dieser Installationspfad ist bereits gespeichert.',
        ),
      );
      return;
    }
    if (saveCustomPaths([...customPaths, { id: crypto.randomUUID(), label: customPathLabel, path }]))
      setCustomPathInput('');
  };
  const removeCustomPath = (id: string) => {
    saveCustomPaths(customPaths.filter((p) => p.id !== id));
  };

  const defaultInventoryIdSet = useMemo(() => new Set<string>(DEFAULT_INVENTORY_IDS), []);
  const handleWatcherToggle = async (enabled: boolean) => {
    setWatcherError(null);
    const livePath = resolvedLivePath;
    setWatcherBusy(true);
    try {
      if (enabled && livePath) {
        await watcher.start(livePath);
        watcher.setAutoStart(true);
      } else {
        watcher.stop();
        watcher.setAutoStart(false);
      }
    } catch (err: unknown) {
      setWatcherError(err instanceof Error ? err.message : 'Failed to toggle watcher.');
    } finally {
      setWatcherBusy(false);
    }
  };

  const handleAutoStartupToggle = async (enabled: boolean) => {
    setWatcherError(null);
    setWatcherBusy(true);
    try {
      if (enabled) {
        await watcher.enableAutoStartup();
      } else {
        await watcher.disableAutoStartup();
      }
    } catch (err: unknown) {
      setWatcherError(err instanceof Error ? err.message : 'Failed to update startup setting.');
    } finally {
      setWatcherBusy(false);
    }
  };

  const favoriteSnapshotIds = account?.favoriteBlueprintIds ?? favoriteIds;
  const inventorySnapshotIds = account?.inventoryBlueprintIds ?? inventoryIds;
  const organizationBlueprintShares = account?.organizationBlueprintShares ?? {};
  const organizationResourceShares = account?.organizationResourceShares ?? {};
  const inventoryResources = account?.inventoryResources ?? [];
  const sharedBlueprintIdSet = useMemo(
    () => new Set(account?.sharedBlueprintIds ?? []),
    [account?.sharedBlueprintIds],
  );
  const sharedResourceEntryIdSet = useMemo(
    () => new Set(account?.sharedResourceEntryIds ?? []),
    [account?.sharedResourceEntryIds],
  );
  const sharedOrganizationIdsByBlueprintId = useMemo(() => {
    const nextMap = new Map<string, string[]>();
    for (const [sid, blueprintIds] of Object.entries(organizationBlueprintShares)) {
      for (const blueprintId of blueprintIds) {
        const currentOrganizationIds = nextMap.get(blueprintId) ?? [];
        currentOrganizationIds.push(sid);
        nextMap.set(blueprintId, currentOrganizationIds);
      }
    }
    return nextMap;
  }, [organizationBlueprintShares]);
  const sharedOrganizationIdsByResourceEntryId = useMemo(() => {
    const nextMap = new Map<string, string[]>();
    for (const [sid, resourceEntryIds] of Object.entries(organizationResourceShares)) {
      for (const resourceEntryId of resourceEntryIds) {
        const currentOrganizationIds = nextMap.get(resourceEntryId) ?? [];
        currentOrganizationIds.push(sid);
        nextMap.set(resourceEntryId, currentOrganizationIds);
      }
    }
    return nextMap;
  }, [organizationResourceShares]);
  const linkedOrganizations = account?.organizations ?? [];
  const favoriteCount = favoriteSnapshotIds.length;
  const inventoryCount = inventorySnapshotIds.length;
  const rsiVerificationRequired = account?.rsi?.verificationRequired === true;
  const canManageOrganizations = Boolean(account?.rsi?.handle) && !rsiVerificationRequired;
  const organizationClaimDialogTarget =
    linkedOrganizations.find((organization) => organization.sid === organizationClaimDialogSid) ?? null;
  const organizationDeleteDialogTarget =
    linkedOrganizations.find((organization) => organization.sid === organizationDeleteDialogSid) ?? null;
  const organizationSharingDialogTarget =
    linkedOrganizations.find((organization) => organization.sid === organizationSharingDialogState?.sid) ??
    null;
  const localImportPlan = useMemo(
    () => computeLocalAccountImportPlan(account, localAccountCollections),
    [account, localAccountCollections],
  );
  const importDialogOpen = Boolean(account && localImportPlan.hasPendingImport && !importModalDismissed);

  const obtainableBlueprintIds = useMemo(() => getObtainableBlueprintIds(missionRewards), [missionRewards]);
  const totalObtainableBlueprintCount = obtainableBlueprintIds.size;
  const ownedBlueprintCount = inventorySnapshotIds.filter((id) => obtainableBlueprintIds.has(id)).length;
  const blueprintProgress =
    totalObtainableBlueprintCount > 0
      ? (Math.min(ownedBlueprintCount, totalObtainableBlueprintCount) / totalObtainableBlueprintCount) * 100
      : 0;

  const pendingCraftRequestCount = useMemo(() => {
    return (account?.incomingCraftRequests ?? []).filter((req) => req.status === 'pending').length;
  }, [account?.incomingCraftRequests]);

  const favoriteIdSet = useMemo(() => new Set(favoriteSnapshotIds), [favoriteSnapshotIds]);
  const inventoryIdSet = useMemo(() => new Set(inventorySnapshotIds), [inventorySnapshotIds]);
  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  );
  const resourceById = useMemo(
    () =>
      new Map(
        activeDataset.resources
          .filter((resource) => !isPlaceholderResource(resource))
          .map((resource) => [resource.id, resource]),
      ),
    [activeDataset.resources],
  );
  const sortedResources = useMemo(
    () =>
      activeDataset.resources
        .filter((resource) => !isPlaceholderResource(resource))
        .sort((left, right) =>
          left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }),
        ),
    [activeDataset.resources],
  );
  const resourceQuantityUnitById = useMemo(() => {
    const nextMap = new Map<string, AccountInventoryResourceQuantityUnit>(
      activeDataset.resources
        .filter((resource) => !isPlaceholderResource(resource))
        .map((resource) => [resource.id, 'scu']),
    );

    for (const blueprint of blueprints) {
      for (const slot of blueprint.slots) {
        if (!isResourceSlot(slot)) {
          continue;
        }

        const resourceId = slot.requiredResource
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        if (!resourceId) {
          continue;
        }

        nextMap.set(resourceId, slot.quantityUnit === 'count' ? 'count' : 'scu');
      }
    }

    return nextMap;
  }, [activeDataset.resources, blueprints]);
  const resourceInsightById = useMemo(
    () => new Map((activeDataset.resourceInsights ?? []).map((insight) => [insight.resourceId, insight])),
    [activeDataset.resourceInsights],
  );
  const shareDialogBlueprint = shareDialogBlueprintId
    ? (blueprintById.get(shareDialogBlueprintId) ?? null)
    : null;
  const shareDialogResourceEntry = shareDialogResourceEntryId
    ? (inventoryResources.find((resourceEntry) => resourceEntry.id === shareDialogResourceEntryId) ?? null)
    : null;
  const hiddenBlueprintCount = useMemo(() => {
    const referencedIds = new Set([...inventorySnapshotIds, ...favoriteSnapshotIds]);
    let hiddenCount = 0;
    for (const blueprintId of referencedIds) {
      if (!blueprintById.has(blueprintId)) {
        hiddenCount += 1;
      }
    }
    return hiddenCount;
  }, [blueprintById, favoriteSnapshotIds, inventorySnapshotIds]);
  const filteredAssetEntries = useMemo<AccountLibraryEntry[]>(() => {
    const normalizedSearch = assetSearch.trim().toLowerCase();
    const entries: AccountLibraryEntry[] = [];
    const includedBlueprintIds = new Set<string>();

    const includeInventoryBlueprints = assetFilter === 'all' || assetFilter === 'inventory-blueprints';
    const includeFavoriteBlueprints = assetFilter === 'all' || assetFilter === 'favorite-blueprints';
    const includeResources = assetFilter === 'all' || assetFilter === 'resources';

    if (includeInventoryBlueprints) {
      for (const blueprintId of inventorySnapshotIds) {
        const blueprint = blueprintById.get(blueprintId);
        if (!blueprint || includedBlueprintIds.has(blueprint.id)) {
          continue;
        }
        includedBlueprintIds.add(blueprint.id);
        const sharedOrganizationIds = sharedOrganizationIdsByBlueprintId.get(blueprint.id) ?? [];
        entries.push({
          key: `blueprint:${blueprint.id}`,
          kind: 'blueprint',
          blueprint,
          searchHaystack: [blueprint.name, blueprint.manufacturer, blueprint.category, 'inventory']
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          isFavorite: favoriteIdSet.has(blueprint.id),
          isInInventory: true,
          isShared: sharedOrganizationIds.length > 0,
          sharedOrganizationIds,
        });
      }
    }

    if (includeFavoriteBlueprints) {
      for (const blueprintId of favoriteSnapshotIds) {
        const blueprint = blueprintById.get(blueprintId);
        if (!blueprint || includedBlueprintIds.has(blueprint.id)) {
          continue;
        }
        includedBlueprintIds.add(blueprint.id);
        const sharedOrganizationIds = sharedOrganizationIdsByBlueprintId.get(blueprint.id) ?? [];
        entries.push({
          key: `blueprint:${blueprint.id}`,
          kind: 'blueprint',
          blueprint,
          searchHaystack: [blueprint.name, blueprint.manufacturer, blueprint.category, 'favorite']
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          isFavorite: true,
          isInInventory: inventoryIdSet.has(blueprint.id),
          isShared: sharedOrganizationIds.length > 0,
          sharedOrganizationIds,
        });
      }
    }

    if (includeResources) {
      for (const resourceEntry of inventoryResources) {
        const resource = resourceById.get(resourceEntry.resourceId) ?? null;
        const sharedOrganizationIds = sharedOrganizationIdsByResourceEntryId.get(resourceEntry.id) ?? [];
        entries.push({
          key: `resource:${resourceEntry.id}`,
          kind: 'resource',
          resourceEntry,
          resource,
          searchHaystack: [
            resourceEntry.resourceName,
            resource?.description,
            formatResourceQuantity(resourceEntry.quantity, resourceEntry.quantityUnit, 'en', 'long'),
            resourceEntry.quality == null ? '' : `quality ${resourceEntry.quality}`,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          isShared: sharedOrganizationIds.length > 0,
          sharedOrganizationIds,
        });
      }
    }

    return sortAccountLibrary(
      entries.filter((entry) => {
        if (sharingFilter === 'shared' && !entry.isShared) return false;
        if (sharingFilter === 'private' && entry.isShared) return false;
        if (!normalizedSearch) {
          return true;
        }
        return normalizedSearch.split(/\s+/).every((term) => entry.searchHaystack.includes(term));
      }),
      assetSort,
      lang,
    );
  }, [
    assetFilter,
    assetSearch,
    assetSort,
    sharingFilter,
    lang,
    blueprintById,
    favoriteIdSet,
    favoriteSnapshotIds,
    inventoryIdSet,
    inventoryResources,
    inventorySnapshotIds,
    resourceById,
    sharedOrganizationIdsByBlueprintId,
    sharedOrganizationIdsByResourceEntryId,
  ]);
  const visibleAssetEntries = useMemo(
    () => filteredAssetEntries.slice(0, visibleBlueprintCount),
    [filteredAssetEntries, visibleBlueprintCount],
  );
  const filteredBlueprintEntryCount = useMemo(
    () => filteredAssetEntries.filter((entry) => entry.kind === 'blueprint').length,
    [filteredAssetEntries],
  );
  const filteredResourceEntryCount = useMemo(
    () => filteredAssetEntries.filter((entry) => entry.kind === 'resource').length,
    [filteredAssetEntries],
  );
  const bulkResourceSharePreview = useMemo(() => {
    const targetOrganizationSid = resourceBulkShareDraft.organizationSid.trim();
    const targetResourceId = resourceBulkShareDraft.resourceId.trim();
    const minQuality = parseResourceQuality(resourceBulkShareDraft.minQuality);
    const maxQuality = parseResourceQuality(resourceBulkShareDraft.maxQuality);

    if (
      !targetOrganizationSid ||
      Number.isNaN(minQuality) ||
      Number.isNaN(maxQuality) ||
      (minQuality != null && maxQuality != null && minQuality > maxQuality)
    ) {
      return {
        matchingEntryIds: [] as string[],
        newEntryIds: [] as string[],
      };
    }

    const matchingEntryIds = inventoryResources
      .filter((resourceEntry) => {
        if (
          targetResourceId &&
          targetResourceId !== ALL_RESOURCES_SHARE_OPTION &&
          resourceEntry.resourceId !== targetResourceId
        ) {
          return false;
        }

        if (minQuality != null || maxQuality != null) {
          if (resourceEntry.quality == null) {
            return false;
          }

          if (minQuality != null && resourceEntry.quality < minQuality) {
            return false;
          }

          if (maxQuality != null && resourceEntry.quality > maxQuality) {
            return false;
          }
        }

        return true;
      })
      .map((resourceEntry) => resourceEntry.id);

    const existingSharedIds = new Set(organizationResourceShares[targetOrganizationSid] ?? []);
    const newEntryIds = matchingEntryIds.filter((resourceEntryId) => !existingSharedIds.has(resourceEntryId));

    return {
      matchingEntryIds,
      newEntryIds,
    };
  }, [inventoryResources, organizationResourceShares, resourceBulkShareDraft]);

  useEffect(() => {
    if (!missionRewards) {
      void ensureMissionRewardsLoaded();
    }
  }, [ensureMissionRewardsLoaded, missionRewards]);

  useEffect(() => {
    setLocalAccountCollections(readLocalAccountCollections());
  }, [account?.accountId, user?.id]);

  useEffect(() => {
    setImportModalDismissed(false);
    resolveConfirmation(false);
    setEditingResourceId(null);
    importAction.clearError();
    rsiUnlinkAction.clearError();
    setBlueprintCollectionError(null);
    setResourceCollectionError(null);
    setResourceCollectionNotice(null);
    setSharedBlueprintError(null);
    setShareDialogBlueprintId(null);
    setShareDialogSelection([]);
    setShareDialogResourceEntryId(null);
    setShareDialogResourceSelection([]);
    setOrganizationError(null);
    setOrganizationNotice(null);
    setResourceBatchDialogOpen(false);
    setResourceBatchRows([]);
    setResourceBatchBusy(false);
    setResourceBatchError(null);
    setResourceBulkShareDialogOpen(false);
    setResourceBulkShareDraft({
      organizationSid: '',
      resourceId: ALL_RESOURCES_SHARE_OPTION,
      minQuality: '',
      maxQuality: '',
    });
    setResourceBulkShareBusy(false);
    setResourceBulkShareError(null);
    setOrganizationSidInput('');
    setOrganizationClaimDialogSid(null);
    setOrganizationDeleteDialogSid(null);
    setOrganizationSharingDialogState(null);
    setCraftRequestActionId(null);
    setCraftRequestError(null);
    setCraftRequestNotice(null);
  }, [account?.accountId, user?.id, activeDataset.channel, resolveConfirmation]);

  useEffect(() => {
    setVisibleBlueprintCount(ACCOUNT_BLUEPRINT_BATCH_SIZE);
  }, [assetFilter, assetSearch, assetSort, sharingFilter, account?.accountId, filteredAssetEntries.length]);

  const handlePersistedBlueprintCollectionsUpdate = async (nextCollections: {
    favoriteBlueprintIds?: string[];
    inventoryBlueprintIds?: string[];
  }) => {
    if (!account) {
      replaceLocalBlueprintCollections(nextCollections);
      return;
    }

    queueAccountStateUpdate((snapshot) => ({
      ...snapshot,
      favoriteBlueprintIds: nextCollections.favoriteBlueprintIds
        ? [...new Set(nextCollections.favoriteBlueprintIds)]
        : snapshot.favoriteBlueprintIds,
      inventoryBlueprintIds: nextCollections.inventoryBlueprintIds
        ? [...new Set(nextCollections.inventoryBlueprintIds)]
        : snapshot.inventoryBlueprintIds,
    }));
  };

  const handleAddBlueprints = async (ids: string[]) => {
    queueAccountStateUpdate((snapshot) => ({
      ...snapshot,
      inventoryBlueprintIds: [...new Set([...snapshot.inventoryBlueprintIds, ...ids])],
    }));
  };

  const handleToggleFavoriteBlueprint = (blueprintId: string) => {
    setBlueprintCollectionError(null);
    if (!account) {
      toggleFavorite(blueprintId);
      return;
    }
    try {
      queueAccountStateUpdate((snapshot) => ({
        ...snapshot,
        favoriteBlueprintIds: snapshot.favoriteBlueprintIds.includes(blueprintId)
          ? snapshot.favoriteBlueprintIds.filter((id) => id !== blueprintId)
          : [...snapshot.favoriteBlueprintIds, blueprintId],
      }));
    } catch (error) {
      setBlueprintCollectionError(
        error instanceof Error
          ? error.message
          : t(
              'Unable to update favorites.',
              'Impossible de modifier les favoris.',
              'Favoriten konnten nicht aktualisiert werden.',
            ),
      );
    }
  };

  const handleToggleInventoryBlueprint = (blueprintId: string) => {
    setBlueprintCollectionError(null);
    if (!account) {
      toggleInventory(blueprintId);
      return;
    }
    if (defaultInventoryIdSet.has(blueprintId)) return;
    try {
      queueAccountStateUpdate((snapshot) => ({
        ...snapshot,
        inventoryBlueprintIds: snapshot.inventoryBlueprintIds.includes(blueprintId)
          ? snapshot.inventoryBlueprintIds.filter((id) => id !== blueprintId)
          : [...snapshot.inventoryBlueprintIds, blueprintId],
      }));
    } catch (error) {
      setBlueprintCollectionError(
        error instanceof Error
          ? error.message
          : t(
              'Unable to update inventory.',
              'Impossible de modifier l’inventaire.',
              'Inventar konnte nicht aktualisiert werden.',
            ),
      );
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await requestConfirmation(
      t(
        'Delete your cloud account and Discord-linked data permanently? This also signs you out.',
        'Supprimer definitivement ton compte cloud et les donnees liees a Discord ? Cela te deconnectera aussi.',
        'Soll dein Cloud-Konto mit den Discord-gebundenen Daten dauerhaft gelöscht werden? Du wirst dabei auch abgemeldet.',
      ),
    );
    if (!confirmed) {
      return;
    }

    await deleteAction.run(
      () => deleteAccount(),
      t(
        'Failed to delete the account.',
        'La suppression du compte a echoue.',
        'Das Konto konnte nicht gelöscht werden.',
      ),
    );
  };

  const handleCopyLiveDataToPtu = async () => {
    const confirmed = await requestConfirmation(
      t(
        'Copy your LIVE favorites, inventory, planner, organization shares and craft requests into PTU? This replaces the current PTU account data.',
        'Copier tes favoris, inventaire, planner, partages d organisation et demandes de craft LIVE vers le PTU ? Cela remplace les donnees de compte PTU actuelles.',
        'LIVE-Favoriten, Inventar, Planner, Organisationsfreigaben und Craft-Anfragen nach PTU kopieren? Das ersetzt die aktuellen PTU-Kontodaten.',
      ),
    );
    if (!confirmed) {
      return;
    }

    await copyLiveToPtuAction.run(
      () => copyLiveDataToPtu(),
      t(
        'Failed to copy LIVE account data to PTU.',
        'La copie des donnees de compte LIVE vers PTU a echoue.',
        'Die LIVE-Kontodaten konnten nicht nach PTU kopiert werden.',
      ),
    );
  };

  const handleImportLocalCollections = async () => {
    if (!account) {
      return;
    }

    await importAction.run(
      async () => {
        const importedFavoriteIds = new Set(localImportPlan.missingFavoriteBlueprintIds);
        const importedInventoryIds = new Set(localImportPlan.missingInventoryBlueprintIds);
        const importedResourceEntryIds = new Set(
          localImportPlan.missingInventoryResources.map((resourceEntry) => resourceEntry.id),
        );
        const nextFavoriteBlueprintIds = [
          ...new Set([...account.favoriteBlueprintIds, ...localImportPlan.missingFavoriteBlueprintIds]),
        ];
        const nextInventoryBlueprintIds = [
          ...new Set([...account.inventoryBlueprintIds, ...localImportPlan.missingInventoryBlueprintIds]),
        ];
        const nextInventoryResources = [
          ...(account.inventoryResources ?? []),
          ...localImportPlan.missingInventoryResources,
        ];

        await syncAccountState({
          favoriteBlueprintIds: nextFavoriteBlueprintIds,
          inventoryBlueprintIds: nextInventoryBlueprintIds,
          planner: account.planner,
        });

        if (localImportPlan.missingInventoryResources.length > 0) {
          await updateInventoryResources(nextInventoryResources);
        }

        const nextLocalAccountCollections = {
          favoriteBlueprintIds: localImportPlan.favoriteBlueprintIds.filter(
            (blueprintId) => !importedFavoriteIds.has(blueprintId),
          ),
          inventoryBlueprintIds: localImportPlan.inventoryBlueprintIds.filter(
            (blueprintId) => !importedInventoryIds.has(blueprintId),
          ),
          inventoryResources: localImportPlan.inventoryResources.filter(
            (resourceEntry) => !importedResourceEntryIds.has(resourceEntry.id),
          ),
        };
        replaceLocalBlueprintCollections({
          favoriteBlueprintIds: nextLocalAccountCollections.favoriteBlueprintIds,
          inventoryBlueprintIds: nextLocalAccountCollections.inventoryBlueprintIds,
        });
        writeLocalInventoryResources(nextLocalAccountCollections.inventoryResources);
        setLocalAccountCollections(nextLocalAccountCollections);
        setImportModalDismissed(true);
      },
      t(
        'Failed to import the local collections.',
        'L import des collections locales a echoue.',
        'Der Import der lokalen Sammlungen ist fehlgeschlagen.',
      ),
    );
  };

  const openRsiDialog = () => {
    blurFocusedElement();
    rsiUnlinkAction.clearError();
    rsiAction.clearError();
    setRsiCopyFeedback(null);
    setRsiHandleInput(account?.rsi?.handle ?? '');
    setRsiChallenge(null);
    setRsiDialogOpen(true);
  };

  const handleCopyRsiCode = async () => {
    try {
      await navigator.clipboard.writeText(rsiCode);
      setRsiCopyFeedback(
        t('Verification code copied.', 'Code de verification copie.', 'Verifizierungscode kopiert.'),
      );
    } catch {
      setRsiCopyFeedback(
        t(
          'Copy failed. Select the code manually.',
          'La copie a echoue. Selectionne le code manuellement.',
          'Kopieren fehlgeschlagen. Bitte den Code manuell markieren.',
        ),
      );
    }
  };

  const handleVerifyRsiLink = async () => {
    if (rsiVerifyInFlightRef.current) {
      return;
    }

    setRsiCopyFeedback(null);
    rsiVerifyInFlightRef.current = true;
    try {
      await rsiAction.run(
        async () => {
          if (!rsiChallenge || Date.parse(rsiChallenge.expiresAt) <= Date.now()) {
            setRsiChallenge(await requestRsiLinkChallenge(rsiHandleInput.trim()));
            return;
          }
          await linkRsiAccount(rsiChallenge.handle, rsiChallenge.code);
          setRsiChallenge(null);
          setRsiDialogOpen(false);
        },
        t(
          'Failed to verify the RSI account.',
          'La verification du compte RSI a echoue.',
          'Die Verifizierung des RSI-Kontos ist fehlgeschlagen.',
        ),
      );
    } finally {
      rsiVerifyInFlightRef.current = false;
    }
  };

  const handleCitizenIdRsiLink = (returnTo?: string) => {
    setRsiCopyFeedback(null);
    rsiAction.clearError();
    linkRsiAccountWithCitizenId(returnTo);
  };

  const handleStartRsiLink = () => {
    if (citizenIdRsiLinkEnabled) {
      handleCitizenIdRsiLink('/account');
      return;
    }

    openRsiDialog();
  };

  const handleCompleteOnboarding = () => {
    void onboardingAction.run(
      async () => {
        await updateOnboardingState({ completed: true });
      },
      t(
        'Failed to update onboarding.',
        'La mise a jour de l onboarding a echoue.',
        'Onboarding konnte nicht aktualisiert werden.',
      ),
    );
  };

  const handleUnlinkRsiAccount = async () => {
    if (
      !(await requestConfirmation(
        t(
          'Unlink your RSI identity? Organization access and sharing will be removed. Your personal inventory is kept.',
          'Délier ton identité RSI ? L’accès aux organisations et leurs partages seront retirés. Ton inventaire personnel est conservé.',
          'RSI-Identität trennen? Organisationszugang und Freigaben werden entfernt. Dein persönliches Inventar bleibt erhalten.',
        ),
      ))
    )
      return;
    await rsiUnlinkAction.run(
      () => unlinkRsiAccount(),
      t(
        'Failed to remove the RSI account link.',
        'La suppression du lien RSI a echoue.',
        'Die RSI-Verknüpfung konnte nicht entfernt werden.',
      ),
    );
  };

  const openShareBlueprintDialog = (blueprintId: string) => {
    if (!account) {
      return;
    }

    blurFocusedElement();
    setSharedBlueprintError(null);
    setShareDialogBlueprintId(blueprintId);
    setShareDialogSelection(sharedOrganizationIdsByBlueprintId.get(blueprintId) ?? []);
  };

  const closeShareBlueprintDialog = () => {
    if (!sharedBlueprintBusyId) {
      setShareDialogBlueprintId(null);
      setShareDialogSelection([]);
    }
  };

  const handleSaveBlueprintOrganizationShares = async () => {
    if (!account || !shareDialogBlueprintId) {
      return;
    }

    setSharedBlueprintBusyId(shareDialogBlueprintId);
    setSharedBlueprintError(null);
    try {
      const nextOrganizationBlueprintShares = Object.fromEntries(
        Object.entries(account.organizationBlueprintShares ?? {}).map(([sid, blueprintIds]) => [
          sid,
          blueprintIds.filter((blueprintId) => blueprintId !== shareDialogBlueprintId),
        ]),
      ) as Record<string, string[]>;

      for (const sid of shareDialogSelection) {
        const currentBlueprintIds = nextOrganizationBlueprintShares[sid] ?? [];
        nextOrganizationBlueprintShares[sid] = [...new Set([...currentBlueprintIds, shareDialogBlueprintId])];
      }

      const prunedOrganizationBlueprintShares = Object.fromEntries(
        Object.entries(nextOrganizationBlueprintShares).filter(([, blueprintIds]) => blueprintIds.length > 0),
      );

      await updateOrganizationBlueprintShares(prunedOrganizationBlueprintShares);
      setShareDialogBlueprintId(null);
      setShareDialogSelection([]);
    } catch (error) {
      setSharedBlueprintError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update blueprint sharing.',
              'La mise a jour du partage blueprint a echoue.',
              'Die Blueprint-Freigabe konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setSharedBlueprintBusyId(null);
    }
  };

  const openShareResourceDialog = (resourceEntryId: string) => {
    if (!account) {
      return;
    }

    blurFocusedElement();
    setResourceCollectionError(null);
    setShareDialogResourceEntryId(resourceEntryId);
    setShareDialogResourceSelection(sharedOrganizationIdsByResourceEntryId.get(resourceEntryId) ?? []);
  };

  const closeShareResourceDialog = () => {
    if (!sharedResourceBusyId) {
      setShareDialogResourceEntryId(null);
      setShareDialogResourceSelection([]);
    }
  };

  const createEmptyResourceBatchRow = (resourceId = sortedResources[0]?.id ?? ''): ResourceBatchDraftRow => {
    const quantityUnit = resourceQuantityUnitById.get(resourceId) ?? 'scu';
    return {
      id: globalThis.crypto.randomUUID(),
      resourceId,
      quantity: quantityUnit === 'count' ? '1' : RESOURCE_BATCH_SCU_STEP.toFixed(6),
      quality: '',
    };
  };

  const openResourceBatchDialog = () => {
    setResourceCollectionError(null);
    setResourceCollectionNotice(null);
    setResourceBatchError(null);
    setEditingResourceId(null);
    setResourceBatchRows([createEmptyResourceBatchRow()]);
    setResourceBatchDialogOpen(true);
  };

  const openEditResourceDialog = (entry: AccountInventoryResourceEntry) => {
    setEditingResourceId(entry.id);
    setResourceBatchError(null);
    setResourceBatchRows([
      {
        id: entry.id,
        resourceId: entry.resourceId,
        quantity: String(entry.quantity),
        quality: entry.quality == null ? '' : String(entry.quality),
      },
    ]);
    setResourceBatchDialogOpen(true);
  };

  const closeResourceBatchDialog = () => {
    if (resourceBatchBusy) {
      return;
    }
    setResourceBatchDialogOpen(false);
    setEditingResourceId(null);
    setResourceBatchRows([]);
    setResourceBatchError(null);
  };

  const addResourceBatchRow = () => {
    setResourceBatchRows((currentRows) => [...currentRows, createEmptyResourceBatchRow()]);
  };

  const updateResourceBatchRow = (rowId: string, updates: Partial<ResourceBatchDraftRow>) => {
    setResourceBatchRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextRow = { ...row, ...updates };
        if (updates.resourceId !== undefined) {
          const quantityUnit = resourceQuantityUnitById.get(nextRow.resourceId) ?? 'scu';
          nextRow.quantity = quantityUnit === 'count' ? '1' : RESOURCE_BATCH_SCU_STEP.toFixed(6);
        }
        return nextRow;
      }),
    );
  };

  const removeResourceBatchRow = (rowId: string) => {
    setResourceBatchRows((currentRows) => {
      if (currentRows.length <= 1) {
        return [createEmptyResourceBatchRow()];
      }
      return currentRows.filter((row) => row.id !== rowId);
    });
  };

  const handleAddResourceBatch = async () => {
    if (!account) {
      return;
    }

    setResourceCollectionError(null);
    setResourceCollectionNotice(null);
    setResourceBatchError(null);

    const normalizedEntries: AccountInventoryResourceEntry[] = [];
    for (const row of resourceBatchRows) {
      const originalEntry = editingResourceId
        ? inventoryResources.find((entry) => entry.id === editingResourceId)
        : null;
      if (editingResourceId && !originalEntry) {
        setResourceBatchError(
          t(
            'This resource lot was removed. Close the editor and refresh your inventory.',
            'Ce lot a été retiré. Ferme l’éditeur et actualise ton inventaire.',
            'Dieser Bestand wurde entfernt. Schließe den Editor und aktualisiere dein Inventar.',
          ),
        );
        return;
      }
      const resource =
        resourceById.get(row.resourceId) ??
        (originalEntry ? { id: originalEntry.resourceId, name: originalEntry.resourceName } : null);
      if (!resource) {
        setResourceBatchError(
          t(
            'Choose a valid resource for every row before saving.',
            'Choisis une ressource valide sur chaque ligne avant d enregistrer.',
            'Wahle fur jede Zeile eine gultige Ressource, bevor du speicherst.',
          ),
        );
        return;
      }

      const quantityUnit =
        originalEntry?.quantityUnit ?? resourceQuantityUnitById.get(row.resourceId) ?? 'scu';
      const normalizedQuantity = normalizeBatchResourceQuantity(row.quantity, quantityUnit);
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        setResourceBatchError(
          t(
            'Enter a valid quantity on every row before saving.',
            'Saisis une quantite valide sur chaque ligne avant d enregistrer.',
            'Gib in jeder Zeile eine gultige Menge ein, bevor du speicherst.',
          ),
        );
        return;
      }

      const normalizedQuality = parseResourceQuality(row.quality);
      if (Number.isNaN(normalizedQuality)) {
        setResourceBatchError(
          t(
            'Quality must be between 0 and 1000, or left empty.',
            'La qualité doit être comprise entre 0 et 1000, ou laissée vide.',
            'Qualität muss zwischen 0 und 1000 liegen oder leer bleiben.',
          ),
        );
        return;
      }
      const existingEntry = editingResourceId
        ? inventoryResources.find((entry) => entry.id === editingResourceId)
        : null;
      const nowIso = new Date().toISOString();
      normalizedEntries.push({
        id: existingEntry?.id ?? globalThis.crypto.randomUUID(),
        resourceId: resource.id,
        resourceName: resource.name,
        quantity: normalizedQuantity,
        quantityUnit,
        quality: normalizedQuality ?? null,
        createdAt: existingEntry?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
    }

    setResourceBatchBusy(true);
    try {
      queueInventoryResourcesUpdate((current) => {
        if (editingResourceId && !current.some((entry) => entry.id === editingResourceId))
          throw new Error(
            t(
              'This resource lot no longer exists.',
              'Ce lot n’existe plus.',
              'Dieser Bestand existiert nicht mehr.',
            ),
          );
        return editingResourceId
          ? current.map((entry) =>
              entry.id === editingResourceId
                ? { ...normalizedEntries[0], createdAt: entry.createdAt }
                : entry,
            )
          : [...current, ...normalizedEntries];
      });
      setResourceBatchDialogOpen(false);
      setResourceBatchRows([]);
      if (!editingResourceId) {
        trackEvent('inventory_item_added', {
          inventory_source: 'resource_batch',
          inventory_delta: normalizedEntries.length,
        });
      }
      setResourceCollectionNotice(
        t(
          editingResourceId
            ? 'Resource updated.'
            : `${normalizedEntries.length} resource entries added to your account inventory.`,
          editingResourceId
            ? 'Ressource mise à jour.'
            : `${normalizedEntries.length} ressources ajoutées à ton inventaire.`,
          editingResourceId
            ? 'Ressource aktualisiert.'
            : `${normalizedEntries.length} Ressourceneinträge hinzugefügt.`,
        ),
      );
    } catch (error) {
      setResourceBatchError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update the resource inventory.',
              'La mise a jour de l inventaire des ressources a echoue.',
              'Das Ressourceninventar konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setResourceBatchBusy(false);
    }
  };

  const openResourceBulkShareDialog = () => {
    setResourceCollectionError(null);
    setResourceCollectionNotice(null);
    setResourceBulkShareError(null);
    setResourceBulkShareDraft({
      organizationSid: linkedOrganizations[0]?.sid ?? '',
      resourceId: ALL_RESOURCES_SHARE_OPTION,
      minQuality: '',
      maxQuality: '',
    });
    setResourceBulkShareDialogOpen(true);
  };

  const closeResourceBulkShareDialog = () => {
    if (resourceBulkShareBusy) {
      return;
    }

    setResourceBulkShareDialogOpen(false);
    setResourceBulkShareError(null);
  };

  const handleSaveResourceBulkShare = async () => {
    if (!account) {
      return;
    }

    const organizationSid = resourceBulkShareDraft.organizationSid.trim();
    if (!organizationSid) {
      setResourceBulkShareError(
        t(
          'Choose which linked organization should receive these resource shares.',
          'Choisis quelle organisation liee doit recevoir ce partage de ressources.',
          'Wahle aus, welche verknupfte Organisation diese Ressourcenfreigabe erhalten soll.',
        ),
      );
      return;
    }

    const minQuality = parseResourceQuality(resourceBulkShareDraft.minQuality);
    const maxQuality = parseResourceQuality(resourceBulkShareDraft.maxQuality);

    if (Number.isNaN(minQuality) || Number.isNaN(maxQuality)) {
      setResourceBulkShareError(
        t(
          'Quality must be between 0 and 1000, or left empty.',
          'La qualité doit être comprise entre 0 et 1000, ou laissée vide.',
          'Qualität muss zwischen 0 und 1000 liegen oder leer bleiben.',
        ),
      );
      return;
    }

    if (minQuality != null && maxQuality != null && minQuality > maxQuality) {
      setResourceBulkShareError(
        t(
          'Minimum quality cannot be higher than maximum quality.',
          'La qualite minimale ne peut pas etre superieure a la qualite maximale.',
          'Die minimale Qualitat kann nicht hoher als die maximale Qualitat sein.',
        ),
      );
      return;
    }

    if (bulkResourceSharePreview.matchingEntryIds.length === 0) {
      setResourceBulkShareError(
        t(
          'No stored resource entries match this filter yet.',
          'Aucune entree ressource stockee ne correspond encore a ce filtre.',
          'Keine gespeicherten Ressourceneintrage passen aktuell zu diesem Filter.',
        ),
      );
      return;
    }

    if (bulkResourceSharePreview.newEntryIds.length === 0) {
      setResourceBulkShareError(
        t(
          'All matching entries are already shared with this organization.',
          'Toutes les entrees correspondantes sont deja partagees avec cette organisation.',
          'Alle passenden Eintrage sind bereits mit dieser Organisation geteilt.',
        ),
      );
      return;
    }

    setResourceBulkShareBusy(true);
    setResourceCollectionError(null);
    setResourceCollectionNotice(null);
    setResourceBulkShareError(null);
    try {
      const nextOrganizationResourceShares = {
        ...(account.organizationResourceShares ?? {}),
      };
      const currentSharedIds = nextOrganizationResourceShares[organizationSid] ?? [];
      nextOrganizationResourceShares[organizationSid] = [
        ...new Set([...currentSharedIds, ...bulkResourceSharePreview.newEntryIds]),
      ];

      const prunedOrganizationResourceShares = Object.fromEntries(
        Object.entries(nextOrganizationResourceShares).filter(
          ([, resourceEntryIds]) => resourceEntryIds.length > 0,
        ),
      );

      await updateOrganizationResourceShares(prunedOrganizationResourceShares);
      setResourceBulkShareDialogOpen(false);
      setResourceCollectionNotice(
        t(
          `${bulkResourceSharePreview.newEntryIds.length} resource entries shared with ${organizationSid}.`,
          `${bulkResourceSharePreview.newEntryIds.length} entrees ressource partagees avec ${organizationSid}.`,
          `${bulkResourceSharePreview.newEntryIds.length} Ressourceneintrage wurden mit ${organizationSid} geteilt.`,
        ),
      );
    } catch (error) {
      setResourceBulkShareError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update resource sharing.',
              'La mise a jour du partage des ressources a echoue.',
              'Die Ressourcenfreigabe konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setResourceBulkShareBusy(false);
    }
  };

  const handleSaveResourceOrganizationShares = async () => {
    if (!account || !shareDialogResourceEntryId) {
      return;
    }

    setSharedResourceBusyId(shareDialogResourceEntryId);
    setResourceCollectionError(null);
    try {
      const nextOrganizationResourceShares = Object.fromEntries(
        Object.entries(account.organizationResourceShares ?? {}).map(([sid, resourceEntryIds]) => [
          sid,
          resourceEntryIds.filter((resourceEntryId) => resourceEntryId !== shareDialogResourceEntryId),
        ]),
      ) as Record<string, string[]>;

      for (const sid of shareDialogResourceSelection) {
        const currentResourceEntryIds = nextOrganizationResourceShares[sid] ?? [];
        nextOrganizationResourceShares[sid] = [
          ...new Set([...currentResourceEntryIds, shareDialogResourceEntryId]),
        ];
      }

      const prunedOrganizationResourceShares = Object.fromEntries(
        Object.entries(nextOrganizationResourceShares).filter(
          ([, resourceEntryIds]) => resourceEntryIds.length > 0,
        ),
      );

      await updateOrganizationResourceShares(prunedOrganizationResourceShares);
      setShareDialogResourceEntryId(null);
      setShareDialogResourceSelection([]);
    } catch (error) {
      setResourceCollectionError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update resource sharing.',
              'La mise a jour du partage des ressources a echoue.',
              'Die Ressourcenfreigabe konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setSharedResourceBusyId(null);
    }
  };

  const handleRemoveResourceEntry = async (resourceEntryId: string) => {
    if (!account) {
      return;
    }

    const entry = inventoryResources.find((item) => item.id === resourceEntryId);
    if (
      !entry ||
      !(await requestConfirmation(
        t(
          `Remove ${entry.resourceName} from your inventory? Its organization shares will also be removed.`,
          `Retirer ${entry.resourceName} de ton inventaire ? Ses partages avec les organisations seront également retirés.`,
          `${entry.resourceName} aus dem Inventar entfernen? Die Organisationsfreigaben werden ebenfalls entfernt.`,
        ),
        {
          title: t('Remove resource?', 'Retirer la ressource ?', 'Ressource entfernen?'),
          label: t('Remove resource', 'Retirer la ressource', 'Ressource entfernen'),
        },
      ))
    )
      return;
    setSharedResourceBusyId(resourceEntryId);
    setResourceCollectionError(null);
    try {
      queueInventoryResourcesUpdate((current, currentAccount) => {
        if (currentAccount.accountId !== account.accountId)
          throw new Error(
            t(
              'Your account changed. Please try again.',
              'Ton compte a changé. Réessaie.',
              'Dein Konto hat sich geändert. Bitte erneut versuchen.',
            ),
          );
        return current.filter((entry) => entry.id !== resourceEntryId);
      });

      if (shareDialogResourceEntryId === resourceEntryId) {
        setShareDialogResourceEntryId(null);
        setShareDialogResourceSelection([]);
      }
    } catch (error) {
      setResourceCollectionError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update the resource inventory.',
              'La mise a jour de l inventaire des ressources a echoue.',
              'Das Ressourceninventar konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setSharedResourceBusyId(null);
    }
  };

  const handleAddOrganization = async () => {
    const sid = normalizeOrganizationSidInput(organizationSidInput);
    if (!sid) {
      return;
    }

    if (linkedOrganizations.some((organization) => normalizeOrganizationSidInput(organization.sid) === sid)) {
      setOrganizationError(
        t(
          'This organization is already linked to your account.',
          'Cette organisation est deja liee a ton compte.',
          'Diese Organisation ist bereits mit deinem Konto verknüpft.',
        ),
      );
      return;
    }

    setOrganizationAddBusy(true);
    setOrganizationError(null);
    setOrganizationNotice(null);
    try {
      await addOrganization(sid);
      setOrganizationSidInput('');
    } catch (error) {
      setOrganizationError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to add the organization.',
              'L ajout de l organisation a echoue.',
              'Die Organisation konnte nicht hinzugefügt werden.',
            ),
      );
    } finally {
      setOrganizationAddBusy(false);
    }
  };

  const handleRemoveOrganization = async (sid: string) => {
    setOrganizationActionSid(sid);
    setOrganizationError(null);
    setOrganizationNotice(null);
    try {
      await removeOrganization(sid);
    } catch (error) {
      setOrganizationError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to remove the organization.',
              'La suppression de l organisation a echoue.',
              'Die Organisation konnte nicht entfernt werden.',
            ),
      );
    } finally {
      setOrganizationActionSid(null);
    }
  };

  const openClaimOrganizationDialog = (sid: string) => {
    blurFocusedElement();
    setOrganizationError(null);
    setOrganizationNotice(null);
    setOrganizationClaimDialogSid(sid);
  };

  const closeClaimOrganizationDialog = () => {
    if (!organizationActionSid) {
      setOrganizationClaimDialogSid(null);
    }
  };

  const openDeleteOrganizationDialog = (sid: string) => {
    blurFocusedElement();
    setOrganizationError(null);
    setOrganizationNotice(null);
    setOrganizationDeleteDialogSid(sid);
  };

  const closeDeleteOrganizationDialog = () => {
    if (!organizationActionSid) {
      setOrganizationDeleteDialogSid(null);
    }
  };

  const openOrganizationSharingDialog = (sid: string, enabled: boolean) => {
    blurFocusedElement();
    setOrganizationError(null);
    setOrganizationNotice(null);
    setOrganizationSharingDialogState({ sid, enabled });
  };

  const closeOrganizationSharingDialog = () => {
    if (!organizationActionSid) {
      setOrganizationSharingDialogState(null);
    }
  };

  const handleClaimOrganization = async () => {
    if (!organizationClaimDialogSid) {
      return;
    }

    const targetSid = organizationClaimDialogSid;
    setOrganizationActionSid(targetSid);
    setOrganizationError(null);
    setOrganizationNotice(null);
    try {
      await claimOrganization(targetSid);
      setOrganizationNotice(
        t(
          'Your organization claim request was sent for manual review.',
          'Ta demande de claim d organisation a ete envoyee pour revue manuelle.',
          'Deine Organisationsanfrage wurde zur manuellen Prüfung gesendet.',
        ),
      );
      setOrganizationClaimDialogSid(null);
    } catch (error) {
      setOrganizationError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to send the organization claim request.',
              'L envoi de la demande de claim d organisation a echoue.',
              'Die Organisationsanfrage konnte nicht gesendet werden.',
            ),
      );
    } finally {
      setOrganizationActionSid(null);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organizationDeleteDialogSid) {
      return;
    }

    const targetSid = organizationDeleteDialogSid;
    setOrganizationActionSid(targetSid);
    setOrganizationError(null);
    setOrganizationNotice(null);
    try {
      await deleteOrganization(targetSid);
      setOrganizationNotice(
        t(
          'Organization deleted from the app.',
          'Organisation supprimee de l appli.',
          'Organisation wurde aus der App entfernt.',
        ),
      );
      setOrganizationDeleteDialogSid(null);
    } catch (error) {
      setOrganizationError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to delete the organization.',
              'La suppression de l organisation a echoue.',
              'Die Organisation konnte nicht gelöscht werden.',
            ),
      );
    } finally {
      setOrganizationActionSid(null);
    }
  };

  const handleSetOrganizationSharing = async () => {
    if (!organizationSharingDialogState) {
      return;
    }

    const { sid, enabled } = organizationSharingDialogState;
    setOrganizationActionSid(sid);
    setOrganizationError(null);
    setOrganizationNotice(null);
    try {
      await setOrganizationBlueprintSharing(sid, enabled);
      setOrganizationNotice(
        enabled
          ? t(
              'Blueprint sharing enabled for this organization.',
              'Le partage de blueprints est active pour cette organisation.',
              'Die Blueprint-Freigabe ist für diese Organisation aktiviert.',
            )
          : t(
              'Blueprint sharing disabled for this organization.',
              'Le partage de blueprints est desactive pour cette organisation.',
              'Die Blueprint-Freigabe ist für diese Organisation deaktiviert.',
            ),
      );
      setOrganizationSharingDialogState(null);
    } catch (error) {
      setOrganizationError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update organization blueprint sharing.',
              'La mise a jour du partage des blueprints de l organisation a echoue.',
              'Die Blueprint-Freigabe der Organisation konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setOrganizationActionSid(null);
    }
  };

  const handleRespondToCraftRequest = async (
    requestId: string,
    decision: 'accepted' | 'denied' | 'closed' | 'deleted',
  ) => {
    setCraftRequestActionId(requestId);
    setCraftRequestError(null);
    setCraftRequestNotice(null);
    try {
      await respondToCraftRequest(requestId, decision);
      setCraftRequestNotice(
        decision === 'accepted'
          ? t('Craft request accepted.', 'Demande de craft acceptee.', 'Craft-Anfrage angenommen.')
          : decision === 'denied'
            ? t('Craft request denied.', 'Demande de craft refusee.', 'Craft-Anfrage abgelehnt.')
            : t('Craft request closed.', 'Demande de craft cloturee.', 'Craft-Anfrage geschlossen.'),
      );
    } catch (error) {
      setCraftRequestError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to answer the craft request.',
              'La reponse a la demande de craft a echoue.',
              'Die Craft-Anfrage konnte nicht beantwortet werden.',
            ),
      );
    } finally {
      setCraftRequestActionId(null);
    }
  };

  const handleDismissOnboarding = () =>
    onboardingAction.run(async () => {
      await updateOnboardingState({ dismissed: true });
    });
  const exportAccount = () => {
    if (!account) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'sc-craft-account-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            datasetScope: activeDataset.channel,
            account,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sc-craft-account-${activeDataset.channel}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return {
    confirmation,
    resolveConfirmation,
    sessionAction,
    handleRefresh,
    handleLogout,
    assetSort,
    sharingFilter,
    assetView,
    updatePreferences,
    editingResourceId,
    openEditResourceDialog,
    handlePersistedBlueprintCollectionsUpdate,
    handleAddBlueprints,
    blueprintById,
    inventorySnapshotIds,
    favoriteSnapshotIds,
    watcherBusy,
    resolvedLivePath,
    exportAccount,
    handleDismissOnboarding,
    localAccountCollections,
    t,
    lang,
    enabled,
    loading,
    user,
    citizenIdLoginEnabled,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    account,
    optimisticState,
    syncStatus,
    syncError,
    desktopAuthError,
    loginWithCitizenId,
    logout,
    refreshSession,
    activeBlueprint,
    activeDataset,
    setActiveBlueprint,
    missionRewards,
    theme,
    isDesktop,
    sync,
    watcher,
    urlAuthError,
    deleteAction,
    assetFilter,
    setAssetFilter,
    assetSearch,
    setAssetSearch,
    setImportModalDismissed,
    importAction,
    copyLiveToPtuAction,
    onboardingAction,
    rsiDialogOpen,
    setRsiDialogOpen,
    rsiChallenge,
    setRsiChallenge,
    rsiCode,
    rsiHandleInput,
    setRsiHandleInput,
    rsiAction,
    rsiCopyFeedback,
    setRsiCopyFeedback,
    rsiUnlinkAction,
    blueprintCollectionError,
    sharedBlueprintError,
    shareDialogSelection,
    setShareDialogSelection,
    sharedBlueprintBusyId,
    resourceCollectionError,
    resourceCollectionNotice,
    shareDialogResourceSelection,
    setShareDialogResourceSelection,
    sharedResourceBusyId,
    resourceBatchDialogOpen,
    resourceBatchRows,
    resourceBatchBusy,
    resourceBatchError,
    resourceBulkShareDialogOpen,
    resourceBulkShareDraft,
    setResourceBulkShareDraft,
    resourceBulkShareBusy,
    resourceBulkShareError,
    organizationSidInput,
    setOrganizationSidInput,
    organizationAddBusy,
    organizationActionSid,
    organizationError,
    organizationNotice,
    organizationSharingDialogState,
    craftRequestActionId,
    craftRequestError,
    craftRequestNotice,
    visibleBlueprintCount,
    setVisibleBlueprintCount,
    activeTab,
    setActiveTab,
    customPaths,
    customPathInput,
    setCustomPathInput,
    customPathLabel,
    setCustomPathLabel,
    watcherError,
    addCustomPath,
    removeCustomPath,
    defaultInventoryIdSet,
    handleWatcherToggle,
    handleAutoStartupToggle,
    inventoryResources,
    sharedBlueprintIdSet,
    sharedResourceEntryIdSet,
    linkedOrganizations,
    favoriteCount,
    inventoryCount,
    rsiVerificationRequired,
    canManageOrganizations,
    organizationClaimDialogTarget,
    organizationDeleteDialogTarget,
    organizationSharingDialogTarget,
    localImportPlan,
    importDialogOpen,
    totalObtainableBlueprintCount,
    ownedBlueprintCount,
    blueprintProgress,
    pendingCraftRequestCount,
    resourceById,
    sortedResources,
    resourceQuantityUnitById,
    resourceInsightById,
    shareDialogBlueprint,
    shareDialogResourceEntry,
    hiddenBlueprintCount,
    filteredAssetEntries,
    visibleAssetEntries,
    filteredBlueprintEntryCount,
    filteredResourceEntryCount,
    bulkResourceSharePreview,
    handleToggleFavoriteBlueprint,
    handleToggleInventoryBlueprint,
    handleDeleteAccount,
    handleCopyLiveDataToPtu,
    handleImportLocalCollections,
    handleCopyRsiCode,
    handleVerifyRsiLink,
    handleCitizenIdRsiLink,
    handleStartRsiLink,
    handleCompleteOnboarding,
    handleUnlinkRsiAccount,
    openShareBlueprintDialog,
    closeShareBlueprintDialog,
    handleSaveBlueprintOrganizationShares,
    openShareResourceDialog,
    closeShareResourceDialog,
    openResourceBatchDialog,
    closeResourceBatchDialog,
    addResourceBatchRow,
    updateResourceBatchRow,
    removeResourceBatchRow,
    handleAddResourceBatch,
    openResourceBulkShareDialog,
    closeResourceBulkShareDialog,
    handleSaveResourceBulkShare,
    handleSaveResourceOrganizationShares,
    handleRemoveResourceEntry,
    handleAddOrganization,
    handleRemoveOrganization,
    openClaimOrganizationDialog,
    closeClaimOrganizationDialog,
    openDeleteOrganizationDialog,
    closeDeleteOrganizationDialog,
    openOrganizationSharingDialog,
    closeOrganizationSharingDialog,
    handleClaimOrganization,
    handleDeleteOrganization,
    handleSetOrganizationSharing,
    handleRespondToCraftRequest,
  };
}

export type AccountController = ReturnType<typeof useAccountController>;
