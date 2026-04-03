import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { startTransition, useEffect, useMemo, useState } from 'react';
import discordSymbol from '../assets/discord-symbol.svg';
import rsiLogoOfficial from '../assets/rsi-logo-official.jpg';
import { useAuth } from '../auth/AuthContext';
import {
  computeLocalBlueprintImportPlan,
  readLocalBlueprintCollections,
} from '../auth/localAccountImport';
import { useI18n } from '../i18n/I18nContext';
import {
  getDiscordBotInviteUrl,
  type AccountInventoryResourceEntry,
} from '../services/authService';
import { useCraft } from '../store/CraftContext';
import { computeStatMaxima, formatQualityLabel, formatResourceQuantity } from '../utils/crafting';
import { navigateToPath, resourcePathFromSlug } from '../utils/slug';
import { AccountGuestView } from './account/AccountGuestView';
import { CraftRequestsPanel } from './account/CraftRequestsPanel';
import { BlueprintCard } from './BlueprintGrid';
import { ResourceAssetCard } from './resources/ResourceAssetCard';
import { Button } from './ui/Button';

function readAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('auth_error');
}

const RSI_VERIFICATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCOUNT_BLUEPRINT_BATCH_SIZE = 24;

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

function createRsiVerificationCode(length = 6): string {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => RSI_VERIFICATION_ALPHABET[value % RSI_VERIFICATION_ALPHABET.length]).join('');
}

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

function openDiscordBotInvite() {
  window.open(getDiscordBotInviteUrl(), '_blank', 'noopener,noreferrer');
}

export function AccountPage() {
  const { t, lang } = useI18n();
  const {
    enabled,
    loading,
    user,
    account,
    optimisticState,
    syncStatus,
    syncError,
    loginWithDiscord,
    logout,
    deleteAccount,
    syncAccountState,
    linkRsiAccount,
    unlinkRsiAccount,
    updateInventoryResources,
    updateOrganizationBlueprintShares,
    updateOrganizationResourceShares,
    addOrganization,
    removeOrganization,
    claimOrganization,
    deleteOrganization,
    setOrganizationBlueprintSharing,
    refreshOrganizationMembers,
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
  const authError = useMemo(() => readAuthError(), []);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<AccountAssetFilter>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [importModalDismissed, setImportModalDismissed] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [rsiDialogOpen, setRsiDialogOpen] = useState(false);
  const [rsiCode, setRsiCode] = useState('');
  const [rsiHandleInput, setRsiHandleInput] = useState('');
  const [rsiBusy, setRsiBusy] = useState(false);
  const [rsiError, setRsiError] = useState<string | null>(null);
  const [rsiCopyFeedback, setRsiCopyFeedback] = useState<string | null>(null);
  const [rsiUnlinkBusy, setRsiUnlinkBusy] = useState(false);
  const [rsiUnlinkError, setRsiUnlinkError] = useState<string | null>(null);
  const [blueprintCollectionError, setBlueprintCollectionError] = useState<string | null>(null);
  const [sharedBlueprintError, setSharedBlueprintError] = useState<string | null>(null);
  const [shareDialogBlueprintId, setShareDialogBlueprintId] = useState<string | null>(null);
  const [shareDialogSelection, setShareDialogSelection] = useState<string[]>([]);
  const [sharedBlueprintBusyId, setSharedBlueprintBusyId] = useState<string | null>(null);
  const [resourceCollectionError, setResourceCollectionError] = useState<string | null>(null);
  const [shareDialogResourceEntryId, setShareDialogResourceEntryId] = useState<string | null>(null);
  const [shareDialogResourceSelection, setShareDialogResourceSelection] = useState<string[]>([]);
  const [sharedResourceBusyId, setSharedResourceBusyId] = useState<string | null>(null);
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
  const [localCollections, setLocalCollections] = useState(() => readLocalBlueprintCollections());

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
  const canManageOrganizations = Boolean(account?.rsi?.handle);
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
    () => computeLocalBlueprintImportPlan(account, localCollections),
    [account, localCollections],
  );
  const importDialogOpen = Boolean(account && localImportPlan.hasPendingImport && !importModalDismissed);

  const obtainableBlueprintIds = useMemo(
    () => new Set((missionRewards?.blueprintAcquisitionGraph ?? []).map((entry) => entry.blueprint.id)),
    [missionRewards],
  );
  const totalObtainableBlueprintCount = obtainableBlueprintIds.size;
  const ownedBlueprintCount = inventoryCount;
  const blueprintProgress = totalObtainableBlueprintCount > 0
    ? (Math.min(ownedBlueprintCount, totalObtainableBlueprintCount) / totalObtainableBlueprintCount) * 100
    : 0;

  const favoriteIdSet = useMemo(() => new Set(favoriteSnapshotIds), [favoriteSnapshotIds]);
  const inventoryIdSet = useMemo(() => new Set(inventorySnapshotIds), [inventorySnapshotIds]);
  const statMaxima = useMemo(() => computeStatMaxima(blueprints), [blueprints]);
  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  );
  const resourceById = useMemo(
    () => new Map(activeDataset.resources.map((resource) => [resource.id, resource])),
    [activeDataset.resources],
  );
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

  useEffect(() => {
    if (!missionRewards) {
      void ensureMissionRewardsLoaded();
    }
  }, [ensureMissionRewardsLoaded, missionRewards]);

  useEffect(() => {
    setLocalCollections(readLocalBlueprintCollections());
  }, [account?.accountId, user?.id]);

  useEffect(() => {
    setImportModalDismissed(false);
    setImportError(null);
    setRsiUnlinkError(null);
    setBlueprintCollectionError(null);
    setResourceCollectionError(null);
    setSharedBlueprintError(null);
    setShareDialogBlueprintId(null);
    setShareDialogSelection([]);
    setShareDialogResourceEntryId(null);
    setShareDialogResourceSelection([]);
    setOrganizationError(null);
    setOrganizationNotice(null);
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

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to delete the account.',
            'La suppression du compte a echoue.',
            'Das Konto konnte nicht gelöscht werden.',
          ),
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleImportLocalBlueprintCollections = async () => {
    if (!account) {
      return;
    }

    setImportBusy(true);
    setImportError(null);
    try {
      const importedFavoriteIds = new Set(localImportPlan.missingFavoriteBlueprintIds);
      const importedInventoryIds = new Set(localImportPlan.missingInventoryBlueprintIds);
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

      await syncAccountState({
        favoriteBlueprintIds: nextFavoriteBlueprintIds,
        inventoryBlueprintIds: nextInventoryBlueprintIds,
        planner: account.planner,
      });
      const nextLocalCollections = {
        favoriteBlueprintIds: localImportPlan.favoriteBlueprintIds.filter(
          (blueprintId) => !importedFavoriteIds.has(blueprintId),
        ),
        inventoryBlueprintIds: localImportPlan.inventoryBlueprintIds.filter(
          (blueprintId) => !importedInventoryIds.has(blueprintId),
        ),
      };
      replaceLocalBlueprintCollections({
        favoriteBlueprintIds: nextLocalCollections.favoriteBlueprintIds,
        inventoryBlueprintIds: nextLocalCollections.inventoryBlueprintIds,
      });
      setLocalCollections(nextLocalCollections);
      setImportModalDismissed(true);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to import the local blueprint collections.',
            'L import des collections blueprint locales a echoue.',
            'Der Import der lokalen Blueprint-Sammlungen ist fehlgeschlagen.',
          ),
      );
    } finally {
      setImportBusy(false);
    }
  };

  const openRsiDialog = () => {
    blurFocusedElement();
    setRsiUnlinkError(null);
    setRsiError(null);
    setRsiCopyFeedback(null);
    setRsiHandleInput(account?.rsi?.handle ?? '');
    setRsiCode(createRsiVerificationCode());
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
    setRsiBusy(true);
    setRsiError(null);
    setRsiCopyFeedback(null);
    try {
      await linkRsiAccount(rsiHandleInput, rsiCode);
      setRsiDialogOpen(false);
    } catch (error) {
      setRsiError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to verify the RSI account.',
            'La verification du compte RSI a echoue.',
            'Die Verifizierung des RSI-Kontos ist fehlgeschlagen.',
          ),
      );
    } finally {
      setRsiBusy(false);
    }
  };

  const handleUnlinkRsiAccount = async () => {
    setRsiUnlinkBusy(true);
    setRsiUnlinkError(null);
    try {
      await unlinkRsiAccount();
    } catch (error) {
      setRsiUnlinkError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to remove the RSI account link.',
            'La suppression du lien RSI a echoue.',
            'Die RSI-Verknüpfung konnte nicht entfernt werden.',
          ),
      );
    } finally {
      setRsiUnlinkBusy(false);
    }
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

  const handleRefreshOrganization = async (sid: string) => {
    setOrganizationActionSid(sid);
    setOrganizationError(null);
    setOrganizationNotice(null);
    try {
      await refreshOrganizationMembers(sid);
    } catch (error) {
      setOrganizationError(
        error instanceof Error
          ? error.message
          : t(
            'Failed to refresh organization members.',
            'Le rafraichissement des membres de l organisation a echoue.',
            'Die Organisationsmitglieder konnten nicht aktualisiert werden.',
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
      <Box sx={{ p: { xs: 1.5, md: 3 }, flex: 1 }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ mb: 1 }}>
            {t('Account', 'Compte', 'Konto')}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {t('Loading account session...', 'Chargement de la session compte...', 'Kontositzung wird geladen...')}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
          background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
        }}
      >
        <Stack spacing={1.25}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.main', letterSpacing: '0.12em' }}
          >
            {t('Account Center', 'Centre de compte', 'Kontobereich')}
          </Typography>
          <Typography variant="h3" sx={{ lineHeight: 0.92 }}>
            {t('Account', 'Compte', 'Konto')}
          </Typography>
        </Stack>
      </Paper>

      {authError && (
        <Alert severity="error" variant="outlined">
          {t('Discord authentication failed.', 'La connexion Discord a echoue.', 'Discord-Anmeldung ist fehlgeschlagen.')} {authError}
        </Alert>
      )}

      {user ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) minmax(0, 3.5fr)' },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{
                overflow: 'hidden',
                background: `linear-gradient(150deg, ${alpha(theme.palette.secondary.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.11)} 42%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
                borderColor: alpha(theme.palette.primary.main, 0.3),
              }}
            >
              <Box
                sx={{
                  p: { xs: 2, md: 2.5 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  backgroundImage: `radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.18)}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.25}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.main', letterSpacing: '0.16em' }}
                  >
                    {t('Account identity', 'Identite compte', 'Konto-Identität')}
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                      src={user.avatarUrl ?? undefined}
                      alt={user.displayName}
                      sx={{
                        width: 80,
                        height: 80,
                        fontSize: '1.8rem',
                        border: `1px solid ${alpha(theme.palette.common.white, 0.22)}`,
                        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, 0.25)}`,
                      }}
                    >
                      {user.displayName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h4" sx={{ lineHeight: 0.92 }}>
                        {user.displayName}
                      </Typography>
                      <Typography sx={{ color: 'text.secondary', mt: 0.6 }}>
                        @{user.username}
                        {user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: alpha(theme.palette.background.paper, 0.72),
                    borderColor: alpha(theme.palette.primary.main, 0.28),
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.14em' }}
                    >
                      {t('Owned / obtainable blueprints', 'Blueprints possedes / obtenables', 'Besessene / erhältliche Blueprints')}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="baseline">
                      <Typography variant="h2" sx={{ lineHeight: 0.9 }}>
                        {missionRewards ? ownedBlueprintCount : '--'}
                      </Typography>
                      <Typography variant="h5" sx={{ color: 'text.secondary' }}>
                        / {missionRewards ? totalObtainableBlueprintCount : '--'}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={blueprintProgress}
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 999,
                        },
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
                    gap: 1,
                  }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      backgroundColor: alpha(theme.palette.background.paper, 0.68),
                      borderColor: alpha(theme.palette.primary.main, 0.18),
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {t('Inventory', 'Inventaire', 'Inventar')}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.35 }}>
                      {inventoryCount}
                    </Typography>
                  </Paper>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      backgroundColor: alpha(theme.palette.background.paper, 0.68),
                      borderColor: alpha(theme.palette.warning.main, 0.24),
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {t('Favorites', 'Favoris', 'Favoriten')}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.35 }}>
                      {favoriteCount}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Paper>

            {deleteError && (
              <Alert severity="error" variant="outlined">
                {deleteError}
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2.25}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'flex-start' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
                    >
                      {t('Organizations', 'Organisations', 'Organisationen')}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.35 }}>
                      {t('Organizations linked to your account', 'Organisations liees a ton compte', 'Mit deinem Konto verknüpfte Organisationen')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 760 }}>
                      {t(
                        'Your main RSI organization is imported automatically. Add any extra organization by SID or full URL when you need it.',
                        'Ton organisation RSI principale est importee automatiquement. Ajoute ensuite les autres organisations par SID ou lien complet seulement si tu en as besoin.',
                        'Deine Haupt-RSI-Organisation wird automatisch importiert. Weitere Organisationen kannst du bei Bedarf per SID oder vollem Link hinzufügen.',
                      )}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip
                      label={t(
                        linkedOrganizations.length === 1 ? '1 organization linked' : `${linkedOrganizations.length} organizations linked`,
                        linkedOrganizations.length === 1 ? '1 organisation liee' : `${linkedOrganizations.length} organisations liees`,
                        linkedOrganizations.length === 1 ? '1 Organisation verknüpft' : `${linkedOrganizations.length} Organisationen verknüpft`,
                      )}
                      size="small"
                      variant="outlined"
                    />
                    {canManageOrganizations && (
                      <Chip
                        label={t('RSI linked', 'RSI lie', 'RSI verknüpft')}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Stack>

                {!canManageOrganizations && (
                  <Alert severity="info" variant="outlined">
                    {t(
                      'Link an RSI account first to import and manage organizations.',
                      'Lie d abord un compte RSI pour importer et gerer les organisations.',
                      'Verknüpfe zuerst ein RSI-Konto, um Organisationen zu importieren und zu verwalten.',
                    )}
                  </Alert>
                )}

                {organizationError && (
                  <Alert severity="error" variant="outlined">
                    {organizationError}
                  </Alert>
                )}

                {organizationNotice && (
                  <Alert severity="success" variant="outlined">
                    {organizationNotice}
                  </Alert>
                )}

                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.5, md: 1.75 },
                    borderColor: alpha(theme.palette.primary.main, 0.16),
                    backgroundColor: alpha(theme.palette.background.default, 0.22),
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {t('Add an organization', 'Ajouter une organisation', 'Organisation hinzufügen')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.35 }}>
                        {t(
                          'Paste a SID such as PROTECTORA or the full RSI organization URL.',
                          'Colle un SID comme PROTECTORA ou l URL complete de l organisation RSI.',
                          'Fuge eine SID wie PROTECTORA oder die vollständige RSI-Organisations-URL ein.',
                        )}
                      </Typography>
                    </Box>

                    <Stack
                      direction={{ xs: 'column', lg: 'row' }}
                      spacing={1.25}
                      alignItems={{ xs: 'stretch', lg: 'stretch' }}
                      sx={{ width: '100%' }}
                    >
                      <TextField
                        label={t('Organization SID or URL', 'SID ou URL d organisation', 'Organisations-SID oder URL')}
                        value={organizationSidInput}
                        onChange={(event) => setOrganizationSidInput(event.target.value)}
                        placeholder="PROTECTORA"
                        fullWidth
                        size="small"
                        disabled={!canManageOrganizations || organizationAddBusy}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip
                                title={t(
                                  'Accepts either a SID like PROTECTORA or a full RSI org link such as https://robertsspaceindustries.com/en/orgs/PROTECTORA',
                                  'Accepte soit un SID comme PROTECTORA, soit un lien RSI complet comme https://robertsspaceindustries.com/en/orgs/PROTECTORA',
                                  'Akzeptiert entweder eine SID wie PROTECTORA oder einen vollständigen RSI-Link wie https://robertsspaceindustries.com/en/orgs/PROTECTORA',
                                )}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: 'text.secondary',
                                    cursor: 'help',
                                  }}
                                >
                                  <InfoOutlinedIcon fontSize="small" />
                                </Box>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => { void handleAddOrganization(); }}
                        disabled={!canManageOrganizations || organizationAddBusy || !normalizeOrganizationSidInput(organizationSidInput)}
                        style={{ whiteSpace: 'nowrap', minWidth: 176, flexShrink: 0, alignSelf: 'stretch' }}
                      >
                        {organizationAddBusy
                          ? t('Adding...', 'Ajout...', 'Füge hinzu...')
                          : t('Add organization', 'Ajouter l organisation', 'Organisation hinzufügen')}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>

                {linkedOrganizations.length === 0 ? (
                  <Box
                    sx={{
                      py: 3,
                      px: 2,
                      textAlign: 'center',
                      borderRadius: 2,
                      border: `1px dashed ${theme.palette.divider}`,
                      backgroundColor: alpha(theme.palette.background.default, 0.35),
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 0.75 }}>
                      {t('No organizations linked yet', 'Aucune organisation liee pour le moment', 'Noch keine Organisationen verknüpft')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', maxWidth: 620, mx: 'auto' }}>
                      {t(
                        'Once the RSI account is linked, the profile main organization can be imported automatically and extra organizations can be added by SID.',
                        'Une fois le compte RSI lie, l organisation principale du profil peut etre importee automatiquement et des organisations supplementaires peuvent etre ajoutees par SID.',
                        'Sobald das RSI-Konto verknüpft ist, kann die Hauptorganisation des Profils automatisch importiert werden und weitere Organisationen konnen per SID hinzugefügt werden.',
                      )}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 1.5,
                    }}
                  >
                    {linkedOrganizations.map((organization) => {
                      const nextEligibleLabel = formatAbsoluteDate(organization.nextEligibleLiveSyncAt);
                      const lastSyncLabel = formatAbsoluteDate(organization.lastLiveSyncAt);
                      const lastVerifiedLabel = formatAbsoluteDate(organization.lastVerifiedAt);
                      const claimRequestSubmittedLabel = formatAbsoluteDate(organization.claimRequestSubmittedAt);
                      const refreshLocked = Boolean(
                        organization.nextEligibleLiveSyncAt &&
                        Date.parse(organization.nextEligibleLiveSyncAt) > Date.now(),
                      );
                      const organizationImage = organization.image ?? organization.logo ?? undefined;
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
                          `Last live member sync: ${lastSyncLabel}`,
                          `Derniere synchro live des membres : ${lastSyncLabel}`,
                          `Letzte Live-Mitgliedersynchronisierung: ${lastSyncLabel}`,
                        )
                        : t(
                          'No live member snapshot stored yet',
                          'Aucun snapshot live des membres n est encore stocke',
                          'Es ist noch kein Live-Mitgliedersnapshot gespeichert',
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
                                    {organization.url ? (
                                      <Link href={organization.url} target="_blank" rel="noreferrer" underline="hover" color="inherit">
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
                                  <Chip label={organizationSourceLabel} size="small" variant="outlined" />
                                  <Chip
                                    label={organizationStatusLabel}
                                    size="small"
                                    color={
                                      organization.status === 'verified_admin'
                                        ? 'success'
                                        : organization.status === 'verified_member'
                                          ? 'info'
                                          : 'default'
                                    }
                                    variant={organization.status === 'observed' ? 'outlined' : 'filled'}
                                  />
                                  {organization.claimedByCurrentUser && (
                                    <Chip
                                      label={t('Claimed by you', 'Claim par toi', 'Von dir beansprucht')}
                                      size="small"
                                      color="secondary"
                                      variant="outlined"
                                    />
                                  )}
                                  {hasPendingClaimRequest && (
                                    <Chip
                                      label={t('Review pending', 'Revue en attente', 'Prüfung ausstehend')}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
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
                                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
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
                                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    {t('Stars', 'Etoiles', 'Sterne')}
                                  </Typography>
                                  {typeof organization.stars === 'number' ? (
                                    <Stack spacing={0.45} sx={{ mt: 0.5 }}>
                                      <Rating
                                        name={`organization-stars-${organization.sid}`}
                                        value={Math.max(0, Math.min(5, organization.stars))}
                                        max={5}
                                        size="small"
                                        readOnly
                                        getLabelText={(value) => t(
                                          `${value} stars`,
                                          `${value} etoiles`,
                                          `${value} Sterne`,
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
                                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
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
                                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    {t('Member snapshot', 'Snapshot membres', 'Mitgliedersnapshot')}
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
                                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    {t('Verified role', 'Role verifie', 'Verifizierte Rolle')}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 0.55, color: 'text.secondary' }}>
                                    {lastVerificationSummary}
                                  </Typography>
                                </Box>
                              </Box>

                              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                {organization.syncStatus === 'stale' && (
                                  <Chip
                                    label={t('Snapshot stale', 'Snapshot obsolete', 'Snapshot veraltet')}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                  />
                                )}
                                {refreshLocked && nextEligibleLabel && organization.status === 'verified_admin' && (
                                  <Chip
                                    label={t(
                                      `Refresh after ${nextEligibleLabel}`,
                                      `Refresh apres ${nextEligibleLabel}`,
                                      `Refresh nach ${nextEligibleLabel}`,
                                    )}
                                    size="small"
                                    variant="outlined"
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
                                  <Tooltip
                                    title={t(
                                      'Invite the ItemFab Discord bot with the minimum scopes: bot and applications.commands. No guild permissions are requested.',
                                      'Inviter le bot Discord ItemFab avec les scopes minimums : bot et applications.commands. Aucune permission de serveur n est demandee.',
                                      'Lade den ItemFab-Discord-Bot mit den minimalen Scopes bot und applications.commands ein. Es werden keine Server-Berechtigungen angefordert.',
                                    )}
                                    arrow
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
                                  </Tooltip>
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

                                {organization.claimed && organization.status === 'verified_admin' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={organizationActionSid === organization.sid || refreshLocked}
                                    onClick={() => { void handleRefreshOrganization(organization.sid); }}
                                  >
                                    {organizationActionSid === organization.sid
                                      ? t('Refreshing...', 'Rafraichissement...', 'Aktualisiere...')
                                      : t('Refresh members', 'Rafraichir les membres', 'Mitglieder aktualisieren')}
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

                              {refreshLocked && nextEligibleLabel && organization.status === 'verified_admin' && (
                                <Typography sx={{ color: 'text.secondary' }}>
                                  {t(
                                    `Next live refresh available after ${nextEligibleLabel}.`,
                                    `Prochain refresh live disponible apres ${nextEligibleLabel}.`,
                                    `Der nächste Live-Refresh ist nach ${nextEligibleLabel} verfügbar.`,
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
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.14em' }}
                  >
                    {t('Account actions', 'Actions du compte', 'Konto-Aktionen')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {t('Session and deletion', 'Session et suppression', 'Sitzung und Löschung')}
                  </Typography>
                </Box>

                {!account?.rsi?.handle && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={openRsiDialog}
                    icon={(
                      <Box
                        component="img"
                        src={rsiLogoOfficial}
                        alt=""
                        sx={{
                          width: 18,
                          height: 18,
                          objectFit: 'contain',
                          borderRadius: 0.5,
                        }}
                      />
                    )}
                  >
                    {t('Link RSI account', 'Lier le compte RSI', 'RSI-Konto verknupfen')}
                  </Button>
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
                      disabled={rsiUnlinkBusy}
                    >
                      {rsiUnlinkBusy
                        ? t('Removing...', 'Suppression...', 'Entferne...')
                        : t('Remove link', 'Supprimer le lien', 'Verknüpfung entfernen')}
                    </Button>
                  </Stack>
                )}

                {rsiUnlinkError && (
                  <Alert severity="error" variant="outlined">
                    {rsiUnlinkError}
                  </Alert>
                )}

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => { void logout(); }}
                >
                  {t('Log out', 'Se deconnecter', 'Abmelden')}
                </Button>

                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => { void handleDeleteAccount(); }}
                  disabled={deleteBusy}
                >
                  {deleteBusy
                    ? t('Deleting account...', 'Suppression du compte...', 'Konto wird gelöscht...')
                    : t('Delete account', 'Supprimer le compte', 'Konto löschen')}
                </Button>

                <Typography sx={{ color: 'text.secondary' }}>
                  {t(
                    'This removes the cloud profile, favorites, inventory snapshot and planner snapshot, then clears the current session.',
                    'Cela supprime le profil cloud, les favoris, le snapshot inventaire et le snapshot planner, puis efface la session courante.',
                    'Dadurch werden Cloud-Profil, Favoriten, Inventar-Snapshot und Planner-Snapshot entfernt und die aktuelle Sitzung geleert.',
                  )}
                </Typography>
              </Stack>
            </Paper>
          </Stack>

          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
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
                      sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
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
                    <TextField
                      size="small"
                      label={t('Search assets', 'Rechercher des actifs', 'Assets suchen')}
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      sx={{ minWidth: { xs: '100%', sm: 240 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchOutlinedIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      select
                      size="small"
                      label={t('Filter', 'Filtre', 'Filter')}
                      value={assetFilter}
                      onChange={(event) => setAssetFilter(event.target.value as AccountAssetFilter)}
                      sx={{ minWidth: { xs: '100%', sm: 220 } }}
                    >
                      <MenuItem value="all">
                        {t('All assets', 'Tous les actifs', 'Alle Assets')}
                      </MenuItem>
                      <MenuItem value="inventory-blueprints">
                        {t('Inventory blueprints', 'Blueprints inventaire', 'Inventar-Blueprints')}
                      </MenuItem>
                      <MenuItem value="favorite-blueprints">
                        {t('Favorite blueprints', 'Blueprints favoris', 'Favoriten-Blueprints')}
                      </MenuItem>
                      <MenuItem value="resources">
                        {t('Stored resources', 'Ressources stockees', 'Gespeicherte Ressourcen')}
                      </MenuItem>
                    </TextField>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  <Chip
                    label={t(
                      `${filteredAssetEntries.length} visible entries`,
                      `${filteredAssetEntries.length} entrees visibles`,
                      `${filteredAssetEntries.length} sichtbare Eintrage`,
                    )}
                    size="small"
                  />
                  <Chip
                    label={t(
                      `${filteredBlueprintEntryCount} blueprints`,
                      `${filteredBlueprintEntryCount} blueprints`,
                      `${filteredBlueprintEntryCount} Blueprints`,
                    )}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={t(
                      `${filteredResourceEntryCount} resources`,
                      `${filteredResourceEntryCount} ressources`,
                      `${filteredResourceEntryCount} Ressourcen`,
                    )}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={t(
                      `${sharedBlueprintIdSet.size + sharedResourceEntryIdSet.size} shared entries`,
                      `${sharedBlueprintIdSet.size + sharedResourceEntryIdSet.size} entrees partagees`,
                      `${sharedBlueprintIdSet.size + sharedResourceEntryIdSet.size} geteilte Eintrage`,
                    )}
                    size="small"
                    variant="outlined"
                  />
                  {hiddenBlueprintCount > 0 && (
                    <Chip
                      label={t(
                        `${hiddenBlueprintCount} unavailable blueprints`,
                        `${hiddenBlueprintCount} blueprints indisponibles`,
                        `${hiddenBlueprintCount} nicht verfugbare Blueprints`,
                      )}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>

                {(blueprintCollectionError || sharedBlueprintError || resourceCollectionError) && (
                  <Alert severity="error" variant="outlined">
                    {blueprintCollectionError ?? sharedBlueprintError ?? resourceCollectionError}
                  </Alert>
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
                            'Use Add to inventory on any resource card, then choose which linked organizations can access each stored entry.',
                            'Utilise Ajouter a l inventaire sur une carte ressource, puis choisis quelles organisations liees peuvent acceder a chaque entree stockee.',
                            'Nutze Auf beliebiger Ressourcenkarte Zum Inventar hinzufugen und wähle danach, welche verknüpften Organisationen auf jeden gespeicherten Eintrag zugreifen konnen.',
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
                        md: 'repeat(2, minmax(0, 1fr))',
                        xl: 'repeat(3, minmax(0, 1fr))',
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
                            activeBlueprintId={activeBlueprint?.id ?? null}
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
                            statMaxima={statMaxima}
                            resources={activeDataset.resources}
                            priority={index < 8}
                            onSelect={(blueprint) => startTransition(() => setActiveBlueprint(blueprint))}
                            onToggleFavorite={handleToggleFavoriteBlueprint}
                            onToggleInventory={handleToggleInventoryBlueprint}
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
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                gap: 0.8,
                              }}
                            >
                              <Button
                                variant={entry.isShared ? 'secondary' : 'ghost'}
                                size="sm"
                                icon={entry.isShared ? <GroupsIcon fontSize="small" /> : <GroupsOutlinedIcon fontSize="small" />}
                                onClick={() => { openShareResourceDialog(entry.resourceEntry.id); }}
                                disabled={linkedOrganizations.length === 0 || sharedResourceBusyId === entry.resourceEntry.id}
                                style={{ width: '100%' }}
                              >
                                {entry.isShared
                                  ? t('Org sharing', 'Partage org', 'Org-Freigabe')
                                  : t('Share', 'Partage', 'Teilen')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                                onClick={() => { void handleRemoveResourceEntry(entry.resourceEntry.id); }}
                                disabled={sharedResourceBusyId === entry.resourceEntry.id}
                                style={{ width: '100%' }}
                              >
                                {t('Remove', 'Retirer', 'Entfernen')}
                              </Button>
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
          </Stack>
        </Box>
      ) : (
        <AccountGuestView
          enabled={enabled}
          onLogin={() => { loginWithDiscord('/account'); }}
          onInviteBot={openDiscordBotInvite}
        />
      )}

      {account && (
        <Dialog
          open={importDialogOpen}
          onClose={importBusy ? undefined : () => setImportModalDismissed(true)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {t(
              'Import local blueprint collections?',
              'Importer les collections blueprint locales ?',
              'Lokale Blueprint-Sammlungen importieren?',
            )}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Blueprints were found in local storage after login. They are not all present in the cloud account yet.',
                  'Des blueprints ont ete trouves dans le local storage apres connexion. Ils ne sont pas encore tous presents dans le compte cloud.',
                  'Nach der Anmeldung wurden Blueprints im lokalen Speicher gefunden. Sie sind noch nicht alle im Cloud-Konto vorhanden.',
                )}
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1,
                }}
              >
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {t('Inventory to import', 'Inventaire a importer', 'Zu importierendes Inventar')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {localImportPlan.missingInventoryBlueprintIds.length}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {t('Favorites to import', 'Favoris a importer', 'Zu importierende Favoriten')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {localImportPlan.missingFavoriteBlueprintIds.length}
                  </Typography>
                </Paper>
              </Box>

              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Accepting merges these blueprint collections into the cloud account, then clears the imported local collections.',
                  'Accepter fusionne ces collections blueprint dans le compte cloud, puis vide les collections locales importees.',
                  'Beim Bestatigen werden diese Blueprint-Sammlungen in das Cloud-Konto ubernommen und die importierten lokalen Sammlungen geleert.',
                )}
              </Typography>

              {importError && (
                <Alert severity="error" variant="outlined">
                  {importError}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              variant="ghost"
              onClick={() => setImportModalDismissed(true)}
              disabled={importBusy}
            >
              {t('Not now', 'Plus tard', 'Nicht jetzt')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void handleImportLocalBlueprintCollections(); }}
              disabled={importBusy}
            >
              {importBusy
                ? t('Importing...', 'Import en cours...', 'Importiere...')
                : t('Import into account', 'Importer dans le compte', 'In Konto importieren')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog
        open={Boolean(shareDialogBlueprint)}
        onClose={closeShareBlueprintDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            'Share blueprint with organizations',
            'Partager le blueprint avec des organisations',
            'Blueprint mit Organisationen teilen',
          )}
        </DialogTitle>
        <DialogContent dividers>
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
              <Alert severity="info" variant="outlined">
                {t(
                  'Link at least one organization on this account before sharing blueprints.',
                  'Lie au moins une organisation a ce compte avant de partager des blueprints.',
                  'Verknüpfe mindestens eine Organisation mit diesem Konto, bevor du Blueprints teilst.',
                )}
              </Alert>
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
                        <Checkbox
                          checked={checked}
                          onChange={() =>
                            setShareDialogSelection((currentSelection) =>
                              checked
                                ? currentSelection.filter((sid) => sid !== organization.sid)
                                : [...currentSelection, organization.sid],
                            )
                          }
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700 }}>
                            {organization.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {organization.sid}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            organization.status === 'verified_admin'
                              ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                              : organization.status === 'verified_member'
                                ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                                : t('Linked only', 'Simplement liee', 'Nur verknüpft')
                          }
                          color={
                            organization.status === 'verified_admin'
                              ? 'success'
                              : organization.status === 'verified_member'
                                ? 'info'
                                : 'default'
                          }
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            {sharedBlueprintError && (
              <Alert severity="error" variant="outlined">
                {sharedBlueprintError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
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
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(shareDialogResourceEntry)}
        onClose={closeShareResourceDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            'Share resource entry with organizations',
            'Partager l entree ressource avec des organisations',
            'Ressourceneintrag mit Organisationen teilen',
          )}
        </DialogTitle>
        <DialogContent dividers>
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
              <Alert severity="info" variant="outlined">
                {t(
                  'Link at least one organization on this account before sharing stored resources.',
                  'Lie au moins une organisation a ce compte avant de partager des ressources stockees.',
                  'Verknupfe mindestens eine Organisation mit diesem Konto, bevor du gespeicherte Ressourcen teilst.',
                )}
              </Alert>
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
                        <Checkbox
                          checked={checked}
                          onChange={() =>
                            setShareDialogResourceSelection((currentSelection) =>
                              checked
                                ? currentSelection.filter((sid) => sid !== organization.sid)
                                : [...currentSelection, organization.sid],
                            )
                          }
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700 }}>
                            {organization.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {organization.sid}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            organization.status === 'verified_admin'
                              ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                              : organization.status === 'verified_member'
                                ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                                : t('Linked only', 'Simplement liee', 'Nur verknupft')
                          }
                          color={
                            organization.status === 'verified_admin'
                              ? 'success'
                              : organization.status === 'verified_member'
                                ? 'info'
                                : 'default'
                          }
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            {resourceCollectionError && (
              <Alert severity="error" variant="outlined">
                {resourceCollectionError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
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
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(organizationClaimDialogTarget)}
        onClose={closeClaimOrganizationDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            'Request organization claim review?',
            'Demander une revue de claim pour cette organisation ?',
            'Claim-Prüfung für diese Organisation anfordern?',
          )}
        </DialogTitle>
        <DialogContent dividers>
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
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
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
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(organizationSharingDialogTarget && organizationSharingDialogState)}
        onClose={closeOrganizationSharingDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {organizationSharingDialogState?.enabled
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
        </DialogTitle>
        <DialogContent dividers>
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
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
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
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(organizationDeleteDialogTarget)}
        onClose={closeDeleteOrganizationDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            'Delete organization from the app?',
            'Supprimer l organisation de l appli ?',
            'Organisation aus der App löschen?',
          )}
        </DialogTitle>
        <DialogContent dividers>
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
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="ghost"
            onClick={closeDeleteOrganizationDialog}
            disabled={Boolean(organizationActionSid)}
          >
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => { void handleDeleteOrganization(); }}
            disabled={Boolean(organizationActionSid)}
          >
            {organizationActionSid
              ? t('Deleting...', 'Suppression...', 'Lösche...')
              : t('Delete organization', 'Supprimer l organisation', 'Organisation löschen')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rsiDialogOpen}
        onClose={rsiBusy ? undefined : () => setRsiDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('Link RSI account', 'Lier le compte RSI', 'RSI-Konto verknupfen')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Copy the verification code, paste it into the short bio on your RSI profile, then enter your RSI handle below.',
                'Copie le code de verification, colle-le dans la short bio de ton profil RSI, puis saisis ton handle RSI ci-dessous.',
                'Kopiere den Verifizierungscode, füg ihn in die Kurzbiografie deines RSI-Profils ein und gib danach unten deinen RSI-Handle ein.',
              )}
            </Typography>

            <Typography sx={{ color: 'text.secondary' }}>
              <Link
                href="https://robertsspaceindustries.com/en/account/profile"
                target="_blank"
                rel="noreferrer"
                underline="hover"
              >
                https://robertsspaceindustries.com/en/account/profile
              </Link>
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: alpha(theme.palette.background.default, 0.45),
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {t('Verification code', 'Code de verification', 'Verifizierungscode')}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: "'Share Tech Mono', monospace",
                    letterSpacing: '0.16em',
                    lineHeight: 1,
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
            </Paper>

            <TextField
              label={t('RSI handle', 'Handle RSI', 'RSI-Handle')}
              value={rsiHandleInput}
              onChange={(event) => setRsiHandleInput(event.target.value)}
              fullWidth
              size="small"
              autoFocus
            />

            {rsiError && (
              <Alert severity="error" variant="outlined">
                {rsiError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="ghost"
            onClick={() => setRsiDialogOpen(false)}
            disabled={rsiBusy}
          >
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => { void handleVerifyRsiLink(); }}
            disabled={rsiBusy || !rsiHandleInput.trim() || !rsiCode}
          >
            {rsiBusy
              ? t('Verifying...', 'Verification...', 'Verifiziere...')
              : t('Verify and link', 'Verifier et lier', 'Verifizieren und verknupfen')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
