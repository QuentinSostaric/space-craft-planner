import type {
  CraftGoal,
  PlannerResourceRequirements,
  PlannerTodoItem,
  ResourceProgress,
} from '../types';
import { getApiCredentials, getApiUrl } from './apiBaseUrl';

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

export type AccountDatasetScope = 'live' | 'ptu';

export interface AccountPlannerState {
  goals: CraftGoal[];
  todoItems: PlannerTodoItem[];
  resourceRequirements: PlannerResourceRequirements;
  resourceProgress: Record<string, ResourceProgress>;
}

export type AccountInventoryResourceQuantityUnit = 'scu' | 'count';

export interface AccountInventoryResourceEntry {
  id: string;
  resourceId: string;
  resourceName: string;
  quantity: number;
  quantityUnit: AccountInventoryResourceQuantityUnit;
  quality: number | null;
  createdAt: string | null;
  updatedAt: string | null;
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

export type CraftRequestDecision = 'accepted' | 'denied' | 'closed' | 'deleted';

export interface CraftRequestBulkDecisionAction {
  requestId: string;
  decision: CraftRequestDecision;
}

export interface CraftRequestBulkDecisionResult {
  requestId: string;
  ok: boolean;
  status?: AccountCraftRequestStatus | 'deleted';
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
  datasetScope?: AccountDatasetScope;
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

export interface OrganizationSharedResourceMember {
  handle: string;
  display: string;
  image: string | null;
  rank: string | null;
  stars: number | null;
  sharedResources: AccountInventoryResourceEntry[];
}

export interface OrganizationSharedResourcePayload {
  organization: {
    sid: string;
    name: string;
    image: string | null;
    logo: string | null;
    url: string | null;
    claimed: boolean;
    lastLiveSyncAt: string | null;
    staleAt: string | null;
    memberCount: number;
    syncStatus: AccountOrganizationSyncStatus;
  };
  members: OrganizationSharedResourceMember[];
}

export interface StoredAccount {
  accountId: string;
  datasetScope?: AccountDatasetScope;
  provider: 'discord';
  providerUserId: string;
  profile: AuthenticatedUser;
  favoriteBlueprintIds: string[];
  inventoryBlueprintIds: string[];
  inventoryResources: AccountInventoryResourceEntry[];
  planner: AccountPlannerState;
  organizationBlueprintShares: Record<string, string[]>;
  organizationResourceShares: Record<string, string[]>;
  sharedBlueprintIds: string[];
  sharedResourceEntryIds: string[];
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
  const response = await fetch(getApiUrl(path), {
    credentials: getApiCredentials(),
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

function withDatasetScope(path: string, datasetScope: AccountDatasetScope = 'live'): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}datasetScope=${encodeURIComponent(datasetScope)}`;
}

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  return authApiFetch<AuthSessionResponse>('/api/auth/session');
}

export async function logoutAuthSession(): Promise<void> {
  await authApiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function fetchCurrentAccount(datasetScope: AccountDatasetScope = 'live'): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(withDatasetScope('/api/auth/account', datasetScope));
  return payload.account;
}

export async function copyLiveAccountDataToPtu(): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>('/api/auth/account/copy-live-to-ptu', {
    method: 'POST',
  });
  return payload.account;
}

export async function saveCurrentAccountState(
  snapshot: AccountStateSnapshot,
  datasetScope: AccountDatasetScope = 'live',
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(withDatasetScope('/api/auth/account', datasetScope), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...snapshot, datasetScope }),
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
  datasetScope: AccountDatasetScope = 'live',
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope('/api/auth/account/shared-blueprints', datasetScope),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationBlueprintShares, datasetScope }),
    },
  );

  return payload.account;
}

export async function saveAccountInventoryResources(
  inventoryResources: AccountInventoryResourceEntry[],
  datasetScope: AccountDatasetScope = 'live',
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(withDatasetScope('/api/auth/account/resources', datasetScope), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inventoryResources, datasetScope }),
  });

  return payload.account;
}

export async function saveOrganizationResourceShares(
  organizationResourceShares: Record<string, string[]>,
  datasetScope: AccountDatasetScope = 'live',
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope('/api/auth/account/shared-resources', datasetScope),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationResourceShares, datasetScope }),
    },
  );

  return payload.account;
}

export async function addAccountOrganization(sid: string, datasetScope: AccountDatasetScope = 'live'): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope('/api/auth/account/organizations', datasetScope),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sid, datasetScope }),
    },
  );

  return payload.account;
}

export async function removeAccountOrganization(sid: string, datasetScope: AccountDatasetScope = 'live'): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope(`/api/auth/account/organizations/${encodeURIComponent(sid)}`, datasetScope),
    {
      method: 'DELETE',
    },
  );

  return payload.account;
}

export async function claimAccountOrganization(sid: string, datasetScope: AccountDatasetScope = 'live'): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}/claim`, datasetScope),
    {
      method: 'POST',
    },
  );

  return payload.account;
}

export async function deleteOwnedOrganization(sid: string, datasetScope: AccountDatasetScope = 'live'): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}`, datasetScope),
    {
      method: 'DELETE',
    },
  );

  return payload.account;
}

export async function setAccountOrganizationBlueprintSharing(
  sid: string,
  enabled: boolean,
  datasetScope: AccountDatasetScope = 'live',
): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}/sharing`, datasetScope),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled, datasetScope }),
    },
  );

  return payload.account;
}

export async function refreshAccountOrganizationMembers(sid: string, datasetScope: AccountDatasetScope = 'live'): Promise<StoredAccount> {
  const payload = await authApiFetch<{ account: StoredAccount }>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}/refresh`, datasetScope),
    {
      method: 'POST',
    },
  );

  return payload.account;
}

export async function fetchOrganizationSharedBlueprints(
  sid: string,
  datasetScope: AccountDatasetScope = 'live',
): Promise<OrganizationSharedBlueprintPayload> {
  return authApiFetch<OrganizationSharedBlueprintPayload>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}/shared-blueprints`, datasetScope),
  );
}

export async function fetchOrganizationSharedResources(
  sid: string,
  datasetScope: AccountDatasetScope = 'live',
): Promise<OrganizationSharedResourcePayload> {
  return authApiFetch<OrganizationSharedResourcePayload>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}/shared-resources`, datasetScope),
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
  datasetScope: AccountDatasetScope = 'live',
): Promise<{ account: StoredAccount; request: AccountCraftRequest }> {
  return authApiFetch<{ account: StoredAccount; request: AccountCraftRequest }>(
    withDatasetScope(`/api/auth/organizations/${encodeURIComponent(sid)}/craft-requests`, datasetScope),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, datasetScope }),
    },
  );
}

export async function respondToOrganizationCraftRequest(
  requestId: string,
  decision: CraftRequestDecision,
  datasetScope: AccountDatasetScope = 'live',
): Promise<{ account: StoredAccount; requestId: string; status: AccountCraftRequestStatus | 'deleted' }> {
  return authApiFetch<{
    account: StoredAccount;
    requestId: string;
    status: AccountCraftRequestStatus | 'deleted';
  }>(withDatasetScope(`/api/auth/craft-requests/${encodeURIComponent(requestId)}`, datasetScope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision, datasetScope }),
  });
}

export async function respondToOrganizationCraftRequestsBulk(
  actions: CraftRequestBulkDecisionAction[],
  datasetScope: AccountDatasetScope = 'live',
): Promise<AccountBulkCraftRequestDecisionResponse> {
  return authApiFetch<AccountBulkCraftRequestDecisionResponse>(withDatasetScope('/api/auth/craft-requests/bulk', datasetScope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actions, datasetScope }),
  });
}

export function getDiscordLoginUrl(returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  const suffix = params.toString();
  return getApiUrl(suffix ? `/api/auth/discord/login?${suffix}` : '/api/auth/discord/login');
}

export function getDiscordBotInviteUrl(): string {
  return DISCORD_BOT_INVITE_URL;
}
