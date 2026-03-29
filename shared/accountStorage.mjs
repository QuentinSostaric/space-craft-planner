import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getJsonObject, putJsonObject } from './r2Storage.mjs';
import { normalizeRsiHandle, normalizeRsiLink } from './rsiLink.mjs';

const ACCOUNT_RECORD_VERSION = 8;
export const RSI_LINK_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;
const ADMIN_DISCORD_USERNAMES = new Set(['thsamon']);
const ADMIN_RSI_HANDLES = new Set(['thesamon']);
const ACCOUNT_ORGANIZATION_SOURCES = new Set(['profile-main', 'manual']);
const ACCOUNT_ORGANIZATION_STATUSES = new Set([
  'observed',
  'verified_member',
  'verified_admin',
]);
const ACCOUNT_CRAFT_REQUEST_STATUSES = new Set([
  'pending',
  'accepted',
  'denied',
  'closed',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeCaseInsensitiveKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeIsoTimestamp(value) {
  const timestamp = String(value ?? '').trim();
  if (!timestamp) {
    return null;
  }

  return Number.isNaN(Date.parse(timestamp)) ? null : timestamp;
}

function pickLatestIsoTimestamp(left, right) {
  const normalizedLeft = normalizeIsoTimestamp(left);
  const normalizedRight = normalizeIsoTimestamp(right);
  if (!normalizedLeft) {
    return normalizedRight;
  }
  if (!normalizedRight) {
    return normalizedLeft;
  }

  return Date.parse(normalizedLeft) >= Date.parse(normalizedRight)
    ? normalizedLeft
    : normalizedRight;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const entry of value) {
    const next = String(entry ?? '').trim();
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}

function normalizeGoals(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => isObject(entry));
}

function normalizeOptionalString(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeRecordMap(value) {
  if (!isObject(value)) {
    return {};
  }

  return { ...value };
}

function normalizePlannerState(value) {
  const planner = isObject(value) ? value : {};

  return {
    goals: normalizeGoals(planner.goals),
    resourceRequirements: normalizeRecordMap(planner.resourceRequirements),
    resourceProgress: normalizeRecordMap(planner.resourceProgress),
  };
}

function normalizeProfile(user) {
  if (!user?.id) {
    throw new Error('Discord user id is required to normalize the account profile.');
  }

  const displayName =
    String(user.displayName ?? user.globalName ?? user.username ?? '').trim() || 'Discord user';

  return {
    id: String(user.id),
    username: String(user.username ?? displayName),
    globalName: user.globalName ? String(user.globalName) : null,
    discriminator: user.discriminator ? String(user.discriminator) : null,
    avatarUrl: user.avatarUrl ? String(user.avatarUrl) : null,
    displayName,
  };
}

function deriveAdminFlag(profile, rsiLink = null) {
  const usernameKey = normalizeCaseInsensitiveKey(profile?.username);
  const rsiHandleKey = normalizeCaseInsensitiveKey(rsiLink?.handle);
  return ADMIN_DISCORD_USERNAMES.has(usernameKey) || ADMIN_RSI_HANDLES.has(rsiHandleKey);
}

function normalizeAdminFlag(value, profile, rsiLink = null) {
  return Boolean(value) || deriveAdminFlag(profile, rsiLink);
}

function normalizeStateSnapshot(snapshot) {
  const value = isObject(snapshot) ? snapshot : {};

  return {
    favoriteBlueprintIds: normalizeStringArray(value.favoriteBlueprintIds),
    inventoryBlueprintIds: normalizeStringArray(value.inventoryBlueprintIds),
    planner: normalizePlannerState(value.planner),
  };
}

function normalizeOrganizationSid(value) {
  const input = String(value ?? '').trim();
  if (!input) {
    return null;
  }

  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  const sid = (urlMatch?.[1] ?? input).trim().toUpperCase();
  return sid || null;
}

function normalizeIgnoredOrganizationSids(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const entry of value) {
    const sid = normalizeOrganizationSid(entry);
    if (!sid || seen.has(sid)) {
      continue;
    }

    seen.add(sid);
    normalized.push(sid);
  }

  return normalized;
}

function normalizeOrganizationSource(value) {
  const source = String(value ?? '').trim().toLowerCase();
  return ACCOUNT_ORGANIZATION_SOURCES.has(source) ? source : 'manual';
}

function normalizeOrganizationStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  return ACCOUNT_ORGANIZATION_STATUSES.has(status) ? status : 'observed';
}

function organizationStatusRank(status) {
  if (status === 'verified_admin') {
    return 2;
  }
  if (status === 'verified_member') {
    return 1;
  }
  return 0;
}

function normalizeOrganizationStars(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.round(number));
}

function normalizeCraftRequestStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'refused') {
    return 'denied';
  }
  if (status === 'cancelled') {
    return 'closed';
  }
  return ACCOUNT_CRAFT_REQUEST_STATUSES.has(status) ? status : 'pending';
}

function normalizeCraftRequestStorageScope(value) {
  return String(value ?? '').trim().toLowerCase() === 'dev' ? 'dev' : 'prod';
}

function normalizeAccountCraftRequest(value) {
  if (!isObject(value)) {
    return null;
  }

  const id = String(value.id ?? '').trim();
  const organizationSid = normalizeOrganizationSid(value.organizationSid);
  const blueprintId = String(value.blueprintId ?? '').trim();
  const requesterAccountId = String(value.requesterAccountId ?? '').trim();
  const ownerAccountId = String(value.ownerAccountId ?? '').trim();
  if (!id || !organizationSid || !blueprintId || !requesterAccountId || !ownerAccountId) {
    return null;
  }

  return {
    id,
    appBaseUrl: normalizeOptionalString(value.appBaseUrl),
    storageScope: normalizeCraftRequestStorageScope(value.storageScope),
    organizationSid,
    organizationName: String(value.organizationName ?? organizationSid).trim() || organizationSid,
    blueprintId,
    blueprintName: String(value.blueprintName ?? blueprintId).trim() || blueprintId,
    requesterAccountId,
    requesterDisplayName:
      String(value.requesterDisplayName ?? requesterAccountId).trim() || requesterAccountId,
    requesterAvatarUrl: normalizeOptionalString(value.requesterAvatarUrl),
    requesterRsiHandle: normalizeRsiHandle(value.requesterRsiHandle),
    ownerAccountId,
    ownerDisplayName: String(value.ownerDisplayName ?? ownerAccountId).trim() || ownerAccountId,
    ownerAvatarUrl: normalizeOptionalString(value.ownerAvatarUrl),
    ownerRsiHandle: normalizeRsiHandle(value.ownerRsiHandle),
    status: normalizeCraftRequestStatus(value.status),
    createdAt: normalizeIsoTimestamp(value.createdAt),
    updatedAt: normalizeIsoTimestamp(value.updatedAt),
    respondedAt: normalizeIsoTimestamp(value.respondedAt),
  };
}

function normalizeAccountCraftRequests(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const byId = new Map();
  for (const entry of value) {
    const normalizedEntry = normalizeAccountCraftRequest(entry);
    if (!normalizedEntry) {
      continue;
    }

    const existing = byId.get(normalizedEntry.id);
    if (!existing) {
      byId.set(normalizedEntry.id, normalizedEntry);
      continue;
    }

    const existingUpdatedAt = Date.parse(existing.updatedAt ?? existing.createdAt ?? 0);
    const nextUpdatedAt = Date.parse(
      normalizedEntry.updatedAt ?? normalizedEntry.createdAt ?? 0,
    );
    byId.set(
      normalizedEntry.id,
      Number.isFinite(nextUpdatedAt) && nextUpdatedAt >= existingUpdatedAt
        ? normalizedEntry
        : existing,
    );
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftTimestamp = Date.parse(left.updatedAt ?? left.createdAt ?? 0);
    const rightTimestamp = Date.parse(right.updatedAt ?? right.createdAt ?? 0);
    return rightTimestamp - leftTimestamp;
  });
}

function normalizeAccountOrganizationRef(value) {
  if (!isObject(value)) {
    return null;
  }

  const sid = normalizeOrganizationSid(value.sid);
  if (!sid) {
    return null;
  }

  const source = normalizeOrganizationSource(value.source);
  const status = normalizeOrganizationStatus(value.status);

  return {
    sid,
    source,
    name: String(value.name ?? '').trim() || sid,
    image: value.image ? String(value.image) : null,
    status,
    rank: value.rank ? String(value.rank) : null,
    stars: normalizeOrganizationStars(value.stars),
    lastSeenAt: normalizeIsoTimestamp(value.lastSeenAt),
    lastVerifiedAt:
      status === 'observed'
        ? null
        : normalizeIsoTimestamp(value.lastVerifiedAt),
  };
}

function mergeAccountOrganizationRefs(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  const useIncomingVerification =
    organizationStatusRank(incoming.status) >= organizationStatusRank(existing.status);

  return normalizeAccountOrganizationRef({
    sid: existing.sid,
    source:
      existing.source === 'profile-main' || incoming.source === 'profile-main'
        ? 'profile-main'
        : 'manual',
    name: incoming.name || existing.name,
    image: incoming.image || existing.image,
    status: useIncomingVerification ? incoming.status : existing.status,
    rank: useIncomingVerification ? (incoming.rank ?? existing.rank) : (existing.rank ?? incoming.rank),
    stars: useIncomingVerification ? (incoming.stars ?? existing.stars) : (existing.stars ?? incoming.stars),
    lastSeenAt: pickLatestIsoTimestamp(existing.lastSeenAt, incoming.lastSeenAt),
    lastVerifiedAt: pickLatestIsoTimestamp(existing.lastVerifiedAt, incoming.lastVerifiedAt),
  });
}

function normalizeAccountOrganizations(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const bySid = new Map();
  for (const entry of value) {
    const normalizedEntry = normalizeAccountOrganizationRef(entry);
    if (!normalizedEntry) {
      continue;
    }

    const existing = bySid.get(normalizedEntry.sid);
    bySid.set(normalizedEntry.sid, mergeAccountOrganizationRefs(existing, normalizedEntry));
  }

  return Array.from(bySid.values()).sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'profile-main' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function clipSharedBlueprintIdsToInventory(sharedBlueprintIds, inventoryBlueprintIds) {
  const inventorySet = new Set(normalizeStringArray(inventoryBlueprintIds));
  return normalizeStringArray(sharedBlueprintIds).filter((blueprintId) => inventorySet.has(blueprintId));
}

function normalizeOrganizationBlueprintShares(
  value,
  inventoryBlueprintIds,
  organizations,
  legacySharedBlueprintIds = [],
) {
  const inventorySet = new Set(normalizeStringArray(inventoryBlueprintIds));
  const knownOrganizationSids = new Set(
    normalizeAccountOrganizations(organizations).map((organization) => organization.sid),
  );
  const normalizedShares = {};

  if (isObject(value)) {
    for (const [rawSid, rawBlueprintIds] of Object.entries(value)) {
      const sid = normalizeOrganizationSid(rawSid);
      if (!sid) {
        continue;
      }
      if (knownOrganizationSids.size > 0 && !knownOrganizationSids.has(sid)) {
        continue;
      }

      const normalizedBlueprintIds = normalizeStringArray(rawBlueprintIds).filter((blueprintId) =>
        inventorySet.has(blueprintId),
      );
      if (normalizedBlueprintIds.length > 0) {
        normalizedShares[sid] = normalizedBlueprintIds;
      }
    }
  }

  if (Object.keys(normalizedShares).length === 0 && knownOrganizationSids.size > 0) {
    const migratedBlueprintIds = clipSharedBlueprintIdsToInventory(
      legacySharedBlueprintIds,
      inventoryBlueprintIds,
    );
    if (migratedBlueprintIds.length > 0) {
      for (const sid of knownOrganizationSids) {
        normalizedShares[sid] = [...migratedBlueprintIds];
      }
    }
  }

  return normalizedShares;
}

function deriveSharedBlueprintIdsFromOrganizationShares(
  organizationBlueprintShares,
  legacySharedBlueprintIds = [],
) {
  const derivedSharedBlueprintIds = normalizeStringArray(
    Object.values(organizationBlueprintShares ?? {}).flat(),
  );
  return derivedSharedBlueprintIds.length > 0
    ? derivedSharedBlueprintIds
    : normalizeStringArray(legacySharedBlueprintIds);
}

function clearOrganizationVerification(ref) {
  return normalizeAccountOrganizationRef({
    ...ref,
    status: 'observed',
    rank: null,
    stars: null,
    lastVerifiedAt: null,
  });
}

function resetOrganizationsForRsiUnlink(organizations) {
  return normalizeAccountOrganizations(
    normalizeAccountOrganizations(organizations)
      .filter((ref) => ref.source !== 'profile-main')
      .map((ref) => clearOrganizationVerification(ref)),
  );
}

function resetOrganizationsForChangedRsiHandle(organizations) {
  return normalizeAccountOrganizations(
    normalizeAccountOrganizations(organizations)
      .filter((ref) => ref.source !== 'profile-main')
      .map((ref) => clearOrganizationVerification(ref)),
  );
}

export function buildAccountIdFromDiscordUser(discordUserId) {
  const normalizedUserId = String(discordUserId ?? '').trim();
  if (!normalizedUserId) {
    throw new Error('Discord user id is required to build an account id.');
  }

  return `discord_${normalizedUserId}`;
}

export function getAccountObjectKey(accountId) {
  const normalizedAccountId = String(accountId ?? '').trim();
  if (!normalizedAccountId) {
    throw new Error('Account id is required to build the account storage key.');
  }

  return `accounts/${normalizedAccountId}.json`;
}

function getRsiHandleIndexKey(handle) {
  const normalizedHandle = normalizeCaseInsensitiveKey(normalizeRsiHandle(handle));
  if (!normalizedHandle) {
    throw new Error('RSI handle is required to build the handle index key.');
  }

  return `accounts-indexes/rsi-handles/${normalizedHandle}.json`;
}

async function writeRsiHandleIndex(store, accountId, handle) {
  const normalizedHandle = normalizeRsiHandle(handle);
  if (!normalizedHandle) {
    return;
  }

  await store.writeJson(getRsiHandleIndexKey(normalizedHandle), {
    accountId,
    handle: normalizedHandle,
    updatedAt: toIsoNow(),
  });
}

async function deleteRsiHandleIndex(store, handle) {
  const normalizedHandle = normalizeRsiHandle(handle);
  if (!normalizedHandle) {
    return;
  }

  await store.deleteObject(getRsiHandleIndexKey(normalizedHandle));
}

export async function readAccountIdByRsiHandle(store, handle) {
  const normalizedHandle = normalizeRsiHandle(handle);
  if (!normalizedHandle) {
    return null;
  }

  const payload = await store.readJson(getRsiHandleIndexKey(normalizedHandle));
  const accountId = String(payload?.accountId ?? '').trim();
  return accountId || null;
}

export function createEmptyAccountState() {
  return normalizeStateSnapshot({});
}

export function createDefaultAccountRecord(profile, { accountId, now } = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const timestamp = now ?? toIsoNow();
  const normalizedAccountId = accountId ?? buildAccountIdFromDiscordUser(normalizedProfile.id);
  const isAdmin = normalizeAdminFlag(false, normalizedProfile);

  return {
    version: ACCOUNT_RECORD_VERSION,
    accountId: normalizedAccountId,
    provider: 'discord',
    providerUserId: normalizedProfile.id,
    profile: normalizedProfile,
    favoriteBlueprintIds: [],
    inventoryBlueprintIds: [],
    planner: createEmptyAccountState().planner,
    organizationBlueprintShares: {},
    sharedBlueprintIds: [],
    organizations: [],
    ignoredOrganizationSids: [],
    incomingCraftRequests: [],
    outgoingCraftRequests: [],
    rsi: null,
    isAdmin,
    lastRsiLinkAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: timestamp,
  };
}

export function normalizeAccountRecord(value, { fallbackProfile, accountId } = {}) {
  const profile = value?.profile || fallbackProfile;
  if (!profile?.id) {
    return null;
  }

  const normalizedProfile = normalizeProfile(profile);
  const normalizedAccountId =
    String(value?.accountId ?? accountId ?? buildAccountIdFromDiscordUser(normalizedProfile.id)).trim();
  const createdAt = value?.createdAt ? String(value.createdAt) : null;
  const updatedAt = value?.updatedAt ? String(value.updatedAt) : createdAt;
  const lastLoginAt = value?.lastLoginAt ? String(value.lastLoginAt) : null;
  const state = normalizeStateSnapshot(value);
  const rsi = normalizeRsiLink(value?.rsi);
  const organizations = normalizeAccountOrganizations(value?.organizations);
  const ignoredOrganizationSids = normalizeIgnoredOrganizationSids(value?.ignoredOrganizationSids);
  const legacySharedBlueprintIds = clipSharedBlueprintIdsToInventory(
    value?.sharedBlueprintIds,
    state.inventoryBlueprintIds,
  );
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    value?.organizationBlueprintShares,
    state.inventoryBlueprintIds,
    organizations,
    legacySharedBlueprintIds,
  );
  const incomingCraftRequests = normalizeAccountCraftRequests(value?.incomingCraftRequests);
  const outgoingCraftRequests = normalizeAccountCraftRequests(value?.outgoingCraftRequests);
  const sharedBlueprintIds = deriveSharedBlueprintIdsFromOrganizationShares(
    organizationBlueprintShares,
    legacySharedBlueprintIds,
  );
  const lastRsiLinkAt = normalizeIsoTimestamp(value?.lastRsiLinkAt ?? rsi?.verifiedAt);
  const isAdmin = normalizeAdminFlag(value?.isAdmin, normalizedProfile, rsi);

  return {
    version: ACCOUNT_RECORD_VERSION,
    accountId: normalizedAccountId,
    provider: 'discord',
    providerUserId: String(value?.providerUserId ?? normalizedProfile.id),
    profile: normalizedProfile,
    favoriteBlueprintIds: state.favoriteBlueprintIds,
    inventoryBlueprintIds: state.inventoryBlueprintIds,
    planner: state.planner,
    organizationBlueprintShares,
    sharedBlueprintIds,
    organizations,
    ignoredOrganizationSids,
    incomingCraftRequests,
    outgoingCraftRequests,
    rsi,
    isAdmin,
    lastRsiLinkAt,
    createdAt,
    updatedAt,
    lastLoginAt,
  };
}

async function writeNormalizedAccountRecord(store, accountRecord) {
  const normalizedAccount = normalizeAccountRecord(accountRecord, {
    fallbackProfile: accountRecord?.profile,
    accountId: accountRecord?.accountId,
  });
  if (!normalizedAccount) {
    throw new Error('A valid account record is required.');
  }

  await store.writeJson(getAccountObjectKey(normalizedAccount.accountId), normalizedAccount);
  return normalizedAccount;
}

export async function writeAccountRecord(store, accountRecord) {
  return writeNormalizedAccountRecord(store, accountRecord);
}

export function getNextAllowedRsiLinkAt(account, now = Date.now()) {
  if (account?.isAdmin) {
    return null;
  }

  const lastLinkedAt = normalizeIsoTimestamp(account?.lastRsiLinkAt ?? account?.rsi?.verifiedAt);
  if (!lastLinkedAt) {
    return null;
  }

  const nextAllowedAt = Date.parse(lastLinkedAt) + RSI_LINK_COOLDOWN_MS;
  return nextAllowedAt > now ? new Date(nextAllowedAt).toISOString() : null;
}

export function isRsiLinkRateLimited(account, now = Date.now()) {
  if (account?.isAdmin) {
    return false;
  }

  return Boolean(getNextAllowedRsiLinkAt(account, now));
}

export function createBucketAccountStore(bucket) {
  if (!bucket?.get || !bucket?.put || !bucket?.delete) {
    throw new Error('A valid Cloudflare R2 bucket binding is required for account storage.');
  }

  return {
    async readJson(key) {
      const object = await bucket.get(key);
      if (!object) {
        return null;
      }

      return JSON.parse(await object.text());
    },
    async writeJson(key, payload) {
      await bucket.put(key, JSON.stringify(payload), {
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
        },
      });
    },
    async deleteObject(key) {
      await bucket.delete(key);
    },
  };
}

export function createS3AccountStore(client, bucketName) {
  if (!client || !bucketName) {
    throw new Error('A valid S3 client and bucket name are required for account storage.');
  }

  return {
    async readJson(key) {
      return getJsonObject(client, bucketName, key);
    },
    async writeJson(key, payload) {
      await putJsonObject(client, bucketName, key, payload, {
        cacheControl: 'no-store',
      });
    },
    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    },
  };
}

export async function readAccountRecord(store, accountId, fallbackProfile = null) {
  const rawAccount = await store.readJson(getAccountObjectKey(accountId));
  if (!rawAccount) {
    return null;
  }

  return normalizeAccountRecord(rawAccount, {
    fallbackProfile,
    accountId,
  });
}

export async function upsertDiscordAccount(store, profile) {
  const normalizedProfile = normalizeProfile(profile);
  const accountId = buildAccountIdFromDiscordUser(normalizedProfile.id);
  const existing = await readAccountRecord(store, accountId, normalizedProfile);
  const now = toIsoNow();
  const base = existing ?? createDefaultAccountRecord(normalizedProfile, { accountId, now });
  const organizations = normalizeAccountOrganizations(existing?.organizations);
  const ignoredOrganizationSids = normalizeIgnoredOrganizationSids(existing?.ignoredOrganizationSids);
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    existing?.organizationBlueprintShares,
    base.inventoryBlueprintIds,
    organizations,
    existing?.sharedBlueprintIds,
  );
  const nextRecord = {
    ...base,
    version: ACCOUNT_RECORD_VERSION,
    provider: 'discord',
    providerUserId: normalizedProfile.id,
    profile: normalizedProfile,
    isAdmin: normalizeAdminFlag(existing?.isAdmin, normalizedProfile, existing?.rsi ?? null),
    lastRsiLinkAt: normalizeIsoTimestamp(existing?.lastRsiLinkAt),
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      clipSharedBlueprintIdsToInventory(existing?.sharedBlueprintIds, base.inventoryBlueprintIds),
    ),
    organizations,
    ignoredOrganizationSids,
    incomingCraftRequests: normalizeAccountCraftRequests(existing?.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing?.outgoingCraftRequests),
    createdAt: base.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: now,
  };

  return writeNormalizedAccountRecord(store, nextRecord);
}

export async function saveAccountState(store, accountId, stateSnapshot, fallbackProfile = null) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const normalizedState = normalizeStateSnapshot(stateSnapshot);
  const now = toIsoNow();
  const organizations = normalizeAccountOrganizations(existing.organizations);
  const ignoredOrganizationSids = normalizeIgnoredOrganizationSids(existing.ignoredOrganizationSids);
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    existing.organizationBlueprintShares,
    normalizedState.inventoryBlueprintIds,
    organizations,
    existing.sharedBlueprintIds,
  );
  const nextRecord = {
    ...existing,
    ...normalizedState,
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      clipSharedBlueprintIdsToInventory(existing.sharedBlueprintIds, normalizedState.inventoryBlueprintIds),
    ),
    organizations,
    ignoredOrganizationSids,
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    isAdmin: normalizeAdminFlag(existing.isAdmin, existing.profile, existing.rsi),
    lastRsiLinkAt: normalizeIsoTimestamp(existing.lastRsiLinkAt),
    updatedAt: now,
  };

  return writeNormalizedAccountRecord(store, nextRecord);
}

export async function saveAccountOrganizations(
  store,
  accountId,
  organizations,
  fallbackProfile = null,
  options = {},
) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const now = toIsoNow();
  const normalizedOrganizations = normalizeAccountOrganizations(organizations);
  const ignoredOrganizationSids = normalizeIgnoredOrganizationSids(
    options?.ignoredOrganizationSids ?? existing.ignoredOrganizationSids,
  );
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    existing.organizationBlueprintShares,
    existing.inventoryBlueprintIds,
    normalizedOrganizations,
    existing.sharedBlueprintIds,
  );
  const nextRecord = {
    ...existing,
    organizations: normalizedOrganizations,
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      clipSharedBlueprintIdsToInventory(existing.sharedBlueprintIds, existing.inventoryBlueprintIds),
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    updatedAt: now,
  };

  return writeNormalizedAccountRecord(store, nextRecord);
}

export async function saveAccountOrganizationBlueprintShares(
  store,
  accountId,
  organizationBlueprintShares,
  fallbackProfile = null,
) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const now = toIsoNow();
  const normalizedOrganizations = normalizeAccountOrganizations(existing.organizations);
  const ignoredOrganizationSids = normalizeIgnoredOrganizationSids(existing.ignoredOrganizationSids);
  const normalizedOrganizationBlueprintShares = normalizeOrganizationBlueprintShares(
    organizationBlueprintShares,
    existing.inventoryBlueprintIds,
    normalizedOrganizations,
    existing.sharedBlueprintIds,
  );
  const nextRecord = {
    ...existing,
    organizations: normalizedOrganizations,
    organizationBlueprintShares: normalizedOrganizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      normalizedOrganizationBlueprintShares,
      existing.sharedBlueprintIds,
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    updatedAt: now,
  };

  return writeNormalizedAccountRecord(store, nextRecord);
}

export async function saveRsiAccountLink(store, accountId, rsiLink, fallbackProfile = null) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const normalizedRsiLink = normalizeRsiLink(rsiLink);
  if (!normalizedRsiLink) {
    throw new Error('A valid RSI account link is required.');
  }

  const existingIndexedAccountId = await readAccountIdByRsiHandle(store, normalizedRsiLink.handle);
  if (existingIndexedAccountId && existingIndexedAccountId !== accountId) {
    throw new Error('This RSI handle is already linked to another account.');
  }

  const now = toIsoNow();
  const previousHandleKey = normalizeCaseInsensitiveKey(existing.rsi?.handle);
  const nextHandleKey = normalizeCaseInsensitiveKey(normalizedRsiLink.handle);
  const ignoredOrganizationSids =
    previousHandleKey && previousHandleKey !== nextHandleKey
      ? []
      : normalizeIgnoredOrganizationSids(existing.ignoredOrganizationSids);
  const organizations =
    previousHandleKey && previousHandleKey !== nextHandleKey
      ? resetOrganizationsForChangedRsiHandle(existing.organizations)
      : normalizeAccountOrganizations(existing.organizations);
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    existing.organizationBlueprintShares,
    existing.inventoryBlueprintIds,
    organizations,
    existing.sharedBlueprintIds,
  );

  const nextRecord = {
    ...existing,
    rsi: normalizedRsiLink,
    organizations,
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      existing.sharedBlueprintIds,
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    isAdmin: normalizeAdminFlag(existing.isAdmin, existing.profile, normalizedRsiLink),
    lastRsiLinkAt: now,
    updatedAt: now,
  };

  const savedAccount = await writeNormalizedAccountRecord(store, nextRecord);
  if (previousHandleKey && previousHandleKey !== nextHandleKey) {
    await deleteRsiHandleIndex(store, existing.rsi?.handle);
  }
  await writeRsiHandleIndex(store, accountId, normalizedRsiLink.handle);
  return savedAccount;
}

export async function clearRsiAccountLink(store, accountId, fallbackProfile = null) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const now = toIsoNow();
  const organizations = resetOrganizationsForRsiUnlink(existing.organizations);
  const ignoredOrganizationSids = [];
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    existing.organizationBlueprintShares,
    existing.inventoryBlueprintIds,
    organizations,
    existing.sharedBlueprintIds,
  );
  const nextRecord = {
    ...existing,
    rsi: null,
    organizations,
    organizationBlueprintShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      existing.sharedBlueprintIds,
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    isAdmin: normalizeAdminFlag(existing.isAdmin, existing.profile, null),
    lastRsiLinkAt: normalizeIsoTimestamp(existing.lastRsiLinkAt),
    updatedAt: now,
  };

  const savedAccount = await writeNormalizedAccountRecord(store, nextRecord);
  await deleteRsiHandleIndex(store, existing.rsi?.handle);
  return savedAccount;
}

export async function deleteAccountRecord(store, accountId, fallbackProfile = null) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (existing?.rsi?.handle) {
    await deleteRsiHandleIndex(store, existing.rsi.handle);
  }

  await store.deleteObject(getAccountObjectKey(accountId));
}
