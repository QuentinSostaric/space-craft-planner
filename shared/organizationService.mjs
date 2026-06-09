import {
  readAccountIdByRsiHandle,
  readAccountRecord,
  readOrganizationScopedShareAccountIds,
  readScopedAccountRecord,
  saveAccountOrganizations,
  writeAccountRecord,
} from './accountStorage.mjs';
import {
  readOrganizationRecord,
  upsertOrganizationMetadata,
  writeOrganizationRecord,
} from './organizationStorage.mjs';
import {
  readOrganizationClaimRequest,
  writeOrganizationClaimRequest,
} from './organizationClaimRequestStorage.mjs';
import {
  isOrganizationAdminCandidate,
  scrapeRsiProfileByHandle,
} from './rsiLink.mjs';
import {
  normalizeComparableText,
  normalizeIsoTimestamp,
  normalizeOrganizationSid,
  normalizeText,
  toIsoNow,
} from './normalize.mjs';

/**
 * Enrich Citizen iD organization memberships with rank/stars/memberCount from RSI profile
 * scraping when Citizen iD JWT claims don't expose those fields (common with string-only claims).
 * Falls back to the original array silently if scraping fails.
 */
async function enrichOrganizationsWithRsiProfile(handle, organizations, { fetchImpl = fetch } = {}) {
  const needsEnrichment = organizations.some(
    (org) => org.rank == null || org.stars == null || org.members == null,
  );
  if (!needsEnrichment) {
    return organizations;
  }

  let scrapedBySid;
  try {
    const profile = await scrapeRsiProfileByHandle(handle, { fetchImpl });
    const scrapedOrgs = [
      profile.organization
        ? { ...profile.organization, rank: profile.rank, stars: profile.stars }
        : null,
      ...(profile.affiliations ?? []),
    ].filter(Boolean);
    scrapedBySid = new Map(
      scrapedOrgs
        .map((org) => [normalizeOrganizationSid(org.sid), org])
        .filter(([sid]) => sid != null),
    );
  } catch {
    return organizations;
  }

  return organizations.map((org) => {
    const scraped = scrapedBySid.get(normalizeOrganizationSid(org.sid));
    if (!scraped) return org;
    return {
      ...org,
      rank: org.rank ?? scraped.rank ?? null,
      stars: org.stars ?? scraped.stars ?? null,
      members: org.members ?? scraped.members ?? null,
    };
  });
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

function normalizeExternalOrganizationRef(organization, { source = 'manual', status = 'verified_member' } = {}) {
  const sid = normalizeOrganizationSid(organization?.sid);
  if (!sid) {
    return null;
  }

  const member = {
    rank: organization.rank ?? null,
    stars: organization.stars ?? null,
  };

  return {
    sid,
    source,
    name: normalizeText(organization.name ?? organization.display ?? sid) || sid,
    image: organization.image ?? organization.logo ?? null,
    logo: organization.logo ?? null,
    url: organization.url ?? `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
    archetype: organization.archetype ?? null,
    commitment: organization.commitment ?? null,
    primaryFocus: organization.primaryFocus ?? null,
    secondaryFocus: organization.secondaryFocus ?? null,
    lang: organization.lang ?? null,
    members: Number.isFinite(Number(organization.members)) ? Number(organization.members) : null,
    status: isOrganizationAdminCandidate(member) ? 'verified_admin' : status,
    rank: member.rank,
    stars: Number.isFinite(Number(member.stars)) ? Number(member.stars) : null,
    lastSeenAt: toIsoNow(),
    lastVerifiedAt: toIsoNow(),
  };
}

async function syncExternalVerifiedOrganizations(store, account, organizations = [], { fetchImpl = fetch } = {}) {
  if (!account?.rsi?.handle || !Array.isArray(organizations) || organizations.length === 0) {
    return account;
  }

  // Citizen iD JWT claims often carry only SID strings with no rank/stars/memberCount.
  // Fall back to RSI profile scraping to fill in those gaps before persisting.
  const enrichedOrganizations = await enrichOrganizationsWithRsiProfile(
    account.rsi.handle,
    organizations,
    { fetchImpl },
  );

  let nextRefs = account.organizations ?? [];
  let nextIgnoredOrganizationSids = account.ignoredOrganizationSids ?? [];

  for (const organization of enrichedOrganizations) {
    const normalizedRef = normalizeExternalOrganizationRef(organization, {
      source: organization.source === 'profile-main' ? 'profile-main' : 'manual',
      status: organization.status === 'observed' ? 'observed' : 'verified_member',
    });
    if (!normalizedRef) {
      continue;
    }

    const existingOrganizationRecord = await readOrganizationRecord(store, normalizedRef.sid);
    const canReviveDeletedOrganization =
      isOrganizationDeleted(existingOrganizationRecord) && normalizedRef.status === 'verified_admin';
    if (isOrganizationDeleted(existingOrganizationRecord) && !canReviveDeletedOrganization) {
      nextIgnoredOrganizationSids = Array.from(
        new Set([...nextIgnoredOrganizationSids, normalizedRef.sid]),
      );
      continue;
    }

    if (canReviveDeletedOrganization) {
      await reviveDeletedOrganizationRecord(store, existingOrganizationRecord, normalizedRef, {
        now: toIsoNow(),
      });
    } else {
      await upsertOrganizationMetadata(store, normalizedRef);
    }

    nextRefs = upsertOrganizationRef(nextRefs, normalizedRef);
    nextIgnoredOrganizationSids = nextIgnoredOrganizationSids.filter(
      (ignoredSid) => ignoredSid !== normalizedRef.sid,
    );
  }

  const currentSerialized = JSON.stringify(sortOrganizationRefs(account.organizations ?? []));
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

async function safeSyncAndDecorateAccountOrganizations(
  store,
  account,
  _unused = null,
  _options = {},
) {
  try {
    return await syncAndDecorateAccountOrganizations(store, account);
  } catch {
    return decorateAccountOrganizationsFromStore(store, account);
  }
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
  _unused = null,
  _options = {},
) {
  let nextAccount = account;
  nextAccount = await applyFreshMembershipSnapshots(store, nextAccount);
  const organizationRecordsBySid = await readOrganizationRecordsBySid(store, nextAccount.organizations);
  const claimRequestsBySid = await readOrganizationClaimRequestsBySid(
    store,
    nextAccount.accountId,
    nextAccount.organizations,
  );
  return decorateAccountOrganizations(nextAccount, organizationRecordsBySid, claimRequestsBySid);
}

export async function syncCitizenIdAccountOrganizations(store, account, organizations = [], { fetchImpl = fetch } = {}) {
  const nextAccount = await syncExternalVerifiedOrganizations(store, account, organizations, { fetchImpl });
  return decorateAccountOrganizationsFromStore(store, nextAccount);
}

export async function addAccountOrganizationBySid(
  store,
  account,
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

  const scrapedProfile = await scrapeRsiProfileByHandle(account.rsi.handle, { fetchImpl });
  const scrapedOrganizations = [
    scrapedProfile.organization
      ? {
          ...scrapedProfile.organization,
          source: 'profile-main',
          rank: scrapedProfile.rank,
          stars: scrapedProfile.stars,
        }
      : null,
    ...(scrapedProfile.affiliations ?? []),
  ].filter(Boolean);
  const scrapedMetadata = scrapedOrganizations.find(
    (organization) => normalizeOrganizationSid(organization.sid) === normalizedSid,
  );
  const metadata = scrapedMetadata ?? null;

  if (!metadata) {
    throw new OrganizationServiceError(
      403,
      'Your linked RSI handle was not found in this organization.',
    );
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
    console.warn(
      `[org-claim] handle "${account.rsi.handle}" not found in roster snapshot for org "${metadata.sid}" — granting verified_member without roster confirmation`,
    );
    matchingMember = {
      handle: account.rsi.handle,
      display: account.rsi.displayName ?? account.rsi.handle,
      image: account.rsi.image ?? null,
      rank: metadata.rank ?? scrapedProfile.rank ?? null,
      stars: Number.isFinite(Number(metadata.stars ?? scrapedProfile.stars))
        ? Number(metadata.stars ?? scrapedProfile.stars)
        : null,
      roles: [],
    };
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
  return safeSyncAndDecorateAccountOrganizations(store, nextAccount);
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
  sid,
  _options = {},
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

  throw new OrganizationServiceError(
    410,
    'Live organization member refresh is no longer available. Re-sync with Citizen iD to update your own RSI organization memberships.',
  );
}

export async function buildOrganizationSharedBlueprints(store, account, sid, options = {}) {
  const datasetScope = options?.datasetScope ?? account?.datasetScope ?? 'live';
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
  const legacySharedAccountIds = Array.isArray(organizationRecord?.sharedAccountIds)
    ? organizationRecord.sharedAccountIds
    : [];
  // Use the index maintained incrementally on every account write instead of
  // scanning (and reading) every account record on this read path.
  const scopedSharedAccountIds = await readOrganizationScopedShareAccountIds(
    store,
    normalizedSid,
    datasetScope,
  );

  const candidateAccountIds = new Set([
    ...legacySharedAccountIds,
    ...scopedSharedAccountIds,
  ]);

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
        const memberAccount = await readScopedAccountRecord(store, memberAccountId, null, datasetScope);
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

export async function buildOrganizationSharedResources(store, account, sid, options = {}) {
  const datasetScope = options?.datasetScope ?? account?.datasetScope ?? 'live';
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
  const legacySharedAccountIds = Array.isArray(organizationRecord?.sharedAccountIds)
    ? organizationRecord.sharedAccountIds
    : [];
  // Use the index maintained incrementally on every account write instead of
  // scanning (and reading) every account record on this read path.
  const scopedSharedAccountIds = await readOrganizationScopedShareAccountIds(
    store,
    normalizedSid,
    datasetScope,
  );

  const candidateAccountIds = new Set([
    ...legacySharedAccountIds,
    ...scopedSharedAccountIds,
  ]);

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
        const memberAccount = await readScopedAccountRecord(store, memberAccountId, null, datasetScope);
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
