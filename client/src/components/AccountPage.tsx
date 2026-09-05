import { startTransition, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Box, Divider, Paper, Stack, Typography, alpha, useTheme } from '../ui/system';
import { Avatar, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from './ui/primitives';
import { AppDialog, AppTooltip } from './ui/overlays';
import { AddCircleOutlineOutlinedIcon, DeleteOutlineOutlinedIcon, GroupsIcon, GroupsOutlinedIcon, LogoutOutlinedIcon, RefreshOutlinedIcon, SearchOutlinedIcon, FiberManualRecordIcon, AddOutlinedIcon, DeleteOutlineIcon, FolderOpenOutlinedIcon } from '../ui/icons';
import { useAsyncAction } from '../hooks/useAsyncAction';
import discordSymbol from '../assets/discord-symbol.svg';
import rsiLogoOfficial from '../assets/rsi-logo-official.jpg';
import { useAuth } from '../auth/AuthContext';
import {
  computeLocalAccountImportPlan,
  readLocalAccountCollections,
  writeLocalInventoryResources,
} from '../auth/localAccountImport';
import { useI18n } from '../i18n/I18nContext';
import {
  getDiscordBotInviteUrl,
  requestRsiLinkChallenge,
  type AccountInventoryResourceQuantityUnit,
  type AccountInventoryResourceEntry,
  type RsiLinkChallenge,
} from '../services/authService';
import { useCraft, DEFAULT_INVENTORY_IDS } from '../store/CraftContext';
import {
  clampQualityValue,
  formatQualityLabel,
  formatResourceQuantity,
  getObtainableBlueprintIds,
  isPlaceholderResource,
  isResourceSlot,
} from '../utils/crafting';
import { navigateToPath, resourcePathFromSlug } from '../utils/slug';
import { sanitizeExternalHttpsUrl } from '../utils/urlSafety';
import { AccountGuestView } from './account/AccountGuestView';
import { CraftRequestsPanel } from './account/CraftRequestsPanel';
import { BlueprintCard } from './BlueprintGrid';
import { ResourceAssetCard } from './resources/ResourceAssetCard';
import { Button } from './ui/Button';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_SM} from '../theme';
import { useScLog } from '../hooks/ScLogSyncContext';
import { trackEvent } from '../analytics/posthog';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { SyncBlueprintsButton } from './ScLogSyncDialog';
import { CitizenIdIcon, CitizenIdSignInButton } from './CitizenIdBrand';
import { AppButton, AppCheckbox, AppRating, AppSelect, AppSwitch, AppTextField } from './ui/controls';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import { SurfaceState } from './ui/feedback/SurfaceState';
import { AppAlert, AppProgressBar } from './ui/feedback';
import { AppChip } from './ui/data-display/AppChip';

function readAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('auth_error');
}

const ACCOUNT_BLUEPRINT_BATCH_SIZE = 24;
const RESOURCE_BATCH_SCU_STEP = 0.000001;
const ALL_RESOURCES_SHARE_OPTION = '__all__';

type AccountTab = 'overview' | 'inventory' | 'requests' | 'orgs' | 'settings';

type AccountAssetFilter =
  | 'all'
  | 'inventory-blueprints'
  | 'favorite-blueprints'
  | 'resources';

type AccountLibraryEntry =
  | {
      key: string;
      kind: 'blueprint';
      blueprint: ReturnType<typeof useCraft>['blueprints'][number];
      searchHaystack: string;
      isFavorite: boolean;
      isInInventory: boolean;
      isShared: boolean;
      sharedOrganizationIds: string[];
    }
  | {
      key: string;
      kind: 'resource';
      resourceEntry: AccountInventoryResourceEntry;
      resource: ReturnType<typeof useCraft>['activeDataset']['resources'][number] | null;
      searchHaystack: string;
      isShared: boolean;
      sharedOrganizationIds: string[];
    };

type ResourceBatchDraftRow = {
  id: string;
  resourceId: string;
  quantity: string;
  quality: string;
};

type ResourceBulkShareDraft = {
  organizationSid: string;
  resourceId: string;
  minQuality: string;
  maxQuality: string;
};

function blurFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function formatAbsoluteDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function handleAccountTabKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  activeId: AccountTab,
  onChange: (id: AccountTab) => void,
) {
  const tabIds: readonly AccountTab[] = ['overview', 'inventory', 'requests', 'orgs', 'settings'];
  const currentIndex = tabIds.indexOf(activeId);
  let nextIndex = currentIndex;

  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabIds.length - 1;
  else return;

  event.preventDefault();
  const nextId = tabIds[nextIndex];
  onChange(nextId);
  requestAnimationFrame(() => {
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${nextId}"]`)
      ?.focus();
  });
}

function normalizeOrganizationSidInput(value: string): string {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }

  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].trim().toUpperCase();
  }

  return input.toUpperCase();
}

function normalizeBatchResourceQuantity(
  value: string,
  quantityUnit: AccountInventoryResourceQuantityUnit,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  if (quantityUnit === 'count') {
    return Math.max(1, Math.round(parsed));
  }

  return Math.max(
    RESOURCE_BATCH_SCU_STEP,
    Math.round(parsed * 1_000_000) / 1_000_000,
  );
}

function openDiscordBotInvite() {
  window.open(getDiscordBotInviteUrl(), '_blank', 'noopener,noreferrer');
}

export function AccountPage() {
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
    linkRsiAccount,
    linkRsiAccountWithCitizenId,
    unlinkRsiAccount,
    updateOnboardingState,
    updateInventoryResources,
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
  const [assetFilter, setAssetFilter] = useState<AccountAssetFilter>('all');
  const [assetSearch, setAssetSearch] = useState('');
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
    const timer = window.setTimeout(() => {
      setRsiChallenge(null);
      setRsiCopyFeedback(null);
    }, Math.max(0, Date.parse(rsiChallenge.expiresAt) - Date.now()));
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
  const [localAccountCollections, setLocalAccountCollections] = useState(() =>
    readLocalAccountCollections(),
  );

  const [activeTab, setActiveTab] = useState<AccountTab>('overview');

  // Custom SC installation paths (settings tab)
  const [customPaths, setCustomPaths] = useState<Array<{ id: string; label: string; path: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('sc-custom-install-paths') ?? '[]'); } catch { return []; }
  });
  const [customPathInput, setCustomPathInput] = useState('');
  const [customPathLabel, setCustomPathLabel] = useState<string>('LIVE');
  const [watcherError, setWatcherError] = useState<string | null>(null);

  const saveCustomPaths = (next: typeof customPaths) => {
    setCustomPaths(next);
    localStorage.setItem('sc-custom-install-paths', JSON.stringify(next));
  };

  const addCustomPath = () => {
    const trimmedPath = customPathInput.trim();
    if (!trimmedPath) return;
    const next = [...customPaths, { id: `${Date.now()}`, label: customPathLabel, path: trimmedPath }];
    saveCustomPaths(next);
    setCustomPathInput('');
  };

  const removeCustomPath = (id: string) => {
    saveCustomPaths(customPaths.filter((p) => p.id !== id));
  };

  const defaultInventoryIdSet = useMemo(() => new Set<string>(DEFAULT_INVENTORY_IDS), []);
  const handleWatcherToggle = async (enabled: boolean) => {
    setWatcherError(null);
    const livePath = sync.installPaths?.live ?? null;
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
    }
  };

  const handleAutoStartupToggle = async (enabled: boolean) => {
    setWatcherError(null);
    try {
      if (enabled) {
        await watcher.enableAutoStartup();
      } else {
        await watcher.disableAutoStartup();
      }
    } catch (err: unknown) {
      setWatcherError(err instanceof Error ? err.message : 'Failed to update startup setting.');
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
  const organizationClaimDialogTarget = linkedOrganizations.find(
    (organization) => organization.sid === organizationClaimDialogSid,
  ) ?? null;
  const organizationDeleteDialogTarget = linkedOrganizations.find(
    (organization) => organization.sid === organizationDeleteDialogSid,
  ) ?? null;
  const organizationSharingDialogTarget = linkedOrganizations.find(
    (organization) => organization.sid === organizationSharingDialogState?.sid,
  ) ?? null;
  const localImportPlan = useMemo(
    () => computeLocalAccountImportPlan(account, localAccountCollections),
    [account, localAccountCollections],
  );
  const importDialogOpen = Boolean(account && localImportPlan.hasPendingImport && !importModalDismissed);

  const obtainableBlueprintIds = useMemo(
    () => getObtainableBlueprintIds(missionRewards),
    [missionRewards],
  );
  const totalObtainableBlueprintCount = obtainableBlueprintIds.size;
  const ownedBlueprintCount = inventoryCount;
  const blueprintProgress = totalObtainableBlueprintCount > 0
    ? (Math.min(ownedBlueprintCount, totalObtainableBlueprintCount) / totalObtainableBlueprintCount) * 100
    : 0;

  const pendingCraftRequestCount = useMemo(() => {
    return (account?.incomingCraftRequests ?? []).filter(
      (req) => req.status === 'pending',
    ).length;
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
    () =>
      new Map(
        (activeDataset.resourceInsights ?? []).map((insight) => [insight.resourceId, insight]),
      ),
    [activeDataset.resourceInsights],
  );
  const shareDialogBlueprint = shareDialogBlueprintId
    ? blueprintById.get(shareDialogBlueprintId) ?? null
    : null;
  const shareDialogResourceEntry = shareDialogResourceEntryId
    ? inventoryResources.find((resourceEntry) => resourceEntry.id === shareDialogResourceEntryId) ?? null
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

    const includeInventoryBlueprints =
      assetFilter === 'all' || assetFilter === 'inventory-blueprints';
    const includeFavoriteBlueprints =
      assetFilter === 'all' || assetFilter === 'favorite-blueprints';
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
          searchHaystack: [
            blueprint.name,
            blueprint.manufacturer,
            blueprint.category,
            'inventory',
          ]
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
          searchHaystack: [
            blueprint.name,
            blueprint.manufacturer,
            blueprint.category,
            'favorite',
          ]
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

    return entries.filter((entry) => {
      if (!normalizedSearch) {
        return true;
      }
      return entry.searchHaystack.includes(normalizedSearch);
    });
  }, [
    assetFilter,
    assetSearch,
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
    const minQuality = resourceBulkShareDraft.minQuality.trim()
      ? clampQualityValue(Number(resourceBulkShareDraft.minQuality))
      : null;
    const maxQuality = resourceBulkShareDraft.maxQuality.trim()
      ? clampQualityValue(Number(resourceBulkShareDraft.maxQuality))
      : null;

    if (!targetOrganizationSid) {
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
    setAssetFilter('all');
    setAssetSearch('');
  }, [account?.accountId, user?.id]);

  useEffect(() => {
    setVisibleBlueprintCount(ACCOUNT_BLUEPRINT_BATCH_SIZE);
  }, [assetFilter, assetSearch, account?.accountId, filteredAssetEntries.length]);

  const handlePersistedBlueprintCollectionsUpdate = async (
    nextCollections: {
      favoriteBlueprintIds?: string[];
      inventoryBlueprintIds?: string[];
    },
  ) => {
    if (!account) {
      replaceLocalBlueprintCollections(nextCollections);
      return;
    }

    const nextFavoriteBlueprintIds = Array.isArray(nextCollections.favoriteBlueprintIds)
      ? [...new Set(nextCollections.favoriteBlueprintIds)]
      : account.favoriteBlueprintIds;
    const nextInventoryBlueprintIds = Array.isArray(nextCollections.inventoryBlueprintIds)
      ? [...new Set(nextCollections.inventoryBlueprintIds)]
      : account.inventoryBlueprintIds;

    await syncAccountState({
      favoriteBlueprintIds: nextFavoriteBlueprintIds,
      inventoryBlueprintIds: nextInventoryBlueprintIds,
      planner: account.planner,
    });
  };

  const handleToggleFavoriteBlueprint = (blueprintId: string) => {
    setBlueprintCollectionError(null);

    if (!account) {
      toggleFavorite(blueprintId);
      return;
    }

    const nextFavoriteBlueprintIds = favoriteIdSet.has(blueprintId)
      ? favoriteSnapshotIds.filter((id) => id !== blueprintId)
      : [...favoriteSnapshotIds, blueprintId];

    void handlePersistedBlueprintCollectionsUpdate({
      favoriteBlueprintIds: nextFavoriteBlueprintIds,
      inventoryBlueprintIds: inventorySnapshotIds,
    }).catch((error) => {
      setBlueprintCollectionError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to update the favorite blueprints.',
            'La mise a jour des blueprints favoris a echoue.',
            'Die Favoriten-Blueprints konnten nicht aktualisiert werden.',
          ),
      );
    });
  };

  const handleToggleInventoryBlueprint = (blueprintId: string) => {
    setBlueprintCollectionError(null);

    if (!account) {
      toggleInventory(blueprintId);
      return;
    }

    const nextInventoryBlueprintIds = inventoryIdSet.has(blueprintId)
      ? inventorySnapshotIds.filter((id) => id !== blueprintId)
      : [...inventorySnapshotIds, blueprintId];

    void handlePersistedBlueprintCollectionsUpdate({
      favoriteBlueprintIds: favoriteSnapshotIds,
      inventoryBlueprintIds: nextInventoryBlueprintIds,
    }).catch((error) => {
      setBlueprintCollectionError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to update the inventory blueprints.',
            'La mise a jour des blueprints d inventaire a echoue.',
            'Die Inventar-Blueprints konnten nicht aktualisiert werden.',
          ),
      );
    });
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
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
    const confirmed = window.confirm(
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

    await importAction.run(async () => {
      const importedFavoriteIds = new Set(localImportPlan.missingFavoriteBlueprintIds);
      const importedInventoryIds = new Set(localImportPlan.missingInventoryBlueprintIds);
      const importedResourceEntryIds = new Set(
        localImportPlan.missingInventoryResources.map((resourceEntry) => resourceEntry.id),
      );
      const nextFavoriteBlueprintIds = [
        ...new Set([
          ...account.favoriteBlueprintIds,
          ...localImportPlan.missingFavoriteBlueprintIds,
        ]),
      ];
      const nextInventoryBlueprintIds = [
        ...new Set([
          ...account.inventoryBlueprintIds,
          ...localImportPlan.missingInventoryBlueprintIds,
        ]),
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
    }, t(
      'Failed to import the local collections.',
      'L import des collections locales a echoue.',
      'Der Import der lokalen Sammlungen ist fehlgeschlagen.',
    ));
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
        t(
          'Verification code copied.',
          'Code de verification copie.',
          'Verifizierungscode kopiert.',
        ),
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
      await rsiAction.run(async () => {
        if (!rsiChallenge || Date.parse(rsiChallenge.expiresAt) <= Date.now()) {
          setRsiChallenge(await requestRsiLinkChallenge(rsiHandleInput.trim()));
          return;
        }
        await linkRsiAccount(rsiChallenge.handle, rsiChallenge.code);
        setRsiChallenge(null);
        setRsiDialogOpen(false);
      }, t(
        'Failed to verify the RSI account.',
        'La verification du compte RSI a echoue.',
        'Die Verifizierung des RSI-Kontos ist fehlgeschlagen.',
      ));
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
      t('Failed to update onboarding.', 'La mise a jour de l onboarding a echoue.', 'Onboarding konnte nicht aktualisiert werden.'),
    );
  };

  const handleUnlinkRsiAccount = async () => {
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

  const createEmptyResourceBatchRow = (
    resourceId = sortedResources[0]?.id ?? '',
  ): ResourceBatchDraftRow => {
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
    setResourceBatchRows([createEmptyResourceBatchRow()]);
    setResourceBatchDialogOpen(true);
  };

  const closeResourceBatchDialog = () => {
    if (resourceBatchBusy) {
      return;
    }
    setResourceBatchDialogOpen(false);
    setResourceBatchRows([]);
    setResourceBatchError(null);
  };

  const addResourceBatchRow = () => {
    setResourceBatchRows((currentRows) => [...currentRows, createEmptyResourceBatchRow()]);
  };

  const updateResourceBatchRow = (
    rowId: string,
    updates: Partial<ResourceBatchDraftRow>,
  ) => {
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
      const resource = resourceById.get(row.resourceId) ?? null;
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

      const quantityUnit = resourceQuantityUnitById.get(row.resourceId) ?? 'scu';
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

      const normalizedQuality = clampQualityValue(
        row.quality.trim() ? Number(row.quality) : undefined,
      );
      const nowIso = new Date().toISOString();
      normalizedEntries.push({
        id: globalThis.crypto.randomUUID(),
        resourceId: resource.id,
        resourceName: resource.name,
        quantity: normalizedQuantity,
        quantityUnit,
        quality: normalizedQuality ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    setResourceBatchBusy(true);
    try {
      await updateInventoryResources([
        ...inventoryResources,
        ...normalizedEntries,
      ]);
      setResourceBatchDialogOpen(false);
      setResourceBatchRows([]);
      trackEvent('inventory_item_added', {
        inventory_source: 'resource_batch',
        inventory_delta: normalizedEntries.length,
      });
      setResourceCollectionNotice(
        t(
          `${normalizedEntries.length} resource entries added to your account inventory.`,
          `${normalizedEntries.length} entrees ressource ajoutees a l inventaire du compte.`,
          `${normalizedEntries.length} Ressourceneintrage wurden deinem Konto-Inventar hinzugefugt.`,
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

    const minQuality = resourceBulkShareDraft.minQuality.trim()
      ? clampQualityValue(Number(resourceBulkShareDraft.minQuality))
      : null;
    const maxQuality = resourceBulkShareDraft.maxQuality.trim()
      ? clampQualityValue(Number(resourceBulkShareDraft.maxQuality))
      : null;

    if (
      minQuality != null &&
      maxQuality != null &&
      minQuality > maxQuality
    ) {
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
        Object.entries(nextOrganizationResourceShares).filter(([, resourceEntryIds]) => resourceEntryIds.length > 0),
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
        Object.entries(nextOrganizationResourceShares).filter(([, resourceEntryIds]) => resourceEntryIds.length > 0),
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

    setSharedResourceBusyId(resourceEntryId);
    setResourceCollectionError(null);
    try {
      const nextInventoryResources = inventoryResources.filter((resourceEntry) => resourceEntry.id !== resourceEntryId);
      const nextOrganizationResourceShares = Object.fromEntries(
        Object.entries(account.organizationResourceShares ?? {}).map(([sid, resourceEntryIds]) => [
          sid,
          resourceEntryIds.filter((entryId) => entryId !== resourceEntryId),
        ]),
      );
      const prunedOrganizationResourceShares = Object.fromEntries(
        Object.entries(nextOrganizationResourceShares).filter(([, resourceEntryIds]) => resourceEntryIds.length > 0),
      );

      await Promise.all([
        updateInventoryResources(nextInventoryResources),
        updateOrganizationResourceShares(prunedOrganizationResourceShares),
      ]);

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
          ? t(
            'Craft request accepted.',
            'Demande de craft acceptee.',
            'Craft-Anfrage angenommen.',
          )
          : decision === 'denied'
            ? t(
              'Craft request denied.',
              'Demande de craft refusee.',
              'Craft-Anfrage abgelehnt.',
            )
            : t(
              'Craft request closed.',
              'Demande de craft cloturee.',
              'Craft-Anfrage geschlossen.',
            ),
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

  if (loading) {
    return (
      <PageLayout>
        <PageHeader title={t('Account', 'Compte', 'Konto')} />
        <SurfaceState
          tone="loading"
          title={t('Loading account session...', 'Chargement de la session compte...', 'Kontositzung wird geladen...')}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={t('Account', 'Compte', 'Konto')}
        eyebrow={t('Identity & synchronization', 'Identité et synchronisation', 'Identität und Synchronisation')}
        description={user
          ? t('Manage your identity, saved assets, organizations and craft requests.', 'Gere ton identite, tes actifs sauvegardes, tes organisations et tes demandes de craft.', 'Verwalte deine Identitat, gespeicherten Assets, Organisationen und Craft-Anfragen.')
          : t('Sign in to synchronize your crafting workspace across devices.', 'Connecte-toi pour synchroniser ton espace de craft entre tes appareils.', 'Melde dich an, um deinen Crafting-Arbeitsbereich gerateubergreifend zu synchronisieren.')}
      />

      {urlAuthError && (
        <AppAlert severity="error">
          {t('Authentication failed.', 'Echec de l\'authentification.', 'Authentifizierung ist fehlgeschlagen.')} {urlAuthError}
        </AppAlert>
      )}

      {rsiVerificationRequired && (
        <AppAlert severity="warning">
          <Stack spacing={1} alignItems="flex-start">
            <Typography>
              {t(
                'Please verify your RSI account again to restore access to organization sharing. Your saved inventory is preserved.',
                'Verifie a nouveau ton compte RSI pour retablir le partage avec tes organisations. Ton inventaire est conserve.',
                'Verifiziere dein RSI-Konto erneut, um die Organisationsfreigabe wieder zu aktivieren. Dein Inventar bleibt erhalten.',
              )}
            </Typography>
            <Button variant="secondary" onClick={handleStartRsiLink}>
              {t('Verify RSI account', 'Verifier le compte RSI', 'RSI-Konto verifizieren')}
            </Button>
          </Stack>
        </AppAlert>
      )}

      {user ? (
        <>
          {/* ── Hero Panel ── */}
          <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
            {/* Hero section */}
            <Box
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 'var(--workspace-gap)',
                alignItems: { xs: 'flex-start', sm: 'center' },
                background: `linear-gradient(150deg, ${alpha(theme.palette.secondary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 42%, transparent 100%)`,
              }}
            >
              {/* Avatar */}
              <Avatar
                src={user.avatarUrl ?? undefined}
                alt={user.displayName}
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  border: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                  boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.3)}`,
                  flexShrink: 0,
                }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </Avatar>

              {/* Identity */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    letterSpacing: '-0.018em',
                    lineHeight: 1.15,
                  }}
                >
                  {user.displayName}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems="center"
                  sx={{ mt: 0.75 }}
                >
                  {account?.rsi?.handle && (
                    <AppChip
                      label={`RSI — ${account.rsi.handle}`}
                      size="sm"
                      tone="success"
                      outlined
                      sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL }}
                    />
                  )}
                  <AppChip
                    label={t('Discord linked', 'Discord lié', 'Discord verknüpft')}
                    size="sm"
                    outlined
                    sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL }}
                  />
                  {account?.createdAt && (
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: FONT_MONO }}>
                      {t('Member since', 'Membre depuis', 'Mitglied seit')}{' '}
                      {new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(account.createdAt))}
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Actions */}
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RefreshOutlinedIcon fontSize="small" />}
                  onClick={() => { void refreshSession(); }}
                  disabled={syncStatus === 'syncing'}
                >
                  {syncStatus === 'syncing'
                    ? t('Syncing…', 'Synchro…', 'Synchronisiere…')
                    : t('Re-sync', 'Re-sync', 'Re-sync')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<LogoutOutlinedIcon fontSize="small" />}
                  onClick={() => { void logout(); }}
                >
                  {t('Sign out', 'Déconnexion', 'Abmelden')}
                </Button>
              </Stack>
            </Box>

            <Divider />
            <Box
              role="tablist"
              aria-label={t('Account sections', 'Sections du compte', 'Kontobereiche')}
              sx={{ display: 'flex', gap: 0.75, px: { xs: 1, md: 2 }, py: 1, overflowX: 'auto' }}
            >
              {([
                ['overview', t('Overview', 'Aperçu', 'Übersicht')],
                ['inventory', t('Inventory', 'Inventaire', 'Inventar')],
                ['requests', pendingCraftRequestCount > 0
                  ? t(`Craft requests (${pendingCraftRequestCount})`, `Demandes de craft (${pendingCraftRequestCount})`, `Craft-Anfragen (${pendingCraftRequestCount})`)
                  : t('Craft requests', 'Demandes de craft', 'Craft-Anfragen')],
                ['orgs', t('My orgs', 'Mes orgs', 'Meine Orgs')],
                ['settings', t('Settings', 'Paramètres', 'Einstellungen')],
              ] as const).map(([value, label]) => (
                <Box
                  component="button"
                  type="button"
                  key={value}
                  role="tab"
                  id={`account-tab-${value}`}
                  data-tab-id={value}
                  aria-label={label}
                  aria-selected={activeTab === value}
                  aria-controls={`account-tabpanel-${value}`}
                  tabIndex={activeTab === value ? 0 : -1}
                  onClick={() => setActiveTab(value)}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) =>
                    handleAccountTabKeyDown(event, activeTab, setActiveTab)}
                  sx={{
                    minHeight: 44,
                    px: 1.5,
                    whiteSpace: 'nowrap',
                    borderRadius: 1,
                    border: `1px solid ${activeTab === value ? theme.palette.primary.main : theme.palette.divider}`,
                    backgroundColor: activeTab === value ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                    color: activeTab === value ? 'text.primary' : 'text.secondary',
                    font: 'inherit',
                    cursor: 'pointer',
                    '&:hover': { color: 'text.primary', borderColor: 'primary.main' },
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Paper>

          {(desktopAuthError || syncError) && (
            <AppAlert severity="error">
              {desktopAuthError || syncError}
            </AppAlert>
          )}

          {account && !account.onboardingCompletedAt && (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.5, md: 2 },
                borderColor: alpha(theme.palette.primary.main, 0.22),
                backgroundColor: alpha(theme.palette.primary.main, 0.045),
              }}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', lg: 'center' }}
                justifyContent="space-between"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('Setup checklist', 'Checklist de configuration', 'Einrichtungs-Checkliste')}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    <AppChip
                      size="sm"
                      tone="success"
                      outlined
                      label={t('Discord linked', 'Discord lie', 'Discord verknuepft')}
                    />
                    <AppChip
                      size="sm"
                      tone={account.rsi?.handle ? 'success' : 'default'}
                      outlined={Boolean(account.rsi?.handle)}
                      label={account.rsi?.handle
                        ? t('RSI linked', 'RSI lie', 'RSI verknuepft')
                        : t('Link RSI', 'Lier RSI', 'RSI verknuepfen')}
                    />
                    <AppChip
                      size="sm"
                      tone={isDesktop ? 'success' : 'default'}
                      outlined={isDesktop}
                      label={isDesktop
                        ? t('Desktop app active', 'App desktop active', 'Desktop-App aktiv')
                        : t('Desktop app available', 'App desktop disponible', 'Desktop-App verfuegbar')}
                    />
                  </Stack>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
                  {!account.rsi?.handle && (
                    citizenIdRsiLinkEnabled ? (
                      <CitizenIdSignInButton
                        size="sm"
                        environment={citizenIdBrandEnvironment}
                        onClick={handleStartRsiLink}
                        disabled={rsiAction.busy}
                      />
                    ) : (
                      <AppButton
                        size="sm"
                        variant="primary"
                        onClick={handleStartRsiLink}
                        disabled={rsiAction.busy}
                      >
                        {t('Link RSI', 'Lier RSI', 'RSI verknuepfen')}
                      </AppButton>
                    )
                  )}
                  {!isDesktop && (
                    <Link
                      href="/api/desktop/latest-installer"
                      underline="hover"
                      data-touch-target="true"
                      sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, px: 1 }}
                    >
                      {t('Download app', 'Telecharger l app', 'App herunterladen')}
                    </Link>
                  )}
                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={handleCompleteOnboarding}
                    disabled={onboardingAction.busy || !account.rsi?.handle}
                  >
                    {t('Mark done', 'Marquer termine', 'Als erledigt markieren')}
                  </AppButton>
                </Stack>
              </Stack>
              {onboardingAction.error && (
                <AppAlert severity="error" sx={{ mt: 1.5 }}>
                  {onboardingAction.error}
                </AppAlert>
              )}
            </Paper>
          )}

          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && (
            <Box
              role="tabpanel"
              id="account-tabpanel-overview"
              aria-labelledby="account-tab-overview"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) minmax(0, 2fr)' },
                gap: 2.5,
                alignItems: 'start',
              }}
            >
              {/* Left: blueprint progress + stats */}
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}>
                      {t('Blueprint collection', 'Collection blueprints', 'Blueprint-Sammlung')}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="baseline">
                      <Typography variant="h2" sx={{ lineHeight: 0.9 }}>
                        {missionRewards ? ownedBlueprintCount : '--'}
                      </Typography>
                      <Typography variant="h5" sx={{ color: 'text.secondary' }}>
                        / {missionRewards ? totalObtainableBlueprintCount : '--'}
                      </Typography>
                    </Stack>
                    <AppProgressBar
                      value={blueprintProgress}
                      label={t('Blueprint collection progress', 'Progression de la collection de blueprints', 'Fortschritt der Blueprint-Sammlung')}
                      sx={{
                        height: 8,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      }}
                    />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {missionRewards
                        ? t(
                          'Blueprints stored in the account inventory against the full obtainable catalog.',
                          'Blueprints stockes dans l inventaire du compte par rapport au catalogue obtenable complet.',
                          'Blueprints aus dem Konto-Inventar im Verhältnis zum gesamten erhältlichen Katalog.',
                        )
                        : t(
                          'Mission catalog is syncing for the obtainable total.',
                          'Le catalogue mission se synchronise pour calculer le total obtenable.',
                          'Der Missionskatalog wird für die erreichbare Gesamtzahl synchronisiert.',
                        )}
                    </Typography>
                  </Stack>
                </Paper>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 1.5,
                  }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderColor: alpha(theme.palette.primary.main, 0.22),
                    }}
                  >
                    <Typography variant="overline" sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}>
                      {t('Inventory', 'Inventaire', 'Inventar')}
                    </Typography>
                    <Typography variant="h4">{inventoryCount}</Typography>
                  </Paper>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderColor: alpha(theme.palette.warning.main, 0.28),
                    }}
                  >
                    <Typography variant="overline" sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}>
                      {t('Favorites', 'Favoris', 'Favoriten')}
                    </Typography>
                    <Typography variant="h4">{favoriteCount}</Typography>
                  </Paper>
                </Box>
              </Stack>

              {/* Right: external account links */}
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}>
                    {t('External accounts', 'Comptes externes', 'Externe Konten')}
                  </Typography>

                  <Stack spacing={1.5}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr auto',
                        gap: 1.5,
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        component="img"
                        src={discordSymbol}
                        alt="Discord"
                        aria-hidden="true"
                        sx={{ width: 28, height: 28 }}
                      />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Discord</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          @{user.username}
                          {user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}
                        </Typography>
                      </Box>
                      <AppChip label={t('Linked', 'Lié', 'Verknüpft')} size="sm" tone="success" outlined />
                    </Paper>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr auto',
                        gap: 1.5,
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        component="img"
                        src={rsiLogoOfficial}
                        alt="RSI"
                        sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 0.5 }}
                      />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>RSI</Typography>
                        {account?.rsi?.handle ? (
                          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {`${account.rsi.handle} · ${rsiVerificationRequired
                                ? t('verification required', 'verification requise', 'Verifizierung erforderlich')
                                : t('verified', 'vérifié', 'verifiziert')}`}
                            </Typography>
                            {account.rsi.verificationProvider === 'citizenid' && (
                              <AppChip
                                size="sm"
                                outlined
                                icon={<CitizenIdIcon environment={citizenIdBrandEnvironment} size={14} variant="light" />}
                                label="via Citizen iD"
                                sx={{
                                  height: 20,
                                  borderColor: 'rgba(240, 240, 240, 0.22)',
                                  color: 'text.secondary',
                                  fontSize: TEXT_LABEL_SM,
                                }}
                              />
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('Not linked', 'Non lié', 'Nicht verknüpft')}
                          </Typography>
                        )}
                      </Box>
                      {canManageOrganizations ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { void handleUnlinkRsiAccount(); }}
                          disabled={rsiUnlinkAction.busy}
                        >
                          {rsiUnlinkAction.busy ? t('…', '…', '…') : t('Unlink', 'Délier', 'Entknüpfen')}
                        </Button>
                      ) : (
                        citizenIdRsiLinkEnabled ? (
                          <CitizenIdSignInButton
                            size="sm"
                            environment={citizenIdBrandEnvironment}
                            onClick={handleStartRsiLink}
                            sx={{ justifySelf: 'end', whiteSpace: 'nowrap' }}
                          />
                        ) : (
                          <AppButton
                            size="sm"
                            variant="secondary"
                            onClick={handleStartRsiLink}
                            icon={(
                              <Box
                                component="img"
                                src={rsiLogoOfficial}
                                alt=""
                                sx={{ width: 18, height: 18, objectFit: 'contain', borderRadius: 0.5 }}
                              />
                            )}
                            sx={{
                              whiteSpace: 'nowrap',
                              justifySelf: 'end',
                            }}
                          >
                            {t('Manual RSI link', 'Lien RSI manuel', 'Manuelle RSI-Verknupfung')}
                          </AppButton>
                        )
                      )}
                    </Paper>
                  </Stack>

                  {rsiUnlinkAction.error && (
                    <AppAlert severity="error">
                      {rsiUnlinkAction.error}
                    </AppAlert>
                  )}
                </Stack>
              </Paper>
            </Box>
          )}

          {/* ── Inventory Tab ── */}
          {activeTab === 'inventory' && (
            <Paper
              role="tabpanel"
              id="account-tabpanel-inventory"
              aria-labelledby="account-tab-inventory" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}
                    >
                      {t('Assets', 'Actifs', 'Assets')}
                    </Typography>
                    <Typography variant="h4" sx={{ lineHeight: 0.95 }}>
                      {t('Blueprints and resources', 'Blueprints et ressources', 'Blueprints und Ressourcen')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 760 }}>
                      {t(
                        'Manage blueprint favorites, inventory snapshots, stored resources and organization sharing from one searchable account library.',
                        'Gere les favoris blueprint, les snapshots d inventaire, les ressources stockees et le partage avec les organisations dans une seule bibliotheque de compte.',
                        'Verwalte Blueprint-Favoriten, Inventar-Snapshots, gespeicherte Ressourcen und Organisationsfreigaben in einer durchsuchbaren Kontobibliothek.',
                      )}
                    </Typography>
                  </Box>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ width: { xs: '100%', md: 'auto' }, alignSelf: { xs: 'stretch', md: 'center' } }}
                  >
                    <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: 240 } }}>
                      <SearchOutlinedIcon
                        aria-hidden="true"
                        sx={{ position: 'absolute', left: 12, bottom: 10, zIndex: 1, color: 'text.secondary' }}
                      />
                      <AppTextField
                        label={t('Search assets', 'Rechercher des actifs', 'Assets suchen')}
                        type="search"
                        value={assetSearch}
                        onValueChange={setAssetSearch}
                        sx={{ pl: 4.5 }}
                      />
                    </Box>
                    <AppSelect
                      label={t('Filter', 'Filtre', 'Filter')}
                      value={assetFilter}
                      options={[
                        { value: 'all', label: t('All assets', 'Tous les actifs', 'Alle Assets') },
                        { value: 'inventory-blueprints', label: t('Inventory blueprints', 'Blueprints inventaire', 'Inventar-Blueprints') },
                        { value: 'favorite-blueprints', label: t('Favorite blueprints', 'Blueprints favoris', 'Favoriten-Blueprints') },
                        { value: 'resources', label: t('Stored resources', 'Ressources stockees', 'Gespeicherte Ressourcen') },
                      ]}
                      onValueChange={(value) => { if (value) setAssetFilter(value as AccountAssetFilter); }}
                      fieldSx={{ minWidth: { xs: '100%', sm: 220 } }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<GroupsOutlinedIcon fontSize="small" />}
                      onClick={openResourceBulkShareDialog}
                      disabled={linkedOrganizations.length === 0 || inventoryResources.length === 0}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {t('Share batch', 'Partager en lot', 'Batch teilen')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<AddCircleOutlineOutlinedIcon fontSize="small" />}
                      onClick={openResourceBatchDialog}
                      disabled={sortedResources.length === 0}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {t('Add resources', 'Ajouter des ressources', 'Ressourcen hinzufügen')}
                    </Button>
                    {isDesktop && (
                      <SyncBlueprintsButton variant="outlined" size="small" />
                    )}
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  <AppChip
                    label={t(
                      `${filteredAssetEntries.length} visible entries`,
                      `${filteredAssetEntries.length} entrees visibles`,
                      `${filteredAssetEntries.length} sichtbare Eintrage`,
                    )}
                    size="sm"
                  />
                  <AppChip
                    label={t(
                      `${filteredBlueprintEntryCount} blueprints`,
                      `${filteredBlueprintEntryCount} blueprints`,
                      `${filteredBlueprintEntryCount} Blueprints`,
                    )}
                    size="sm"
                    outlined
                  />
                  <AppChip
                    label={t(
                      `${filteredResourceEntryCount} resources`,
                      `${filteredResourceEntryCount} ressources`,
                      `${filteredResourceEntryCount} Ressourcen`,
                    )}
                    size="sm"
                    outlined
                  />
                  <AppChip
                    label={t(
                      `${sharedBlueprintIdSet.size + sharedResourceEntryIdSet.size} shared entries`,
                      `${sharedBlueprintIdSet.size + sharedResourceEntryIdSet.size} entrees partagees`,
                      `${sharedBlueprintIdSet.size + sharedResourceEntryIdSet.size} geteilte Eintrage`,
                    )}
                    size="sm"
                    outlined
                  />
                  {hiddenBlueprintCount > 0 && (
                    <AppChip
                      label={t(
                        `${hiddenBlueprintCount} unavailable blueprints`,
                        `${hiddenBlueprintCount} blueprints indisponibles`,
                        `${hiddenBlueprintCount} nicht verfugbare Blueprints`,
                      )}
                      size="sm"
                      outlined
                    />
                  )}
                </Stack>

                {(blueprintCollectionError || sharedBlueprintError || resourceCollectionError) && (
                  <AppAlert severity="error">
                    {blueprintCollectionError ?? sharedBlueprintError ?? resourceCollectionError}
                  </AppAlert>
                )}

                {resourceCollectionNotice && (
                  <AppAlert severity="success">
                    {resourceCollectionNotice}
                  </AppAlert>
                )}

                {filteredAssetEntries.length === 0 ? (
                  <Box
                    sx={{
                      py: { xs: 5, md: 8 },
                      px: 2,
                      textAlign: 'center',
                      borderRadius: 2,
                      border: `1px dashed ${theme.palette.divider}`,
                      backgroundColor: alpha(theme.palette.background.default, 0.35),
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 0.75 }}>
                      {assetFilter === 'resources'
                        ? t('No stored resources yet', 'Aucune ressource stockee pour le moment', 'Noch keine Ressourcen gespeichert')
                        : assetFilter === 'favorite-blueprints'
                          ? t('No favorite blueprints yet', 'Aucun blueprint favori pour le moment', 'Noch keine Favoriten-Blueprints')
                          : assetFilter === 'inventory-blueprints'
                            ? t('No inventory blueprints yet', 'Aucun blueprint d inventaire pour le moment', 'Noch keine Inventar-Blueprints')
                            : t('No saved assets yet', 'Aucun actif sauvegarde pour le moment', 'Noch keine gespeicherten Assets')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', maxWidth: 620, mx: 'auto' }}>
                      {assetFilter === 'resources'
                        ? t(
                            'Use Add resources to open the batch table, then capture as many stored resource entries as you need before choosing which linked organizations can access each one.',
                            'Utilise Ajouter des ressources pour ouvrir la table batch, puis enregistre autant d entrees ressource que necessaire avant de choisir quelles organisations liees peuvent acceder a chacune.',
                            'Nutze Ressourcen hinzufügen, um die Batch-Tabelle zu öffnen und so viele gespeicherte Ressourceneintrage wie nötig zu erfassen, bevor du auswählst, welche verknüpften Organisationen auf jeden Eintrag zugreifen konnen.',
                          )
                        : t(
                            'Save blueprints or resources to your account, then narrow the view with the search bar or the asset filter above.',
                            'Sauvegarde des blueprints ou des ressources sur ton compte, puis affine la vue avec la recherche ou le filtre d actif ci-dessus.',
                            'Speichere Blueprints oder Ressourcen in deinem Konto und verfeinere die Ansicht danach mit Suche oder Asset-Filter oben.',
                          )}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: 'repeat(3, minmax(0, 1fr))',
                        lg: 'repeat(5, minmax(0, 1fr))',
                        xl: 'repeat(5, minmax(0, 1fr))',
                      },
                      gap: { xs: 1.25, sm: 1.5, md: 2 },
                    }}
                    role="list"
                    aria-label={t('Saved account assets', 'Actifs sauvegardes du compte', 'Gespeicherte Konto-Assets')}
                  >
                    {visibleAssetEntries.map((entry, index) => {
                      if (entry.kind === 'blueprint') {
                        return (
                          <BlueprintCard
                            key={entry.key}
                            blueprint={entry.blueprint}
                            isActive={activeBlueprint?.id === entry.blueprint.id}
                            isFavorite={entry.isFavorite}
                            isInInventory={entry.isInInventory}
                            organizationShareAction={entry.isInInventory
                              ? {
                                  selected: entry.isShared,
                                  busy: sharedBlueprintBusyId === entry.blueprint.id,
                                  label: entry.isShared
                                    ? t('Org sharing', 'Partage org', 'Org-Freigabe')
                                    : t('Share', 'Partage', 'Teilen'),
                                  ariaLabel: t(
                                    'Choose which linked organizations can access this blueprint',
                                    'Choisir quelles organisations liees peuvent acceder a ce blueprint',
                                    'Auswahlen, welche verknupften Organisationen auf diesen Blueprint zugreifen konnen',
                                  ),
                                  disabled: linkedOrganizations.length === 0,
                                  tooltip: linkedOrganizations.length === 0
                                    ? t(
                                        'Link an organization on this account first.',
                                        'Lie d abord une organisation a ce compte.',
                                        'Verknupfe zuerst eine Organisation mit diesem Konto.',
                                      )
                                    : entry.isShared
                                      ? t(
                                          `Shared with ${entry.sharedOrganizationIds.length} linked organization${entry.sharedOrganizationIds.length > 1 ? 's' : ''}. Click to choose the organizations.`,
                                          `Partage avec ${entry.sharedOrganizationIds.length} organisation${entry.sharedOrganizationIds.length > 1 ? 's' : ''} liee${entry.sharedOrganizationIds.length > 1 ? 's' : ''}. Clique pour choisir les organisations.`,
                                          `Mit ${entry.sharedOrganizationIds.length} verknupften Organisation${entry.sharedOrganizationIds.length > 1 ? 'en' : ''} geteilt. Klicke, um die Organisationen zu wahlen.`,
                                        )
                                      : t(
                                          'Private to this account until you select one or more linked organizations.',
                                          'Prive pour ce compte tant que tu ne selectionnes pas une ou plusieurs organisations liees.',
                                          'Privat fur dieses Konto, bis du eine oder mehrere verknupfte Organisationen auswahlen.',
                                        ),
                                  onToggle: (blueprintId) => { openShareBlueprintDialog(blueprintId); },
                                }
                              : undefined}
                            resources={activeDataset.resources}
                            priority={index < 8}
                            onSelect={(blueprint) => startTransition(() => setActiveBlueprint(blueprint))}
                            onToggleFavorite={handleToggleFavoriteBlueprint}
                            onToggleInventory={defaultInventoryIdSet.has(entry.blueprint.id) ? undefined : handleToggleInventoryBlueprint}
                          />
                        );
                      }

                      const qualityLabel = entry.resourceEntry.quality == null
                        ? t('No quality', 'Sans qualite', 'Ohne Qualitat')
                        : formatQualityLabel(entry.resourceEntry.quality, lang);

                      return (
                        <ResourceAssetCard
                          key={entry.key}
                          resource={entry.resource}
                          insight={resourceInsightById.get(entry.resourceEntry.resourceId) ?? null}
                          onOpen={
                            entry.resource
                              ? () =>
                                  navigateToPath(resourcePathFromSlug(entry.resourceEntry.resourceId), {
                                    resourceId: entry.resourceEntry.resourceId,
                                    mainView: 'resources',
                                  })
                              : null
                          }
                          href={entry.resource ? resourcePathFromSlug(entry.resourceEntry.resourceId) : null}
                          title={entry.resourceEntry.resourceName}
                          infoChips={[
                            {
                              label: formatResourceQuantity(entry.resourceEntry.quantity, entry.resourceEntry.quantityUnit, lang, 'long'),
                            },
                            {
                              label: qualityLabel,
                              variant: 'outlined',
                            },
                            ...(entry.isShared
                              ? [
                                  {
                                    label: t(
                                      `${entry.sharedOrganizationIds.length} orgs`,
                                      `${entry.sharedOrganizationIds.length} orgs`,
                                      `${entry.sharedOrganizationIds.length} Orgs`,
                                    ),
                                    color: 'primary' as const,
                                    variant: 'outlined' as const,
                                  },
                                ]
                              : []),
                          ]}
                          footer={
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
                                gap: 0.75,
                              }}
                            >
                              <AppButton
                                variant="secondary"
                                ariaPressed={entry.isShared}
                                ariaLabel={t(
                                  'Choose which linked organizations can access this resource entry',
                                  'Choisir quelles organisations liees peuvent acceder a cette entree ressource',
                                  'Auswahlen, welche verknupften Organisationen auf diesen Ressourceneintrag zugreifen konnen',
                                )}
                                icon={entry.isShared ? <GroupsIcon fontSize="small" /> : <GroupsOutlinedIcon fontSize="small" />}
                                onClick={() => { openShareResourceDialog(entry.resourceEntry.id); }}
                                disabled={linkedOrganizations.length === 0 || sharedResourceBusyId === entry.resourceEntry.id}
                                fullWidth
                                sx={{
                                  minWidth: 0,
                                  minHeight: { xs: 38, sm: 40 },
                                  gap: { xs: 0.5, sm: 0.625 },
                                  px: { xs: 0.9, sm: 1.05 },
                                  py: { xs: 0.65, sm: 0.8 },
                                  justifyContent: 'flex-start',
                                  fontSize: { xs: TEXT_LABEL, sm: '0.78rem' },
                                  lineHeight: 1.15,
                                  borderColor: 'divider',
                                  backgroundColor: alpha(theme.palette.background.default, 0.22),
                                  color: 'text.secondary',
                                  '& .resource-asset-action-label': {
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  },
                                  '&:hover': {
                                    borderColor: 'primary.main',
                                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                    color: 'text.primary',
                                  },
                                  ...(entry.isShared && {
                                    color: 'primary.main',
                                    borderColor: 'primary.main',
                                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                  }),
                                }}
                              >
                                <Box component="span" className="resource-asset-action-label">
                                  {entry.isShared
                                    ? t('Org sharing', 'Partage org', 'Org-Freigabe')
                                    : t('Share', 'Partage', 'Teilen')}
                                </Box>
                              </AppButton>
                              <AppButton
                                variant="secondary"
                                ariaLabel={t('Remove this resource entry', 'Retirer cette entree ressource', 'Diesen Ressourceneintrag entfernen')}
                                icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                                onClick={() => { void handleRemoveResourceEntry(entry.resourceEntry.id); }}
                                disabled={sharedResourceBusyId === entry.resourceEntry.id}
                                fullWidth
                                sx={{
                                  minWidth: 0,
                                  minHeight: { xs: 38, sm: 40 },
                                  gap: { xs: 0.5, sm: 0.625 },
                                  px: { xs: 0.9, sm: 1.05 },
                                  py: { xs: 0.65, sm: 0.8 },
                                  justifyContent: 'flex-start',
                                  fontSize: { xs: TEXT_LABEL, sm: '0.78rem' },
                                  lineHeight: 1.15,
                                  borderColor: 'divider',
                                  backgroundColor: alpha(theme.palette.background.default, 0.22),
                                  color: 'text.secondary',
                                  '& .resource-asset-action-label': {
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  },
                                  '&:hover': {
                                    borderColor: 'primary.main',
                                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                    color: 'text.primary',
                                  },
                                }}
                              >
                                <Box component="span" className="resource-asset-action-label">
                                  {t('Remove', 'Retirer', 'Entfernen')}
                                </Box>
                              </AppButton>
                            </Box>
                          }
                        />
                      );
                    })}
                  </Box>
                )}

                {visibleBlueprintCount < filteredAssetEntries.length && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setVisibleBlueprintCount((currentCount) =>
                          Math.min(currentCount + ACCOUNT_BLUEPRINT_BATCH_SIZE, filteredAssetEntries.length),
                        )
                      }
                    >
                      {t('Load more assets', 'Afficher plus d actifs', 'Mehr Assets laden')}
                    </Button>
                  </Box>
                )}
              </Stack>
            </Paper>
          )}

          {/* ── Craft Requests Tab ── */}
          {activeTab === 'requests' && (
            <Box role="tabpanel" id="account-tabpanel-requests" aria-labelledby="account-tab-requests">
              <CraftRequestsPanel
              account={account}
              optimisticState={optimisticState}
              syncStatus={syncStatus}
              syncError={syncError}
              craftRequestActionId={craftRequestActionId}
              craftRequestError={craftRequestError}
              craftRequestNotice={craftRequestNotice}
                onRespondToCraftRequest={(requestId, decision) => { void handleRespondToCraftRequest(requestId, decision); }}
              />
            </Box>
          )}

          {/* ── My Orgs Tab ── */}
          {activeTab === 'orgs' && (
            <Stack
              role="tabpanel"
              id="account-tabpanel-orgs"
              aria-labelledby="account-tab-orgs" spacing={2.5}>
              {/* Header */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1.5}
                useFlexGap
                flexWrap="wrap"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}>
                    {t('Organizations', 'Organisations', 'Organisationen')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.35 }}>
                    {t('My organizations', 'Mes organisations', 'Meine Organisationen')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 620 }}>
                    {t(
                      'RSI organizations linked to your account. Sync via Citizen iD to import automatically.',
                      'Organisations RSI liees a ton compte. Synchronise via Citizen iD pour importer automatiquement.',
                      'RSI-Organisationen deines Kontos. Synchronisiere über Citizen iD für automatischen Import.',
                    )}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0 }}>
                  <AppChip
                    label={t(
                      linkedOrganizations.length === 1 ? '1 organization' : `${linkedOrganizations.length} organizations`,
                      linkedOrganizations.length === 1 ? '1 organisation' : `${linkedOrganizations.length} organisations`,
                      linkedOrganizations.length === 1 ? '1 Organisation' : `${linkedOrganizations.length} Organisationen`,
                    )}
                    size="sm"
                    outlined
                  />
                  {canManageOrganizations && (
                    <AppChip label={t('RSI linked', 'RSI lie', 'RSI verknüpft')} size="sm" tone="info" outlined />
                  )}
                </Stack>
              </Stack>

              {/* Error/notice banners */}
              {organizationError && (
                <AppAlert severity="error">
                  {organizationError}
                </AppAlert>
              )}
              {organizationNotice && (
                <AppAlert severity="success">
                  {organizationNotice}
                </AppAlert>
              )}

              {/* No RSI link — CTA to Settings */}
              {!canManageOrganizations && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderColor: alpha(theme.palette.info.main, 0.25),
                    backgroundColor: alpha(theme.palette.info.main, 0.03),
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 0.75 }}>
                    {t('Link your RSI account first', 'Lie ton compte RSI d abord', 'Verknüpfe zuerst dein RSI-Konto')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto', mb: 2.5 }}>
                    {t(
                      'Go to Settings → RSI Account to link your RSI handle. Once linked, your main organization will be imported automatically.',
                      'Va dans Paramètres → Compte RSI pour lier ton handle RSI. Une fois lié, ton organisation principale sera importée automatiquement.',
                      'Gehe zu Einstellungen → RSI-Konto, um deinen RSI-Handle zu verknüpfen. Danach wird deine Hauptorganisation automatisch importiert.',
                    )}
                  </Typography>
                  <Button variant="secondary" onClick={() => setActiveTab('settings')}>
                    {t('Go to Settings', 'Aller dans Paramètres', 'Zu Einstellungen')}
                  </Button>
                </Paper>
              )}

              {/* RSI linked */}
              {canManageOrganizations && (
                <>
                  {/* Empty state — only here is the "Sign in with Citizen iD" button appropriate */}
                  {linkedOrganizations.length === 0 && (
                    <Box
                      sx={{
                        py: 5,
                        px: 2,
                        textAlign: 'center',
                        borderRadius: 2,
                        border: `1px dashed ${theme.palette.divider}`,
                        backgroundColor: alpha(theme.palette.background.default, 0.35),
                      }}
                    >
                      <Typography variant="h6" sx={{ mb: 0.75 }}>
                        {t('No organizations yet', 'Aucune organisation pour le moment', 'Noch keine Organisationen')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto', mb: 2.5 }}>
                        {t(
                          'Sign in with Citizen iD to import your public RSI organizations automatically.',
                          'Connecte-toi avec Citizen iD pour importer automatiquement tes organisations RSI publiques.',
                          'Melde dich mit Citizen iD an, um deine öffentlichen RSI-Organisationen automatisch zu importieren.',
                        )}
                      </Typography>
                      {citizenIdRsiLinkEnabled ? (
                        <CitizenIdSignInButton
                          environment={citizenIdBrandEnvironment}
                          onClick={() => { handleCitizenIdRsiLink('/account'); }}
                          disabled={rsiAction.busy}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {t(
                            'Citizen iD sync is not configured in this environment yet.',
                            'La synchro Citizen iD n est pas encore configuree dans cet environnement.',
                            'Citizen iD Sync ist in dieser Umgebung noch nicht konfiguriert.',
                          )}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Org list */}
                  {linkedOrganizations.length > 0 && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: 1.5,
                      }}
                    >
                    {linkedOrganizations.map((organization) => {
                      const lastSyncLabel = formatAbsoluteDate(organization.lastLiveSyncAt);
                      const lastVerifiedLabel = formatAbsoluteDate(organization.lastVerifiedAt);
                      const claimRequestSubmittedLabel = formatAbsoluteDate(organization.claimRequestSubmittedAt);
                      const organizationImage = organization.image ?? organization.logo ?? undefined;
                      const organizationUrl = sanitizeExternalHttpsUrl(organization.url);
                      const hasPendingClaimRequest = organization.claimRequestStatus === 'pending';
                      const organizationStatusLabel =
                        organization.status === 'verified_admin'
                          ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                          : organization.status === 'verified_member'
                            ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                            : t('Observed', 'Observee', 'Beobachtet');
                      const organizationSourceLabel =
                        organization.source === 'profile-main'
                          ? t('Main org', 'Organisation principale', 'Hauptorg')
                          : t('Manual SID', 'SID manuel', 'Manuelle SID');
                      const roleLabel = organization.rank
                        ?? t('Not verified yet', 'Pas encore verifie', 'Noch nicht verifiziert');
                      const membersLabel = typeof organization.memberCount === 'number' && organization.memberCount > 0
                        ? organization.memberCount.toLocaleString()
                        : t('Unknown', 'Inconnu', 'Unbekannt');
                      const lastSyncSummary = lastSyncLabel
                        ? t(
                          `Legacy member snapshot: ${lastSyncLabel}`,
                          `Snapshot membres historique : ${lastSyncLabel}`,
                          `Legacy-Mitgliedersnapshot: ${lastSyncLabel}`,
                        )
                        : t(
                          'Citizen iD syncs your own RSI membership. Full org rosters are not exposed by Citizen iD.',
                          'Citizen iD synchronise ton appartenance RSI. Les rosters complets d org ne sont pas exposes par Citizen iD.',
                          'Citizen iD synchronisiert deine RSI-Mitgliedschaft. Vollstaendige Org-Roster werden von Citizen iD nicht bereitgestellt.',
                        );
                      const lastVerificationSummary = lastVerifiedLabel
                        ? t(
                          `Last verified role update: ${lastVerifiedLabel}`,
                          `Derniere mise a jour du role verifie : ${lastVerifiedLabel}`,
                          `Letzte verifizierte Rollenaktualisierung: ${lastVerifiedLabel}`,
                        )
                        : t(
                          'No verified role stored yet',
                          'Aucun role verifie n est encore stocke',
                          'Es ist noch keine verifizierte Rolle gespeichert',
                        );

                      return (
                        <Paper
                          key={organization.sid}
                          variant="outlined"
                          sx={{
                            overflow: 'hidden',
                            borderColor: alpha(theme.palette.primary.main, 0.18),
                            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
                          }}
                        >
                          <Stack spacing={0}>
                            <Box
                              sx={{
                                px: 1.75,
                                py: 1.5,
                                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 45%, ${alpha(theme.palette.background.paper, 0.24)} 100%)`,
                              }}
                            >
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1.25}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                              >
                                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                                  <Avatar
                                    src={organizationImage}
                                    alt={organization.name}
                                    variant="rounded"
                                    sx={{
                                      width: 56,
                                      height: 56,
                                      border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
                                      boxShadow: `0 10px 20px ${alpha(theme.palette.common.black, 0.18)}`,
                                    }}
                                  >
                                    {organization.name.charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Box sx={{ minWidth: 0 }}>
                                    {organizationUrl ? (
                                      <Link href={organizationUrl} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
                                        <Typography variant="subtitle1" sx={{ lineHeight: 1.2, fontWeight: 700 }}>
                                          {organization.name}
                                        </Typography>
                                      </Link>
                                    ) : (
                                      <Typography variant="subtitle1" sx={{ lineHeight: 1.2, fontWeight: 700 }}>
                                        {organization.name}
                                      </Typography>
                                    )}
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: 'text.secondary',
                                        mt: 0.45,
                                        fontFamily: 'monospace',
                                        letterSpacing: '0.04em',
                                      }}
                                    >
                                      {organization.sid}
                                    </Typography>
                                  </Box>
                                </Stack>

                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                  <AppChip label={organizationSourceLabel} size="sm" outlined />
                                  <AppChip
                                    label={organizationStatusLabel}
                                    size="sm"
                                    tone={organization.status === 'verified_admin' ? 'success' : organization.status === 'verified_member' ? 'info' : 'default'}
                                    outlined={organization.status === 'observed'}
                                  />
                                  {organization.claimedByCurrentUser && (
                                    <AppChip
                                      label={t('Claimed by you', 'Claim par toi', 'Von dir beansprucht')}
                                      size="sm"
                                      tone="primary"
                                      outlined
                                    />
                                  )}
                                  {hasPendingClaimRequest && (
                                    <AppChip
                                      label={t('Review pending', 'Revue en attente', 'Prüfung ausstehend')}
                                      size="sm"
                                      tone="warning"
                                      outlined
                                    />
                                  )}
                                </Stack>
                              </Stack>
                            </Box>

                            <Stack spacing={1.5} sx={{ p: 1.75 }}>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                                  gap: 1,
                                }}
                              >
                                <Box
                                  sx={{
                                    p: 1.25,
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                    backgroundColor: alpha(theme.palette.background.default, 0.3),
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {t('Your role', 'Ton role', 'Deine Rolle')}
                                  </Typography>
                                  <Typography variant="body1" sx={{ mt: 0.55, fontWeight: 600 }}>
                                    {roleLabel}
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    p: 1.25,
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                    backgroundColor: alpha(theme.palette.background.default, 0.3),
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {t('Stars', 'Etoiles', 'Sterne')}
                                  </Typography>
                                  {typeof organization.stars === 'number' ? (
                                    <Stack spacing={0.45} sx={{ mt: 0.5 }}>
                                      <AppRating
                                        value={Math.max(0, Math.min(5, organization.stars))}
                                        max={5}
                                        readOnly
                                        ariaLabel={t(
                                          `${organization.stars} stars`,
                                          `${organization.stars} etoiles`,
                                          `${organization.stars} Sterne`,
                                        )}
                                      />
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {organization.stars}/5
                                      </Typography>
                                    </Stack>
                                  ) : (
                                    <Typography variant="body2" sx={{ mt: 0.55, color: 'text.secondary' }}>
                                      {t('No data yet', 'Pas encore de donnees', 'Noch keine Daten')}
                                    </Typography>
                                  )}
                                </Box>

                                <Box
                                  sx={{
                                    p: 1.25,
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                    backgroundColor: alpha(theme.palette.background.default, 0.3),
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {t('Members', 'Membres', 'Mitglieder')}
                                  </Typography>
                                  <Typography variant="body1" sx={{ mt: 0.55, fontWeight: 600 }}>
                                    {membersLabel}
                                  </Typography>
                                </Box>
                              </Box>

                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                  gap: 1,
                                }}
                              >
                                <Box
                                  sx={{
                                    p: 1.25,
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                    backgroundColor: alpha(theme.palette.background.paper, 0.46),
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {t('Roster source', 'Source roster', 'Roster-Quelle')}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 0.55, color: 'text.secondary' }}>
                                    {lastSyncSummary}
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    p: 1.25,
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                    backgroundColor: alpha(theme.palette.background.paper, 0.46),
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    {t('Verified role', 'Role verifie', 'Verifizierte Rolle')}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 0.55, color: 'text.secondary' }}>
                                    {lastVerificationSummary}
                                  </Typography>
                                </Box>
                              </Box>

                              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                {organization.syncStatus === 'stale' && (
                                  <AppChip
                                    label={t('Snapshot stale', 'Snapshot obsolete', 'Snapshot veraltet')}
                                    size="sm"
                                    tone="warning"
                                    outlined
                                  />
                                )}
                              </Stack>

                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {!organization.claimed && !hasPendingClaimRequest && canManageOrganizations && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={organizationActionSid === organization.sid}
                                    onClick={() => { openClaimOrganizationDialog(organization.sid); }}
                                  >
                                    {organizationActionSid === organization.sid
                                      ? t('Sending...', 'Envoi...', 'Sende...')
                                      : t('Request claim review', 'Demander une revue de claim', 'Claim-Prüfung anfordern')}
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={organizationActionSid === organization.sid}
                                  onClick={() => { void handleRemoveOrganization(organization.sid); }}
                                >
                                  {t('Quit organization', 'Quitter l organisation', 'Organisation verlassen')}
                                </Button>

                                {organization.claimedByCurrentUser && (
                                  <AppTooltip
                                    content={t(
                                      'Invite the ItemFab Discord bot with the minimum scopes: bot and applications.commands. No guild permissions are requested.',
                                      'Inviter le bot Discord ItemFab avec les scopes minimums : bot et applications.commands. Aucune permission de serveur n est demandee.',
                                      'Lade den ItemFab-Discord-Bot mit den minimalen Scopes bot und applications.commands ein. Es werden keine Server-Berechtigungen angefordert.',
                                    )}
                                  >
                                    <span>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={(
                                          <Box
                                            component="img"
                                            src={discordSymbol}
                                            alt=""
                                            aria-hidden="true"
                                            sx={{ width: 16, height: 16, display: 'block' }}
                                          />
                                        )}
                                        onClick={openDiscordBotInvite}
                                      >
                                        {t('Add Discord bot', 'Ajouter le bot Discord', 'Discord-Bot hinzufügen')}
                                      </Button>
                                    </span>
                                  </AppTooltip>
                                )}

                                {organization.claimedByCurrentUser && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={organizationActionSid === organization.sid}
                                    onClick={() => {
                                      openOrganizationSharingDialog(
                                        organization.sid,
                                        !(organization.blueprintSharingEnabled !== false),
                                      );
                                    }}
                                  >
                                    {organization.blueprintSharingEnabled !== false
                                      ? t(
                                        'Disable blueprint sharing',
                                        'Desactiver le partage de blueprints',
                                        'Blueprint-Freigabe deaktivieren',
                                      )
                                      : t(
                                        'Enable blueprint sharing',
                                        'Activer le partage de blueprints',
                                        'Blueprint-Freigabe aktivieren',
                                      )}
                                  </Button>
                                )}

                                {organization.claimedByCurrentUser && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={organizationActionSid === organization.sid}
                                    onClick={() => { openDeleteOrganizationDialog(organization.sid); }}
                                  >
                                    {t(
                                      'Delete organization',
                                      'Supprimer l organisation',
                                      'Organisation löschen',
                                    )}
                                  </Button>
                                )}
                              </Stack>

                              {hasPendingClaimRequest && (
                                <Typography sx={{ color: 'text.secondary' }}>
                                  {claimRequestSubmittedLabel
                                    ? t(
                                      `A manual claim review was requested on ${claimRequestSubmittedLabel}.`,
                                      `Une revue manuelle du claim a ete demandee le ${claimRequestSubmittedLabel}.`,
                                      `Eine manuelle Claim-Prüfung wurde am ${claimRequestSubmittedLabel} angefordert.`,
                                    )
                                    : t(
                                      'A manual claim review is pending for this organization.',
                                      'Une revue manuelle du claim est en attente pour cette organisation.',
                                      'Für diese Organisation wartet eine manuelle Claim-Prüfung.',
                                    )}
                                </Typography>
                              )}

                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Box>
                )}

                  {/* Actions panel: re-sync + manual fallback */}
                  <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2 } }}>
                    <Stack spacing={2}>
                      <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em', lineHeight: 1 }}>
                        {t('Actions', 'Actions', 'Aktionen')}
                      </Typography>

                      {/* Citizen iD re-sync — avoids "Sign in" label when already linked */}
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        justifyContent="space-between"
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t('Sync with Citizen iD', 'Synchroniser avec Citizen iD', 'Mit Citizen iD synchronisieren')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t(
                              'Re-run after changing org visibility or granting new Citizen iD scopes.',
                              'Relance apres avoir change la visibilite des orgs ou accepte de nouveaux scopes Citizen iD.',
                              'Erneut ausführen nach Änderung der Org-Sichtbarkeit oder neuer Citizen iD Scopes.',
                            )}
                          </Typography>
                        </Box>
                        <Button
                          variant="secondary"
                          icon={<CitizenIdIcon environment={citizenIdBrandEnvironment} size={16} variant="light" />}
                          onClick={() => { handleCitizenIdRsiLink('/account'); }}
                          disabled={rsiAction.busy || !citizenIdRsiLinkEnabled}
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {rsiAction.busy
                            ? t('Syncing...', 'Synchronisation...', 'Synchronisiere...')
                            : t('Re-sync organizations', 'Re-synchroniser les organisations', 'Organisationen neu synchronisieren')}
                        </Button>
                      </Stack>

                      <Divider />

                      {/* Manual fallback */}
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.35 }}>
                          {t('Manual fallback', 'Fallback manuel', 'Manueller Fallback')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
                          {t(
                            'Use this only when an organization is public on RSI but was not returned by Citizen iD.',
                            'Utilise ceci uniquement quand une organisation est publique sur RSI mais n a pas ete renvoyee par Citizen iD.',
                            'Nutze dies nur, wenn eine Organisation auf RSI öffentlich ist, aber nicht von Citizen iD zurückgegeben wurde.',
                          )}
                        </Typography>
                        <Stack
                          direction={{ xs: 'column', lg: 'row' }}
                          spacing={1.25}
                          alignItems={{ xs: 'stretch', lg: 'stretch' }}
                          sx={{ width: '100%' }}
                        >
                          <AppTextField
                            label={t('Organization SID or URL', 'SID ou URL d organisation', 'Organisations-SID oder URL')}
                            value={organizationSidInput}
                            onValueChange={setOrganizationSidInput}
                            placeholder="PROTECTORA"
                            disabled={organizationAddBusy}
                            helperText={t(
                              'Accepts a SID like PROTECTORA or a full public RSI organization URL.',
                              'Accepte un SID comme PROTECTORA ou une URL publique complète d organisation RSI.',
                              'Akzeptiert eine SID wie PROTECTORA oder eine vollständige öffentliche RSI-Organisations-URL.',
                            )}
                            fieldSx={{ flex: 1 }}
                          />
                          <Button
                            variant="secondary"
                            onClick={() => { void handleAddOrganization(); }}
                            disabled={organizationAddBusy || !normalizeOrganizationSidInput(organizationSidInput)}
                            style={{ whiteSpace: 'nowrap', minWidth: 0, flexShrink: 0, alignSelf: 'stretch' }}
                          >
                            {organizationAddBusy
                              ? t('Adding...', 'Ajout...', 'Füge hinzu...')
                              : t('Add org', 'Ajouter', 'Hinzufügen')}
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </Paper>
                </>
              )}
            </Stack>
          )}

          {/* ── Settings Tab ── */}
          {activeTab === 'settings' && (
            <Box
              role="tabpanel"
              id="account-tabpanel-settings"
              aria-labelledby="account-tab-settings"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 2.5,
                alignItems: 'start',
              }}
            >
              {/* Desktop: Star Citizen installations */}
              {isDesktop && (
                <Paper variant="outlined" sx={{ p: 2.5, gridColumn: { md: '1 / -1' } }}>
                  <Stack spacing={2}>
                    <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}>
                      {t('Star Citizen installations', 'Installations Star Citizen', 'Star Citizen Installationen')}
                    </Typography>

                    {/* Auto-detected paths */}
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: TEXT_LABEL_SM }}>
                        {t('Detected', 'Détectées', 'Erkannt')}
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                        {sync.installPaths?.live ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AppButton size="sm" variant="secondary" disabled sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, minWidth: 56, py: 0.25 }}>LIVE</AppButton>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                              <FolderOpenOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', fontSize: TEXT_LABEL }}>
                                {sync.installPaths.live}
                              </Typography>
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            {sync.detecting
                              ? t('Detecting…', 'Détection…', 'Erkenne…')
                              : t('No LIVE installation found', 'Aucune installation LIVE détectée', 'Keine LIVE-Installation gefunden')}
                          </Typography>
                        )}
                        {sync.installPaths?.ptu && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AppButton size="sm" variant="secondary" disabled sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, minWidth: 56, py: 0.25 }}>PTU</AppButton>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                              <FolderOpenOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', fontSize: TEXT_LABEL }}>
                                {sync.installPaths.ptu}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Stack>
                    </Box>

                    {/* Custom paths */}
                    {customPaths.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: TEXT_LABEL_SM }}>
                          {t('Custom', 'Personnalisées', 'Benutzerdefiniert')}
                        </Typography>
                        <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                          {customPaths.map((cp) => (
                            <Box key={cp.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AppButton size="sm" variant="secondary" disabled sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, minWidth: 56, py: 0.25 }}>{cp.label}</AppButton>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                                <FolderOpenOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
                                <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', fontSize: TEXT_LABEL }}>
                                  {cp.path}
                                </Typography>
                              </Box>
                              <AppButton
                                size="sm"
                                variant="ghost"
                                icon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                                ariaLabel={t(
                                  `Remove ${cp.label} installation path`,
                                  `Supprimer le chemin d installation ${cp.label}`,
                                  `Installationspfad ${cp.label} entfernen`,
                                )}
                                sx={{ minWidth: 44, minHeight: 44, px: 0.5 }}
                                onClick={() => removeCustomPath(cp.id)}
                              >
                                <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                                  {t('Remove', 'Supprimer', 'Entfernen')}
                                </Box>
                              </AppButton>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Add custom path */}
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: TEXT_LABEL_SM, display: 'block', mb: 0.75 }}>
                        {t('Add installation', 'Ajouter une installation', 'Installation hinzufügen')}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 0.75 }}>
                        {(['LIVE', 'PTU', 'HOTFIX', 'TECH-PREVIEW', 'EVOCATI'] as const).map((label) => (
                          <AppButton
                            key={label}
                            size="sm"
                            variant={customPathLabel === label ? 'primary' : 'secondary'}
                            onClick={() => setCustomPathLabel(label)}
                            sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, px: 0.75, py: 0.25, minWidth: 0 }}
                          >
                            {label}
                          </AppButton>
                        ))}
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <AppTextField
                          ariaLabel={t('Path to channel folder', 'Chemin vers le dossier', 'Pfad zum Channel-Ordner')}
                          placeholder={t('Path to channel folder…', 'Chemin vers le dossier…', 'Pfad zum Channel-Ordner…')}
                          value={customPathInput}
                          onValueChange={setCustomPathInput}
                          onKeyDown={(e) => { if (e.key === 'Enter') addCustomPath(); }}
                          fieldSx={{ flex: 1 }}
                        />
                        <AppButton
                          size="sm"
                          variant="secondary"
                          onClick={addCustomPath}
                          disabled={!customPathInput.trim()}
                          icon={<AddOutlinedIcon sx={{ fontSize: 14 }} />}
                        >
                          {t('Add', 'Ajouter', 'Hinzufügen')}
                        </AppButton>
                      </Stack>
                    </Box>

                    {/* Real-time watcher toggle */}
                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          {watcher.running && (
                            <FiberManualRecordIcon sx={{ fontSize: 8, color: 'success.main', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t('Watch LIVE logs in real-time', 'Surveiller les logs LIVE en temps réel', 'LIVE-Logs in Echtzeit überwachen')}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: TEXT_LABEL }}>
                          {t(
                            'Detects new blueprints instantly when received in-game.',
                            'Détecte les nouveaux blueprints instantanément en jeu.',
                            'Erkennt neue Blueprints sofort im Spiel.',
                          )}
                        </Typography>
                      </Box>
                      <AppSwitch
                        label={t('Watch LIVE logs in real-time', 'Surveiller les logs LIVE en temps réel', 'LIVE-Logs in Echtzeit überwachen')}
                        checked={watcher.running}
                        disabled={!user || !sync.installPaths?.live}
                        onCheckedChange={(checked) => { void handleWatcherToggle(checked); }}
                      />
                    </Box>

                    {/* Launch at startup */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t('Launch at Windows startup', 'Lancer au démarrage de Windows', 'Bei Windows-Start starten')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: TEXT_LABEL }}>
                          {t(
                            'Start automatically when Windows boots so the watcher is always active.',
                            'Démarre automatiquement au démarrage de Windows.',
                            'Startet automatisch beim Windows-Start.',
                          )}
                        </Typography>
                      </Box>
                      <AppSwitch
                        label={t('Launch at Windows startup', 'Lancer au démarrage de Windows', 'Bei Windows-Start starten')}
                        checked={watcher.autoStartupEnabled}
                        onCheckedChange={(checked) => { void handleAutoStartupToggle(checked); }}
                      />
                    </Box>

                    {watcherError && (
                      <AppAlert severity="error">
                        {watcherError}
                      </AppAlert>
                    )}
                  </Stack>
                </Paper>
              )}

              {/* RSI Account link */}
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack spacing={1.5}>
                  <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}>
                    {t('RSI account', 'Compte RSI', 'RSI-Konto')}
                  </Typography>

                  {(!account?.rsi?.handle || rsiVerificationRequired) && (
                    citizenIdRsiLinkEnabled ? (
                      <Stack spacing={1}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {t(
                            'Use Citizen iD to link your RSI handle and synchronize organizations.',
                            'Utilise Citizen iD pour lier ton handle RSI et synchroniser les organisations.',
                            'Nutze Citizen iD, um deinen RSI-Handle zu verknuepfen und Organisationen zu synchronisieren.',
                          )}
                        </Typography>
                        <CitizenIdSignInButton
                          fullWidth
                          environment={citizenIdBrandEnvironment}
                          onClick={handleStartRsiLink}
                          sx={{
                            justifyContent: 'flex-start',
                            px: 1.75,
                            py: 1.2,
                            minHeight: 54,
                          }}
                        />
                      </Stack>
                    ) : (
                      <AppButton
                        variant="secondary"
                        fullWidth
                        onClick={handleStartRsiLink}
                        icon={(
                          <Box
                            component="img"
                            src={rsiLogoOfficial}
                            alt=""
                            sx={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 0.5 }}
                          />
                        )}
                        sx={{
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          px: 1.75,
                          py: 1.2,
                          minHeight: 54,
                        }}
                      >
                        <Stack spacing={0.2} alignItems="flex-start" sx={{ minWidth: 0 }}>
                          <Box component="span" sx={{ fontWeight: 800 }}>
                            {t('Verify RSI manually', 'Verifier RSI manuellement', 'RSI manuell verifizieren')}
                          </Box>
                          <Box
                            component="span"
                            sx={{
                              fontSize: TEXT_LABEL,
                              fontWeight: 500,
                              lineHeight: 1.25,
                              color: 'text.secondary',
                            }}
                          >
                            {t(
                              'Alternative RSI verification method',
                              'Methode alternative de verification RSI',
                              'Alternative RSI-Verifizierungsmethode',
                            )}
                          </Box>
                        </Stack>
                      </AppButton>
                    )
                  )}

                  {account?.rsi?.handle && (
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography sx={{ color: 'text.secondary' }}>
                        {t(
                          `Linked RSI handle: ${account.rsi.handle}`,
                          `Handle RSI lie : ${account.rsi.handle}`,
                          `Verknüpfter RSI-Handle: ${account.rsi.handle}`,
                        )}
                      </Typography>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { void handleUnlinkRsiAccount(); }}
                        disabled={rsiUnlinkAction.busy}
                      >
                        {rsiUnlinkAction.busy
                          ? t('Removing...', 'Suppression...', 'Entferne...')
                          : t('Remove link', 'Supprimer le lien', 'Verknüpfung entfernen')}
                      </Button>
                    </Stack>
                  )}

                  {rsiUnlinkAction.error && (
                    <AppAlert severity="error">
                      {rsiUnlinkAction.error}
                    </AppAlert>
                  )}
                </Stack>
              </Paper>

              {/* LIVE / PTU data copy */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  backgroundColor: alpha(theme.palette.info.main, 0.04),
                  borderColor: alpha(theme.palette.info.main, 0.22),
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.08em' }}>
                    {t('LIVE / PTU', 'LIVE / PTU', 'LIVE / PTU')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t(
                      'Copies LIVE account data into the PTU account scope only. PTU data is never copied back to LIVE.',
                      'Copie les donnees LIVE uniquement vers le scope de compte PTU. Les donnees PTU ne sont jamais copiees vers LIVE.',
                      'Kopiert LIVE-Kontodaten nur in den PTU-Kontobereich. PTU-Daten werden nie nach LIVE zuruckkopiert.',
                    )}
                  </Typography>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => { void handleCopyLiveDataToPtu(); }}
                    disabled={copyLiveToPtuAction.busy || activeDataset.channel !== 'ptu'}
                  >
                    {copyLiveToPtuAction.busy
                      ? t('Copying...', 'Copie...', 'Kopiere...')
                      : t('Copy LIVE to PTU', 'Copier LIVE vers PTU', 'LIVE nach PTU kopieren')}
                  </Button>
                  {activeDataset.channel !== 'ptu' && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t(
                        'Switch to a PTU dataset before running the copy.',
                        'Passe sur un dataset PTU avant de lancer la copie.',
                        'Wechsle vor dem Kopieren zu einem PTU-Dataset.',
                      )}
                    </Typography>
                  )}
                  {copyLiveToPtuAction.error && (
                    <AppAlert severity="error">
                      {copyLiveToPtuAction.error}
                    </AppAlert>
                  )}
                </Stack>
              </Paper>

              {/* Danger zone */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderColor: alpha(theme.palette.error.main, 0.25),
                  backgroundColor: alpha(theme.palette.error.main, 0.03),
                  gridColumn: { md: '1 / -1' },
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="overline" sx={{ color: 'error.main', letterSpacing: '0.08em' }}>
                    {t('Danger zone', 'Zone dangereuse', 'Gefahrenzone')}
                  </Typography>

                  {deleteAction.error && (
                    <AppAlert severity="error">
                      {deleteAction.error}
                    </AppAlert>
                  )}

                  <Button
                    variant="danger"
                    fullWidth
                    onClick={() => { void handleDeleteAccount(); }}
                    disabled={deleteAction.busy}
                  >
                    {deleteAction.busy
                      ? t('Deleting account...', 'Suppression du compte...', 'Konto wird gelöscht...')
                      : t('Delete account', 'Supprimer le compte', 'Konto löschen')}
                  </Button>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t(
                      'This removes the cloud profile, favorites, inventory snapshot and planner snapshot, then clears the current session.',
                      'Cela supprime le profil cloud, les favoris, le snapshot inventaire et le snapshot planner, puis efface la session courante.',
                      'Dadurch werden Cloud-Profil, Favoriten, Inventar-Snapshot und Planner-Snapshot entfernt und die aktuelle Sitzung geleert.',
                    )}
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          )}


        </>
      ) : (
        <AccountGuestView
          enabled={enabled && citizenIdLoginEnabled}
          brandEnvironment={citizenIdBrandEnvironment}
          onLogin={() => { loginWithCitizenId('/account'); }}
          onInviteBot={openDiscordBotInvite}
        />
      )}

      {account && (
        <AppDialog
          open={importDialogOpen}
          onOpenChange={(open) => { if (!open && !importAction.busy) setImportModalDismissed(true); }}
          width="min(36rem, calc(100vw - 2rem))"
          title={t(
            'Import local inventory data?',
            'Importer les donnees locales d inventaire ?',
            'Lokale Inventardaten importieren?',
          )}
          footer={
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                variant="ghost"
                onClick={() => setImportModalDismissed(true)}
                disabled={importAction.busy}
              >
                {t('Not now', 'Plus tard', 'Nicht jetzt')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => { void handleImportLocalCollections(); }}
                disabled={importAction.busy}
              >
                {importAction.busy
                  ? t('Importing...', 'Import en cours...', 'Importiere...')
                  : t('Import into account', 'Importer dans le compte', 'In Konto importieren')}
              </Button>
            </Box>
          }
        >
            <Stack spacing={2}>
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Local blueprint collections or stored resources were found after login. Some of them are not present in the cloud account yet.',
                  'Des collections blueprint locales ou des ressources stockees localement ont ete trouvees apres connexion. Certaines ne sont pas encore presentes dans le compte cloud.',
                  'Nach der Anmeldung wurden lokale Blueprint-Sammlungen oder gespeicherte Ressourcen gefunden. Ein Teil davon ist noch nicht im Cloud-Konto vorhanden.',
                )}
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1,
                }}
              >
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {t('Inventory to import', 'Inventaire a importer', 'Zu importierendes Inventar')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {localImportPlan.missingInventoryBlueprintIds.length}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {t('Favorites to import', 'Favoris a importer', 'Zu importierende Favoriten')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {localImportPlan.missingFavoriteBlueprintIds.length}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {t('Resources to import', 'Ressources a importer', 'Zu importierende Ressourcen')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {localImportPlan.missingInventoryResources.length}
                  </Typography>
                </Paper>
              </Box>

              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Accepting merges the missing local blueprints and resource entries into the cloud account, then clears the imported local entries.',
                  'Accepter fusionne les blueprints et entrees de ressources locales manquants dans le compte cloud, puis vide les entrees locales importees.',
                  'Beim Bestatigen werden die fehlenden lokalen Blueprints und Ressourceneintrage in das Cloud-Konto ubernommen und die importierten lokalen Eintrage geleert.',
                )}
              </Typography>

              {importAction.error && (
                <AppAlert severity="error">
                  {importAction.error}
                </AppAlert>
              )}
            </Stack>
        </AppDialog>
      )}

      <AppDialog
        open={Boolean(shareDialogBlueprint)}
        onOpenChange={(open) => { if (!open) closeShareBlueprintDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Share blueprint with organizations',
          'Partager le blueprint avec des organisations',
          'Blueprint mit Organisationen teilen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeShareBlueprintDialog}
              disabled={Boolean(sharedBlueprintBusyId)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleSaveBlueprintOrganizationShares(); }}
              disabled={Boolean(sharedBlueprintBusyId) || linkedOrganizations.length === 0}
            >
              {sharedBlueprintBusyId
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Save sharing', 'Enregistrer le partage', 'Freigabe speichern')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {shareDialogBlueprint
                ? t(
                  `Choose which linked organizations can access ${shareDialogBlueprint.name}.`,
                  `Choisis quelles organisations liees peuvent acceder a ${shareDialogBlueprint.name}.`,
                  `Wähle, welche verknüpften Organisationen auf ${shareDialogBlueprint.name} zugreifen können.`,
                )
                : t(
                  'Choose which linked organizations can access this blueprint.',
                  'Choisis quelles organisations liees peuvent acceder a ce blueprint.',
                  'Wähle, welche verknüpften Organisationen auf diesen Blueprint zugreifen können.',
                )}
            </Typography>

            {linkedOrganizations.length === 0 ? (
              <AppAlert severity="info">
                {t(
                  'Link at least one organization on this account before sharing blueprints.',
                  'Lie au moins une organisation a ce compte avant de partager des blueprints.',
                  'Verknüpfe mindestens eine Organisation mit diesem Konto, bevor du Blueprints teilst.',
                )}
              </AppAlert>
            ) : (
              <Stack spacing={1}>
                {linkedOrganizations.map((organization) => {
                  const checked = shareDialogSelection.includes(organization.sid);
                  return (
                    <Paper
                      key={organization.sid}
                      variant="outlined"
                      sx={{
                        p: 1.1,
                        borderColor: checked ? 'primary.main' : 'divider',
                        backgroundColor: checked
                          ? alpha(theme.palette.primary.main, 0.08)
                          : alpha(theme.palette.background.default, 0.2),
                      }}
                    >
                      <Stack direction="row" spacing={1.1} alignItems="center">
                        <AppCheckbox
                          checked={checked}
                          onCheckedChange={() =>
                            setShareDialogSelection((currentSelection) =>
                              checked
                                ? currentSelection.filter((sid) => sid !== organization.sid)
                                : [...currentSelection, organization.sid],
                            )
                          }
                          label={organization.name}
                          description={organization.sid}
                        />
                        <Box sx={{ flex: 1 }} />
                        <AppChip
                          size="sm"
                          outlined
                          label={
                            organization.status === 'verified_admin'
                              ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                              : organization.status === 'verified_member'
                                ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                                : t('Linked only', 'Simplement liee', 'Nur verknüpft')
                          }
                          tone={organization.status === 'verified_admin' ? 'success' : organization.status === 'verified_member' ? 'info' : 'default'}
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            {sharedBlueprintError && (
              <AppAlert severity="error">
                {sharedBlueprintError}
              </AppAlert>
            )}
          </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(shareDialogResourceEntry)}
        onOpenChange={(open) => { if (!open) closeShareResourceDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Share resource entry with organizations',
          'Partager l entree ressource avec des organisations',
          'Ressourceneintrag mit Organisationen teilen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeShareResourceDialog}
              disabled={Boolean(sharedResourceBusyId)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleSaveResourceOrganizationShares(); }}
              disabled={Boolean(sharedResourceBusyId) || linkedOrganizations.length === 0}
            >
              {sharedResourceBusyId
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Save sharing', 'Enregistrer le partage', 'Freigabe speichern')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {shareDialogResourceEntry
                ? t(
                    `Choose which linked organizations can access ${shareDialogResourceEntry.resourceName} (${formatResourceQuantity(shareDialogResourceEntry.quantity, shareDialogResourceEntry.quantityUnit, lang, 'long')}).`,
                    `Choisis quelles organisations liees peuvent acceder a ${shareDialogResourceEntry.resourceName} (${formatResourceQuantity(shareDialogResourceEntry.quantity, shareDialogResourceEntry.quantityUnit, lang, 'long')}).`,
                    `Wahle, welche verknupften Organisationen auf ${shareDialogResourceEntry.resourceName} (${formatResourceQuantity(shareDialogResourceEntry.quantity, shareDialogResourceEntry.quantityUnit, lang, 'long')}) zugreifen konnen.`,
                  )
                : t(
                    'Choose which linked organizations can access this resource entry.',
                    'Choisis quelles organisations liees peuvent acceder a cette entree ressource.',
                    'Wahle, welche verknupften Organisationen auf diesen Ressourceneintrag zugreifen konnen.',
                  )}
            </Typography>

            {linkedOrganizations.length === 0 ? (
              <AppAlert severity="info">
                {t(
                  'Link at least one organization on this account before sharing stored resources.',
                  'Lie au moins une organisation a ce compte avant de partager des ressources stockees.',
                  'Verknupfe mindestens eine Organisation mit diesem Konto, bevor du gespeicherte Ressourcen teilst.',
                )}
              </AppAlert>
            ) : (
              <Stack spacing={1}>
                {linkedOrganizations.map((organization) => {
                  const checked = shareDialogResourceSelection.includes(organization.sid);
                  return (
                    <Paper
                      key={organization.sid}
                      variant="outlined"
                      sx={{
                        p: 1.1,
                        borderColor: checked ? 'primary.main' : 'divider',
                        backgroundColor: checked
                          ? alpha(theme.palette.primary.main, 0.08)
                          : alpha(theme.palette.background.default, 0.2),
                      }}
                    >
                      <Stack direction="row" spacing={1.1} alignItems="center">
                        <AppCheckbox
                          checked={checked}
                          onCheckedChange={() =>
                            setShareDialogResourceSelection((currentSelection) =>
                              checked
                                ? currentSelection.filter((sid) => sid !== organization.sid)
                                : [...currentSelection, organization.sid],
                            )
                          }
                          label={organization.name}
                          description={organization.sid}
                        />
                        <Box sx={{ flex: 1 }} />
                        <AppChip
                          size="sm"
                          outlined
                          label={
                            organization.status === 'verified_admin'
                              ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                              : organization.status === 'verified_member'
                                ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                                : t('Linked only', 'Simplement liee', 'Nur verknupft')
                          }
                          tone={organization.status === 'verified_admin' ? 'success' : organization.status === 'verified_member' ? 'info' : 'default'}
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            {resourceCollectionError && (
              <AppAlert severity="error">
                {resourceCollectionError}
              </AppAlert>
            )}
          </Stack>
      </AppDialog>

      <AppDialog
        open={resourceBatchDialogOpen}
        onOpenChange={(open) => { if (!open) closeResourceBatchDialog(); }}
        width="min(48rem, calc(100vw - 2rem))"
        title={t(
          'Add stored resources in batch',
          'Ajouter des ressources stockees en batch',
          'Gespeicherte Ressourcen gesammelt hinzufügen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeResourceBatchDialog}
              disabled={resourceBatchBusy}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleAddResourceBatch(); }}
              disabled={resourceBatchBusy || resourceBatchRows.length === 0 || sortedResources.length === 0}
            >
              {resourceBatchBusy
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Add resource entries', 'Ajouter les entrees ressource', 'Ressourceneintrage hinzufügen')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <AppAlert severity="info">
              {t(
                'Add as many resource rows as needed. SCU quantities support micro precision down to 0.000001 SCU.',
                'Ajoute autant de lignes ressource que necessaire. Les quantites en SCU acceptent une precision micro jusqu a 0.000001 SCU.',
                'Fuge so viele Ressourcenzeilen wie nötig hinzu. SCU-Mengen unterstützen eine Mikrogenauigkeit bis 0.000001 SCU.',
              )}
            </AppAlert>

            {resourceBatchError && (
              <AppAlert severity="error">
                {resourceBatchError}
              </AppAlert>
            )}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Each line creates a separate inventory entry so you can store the same resource with different quantities or qualities.',
                  'Chaque ligne cree une entree d inventaire separee pour stocker la meme ressource avec des quantites ou qualites differentes.',
                  'Jede Zeile erstellt einen eigenen Inventareintrag, damit du dieselbe Ressource mit unterschiedlichen Mengen oder Qualitaten speichern kannst.',
                )}
              </Typography>
              <Button
                variant="secondary"
                size="sm"
                icon={<AddCircleOutlineOutlinedIcon fontSize="small" />}
                onClick={addResourceBatchRow}
                disabled={resourceBatchBusy || sortedResources.length === 0}
                style={{ whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
              >
                {t('Add row', 'Ajouter une ligne', 'Zeile hinzufügen')}
              </Button>
            </Stack>

            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                borderColor: alpha(theme.palette.primary.main, 0.16),
                backgroundColor: alpha(theme.palette.background.default, 0.18),
              }}
            >
              <Table
                size="small"
                aria-label={t('Resource entries to add', 'Entrées de ressources à ajouter', 'Hinzuzufügende Ressourceneinträge')}
                sx={{ minWidth: 720 }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                      {t('Resource', 'Ressource', 'Ressource')}
                    </TableCell>
                    <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                      {t('Unit', 'Unite', 'Einheit')}
                    </TableCell>
                    <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                      {t('Quantity', 'Quantite', 'Menge')}
                    </TableCell>
                    <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                      {t('Quality (0-1000)', 'Qualite (0-1000)', 'Qualitat (0-1000)')}
                    </TableCell>
                    <TableCell component="th" scope="col" align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {t('Action', 'Action', 'Aktion')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resourceBatchRows.map((row) => {
                    const quantityUnit = resourceQuantityUnitById.get(row.resourceId) ?? 'scu';
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ minWidth: 260 }}>
                          <AppSelect
                            ariaLabel={t('Resource', 'Ressource', 'Ressource')}
                            value={row.resourceId}
                            options={sortedResources.map((resource) => ({ label: resource.name, value: resource.id }))}
                            onValueChange={(value) => { if (value) updateResourceBatchRow(row.id, { resourceId: value }); }}
                            filterable
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 110 }}>
                          <AppChip
                            size="sm"
                            outlined
                            label={
                              quantityUnit === 'count'
                                ? t('Items', 'Objets', 'Stuck')
                                : 'SCU'
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <AppTextField
                            type="number"
                            ariaLabel={t('Quantity', 'Quantite', 'Menge')}
                            value={row.quantity}
                            onValueChange={(value) =>
                              updateResourceBatchRow(row.id, { quantity: value })
                            }
                            min={quantityUnit === 'count' ? 1 : RESOURCE_BATCH_SCU_STEP}
                            step={quantityUnit === 'count' ? 1 : RESOURCE_BATCH_SCU_STEP}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <AppTextField
                            type="number"
                            ariaLabel={t('Quality', 'Qualite', 'Qualitat')}
                            value={row.quality}
                            onValueChange={(value) =>
                              updateResourceBatchRow(row.id, { quality: value })
                            }
                            placeholder="0 - 1000"
                            min={0}
                            max={1000}
                            step={1}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <AppTooltip
                            content={t(
                              'Remove this row',
                              'Supprimer cette ligne',
                              'Diese Zeile entfernen',
                            )}
                          >
                            <span>
                              <AppButton
                                variant="ghost"
                                size="sm"
                                icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                                ariaLabel={t(
                                  `Remove ${resourceById.get(row.resourceId)?.name ?? 'resource'} row`,
                                  `Supprimer la ligne ${resourceById.get(row.resourceId)?.name ?? 'ressource'}`,
                                  `Zeile ${resourceById.get(row.resourceId)?.name ?? 'Ressource'} entfernen`,
                                )}
                                onClick={() => { removeResourceBatchRow(row.id); }}
                                disabled={resourceBatchBusy}
                              >
                                {t('Remove row', 'Supprimer la ligne', 'Zeile entfernen')}
                              </AppButton>
                            </span>
                          </AppTooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
      </AppDialog>

      <AppDialog
        open={resourceBulkShareDialogOpen}
        onOpenChange={(open) => { if (!open) closeResourceBulkShareDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Share stored resources with an organization',
          'Partager des ressources stockees avec une organisation',
          'Gespeicherte Ressourcen mit einer Organisation teilen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeResourceBulkShareDialog}
              disabled={resourceBulkShareBusy}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleSaveResourceBulkShare(); }}
              disabled={resourceBulkShareBusy || linkedOrganizations.length === 0}
            >
              {resourceBulkShareBusy
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Share matching entries', 'Partager les entrees correspondantes', 'Passende Eintrage teilen')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Choose one linked organization, then target all stored resources or only one resource family. Quality filters are optional, so you can batch share ranges such as Hadanite quality 700 to 800.',
                'Choisis une organisation liee, puis cible toutes les ressources stockees ou une seule famille de ressources. Les filtres de qualite sont optionnels, ce qui permet par exemple de partager les Hadanites de qualite 700 a 800.',
                'Wahle eine verknupfte Organisation und danach entweder alle gespeicherten Ressourcen oder nur eine Ressourcenfamilie. Qualitatsfilter sind optional, sodass du zum Beispiel Hadanite mit Qualitat 700 bis 800 gesammelt teilen kannst.',
              )}
            </Typography>

            <AppSelect
              label={t('Organization', 'Organisation', 'Organisation')}
              value={resourceBulkShareDraft.organizationSid}
              options={linkedOrganizations.map((organization) => ({
                label: `${organization.name} (${organization.sid})`,
                value: organization.sid,
              }))}
              onValueChange={(value) =>
                setResourceBulkShareDraft((currentDraft) => ({
                  ...currentDraft,
                  organizationSid: value ?? '',
                }))
              }
              fieldSx={{ width: '100%' }}
            />

            <AppSelect
              label={t('Resource scope', 'Portee ressource', 'Ressourcenbereich')}
              value={resourceBulkShareDraft.resourceId}
              options={[
                { label: t('All stored resources', 'Toutes les ressources stockees', 'Alle gespeicherten Ressourcen'), value: ALL_RESOURCES_SHARE_OPTION },
                ...sortedResources.map((resource) => ({ label: resource.name, value: resource.id })),
              ]}
              onValueChange={(value) =>
                setResourceBulkShareDraft((currentDraft) => ({
                  ...currentDraft,
                  resourceId: value ?? ALL_RESOURCES_SHARE_OPTION,
                }))
              }
              fieldSx={{ width: '100%' }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <AppTextField
                type="number"
                label={t('Minimum quality', 'Qualite minimale', 'Minimale Qualitat')}
                value={resourceBulkShareDraft.minQuality}
                onValueChange={(value) =>
                  setResourceBulkShareDraft((currentDraft) => ({
                    ...currentDraft,
                    minQuality: value,
                  }))
                }
                placeholder="0"
                min={0}
                max={1000}
                step={1}
              />
              <AppTextField
                type="number"
                label={t('Maximum quality', 'Qualite maximale', 'Maximale Qualitat')}
                value={resourceBulkShareDraft.maxQuality}
                onValueChange={(value) =>
                  setResourceBulkShareDraft((currentDraft) => ({
                    ...currentDraft,
                    maxQuality: value,
                  }))
                }
                placeholder="1000"
                min={0}
                max={1000}
                step={1}
              />
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                backgroundColor: alpha(theme.palette.background.default, 0.24),
                borderColor: alpha(theme.palette.primary.main, 0.14),
              }}
            >
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <AppChip
                  size="sm"
                  label={t(
                    `${bulkResourceSharePreview.matchingEntryIds.length} matching entries`,
                    `${bulkResourceSharePreview.matchingEntryIds.length} entrees correspondantes`,
                    `${bulkResourceSharePreview.matchingEntryIds.length} passende Eintrage`,
                  )}
                />
                <AppChip
                  size="sm"
                  tone="primary"
                  outlined
                  label={t(
                    `${bulkResourceSharePreview.newEntryIds.length} new shares`,
                    `${bulkResourceSharePreview.newEntryIds.length} nouveaux partages`,
                    `${bulkResourceSharePreview.newEntryIds.length} neue Freigaben`,
                  )}
                />
              </Stack>
            </Paper>

            {resourceBulkShareError && (
              <AppAlert severity="error">
                {resourceBulkShareError}
              </AppAlert>
            )}
          </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(organizationClaimDialogTarget)}
        onOpenChange={(open) => { if (!open) closeClaimOrganizationDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Request organization claim review?',
          'Demander une revue de claim pour cette organisation ?',
          'Claim-Prüfung für diese Organisation anfordern?',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeClaimOrganizationDialog}
              disabled={Boolean(organizationActionSid)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleClaimOrganization(); }}
              disabled={Boolean(organizationActionSid)}
            >
              {organizationActionSid
                ? t('Sending...', 'Envoi...', 'Sende...')
                : t('Send review request', 'Envoyer la demande', 'Anfrage senden')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {organizationClaimDialogTarget
                ? t(
                  `A manual review request will be created for ${organizationClaimDialogTarget.name}.`,
                  `Une demande de revue manuelle sera creee pour ${organizationClaimDialogTarget.name}.`,
                  `Für ${organizationClaimDialogTarget.name} wird eine manuelle Prüfungsanfrage erstellt.`,
                )
                : t(
                  'A manual review request will be created for this organization.',
                  'Une demande de revue manuelle sera creee pour cette organisation.',
                  'Für diese Organisation wird eine manuelle Prüfungsanfrage erstellt.',
                )}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'No automatic claim will happen immediately. You will be able to continue using the app while the request is reviewed.',
                'Aucun claim automatique ne sera effectue immediatement. Tu pourras continuer a utiliser l appli pendant la revue de la demande.',
                'Es erfolgt kein sofortiger automatischer Claim. Du kannst die App während der Prüfung normal weiterverwenden.',
              )}
            </Typography>
          </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(organizationSharingDialogTarget && organizationSharingDialogState)}
        onOpenChange={(open) => { if (!open) closeOrganizationSharingDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={organizationSharingDialogState?.enabled
          ? t(
            'Enable blueprint sharing?',
            'Activer le partage de blueprints ?',
            'Blueprint-Freigabe aktivieren?',
          )
          : t(
            'Disable blueprint sharing?',
            'Desactiver le partage de blueprints ?',
            'Blueprint-Freigabe deaktivieren?',
          )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeOrganizationSharingDialog}
              disabled={Boolean(organizationActionSid)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleSetOrganizationSharing(); }}
              disabled={Boolean(organizationActionSid)}
            >
              {organizationActionSid
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : organizationSharingDialogState?.enabled
                  ? t('Enable sharing', 'Activer le partage', 'Freigabe aktivieren')
                  : t('Disable sharing', 'Desactiver le partage', 'Freigabe deaktivieren')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {organizationSharingDialogTarget
                ? organizationSharingDialogState?.enabled
                  ? t(
                    `Shared blueprints will become visible again in ${organizationSharingDialogTarget.name}.`,
                    `Les blueprints partages redeviendront visibles dans ${organizationSharingDialogTarget.name}.`,
                    `Geteilte Blueprints werden in ${organizationSharingDialogTarget.name} wieder sichtbar.`,
                  )
                  : t(
                    `Shared blueprints will stop being visible in ${organizationSharingDialogTarget.name} until you reactivate sharing.`,
                    `Les blueprints partages ne seront plus visibles dans ${organizationSharingDialogTarget.name} tant que tu ne reactives pas le partage.`,
                    `Geteilte Blueprints sind in ${organizationSharingDialogTarget.name} nicht mehr sichtbar, bis du die Freigabe wieder aktivierst.`,
                  )
                : organizationSharingDialogState?.enabled
                  ? t(
                    'Shared blueprints will become visible again in this organization.',
                    'Les blueprints partages redeviendront visibles dans cette organisation.',
                    'Geteilte Blueprints werden in dieser Organisation wieder sichtbar.',
                  )
                  : t(
                    'Shared blueprints will stop being visible in this organization until you reactivate sharing.',
                    'Les blueprints partages ne seront plus visibles dans cette organisation tant que tu ne reactives pas le partage.',
                    'Geteilte Blueprints sind in dieser Organisation nicht mehr sichtbar, bis du die Freigabe wieder aktivierst.',
                  )}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {organizationSharingDialogState?.enabled
                ? t(
                  'Existing share settings are preserved. They will be reused immediately if you enable sharing again later.',
                  'Les reglages de partage existants sont conserves. Ils seront reutilises immediatement si tu reactives le partage plus tard.',
                  'Bestehende Freigabeeinstellungen bleiben erhalten. Sie werden sofort wiederverwendet, wenn du die Freigabe später erneut aktivierst.',
                )
                : t(
                  'Reactivating sharing makes the already configured shared blueprints available again without having to reselect them.',
                  'La reactivation du partage rend a nouveau disponibles les blueprints deja configures sans avoir a les reselectionner.',
                  'Beim erneuten Aktivieren werden die bereits konfigurierten geteilten Blueprints wieder verfügbar, ohne dass du sie erneut auswählen musst.',
                )}
            </Typography>
          </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(organizationDeleteDialogTarget)}
        onOpenChange={(open) => { if (!open) closeDeleteOrganizationDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Delete organization from the app?',
          'Supprimer l organisation de l appli ?',
          'Organisation aus der App löschen?',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeDeleteOrganizationDialog}
              disabled={Boolean(organizationActionSid)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="danger"
              onClick={() => { void handleDeleteOrganization(); }}
              disabled={Boolean(organizationActionSid)}
            >
              {organizationActionSid
                ? t('Deleting...', 'Suppression...', 'Lösche...')
                : t('Delete organization', 'Supprimer l organisation', 'Organisation löschen')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {organizationDeleteDialogTarget
                ? t(
                  `This will remove ${organizationDeleteDialogTarget.name} from the app for every linked member account.`,
                  `Cela supprimera ${organizationDeleteDialogTarget.name} de l appli pour tous les comptes membres lies.`,
                  `Dadurch wird ${organizationDeleteDialogTarget.name} für alle verknüpften Mitgliedskonten aus der App entfernt.`,
                )
                : t(
                  'This will remove the organization from the app for every linked member account.',
                  'Cela supprimera l organisation de l appli pour tous les comptes membres lies.',
                  'Dadurch wird die Organisation für alle verknüpften Mitgliedskonten aus der App entfernt.',
                )}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Members will have to relink or add the organization again later if you decide to reopen it.',
                'Les membres devront relier ou ajouter a nouveau l organisation plus tard si tu decides de la rouvrir.',
                'Mitglieder müssen die Organisation später erneut verknupfen oder hinzufügen, wenn du sie wieder öffnen willst.',
              )}
            </Typography>
          </Stack>
      </AppDialog>

      <AppDialog
        open={rsiDialogOpen}
        onOpenChange={(open) => { if (!open && !rsiAction.busy) setRsiDialogOpen(false); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="img"
              src={rsiLogoOfficial}
              alt=""
              sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 0.75 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="span" sx={{ display: 'block', fontWeight: 800 }}>
                {t('Manual RSI verification', 'Verification RSI manuelle', 'Manuelle RSI-Verifizierung')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('Alternative verification method', 'Methode de verification alternative', 'Alternative Verifizierungsmethode')}
              </Typography>
            </Box>
          </Stack>
        }
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={() => setRsiDialogOpen(false)}
              disabled={rsiAction.busy}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleVerifyRsiLink(); }}
              disabled={rsiAction.busy || !rsiHandleInput.trim()}
            >
              {rsiAction.busy
                ? t('Please wait...', 'Patiente...', 'Bitte warten...')
                : rsiCode
                  ? t('Verify and link', 'Verifier et lier', 'Verifizieren und verknupfen')
                  : t('Get verification code', 'Obtenir un code', 'Verifizierungscode anfordern')}
            </Button>
          </Box>
        }
      >
          <Stack spacing={2}>
            <AppAlert severity="info">
              {t(
                'Citizen iD is not available right now.',
                'Citizen iD n est pas disponible pour le moment.',
                'Citizen iD ist derzeit nicht verfuegbar.',
              )}
            </AppAlert>

            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Enter your RSI handle to get a verification code. Paste the code into the short bio on your RSI profile, then verify within 15 minutes.',
                'Saisis ton handle RSI pour obtenir un code. Colle le code dans la short bio de ton profil RSI, puis verifie dans les 15 minutes.',
                'Gib deinen RSI-Handle ein, um einen Code zu erhalten. Fuege ihn in die Kurzbiografie deines RSI-Profils ein und verifiziere innerhalb von 15 Minuten.',
              )}
            </Typography>

            <Typography sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
              <Link
                href="https://robertsspaceindustries.com/en/account/profile"
                target="_blank"
                rel="noreferrer"
                underline="hover"
                sx={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
              >
                https://robertsspaceindustries.com/en/account/profile
              </Link>
            </Typography>

            <AppTextField
              label={t('RSI handle', 'Handle RSI', 'RSI-Handle')}
              value={rsiHandleInput}
              onValueChange={(value) => {
                setRsiHandleInput(value);
                setRsiChallenge(null);
                setRsiCopyFeedback(null);
              }}
              disabled={rsiAction.busy}
              autoFocus
            />

            {rsiChallenge && <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: alpha(theme.palette.background.default, 0.45),
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('Verification code', 'Code de verification', 'Verifizierungscode')}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: FONT_MONO,
                    fontSize: '1.25rem',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.4,
                  }}
                >
                  {rsiCode}
                </Typography>
                <Box>
                  <Button variant="ghost" onClick={() => { void handleCopyRsiCode(); }}>
                    {t('Copy code', 'Copier le code', 'Code kopieren')}
                  </Button>
                </Box>
                {rsiCopyFeedback && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {rsiCopyFeedback}
                  </Typography>
                )}
              </Stack>
            </Paper>}

            {rsiAction.error && (
              <AppAlert severity="error">
                {rsiAction.error}
              </AppAlert>
            )}
          </Stack>
      </AppDialog>
    </PageLayout>
  );
}
