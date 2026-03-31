import type {
  AccountCraftRequest,
  AccountCraftRequestResourcesOption,
  AccountCraftRequestStatus,
  AccountOrganization,
  AccountStateSnapshot,
  StoredAccount,
} from '../services/authService';

export type AccountMutationScope = 'snapshot' | 'map' | 'command';
export type AccountSyncStatus = 'idle' | 'pending' | 'syncing' | 'error';

export interface PersistedAccountMutationBase {
  id: string;
  kind:
    | 'account-snapshot'
    | 'organization-blueprint-shares'
    | 'craft-request-create'
    | 'craft-request-decision'
    | 'organization-membership'
    | 'organization-sharing'
    | 'organization-claim'
    | 'organization-refresh';
  scope: AccountMutationScope;
  createdAt: number;
  accountId: string;
  dedupeKey?: string;
  flushAfterMs: number;
}

export interface AccountSnapshotMutation extends PersistedAccountMutationBase {
  kind: 'account-snapshot';
  scope: 'snapshot';
  payload: AccountStateSnapshot;
}

export interface OrganizationBlueprintSharesMutation
  extends PersistedAccountMutationBase {
  kind: 'organization-blueprint-shares';
  scope: 'map';
  payload: {
    organizationBlueprintShares: Record<string, string[]>;
  };
}

export interface CraftRequestCreateMutation extends PersistedAccountMutationBase {
  kind: 'craft-request-create';
  scope: 'command';
  payload: {
    organizationSid: string;
    blueprintId: string;
    blueprintName?: string;
    ownerHandle: string;
    comment?: string | null;
    resourcesOption?: AccountCraftRequestResourcesOption;
    appBaseUrl: string;
    storageScope: 'prod' | 'dev';
    tempRequestId: string;
    createdAtIso: string;
  };
}

export interface CraftRequestDecisionMutation extends PersistedAccountMutationBase {
  kind: 'craft-request-decision';
  scope: 'command';
  payload: {
    requestId: string;
    decision: 'accepted' | 'denied' | 'closed' | 'deleted';
  };
}

export interface OrganizationMembershipMutation
  extends PersistedAccountMutationBase {
  kind: 'organization-membership';
  scope: 'command';
  payload: {
    sid: string;
    action: 'add' | 'remove';
  };
}

export interface OrganizationSharingMutation extends PersistedAccountMutationBase {
  kind: 'organization-sharing';
  scope: 'command';
  payload: {
    sid: string;
    enabled: boolean;
  };
}

export interface OrganizationClaimMutation extends PersistedAccountMutationBase {
  kind: 'organization-claim';
  scope: 'command';
  payload: {
    sid: string;
  };
}

export interface OrganizationRefreshMutation extends PersistedAccountMutationBase {
  kind: 'organization-refresh';
  scope: 'command';
  payload: {
    sid: string;
  };
}

export type PersistedAccountMutation =
  | AccountSnapshotMutation
  | OrganizationBlueprintSharesMutation
  | CraftRequestCreateMutation
  | CraftRequestDecisionMutation
  | OrganizationMembershipMutation
  | OrganizationSharingMutation
  | OrganizationClaimMutation
  | OrganizationRefreshMutation;

export interface OptimisticAccountState {
  account: StoredAccount | null;
  pendingMutations: PersistedAccountMutation[];
  syncStatus: AccountSyncStatus;
  lastFlushAt: number | null;
  lastError: string | null;
}

const MUTATION_STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'sc-craft-account-mutations';
const BROADCAST_CHANNEL_NAME = 'sc-craft-account-mutations';

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const next: string[] = [];
  for (const entry of value) {
    const normalizedEntry = normalizeText(entry);
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      continue;
    }
    seen.add(normalizedEntry);
    next.push(normalizedEntry);
  }
  return next;
}

function normalizeAccountStateSnapshot(value: unknown): AccountStateSnapshot {
  const snapshot = (value ?? {}) as Partial<AccountStateSnapshot>;
  return {
    favoriteBlueprintIds: normalizeStringArray(snapshot.favoriteBlueprintIds),
    inventoryBlueprintIds: normalizeStringArray(snapshot.inventoryBlueprintIds),
    planner: {
      goals: Array.isArray(snapshot.planner?.goals) ? [...snapshot.planner.goals] : [],
      todoItems: Array.isArray(snapshot.planner?.todoItems)
        ? [...snapshot.planner.todoItems]
        : [],
      resourceRequirements:
        snapshot.planner?.resourceRequirements &&
        typeof snapshot.planner.resourceRequirements === 'object'
          ? { ...snapshot.planner.resourceRequirements }
          : {},
      resourceProgress:
        snapshot.planner?.resourceProgress &&
        typeof snapshot.planner.resourceProgress === 'object'
          ? { ...snapshot.planner.resourceProgress }
          : {},
    },
  };
}

function normalizeOrganizationSid(value: unknown): string {
  const input = normalizeText(value);
  if (!input) {
    return '';
  }
  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  return (urlMatch?.[1] ?? input).trim().toUpperCase();
}

function normalizeOrganizationBlueprintSharesPayload(
  value: unknown,
): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const next: Record<string, string[]> = {};
  for (const [rawSid, rawBlueprintIds] of Object.entries(value)) {
    const sid = normalizeOrganizationSid(rawSid);
    if (!sid) {
      continue;
    }
    const blueprintIds = normalizeStringArray(rawBlueprintIds);
    if (blueprintIds.length > 0) {
      next[sid] = blueprintIds;
    }
  }
  return next;
}

function deriveSharedBlueprintIds(
  organizationBlueprintShares: Record<string, string[]>,
): string[] {
  return normalizeStringArray(Object.values(organizationBlueprintShares).flat());
}

function sortOrganizations(organizations: AccountOrganization[]): AccountOrganization[] {
  return [...organizations].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'profile-main' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function cloneAccount(account: StoredAccount): StoredAccount {
  return {
    ...account,
    favoriteBlueprintIds: [...account.favoriteBlueprintIds],
    inventoryBlueprintIds: [...account.inventoryBlueprintIds],
    planner: {
      goals: [...account.planner.goals],
      todoItems: [...account.planner.todoItems],
      resourceRequirements: { ...account.planner.resourceRequirements },
      resourceProgress: { ...account.planner.resourceProgress },
    },
    organizationBlueprintShares: Object.fromEntries(
      Object.entries(account.organizationBlueprintShares ?? {}).map(([sid, blueprintIds]) => [
        sid,
        [...blueprintIds],
      ]),
    ),
    sharedBlueprintIds: [...(account.sharedBlueprintIds ?? [])],
    organizations: [...(account.organizations ?? [])],
    incomingCraftRequests: [...(account.incomingCraftRequests ?? [])],
    outgoingCraftRequests: [...(account.outgoingCraftRequests ?? [])],
  };
}

function buildTemporaryOrganizationRef(
  account: StoredAccount,
  sid: string,
  nowIso: string,
): AccountOrganization {
  const existing =
    account.organizations.find((organization) => organization.sid === sid) ?? null;
  if (existing) {
    return existing;
  }

  return {
    sid,
    source: 'manual',
    name: sid,
    image: null,
    status: 'observed',
    rank: null,
    stars: null,
    lastSeenAt: nowIso,
    lastVerifiedAt: null,
    claimed: false,
    claimedByCurrentUser: false,
    blueprintSharingEnabled: true,
    deletedAt: null,
    lastLiveSyncAt: null,
    nextEligibleLiveSyncAt: null,
    staleAt: null,
    memberCount: 0,
    syncStatus: 'never',
    claimRequestStatus: null,
    claimRequestSubmittedAt: null,
  };
}

function updateCraftRequestInCollection(
  requests: AccountCraftRequest[],
  requestId: string,
  updater: (request: AccountCraftRequest) => AccountCraftRequest,
): AccountCraftRequest[] {
  return requests.map((request) =>
    request.id === requestId ? updater(request) : request,
  );
}

function applyAccountSnapshotMutation(
  account: StoredAccount,
  mutation: AccountSnapshotMutation,
): StoredAccount {
  const snapshot = normalizeAccountStateSnapshot(mutation.payload);
  const organizationBlueprintShares = normalizeOrganizationBlueprintSharesPayload(
    account.organizationBlueprintShares,
  );

  return {
    ...account,
    favoriteBlueprintIds: snapshot.favoriteBlueprintIds,
    inventoryBlueprintIds: snapshot.inventoryBlueprintIds,
    planner: snapshot.planner,
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIds(organizationBlueprintShares),
  };
}

function applyOrganizationBlueprintSharesMutation(
  account: StoredAccount,
  mutation: OrganizationBlueprintSharesMutation,
): StoredAccount {
  const inventorySet = new Set(account.inventoryBlueprintIds);
  const organizationBlueprintShares = Object.fromEntries(
    Object.entries(
      normalizeOrganizationBlueprintSharesPayload(
        mutation.payload.organizationBlueprintShares,
      ),
    )
      .map(([sid, blueprintIds]) => [
        sid,
        blueprintIds.filter((blueprintId) => inventorySet.has(blueprintId)),
      ])
      .filter(([, blueprintIds]) => blueprintIds.length > 0),
  );

  return {
    ...account,
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIds(organizationBlueprintShares),
  };
}

function applyCraftRequestCreateMutation(
  account: StoredAccount,
  mutation: CraftRequestCreateMutation,
): StoredAccount {
  const nowIso = mutation.payload.createdAtIso;
  const organizationSid = normalizeOrganizationSid(mutation.payload.organizationSid);
  const organization =
    account.organizations.find((entry) => entry.sid === organizationSid) ?? null;
  const request: AccountCraftRequest = {
    id: mutation.payload.tempRequestId,
    appBaseUrl: mutation.payload.appBaseUrl,
    storageScope: mutation.payload.storageScope,
    organizationSid,
    organizationName: organization?.name ?? organizationSid,
    blueprintId: normalizeText(mutation.payload.blueprintId),
    blueprintName:
      normalizeText(mutation.payload.blueprintName) ||
      normalizeText(mutation.payload.blueprintId),
    requesterAccountId: account.accountId,
    requesterDisplayName: account.profile.displayName,
    requesterAvatarUrl: account.profile.avatarUrl,
    requesterRsiHandle: account.rsi?.handle ?? null,
    ownerAccountId: `pending:${organizationSid}:${normalizeText(mutation.payload.ownerHandle)}`,
    ownerDisplayName: normalizeText(mutation.payload.ownerHandle),
    ownerAvatarUrl: null,
    ownerRsiHandle: normalizeText(mutation.payload.ownerHandle) || null,
    comment: mutation.payload.comment ?? null,
    resourcesOption: mutation.payload.resourcesOption ?? 'unspecified',
    ownerDiscordChannelId: null,
    ownerDiscordMessageId: null,
    contactInitiatedAt: null,
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
    respondedAt: null,
  };

  const alreadyPresent = account.outgoingCraftRequests.some(
    (existingRequest) => existingRequest.id === request.id,
  );
  if (alreadyPresent) {
    return account;
  }

  return {
    ...account,
    outgoingCraftRequests: [request, ...account.outgoingCraftRequests],
  };
}

function applyCraftRequestDecisionMutation(
  account: StoredAccount,
  mutation: CraftRequestDecisionMutation,
): StoredAccount {
  if (mutation.payload.decision === 'deleted') {
    return {
      ...account,
      incomingCraftRequests: account.incomingCraftRequests.filter(
        (request) => request.id !== mutation.payload.requestId,
      ),
      outgoingCraftRequests: account.outgoingCraftRequests.filter(
        (request) => request.id !== mutation.payload.requestId,
      ),
    };
  }

  const nowIso = new Date(mutation.createdAt).toISOString();
  const applyDecision = (request: AccountCraftRequest): AccountCraftRequest => ({
    ...request,
    status: mutation.payload.decision as AccountCraftRequestStatus,
    updatedAt: nowIso,
    respondedAt:
      mutation.payload.decision === 'accepted' || mutation.payload.decision === 'denied'
        ? nowIso
        : request.respondedAt ?? nowIso,
  });

  return {
    ...account,
    incomingCraftRequests: updateCraftRequestInCollection(
      account.incomingCraftRequests,
      mutation.payload.requestId,
      applyDecision,
    ),
    outgoingCraftRequests: updateCraftRequestInCollection(
      account.outgoingCraftRequests,
      mutation.payload.requestId,
      applyDecision,
    ),
  };
}

function applyOrganizationMembershipMutation(
  account: StoredAccount,
  mutation: OrganizationMembershipMutation,
): StoredAccount {
  const sid = normalizeOrganizationSid(mutation.payload.sid);
  if (!sid) {
    return account;
  }

  if (mutation.payload.action === 'remove') {
    const nextShares = { ...account.organizationBlueprintShares };
    delete nextShares[sid];
    return {
      ...account,
      organizations: account.organizations.filter((organization) => organization.sid !== sid),
      organizationBlueprintShares: nextShares,
      sharedBlueprintIds: deriveSharedBlueprintIds(nextShares),
    };
  }

  const nextOrganization = buildTemporaryOrganizationRef(
    account,
    sid,
    new Date(mutation.createdAt).toISOString(),
  );
  return {
    ...account,
    organizations: sortOrganizations(
      account.organizations.some((organization) => organization.sid === sid)
        ? account.organizations
        : [...account.organizations, nextOrganization],
    ),
  };
}

function applyOrganizationSharingMutation(
  account: StoredAccount,
  mutation: OrganizationSharingMutation,
): StoredAccount {
  const sid = normalizeOrganizationSid(mutation.payload.sid);
  if (!sid) {
    return account;
  }

  return {
    ...account,
    organizations: account.organizations.map((organization) =>
      organization.sid === sid
        ? { ...organization, blueprintSharingEnabled: mutation.payload.enabled }
        : organization,
    ),
  };
}

function applyOrganizationClaimMutation(
  account: StoredAccount,
  mutation: OrganizationClaimMutation,
): StoredAccount {
  const sid = normalizeOrganizationSid(mutation.payload.sid);
  if (!sid) {
    return account;
  }

  const submittedAt = new Date(mutation.createdAt).toISOString();
  return {
    ...account,
    organizations: account.organizations.map((organization) =>
      organization.sid === sid
        ? {
            ...organization,
            claimRequestStatus: 'pending',
            claimRequestSubmittedAt: submittedAt,
          }
        : organization,
    ),
  };
}

function applyOrganizationRefreshMutation(
  account: StoredAccount,
  mutation: OrganizationRefreshMutation,
): StoredAccount {
  const sid = normalizeOrganizationSid(mutation.payload.sid);
  if (!sid) {
    return account;
  }

  return account;
}

export function applyOptimisticAccountMutations(
  account: StoredAccount | null,
  mutations: PersistedAccountMutation[],
): StoredAccount | null {
  if (!account) {
    return null;
  }

  return mutations.reduce<StoredAccount>((currentAccount, mutation) => {
    switch (mutation.kind) {
      case 'account-snapshot':
        return applyAccountSnapshotMutation(currentAccount, mutation);
      case 'organization-blueprint-shares':
        return applyOrganizationBlueprintSharesMutation(currentAccount, mutation);
      case 'craft-request-create':
        return applyCraftRequestCreateMutation(currentAccount, mutation);
      case 'craft-request-decision':
        return applyCraftRequestDecisionMutation(currentAccount, mutation);
      case 'organization-membership':
        return applyOrganizationMembershipMutation(currentAccount, mutation);
      case 'organization-sharing':
        return applyOrganizationSharingMutation(currentAccount, mutation);
      case 'organization-claim':
        return applyOrganizationClaimMutation(currentAccount, mutation);
      case 'organization-refresh':
        return applyOrganizationRefreshMutation(currentAccount, mutation);
      default:
        return currentAccount;
    }
  }, cloneAccount(account));
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeMutationBase(
  value: Record<string, unknown>,
): PersistedAccountMutationBase | null {
  const id = normalizeText(value.id);
  const accountId = normalizeText(value.accountId);
  const kind = normalizeText(value.kind) as PersistedAccountMutationBase['kind'];
  const scope = normalizeText(value.scope) as AccountMutationScope;
  const createdAt = Number(value.createdAt);
  const flushAfterMs = Number(value.flushAfterMs);
  const allowedKinds = new Set<PersistedAccountMutationBase['kind']>([
    'account-snapshot',
    'organization-blueprint-shares',
    'craft-request-create',
    'craft-request-decision',
    'organization-membership',
    'organization-sharing',
    'organization-claim',
    'organization-refresh',
  ]);
  if (
    !id ||
    !accountId ||
    !allowedKinds.has(kind) ||
    (scope !== 'snapshot' && scope !== 'map' && scope !== 'command') ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(flushAfterMs)
  ) {
    return null;
  }

  return {
    id,
    accountId,
    kind,
    scope,
    createdAt,
    flushAfterMs,
    dedupeKey: normalizeText(value.dedupeKey) || undefined,
  };
}

function normalizePersistedMutation(value: unknown): PersistedAccountMutation | null {
  const raw = readObject(value);
  if (!raw) {
    return null;
  }

  const base = normalizeMutationBase(raw);
  if (!base) {
    return null;
  }

  switch (base.kind) {
    case 'account-snapshot':
      return {
        ...base,
        kind: 'account-snapshot',
        scope: 'snapshot',
        payload: normalizeAccountStateSnapshot(raw.payload),
      };
    case 'organization-blueprint-shares':
      return {
        ...base,
        kind: 'organization-blueprint-shares',
        scope: 'map',
        payload: {
          organizationBlueprintShares: normalizeOrganizationBlueprintSharesPayload(
            readObject(raw.payload)?.organizationBlueprintShares ?? {},
          ),
        },
      };
    case 'craft-request-create': {
      const payload = readObject(raw.payload);
      if (!payload) {
        return null;
      }
      return {
        ...base,
        kind: 'craft-request-create',
        scope: 'command',
        payload: {
          organizationSid: normalizeOrganizationSid(payload.organizationSid),
          blueprintId: normalizeText(payload.blueprintId),
          blueprintName: normalizeText(payload.blueprintName) || undefined,
          ownerHandle: normalizeText(payload.ownerHandle),
          comment: normalizeText(payload.comment) || null,
          resourcesOption:
            normalizeText(payload.resourcesOption) === 'has_resources' ||
            normalizeText(payload.resourcesOption) === 'buy_resources'
              ? (normalizeText(payload.resourcesOption) as AccountCraftRequestResourcesOption)
              : 'unspecified',
          appBaseUrl: normalizeText(payload.appBaseUrl),
          storageScope:
            normalizeText(payload.storageScope).toLowerCase() === 'dev' ? 'dev' : 'prod',
          tempRequestId: normalizeText(payload.tempRequestId),
          createdAtIso:
            normalizeText(payload.createdAtIso) || new Date(base.createdAt).toISOString(),
        },
      };
    }
    case 'craft-request-decision': {
      const payload = readObject(raw.payload);
      const decision = normalizeText(payload?.decision);
      if (
        !payload ||
        (decision !== 'accepted' && decision !== 'denied' && decision !== 'closed')
      ) {
        return null;
      }
      return {
        ...base,
        kind: 'craft-request-decision',
        scope: 'command',
        payload: {
          requestId: normalizeText(payload.requestId),
          decision,
        },
      };
    }
    case 'organization-membership': {
      const payload = readObject(raw.payload);
      const action = normalizeText(payload?.action);
      if (!payload || (action !== 'add' && action !== 'remove')) {
        return null;
      }
      return {
        ...base,
        kind: 'organization-membership',
        scope: 'command',
        payload: {
          sid: normalizeOrganizationSid(payload.sid),
          action,
        },
      };
    }
    case 'organization-sharing': {
      const payload = readObject(raw.payload);
      if (!payload) {
        return null;
      }
      return {
        ...base,
        kind: 'organization-sharing',
        scope: 'command',
        payload: {
          sid: normalizeOrganizationSid(payload.sid),
          enabled: payload.enabled !== false,
        },
      };
    }
    case 'organization-claim': {
      const payload = readObject(raw.payload);
      if (!payload) {
        return null;
      }
      return {
        ...base,
        kind: 'organization-claim',
        scope: 'command',
        payload: {
          sid: normalizeOrganizationSid(payload.sid),
        },
      };
    }
    case 'organization-refresh': {
      const payload = readObject(raw.payload);
      if (!payload) {
        return null;
      }
      return {
        ...base,
        kind: 'organization-refresh',
        scope: 'command',
        payload: {
          sid: normalizeOrganizationSid(payload.sid),
        },
      };
    }
    default:
      return null;
  }
}

export function resolveClientStorageScope(origin = window.location.origin): 'prod' | 'dev' {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('preview.') ||
      (hostname.endsWith('.space-craft-planner.pages.dev') &&
        hostname !== 'space-craft-planner.pages.dev')
    ) {
      return 'dev';
    }
  } catch {
    return 'prod';
  }

  return 'prod';
}

export function buildMutationStorageKey(
  accountId: string,
  storageScope: 'prod' | 'dev',
  origin = window.location.origin,
): string {
  return `${STORAGE_PREFIX}:v${MUTATION_STORAGE_VERSION}:${storageScope}:${origin}:${accountId}`;
}

export function buildMutationLockKey(
  accountId: string,
  storageScope: 'prod' | 'dev',
  origin = window.location.origin,
): string {
  return `${buildMutationStorageKey(accountId, storageScope, origin)}:lock`;
}

export function getMutationBroadcastChannelName(): string {
  return BROADCAST_CHANNEL_NAME;
}

export function readPersistedAccountMutations(
  storageKey: string,
): PersistedAccountMutation[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as { version?: number; mutations?: unknown[] } | unknown[];
    const mutations = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.mutations)
        ? parsed.mutations
        : [];
    return mutations
      .map((entry) => normalizePersistedMutation(entry))
      .filter((entry): entry is PersistedAccountMutation => Boolean(entry))
      .sort((left, right) => left.createdAt - right.createdAt);
  } catch {
    return [];
  }
}

export function writePersistedAccountMutations(
  storageKey: string,
  mutations: PersistedAccountMutation[],
): void {
  if (mutations.length === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      version: MUTATION_STORAGE_VERSION,
      mutations,
    }),
  );
}

export function coalescePersistedMutations(
  currentMutations: PersistedAccountMutation[],
  nextMutation: PersistedAccountMutation,
): PersistedAccountMutation[] {
  const filteredMutations = currentMutations.filter((mutation) => {
    if (mutation.kind === 'account-snapshot' && nextMutation.kind === 'account-snapshot') {
      return false;
    }
    if (
      mutation.kind === 'organization-blueprint-shares' &&
      nextMutation.kind === 'organization-blueprint-shares'
    ) {
      return false;
    }
    if (
      mutation.dedupeKey &&
      nextMutation.dedupeKey &&
      mutation.dedupeKey === nextMutation.dedupeKey
    ) {
      return false;
    }
    return true;
  });

  return [...filteredMutations, nextMutation].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}
