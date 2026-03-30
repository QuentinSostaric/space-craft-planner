import type {
  CraftGoal,
  PlannerResourceRequirements,
  PlannerTodoItem,
  ResourceProgress,
} from '../types';

export interface AuthenticatedUser {
  id: string;
  username: string;
  globalName: string | null;
  discriminator: string | null;
  avatarUrl: string | null;
  displayName: string;
}

export interface AuthSessionResponse {
  enabled: boolean;
  provider: 'discord' | null;
  user: AuthenticatedUser | null;
}

export interface AccountPlannerState {
  goals: CraftGoal[];
  todoItems: PlannerTodoItem[];
  resourceRequirements: PlannerResourceRequirements;
  resourceProgress: Record<string, ResourceProgress>;
}

export interface LinkedRsiAccount {
  handle: string;
  displayName: string | null;
  profileUrl: string | null;
  verifiedAt: string | null;
}

export type AccountOrganizationSource = 'profile-main' | 'manual';
export type AccountOrganizationStatus = 'observed' | 'verified_member' | 'verified_admin';
export type AccountOrganizationSyncStatus = 'never' | 'fresh' | 'stale';
export type AccountOrganizationClaimRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';
export type AccountCraftRequestStatus = 'pending' | 'accepted' | 'denied' | 'closed';
export type AccountCraftRequestResourcesOption =
  | 'unspecified'
  | 'has_resources'
  | 'buy_resources';

export type CraftRequestDecision = 'accepted' | 'denied' | 'closed';

export interface CraftRequestBulkDecisionAction {
  requestId: string;
  decision: CraftRequestDecision;
}

export interface CraftRequestBulkDecisionResult {
  requestId: string;
  ok: boolean;
  status?: AccountCraftRequestStatus;
  error?: string;
  errorStatus?: number;
}

export interface AccountBulkCraftRequestDecisionResponse {
  account: StoredAccount;
  results: CraftRequestBulkDecisionResult[];
}

export interface AccountOrganization {
  sid: string;
  source: AccountOrganizationSource;
  name: string;
  image: string | null;
  logo?: string | null;
  url?: string | null;
  archetype?: string | null;
  commitment?: string | null;
  primaryFocus?: string | null;
  secondaryFocus?: string | null;
  lang?: string | null;
  status: AccountOrganizationStatus;
  rank: string | null;
  stars: number | null;
  lastSeenAt: string | null;
  lastVerifiedAt: string | null;
  claimed?: boolean;
  claimedByCurrentUser?: boolean;
  blueprintSharingEnabled?: boolean;
  deletedAt?: string | null;
  lastLiveSyncAt?: string | null;
  nextEligibleLiveSyncAt?: string | null;
  staleAt?: string | null;
  memberCount?: number;
  syncStatus?: AccountOrganizationSyncStatus;
  claimRequestStatus?: AccountOrganizationClaimRequestStatus | null;
  claimRequestSubmittedAt?: string | null;
}

export interface AccountCraftRequest {
  id: string;
  appBaseUrl?: string | null;
  storageScope?: 'prod' | 'dev';
  organizationSid: string;
  organizationName: string;
  blueprintId: string;
  blueprintName: string;
  requesterAccountId: string;
  requesterDisplayName: string;
  requesterAvatarUrl: string | null;
  requesterRsiHandle: string | null;
  ownerAccountId: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  ownerRsiHandle: string | null;
  comment: string | null;
  resourcesOption: AccountCraftRequestResourcesOption;
  ownerDiscordChannelId?: string | null;
  ownerDiscordMessageId?: string | null;
  contactInitiatedAt?: string | null;
  status: AccountCraftRequestStatus;
  createdAt: string | null;
  updatedAt: string | null;
  respondedAt: string | null;
}

export interface OrganizationSharedBlueprintMember {
  handle: string;
  display: string;
  image: string | null;
  rank: string | null;
  stars: number | null;
  sharedBlueprintIds: string[];
}

export interface OrganizationSharedBlueprintPayload {
  organization: {
    sid: string;
    name: string;
    image: string | null;
    logo: string | null;
    url: string | null;
    claimed: boolean;
    blueprintSharingEnabled: boolean;
    lastLiveSyncAt: string | null;
    staleAt: string | null;
    memberCount: number;
    syncStatus: AccountOrganizationSyncStatus;
  };
  members: OrganizationSharedBlueprintMember[];
}

export interface StoredAccount {
  accountId: string;
  provider: 'discord';
  providerUserId: string;
  profile: AuthenticatedUser;
  favoriteBlueprintIds: string[];
  inventoryBlueprintIds: string[];
  planner: AccountPlannerState;
  organizationBlueprintShares: Record<string, string[]>;
  sharedBlueprintIds: string[];
  organizations: AccountOrganization[];
  incomingCraftRequests: AccountCraftRequest[];
  outgoingCraftRequests: AccountCraftRequest[];
  rsi: LinkedRsiAccount | null;
  isAdmin: boolean;
  lastRsiLinkAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
}

const DISCORD_BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1487753855944097834';

export interface AccountStateSnapshot {
  favoriteBlueprintIds: string[];
  inventoryBlueprintIds: string[];
  planner: AccountPlannerState;
}

export class AuthApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function authApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Non-JSON response - HTTP ${response.status}`);
  }

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? `HTTP ${response.status}`;
    throw new AuthApiError(response.status, message);
  }

  return payload as T;
}

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  return authApiFetch<AuthSessionResponse>('/api/auth/session');
}

export async function logoutAuthSession(): Promise<void> {
  await authApiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function fetchCurrentAccount(): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>('/api/auth/account');
  return payload.account;
}

export async function saveCurrentAccountState(
  snapshot: AccountStateSnapshot,
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>('/api/auth/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  return payload.account;
}

export async function deleteCurrentAccount(): Promise<void> {
  await authApiFetch<{ ok: boolean }>('/api/auth/account', {
    method: 'DELETE',
  });
}

export async function verifyAndLinkRsiAccount(
  handle: string,
  code: string,
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>('/api/auth/account/rsi-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ handle, code }),
  });

  return payload.account;
}

export async function unlinkRsiAccount(): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>('/api/auth/account/rsi-link', {
    method: 'DELETE',
  });

  return payload.account;
}

export async function saveOrganizationBlueprintShares(
  organizationBlueprintShares: Record<string, string[]>,
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    '/api/auth/account/shared-blueprints',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationBlueprintShares }),
    },
  );

  return payload.account;
}

export async function addAccountOrganization(sid: string): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    '/api/auth/account/organizations',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sid }),
    },
  );

  return payload.account;
}

export async function removeAccountOrganization(sid: string): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    `/api/auth/account/organizations/${encodeURIComponent(sid)}`,
    {
      method: 'DELETE',
    },
  );

  return payload.account;
}

export async function claimAccountOrganization(sid: string): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    `/api/auth/organizations/${encodeURIComponent(sid)}/claim`,
    {
      method: 'POST',
    },
  );

  return payload.account;
}

export async function deleteOwnedOrganization(sid: string): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    `/api/auth/organizations/${encodeURIComponent(sid)}`,
    {
      method: 'DELETE',
    },
  );

  return payload.account;
}

export async function setAccountOrganizationBlueprintSharing(
  sid: string,
  enabled: boolean,
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    `/api/auth/organizations/${encodeURIComponent(sid)}/sharing`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    },
  );

  return payload.account;
}

export async function refreshAccountOrganizationMembers(sid: string): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    `/api/auth/organizations/${encodeURIComponent(sid)}/refresh`,
    {
      method: 'POST',
    },
  );

  return payload.account;
}

export async function fetchOrganizationSharedBlueprints(
  sid: string,
): Promise<OrganizationSharedBlueprintPayload> {
  return authApiFetch<OrganizationSharedBlueprintPayload>(
    `/api/auth/organizations/${encodeURIComponent(sid)}/shared-blueprints`,
  );
}

export async function createOrganizationCraftRequest(
  sid: string,
  payload: {
    blueprintId: string;
    blueprintName?: string;
    ownerHandle: string;
    comment?: string | null;
    resourcesOption?: AccountCraftRequestResourcesOption;
  },
): Promise<{ account: StoredAccount; request: AccountCraftRequest }> {
  return authApiFetch<{ account: StoredAccount; request: AccountCraftRequest }>(
    `/api/auth/organizations/${encodeURIComponent(sid)}/craft-requests`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
}

export async function respondToOrganizationCraftRequest(
  requestId: string,
  decision: CraftRequestDecision,
): Promise<{ account: StoredAccount; requestId: string; status: AccountCraftRequestStatus }> {
  return authApiFetch<{
    account: StoredAccount;
    requestId: string;
    status: AccountCraftRequestStatus;
  }>(`/api/auth/craft-requests/${encodeURIComponent(requestId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision }),
  });
}

export async function respondToOrganizationCraftRequestsBulk(
  actions: CraftRequestBulkDecisionAction[],
): Promise<AccountBulkCraftRequestDecisionResponse> {
  return authApiFetch<AccountBulkCraftRequestDecisionResponse>('/api/auth/craft-requests/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actions }),
  });
}

export function getDiscordLoginUrl(returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  const suffix = params.toString();
  return suffix ? `/api/auth/discord/login?${suffix}` : '/api/auth/discord/login';
}

export function getDiscordBotInviteUrl(): string {
  return DISCORD_BOT_INVITE_URL;
}
