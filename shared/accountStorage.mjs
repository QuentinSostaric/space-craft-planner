import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getJsonObject, listObjectKeys, putJsonObject } from './r2Storage.mjs';
import {
  readOrganizationRecord,
  writeOrganizationRecord,
} from './organizationStorage.mjs';
import { normalizeRsiHandle, normalizeRsiLink } from './rsiLink.mjs';
import {
  isObject,
  normalizeIsoTimestamp,
  normalizeOrganizationSid,
  toIsoNow,
} from './normalize.mjs';

const ACCOUNT_RECORD_VERSION = 9;
const ACCOUNT_SCOPE_RECORD_VERSION = 1;
export const RSI_LINK_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;
const ADMIN_DISCORD_USER_IDS = new Set(['183946313669410816']);
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
const ACCOUNT_CRAFT_REQUEST_RESOURCES_OPTIONS = new Set([
  'unspecified',
  'has_resources',
  'buy_resources',
]);
const RESOURCE_QUANTITY_UNITS = new Set(['scu', 'count']);
const RESOURCE_SCU_PRECISION = 1_000_000;
const ACCOUNT_DATASET_SCOPES = new Set(['live', 'ptu']);

export function normalizeAccountDatasetScope(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ACCOUNT_DATASET_SCOPES.has(normalized) ? normalized : 'live';
}

function normalizeCaseInsensitiveKey(value) {
  return String(value ?? '').trim().toLowerCase();
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

function sortStringArray(value) {
  return normalizeStringArray(value).sort((left, right) =>
    left.localeCompare(right, undefined, {
      sensitivity: 'base',
      numeric: true,
    }),
  );
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

function normalizePlannerTodoSource(value) {
  return String(value ?? '').trim().toLowerCase() === 'mission-blueprint'
    ? 'mission-blueprint'
    : 'manual';
}

function normalizePlannerTodoItem(value) {
  if (!isObject(value)) {
    return null;
  }

  const id = String(value.id ?? '').trim();
  const title = String(value.title ?? '').trim();
  if (!id || !title) {
    return null;
  }

  const createdAt = Number(value.createdAt);
  const completedAt = value.completedAt == null ? null : Number(value.completedAt);

  return {
    id,
    title,
    description: value.description ? String(value.description) : null,
    source: normalizePlannerTodoSource(value.source),
    relatedBlueprintId: value.relatedBlueprintId ? String(value.relatedBlueprintId) : null,
    relatedBlueprintName: value.relatedBlueprintName ? String(value.relatedBlueprintName) : null,
    completed: Boolean(value.completed),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    completedAt: Number.isFinite(completedAt) ? completedAt : null,
  };
}

function normalizePlannerTodoItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const byId = new Map();
  for (const entry of value) {
    const normalizedEntry = normalizePlannerTodoItem(entry);
    if (!normalizedEntry) {
      continue;
    }
    byId.set(normalizedEntry.id, normalizedEntry);
  }

  return Array.from(byId.values()).sort((left, right) => right.createdAt - left.createdAt);
}

function normalizePlannerState(value) {
  const planner = isObject(value) ? value : {};

  return {
    goals: normalizeGoals(planner.goals),
    todoItems: normalizePlannerTodoItems(planner.todoItems),
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
  const discordUserId = String(profile?.id ?? '').trim();
  return ADMIN_DISCORD_USER_IDS.has(discordUserId);
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

function normalizeCraftRequestResourcesOption(value, fallbackHasResources = false, fallbackBuyResources = false) {
  if (fallbackHasResources) {
    return 'has_resources';
  }
  if (fallbackBuyResources) {
    return 'buy_resources';
  }

  const option = String(value ?? '').trim().toLowerCase();
  if (option === 'has-resources' || option === 'hasresources') {
    return 'has_resources';
  }
  if (option === 'buy-resources' || option === 'buyresources') {
    return 'buy_resources';
  }

  return ACCOUNT_CRAFT_REQUEST_RESOURCES_OPTIONS.has(option) ? option : 'unspecified';
}

function normalizeResourceQuantityUnit(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return RESOURCE_QUANTITY_UNITS.has(normalized) ? normalized : 'scu';
}

function normalizeResourceQuality(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(1000, Math.round(number)));
}

function normalizeResourceQuantity(value, quantityUnit = 'scu') {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  if (quantityUnit === 'count') {
    return Math.max(1, Math.round(number));
  }

  return Math.round(number * RESOURCE_SCU_PRECISION) / RESOURCE_SCU_PRECISION;
}

function normalizeAccountInventoryResourceEntry(value) {
  if (!isObject(value)) {
    return null;
  }

  const id = String(value.id ?? '').trim();
  const resourceId = String(value.resourceId ?? '').trim();
  const resourceName = String(value.resourceName ?? resourceId).trim();
  const quantityUnit = normalizeResourceQuantityUnit(value.quantityUnit);
  const quantity = normalizeResourceQuantity(value.quantity, quantityUnit);
  if (!id || !resourceId || !resourceName || quantity <= 0) {
    return null;
  }

  return {
    id,
    resourceId,
    resourceName,
    quantity,
    quantityUnit,
    quality: normalizeResourceQuality(value.quality),
    createdAt: normalizeIsoTimestamp(value.createdAt),
    updatedAt: normalizeIsoTimestamp(value.updatedAt),
  };
}

function normalizeAccountInventoryResources(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const byId = new Map();
  for (const entry of value) {
    const normalizedEntry = normalizeAccountInventoryResourceEntry(entry);
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
    datasetScope: normalizeAccountDatasetScope(value.datasetScope),
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
    comment: normalizeOptionalString(value.comment),
    resourcesOption: normalizeCraftRequestResourcesOption(
      value.resourcesOption,
      value.requesterHasResources === true,
      value.requesterWillBuyResources === true,
    ),
    ownerDiscordChannelId: normalizeOptionalString(value.ownerDiscordChannelId),
    ownerDiscordMessageId: normalizeOptionalString(value.ownerDiscordMessageId),
    contactInitiatedAt: normalizeIsoTimestamp(value.contactInitiatedAt),
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

function clipSharedResourceIdsToInventory(sharedResourceIds, inventoryResources) {
  const inventoryResourceIdSet = new Set(
    normalizeAccountInventoryResources(inventoryResources).map((resourceEntry) => resourceEntry.id),
  );
  return normalizeStringArray(sharedResourceIds).filter((resourceEntryId) =>
    inventoryResourceIdSet.has(resourceEntryId),
  );
}

function normalizeOrganizationBlueprintShares(
  value,
  inventoryBlueprintIds,
  organizations,
  legacySharedBlueprintIds = [],
) {
  const inventorySet = new Set(normalizeStringArray(inventoryBlueprintIds));
  const normalizedOrganizations = normalizeAccountOrganizations(organizations);
  const knownOrganizationSids = new Set(
    normalizedOrganizations.map((organization) => organization.sid),
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

  // Only migrate legacy sharedBlueprintIds when organizationBlueprintShares has
  // never been set (null/undefined). An empty object means the user explicitly
  // cleared all shares — do not re-populate from legacy data.
  if (!isObject(value) && Object.keys(normalizedShares).length === 0 && knownOrganizationSids.size > 0) {
    const migratedBlueprintIds = clipSharedBlueprintIdsToInventory(
      legacySharedBlueprintIds,
      inventoryBlueprintIds,
    );
    if (migratedBlueprintIds.length > 0) {
      const profileMainSid =
        normalizedOrganizations.find((organization) => organization.source === 'profile-main')?.sid ??
        null;
      const targetSids = profileMainSid
        ? [profileMainSid]
        : knownOrganizationSids.size === 1
          ? [...knownOrganizationSids]
          : [];

      for (const sid of targetSids) {
        normalizedShares[sid] = [...migratedBlueprintIds];
      }
    }
  }

  return normalizedShares;
}

function normalizeOrganizationResourceShares(
  value,
  inventoryResources,
  organizations,
  legacySharedResourceEntryIds = [],
) {
  const inventoryResourceIdSet = new Set(
    normalizeAccountInventoryResources(inventoryResources).map((resourceEntry) => resourceEntry.id),
  );
  const normalizedOrganizations = normalizeAccountOrganizations(organizations);
  const knownOrganizationSids = new Set(
    normalizedOrganizations.map((organization) => organization.sid),
  );
  const normalizedShares = {};

  if (isObject(value)) {
    for (const [rawSid, rawResourceEntryIds] of Object.entries(value)) {
      const sid = normalizeOrganizationSid(rawSid);
      if (!sid) {
        continue;
      }
      if (knownOrganizationSids.size > 0 && !knownOrganizationSids.has(sid)) {
        continue;
      }

      const normalizedResourceEntryIds = normalizeStringArray(rawResourceEntryIds).filter(
        (resourceEntryId) => inventoryResourceIdSet.has(resourceEntryId),
      );
      if (normalizedResourceEntryIds.length > 0) {
        normalizedShares[sid] = normalizedResourceEntryIds;
      }
    }
  }

  if (!isObject(value) && Object.keys(normalizedShares).length === 0 && knownOrganizationSids.size > 0) {
    const migratedResourceEntryIds = clipSharedResourceIdsToInventory(
      legacySharedResourceEntryIds,
      inventoryResources,
    );
    if (migratedResourceEntryIds.length > 0) {
      const profileMainSid =
        normalizedOrganizations.find((organization) => organization.source === 'profile-main')?.sid ??
        null;
      const targetSids = profileMainSid
        ? [profileMainSid]
        : knownOrganizationSids.size === 1
          ? [...knownOrganizationSids]
          : [];

      for (const sid of targetSids) {
        normalizedShares[sid] = [...migratedResourceEntryIds];
      }
    }
  }

  return normalizedShares;
}

function deriveSharedBlueprintIdsFromOrganizationShares(
  organizationBlueprintShares,
  legacySharedBlueprintIds = [],
) {
  // Once per-organization shares exist (even if empty), they are the source of
  // truth. Only fall back to legacy ids when the shares map is null/undefined
  // (pre-migration account).
  if (isObject(organizationBlueprintShares)) {
    return normalizeStringArray(
      Object.values(organizationBlueprintShares).flat(),
    );
  }
  return normalizeStringArray(legacySharedBlueprintIds);
}

function deriveSharedResourceIdsFromOrganizationShares(
  organizationResourceShares,
  legacySharedResourceEntryIds = [],
) {
  if (isObject(organizationResourceShares)) {
    return normalizeStringArray(
      Object.values(organizationResourceShares).flat(),
    );
  }
  return normalizeStringArray(legacySharedResourceEntryIds);
}

function getOrganizationShareSids(organizationBlueprintShares) {
  if (!isObject(organizationBlueprintShares)) {
    return [];
  }

  return sortStringArray(
    Object.entries(organizationBlueprintShares)
      .filter(([, blueprintIds]) => Array.isArray(blueprintIds) && blueprintIds.length > 0)
      .map(([sid]) => normalizeOrganizationSid(sid))
      .filter(Boolean),
  );
}

function getOrganizationResourceShareSids(organizationResourceShares) {
  if (!isObject(organizationResourceShares)) {
    return [];
  }

  return sortStringArray(
    Object.entries(organizationResourceShares)
      .filter(([, resourceEntryIds]) => Array.isArray(resourceEntryIds) && resourceEntryIds.length > 0)
      .map(([sid]) => normalizeOrganizationSid(sid))
      .filter(Boolean),
  );
}

function getOrganizationRefForSid(organizations, sid) {
  return normalizeAccountOrganizations(organizations).find((organization) => organization.sid === sid) ?? null;
}

function getOrganizationScopedShareIndexKey(sid, datasetScope = 'live') {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new Error('Organization SID is required to build the scoped share index key.');
  }
  return `organization-share-indexes/${normalizeAccountDatasetScope(datasetScope)}/${normalizedSid}.json`;
}

function normalizeOrganizationShareIndex(value, sid, datasetScope = 'live') {
  const normalizedSid = normalizeOrganizationSid(value?.sid ?? sid);
  if (!normalizedSid) {
    return null;
  }
  return {
    version: 1,
    sid: normalizedSid,
    datasetScope: normalizeAccountDatasetScope(value?.datasetScope ?? datasetScope),
    accountIds: sortStringArray(value?.accountIds),
    updatedAt: normalizeIsoTimestamp(value?.updatedAt) ?? toIsoNow(),
  };
}

async function readOrganizationScopedShareIndex(store, sid, datasetScope = 'live') {
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const rawIndex = await store.readJson(getOrganizationScopedShareIndexKey(sid, normalizedScope));
  return normalizeOrganizationShareIndex(rawIndex, sid, normalizedScope);
}

async function writeOrganizationScopedShareIndex(store, sid, datasetScope, accountIds) {
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    return null;
  }

  const index = normalizeOrganizationShareIndex({
    sid: normalizedSid,
    datasetScope: normalizedScope,
    accountIds,
    updatedAt: toIsoNow(),
  }, normalizedSid, normalizedScope);
  await store.writeJson(getOrganizationScopedShareIndexKey(normalizedSid, normalizedScope), index);
  return index;
}

async function syncOrganizationScopedShareIndexesForAccount(store, previousAccount, nextAccount, datasetScope = 'live') {
  const accountId = String(nextAccount?.accountId ?? previousAccount?.accountId ?? '').trim();
  if (!accountId) {
    return;
  }
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const previousSharedSids = new Set([
    ...getOrganizationShareSids(previousAccount?.organizationBlueprintShares),
    ...getOrganizationResourceShareSids(previousAccount?.organizationResourceShares),
  ]);
  const nextSharedSids = new Set([
    ...getOrganizationShareSids(nextAccount?.organizationBlueprintShares),
    ...getOrganizationResourceShareSids(nextAccount?.organizationResourceShares),
  ]);
  const affectedSids = sortStringArray([
    ...previousSharedSids,
    ...nextSharedSids,
  ]);

  for (const sid of affectedSids) {
    const existingIndex = await readOrganizationScopedShareIndex(store, sid, normalizedScope);
    const nextAccountIds = new Set(existingIndex?.accountIds ?? []);
    if (nextSharedSids.has(sid)) {
      nextAccountIds.add(accountId);
    } else {
      nextAccountIds.delete(accountId);
    }
    await writeOrganizationScopedShareIndex(store, sid, normalizedScope, [...nextAccountIds]);
  }
}

export async function readOrganizationScopedShareAccountIds(store, sid, datasetScope = 'live') {
  const existingIndex = await readOrganizationScopedShareIndex(store, sid, datasetScope);
  return existingIndex?.accountIds ?? [];
}

async function syncOrganizationShareIndexesForAccount(store, previousAccount, nextAccount) {
  const accountId = String(nextAccount?.accountId ?? previousAccount?.accountId ?? '').trim();
  if (!accountId) {
    return;
  }

  const previousSharedSids = new Set([
    ...getOrganizationShareSids(previousAccount?.organizationBlueprintShares),
    ...getOrganizationResourceShareSids(previousAccount?.organizationResourceShares),
  ]);
  const nextSharedSids = new Set([
    ...getOrganizationShareSids(nextAccount?.organizationBlueprintShares),
    ...getOrganizationResourceShareSids(nextAccount?.organizationResourceShares),
  ]);
  const affectedSids = sortStringArray([
    ...previousSharedSids,
    ...nextSharedSids,
  ]);

  for (const sid of affectedSids) {
    const hasShareBefore = previousSharedSids.has(sid);
    const hasShareAfter = nextSharedSids.has(sid);
    let organizationRecord = await readOrganizationRecord(store, sid);

    if (!organizationRecord && !hasShareAfter) {
      continue;
    }

    if (!organizationRecord) {
      const organizationRef =
        getOrganizationRefForSid(nextAccount?.organizations, sid) ??
        getOrganizationRefForSid(previousAccount?.organizations, sid);
      organizationRecord = {
        sid,
        name: organizationRef?.name ?? sid,
        image: organizationRef?.image ?? null,
        logo: organizationRef?.logo ?? null,
        url: organizationRef?.url ?? null,
        archetype: organizationRef?.archetype ?? null,
        commitment: organizationRef?.commitment ?? null,
        primaryFocus: organizationRef?.primaryFocus ?? null,
        secondaryFocus: organizationRef?.secondaryFocus ?? null,
        lang: organizationRef?.lang ?? null,
        members: organizationRef?.memberCount ?? null,
        claimed: false,
        claimedByAccountId: null,
        adminAccountIds: [],
        sharedAccountIds: [],
        memberSnapshot: [],
        lastLiveSyncAt: null,
        nextEligibleLiveSyncAt: null,
        staleAt: null,
        memberCount: 0,
        syncStatus: 'never',
        createdAt: toIsoNow(),
        updatedAt: toIsoNow(),
      };
    }

    const nextSharedAccountIds = new Set(organizationRecord.sharedAccountIds ?? []);
    if (!hasShareAfter) {
      nextSharedAccountIds.delete(accountId);
    } else {
      nextSharedAccountIds.add(accountId);
    }

    const sortedSharedAccountIds = sortStringArray([...nextSharedAccountIds]);
    const currentSharedAccountIds = sortStringArray(organizationRecord.sharedAccountIds);
    if (JSON.stringify(sortedSharedAccountIds) === JSON.stringify(currentSharedAccountIds)) {
      continue;
    }

    await writeOrganizationRecord(store, {
      ...organizationRecord,
      sharedAccountIds: sortedSharedAccountIds,
      updatedAt: toIsoNow(),
    });
  }
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

export function getAccountScopeObjectKey(accountId, datasetScope = 'live') {
  const normalizedAccountId = String(accountId ?? '').trim();
  if (!normalizedAccountId) {
    throw new Error('Account id is required to build the account scope storage key.');
  }

  return `account-scopes/${normalizeAccountDatasetScope(datasetScope)}/${normalizedAccountId}.json`;
}

function createEmptyAccountScopeRecord(accountId, datasetScope = 'live', { now } = {}) {
  const timestamp = now ?? toIsoNow();
  return {
    version: ACCOUNT_SCOPE_RECORD_VERSION,
    accountId: String(accountId ?? '').trim(),
    datasetScope: normalizeAccountDatasetScope(datasetScope),
    favoriteBlueprintIds: [],
    inventoryBlueprintIds: [],
    inventoryResources: [],
    planner: createEmptyAccountState().planner,
    organizationBlueprintShares: {},
    organizationResourceShares: {},
    sharedBlueprintIds: [],
    sharedResourceEntryIds: [],
    incomingCraftRequests: [],
    outgoingCraftRequests: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeAccountScopeRecord(value, { accountId, datasetScope = 'live', fallbackAccount = null } = {}) {
  const normalizedAccountId = String(value?.accountId ?? accountId ?? fallbackAccount?.accountId ?? '').trim();
  if (!normalizedAccountId) {
    return null;
  }

  const normalizedScope = normalizeAccountDatasetScope(value?.datasetScope ?? datasetScope);
  const state = normalizeStateSnapshot(value);
  const inventoryResources = normalizeAccountInventoryResources(value?.inventoryResources);
  const organizations = normalizeAccountOrganizations(fallbackAccount?.organizations);
  const legacySharedBlueprintIds = clipSharedBlueprintIdsToInventory(
    value?.sharedBlueprintIds,
    state.inventoryBlueprintIds,
  );
  const legacySharedResourceEntryIds = clipSharedResourceIdsToInventory(
    value?.sharedResourceEntryIds,
    inventoryResources,
  );
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    value?.organizationBlueprintShares,
    state.inventoryBlueprintIds,
    organizations,
    legacySharedBlueprintIds,
  );
  const organizationResourceShares = normalizeOrganizationResourceShares(
    value?.organizationResourceShares,
    inventoryResources,
    organizations,
    legacySharedResourceEntryIds,
  );
  const sharedBlueprintIds = deriveSharedBlueprintIdsFromOrganizationShares(
    organizationBlueprintShares,
    legacySharedBlueprintIds,
  );
  const sharedResourceEntryIds = deriveSharedResourceIdsFromOrganizationShares(
    organizationResourceShares,
    legacySharedResourceEntryIds,
  );
  const incomingCraftRequests = normalizeAccountCraftRequests(value?.incomingCraftRequests);
  const outgoingCraftRequests = normalizeAccountCraftRequests(value?.outgoingCraftRequests);
  const now = toIsoNow();

  return {
    version: ACCOUNT_SCOPE_RECORD_VERSION,
    accountId: normalizedAccountId,
    datasetScope: normalizedScope,
    favoriteBlueprintIds: state.favoriteBlueprintIds,
    inventoryBlueprintIds: state.inventoryBlueprintIds,
    inventoryResources,
    planner: state.planner,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds,
    sharedResourceEntryIds,
    incomingCraftRequests,
    outgoingCraftRequests,
    createdAt: normalizeIsoTimestamp(value?.createdAt) ?? now,
    updatedAt: normalizeIsoTimestamp(value?.updatedAt) ?? normalizeIsoTimestamp(value?.createdAt) ?? now,
  };
}

function createLiveScopeFromLegacyAccount(account, datasetScope = 'live') {
  return normalizeAccountScopeRecord({
    accountId: account.accountId,
    datasetScope,
    favoriteBlueprintIds: account.favoriteBlueprintIds,
    inventoryBlueprintIds: account.inventoryBlueprintIds,
    inventoryResources: account.inventoryResources,
    planner: account.planner,
    organizationBlueprintShares: account.organizationBlueprintShares,
    organizationResourceShares: account.organizationResourceShares,
    sharedBlueprintIds: account.sharedBlueprintIds,
    sharedResourceEntryIds: account.sharedResourceEntryIds,
    incomingCraftRequests: account.incomingCraftRequests,
    outgoingCraftRequests: account.outgoingCraftRequests,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }, { accountId: account.accountId, datasetScope, fallbackAccount: account });
}

function mergeAccountWithScope(account, scopeRecord) {
  if (!account || !scopeRecord) {
    return account;
  }

  return {
    ...account,
    datasetScope: scopeRecord.datasetScope,
    favoriteBlueprintIds: scopeRecord.favoriteBlueprintIds,
    inventoryBlueprintIds: scopeRecord.inventoryBlueprintIds,
    inventoryResources: scopeRecord.inventoryResources,
    planner: scopeRecord.planner,
    organizationBlueprintShares: scopeRecord.organizationBlueprintShares,
    organizationResourceShares: scopeRecord.organizationResourceShares,
    sharedBlueprintIds: scopeRecord.sharedBlueprintIds,
    sharedResourceEntryIds: scopeRecord.sharedResourceEntryIds,
    incomingCraftRequests: scopeRecord.incomingCraftRequests,
    outgoingCraftRequests: scopeRecord.outgoingCraftRequests,
  };
}

async function readAccountScopeRecord(store, account, datasetScope = 'live') {
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const rawScope = await store.readJson(getAccountScopeObjectKey(account.accountId, normalizedScope));
  if (rawScope) {
    return normalizeAccountScopeRecord(rawScope, {
      accountId: account.accountId,
      datasetScope: normalizedScope,
      fallbackAccount: account,
    });
  }

  if (normalizedScope === 'live') {
    return createLiveScopeFromLegacyAccount(account, normalizedScope);
  }

  return normalizeAccountScopeRecord(
    createEmptyAccountScopeRecord(account.accountId, normalizedScope, {
      now: account.createdAt ?? toIsoNow(),
    }),
    { accountId: account.accountId, datasetScope: normalizedScope, fallbackAccount: account },
  );
}

async function writeAccountScopeRecord(store, account, datasetScope = 'live', previousScopedAccount = undefined) {
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const scopeRecord = normalizeAccountScopeRecord({
    accountId: account.accountId,
    datasetScope: normalizedScope,
    favoriteBlueprintIds: account.favoriteBlueprintIds,
    inventoryBlueprintIds: account.inventoryBlueprintIds,
    inventoryResources: account.inventoryResources,
    planner: account.planner,
    organizationBlueprintShares: account.organizationBlueprintShares,
    organizationResourceShares: account.organizationResourceShares,
    sharedBlueprintIds: account.sharedBlueprintIds,
    sharedResourceEntryIds: account.sharedResourceEntryIds,
    incomingCraftRequests: account.incomingCraftRequests,
    outgoingCraftRequests: account.outgoingCraftRequests,
    createdAt: account.createdAt,
    updatedAt: toIsoNow(),
  }, { accountId: account.accountId, datasetScope: normalizedScope, fallbackAccount: account });

  await store.writeJson(getAccountScopeObjectKey(account.accountId, normalizedScope), scopeRecord);
  await syncOrganizationScopedShareIndexesForAccount(
    store,
    previousScopedAccount,
    mergeAccountWithScope(account, scopeRecord),
    normalizedScope,
  );
  return mergeAccountWithScope(account, scopeRecord);
}

export async function readScopedAccountRecord(store, accountId, fallbackProfile = null, datasetScope = 'live') {
  const account = await readAccountRecord(store, accountId, fallbackProfile);
  if (!account) {
    return null;
  }

  const scopeRecord = await readAccountScopeRecord(store, account, datasetScope);
  return mergeAccountWithScope(account, scopeRecord);
}

export async function copyLiveAccountScopeToPtu(store, accountId, fallbackProfile = null) {
  const liveAccount = await readScopedAccountRecord(store, accountId, fallbackProfile, 'live');
  if (!liveAccount) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }
  const previousPtuAccount = await readScopedAccountRecord(store, accountId, fallbackProfile, 'ptu');
  const now = toIsoNow();
  const copyCraftRequestsToPtu = (requests) =>
    normalizeAccountCraftRequests(requests).map((request) => ({
      ...request,
      datasetScope: 'ptu',
      ownerDiscordChannelId: null,
      ownerDiscordMessageId: null,
      contactInitiatedAt: null,
      updatedAt: now,
    }));
  const nextPtuAccount = {
    ...previousPtuAccount,
    ...liveAccount,
    datasetScope: 'ptu',
    incomingCraftRequests: copyCraftRequestsToPtu(liveAccount.incomingCraftRequests),
    outgoingCraftRequests: copyCraftRequestsToPtu(liveAccount.outgoingCraftRequests),
    updatedAt: now,
  };
  return writeAccountScopeRecord(store, nextPtuAccount, 'ptu', previousPtuAccount);
}

export async function saveScopedCraftRequestCollections(
  store,
  accountId,
  { incomingCraftRequests, outgoingCraftRequests } = {},
  fallbackProfile = null,
  options = {},
) {
  const datasetScope = normalizeAccountDatasetScope(options?.datasetScope);
  const existing = await readScopedAccountRecord(store, accountId, fallbackProfile, datasetScope);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const nextAccount = {
    ...existing,
    incomingCraftRequests: normalizeAccountCraftRequests(incomingCraftRequests ?? existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(outgoingCraftRequests ?? existing.outgoingCraftRequests),
    updatedAt: toIsoNow(),
  };
  return writeAccountScopeRecord(store, nextAccount, datasetScope, existing);
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
    inventoryResources: [],
    planner: createEmptyAccountState().planner,
    organizationBlueprintShares: {},
    organizationResourceShares: {},
    sharedBlueprintIds: [],
    sharedResourceEntryIds: [],
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
  const inventoryResources = normalizeAccountInventoryResources(value?.inventoryResources);
  const rsi = normalizeRsiLink(value?.rsi);
  const organizations = normalizeAccountOrganizations(value?.organizations);
  const ignoredOrganizationSids = normalizeIgnoredOrganizationSids(value?.ignoredOrganizationSids);
  const legacySharedBlueprintIds = clipSharedBlueprintIdsToInventory(
    value?.sharedBlueprintIds,
    state.inventoryBlueprintIds,
  );
  const legacySharedResourceEntryIds = clipSharedResourceIdsToInventory(
    value?.sharedResourceEntryIds,
    inventoryResources,
  );
  const organizationBlueprintShares = normalizeOrganizationBlueprintShares(
    value?.organizationBlueprintShares,
    state.inventoryBlueprintIds,
    organizations,
    legacySharedBlueprintIds,
  );
  const organizationResourceShares = normalizeOrganizationResourceShares(
    value?.organizationResourceShares,
    inventoryResources,
    organizations,
    legacySharedResourceEntryIds,
  );
  const incomingCraftRequests = normalizeAccountCraftRequests(value?.incomingCraftRequests);
  const outgoingCraftRequests = normalizeAccountCraftRequests(value?.outgoingCraftRequests);
  const sharedBlueprintIds = deriveSharedBlueprintIdsFromOrganizationShares(
    organizationBlueprintShares,
    legacySharedBlueprintIds,
  );
  const sharedResourceEntryIds = deriveSharedResourceIdsFromOrganizationShares(
    organizationResourceShares,
    legacySharedResourceEntryIds,
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
    inventoryResources,
    planner: state.planner,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds,
    sharedResourceEntryIds,
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

async function writeNormalizedAccountRecord(store, accountRecord, { previousAccount } = {}) {
  const normalizedAccount = normalizeAccountRecord(accountRecord, {
    fallbackProfile: accountRecord?.profile,
    accountId: accountRecord?.accountId,
  });
  if (!normalizedAccount) {
    throw new Error('A valid account record is required.');
  }

  const previousAccountRecord =
    previousAccount !== undefined
      ? previousAccount
      : await readAccountRecord(
          store,
          normalizedAccount.accountId,
          normalizedAccount.profile,
        );

  await store.writeJson(getAccountObjectKey(normalizedAccount.accountId), normalizedAccount);
  await syncOrganizationShareIndexesForAccount(
    store,
    previousAccountRecord,
    normalizedAccount,
  );
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
    async listJsonKeys(prefix) {
      const keys = [];
      let cursor = undefined;

      do {
        const listing = await bucket.list({
          prefix,
          cursor,
        });

        for (const entry of listing.objects ?? []) {
          if (entry.key) {
            keys.push(entry.key);
          }
        }

        cursor = listing.truncated ? listing.cursor : undefined;
      } while (cursor);

      return keys;
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
    async listJsonKeys(prefix) {
      return listObjectKeys(client, bucketName, prefix);
    },
  };
}

export async function findAccountIdsSharingOrganizationBlueprints(store, sid, datasetScope = 'live') {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid || typeof store?.listJsonKeys !== 'function') {
    return [];
  }
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const indexedAccountIds = await readOrganizationScopedShareAccountIds(store, normalizedSid, normalizedScope);

  const matchingAccountIds = [];
  const accountIdsToCheck = new Set(indexedAccountIds);
  const accountKeys = await store.listJsonKeys('accounts/');

  for (const key of accountKeys) {
    if (!String(key).endsWith('.json')) {
      continue;
    }

    const accountId = key.slice('accounts/'.length, -'.json'.length);
    if (!accountId) {
      continue;
    }

    accountIdsToCheck.add(accountId);
  }

  for (const accountId of accountIdsToCheck) {
    const account = await readScopedAccountRecord(store, accountId, null, normalizedScope);
    if (!account) {
      continue;
    }

    const sharedBlueprintIds = account.organizationBlueprintShares?.[normalizedSid] ?? [];
    if (!Array.isArray(sharedBlueprintIds) || sharedBlueprintIds.length === 0) {
      continue;
    }

    matchingAccountIds.push(accountId);
  }

  const sortedAccountIds = sortStringArray(matchingAccountIds);
  await writeOrganizationScopedShareIndex(store, normalizedSid, normalizedScope, sortedAccountIds);
  return sortedAccountIds;
}

export async function findAccountIdsSharingOrganizationResources(store, sid, datasetScope = 'live') {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid || typeof store?.listJsonKeys !== 'function') {
    return [];
  }
  const normalizedScope = normalizeAccountDatasetScope(datasetScope);
  const indexedAccountIds = await readOrganizationScopedShareAccountIds(store, normalizedSid, normalizedScope);

  const matchingAccountIds = [];
  const accountIdsToCheck = new Set(indexedAccountIds);
  const accountKeys = await store.listJsonKeys('accounts/');

  for (const key of accountKeys) {
    if (!String(key).endsWith('.json')) {
      continue;
    }

    const accountId = key.slice('accounts/'.length, -'.json'.length);
    if (!accountId) {
      continue;
    }

    accountIdsToCheck.add(accountId);
  }

  for (const accountId of accountIdsToCheck) {
    const account = await readScopedAccountRecord(store, accountId, null, normalizedScope);
    if (!account) {
      continue;
    }

    const sharedResourceEntryIds = account.organizationResourceShares?.[normalizedSid] ?? [];
    if (!Array.isArray(sharedResourceEntryIds) || sharedResourceEntryIds.length === 0) {
      continue;
    }

    matchingAccountIds.push(accountId);
  }

  const sortedAccountIds = sortStringArray(matchingAccountIds);
  await writeOrganizationScopedShareIndex(store, normalizedSid, normalizedScope, sortedAccountIds);
  return sortedAccountIds;
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
  const inventoryResources = normalizeAccountInventoryResources(existing?.inventoryResources);
  const organizationResourceShares = normalizeOrganizationResourceShares(
    existing?.organizationResourceShares,
    inventoryResources,
    organizations,
    existing?.sharedResourceEntryIds,
  );
  const nextRecord = {
    ...base,
    version: ACCOUNT_RECORD_VERSION,
    provider: 'discord',
    providerUserId: normalizedProfile.id,
    profile: normalizedProfile,
    isAdmin: normalizeAdminFlag(existing?.isAdmin, normalizedProfile, existing?.rsi ?? null),
    lastRsiLinkAt: normalizeIsoTimestamp(existing?.lastRsiLinkAt),
    inventoryResources,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      clipSharedBlueprintIdsToInventory(existing?.sharedBlueprintIds, base.inventoryBlueprintIds),
    ),
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      organizationResourceShares,
      clipSharedResourceIdsToInventory(existing?.sharedResourceEntryIds, inventoryResources),
    ),
    organizations,
    ignoredOrganizationSids,
    incomingCraftRequests: normalizeAccountCraftRequests(existing?.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing?.outgoingCraftRequests),
    createdAt: base.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: now,
  };

  return writeNormalizedAccountRecord(store, nextRecord, { previousAccount: existing });
}

export async function saveAccountState(store, accountId, stateSnapshot, fallbackProfile = null, options = {}) {
  const datasetScope = normalizeAccountDatasetScope(options?.datasetScope);
  const existing = await readScopedAccountRecord(store, accountId, fallbackProfile, datasetScope);
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
  const inventoryResources = normalizeAccountInventoryResources(existing.inventoryResources);
  const organizationResourceShares = normalizeOrganizationResourceShares(
    existing.organizationResourceShares,
    inventoryResources,
    organizations,
    existing.sharedResourceEntryIds,
  );
  const nextRecord = {
    ...existing,
    ...normalizedState,
    inventoryResources,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      clipSharedBlueprintIdsToInventory(existing.sharedBlueprintIds, normalizedState.inventoryBlueprintIds),
    ),
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      organizationResourceShares,
      clipSharedResourceIdsToInventory(existing.sharedResourceEntryIds, inventoryResources),
    ),
    organizations,
    ignoredOrganizationSids,
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    isAdmin: normalizeAdminFlag(existing.isAdmin, existing.profile, existing.rsi),
    lastRsiLinkAt: normalizeIsoTimestamp(existing.lastRsiLinkAt),
    updatedAt: now,
  };

  return writeAccountScopeRecord(store, nextRecord, datasetScope, existing);
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
  const organizationResourceShares = normalizeOrganizationResourceShares(
    existing.organizationResourceShares,
    existing.inventoryResources,
    normalizedOrganizations,
    existing.sharedResourceEntryIds,
  );
  const nextRecord = {
    ...existing,
    organizations: normalizedOrganizations,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      clipSharedBlueprintIdsToInventory(existing.sharedBlueprintIds, existing.inventoryBlueprintIds),
    ),
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      organizationResourceShares,
      clipSharedResourceIdsToInventory(existing.sharedResourceEntryIds, existing.inventoryResources),
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    updatedAt: now,
  };

  return writeNormalizedAccountRecord(store, nextRecord, { previousAccount: existing });
}

export async function saveAccountOrganizationBlueprintShares(
  store,
  accountId,
  organizationBlueprintShares,
  fallbackProfile = null,
  options = {},
) {
  const datasetScope = normalizeAccountDatasetScope(options?.datasetScope);
  const existing = await readScopedAccountRecord(store, accountId, fallbackProfile, datasetScope);
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
    organizationResourceShares: normalizeOrganizationResourceShares(
      existing.organizationResourceShares,
      existing.inventoryResources,
      normalizedOrganizations,
      existing.sharedResourceEntryIds,
    ),
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      normalizedOrganizationBlueprintShares,
      existing.sharedBlueprintIds,
    ),
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      existing.organizationResourceShares,
      existing.sharedResourceEntryIds,
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    updatedAt: now,
  };

  return writeAccountScopeRecord(store, nextRecord, datasetScope, existing);
}

export async function saveAccountInventoryResources(
  store,
  accountId,
  inventoryResources,
  fallbackProfile = null,
  options = {},
) {
  const datasetScope = normalizeAccountDatasetScope(options?.datasetScope);
  const existing = await readScopedAccountRecord(store, accountId, fallbackProfile, datasetScope);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const normalizedInventoryResources = normalizeAccountInventoryResources(inventoryResources);
  const normalizedOrganizations = normalizeAccountOrganizations(existing.organizations);
  const normalizedOrganizationResourceShares = normalizeOrganizationResourceShares(
    existing.organizationResourceShares,
    normalizedInventoryResources,
    normalizedOrganizations,
    existing.sharedResourceEntryIds,
  );
  const nextRecord = {
    ...existing,
    inventoryResources: normalizedInventoryResources,
    organizationResourceShares: normalizedOrganizationResourceShares,
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      normalizedOrganizationResourceShares,
      clipSharedResourceIdsToInventory(existing.sharedResourceEntryIds, normalizedInventoryResources),
    ),
    updatedAt: toIsoNow(),
  };

  return writeAccountScopeRecord(store, nextRecord, datasetScope, existing);
}

export async function saveAccountOrganizationResourceShares(
  store,
  accountId,
  organizationResourceShares,
  fallbackProfile = null,
  options = {},
) {
  const datasetScope = normalizeAccountDatasetScope(options?.datasetScope);
  const existing = await readScopedAccountRecord(store, accountId, fallbackProfile, datasetScope);
  if (!existing) {
    throw new Error(`Account "${accountId}" does not exist.`);
  }

  const normalizedOrganizations = normalizeAccountOrganizations(existing.organizations);
  const normalizedOrganizationResourceShares = normalizeOrganizationResourceShares(
    organizationResourceShares,
    existing.inventoryResources,
    normalizedOrganizations,
    existing.sharedResourceEntryIds,
  );
  const nextRecord = {
    ...existing,
    organizations: normalizedOrganizations,
    organizationResourceShares: normalizedOrganizationResourceShares,
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      normalizedOrganizationResourceShares,
      existing.sharedResourceEntryIds,
    ),
    updatedAt: toIsoNow(),
  };

  return writeAccountScopeRecord(store, nextRecord, datasetScope, existing);
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
  const organizationResourceShares = normalizeOrganizationResourceShares(
    existing.organizationResourceShares,
    existing.inventoryResources,
    organizations,
    existing.sharedResourceEntryIds,
  );

  const nextRecord = {
    ...existing,
    rsi: normalizedRsiLink,
    organizations,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      existing.sharedBlueprintIds,
    ),
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      organizationResourceShares,
      existing.sharedResourceEntryIds,
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    isAdmin: normalizeAdminFlag(existing.isAdmin, existing.profile, normalizedRsiLink),
    lastRsiLinkAt: now,
    updatedAt: now,
  };

  const savedAccount = await writeNormalizedAccountRecord(store, nextRecord, {
    previousAccount: existing,
  });
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
  const organizationResourceShares = normalizeOrganizationResourceShares(
    existing.organizationResourceShares,
    existing.inventoryResources,
    organizations,
    existing.sharedResourceEntryIds,
  );
  const nextRecord = {
    ...existing,
    rsi: null,
    organizations,
    organizationBlueprintShares,
    organizationResourceShares,
    sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShares(
      organizationBlueprintShares,
      existing.sharedBlueprintIds,
    ),
    sharedResourceEntryIds: deriveSharedResourceIdsFromOrganizationShares(
      organizationResourceShares,
      existing.sharedResourceEntryIds,
    ),
    incomingCraftRequests: normalizeAccountCraftRequests(existing.incomingCraftRequests),
    outgoingCraftRequests: normalizeAccountCraftRequests(existing.outgoingCraftRequests),
    ignoredOrganizationSids,
    isAdmin: normalizeAdminFlag(existing.isAdmin, existing.profile, null),
    lastRsiLinkAt: normalizeIsoTimestamp(existing.lastRsiLinkAt),
    updatedAt: now,
  };

  const savedAccount = await writeNormalizedAccountRecord(store, nextRecord, {
    previousAccount: existing,
  });
  await deleteRsiHandleIndex(store, existing.rsi?.handle);
  return savedAccount;
}

export async function deleteAccountRecord(store, accountId, fallbackProfile = null) {
  const existing = await readAccountRecord(store, accountId, fallbackProfile);
  if (existing) {
    await syncOrganizationShareIndexesForAccount(store, existing, null);
    for (const datasetScope of ACCOUNT_DATASET_SCOPES) {
      const scopedAccount = await readScopedAccountRecord(store, accountId, fallbackProfile, datasetScope);
      if (scopedAccount) {
        await syncOrganizationScopedShareIndexesForAccount(store, scopedAccount, null, datasetScope);
      }
      await store.deleteObject(getAccountScopeObjectKey(accountId, datasetScope));
    }
  }
  if (existing?.rsi?.handle) {
    await deleteRsiHandleIndex(store, existing.rsi.handle);
  }

  await store.deleteObject(getAccountObjectKey(accountId));
}
