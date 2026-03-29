import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addAccountOrganization,
  createOrganizationCraftRequest,
  deleteCurrentAccount,
  fetchCurrentAccount,
  fetchAuthSession,
  fetchOrganizationSharedBlueprints,
  getDiscordLoginUrl,
  logoutAuthSession,
  refreshAccountOrganizationMembers,
  removeAccountOrganization,
  respondToOrganizationCraftRequest,
  saveOrganizationBlueprintShares,
  saveCurrentAccountState,
  unlinkRsiAccount,
  verifyAndLinkRsiAccount,
  claimAccountOrganization,
  type AuthSessionResponse,
  type AccountStateSnapshot,
  type AccountCraftRequest,
  type AccountCraftRequestStatus,
  type OrganizationSharedBlueprintPayload,
  type StoredAccount,
  type AuthenticatedUser,
} from '../services/authService';

interface AuthState {
  enabled: boolean;
  loading: boolean;
  user: AuthenticatedUser | null;
  provider: 'discord' | null;
  account: StoredAccount | null;
  refreshSession: () => Promise<void>;
  loginWithDiscord: (returnTo?: string) => void;
  logout: () => Promise<void>;
  syncAccountState: (snapshot: AccountStateSnapshot) => Promise<void>;
  deleteAccount: () => Promise<void>;
  linkRsiAccount: (handle: string, code: string) => Promise<void>;
  unlinkRsiAccount: () => Promise<void>;
  updateOrganizationBlueprintShares: (organizationBlueprintShares: Record<string, string[]>) => Promise<void>;
  addOrganization: (sid: string) => Promise<void>;
  removeOrganization: (sid: string) => Promise<void>;
  claimOrganization: (sid: string) => Promise<void>;
  refreshOrganizationMembers: (sid: string) => Promise<void>;
  loadOrganizationSharedBlueprints: (sid: string) => Promise<OrganizationSharedBlueprintPayload>;
  requestOrganizationCraft: (
    sid: string,
    payload: {
      blueprintId: string;
      blueprintName?: string;
      ownerHandle: string;
    },
  ) => Promise<AccountCraftRequest>;
  respondToCraftRequest: (
    requestId: string,
    decision: 'accepted' | 'denied' | 'closed',
  ) => Promise<AccountCraftRequestStatus>;
}

const AuthContext = createContext<AuthState | null>(null);

function getCurrentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionResponse>({
    enabled: false,
    provider: null,
    user: null,
  });
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const nextSession = await fetchAuthSession();
      setSession(nextSession);
      if (nextSession.user) {
        try {
          const nextAccount = await fetchCurrentAccount();
          setAccount(nextAccount);
        } catch {
          setAccount(null);
        }
      } else {
        setAccount(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const loginWithDiscord = useCallback((returnTo?: string) => {
    window.location.assign(getDiscordLoginUrl(returnTo ?? getCurrentReturnTo()));
  }, []);

  const logout = useCallback(async () => {
    await logoutAuthSession();
    await refreshSession();
  }, [refreshSession]);

  const syncAccountState = useCallback(async (snapshot: AccountStateSnapshot) => {
    const nextAccount = await saveCurrentAccountState(snapshot);
    setAccount(nextAccount);
  }, []);

  const deleteAccount = useCallback(async () => {
    await deleteCurrentAccount();
    await refreshSession();
  }, [refreshSession]);

  const linkRsiAccount = useCallback(async (handle: string, code: string) => {
    const nextAccount = await verifyAndLinkRsiAccount(handle, code);
    setAccount(nextAccount);
  }, []);

  const unlinkRsiAccountBinding = useCallback(async () => {
    const nextAccount = await unlinkRsiAccount();
    setAccount(nextAccount);
  }, []);

  const updateOrganizationBlueprintShares = useCallback(async (organizationBlueprintShares: Record<string, string[]>) => {
    const nextAccount = await saveOrganizationBlueprintShares(organizationBlueprintShares);
    setAccount(nextAccount);
  }, []);

  const addOrganization = useCallback(async (sid: string) => {
    const nextAccount = await addAccountOrganization(sid);
    setAccount(nextAccount);
  }, []);

  const removeOrganization = useCallback(async (sid: string) => {
    const nextAccount = await removeAccountOrganization(sid);
    setAccount(nextAccount);
  }, []);

  const claimOrganizationBinding = useCallback(async (sid: string) => {
    const nextAccount = await claimAccountOrganization(sid);
    setAccount(nextAccount);
  }, []);

  const refreshOrganizationMembersBinding = useCallback(async (sid: string) => {
    const nextAccount = await refreshAccountOrganizationMembers(sid);
    setAccount(nextAccount);
  }, []);

  const loadOrganizationSharedBlueprintsBinding = useCallback(async (sid: string) => {
    return fetchOrganizationSharedBlueprints(sid);
  }, []);

  const requestOrganizationCraftBinding = useCallback(
    async (
      sid: string,
      payload: {
        blueprintId: string;
        blueprintName?: string;
        ownerHandle: string;
      },
    ) => {
      const result = await createOrganizationCraftRequest(sid, payload);
      setAccount(result.account);
      return result.request;
    },
    [],
  );

  const respondToCraftRequestBinding = useCallback(
    async (requestId: string, decision: 'accepted' | 'denied' | 'closed') => {
      const result = await respondToOrganizationCraftRequest(requestId, decision);
      setAccount(result.account);
      return result.status;
    },
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      enabled: session.enabled,
      loading,
      user: session.user,
      provider: session.provider,
      account,
      refreshSession,
      loginWithDiscord,
      logout,
      syncAccountState,
      deleteAccount,
      linkRsiAccount,
      unlinkRsiAccount: unlinkRsiAccountBinding,
      updateOrganizationBlueprintShares,
      addOrganization,
      removeOrganization,
      claimOrganization: claimOrganizationBinding,
      refreshOrganizationMembers: refreshOrganizationMembersBinding,
      loadOrganizationSharedBlueprints: loadOrganizationSharedBlueprintsBinding,
      requestOrganizationCraft: requestOrganizationCraftBinding,
      respondToCraftRequest: respondToCraftRequestBinding,
    }),
    [
      addOrganization,
      account,
      claimOrganizationBinding,
      deleteAccount,
      loading,
      linkRsiAccount,
      loginWithDiscord,
      loadOrganizationSharedBlueprintsBinding,
      logout,
      refreshOrganizationMembersBinding,
      refreshSession,
      removeOrganization,
      requestOrganizationCraftBinding,
      respondToCraftRequestBinding,
      session.enabled,
      session.provider,
      session.user,
      syncAccountState,
      unlinkRsiAccountBinding,
      updateOrganizationBlueprintShares,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
