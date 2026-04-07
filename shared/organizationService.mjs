import {
  findAccountIdsSharingOrganizationBlueprints,
  findAccountIdsSharingOrganizationResources,
  readAccountIdByRsiHandle,
  readAccountRecord,
  saveAccountOrganizations,
  writeAccountRecord,
} from './accountStorage.mjs';
import {
  ORGANIZATION_LIVE_SYNC_COOLDOWN_MS,
  ORGANIZATION_SNAPSHOT_STALE_MS,
  readOrganizationRecord,
  upsertOrganizationMetadata,
  writeOrganizationRecord,
} from './organizationStorage.mjs';
import {
  readOrganizationClaimRequest,
  writeOrganizationClaimRequest,
} from './organizationClaimRequestStorage.mjs';
import {
  fetchAllRsiOrganizationMembers,
  fetchRsiApiKeyStatus,
  findRsiOrganizationMemberByHandle,
  fetchRsiOrganizationBySid,
  fetchRsiProfileByHandle,
  isOrganizationAdminCandidate,
} from './rsiLink.mjs';
import {
  normalizeIsoTimestamp,
  normalizeOrganizationSid,
  normalizeText,
  toIsoNow,
} from './normalize.mjs';

const PROFILE_MAIN_SYNC_COOLDOWN_MS = 60 * 60 * 1000;

function normalizeComparableText(value) {
  return normalizeText(value).toLowerCase();
}

function isLikelyNotFoundError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('404') || normalizedMessage.includes('not found');
}

function isTimestampWithinWindow(timestamp, windowMs, nowMs = Date.now()) {
  const normalizedTimestamp = normalizeIsoTimestamp(timestamp);
  if (!normalizedTimestamp) {
    return false;
  }

  return nowMs - Date.parse(normalizedTimestamp) < windowMs;
}

function isSnapshotFreshForMembership(record, nowMs = Date.now()) {
  const staleAt = normalizeIsoTimestamp(record?.staleAt);
  return Boolean(
    staleAt &&
      Array.isArray(record?.memberSnapshot) &&
      record.memberSnapshot.length > 0 &&
      Date.parse(staleAt) >= nowMs,
  );
}

function shouldRefreshProfileMainOrganization(account, nowMs = Date.now()) {
  if (!account?.rsi?.handle) {
    return false;
  }

  const profileMainRef =
    Array.isArray(account.organizations)
      ? account.organizations.find((ref) => ref.source === 'profile-main') ?? null
      : null;
  if (!profileMainRef) {
    return true;
  }

  if (profileMainRef.status === 'observed') {
    return true;
  }

  return !isTimestampWithinWindow(profileMainRef.lastSeenAt, PROFILE_MAIN_SYNC_COOLDOWN_MS, nowMs);
}

function isOrganizationIgnored(account, sid) {
  return (account?.ignoredOrganizationSids ?? []).includes(sid);
}

function isSnapshotReusableForClaim(record, nowMs = Date.now()) {
  return (
    Array.isArray(record?.memberSnapshot) &&
    record.memberSnapshot.length > 0 &&
    isTimestampWithinWindow(record?.lastLiveSyncAt, ORGANIZATION_LIVE_SYNC_COOLDOWN_MS, nowMs)
  );
}

function isSnapshotStale(record, nowMs = Date.now()) {
  const staleAt = normalizeIsoTimestamp(record?.staleAt);
  return Boolean(
    staleAt &&
      Array.isArray(record?.memberSnapshot) &&
      record.memberSnapshot.length > 0 &&
      Date.parse(staleAt) < nowMs,
  );
}

function isVerifiedOrganizationStatus(status) {
  return status === 'verified_member' || status === 'verified_admin';
}

function isOrganizationDeleted(record) {
  return Boolean(normalizeIsoTimestamp(record?.deletedAt));
}

function isOrganizationBlueprintSharingEnabled(record) {
  return record?.blueprintSharingEnabled !== false;
}

function uniqueStringArray(values) {
  return [...new Set(values.filter(Boolean))];
}

function removeOrganizationSidFromShareMap(organizationBlueprintShares, sid) {
  return Object.fromEntries(
    Object.entries(organizationBlueprintShares ?? {}).filter(
      ([shareSid]) => normalizeOrganizationSid(shareSid) !== sid,
    ),
  );
}

function deriveSharedBlueprintIdsFromOrganizationShareMap(organizationBlueprintShares) {
  return uniqueStringArray(Object.values(organizationBlueprintShares ?? {}).flat());
}

function deriveSharedResourceEntryIdsFromOrganizationShareMap(organizationResourceShares) {
  return uniqueStringArray(Object.values(organizationResourceShares ?? {}).flat());
}

async function reviveDeletedOrganizationRecord(
  store,
  organizationRecord,
  metadata,
  { now = toIsoNow() } = {},
) {
  if (!organizationRecord) {
    throw new Error('An existing organization record is required to revive a deleted organization.');
  }

  return writeOrganizationRecord(store, {
    ...organizationRecord,
    ...metadata,
    image:
      metadata?.image ??
      metadata?.logo ??
      organizationRecord.image ??
      organizationRecord.logo ??
      null,
    blueprintSharingEnabled: true,
    deletedAt: null,
    updatedAt: now,
  });
}

function findOrganizationMemberByHandle(memberSnapshot, handle) {
  const normalizedHandle = normalizeComparableText(handle);
  if (!normalizedHandle || !Array.isArray(memberSnapshot)) {
    return null;
  }

  return (
    memberSnapshot.find(
      (member) => normalizeComparableText(member?.handle) === normalizedHandle,
    ) ?? null
  );
}

async function resolveOrganizationMembershipEvidence(
  apiKey,
  sid,
  account,
  memberSnapshot,
  { fetchImpl = fetch } = {},
) {
  const snapshotMember = findOrganizationMemberByHandle(memberSnapshot, account?.rsi?.handle);
  if (snapshotMember) {
    return snapshotMember;
  }

  if (!apiKey || !account?.rsi?.handle) {
    return null;
  }

  try {
    const loadProfile = async (mode) =>
      fetchRsiProfileByHandle(apiKey, account.rsi.handle, {
        fetchImpl,
        mode,
      });

    let profile = await loadProfile('cache');
    let matchingOrganization =
      profile.organization?.sid === sid
        ? profile.organization
        : profile.affiliations?.find((organization) => organization.sid === sid) ?? null;

    if (!matchingOrganization) {
      profile = await loadProfile('auto');
      matchingOrganization =
        profile.organization?.sid === sid
          ? profile.organization
          : profile.affiliations?.find((organization) => organization.sid === sid) ?? null;
    }

    if (!matchingOrganization) {
      return null;
    }

    const fallbackMember = {
      handle: profile.handle,
      display: profile.displayName ?? profile.handle,
      image: null,
      rank: matchingOrganization.rank ?? null,
      stars: Number.isFinite(Number(matchingOrganization.stars))
        ? Number(matchingOrganization.stars)
        : null,
      roles: [],
    };

    return {
      ...fallbackMember,
      isAdminCandidate: isOrganizationAdminCandidate(fallbackMember),
    };
  } catch {
    return null;
  }
}

function buildObservedOrganizationRef(ref, overrides = {}) {
  return {
    ...ref,
    ...overrides,
    status: 'observed',
    stars: null,
    lastVerifiedAt: null,
    rank:
      ref?.source === 'profile-main'
        ? overrides.rank ?? ref.rank ?? null
        : overrides.rank ?? null,
  };
}

function buildVerifiedOrganizationRef(ref, member, verifiedAt, overrides = {}) {
  const adminCandidate = isOrganizationAdminCandidate(member);
  return {
    ...ref,
    ...overrides,
    status: adminCandidate ? 'verified_admin' : 'verified_member',
    rank: member?.rank ?? overrides.rank ?? ref.rank ?? null,
    stars: Number.isFinite(Number(member?.stars)) ? Number(member.stars) : null,
    lastVerifiedAt: normalizeIsoTimestamp(verifiedAt) ?? toIsoNow(),
  };
}

function sortOrganizationRefs(refs) {
  return [...refs].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'profile-main' ? -1 : 1;
    }

    return String(left.name ?? left.sid).localeCompare(String(right.name ?? right.sid), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function upsertOrganizationRef(refs, nextRef) {
  const nextSid = normalizeOrganizationSid(nextRef?.sid);
  if (!nextSid) {
    return refs;
  }

  const existingRef = refs.find((ref) => ref.sid === nextSid) ?? null;
  const filteredRefs = refs.filter((ref) => ref.sid !== nextSid);
  const mergedRef = existingRef
    ? {
        ...existingRef,
        ...nextRef,
        sid: nextSid,
        source:
          existingRef.source === 'profile-main' || nextRef.source === 'profile-main'
            ? 'profile-main'
            : 'manual',
      }
    : {
        ...nextRef,
        sid: nextSid,
      };

  return sortOrganizationRefs([...filteredRefs, mergedRef]);
}

function decorateOrganizationRef(ref, organizationRecord, accountId, nowMs = Date.now()) {
  const staleAt = normalizeIsoTimestamp(organizationRecord?.staleAt);
  const deletedAt = normalizeIsoTimestamp(organizationRecord?.deletedAt);
  const isStale = Boolean(staleAt && Date.parse(staleAt) < nowMs);
  const syncStatus = organizationRecord
    ? organizationRecord.syncStatus === 'never'
      ? 'never'
      : isStale
        ? 'stale'
        : 'fresh'
    : 'never';

  return {
    ...ref,
    image: organizationRecord?.image ?? organizationRecord?.logo ?? ref.image ?? null,
    logo: organizationRecord?.logo ?? null,
    url: organizationRecord?.url ?? null,
    archetype: organizationRecord?.archetype ?? null,
    commitment: organizationRecord?.commitment ?? null,
    primaryFocus: organizationRecord?.primaryFocus ?? null,
    secondaryFocus: organizationRecord?.secondaryFocus ?? null,
    lang: organizationRecord?.lang ?? null,
    claimed: Boolean(organizationRecord?.claimed),
    blueprintSharingEnabled: organizationRecord?.blueprintSharingEnabled !== false,
    deletedAt,
    lastLiveSyncAt: normalizeIsoTimestamp(organizationRecord?.lastLiveSyncAt),
    nextEligibleLiveSyncAt: normalizeIsoTimestamp(organizationRecord?.nextEligibleLiveSyncAt),
    staleAt,
    memberCount: Number.isFinite(Number(organizationRecord?.memberCount)) &&
      Number(organizationRecord.memberCount) > 0
      ? Number(organizationRecord.memberCount)
      : Number.isFinite(Number(organizationRecord?.members)) &&
          Number(organizationRecord.members) > 0
        ? Number(organizationRecord.members)
      : 0,
    syncStatus,
    claimRequestStatus: null,
    claimRequestSubmittedAt: null,
    claimedByCurrentUser:
      Boolean(organizationRecord?.claimedByAccountId) &&
      organizationRecord.claimedByAccountId === accountId,
  };
}

async function readOrganizationRecordsBySid(store, refs) {
  const entries = await Promise.all(
    refs.map(async (ref) => [ref.sid, await readOrganizationRecord(store, ref.sid)]),
  );

  return new Map(entries);
}

async function readOrganizationClaimRequestsBySid(store, accountId, refs) {
  const entries = await Promise.all(
    refs.map(async (ref) => [
      ref.sid,
      await readOrganizationClaimRequest(store, ref.sid, accountId),
    ]),
  );

  return new Map(entries);
}

async function syncProfileMainOrganization(store, account, apiKey, { fetchImpl = fetch } = {}) {
  if (!account?.rsi?.handle || !apiKey) {
    return account;
  }
  if (!shouldRefreshProfileMainOrganization(account)) {
    return account;
  }

  const profile = await fetchRsiProfileByHandle(apiKey, account.rsi.handle, {
    fetchImpl,
    mode: 'cache',
  });
  const profileOrganization = profile.organization;
  const currentRefs = Array.isArray(account.organizations) ? account.organizations : [];
  const refsWithoutProfileMain = currentRefs.filter((ref) => ref.source !== 'profile-main');
  const now = toIsoNow();

  if (!profileOrganization) {
    if (refsWithoutProfileMain.length === currentRefs.length) {
      return account;
    }

    return saveAccountOrganizations(store, account.accountId, refsWithoutProfileMain, account.profile);
  }

  const existingOrganizationRecord = await readOrganizationRecord(store, profileOrganization.sid);
  const ownerBypassCandidate = isOrganizationAdminCandidate({
    rank: profileOrganization.rank,
    stars: null,
  });
  const canReviveDeletedOrganization =
    isOrganizationDeleted(existingOrganizationRecord) && ownerBypassCandidate;

  if (isOrganizationIgnored(account, profileOrganization.sid) && !canReviveDeletedOrganization) {
    if (refsWithoutProfileMain.length === currentRefs.length) {
      return account;
    }

    return saveAccountOrganizations(store, account.accountId, refsWithoutProfileMain, account.profile);
  }

  if (isOrganizationDeleted(existingOrganizationRecord) && !canReviveDeletedOrganization) {
    const nextIgnoredOrganizationSids = Array.from(
      new Set([...(account.ignoredOrganizationSids ?? []), profileOrganization.sid]),
    );

    if (
      refsWithoutProfileMain.length === currentRefs.length &&
      nextIgnoredOrganizationSids.length === (account.ignoredOrganizationSids ?? []).length
    ) {
      return account;
    }

    return saveAccountOrganizations(store, account.accountId, refsWithoutProfileMain, account.profile, {
      ignoredOrganizationSids: nextIgnoredOrganizationSids,
    });
  }

  if (canReviveDeletedOrganization) {
    await reviveDeletedOrganizationRecord(
      store,
      existingOrganizationRecord,
      {
        ...profileOrganization,
        image: profileOrganization.image ?? profileOrganization.logo ?? null,
      },
      { now },
    );
  }

  await upsertOrganizationMetadata(store, {
    ...profileOrganization,
    image: profileOrganization.image ?? profileOrganization.logo ?? null,
  });

  const existingRef =
    currentRefs.find((ref) => ref.sid === profileOrganization.sid) ?? null;
  const profileMainStatus =
    existingRef?.status === 'verified_admin'
      ? 'verified_admin'
      : 'verified_member';
  const profileMainRef = {
    sid: profileOrganization.sid,
    source: 'profile-main',
    name: profileOrganization.name,
    image: profileOrganization.image ?? profileOrganization.logo ?? null,
    status: profileMainStatus,
    rank:
      existingRef?.status === 'verified_admin'
        ? existingRef?.rank ?? profileOrganization.rank ?? null
        : profileOrganization.rank ?? existingRef?.rank ?? null,
    stars: existingRef?.stars ?? null,
    lastSeenAt: now,
    lastVerifiedAt:
      existingRef?.status === 'verified_admin'
        ? existingRef?.lastVerifiedAt ?? now
        : now,
  };

  const nextRefs = upsertOrganizationRef(refsWithoutProfileMain, profileMainRef);
  const nextIgnoredOrganizationSids = (account.ignoredOrganizationSids ?? []).filter(
    (ignoredSid) => ignoredSid !== profileOrganization.sid,
  );
  const currentSerialized = JSON.stringify(sortOrganizationRefs(currentRefs));
  const nextSerialized = JSON.stringify(sortOrganizationRefs(nextRefs));
  if (
    currentSerialized === nextSerialized &&
    nextIgnoredOrganizationSids.length === (account.ignoredOrganizationSids ?? []).length
  ) {
    return account;
  }

  return saveAccountOrganizations(store, account.accountId, nextRefs, account.profile, {
    ignoredOrganizationSids: nextIgnoredOrganizationSids,
  });
}

async function applyFreshMembershipSnapshots(store, account) {
  if (!account?.rsi?.handle || !Array.isArray(account.organizations) || account.organizations.length === 0) {
    return account;
  }

  const organizationRecordsBySid = await readOrganizationRecordsBySid(store, account.organizations);
  const nowMs = Date.now();
  let hasChanges = false;
  const nextRefs = account.organizations.map((ref) => {
    const organizationRecord = organizationRecordsBySid.get(ref.sid) ?? null;
    if (!organizationRecord || !isSnapshotFreshForMembership(organizationRecord, nowMs)) {
      return ref;
    }

    const matchingMember = findOrganizationMemberByHandle(
      organizationRecord.memberSnapshot,
      account.rsi.handle,
    );
    if (!matchingMember) {
      if (ref.source === 'profile-main') {
        const preservedRef = {
          ...ref,
          lastSeenAt: organizationRecord.lastLiveSyncAt ?? ref.lastSeenAt ?? null,
        };
        hasChanges ||= JSON.stringify(preservedRef) !== JSON.stringify(ref);
        return preservedRef;
      }

      const observedRef = buildObservedOrganizationRef(ref, {
        lastSeenAt: ref.lastSeenAt ?? organizationRecord.lastLiveSyncAt ?? ref.lastSeenAt,
      });
      hasChanges ||= JSON.stringify(observedRef) !== JSON.stringify(ref);
      return observedRef;
    }

    const verifiedRef = buildVerifiedOrganizationRef(
      ref,
      matchingMember,
      organizationRecord.lastLiveSyncAt,
      {
        lastSeenAt: organizationRecord.lastLiveSyncAt ?? ref.lastSeenAt ?? null,
      },
    );
    hasChanges ||= JSON.stringify(verifiedRef) !== JSON.stringify(ref);
    return verifiedRef;
  });

  if (!hasChanges) {
    return account;
  }

  return saveAccountOrganizations(store, account.accountId, nextRefs, account.profile);
}

function decorateAccountOrganizations(account, organizationRecordsBySid, claimRequestsBySid = new Map()) {
  const nowMs = Date.now();
  return {
    ...account,
    organizations: account.organizations.map((ref) =>
      ({
        ...decorateOrganizationRef(
          ref,
          organizationRecordsBySid.get(ref.sid) ?? null,
          account.accountId,
          nowMs,
        ),
        claimRequestStatus:
          claimRequestsBySid.get(ref.sid)?.status ?? null,
        claimRequestSubmittedAt:
          claimRequestsBySid.get(ref.sid)?.submittedAt ?? null,
      })
    ),
  };
}

async function decorateAccountOrganizationsFromStore(store, account) {
  const organizationRecordsBySid = await readOrganizationRecordsBySid(store, account.organizations);
  const claimRequestsBySid = await readOrganizationClaimRequestsBySid(
    store,
    account.accountId,
    account.organizations,
  );
  return decorateAccountOrganizations(account, organizationRecordsBySid, claimRequestsBySid);
}

function canAutoRefreshStaleSnapshot(account, organizationRef, organizationRecord, nowMs = Date.now()) {
  if (!organizationRecord || !isSnapshotStale(organizationRecord, nowMs)) {
    return false;
  }

  return Boolean(
    organizationRecord.claimedByAccountId === account.accountId ||
      organizationRecord.adminAccountIds.includes(account.accountId) ||
      organizationRef?.status === 'verified_admin',
  );
}

async function refreshStaleOrganizationSnapshots(
  store,
  account,
  apiKey,
  { fetchImpl = fetch } = {},
) {
  if (!apiKey || !Array.isArray(account?.organizations) || account.organizations.length === 0) {
    return account;
  }

  const organizationRecordsBySid = await readOrganizationRecordsBySid(store, account.organizations);
  const nowMs = Date.now();

  for (const organizationRef of account.organizations) {
    const organizationRecord = organizationRecordsBySid.get(organizationRef.sid) ?? null;
    if (!canAutoRefreshStaleSnapshot(account, organizationRef, organizationRecord, nowMs)) {
      continue;
    }

    try {
      const refreshedRecord = await refreshLiveOrganizationSnapshot(store, apiKey, organizationRef.sid, {
        fetchImpl,
      });
      organizationRecordsBySid.set(organizationRef.sid, refreshedRecord);
      break;
    } catch (error) {
      if (error instanceof OrganizationServiceError && error.status === 429) {
        break;
      }
    }
  }

  return account;
}

async function safeSyncAndDecorateAccountOrganizations(
  store,
  account,
  apiKey,
  { fetchImpl = fetch } = {},
) {
  try {
    return await syncAndDecorateAccountOrganizations(store, account, apiKey, { fetchImpl });
  } catch {
    return decorateAccountOrganizationsFromStore(store, account);
  }
}

async function refreshOrganizationMetadataCounts(
  store,
  account,
  apiKey,
  { fetchImpl = fetch } = {},
) {
  if (!apiKey || !Array.isArray(account?.organizations) || account.organizations.length === 0) {
    return account;
  }

  for (const organizationRef of account.organizations) {
    const organizationRecord = await readOrganizationRecord(store, organizationRef.sid);
    if (isOrganizationDeleted(organizationRecord)) {
      continue;
    }
    const hasKnownMemberCount =
      (Number.isFinite(Number(organizationRecord?.memberCount)) && Number(organizationRecord.memberCount) > 0) ||
      (Number.isFinite(Number(organizationRecord?.members)) && Number(organizationRecord.members) > 0);

    if (hasKnownMemberCount) {
      continue;
    }

    try {
      const metadata = await fetchRsiOrganizationBySid(apiKey, organizationRef.sid, {
        fetchImpl,
        mode: 'cache',
      });
      await upsertOrganizationMetadata(store, metadata);
    } catch {
      // Ignore metadata refresh failures here and keep the last known record.
    }
  }

  return account;
}

async function refreshLiveOrganizationSnapshot(store, apiKey, sid, { fetchImpl = fetch } = {}) {
  const quotaStatus = await fetchRsiApiKeyStatus(apiKey, { fetchImpl });
  if (quotaStatus.remainingLiveRequests <= 0) {
    throw new OrganizationServiceError(
      429,
      'The daily live RSI verification limit has been reached. Try again tomorrow.',
    );
  }

  let metadata;
  try {
    metadata = await fetchRsiOrganizationBySid(apiKey, sid, {
      fetchImpl,
      mode: 'cache',
    });
  } catch (error) {
    if (!isLikelyNotFoundError(error)) {
      throw error;
    }

    metadata = await fetchRsiOrganizationBySid(apiKey, sid, {
      fetchImpl,
      mode: 'auto',
    });
  }
  const members = await fetchAllRsiOrganizationMembers(apiKey, sid, { fetchImpl });
  const existingRecord = await readOrganizationRecord(store, sid);
  const now = toIsoNow();
  const nextRecord = {
    ...(existingRecord ?? {
      sid: metadata.sid,
      claimed: false,
      claimedByAccountId: null,
    adminAccountIds: [],
    createdAt: now,
    blueprintSharingEnabled: true,
    deletedAt: null,
    }),
    ...metadata,
    image: metadata.image ?? metadata.logo ?? existingRecord?.image ?? null,
    memberSnapshot: members,
    lastLiveSyncAt: now,
    nextEligibleLiveSyncAt: new Date(Date.now() + ORGANIZATION_LIVE_SYNC_COOLDOWN_MS).toISOString(),
    staleAt: new Date(Date.now() + ORGANIZATION_SNAPSHOT_STALE_MS).toISOString(),
    memberCount: members.length,
    syncStatus: 'fresh',
    updatedAt: now,
  };

  return writeOrganizationRecord(store, nextRecord);
}

async function ensureAccountHasOrganizationRef(store, account, sid, apiKey, { fetchImpl = fetch } = {}) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const existingRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (existingRef) {
    return account;
  }

  const metadata = await fetchRsiOrganizationBySid(apiKey, normalizedSid, {
    fetchImpl,
    mode: 'cache',
  });
  await upsertOrganizationMetadata(store, metadata);

  const nextRef = {
    sid: normalizedSid,
    source: 'manual',
    name: metadata.name,
    image: metadata.image ?? metadata.logo ?? null,
    status: 'observed',
    rank: null,
    stars: null,
    lastSeenAt: toIsoNow(),
    lastVerifiedAt: null,
  };
  const nextRefs = upsertOrganizationRef(account.organizations, nextRef);
  return saveAccountOrganizations(store, account.accountId, nextRefs, account.profile);
}

function assertLinkedRsiHandle(account) {
  if (!account?.rsi?.handle) {
    throw new OrganizationServiceError(400, 'Link an RSI account before managing organizations.');
  }
}

function assertActiveOrganizationRecord(organizationRecord) {
  if (!organizationRecord) {
    throw new OrganizationServiceError(404, 'Organization data is not available yet.');
  }
  if (isOrganizationDeleted(organizationRecord)) {
    throw new OrganizationServiceError(410, 'This organization was removed from the app.');
  }
}

function assertClaimedByCurrentUser(organizationRecord, account) {
  assertActiveOrganizationRecord(organizationRecord);
  if (organizationRecord.claimedByAccountId !== account.accountId) {
    throw new OrganizationServiceError(
      403,
      'Only the organization owner can manage this setting in the app.',
    );
  }
}

async function listStoredAccountIds(store) {
  if (typeof store?.listJsonKeys !== 'function') {
    throw new OrganizationServiceError(500, 'Account storage listing is not available.');
  }

  const accountKeys = await store.listJsonKeys('accounts/');
  return accountKeys
    .filter((key) => String(key).startsWith('accounts/') && String(key).endsWith('.json'))
    .map((key) => String(key).slice('accounts/'.length, -'.json'.length))
    .filter(Boolean);
}

export class OrganizationServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'OrganizationServiceError';
    this.status = status;
  }
}

export async function syncAndDecorateAccountOrganizations(
  store,
  account,
  apiKey,
  { fetchImpl = fetch } = {},
) {
  let nextAccount = account;
  if (nextAccount?.rsi?.handle && apiKey) {
    nextAccount = await syncProfileMainOrganization(store, nextAccount, apiKey, { fetchImpl });
  }

  nextAccount = await refreshOrganizationMetadataCounts(store, nextAccount, apiKey, { fetchImpl });
  nextAccount = await refreshStaleOrganizationSnapshots(store, nextAccount, apiKey, { fetchImpl });
  nextAccount = await applyFreshMembershipSnapshots(store, nextAccount);
  const organizationRecordsBySid = await readOrganizationRecordsBySid(store, nextAccount.organizations);
  const claimRequestsBySid = await readOrganizationClaimRequestsBySid(
    store,
    nextAccount.accountId,
    nextAccount.organizations,
  );
  return decorateAccountOrganizations(nextAccount, organizationRecordsBySid, claimRequestsBySid);
}

export async function addAccountOrganizationBySid(
  store,
  account,
  apiKey,
  sid,
  { fetchImpl = fetch } = {},
) {
  assertLinkedRsiHandle(account);
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const existingRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (existingRef) {
    throw new OrganizationServiceError(409, 'This organization is already linked to your account.');
  }

  const existingOrganizationRecord = await readOrganizationRecord(store, normalizedSid);
  const isDeletedOrganization = isOrganizationDeleted(existingOrganizationRecord);

  let metadata;
  try {
    metadata = await fetchRsiOrganizationBySid(apiKey, normalizedSid, {
      fetchImpl,
      mode: 'cache',
    });
  } catch (error) {
    if (!isLikelyNotFoundError(error)) {
      throw error;
    }

    metadata = await fetchRsiOrganizationBySid(apiKey, normalizedSid, {
      fetchImpl,
      mode: 'auto',
    });
  }

  const existingMetadataRef = account.organizations.find((ref) => ref.sid === metadata.sid) ?? null;
  if (existingMetadataRef) {
    throw new OrganizationServiceError(409, 'This organization is already linked to your account.');
  }

  await upsertOrganizationMetadata(store, metadata);

  const existingRecord = await readOrganizationRecord(store, metadata.sid);
  let matchingMember = existingRecord && isSnapshotFreshForMembership(existingRecord)
    ? findOrganizationMemberByHandle(existingRecord.memberSnapshot, account.rsi.handle)
    : null;

  if (!matchingMember) {
    matchingMember = await resolveOrganizationMembershipEvidence(
      apiKey,
      metadata.sid,
      account,
      null,
      { fetchImpl },
    );
  }

  if (!matchingMember) {
    const quotaStatus = await fetchRsiApiKeyStatus(apiKey, { fetchImpl });
    if (quotaStatus.remainingLiveRequests <= 0) {
      throw new OrganizationServiceError(
        429,
        'The daily live RSI verification limit has been reached. Try again tomorrow.',
      );
    }

    const membershipProof = await findRsiOrganizationMemberByHandle(
      apiKey,
      metadata.sid,
      account.rsi.handle,
      { fetchImpl },
    );
    matchingMember = membershipProof?.member ?? null;
  }

  if (!matchingMember) {
    throw new OrganizationServiceError(
      403,
      'Your linked RSI handle was not found in this organization.',
    );
  }

  if (isDeletedOrganization && !isOrganizationAdminCandidate(matchingMember)) {
    throw new OrganizationServiceError(410, 'This organization was removed from the app.');
  }

  if (isDeletedOrganization) {
    await reviveDeletedOrganizationRecord(
      store,
      existingOrganizationRecord,
      {
        ...metadata,
        image: metadata.image ?? metadata.logo ?? null,
      },
      { now: toIsoNow() },
    );
  }

  const nextRef = {
    sid: metadata.sid,
    source: 'manual',
    name: metadata.name,
    image: metadata.image ?? metadata.logo ?? null,
    status: isOrganizationAdminCandidate(matchingMember) ? 'verified_admin' : 'verified_member',
    rank: matchingMember.rank ?? null,
    stars: Number.isFinite(Number(matchingMember.stars)) ? Number(matchingMember.stars) : null,
    lastSeenAt: toIsoNow(),
    lastVerifiedAt: toIsoNow(),
  };
  const nextRefs = upsertOrganizationRef(account.organizations, nextRef);
  const nextIgnoredOrganizationSids = (account.ignoredOrganizationSids ?? []).filter(
    (ignoredSid) => ignoredSid !== metadata.sid,
  );
  const nextAccount = await saveAccountOrganizations(
    store,
    account.accountId,
    nextRefs,
    account.profile,
    {
      ignoredOrganizationSids: nextIgnoredOrganizationSids,
    },
  );
  return safeSyncAndDecorateAccountOrganizations(store, nextAccount, apiKey, { fetchImpl });
}

export async function removeAccountOrganizationBySid(store, account, sid) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const existingRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (!existingRef) {
    throw new OrganizationServiceError(404, 'Organization not found in this account.');
  }

  const nextRefs = account.organizations.filter((ref) => ref.sid !== normalizedSid);
  const nextIgnoredOrganizationSids =
    existingRef.source === 'profile-main'
      ? Array.from(new Set([...(account.ignoredOrganizationSids ?? []), normalizedSid]))
      : (account.ignoredOrganizationSids ?? []).filter((ignoredSid) => ignoredSid !== normalizedSid);

  const organizationRecord = await readOrganizationRecord(store, normalizedSid);
  if (organizationRecord) {
    const nextAdminAccountIds = (organizationRecord.adminAccountIds ?? []).filter(
      (accountId) => accountId !== account.accountId,
    );
    const nextClaimedByAccountId =
      organizationRecord.claimedByAccountId === account.accountId
        ? null
        : organizationRecord.claimedByAccountId;

    await writeOrganizationRecord(store, {
      ...organizationRecord,
      claimed: Boolean(nextClaimedByAccountId),
      claimedByAccountId: nextClaimedByAccountId,
      adminAccountIds: nextAdminAccountIds,
      updatedAt: toIsoNow(),
    });
  }

  return saveAccountOrganizations(store, account.accountId, nextRefs, account.profile, {
    ignoredOrganizationSids: nextIgnoredOrganizationSids,
  });
}

export async function deleteOwnedOrganizationFromApp(store, account, sid) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const organizationRecord = await readOrganizationRecord(store, normalizedSid);
  assertClaimedByCurrentUser(organizationRecord, account);

  const now = toIsoNow();
  const accountIds = await listStoredAccountIds(store);
  for (const accountId of accountIds) {
    const storedAccount = await readAccountRecord(store, accountId);
    if (!storedAccount) {
      continue;
    }

    const hasOrganizationRef = storedAccount.organizations.some((ref) => ref.sid === normalizedSid);
    const hasOrganizationShares = Object.prototype.hasOwnProperty.call(
      storedAccount.organizationBlueprintShares ?? {},
      normalizedSid,
    );
    const hasOrganizationResourceShares = Object.prototype.hasOwnProperty.call(
      storedAccount.organizationResourceShares ?? {},
      normalizedSid,
    );
    if (!hasOrganizationRef && !hasOrganizationShares && !hasOrganizationResourceShares) {
      continue;
    }

    const nextOrganizations = storedAccount.organizations.filter((ref) => ref.sid !== normalizedSid);
    const nextOrganizationBlueprintShares = removeOrganizationSidFromShareMap(
      storedAccount.organizationBlueprintShares,
      normalizedSid,
    );
    const nextOrganizationResourceShares = removeOrganizationSidFromShareMap(
      storedAccount.organizationResourceShares,
      normalizedSid,
    );
    const nextIgnoredOrganizationSids = uniqueStringArray([
      ...(storedAccount.ignoredOrganizationSids ?? []),
      normalizedSid,
    ]);

    await writeAccountRecord(store, {
      ...storedAccount,
      organizations: nextOrganizations,
      organizationBlueprintShares: nextOrganizationBlueprintShares,
      organizationResourceShares: nextOrganizationResourceShares,
      sharedBlueprintIds: deriveSharedBlueprintIdsFromOrganizationShareMap(
        nextOrganizationBlueprintShares,
      ),
      sharedResourceEntryIds: deriveSharedResourceEntryIdsFromOrganizationShareMap(
        nextOrganizationResourceShares,
      ),
      ignoredOrganizationSids: nextIgnoredOrganizationSids,
      updatedAt: now,
    });
  }

  await writeOrganizationRecord(store, {
    ...organizationRecord,
    claimed: false,
    claimedByAccountId: null,
    adminAccountIds: [],
    sharedAccountIds: [],
    blueprintSharingEnabled: false,
    deletedAt: now,
    updatedAt: now,
  });

  const nextAccount = await readAccountRecord(store, account.accountId, account.profile);
  if (!nextAccount) {
    throw new OrganizationServiceError(404, 'Account not found after deleting the organization.');
  }

  return decorateAccountOrganizationsFromStore(store, nextAccount);
}

export async function setOwnedOrganizationBlueprintSharingEnabled(
  store,
  account,
  sid,
  enabled,
) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }
  if (typeof enabled !== 'boolean') {
    throw new OrganizationServiceError(400, 'A boolean sharing state is required.');
  }

  const organizationRecord = await readOrganizationRecord(store, normalizedSid);
  assertClaimedByCurrentUser(organizationRecord, account);

  await writeOrganizationRecord(store, {
    ...organizationRecord,
    blueprintSharingEnabled: enabled,
    updatedAt: toIsoNow(),
  });

  return decorateAccountOrganizationsFromStore(store, account);
}

export async function claimAccountOrganization(
  store,
  account,
  sid,
  { reviewerEmail = null } = {},
) {
  assertLinkedRsiHandle(account);
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const organizationRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (!organizationRef) {
    throw new OrganizationServiceError(404, 'Organization not found in this account.');
  }

  const organizationRecord = await readOrganizationRecord(store, normalizedSid);
  assertActiveOrganizationRecord(organizationRecord);
  if (organizationRecord?.claimed) {
    throw new OrganizationServiceError(
      409,
      'This organization is already claimed in the app.',
    );
  }

  const existingRequest = await readOrganizationClaimRequest(store, normalizedSid, account.accountId);
  if (existingRequest?.status === 'pending') {
    throw new OrganizationServiceError(
      409,
      'A claim review is already pending for this organization.',
    );
  }

  await writeOrganizationClaimRequest(store, {
    sid: normalizedSid,
    accountId: account.accountId,
    organizationName: organizationRef.name,
    organizationSource: organizationRef.source,
    requestedByDiscordId: account.profile.id,
    requestedByDiscordUsername: account.profile.username,
    requestedByDiscordDisplayName: account.profile.displayName,
    requestedByRsiHandle: account.rsi?.handle ?? null,
    requestedByRsiDisplayName: account.rsi?.displayName ?? account.rsi?.handle ?? null,
    reviewerEmail: String(reviewerEmail ?? '').trim() || null,
    status: 'pending',
    submittedAt: toIsoNow(),
    updatedAt: toIsoNow(),
  });

  return decorateAccountOrganizationsFromStore(store, account);
}

export async function refreshAccountOrganizationMembers(
  store,
  account,
  apiKey,
  sid,
  { fetchImpl = fetch } = {},
) {
  assertLinkedRsiHandle(account);
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const organizationRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (!organizationRef) {
    throw new OrganizationServiceError(404, 'Organization not found in this account.');
  }

  const existingRecord = await readOrganizationRecord(store, normalizedSid);
  assertActiveOrganizationRecord(existingRecord);
  if (!existingRecord.claimed) {
    throw new OrganizationServiceError(
      400,
      'Claim the organization first before refreshing members.',
    );
  }

  const isKnownAdmin =
    existingRecord.adminAccountIds.includes(account.accountId) ||
    organizationRef.status === 'verified_admin';
  if (!isKnownAdmin) {
    throw new OrganizationServiceError(
      403,
      'Only verified organization admins can refresh organization members.',
    );
  }

  const nextEligibleAt = normalizeIsoTimestamp(existingRecord.nextEligibleLiveSyncAt);
  if (nextEligibleAt && Date.parse(nextEligibleAt) > Date.now()) {
    throw new OrganizationServiceError(
      429,
      `Organization members can be refreshed only once every 24 hours. Try again after ${nextEligibleAt}.`,
    );
  }

  const refreshedRecord = await refreshLiveOrganizationSnapshot(store, apiKey, normalizedSid, {
    fetchImpl,
  });
  const matchingMember = await resolveOrganizationMembershipEvidence(
    apiKey,
    normalizedSid,
    account,
    refreshedRecord.memberSnapshot,
    { fetchImpl },
  );
  const adminAccountIds = isOrganizationAdminCandidate(matchingMember)
    ? Array.from(new Set([...(refreshedRecord.adminAccountIds ?? []), account.accountId]))
    : (refreshedRecord.adminAccountIds ?? []).filter((accountId) => accountId !== account.accountId);

  await writeOrganizationRecord(store, {
    ...refreshedRecord,
    adminAccountIds,
    updatedAt: toIsoNow(),
  });

  const nextRefs = account.organizations.map((ref) => {
    if (ref.sid !== normalizedSid) {
      return ref;
    }

    if (!matchingMember) {
      return buildObservedOrganizationRef(ref, {
        lastSeenAt: refreshedRecord.lastLiveSyncAt ?? ref.lastSeenAt ?? null,
      });
    }

    return buildVerifiedOrganizationRef(
      ref,
      matchingMember,
      refreshedRecord.lastLiveSyncAt,
      {
        lastSeenAt: refreshedRecord.lastLiveSyncAt ?? ref.lastSeenAt ?? null,
      },
    );
  });

  const nextAccount = await saveAccountOrganizations(store, account.accountId, nextRefs, account.profile);
  return safeSyncAndDecorateAccountOrganizations(store, nextAccount, apiKey, { fetchImpl });
}

export async function buildOrganizationSharedBlueprints(store, account, sid) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const organizationRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (!organizationRef) {
    throw new OrganizationServiceError(404, 'Organization not found in this account.');
  }
  if (!isVerifiedOrganizationStatus(organizationRef.status)) {
    throw new OrganizationServiceError(
      403,
      'Only verified organization members can access shared organization blueprints.',
    );
  }

  let organizationRecord = await readOrganizationRecord(store, normalizedSid);
  assertActiveOrganizationRecord(organizationRecord);
  if (!isOrganizationBlueprintSharingEnabled(organizationRecord)) {
    throw new OrganizationServiceError(
      403,
      'Blueprint sharing is currently disabled for this organization.',
    );
  }
  let sharedAccountIds = Array.isArray(organizationRecord?.sharedAccountIds)
    ? organizationRecord.sharedAccountIds
    : [];

  if (sharedAccountIds.length === 0) {
    const backfilledSharedAccountIds = await findAccountIdsSharingOrganizationBlueprints(
      store,
      normalizedSid,
    );
    if (backfilledSharedAccountIds.length > 0) {
      sharedAccountIds = backfilledSharedAccountIds;
      if (organizationRecord) {
        organizationRecord = await writeOrganizationRecord(store, {
          ...organizationRecord,
          sharedAccountIds: backfilledSharedAccountIds,
          updatedAt: toIsoNow(),
        });
      }
    }
  }

  const candidateAccountIds = new Set(sharedAccountIds);

  if (organizationRecord?.memberSnapshot?.length) {
    const snapshotMemberAccountIds = await Promise.all(
      organizationRecord.memberSnapshot.map((member) =>
        readAccountIdByRsiHandle(store, member.handle),
      ),
    );
    for (const memberAccountId of snapshotMemberAccountIds) {
      if (memberAccountId) {
        candidateAccountIds.add(memberAccountId);
      }
    }
  }

  if ((account.organizationBlueprintShares?.[normalizedSid] ?? []).length > 0) {
    candidateAccountIds.add(account.accountId);
  }

  const members = (
    await Promise.all(
      [...candidateAccountIds].map(async (memberAccountId) => {
        const memberAccount = await readAccountRecord(store, memberAccountId);
        if (!memberAccount?.rsi?.handle) {
          return null;
        }

        const inventoryBlueprintIdSet = new Set(
          (memberAccount.inventoryBlueprintIds ?? []).map((blueprintId) => String(blueprintId)),
        );
        const sharedBlueprintIds = (memberAccount.organizationBlueprintShares?.[normalizedSid] ?? [])
          .map((blueprintId) => String(blueprintId))
          .filter((blueprintId) => inventoryBlueprintIdSet.has(blueprintId));

        if (sharedBlueprintIds.length === 0) {
          return null;
        }

        const memberOrganizationRef =
          memberAccount.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
        const matchingSnapshotMember = findOrganizationMemberByHandle(
          organizationRecord?.memberSnapshot,
          memberAccount.rsi.handle,
        );

        if (!matchingSnapshotMember && !isVerifiedOrganizationStatus(memberOrganizationRef?.status)) {
          return null;
        }

        return {
          handle: memberAccount.rsi.handle,
          display:
            matchingSnapshotMember?.display ??
            memberAccount.rsi.displayName ??
            memberAccount.profile.displayName ??
            memberAccount.profile.username ??
            memberAccount.rsi.handle,
          image: matchingSnapshotMember?.image ?? memberAccount.profile.avatarUrl ?? null,
          rank: matchingSnapshotMember?.rank ?? memberOrganizationRef?.rank ?? null,
          stars:
            Number.isFinite(Number(matchingSnapshotMember?.stars))
              ? Number(matchingSnapshotMember.stars)
              : Number.isFinite(Number(memberOrganizationRef?.stars))
                ? Number(memberOrganizationRef.stars)
                : null,
          sharedBlueprintIds,
        };
      }),
    )
  )
    .filter((member) => member !== null)
    .sort((left, right) =>
      String(left.display ?? left.handle).localeCompare(String(right.display ?? right.handle), undefined, {
        sensitivity: 'base',
        numeric: true,
      }),
    );

  if (members.length === 0) {
    throw new OrganizationServiceError(
      404,
      'No shared blueprints are available for this organization yet.',
    );
  }

  return {
    organization: {
      sid: organizationRecord?.sid ?? organizationRef.sid,
      name: organizationRecord?.name ?? organizationRef.name,
      image:
        organizationRecord?.image ??
        organizationRecord?.logo ??
        organizationRef.image ??
        organizationRef.logo ??
        null,
      logo: organizationRecord?.logo ?? organizationRef.logo ?? null,
      url: organizationRecord?.url ?? organizationRef.url ?? null,
      claimed: Boolean(organizationRecord?.claimed ?? organizationRef.claimed),
      blueprintSharingEnabled: organizationRecord?.blueprintSharingEnabled !== false,
      lastLiveSyncAt: organizationRecord?.lastLiveSyncAt ?? organizationRef.lastLiveSyncAt ?? null,
      staleAt: organizationRecord?.staleAt ?? organizationRef.staleAt ?? null,
      memberCount:
        typeof organizationRecord?.memberCount === 'number'
          ? organizationRecord.memberCount
          : typeof organizationRef.memberCount === 'number'
            ? organizationRef.memberCount
            : members.length,
      syncStatus: organizationRecord?.syncStatus ?? organizationRef.syncStatus ?? 'never',
    },
    members,
  };
}

export async function buildOrganizationSharedResources(store, account, sid) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new OrganizationServiceError(400, 'Organization SID is required.');
  }

  const organizationRef = account.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
  if (!organizationRef) {
    throw new OrganizationServiceError(404, 'Organization not found in this account.');
  }
  if (!isVerifiedOrganizationStatus(organizationRef.status)) {
    throw new OrganizationServiceError(
      403,
      'Only verified organization members can access shared organization resources.',
    );
  }

  let organizationRecord = await readOrganizationRecord(store, normalizedSid);
  assertActiveOrganizationRecord(organizationRecord);
  let sharedAccountIds = Array.isArray(organizationRecord?.sharedAccountIds)
    ? organizationRecord.sharedAccountIds
    : [];

  if (sharedAccountIds.length === 0) {
    const backfilledSharedAccountIds = await findAccountIdsSharingOrganizationResources(
      store,
      normalizedSid,
    );
    if (backfilledSharedAccountIds.length > 0) {
      sharedAccountIds = backfilledSharedAccountIds;
      if (organizationRecord) {
        organizationRecord = await writeOrganizationRecord(store, {
          ...organizationRecord,
          sharedAccountIds: backfilledSharedAccountIds,
          updatedAt: toIsoNow(),
        });
      }
    }
  }

  const candidateAccountIds = new Set(sharedAccountIds);

  if (organizationRecord?.memberSnapshot?.length) {
    const snapshotMemberAccountIds = await Promise.all(
      organizationRecord.memberSnapshot.map((member) =>
        readAccountIdByRsiHandle(store, member.handle),
      ),
    );
    for (const memberAccountId of snapshotMemberAccountIds) {
      if (memberAccountId) {
        candidateAccountIds.add(memberAccountId);
      }
    }
  }

  if ((account.organizationResourceShares?.[normalizedSid] ?? []).length > 0) {
    candidateAccountIds.add(account.accountId);
  }

  const members = (
    await Promise.all(
      [...candidateAccountIds].map(async (memberAccountId) => {
        const memberAccount = await readAccountRecord(store, memberAccountId);
        if (!memberAccount?.rsi?.handle) {
          return null;
        }

        const inventoryResourceEntryIds = new Set(
          (memberAccount.inventoryResources ?? []).map((resourceEntry) => String(resourceEntry.id)),
        );
        const sharedResourceEntries = (memberAccount.organizationResourceShares?.[normalizedSid] ?? [])
          .map((resourceEntryId) => String(resourceEntryId))
          .filter((resourceEntryId) => inventoryResourceEntryIds.has(resourceEntryId))
          .map((resourceEntryId) =>
            memberAccount.inventoryResources.find((resourceEntry) => resourceEntry.id === resourceEntryId) ?? null,
          )
          .filter((resourceEntry) => resourceEntry !== null);

        if (sharedResourceEntries.length === 0) {
          return null;
        }

        const memberOrganizationRef =
          memberAccount.organizations.find((ref) => ref.sid === normalizedSid) ?? null;
        const matchingSnapshotMember = findOrganizationMemberByHandle(
          organizationRecord?.memberSnapshot,
          memberAccount.rsi.handle,
        );

        if (!matchingSnapshotMember && !isVerifiedOrganizationStatus(memberOrganizationRef?.status)) {
          return null;
        }

        return {
          handle: memberAccount.rsi.handle,
          display:
            matchingSnapshotMember?.display ??
            memberAccount.rsi.displayName ??
            memberAccount.profile.displayName ??
            memberAccount.profile.username ??
            memberAccount.rsi.handle,
          image: matchingSnapshotMember?.image ?? memberAccount.profile.avatarUrl ?? null,
          rank: matchingSnapshotMember?.rank ?? memberOrganizationRef?.rank ?? null,
          stars:
            Number.isFinite(Number(matchingSnapshotMember?.stars))
              ? Number(matchingSnapshotMember.stars)
              : Number.isFinite(Number(memberOrganizationRef?.stars))
                ? Number(memberOrganizationRef.stars)
                : null,
          sharedResources: sharedResourceEntries,
        };
      }),
    )
  )
    .filter((member) => member !== null)
    .sort((left, right) =>
      String(left.display ?? left.handle).localeCompare(String(right.display ?? right.handle), undefined, {
        sensitivity: 'base',
        numeric: true,
      }),
    );

  if (members.length === 0) {
    throw new OrganizationServiceError(
      404,
      'No shared resources are available for this organization yet.',
    );
  }

  return {
    organization: {
      sid: organizationRecord?.sid ?? organizationRef.sid,
      name: organizationRecord?.name ?? organizationRef.name,
      image:
        organizationRecord?.image ??
        organizationRecord?.logo ??
        organizationRef.image ??
        organizationRef.logo ??
        null,
      logo: organizationRecord?.logo ?? organizationRef.logo ?? null,
      url: organizationRecord?.url ?? organizationRef.url ?? null,
      claimed: Boolean(organizationRecord?.claimed ?? organizationRef.claimed),
      lastLiveSyncAt: organizationRecord?.lastLiveSyncAt ?? organizationRef.lastLiveSyncAt ?? null,
      staleAt: organizationRecord?.staleAt ?? organizationRef.staleAt ?? null,
      memberCount:
        typeof organizationRecord?.memberCount === 'number'
          ? organizationRecord.memberCount
          : typeof organizationRef.memberCount === 'number'
            ? organizationRef.memberCount
            : members.length,
      syncStatus: organizationRecord?.syncStatus ?? organizationRef.syncStatus ?? 'never',
    },
    members,
  };
}
