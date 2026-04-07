import {
  isObject,
  normalizeIsoTimestamp,
  normalizeOrganizationSid,
  toIsoNow,
} from './normalize.mjs';

const ORGANIZATION_CLAIM_REQUEST_VERSION = 1;
const CLAIM_REQUEST_STATUSES = new Set(['pending', 'approved', 'rejected', 'cancelled']);

function normalizeClaimRequestStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  return CLAIM_REQUEST_STATUSES.has(status) ? status : 'pending';
}

export function getOrganizationClaimRequestObjectKey(sid, accountId) {
  const normalizedSid = normalizeOrganizationSid(sid);
  const normalizedAccountId = String(accountId ?? '').trim();
  if (!normalizedSid || !normalizedAccountId) {
    throw new Error('Organization SID and account id are required for a claim request key.');
  }

  return `organization-claim-requests/${normalizedSid}/${normalizedAccountId}.json`;
}

export function normalizeOrganizationClaimRequestRecord(value, fallback = {}) {
  if (!isObject(value) && !isObject(fallback)) {
    return null;
  }

  const source = {
    ...(isObject(fallback) ? fallback : {}),
    ...(isObject(value) ? value : {}),
  };

  const sid = normalizeOrganizationSid(source.sid);
  const accountId = String(source.accountId ?? '').trim();
  if (!sid || !accountId) {
    return null;
  }

  return {
    version: ORGANIZATION_CLAIM_REQUEST_VERSION,
    sid,
    accountId,
    organizationName: String(source.organizationName ?? sid).trim() || sid,
    organizationSource: String(source.organizationSource ?? '').trim().toLowerCase() || null,
    requestedByDiscordId: String(source.requestedByDiscordId ?? '').trim() || null,
    requestedByDiscordUsername: String(source.requestedByDiscordUsername ?? '').trim() || null,
    requestedByDiscordDisplayName: String(source.requestedByDiscordDisplayName ?? '').trim() || null,
    requestedByRsiHandle: String(source.requestedByRsiHandle ?? '').trim() || null,
    requestedByRsiDisplayName: String(source.requestedByRsiDisplayName ?? '').trim() || null,
    reviewerEmail: String(source.reviewerEmail ?? '').trim() || null,
    note: String(source.note ?? '').trim() || null,
    status: normalizeClaimRequestStatus(source.status),
    submittedAt: normalizeIsoTimestamp(source.submittedAt) ?? toIsoNow(),
    updatedAt: normalizeIsoTimestamp(source.updatedAt) ?? toIsoNow(),
  };
}

export async function readOrganizationClaimRequest(store, sid, accountId) {
  const payload = await store.readJson(getOrganizationClaimRequestObjectKey(sid, accountId));
  if (!payload) {
    return null;
  }

  return normalizeOrganizationClaimRequestRecord(payload, { sid, accountId });
}

export async function writeOrganizationClaimRequest(store, record) {
  const normalizedRecord = normalizeOrganizationClaimRequestRecord(record, record);
  if (!normalizedRecord) {
    throw new Error('A valid organization claim request record is required.');
  }

  await store.writeJson(
    getOrganizationClaimRequestObjectKey(normalizedRecord.sid, normalizedRecord.accountId),
    normalizedRecord,
  );

  return normalizedRecord;
}
