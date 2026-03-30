import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addAccountOrganization,
  claimAccountOrganization,
  createOrganizationCraftRequest,
  deleteCurrentAccount,
  deleteOwnedOrganization,
  fetchAuthSession,
  fetchCurrentAccount,
  fetchOrganizationSharedBlueprints,
  getDiscordLoginUrl,
  logoutAuthSession,
  refreshAccountOrganizationMembers,
  removeAccountOrganization,
  respondToOrganizationCraftRequestsBulk,
  saveCurrentAccountState,
  saveOrganizationBlueprintShares,
  setAccountOrganizationBlueprintSharing,
  unlinkRsiAccount,
  verifyAndLinkRsiAccount,
  type AccountCraftRequest,
  type AccountCraftRequestResourcesOption,
  type AccountCraftRequestStatus,
  type AccountStateSnapshot,
  type AuthSessionResponse,
  type AuthenticatedUser,
  type CraftRequestDecision,
  type OrganizationSharedBlueprintPayload,
  type StoredAccount,
  AuthApiError,
} from '../services/authService';
import {
  applyOptimisticAccountMutations,
  buildMutationLockKey,
  buildMutationStorageKey,
  coalescePersistedMutations,
  getMutationBroadcastChannelName,
  readPersistedAccountMutations,
  resolveClientStorageScope,
  writePersistedAccountMutations,
  type AccountSyncStatus,
  type CraftRequestCreateMutation,
  type CraftRequestDecisionMutation,
  type OptimisticAccountState,
  type OrganizationBlueprintSharesMutation,
  type OrganizationClaimMutation,
  type OrganizationMembershipMutation,
  type OrganizationRefreshMutation,
  type OrganizationSharingMutation,
  type PersistedAccountMutation,
} from './accountMutations';

interface AuthState {
  enabled: boolean;
  loading: boolean;
  user: AuthenticatedUser | null;
  provider: 'discord' | null;
  account: StoredAccount | null;
  optimisticState: OptimisticAccountState;
  pendingMutationCount: number;
  syncStatus: AccountSyncStatus;
  syncError: string | null;
  clearSyncError: () => void;
  refreshSession: () => Promise<void>;
  flushPendingMutations: () => Promise<void>;
  loginWithDiscord: (returnTo?: string) => void;
  logout: () => Promise<void>;
  syncAccountState: (snapshot: AccountStateSnapshot, options?: { flushAfterMs?: number }) => Promise<void>;
  queueAccountStateUpdate: (
    updater: (snapshot: AccountStateSnapshot, account: StoredAccount) => AccountStateSnapshot,
    options?: { flushAfterMs?: number },
  ) => void;
  deleteAccount: () => Promise<void>;
  linkRsiAccount: (handle: string, code: string) => Promise<void>;
  unlinkRsiAccount: () => Promise<void>;
  updateOrganizationBlueprintShares: (
    organizationBlueprintShares: Record<string, string[]>,
    options?: { flushAfterMs?: number },
  ) => Promise<void>;
  queueOrganizationBlueprintSharesUpdate: (
    updater: (
      shares: Record<string, string[]>,
      account: StoredAccount,
    ) => Record<string, string[]>,
    options?: { flushAfterMs?: number },
  ) => void;
  addOrganization: (sid: string) => Promise<void>;
  removeOrganization: (sid: string) => Promise<void>;
  claimOrganization: (sid: string) => Promise<void>;
  deleteOrganization: (sid: string) => Promise<void>;
  setOrganizationBlueprintSharing: (sid: string, enabled: boolean) => Promise<void>;
  refreshOrganizationMembers: (sid: string) => Promise<void>;
  loadOrganizationSharedBlueprints: (sid: string) => Promise<OrganizationSharedBlueprintPayload>;
  requestOrganizationCraft: (
    sid: string,
    payload: {
      blueprintId: string;
      blueprintName?: string;
      ownerHandle: string;
      comment?: string | null;
      resourcesOption?: AccountCraftRequestResourcesOption;
    },
  ) => Promise<AccountCraftRequest>;
  respondToCraftRequest: (
    requestId: string,
    decision: CraftRequestDecision,
  ) => Promise<AccountCraftRequestStatus>;
}

const AuthContext = createContext<AuthState | null>(null);

const DEFAULT_CLICK_FLUSH_MS = 550;
const RETRY_DELAY_INITIAL_MS = 2_000;
const RETRY_DELAY_MAX_MS = 30_000;
const FLUSH_LOCK_TTL_MS = 15_000;

function getCurrentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function createMutationId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

function cloneAccountSnapshot(account: StoredAccount): AccountStateSnapshot {
  return {
    favoriteBlueprintIds: [...account.favoriteBlueprintIds],
    inventoryBlueprintIds: [...account.inventoryBlueprintIds],
    planner: {
      goals: [...account.planner.goals],
      todoItems: [...account.planner.todoItems],
      resourceRequirements: { ...account.planner.resourceRequirements },
      resourceProgress: { ...account.planner.resourceProgress },
    },
  };
}

function cloneOrganizationBlueprintShares(
  shares: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(shares).map(([sid, blueprintIds]) => [sid, [...blueprintIds]]),
  );
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeOrganizationSid(value: unknown): string {
  const input = normalizeText(value);
  if (!input) {
    return '';
  }
  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  return (urlMatch?.[1] ?? input).trim().toUpperCase();
}

function isTransientSyncError(error: unknown): boolean {
  if (!(error instanceof AuthApiError)) {
    return true;
  }

  return error.status >= 500 || error.status === 429;
}

function extractSyncErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message ? error.message : fallbackMessage;
}

function acquireFlushLock(lockKey: string, ownerId: string): boolean {
  try {
    const now = Date.now();
    const rawLock = window.localStorage.getItem(lockKey);
    if (rawLock) {
      const parsed = JSON.parse(rawLock) as { ownerId?: string; expiresAt?: number };
      if (
        parsed.ownerId &&
        parsed.ownerId !== ownerId &&
        Number.isFinite(parsed.expiresAt) &&
        Number(parsed.expiresAt) > now
      ) {
        return false;
      }
    }

    window.localStorage.setItem(
      lockKey,
      JSON.stringify({
        ownerId,
        expiresAt: now + FLUSH_LOCK_TTL_MS,
      }),
    );
    return true;
  } catch {
    return true;
  }
}

function releaseFlushLock(lockKey: string, ownerId: string): void {
  try {
    const rawLock = window.localStorage.getItem(lockKey);
    if (!rawLock) {
      return;
    }
    const parsed = JSON.parse(rawLock) as { ownerId?: string };
    if (!parsed.ownerId || parsed.ownerId === ownerId) {
      window.localStorage.removeItem(lockKey);
    }
  } catch {
    // Ignore release failures.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionResponse>({
    enabled: false,
    provider: null,
    user: null,
  });
  const [serverAccount, setServerAccount] = useState<StoredAccount | null>(null);
  const [pendingMutations, setPendingMutations] = useState<PersistedAccountMutation[]>([]);
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastFlushAt, setLastFlushAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const storageScope = useMemo(() => resolveClientStorageScope(window.location.origin), []);
  const broadcastChannelName = useMemo(() => getMutationBroadcastChannelName(), []);
  const mutationOwnerIdRef = useRef(createMutationId('tab'));
  const flushTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryDelayRef = useRef(RETRY_DELAY_INITIAL_MS);
  const flushInFlightRef = useRef(false);
  const pendingMutationsRef = useRef<PersistedAccountMutation[]>([]);
  const serverAccountRef = useRef<StoredAccount | null>(null);
  const syncStatusRef = useRef<AccountSyncStatus>('idle');
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const mutationStorageKey = useMemo(
    () =>
      serverAccount?.accountId
        ? buildMutationStorageKey(serverAccount.accountId, storageScope)
        : null,
    [serverAccount?.accountId, storageScope],
  );
  const mutationLockKey = useMemo(
    () =>
      serverAccount?.accountId
        ? buildMutationLockKey(serverAccount.accountId, storageScope)
        : null,
    [serverAccount?.accountId, storageScope],
  );

  const account = useMemo(
    () => applyOptimisticAccountMutations(serverAccount, pendingMutations),
    [pendingMutations, serverAccount],
  );

  const optimisticState = useMemo<OptimisticAccountState>(
    () => ({
      account,
      pendingMutations,
      syncStatus,
      lastFlushAt,
      lastError: syncError,
    }),
    [account, lastFlushAt, pendingMutations, syncError, syncStatus],
  );

  useEffect(() => {
    pendingMutationsRef.current = pendingMutations;
  }, [pendingMutations]);

  useEffect(() => {
    serverAccountRef.current = serverAccount;
  }, [serverAccount]);

  useEffect(() => {
    syncStatusRef.current = syncStatus;
  }, [syncStatus]);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
    setSyncStatus(pendingMutationsRef.current.length > 0 ? 'pending' : 'idle');
  }, []);

  const updatePersistedMutations = useCallback(
    (
      nextMutations: PersistedAccountMutation[],
      options: {
        shouldBroadcast?: boolean;
      } = {},
    ) => {
      pendingMutationsRef.current = nextMutations;
      setPendingMutations(nextMutations);

      if (mutationStorageKey) {
        writePersistedAccountMutations(mutationStorageKey, nextMutations);
      }

      if (nextMutations.length > 0) {
        if (syncStatusRef.current !== 'syncing') {
          setSyncStatus('pending');
        }
      } else if (!syncError) {
        setSyncStatus('idle');
      }

      if (options.shouldBroadcast !== false) {
        broadcastChannelRef.current?.postMessage({
          type: 'queue-updated',
          accountId: serverAccountRef.current?.accountId ?? null,
        });
      }
    },
    [mutationStorageKey, syncError],
  );

  const flushPendingMutationsRef = useRef<() => Promise<void>>(async () => {});
  const scheduleFlushRef = useRef<
    (mutations?: PersistedAccountMutation[], delayMs?: number) => void
  >(() => {});

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const nextSession = await fetchAuthSession();
      setSession(nextSession);
      if (nextSession.user) {
        try {
          const nextAccount = await fetchCurrentAccount();
          setServerAccount(nextAccount);
        } catch {
          setServerAccount(null);
        }
      } else {
        setServerAccount(null);
        setPendingMutations([]);
        setSyncStatus('idle');
        setSyncError(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAccountSilently = useCallback(async () => {
    if (!session.user) {
      setServerAccount(null);
      return;
    }

    try {
      const nextAccount = await fetchCurrentAccount();
      setServerAccount(nextAccount);
    } catch {
      // Keep the optimistic account on silent refresh failures.
    }
  }, [session.user]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!session.user) {
      return undefined;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      void refreshAccountSilently();
    };

    const intervalId = window.setInterval(refreshIfVisible, 15_000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refreshAccountSilently, session.user]);

  useEffect(() => {
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (!mutationStorageKey || !serverAccount?.accountId) {
      setPendingMutations([]);
      return;
    }

    const storedMutations = readPersistedAccountMutations(mutationStorageKey).filter(
      (mutation) => mutation.accountId === serverAccount.accountId,
    );
    pendingMutationsRef.current = storedMutations;
    setPendingMutations(storedMutations);
    setSyncStatus(storedMutations.length > 0 ? 'pending' : 'idle');
    retryDelayRef.current = RETRY_DELAY_INITIAL_MS;

    return undefined;
  }, [mutationStorageKey, serverAccount?.accountId]);

  useEffect(() => {
    if (!mutationStorageKey || !serverAccount?.accountId) {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== mutationStorageKey) {
        return;
      }

      const nextMutations = readPersistedAccountMutations(mutationStorageKey).filter(
        (mutation) => mutation.accountId === serverAccount.accountId,
      );
      pendingMutationsRef.current = nextMutations;
      setPendingMutations(nextMutations);
      if (nextMutations.length > 0 && syncStatusRef.current !== 'syncing') {
        setSyncStatus('pending');
      }
    };

    window.addEventListener('storage', handleStorage);

    try {
      const nextChannel = new BroadcastChannel(broadcastChannelName);
      nextChannel.onmessage = (event) => {
        if (event.data?.accountId !== serverAccount.accountId) {
          return;
        }

        const nextMutations = readPersistedAccountMutations(mutationStorageKey).filter(
          (mutation) => mutation.accountId === serverAccount.accountId,
        );
        pendingMutationsRef.current = nextMutations;
        setPendingMutations(nextMutations);
        if (event.data?.type === 'server-account-updated') {
          void refreshAccountSilently();
        } else if (nextMutations.length > 0 && syncStatusRef.current !== 'syncing') {
          setSyncStatus('pending');
        }
      };
      broadcastChannelRef.current = nextChannel;

      return () => {
        window.removeEventListener('storage', handleStorage);
        nextChannel.close();
        if (broadcastChannelRef.current === nextChannel) {
          broadcastChannelRef.current = null;
        }
      };
    } catch {
      return () => {
        window.removeEventListener('storage', handleStorage);
      };
    }
  }, [broadcastChannelName, mutationStorageKey, refreshAccountSilently, serverAccount?.accountId]);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
    }
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void flushPendingMutationsRef.current();
    }, retryDelayRef.current);
    retryDelayRef.current = Math.min(retryDelayRef.current * 2, RETRY_DELAY_MAX_MS);
  }, []);

  const flushPendingMutations = useCallback(async () => {
    if (flushInFlightRef.current) {
      return;
    }

    const currentAccount = serverAccountRef.current;
    if (!currentAccount || !mutationStorageKey || !mutationLockKey) {
      return;
    }

    const latestMutations = readPersistedAccountMutations(mutationStorageKey).filter(
      (mutation) => mutation.accountId === currentAccount.accountId,
    );
    if (latestMutations.length === 0) {
      updatePersistedMutations([], { shouldBroadcast: false });
      setSyncStatus(syncError ? 'error' : 'idle');
      return;
    }

    if (!acquireFlushLock(mutationLockKey, mutationOwnerIdRef.current)) {
      scheduleFlushRef.current(latestMutations, 1_200);
      return;
    }

    flushInFlightRef.current = true;
    setSyncStatus('syncing');

    let workingAccount = currentAccount;
    let workingMutations = latestMutations;
    let hadSyncError = false;
    let latestSyncErrorMessage = syncError;

    const markProgress = (nextAccount: StoredAccount, nextMutations: PersistedAccountMutation[]) => {
      workingAccount = nextAccount;
      setServerAccount(nextAccount);
      updatePersistedMutations(nextMutations);
      setLastFlushAt(Date.now());
      retryDelayRef.current = RETRY_DELAY_INITIAL_MS;
    };

    const handleMutationFailure = (
      failedMutations: PersistedAccountMutation[],
      error: unknown,
      fallbackMessage: string,
    ): boolean => {
      const nextMessage = extractSyncErrorMessage(error, fallbackMessage);
      latestSyncErrorMessage = nextMessage;
      setSyncError(nextMessage);
      hadSyncError = true;

      if (isTransientSyncError(error)) {
        setSyncStatus('error');
        scheduleRetry();
        return true;
      }

      const failedIds = new Set(failedMutations.map((mutation) => mutation.id));
      const nextMutations = workingMutations.filter(
        (mutation) => !failedIds.has(mutation.id),
      );
      updatePersistedMutations(nextMutations);
      workingMutations = nextMutations;
      return false;
    };

    try {
      const snapshotMutation =
        [...workingMutations]
          .reverse()
          .find((mutation): mutation is PersistedAccountMutation & { kind: 'account-snapshot' } =>
            mutation.kind === 'account-snapshot',
          ) ?? null;

      if (snapshotMutation) {
        try {
          const nextAccount = await saveCurrentAccountState(snapshotMutation.payload);
          const nextMutations = workingMutations.filter(
            (mutation) => mutation.id !== snapshotMutation.id,
          );
          workingMutations = nextMutations;
          markProgress(nextAccount, nextMutations);
        } catch (error) {
          if (
            handleMutationFailure(
              [snapshotMutation],
              error,
              'Account state synchronization failed.',
            )
          ) {
            return;
          }
        }
      }

      const commandMutations = workingMutations.filter((mutation) => mutation.scope === 'command');
      const craftRequestDecisionMutations = commandMutations.filter(
        (mutation): mutation is CraftRequestDecisionMutation =>
          mutation.kind === 'craft-request-decision',
      );

      if (craftRequestDecisionMutations.length > 0) {
        try {
          const result = await respondToOrganizationCraftRequestsBulk(
            craftRequestDecisionMutations.map((mutation) => mutation.payload),
          );
          let nextMutations = workingMutations;
          const mutationsByRequestId = new Map(
            craftRequestDecisionMutations.map((mutation) => [
              mutation.payload.requestId,
              mutation,
            ]),
          );
          const retryableMutations: PersistedAccountMutation[] = [];

          for (const entry of result.results) {
            const matchingMutation = mutationsByRequestId.get(entry.requestId);
            if (!matchingMutation) {
              continue;
            }

            if (entry.ok) {
              nextMutations = nextMutations.filter(
                (mutation) => mutation.id !== matchingMutation.id,
              );
              continue;
            }

            if (
              entry.errorStatus === undefined ||
              entry.errorStatus >= 500 ||
              entry.errorStatus === 429
            ) {
              retryableMutations.push(matchingMutation);
              continue;
            }

            nextMutations = nextMutations.filter(
              (mutation) => mutation.id !== matchingMutation.id,
            );
            if (entry.error) {
              latestSyncErrorMessage = entry.error;
              setSyncError(entry.error);
              hadSyncError = true;
            }
          }

          workingMutations = nextMutations;
          markProgress(result.account, nextMutations);
          if (retryableMutations.length > 0) {
            setSyncStatus('error');
            hadSyncError = true;
            scheduleRetry();
            return;
          }
        } catch (error) {
          if (
            handleMutationFailure(
              craftRequestDecisionMutations,
              error,
              'Craft request decisions could not be synchronized.',
            )
          ) {
            return;
          }
        }
      }

      const sequentialCommands = workingMutations
        .filter((mutation) => mutation.scope === 'command')
        .filter((mutation) => mutation.kind !== 'craft-request-decision');

      for (const mutation of sequentialCommands) {
        try {
          switch (mutation.kind) {
            case 'craft-request-create': {
              const result = await createOrganizationCraftRequest(
                mutation.payload.organizationSid,
                {
                  blueprintId: mutation.payload.blueprintId,
                  blueprintName: mutation.payload.blueprintName,
                  ownerHandle: mutation.payload.ownerHandle,
                  comment: mutation.payload.comment,
                  resourcesOption: mutation.payload.resourcesOption,
                },
              );
              const nextMutations = workingMutations.filter(
                (entry) => entry.id !== mutation.id,
              );
              workingMutations = nextMutations;
              markProgress(result.account, nextMutations);
              break;
            }
            case 'organization-membership': {
              const nextAccount =
                mutation.payload.action === 'add'
                  ? await addAccountOrganization(mutation.payload.sid)
                  : await removeAccountOrganization(mutation.payload.sid);
              const nextMutations = workingMutations.filter(
                (entry) => entry.id !== mutation.id,
              );
              workingMutations = nextMutations;
              markProgress(nextAccount, nextMutations);
              break;
            }
            case 'organization-sharing': {
              const nextAccount = await setAccountOrganizationBlueprintSharing(
                mutation.payload.sid,
                mutation.payload.enabled,
              );
              const nextMutations = workingMutations.filter(
                (entry) => entry.id !== mutation.id,
              );
              workingMutations = nextMutations;
              markProgress(nextAccount, nextMutations);
              break;
            }
            case 'organization-claim': {
              const nextAccount = await claimAccountOrganization(mutation.payload.sid);
              const nextMutations = workingMutations.filter(
                (entry) => entry.id !== mutation.id,
              );
              workingMutations = nextMutations;
              markProgress(nextAccount, nextMutations);
              break;
            }
            case 'organization-refresh': {
              const nextAccount = await refreshAccountOrganizationMembers(
                mutation.payload.sid,
              );
              const nextMutations = workingMutations.filter(
                (entry) => entry.id !== mutation.id,
              );
              workingMutations = nextMutations;
              markProgress(nextAccount, nextMutations);
              break;
            }
            default:
              break;
          }
        } catch (error) {
          if (
            handleMutationFailure(
              [mutation],
              error,
              'A queued account action could not be synchronized.',
            )
          ) {
            return;
          }
        }
      }

      const sharesMutation =
        [...workingMutations]
          .reverse()
          .find(
            (
              mutation,
            ): mutation is OrganizationBlueprintSharesMutation =>
              mutation.kind === 'organization-blueprint-shares',
          ) ?? null;

      if (sharesMutation) {
        try {
          const nextAccount = await saveOrganizationBlueprintShares(
            sharesMutation.payload.organizationBlueprintShares,
          );
          const nextMutations = workingMutations.filter(
            (mutation) => mutation.id !== sharesMutation.id,
          );
          workingMutations = nextMutations;
          markProgress(nextAccount, nextMutations);
        } catch (error) {
          if (
            handleMutationFailure(
              [sharesMutation],
              error,
              'Blueprint share synchronization failed.',
            )
          ) {
            return;
          }
        }
      }
    } finally {
      flushInFlightRef.current = false;
      releaseFlushLock(mutationLockKey, mutationOwnerIdRef.current);
    }

    if (workingMutations.length > 0) {
      if (hadSyncError) {
        setSyncStatus('error');
      } else {
        setSyncStatus('pending');
      }
      scheduleFlushRef.current(workingMutations);
      return;
    }

    updatePersistedMutations([], { shouldBroadcast: true });
    if (hadSyncError && latestSyncErrorMessage) {
      setSyncStatus('error');
    } else {
      setSyncStatus('idle');
      setSyncError(null);
    }
    broadcastChannelRef.current?.postMessage({
      type: 'server-account-updated',
      accountId: workingAccount.accountId,
    });
  }, [mutationLockKey, mutationStorageKey, scheduleRetry, syncError, updatePersistedMutations]);

  flushPendingMutationsRef.current = flushPendingMutations;

  const scheduleFlush = useCallback(
    (mutations: PersistedAccountMutation[] = pendingMutationsRef.current, delayMs?: number) => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      if (!serverAccountRef.current || mutations.length === 0) {
        return;
      }

      const computedDelay =
        delayMs ??
        Math.max(
          0,
          Math.min(
            ...mutations.map((mutation) =>
              mutation.createdAt + mutation.flushAfterMs - Date.now(),
            ),
          ),
        );

      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        void flushPendingMutationsRef.current();
      }, computedDelay);
    },
    [],
  );

  scheduleFlushRef.current = scheduleFlush;

  useEffect(() => {
    if (pendingMutations.length > 0) {
      scheduleFlush(pendingMutations);
    }
  }, [pendingMutations, scheduleFlush]);

  useEffect(() => {
    const flushSoon = () => {
      if (pendingMutationsRef.current.length === 0) {
        return;
      }
      void flushPendingMutationsRef.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSoon();
      }
    };

    window.addEventListener('online', flushSoon);
    window.addEventListener('pagehide', flushSoon);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', flushSoon);
      window.removeEventListener('pagehide', flushSoon);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
      }
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current);
      }
      broadcastChannelRef.current?.close();
    };
  }, []);

  const enqueueMutation = useCallback(
    (mutation: PersistedAccountMutation) => {
      setSyncError(null);
      const nextMutations = coalescePersistedMutations(
        pendingMutationsRef.current,
        mutation,
      );
      updatePersistedMutations(nextMutations);
      scheduleFlushRef.current(nextMutations);
    },
    [updatePersistedMutations],
  );

  const queueAccountStateUpdate = useCallback<
    AuthState['queueAccountStateUpdate']
  >((updater, options) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      return;
    }

    const nextSnapshot = updater(cloneAccountSnapshot(currentAccount), currentAccount);
    const mutation = {
      id: createMutationId('acctsnap'),
      kind: 'account-snapshot',
      scope: 'snapshot',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      flushAfterMs: options?.flushAfterMs ?? DEFAULT_CLICK_FLUSH_MS,
      payload: nextSnapshot,
    } satisfies PersistedAccountMutation;
    enqueueMutation(mutation);
  }, [enqueueMutation]);

  const queueOrganizationBlueprintSharesUpdate = useCallback<
    AuthState['queueOrganizationBlueprintSharesUpdate']
  >((updater, options) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      return;
    }

    const nextShares = updater(
      cloneOrganizationBlueprintShares(currentAccount.organizationBlueprintShares ?? {}),
      currentAccount,
    );
    const mutation = {
      id: createMutationId('acctshares'),
      kind: 'organization-blueprint-shares',
      scope: 'map',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      flushAfterMs: options?.flushAfterMs ?? DEFAULT_CLICK_FLUSH_MS,
      payload: {
        organizationBlueprintShares: nextShares,
      },
    } satisfies OrganizationBlueprintSharesMutation;
    enqueueMutation(mutation);
  }, [enqueueMutation]);

  const loginWithDiscord = useCallback((returnTo?: string) => {
    window.location.assign(getDiscordLoginUrl(returnTo ?? getCurrentReturnTo()));
  }, []);

  const logout = useCallback(async () => {
    await logoutAuthSession();
    await refreshSession();
  }, [refreshSession]);

  const syncAccountState = useCallback<AuthState['syncAccountState']>(
    async (snapshot, options) => {
      queueAccountStateUpdate(() => snapshot, options);
    },
    [queueAccountStateUpdate],
  );

  const deleteAccount = useCallback(async () => {
    await deleteCurrentAccount();
    await refreshSession();
  }, [refreshSession]);

  const linkRsiAccount = useCallback(async (handle: string, code: string) => {
    const nextAccount = await verifyAndLinkRsiAccount(handle, code);
    setServerAccount(nextAccount);
    setSyncError(null);
  }, []);

  const unlinkRsiAccountBinding = useCallback(async () => {
    const nextAccount = await unlinkRsiAccount();
    setServerAccount(nextAccount);
    setSyncError(null);
  }, []);

  const updateOrganizationBlueprintShares = useCallback<
    AuthState['updateOrganizationBlueprintShares']
  >(async (organizationBlueprintShares, options) => {
    queueOrganizationBlueprintSharesUpdate(() => organizationBlueprintShares, options);
  }, [queueOrganizationBlueprintSharesUpdate]);

  const addOrganization = useCallback(async (sid: string) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      throw new Error('Authentication required.');
    }

    const normalizedSid = normalizeOrganizationSid(sid);
    if (!normalizedSid) {
      throw new Error('Organization SID is required.');
    }

    const mutation = {
      id: createMutationId('orgadd'),
      kind: 'organization-membership',
      scope: 'command',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      dedupeKey: `organization-membership:${normalizedSid}`,
      flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
      payload: {
        sid: normalizedSid,
        action: 'add',
      },
    } satisfies OrganizationMembershipMutation;
    enqueueMutation(mutation);
  }, [enqueueMutation]);

  const removeOrganization = useCallback(async (sid: string) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      throw new Error('Authentication required.');
    }

    const normalizedSid = normalizeOrganizationSid(sid);
    if (!normalizedSid) {
      throw new Error('Organization SID is required.');
    }

    const mutation = {
      id: createMutationId('orgremove'),
      kind: 'organization-membership',
      scope: 'command',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      dedupeKey: `organization-membership:${normalizedSid}`,
      flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
      payload: {
        sid: normalizedSid,
        action: 'remove',
      },
    } satisfies OrganizationMembershipMutation;
    enqueueMutation(mutation);
  }, [enqueueMutation]);

  const claimOrganizationBinding = useCallback(async (sid: string) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      throw new Error('Authentication required.');
    }

    const normalizedSid = normalizeOrganizationSid(sid);
    if (!normalizedSid) {
      throw new Error('Organization SID is required.');
    }

    const mutation = {
      id: createMutationId('orgclaim'),
      kind: 'organization-claim',
      scope: 'command',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      dedupeKey: `organization-claim:${normalizedSid}`,
      flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
      payload: {
        sid: normalizedSid,
      },
    } satisfies OrganizationClaimMutation;
    enqueueMutation(mutation);
  }, [enqueueMutation]);

  const deleteOrganizationBinding = useCallback(async (sid: string) => {
    const nextAccount = await deleteOwnedOrganization(sid);
    setServerAccount(nextAccount);
    setSyncError(null);
  }, []);

  const setOrganizationBlueprintSharingBinding = useCallback(
    async (sid: string, enabled: boolean) => {
      const currentAccount = applyOptimisticAccountMutations(
        serverAccountRef.current,
        pendingMutationsRef.current,
      );
      if (!currentAccount) {
        throw new Error('Authentication required.');
      }

      const normalizedSid = normalizeOrganizationSid(sid);
      if (!normalizedSid) {
        throw new Error('Organization SID is required.');
      }

      const mutation = {
        id: createMutationId('orgshare'),
        kind: 'organization-sharing',
        scope: 'command',
        createdAt: Date.now(),
        accountId: currentAccount.accountId,
        dedupeKey: `organization-sharing:${normalizedSid}`,
        flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
        payload: {
          sid: normalizedSid,
          enabled,
        },
      } satisfies OrganizationSharingMutation;
      enqueueMutation(mutation);
    },
    [enqueueMutation],
  );

  const refreshOrganizationMembersBinding = useCallback(async (sid: string) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      throw new Error('Authentication required.');
    }

    const normalizedSid = normalizeOrganizationSid(sid);
    if (!normalizedSid) {
      throw new Error('Organization SID is required.');
    }

    const mutation = {
      id: createMutationId('orgrefresh'),
      kind: 'organization-refresh',
      scope: 'command',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      dedupeKey: `organization-refresh:${normalizedSid}`,
      flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
      payload: {
        sid: normalizedSid,
      },
    } satisfies OrganizationRefreshMutation;
    enqueueMutation(mutation);
  }, [enqueueMutation]);

  const loadOrganizationSharedBlueprintsBinding = useCallback(async (sid: string) => {
    return fetchOrganizationSharedBlueprints(sid);
  }, []);

  const requestOrganizationCraftBinding = useCallback<
    AuthState['requestOrganizationCraft']
  >(async (sid, payload) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      throw new Error('Authentication required.');
    }

    if (!currentAccount.rsi?.handle) {
      throw new Error('Link an RSI account before sending craft requests.');
    }

    const normalizedSid = normalizeOrganizationSid(sid);
    const normalizedBlueprintId = normalizeText(payload.blueprintId);
    const normalizedOwnerHandle = normalizeText(payload.ownerHandle);
    if (!normalizedSid || !normalizedBlueprintId || !normalizedOwnerHandle) {
      throw new Error('Organization, blueprint and owner are required.');
    }

    const duplicatePendingRequest = currentAccount.outgoingCraftRequests.some(
      (request) =>
        request.status === 'pending' &&
        request.organizationSid === normalizedSid &&
        request.blueprintId === normalizedBlueprintId &&
        normalizeText(request.ownerRsiHandle).toLowerCase() ===
          normalizedOwnerHandle.toLowerCase(),
    );
    if (duplicatePendingRequest) {
      throw new Error('A craft request is already pending for this blueprint and owner.');
    }

    const createdAt = new Date().toISOString();
    const storageScopeForRequest = resolveClientStorageScope(window.location.origin);
    const mutation = {
      id: createMutationId('craftcreate'),
      kind: 'craft-request-create',
      scope: 'command',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      dedupeKey: `craft-request-create:${normalizedSid}:${normalizedBlueprintId}:${normalizedOwnerHandle.toLowerCase()}`,
      flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
      payload: {
        organizationSid: normalizedSid,
        blueprintId: normalizedBlueprintId,
        blueprintName: payload.blueprintName,
        ownerHandle: normalizedOwnerHandle,
        comment: payload.comment ?? null,
        resourcesOption: payload.resourcesOption ?? 'unspecified',
        appBaseUrl: window.location.origin,
        storageScope: storageScopeForRequest,
        tempRequestId: createMutationId('craftreq'),
        createdAtIso: createdAt,
      },
    } satisfies CraftRequestCreateMutation;

    enqueueMutation(mutation);

    return {
      id: mutation.payload.tempRequestId,
      appBaseUrl: mutation.payload.appBaseUrl,
      storageScope: mutation.payload.storageScope,
      organizationSid: normalizedSid,
      organizationName:
        currentAccount.organizations.find((organization) => organization.sid === normalizedSid)
          ?.name ?? normalizedSid,
      blueprintId: normalizedBlueprintId,
      blueprintName: payload.blueprintName ?? normalizedBlueprintId,
      requesterAccountId: currentAccount.accountId,
      requesterDisplayName: currentAccount.profile.displayName,
      requesterAvatarUrl: currentAccount.profile.avatarUrl,
      requesterRsiHandle: currentAccount.rsi.handle,
      ownerAccountId: `pending:${normalizedSid}:${normalizedOwnerHandle}`,
      ownerDisplayName: normalizedOwnerHandle,
      ownerAvatarUrl: null,
      ownerRsiHandle: normalizedOwnerHandle,
      comment: payload.comment ?? null,
      resourcesOption: payload.resourcesOption ?? 'unspecified',
      ownerDiscordChannelId: null,
      ownerDiscordMessageId: null,
      contactInitiatedAt: null,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
      respondedAt: null,
    };
  }, [enqueueMutation]);

  const respondToCraftRequestBinding = useCallback<
    AuthState['respondToCraftRequest']
  >(async (requestId, decision) => {
    const currentAccount = applyOptimisticAccountMutations(
      serverAccountRef.current,
      pendingMutationsRef.current,
    );
    if (!currentAccount) {
      throw new Error('Authentication required.');
    }

    const request = [
      ...currentAccount.incomingCraftRequests,
      ...currentAccount.outgoingCraftRequests,
    ].find((entry) => entry.id === requestId);
    if (!request) {
      throw new Error('Craft request not found.');
    }

    const mutation = {
      id: createMutationId('craftdecision'),
      kind: 'craft-request-decision',
      scope: 'command',
      createdAt: Date.now(),
      accountId: currentAccount.accountId,
      dedupeKey: `craft-request-decision:${requestId}`,
      flushAfterMs: DEFAULT_CLICK_FLUSH_MS,
      payload: {
        requestId,
        decision,
      },
    } satisfies CraftRequestDecisionMutation;
    enqueueMutation(mutation);
    return decision;
  }, [enqueueMutation]);

  const value = useMemo<AuthState>(
    () => ({
      enabled: session.enabled,
      loading,
      user: session.user,
      provider: session.provider,
      account,
      optimisticState,
      pendingMutationCount: pendingMutations.length,
      syncStatus,
      syncError,
      clearSyncError,
      refreshSession,
      flushPendingMutations,
      loginWithDiscord,
      logout,
      syncAccountState,
      queueAccountStateUpdate,
      deleteAccount,
      linkRsiAccount,
      unlinkRsiAccount: unlinkRsiAccountBinding,
      updateOrganizationBlueprintShares,
      queueOrganizationBlueprintSharesUpdate,
      addOrganization,
      removeOrganization,
      claimOrganization: claimOrganizationBinding,
      deleteOrganization: deleteOrganizationBinding,
      setOrganizationBlueprintSharing: setOrganizationBlueprintSharingBinding,
      refreshOrganizationMembers: refreshOrganizationMembersBinding,
      loadOrganizationSharedBlueprints: loadOrganizationSharedBlueprintsBinding,
      requestOrganizationCraft: requestOrganizationCraftBinding,
      respondToCraftRequest: respondToCraftRequestBinding,
    }),
    [
      account,
      addOrganization,
      claimOrganizationBinding,
      clearSyncError,
      deleteAccount,
      deleteOrganizationBinding,
      flushPendingMutations,
      linkRsiAccount,
      loadOrganizationSharedBlueprintsBinding,
      loading,
      loginWithDiscord,
      logout,
      optimisticState,
      pendingMutations.length,
      queueAccountStateUpdate,
      queueOrganizationBlueprintSharesUpdate,
      refreshOrganizationMembersBinding,
      refreshSession,
      removeOrganization,
      requestOrganizationCraftBinding,
      respondToCraftRequestBinding,
      session.enabled,
      session.provider,
      session.user,
      setOrganizationBlueprintSharingBinding,
      syncAccountState,
      syncError,
      syncStatus,
      unlinkRsiAccountBinding,
      updateOrganizationBlueprintShares,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
