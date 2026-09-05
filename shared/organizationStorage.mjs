import {
  isObject,
  normalizeIsoTimestamp,
  normalizeNumber,
  normalizeOrganizationSid,
  normalizeStringArray,
  toIsoNow,
} from './normalize.mjs';

const ORGANIZATION_RECORD_VERSION = 3;
export const ORGANIZATION_LIVE_SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const ORGANIZATION_SNAPSHOT_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeHttpsUrl(value) {
  const input = String(value ?? '').trim();
  if (!input) {
    return null;
  }

  try {
    const url = new URL(input);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeOrganizationMember(member) {
  if (!isObject(member)) {
    return null;
  }

  const handle = String(member.handle ?? '').trim();
  if (!handle) {
    return null;
  }

  return {
    handle,
    display: String(member.display ?? handle).trim() || handle,
    image: normalizeHttpsUrl(member.image),
    rank: member.rank ? String(member.rank) : null,
    stars: normalizeNumber(member.stars),
    roles: normalizeStringArray(member.roles),
    isAdminCandidate: Boolean(member.isAdminCandidate),
  };
}

export function normalizeOrganizationMetadata(value, fallbackSid = null) {
  if (!isObject(value)) {
    return null;
  }

  const sid = normalizeOrganizationSid(value.sid ?? fallbackSid);
  if (!sid) {
    return null;
  }

  return {
    sid,
    name: String(value.name ?? value.display ?? sid).trim() || sid,
    image: normalizeHttpsUrl(value.image),
    logo: normalizeHttpsUrl(value.logo),
    banner: normalizeHttpsUrl(value.banner),
    url: normalizeHttpsUrl(value.url),
    archetype: value.archetype ? String(value.archetype) : null,
    commitment: value.commitment ? String(value.commitment) : null,
    primaryFocus: value.primaryFocus ? String(value.primaryFocus) : null,
    secondaryFocus: value.secondaryFocus ? String(value.secondaryFocus) : null,
    lang: value.lang ? String(value.lang) : null,
    members: normalizeNumber(value.members),
    recruiting: typeof value.recruiting === 'boolean' ? value.recruiting : null,
  };
}

export function getOrganizationObjectKey(sid) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new Error('Organization SID is required to build the storage key.');
  }

  return `organizations/${normalizedSid}.json`;
}

export function createDefaultOrganizationRecord(metadata, { now } = {}) {
  const normalizedMetadata = normalizeOrganizationMetadata(metadata);
  if (!normalizedMetadata) {
    throw new Error('A valid organization metadata object is required.');
  }

  const timestamp = now ?? toIsoNow();

  return {
    version: ORGANIZATION_RECORD_VERSION,
    sid: normalizedMetadata.sid,
    ...normalizedMetadata,
    claimed: false,
    claimedByAccountId: null,
    adminAccountIds: [],
    sharedAccountIds: [],
    blueprintSharingEnabled: true,
    deletedAt: null,
    memberSnapshot: [],
    memberSnapshotVerifiedAt: null,
    memberSnapshotComplete: false,
    lastLiveSyncAt: null,
    nextEligibleLiveSyncAt: null,
    staleAt: null,
    memberCount: normalizedMetadata.members ?? 0,
    syncStatus: 'never',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeOrganizationRecord(value, fallbackSid = null) {
  const metadata = normalizeOrganizationMetadata(value, fallbackSid);
  if (!metadata) {
    return null;
  }

  const memberSnapshot = Array.isArray(value?.memberSnapshot)
    ? value.memberSnapshot
        .map((member) => normalizeOrganizationMember(member))
        .filter((member) => member !== null)
    : [];

  const memberCount = normalizeNumber(
    value?.memberCount ?? value?.members ?? memberSnapshot.length,
  );
  const syncStatus = String(value?.syncStatus ?? '').trim().toLowerCase();

  return {
    version: ORGANIZATION_RECORD_VERSION,
    sid: metadata.sid,
    ...metadata,
    claimed: Boolean(value?.claimed),
    claimedByAccountId: value?.claimedByAccountId ? String(value.claimedByAccountId) : null,
    adminAccountIds: normalizeStringArray(value?.adminAccountIds),
    sharedAccountIds: normalizeStringArray(value?.sharedAccountIds),
    blueprintSharingEnabled: value?.blueprintSharingEnabled !== false,
    deletedAt: normalizeIsoTimestamp(value?.deletedAt),
    memberSnapshot,
    memberSnapshotVerifiedAt: normalizeIsoTimestamp(value?.memberSnapshotVerifiedAt),
    memberSnapshotComplete: value?.memberSnapshotComplete === true &&
      Array.isArray(value.memberSnapshot) && value.memberSnapshot.length === memberSnapshot.length,
    lastLiveSyncAt: normalizeIsoTimestamp(value?.lastLiveSyncAt),
    nextEligibleLiveSyncAt: normalizeIsoTimestamp(value?.nextEligibleLiveSyncAt),
    staleAt: normalizeIsoTimestamp(value?.staleAt),
    memberCount: memberCount ?? memberSnapshot.length,
    syncStatus:
      syncStatus === 'fresh' || syncStatus === 'stale' || syncStatus === 'never'
        ? syncStatus
        : 'never',
    createdAt: normalizeIsoTimestamp(value?.createdAt),
    updatedAt: normalizeIsoTimestamp(value?.updatedAt),
  };
}

// Organization metadata refreshes do not revalidate the legacy roster. Only a
// separately dated, explicitly complete roster may grant or revoke membership.
export function getVerifiedOrganizationMemberSnapshot(record, nowMs = Date.now()) {
  const verifiedAt = Date.parse(record?.memberSnapshotVerifiedAt);
  if (record?.memberSnapshotComplete !== true || !Array.isArray(record.memberSnapshot) ||
      !Number.isFinite(verifiedAt) || verifiedAt > nowMs + 60000 ||
      verifiedAt + ORGANIZATION_SNAPSHOT_STALE_MS <= nowMs) return null;
  return record.memberSnapshot;
}

export async function readOrganizationRecord(store, sid) {
  const rawRecord = await store.readJson(getOrganizationObjectKey(sid));
  if (!rawRecord) {
    return null;
  }

  return normalizeOrganizationRecord(rawRecord, sid);
}

export async function writeOrganizationRecord(store, organizationRecord) {
  const normalizedRecord = normalizeOrganizationRecord(
    organizationRecord,
    organizationRecord?.sid,
  );
  if (!normalizedRecord) {
    throw new Error('A valid organization record is required.');
  }

  await store.writeJson(
    getOrganizationObjectKey(normalizedRecord.sid),
    normalizedRecord,
  );
  return normalizedRecord;
}

export async function upsertOrganizationMetadata(store, metadata, { now } = {}) {
  const normalizedMetadata = normalizeOrganizationMetadata(metadata);
  if (!normalizedMetadata) {
    throw new Error('A valid organization metadata object is required.');
  }

  const existingRecord = await readOrganizationRecord(store, normalizedMetadata.sid);
  const timestamp = now ?? toIsoNow();
  const nextRecord = {
    ...(existingRecord ?? createDefaultOrganizationRecord(normalizedMetadata, { now: timestamp })),
    ...normalizedMetadata,
    // Always prefer fresh member count from Citizen iD or RSI scraping over stale stored value.
    // The old "freeze if lastLiveSyncAt is set" guard was for the retired Star Citizen API roster
    // sync — Citizen iD is now the authoritative source and must always win.
    memberCount:
      normalizedMetadata.members != null
        ? normalizedMetadata.members
        : existingRecord?.memberCount ?? 0,
    lastLiveSyncAt: timestamp,
    staleAt: new Date(Date.parse(timestamp) + ORGANIZATION_SNAPSHOT_STALE_MS).toISOString(),
    syncStatus: 'fresh',
    updatedAt: timestamp,
  };

  return writeOrganizationRecord(store, nextRecord);
}
