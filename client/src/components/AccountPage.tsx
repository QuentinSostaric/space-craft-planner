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
import Paper from '@mui/material/Paper';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { startTransition, useEffect, useMemo, useState } from 'react';
import accountScreenOne from '../assets/account_1.png';
import accountScreenTwo from '../assets/account_2.png';
import rsiLogoOfficial from '../assets/rsi-logo-official.jpg';
import { useAuth } from '../auth/AuthContext';
import {
  computeLocalBlueprintImportPlan,
  readLocalBlueprintCollections,
} from '../auth/localAccountImport';
import { useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';
import { computeStatMaxima } from '../utils/crafting';
import { BlueprintCard } from './BlueprintGrid';
import { Button } from './ui/Button';

function readAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('auth_error');
}

const RSI_VERIFICATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCOUNT_BLUEPRINT_BATCH_SIZE = 24;

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

export function AccountPage() {
  const { t } = useI18n();
  const {
    enabled,
    loading,
    user,
    account,
    loginWithDiscord,
    logout,
    deleteAccount,
    syncAccountState,
    linkRsiAccount,
    unlinkRsiAccount,
    updateOrganizationBlueprintShares,
    addOrganization,
    removeOrganization,
    claimOrganization,
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
  const [libraryMode, setLibraryMode] = useState<'inventory' | 'favorites'>('inventory');
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
  const [organizationSidInput, setOrganizationSidInput] = useState('');
  const [organizationAddBusy, setOrganizationAddBusy] = useState(false);
  const [organizationActionSid, setOrganizationActionSid] = useState<string | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [organizationClaimDialogSid, setOrganizationClaimDialogSid] = useState<string | null>(null);
  const [craftRequestActionId, setCraftRequestActionId] = useState<string | null>(null);
  const [craftRequestError, setCraftRequestError] = useState<string | null>(null);
  const [craftRequestNotice, setCraftRequestNotice] = useState<string | null>(null);
  const [visibleBlueprintCount, setVisibleBlueprintCount] = useState(ACCOUNT_BLUEPRINT_BATCH_SIZE);
  const [localCollections, setLocalCollections] = useState(() => readLocalBlueprintCollections());

  const favoriteSnapshotIds = account?.favoriteBlueprintIds ?? favoriteIds;
  const inventorySnapshotIds = account?.inventoryBlueprintIds ?? inventoryIds;
  const organizationBlueprintShares = account?.organizationBlueprintShares ?? {};
  const sharedBlueprintIdSet = useMemo(
    () => new Set(account?.sharedBlueprintIds ?? []),
    [account?.sharedBlueprintIds],
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
  const linkedOrganizations = account?.organizations ?? [];
  const incomingCraftRequests = account?.incomingCraftRequests ?? [];
  const outgoingCraftRequests = account?.outgoingCraftRequests ?? [];
  const favoriteCount = favoriteSnapshotIds.length;
  const inventoryCount = inventorySnapshotIds.length;
  const canManageOrganizations = Boolean(account?.rsi?.handle);
  const organizationClaimDialogTarget = linkedOrganizations.find(
    (organization) => organization.sid === organizationClaimDialogSid,
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
  const pendingIncomingCraftRequests = useMemo(
    () => incomingCraftRequests.filter((request) => request.status === 'pending'),
    [incomingCraftRequests],
  );
  const recentOutgoingCraftRequests = useMemo(
    () => outgoingCraftRequests.slice(0, 3),
    [outgoingCraftRequests],
  );
  const accountPreviewCards: Array<{
    title: string;
    body: string;
    image: string | null;
    alt: string | null;
  }> = [
    {
      title: t('Cloud blueprint library', 'Bibliotheque blueprint cloud', 'Cloud-Blueprint-Bibliothek'),
      body: t(
        'Show synced inventory and favorites from the account page.',
        'Montre l inventaire et les favoris synchronises depuis la page compte.',
        'Zeigt das synchronisierte Inventar und die Favoriten auf der Kontoseite.',
      ),
      image: accountScreenOne,
      alt: t(
        'Account page blueprint library screenshot',
        'Screenshot de la bibliotheque blueprint du compte',
        'Screenshot der Konto-Blueprint-Bibliothek',
      ),
    },
    {
      title: t('Organization sharing', 'Partage d organisation', 'Organisationsfreigabe'),
      body: t(
        'Show the moment a blueprint is shared to one or several linked organizations.',
        'Montre le moment ou un blueprint est partage a une ou plusieurs organisations liees.',
        'Zeigt den Moment, in dem ein Blueprint an eine oder mehrere verknupfte Organisationen geteilt wird.',
      ),
      image: accountScreenTwo,
      alt: t(
        'Organization sharing screenshot',
        'Screenshot du partage d organisation',
        'Screenshot der Organisationsfreigabe',
      ),
    },
    {
      title: t('Craft request inbox', 'Boite de demandes de craft', 'Craft-Anfrageeingang'),
      body: t(
        'Show pending craft requests, answer them, and close completed conversations from the account page.',
        'Montre les demandes de craft en attente, permet d y repondre et de clore les conversations terminees depuis la page compte.',
        'Zeigt ausstehende Craft-Anfragen, erlaubt Antworten und das Schliessen abgeschlossener Unterhaltungen auf der Kontoseite.',
      ),
      image: null,
      alt: null,
    },
  ];

  const displayedIds = libraryMode === 'inventory' ? inventorySnapshotIds : favoriteSnapshotIds;
  const displayedBlueprints = useMemo(
    () => displayedIds
      .map((blueprintId) => blueprintById.get(blueprintId) ?? null)
      .filter((blueprint): blueprint is (typeof blueprints)[number] => blueprint !== null),
    [blueprintById, displayedIds],
  );
  const visibleDisplayedBlueprints = useMemo(
    () => displayedBlueprints.slice(0, visibleBlueprintCount),
    [displayedBlueprints, visibleBlueprintCount],
  );
  const hiddenBlueprintCount = displayedIds.length - displayedBlueprints.length;
  const shareDialogBlueprint = shareDialogBlueprintId
    ? blueprintById.get(shareDialogBlueprintId) ?? null
    : null;

  const activeCollectionLabel = libraryMode === 'inventory'
    ? t('Account inventory', 'Inventaire du compte', 'Konto-Inventar')
    : t('Favorite blueprints', 'Blueprints favoris', 'Favorisierte Blueprints');
  const activeCollectionEmptyLabel = libraryMode === 'inventory'
    ? t(
      'No blueprints are stored in the account inventory yet.',
      'Aucun blueprint n est encore stocke dans l inventaire du compte.',
      'Es sind noch keine Blueprints im Konto-Inventar gespeichert.',
    )
    : t(
      'No favorite blueprints are stored yet.',
      'Aucun blueprint favori n est encore stocke.',
      'Es sind noch keine favorisierten Blueprints gespeichert.',
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
    setSharedBlueprintError(null);
    setShareDialogBlueprintId(null);
    setShareDialogSelection([]);
    setOrganizationError(null);
    setOrganizationNotice(null);
    setOrganizationSidInput('');
    setOrganizationClaimDialogSid(null);
    setCraftRequestActionId(null);
    setCraftRequestError(null);
    setCraftRequestNotice(null);
  }, [account?.accountId, user?.id]);

  useEffect(() => {
    setVisibleBlueprintCount(ACCOUNT_BLUEPRINT_BATCH_SIZE);
  }, [libraryMode, account?.accountId, displayedBlueprints.length]);

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
        'Soll dein Cloud-Konto mit den Discord-gebundenen Daten dauerhaft geloescht werden? Du wirst dabei auch abgemeldet.',
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
            'Das Konto konnte nicht geloescht werden.',
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
            'Die RSI-Verknupfung konnte nicht entfernt werden.',
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
          'Diese Organisation ist bereits mit deinem Konto verknupft.',
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
            'Die Organisation konnte nicht hinzugefugt werden.',
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
          'Deine Organisationsanfrage wurde zur manuellen Prufung gesendet.',
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

  const handleRespondToCraftRequest = async (
    requestId: string,
    decision: 'accepted' | 'denied' | 'closed',
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
    <Box sx={{ p: { xs: 1.5, md: 3 }, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
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

      {!enabled ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h5">
              {t('Authentication unavailable', 'Authentification indisponible', 'Authentifizierung nicht verfugbar')}
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 720 }}>
              {t(
                'Discord OAuth is not configured in the current environment yet.',
                'Le OAuth Discord n est pas encore configure dans cet environnement.',
                'Discord OAuth ist in dieser Umgebung noch nicht konfiguriert.',
              )}
            </Typography>
          </Stack>
        </Paper>
      ) : user ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(280px, 1fr) minmax(0, 4fr)' },
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
                    {t('Account identity', 'Identite compte', 'Konto-Identitat')}
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
                      {t('Owned / obtainable blueprints', 'Blueprints possedes / obtenables', 'Besessene / erhaltliche Blueprints')}
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
                          'Blueprints aus dem Konto-Inventar im Verhaltnis zum gesamten erhaltlichen Katalog.',
                        )
                        : t(
                          'Mission catalog is syncing for the obtainable total.',
                          'Le catalogue mission se synchronise pour calculer le total obtenable.',
                          'Der Missionskatalog wird fur die erreichbare Gesamtzahl synchronisiert.',
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
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
                    >
                      {t('Organizations', 'Organisations', 'Organisationen')}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.35 }}>
                      {t('Organizations linked to your account', 'Organisations liees a ton compte', 'Mit deinem Konto verknupfte Organisationen')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 760 }}>
                      {t(
                        'Your main RSI organization is imported automatically. Add any extra organization by SID or full URL when you need it.',
                        'Ton organisation RSI principale est importee automatiquement. Ajoute ensuite les autres organisations par SID ou lien complet seulement si tu en as besoin.',
                        'Deine Haupt-RSI-Organisation wird automatisch importiert. Weitere Organisationen kannst du bei Bedarf per SID oder vollem Link hinzufugen.',
                      )}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip
                      label={t(
                        linkedOrganizations.length === 1 ? '1 organization linked' : `${linkedOrganizations.length} organizations linked`,
                        linkedOrganizations.length === 1 ? '1 organisation liee' : `${linkedOrganizations.length} organisations liees`,
                        linkedOrganizations.length === 1 ? '1 Organisation verknupft' : `${linkedOrganizations.length} Organisationen verknupft`,
                      )}
                      size="small"
                      variant="outlined"
                    />
                    {canManageOrganizations && (
                      <Chip
                        label={t('RSI linked', 'RSI lie', 'RSI verknupft')}
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
                      'Verknupfe zuerst ein RSI-Konto, um Organisationen zu importieren und zu verwalten.',
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
                        {t('Add an organization', 'Ajouter une organisation', 'Organisation hinzufugen')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.35 }}>
                        {t(
                          'Paste a SID such as PROTECTORA or the full RSI organization URL.',
                          'Colle un SID comme PROTECTORA ou l URL complete de l organisation RSI.',
                          'Fuge eine SID wie PROTECTORA oder die vollstandige RSI-Organisations-URL ein.',
                        )}
                      </Typography>
                    </Box>

                    <Stack
                      direction={{ xs: 'column', xl: 'row' }}
                      spacing={1.25}
                      alignItems={{ xs: 'stretch', xl: 'stretch' }}
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
                                  'Akzeptiert entweder eine SID wie PROTECTORA oder einen vollstandigen RSI-Link wie https://robertsspaceindustries.com/en/orgs/PROTECTORA',
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
                          ? t('Adding...', 'Ajout...', 'Fuege hinzu...')
                          : t('Add organization', 'Ajouter l organisation', 'Organisation hinzufugen')}
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
                      {t('No organizations linked yet', 'Aucune organisation liee pour le moment', 'Noch keine Organisationen verknupft')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', maxWidth: 620, mx: 'auto' }}>
                      {t(
                        'Once the RSI account is linked, the profile main organization can be imported automatically and extra organizations can be added by SID.',
                        'Une fois le compte RSI lie, l organisation principale du profil peut etre importee automatiquement et des organisations supplementaires peuvent etre ajoutees par SID.',
                        'Sobald das RSI-Konto verknupft ist, kann die Hauptorganisation des Profils automatisch importiert werden und weitere Organisationen konnen per SID hinzugefugt werden.',
                      )}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: linkedOrganizations.length > 1
                        ? { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }
                        : '1fr',
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
                          ? t('Profile main', 'Profil principal', 'Profil-Hauptorg')
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
                                  {organization.claimed && (
                                    <Chip
                                      label={
                                        organization.claimedByCurrentUser
                                          ? t('Claimed by you', 'Claim par toi', 'Von dir beansprucht')
                                          : t('Claimed on app', 'Claim sur l appli', 'In der App beansprucht')
                                      }
                                      size="small"
                                      color="secondary"
                                      variant="outlined"
                                    />
                                  )}
                                  {hasPendingClaimRequest && (
                                    <Chip
                                      label={t('Review pending', 'Revue en attente', 'Prufung ausstehend')}
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
                                {organization.archetype && (
                                  <Chip label={organization.archetype} size="small" variant="outlined" />
                                )}
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
                                      : t('Request claim review', 'Demander une revue de claim', 'Claim-Prufung anfordern')}
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
                              </Stack>

                              {hasPendingClaimRequest && (
                                <Typography sx={{ color: 'text.secondary' }}>
                                  {claimRequestSubmittedLabel
                                    ? t(
                                      `A manual claim review was requested on ${claimRequestSubmittedLabel}.`,
                                      `Une revue manuelle du claim a ete demandee le ${claimRequestSubmittedLabel}.`,
                                      `Eine manuelle Claim-Prufung wurde am ${claimRequestSubmittedLabel} angefordert.`,
                                    )
                                    : t(
                                      'A manual claim review is pending for this organization.',
                                      'Une revue manuelle du claim est en attente pour cette organisation.',
                                      'Fur diese Organisation wartet eine manuelle Claim-Prufung.',
                                    )}
                                </Typography>
                              )}

                              {organization.claimed && organization.status !== 'verified_admin' && (
                                <Typography sx={{ color: 'text.secondary' }}>
                                  {t(
                                    'Member snapshots are available, but only owners can administer this organization in the app.',
                                    'Des snapshots de membres sont disponibles, mais seuls les proprietaires peuvent administrer cette organisation dans l appli.',
                                    'Mitgliedersnapshots sind verfugbar, aber nur Besitzer konnen diese Organisation in der App verwalten.',
                                  )}
                                </Typography>
                              )}

                              {refreshLocked && nextEligibleLabel && organization.status === 'verified_admin' && (
                                <Typography sx={{ color: 'text.secondary' }}>
                                  {t(
                                    `Next live refresh available after ${nextEligibleLabel}.`,
                                    `Prochain refresh live disponible apres ${nextEligibleLabel}.`,
                                    `Der nachste Live-Refresh ist nach ${nextEligibleLabel} verfugbar.`,
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
                    {t('Session and deletion', 'Session et suppression', 'Sitzung und Loschung')}
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
                        `Verknupfter RSI-Handle: ${account.rsi.handle}`,
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
                        : t('Remove link', 'Supprimer le lien', 'Verknupfung entfernen')}
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
                    ? t('Deleting account...', 'Suppression du compte...', 'Konto wird geloescht...')
                    : t('Delete account', 'Supprimer le compte', 'Konto loeschen')}
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
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', lg: 'center' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
                  >
                    {t('Blueprints', 'Blueprints', 'Blueprints')}
                  </Typography>
                  <Typography variant="h4" sx={{ lineHeight: 0.95 }}>
                    {activeCollectionLabel}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 720 }}>
                    {t(
                      'Switch between the account inventory and favorites. Inventory blueprints can be shared per organization from the account inventory.',
                      'Bascule entre l inventaire du compte et les favoris. Les blueprints d inventaire peuvent etre partages organisation par organisation depuis cette vue.',
                      'Wechsle zwischen Konto-Inventar und Favoriten. Inventar-Blueprints konnen in dieser Ansicht pro Organisation freigegeben werden.',
                    )}
                  </Typography>
                </Box>

                <ToggleButtonGroup
                  exclusive
                  value={libraryMode}
                  onChange={(_event, value: 'inventory' | 'favorites' | null) => {
                    if (value) {
                      setLibraryMode(value);
                    }
                  }}
                  size="small"
                  aria-label={t('Blueprint collection filter', 'Filtre de collection blueprint', 'Blueprint-Sammlungsfilter')}
                  sx={{
                    alignSelf: { xs: 'stretch', lg: 'center' },
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      py: 1,
                      textTransform: 'none',
                    },
                  }}
                >
                  <ToggleButton value="inventory">
                    {t('Inventory', 'Inventaire', 'Inventar')} ({inventoryCount})
                  </ToggleButton>
                  <ToggleButton value="favorites">
                    {t('Favorites', 'Favoris', 'Favoriten')} ({favoriteCount})
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  label={t(
                    `${displayedBlueprints.length} visible blueprints`,
                    `${displayedBlueprints.length} blueprints visibles`,
                    `${displayedBlueprints.length} sichtbare Blueprints`,
                  )}
                  size="small"
                />
                {libraryMode === 'inventory' && (
                  <Chip
                    label={t(
                      `${sharedBlueprintIdSet.size} shared blueprints`,
                      `${sharedBlueprintIdSet.size} blueprints partages`,
                      `${sharedBlueprintIdSet.size} geteilte Blueprints`,
                    )}
                    size="small"
                    variant="outlined"
                  />
                )}
                {hiddenBlueprintCount > 0 && (
                  <Chip
                    label={t(
                      `${hiddenBlueprintCount} unavailable in current dataset`,
                      `${hiddenBlueprintCount} indisponibles dans le dataset actuel`,
                      `${hiddenBlueprintCount} im aktuellen Datensatz nicht verfugbar`,
                    )}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>

              {(blueprintCollectionError || sharedBlueprintError) && (
                <Alert severity="error" variant="outlined">
                  {blueprintCollectionError ?? sharedBlueprintError}
                </Alert>
              )}

              {displayedBlueprints.length === 0 ? (
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
                    {activeCollectionLabel}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', maxWidth: 560, mx: 'auto' }}>
                    {activeCollectionEmptyLabel}
                  </Typography>
                  {hiddenBlueprintCount > 0 && (
                    <Typography sx={{ color: 'text.secondary', mt: 1 }}>
                      {t(
                        'Some saved blueprint ids do not exist in the active dataset anymore.',
                        'Certains ids blueprint sauvegardes n existent plus dans le dataset actif.',
                        'Einige gespeicherte Blueprint-IDs existieren im aktiven Datensatz nicht mehr.',
                      )}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      lg: 'repeat(3, 1fr)',
                      xl: 'repeat(4, 1fr)',
                    },
                    gap: { xs: 1.5, sm: 2, lg: 3 },
                  }}
                  role="list"
                  aria-label={activeCollectionLabel}
                >
                  {visibleDisplayedBlueprints.map((blueprint, index) => {
                    const sharedOrganizationIds = sharedOrganizationIdsByBlueprintId.get(blueprint.id) ?? [];
                    const isShared = sharedOrganizationIds.length > 0;
                    const showSharedControls = libraryMode === 'inventory';

                    return (
                      <BlueprintCard
                        key={`${libraryMode}-${blueprint.id}`}
                        blueprint={blueprint}
                        activeBlueprintId={activeBlueprint?.id ?? null}
                        isFavorite={favoriteIdSet.has(blueprint.id)}
                        isInInventory={inventoryIdSet.has(blueprint.id)}
                        organizationShareAction={showSharedControls
                          ? {
                            selected: isShared,
                            busy: sharedBlueprintBusyId === blueprint.id,
                            label: isShared
                              ? t('Org sharing', 'Partage org', 'Org-Freigabe')
                              : t('Share', 'Partage', 'Teilen'),
                            ariaLabel: isShared
                              ? t(
                                'Choose which linked organizations can access this blueprint',
                                'Choisir quelles organisations liees peuvent acceder a ce blueprint',
                                'Auswahlen, welche verknupften Organisationen auf diesen Blueprint zugreifen konnen',
                              )
                              : t(
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
                              : isShared
                              ? t(
                                `Shared with ${sharedOrganizationIds.length} linked organization${sharedOrganizationIds.length > 1 ? 's' : ''}. Click to choose the organizations.`,
                                `Partage avec ${sharedOrganizationIds.length} organisation${sharedOrganizationIds.length > 1 ? 's' : ''} liee${sharedOrganizationIds.length > 1 ? 's' : ''}. Clique pour choisir les organisations.`,
                                `Mit ${sharedOrganizationIds.length} verknupften Organisation${sharedOrganizationIds.length > 1 ? 'en' : ''} geteilt. Klicke, um die Organisationen zu wahlen.`,
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
                        onSelect={(bp) => startTransition(() => setActiveBlueprint(bp))}
                        onToggleFavorite={handleToggleFavoriteBlueprint}
                        onToggleInventory={handleToggleInventoryBlueprint}
                      />
                    );
                  })}
                </Box>
              )}
              {visibleBlueprintCount < displayedBlueprints.length && (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setVisibleBlueprintCount((currentCount) =>
                        Math.min(currentCount + ACCOUNT_BLUEPRINT_BATCH_SIZE, displayedBlueprints.length),
                      )
                    }
                  >
                    {t('Load more blueprints', 'Afficher plus de blueprints', 'Mehr Blueprints laden')}
                  </Button>
                </Box>
              )}
            </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 1.5 } }}>
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.75}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
                    >
                      {t('Craft requests', 'Demandes de craft', 'Craft-Anfragen')}
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 0.25 }}>
                      {t('Incoming and recent activity', 'Entrantes et activite recente', 'Eingehend und aktuelle Aktivitat')}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip
                      label={t(
                        `${pendingIncomingCraftRequests.length} pending`,
                        `${pendingIncomingCraftRequests.length} en attente`,
                        `${pendingIncomingCraftRequests.length} ausstehend`,
                      )}
                      size="small"
                    />
                    <Chip
                      label={t(
                        `${recentOutgoingCraftRequests.length} recent`,
                        `${recentOutgoingCraftRequests.length} recentes`,
                        `${recentOutgoingCraftRequests.length} aktuell`,
                      )}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>

                {craftRequestError && (
                  <Alert severity="error" variant="outlined">
                    {craftRequestError}
                  </Alert>
                )}

                {craftRequestNotice && (
                  <Alert severity="success" variant="outlined">
                    {craftRequestNotice}
                  </Alert>
                )}

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.2,
                      backgroundColor: alpha(theme.palette.background.default, 0.16),
                    }}
                  >
                    <Stack spacing={0.9}>
                      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t('Incoming', 'Entrantes', 'Eingehend')}
                        </Typography>
                        <Chip
                          label={t(
                            `${pendingIncomingCraftRequests.length} open`,
                            `${pendingIncomingCraftRequests.length} ouvertes`,
                            `${pendingIncomingCraftRequests.length} offen`,
                          )}
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      </Stack>

                      {pendingIncomingCraftRequests.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {t(
                            'No pending craft requests.',
                            'Aucune demande de craft en attente.',
                            'Keine ausstehenden Craft-Anfragen.',
                          )}
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            maxHeight: { md: 220 },
                            overflowY: 'auto',
                            pr: 0.25,
                            borderRadius: 1.25,
                            border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                            backgroundColor: alpha(theme.palette.background.paper, 0.32),
                          }}
                        >
                          <Stack spacing={0}>
                            {pendingIncomingCraftRequests.map((request, index) => (
                              <Stack
                                key={request.id}
                                direction={{ xs: 'column', lg: 'row' }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: 'stretch', lg: 'center' }}
                                sx={{
                                  px: 1,
                                  py: 0.9,
                                  borderTop: index === 0 ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.75)}`,
                                }}
                              >
                                <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                                  <Avatar
                                    src={request.requesterAvatarUrl ?? undefined}
                                    alt={request.requesterDisplayName}
                                    sx={{ width: 28, height: 28 }}
                                  >
                                    {request.requesterDisplayName.charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                      {request.blueprintName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                                      {t(
                                        `${request.requesterDisplayName} via ${request.organizationName}`,
                                        `${request.requesterDisplayName} via ${request.organizationName}`,
                                        `${request.requesterDisplayName} uber ${request.organizationName}`,
                                      )}
                                    </Typography>
                                  </Box>
                                </Stack>

                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={craftRequestActionId === request.id}
                                    onClick={() => { void handleRespondToCraftRequest(request.id, 'accepted'); }}
                                  >
                                    {craftRequestActionId === request.id
                                      ? t('Saving...', 'Enregistrement...', 'Speichere...')
                                      : t('Accept', 'Accepter', 'Annehmen')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={craftRequestActionId === request.id}
                                    onClick={() => { void handleRespondToCraftRequest(request.id, 'denied'); }}
                                  >
                                    {t('Deny', 'Refuser', 'Ablehnen')}
                                  </Button>
                                </Stack>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Paper>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.2,
                      backgroundColor: alpha(theme.palette.background.default, 0.16),
                    }}
                  >
                    <Stack spacing={0.9}>
                      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t('Recent outgoing', 'Sortantes recentes', 'Aktuelle ausgehende')}
                        </Typography>
                        <Chip
                          label={t(
                            `${recentOutgoingCraftRequests.length} shown`,
                            `${recentOutgoingCraftRequests.length} affichees`,
                            `${recentOutgoingCraftRequests.length} angezeigt`,
                          )}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>

                      {recentOutgoingCraftRequests.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {t(
                            'No outgoing craft requests yet.',
                            'Aucune demande de craft sortante pour le moment.',
                            'Noch keine ausgehenden Craft-Anfragen.',
                          )}
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            maxHeight: { md: 220 },
                            overflowY: 'auto',
                            pr: 0.25,
                            borderRadius: 1.25,
                            border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                            backgroundColor: alpha(theme.palette.background.paper, 0.32),
                          }}
                        >
                          <Stack spacing={0}>
                            {recentOutgoingCraftRequests.map((request, index) => {
                              const statusColor =
                                request.status === 'accepted'
                                  ? 'success'
                                  : request.status === 'denied'
                                    ? 'error'
                                    : request.status === 'closed'
                                      ? 'default'
                                      : 'warning';

                              return (
                                <Stack
                                  key={request.id}
                                  direction={{ xs: 'column', lg: 'row' }}
                                  spacing={0.9}
                                  justifyContent="space-between"
                                  alignItems={{ xs: 'flex-start', lg: 'center' }}
                                  sx={{
                                    px: 1,
                                    py: 0.9,
                                    borderTop: index === 0 ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.75)}`,
                                  }}
                                >
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                      {request.blueprintName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                                      {t(
                                        `${request.ownerDisplayName} via ${request.organizationName}`,
                                        `${request.ownerDisplayName} via ${request.organizationName}`,
                                        `${request.ownerDisplayName} uber ${request.organizationName}`,
                                      )}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={
                                      request.status === 'accepted'
                                        ? t('Accepted', 'Acceptee', 'Angenommen')
                                        : request.status === 'denied'
                                          ? t('Denied', 'Refusee', 'Abgelehnt')
                                          : request.status === 'closed'
                                            ? t('Closed', 'Cloturee', 'Geschlossen')
                                            : t('Pending', 'En attente', 'Ausstehend')
                                    }
                                    size="small"
                                    color={statusColor}
                                    variant="outlined"
                                  />
                                  {request.status !== 'closed' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={craftRequestActionId === request.id}
                                      onClick={() => { void handleRespondToCraftRequest(request.id, 'closed'); }}
                                    >
                                      {t('Close', 'Clore', 'Schliessen')}
                                    </Button>
                                  )}
                                </Stack>
                              );
                            })}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(320px, 0.85fr)' },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, md: 3 },
                overflow: 'hidden',
                borderColor: alpha(theme.palette.primary.main, 0.24),
                background: `linear-gradient(145deg, ${alpha(theme.palette.secondary.main, 0.14)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 42%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
                  >
                    {t('Why create an account', 'Pourquoi creer un compte', 'Warum ein Konto erstellen')}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5, lineHeight: 0.95 }}>
                    {t(
                      'Keep your blueprint progress, organization sharing and craft coordination in one place.',
                      'Centralise ta progression blueprint, le partage avec tes organisations et la coordination des crafts.',
                      'Behalte deinen Blueprint-Fortschritt, Organisationsfreigaben und Craft-Absprachen an einem Ort.',
                    )}
                  </Typography>
                  <Typography sx={{ mt: 1.25, maxWidth: 880, color: 'text.secondary' }}>
                    {t(
                      'A connected account turns the site into a persistent workspace: your favorites and inventory stay synced, your RSI profile can unlock org features, and shared crafting becomes actionable instead of staying just informational.',
                      'Un compte connecte transforme le site en espace de travail persistant : tes favoris et ton inventaire restent synchronises, ton profil RSI peut debloquer les features d organisation, et le craft partage devient une vraie action plutot qu une simple information.',
                      'Ein verbundenes Konto macht die Seite zu einem dauerhaften Workspace: Favoriten und Inventar bleiben synchron, dein RSI-Profil kann Org-Funktionen freischalten und geteiltes Crafting wird wirklich nutzbar statt nur informativ zu sein.',
                    )}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {[
                    t('Cloud inventory', 'Inventaire cloud', 'Cloud-Inventar'),
                    t('Favorites sync', 'Sync favoris', 'Favoriten-Sync'),
                    t('RSI link', 'Lien RSI', 'RSI-Link'),
                    t('Organization sharing', 'Partage organisation', 'Organisationsfreigabe'),
                    t('Craft requests', 'Demandes de craft', 'Craft-Anfragen'),
                  ].map((label) => (
                    <Chip key={label} label={label} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Stack>
            </Paper>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {[
                {
                  step: '01',
                  title: t('Sync your collections', 'Synchronise tes collections', 'Synchronisiere deine Sammlungen'),
                  body: t(
                    'Keep blueprint favorites and inventory attached to your account instead of one browser only.',
                    'Garde tes favoris et ton inventaire blueprint rattaches a ton compte plutot qu a un seul navigateur.',
                    'Speichere Favoriten und Blueprint-Inventar am Konto statt nur in einem Browser.',
                  ),
                },
                {
                  step: '02',
                  title: t('Unlock organization tools', 'Debloque les outils d organisation', 'Schalte Organisations-Tools frei'),
                  body: t(
                    'Link RSI once, join your org spaces, and browse the blueprints shared by people you actually play with.',
                    'Lie ton RSI une fois, rejoins tes espaces d organisation et consulte les blueprints partages par les personnes avec qui tu joues vraiment.',
                    'Verbinde RSI einmal, betrete deine Org-Bereiche und sieh die Blueprints der Leute, mit denen du wirklich spielst.',
                  ),
                },
                {
                  step: '03',
                  title: t('Coordinate crafting', 'Coordonne les crafts', 'Koordiniere Crafts'),
                  body: t(
                    'Send craft requests to owners, review incoming asks from your account page, and keep the workflow visible.',
                    'Envoie des demandes de craft aux proprietaires, traite les demandes entrantes depuis ton compte et garde le workflow visible.',
                    'Sende Craft-Anfragen an Besitzer, bearbeite eingehende Anfragen auf deiner Kontoseite und behalte den Ablauf im Blick.',
                  ),
                },
              ].map((feature) => (
                <Paper
                  key={feature.step}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderColor: alpha(theme.palette.primary.main, 0.14),
                    backgroundColor: alpha(theme.palette.background.default, 0.24),
                  }}
                >
                  <Stack spacing={1.25}>
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.25,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: 'primary.main',
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      }}
                    >
                      {feature.step}
                    </Box>
                    <Typography variant="h6" sx={{ lineHeight: 1 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {feature.body}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.main', letterSpacing: '0.12em' }}
                  >
                    {t('Account flow preview', 'Apercu du flow compte', 'Konto-Flow-Vorschau')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t(
                      'The first two screenshots are now wired from the real account flow. One final capture can still be added later.',
                      'Les deux premiers screenshots viennent maintenant du vrai flow compte. Il reste juste une capture finale a ajouter plus tard.',
                      'Die ersten beiden Screenshots kommen jetzt aus dem echten Konto-Flow. Ein letzter Capture kann spater noch erganzt werden.',
                    )}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 2,
                  }}
                >
                  {accountPreviewCards.map((placeholder) => (
                    <Paper
                      key={placeholder.title}
                      variant="outlined"
                      sx={{
                        p: 0,
                        overflow: 'hidden',
                        borderStyle: placeholder.image ? 'solid' : 'dashed',
                        borderColor: alpha(theme.palette.primary.main, placeholder.image ? 0.18 : 0.22),
                        backgroundColor: alpha(theme.palette.background.default, placeholder.image ? 0.12 : 0.28),
                      }}
                    >
                      {placeholder.image ? (
                        <Box
                          component="img"
                          src={placeholder.image}
                          alt={placeholder.alt ?? placeholder.title}
                          sx={{
                            display: 'block',
                            width: '100%',
                            aspectRatio: '16 / 10',
                            objectFit: 'cover',
                            objectPosition: 'top center',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            aspectRatio: '16 / 10',
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 1.5,
                            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 100%)`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.disabled',
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                            }}
                          >
                            {t('Screenshot placeholder', 'Screenshot placeholder', 'Screenshot-Platzhalter')}
                          </Typography>
                          <Box>
                            <Typography variant="h6" sx={{ lineHeight: 1 }}>
                              {placeholder.title}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
                              {placeholder.body}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      <Box sx={{ p: 1.5 }}>
                        <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                          {placeholder.title}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
                          {placeholder.body}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Stack>
            </Paper>
          </Stack>

          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(theme.palette.primary.main, 0.24),
                background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.25,
                      border: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'primary.main',
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    }}
                  >
                    <PersonOutlineOutlinedIcon />
                  </Box>
                  <Box>
                    <Typography variant="h5">
                      {t('Sign in to unlock the account layer', 'Connecte-toi pour debloquer la couche compte', 'Melde dich an, um die Kontoebene freizuschalten')}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {t(
                        'Discord is the current entry point for the account system. You can import local data right after login if needed.',
                        'Discord est actuellement la porte d entree du systeme de compte. Tu pourras importer tes donnees locales juste apres connexion si besoin.',
                        'Discord ist aktuell der Einstiegspunkt fur das Kontosystem. Lokale Daten lassen sich bei Bedarf direkt nach der Anmeldung importieren.',
                      )}
                    </Typography>
                  </Box>
                </Stack>

                <Box>
                  <Button variant="secondary" onClick={() => loginWithDiscord('/account')}>
                    {t('Log in with Discord', 'Se connecter avec Discord', 'Mit Discord anmelden')}
                  </Button>
                </Box>

                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t(
                    'If blueprints already exist in local storage, the app can offer an import after authentication.',
                    'Si des blueprints existent deja dans le local storage, l appli peut proposer un import apres authentification.',
                    'Wenn bereits Blueprints im Local Storage liegen, kann die App nach der Authentifizierung einen Import anbieten.',
                  )}
                </Typography>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.25}>
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.main', letterSpacing: '0.12em' }}
                >
                  {t('What unlocks', 'Ce que le compte debloque', 'Was das Konto freischaltet')}
                </Typography>
                {[
                  t('Persistent favorites and inventory across sessions and devices.', 'Favoris et inventaire persistants entre les sessions et les appareils.', 'Dauerhafte Favoriten und Inventare uber Sitzungen und Gerate hinweg.'),
                  t('RSI identity linking for organizations, shared blueprint access and admin review flows.', 'Liaison RSI pour les organisations, l acces aux blueprints partages et les workflows de revue admin.', 'RSI-Verknupfung fur Organisationen, Zugriff auf geteilte Blueprints und Admin-Review-Ablaufe.'),
                  t('Craft request inbox and history directly from your account page.', 'Boite de reception et historique des demandes de craft directement depuis ta page compte.', 'Craft-Anfrageeingang und Verlauf direkt auf deiner Kontoseite.'),
                ].map((item, index) => (
                  <Paper
                    key={item}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      display: 'flex',
                      gap: 1,
                      alignItems: 'flex-start',
                      backgroundColor: alpha(theme.palette.background.default, 0.22),
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'primary.main',
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Box>
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
                  `Wahle, welche verknupften Organisationen auf ${shareDialogBlueprint.name} zugreifen konnen.`,
                )
                : t(
                  'Choose which linked organizations can access this blueprint.',
                  'Choisis quelles organisations liees peuvent acceder a ce blueprint.',
                  'Wahle, welche verknupften Organisationen auf diesen Blueprint zugreifen konnen.',
                )}
            </Typography>

            {linkedOrganizations.length === 0 ? (
              <Alert severity="info" variant="outlined">
                {t(
                  'Link at least one organization on this account before sharing blueprints.',
                  'Lie au moins une organisation a ce compte avant de partager des blueprints.',
                  'Verknupfe mindestens eine Organisation mit diesem Konto, bevor du Blueprints teilst.',
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
        open={Boolean(organizationClaimDialogTarget)}
        onClose={closeClaimOrganizationDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            'Request organization claim review?',
            'Demander une revue de claim pour cette organisation ?',
            'Claim-Prufung fur diese Organisation anfordern?',
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {organizationClaimDialogTarget
                ? t(
                  `A manual review request will be created for ${organizationClaimDialogTarget.name}.`,
                  `Une demande de revue manuelle sera creee pour ${organizationClaimDialogTarget.name}.`,
                  `Fur ${organizationClaimDialogTarget.name} wird eine manuelle Prufungsanfrage erstellt.`,
                )
                : t(
                  'A manual review request will be created for this organization.',
                  'Une demande de revue manuelle sera creee pour cette organisation.',
                  'Fur diese Organisation wird eine manuelle Prufungsanfrage erstellt.',
                )}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'No automatic claim will happen immediately. You will be able to continue using the app while the request is reviewed.',
                'Aucun claim automatique ne sera effectue immediatement. Tu pourras continuer a utiliser l appli pendant la revue de la demande.',
                'Es erfolgt kein sofortiger automatischer Claim. Du kannst die App wahrend der Prufung normal weiterverwenden.',
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
                'Kopiere den Verifizierungscode, fug ihn in die Kurzbiografie deines RSI-Profils ein und gib danach unten deinen RSI-Handle ein.',
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
