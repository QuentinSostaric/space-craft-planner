import {
  readAccountIdByRsiHandle,
  readAccountRecord,
  writeAccountRecord,
} from './accountStorage.mjs';
import { readOrganizationRecord } from './organizationStorage.mjs';

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeComparableText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBaseUrl(value) {
  const input = normalizeText(value);
  if (!input) {
    return null;
  }

  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeStorageScope(value) {
  const input = normalizeText(value).toLowerCase();
  return input === 'dev' ? 'dev' : 'prod';
}

function normalizeOrganizationSid(value) {
  const input = normalizeText(value);
  if (!input) {
    return null;
  }

  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  const sid = (urlMatch?.[1] ?? input).trim().toUpperCase();
  return sid || null;
}

function createCraftRequestId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `craftreq_${Date.now().toString(36)}_${randomPart}`;
}

function getProfileDisplayName(account) {
  return (
    normalizeText(account?.profile?.displayName) ||
    normalizeText(account?.profile?.globalName) ||
    normalizeText(account?.profile?.username) ||
    normalizeText(account?.rsi?.displayName) ||
    normalizeText(account?.rsi?.handle) ||
    normalizeText(account?.accountId)
  );
}

function findMemberByHandle(memberSnapshot, handle) {
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

function hasVerifiedOrganizationMembership(account, sid) {
  return account?.organizations?.some(
    (organization) =>
      organization.sid === sid &&
      (organization.status === 'verified_member' ||
        organization.status === 'verified_admin'),
  );
}

function getOrganizationRefBySid(account, sid) {
  return (
    account?.organizations?.find((organization) => organization.sid === sid) ?? null
  );
}

function hasPendingDuplicateRequest(account, { organizationSid, blueprintId, ownerAccountId }) {
  return (account?.outgoingCraftRequests ?? []).some(
    (request) =>
      request.status === 'pending' &&
      request.organizationSid === organizationSid &&
      request.blueprintId === blueprintId &&
      request.ownerAccountId === ownerAccountId,
  );
}

function updateRequestCollection(requests, requestId, updater) {
  return (requests ?? []).map((request) =>
    request.id === requestId ? updater(request) : request,
  );
}

export class CraftRequestServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CraftRequestServiceError';
    this.status = status;
  }
}

export async function createOrganizationCraftRequest(
  store,
  requesterAccount,
  {
    organizationSid,
    blueprintId,
    ownerHandle,
    blueprintName = null,
    appBaseUrl = null,
    storageScope = 'prod',
  } = {},
) {
  const normalizedSid = normalizeOrganizationSid(organizationSid);
  const normalizedBlueprintId = normalizeText(blueprintId);
  const normalizedOwnerHandle = normalizeText(ownerHandle);
  if (!normalizedSid) {
    throw new CraftRequestServiceError(400, 'Organization SID is required.');
  }
  if (!normalizedBlueprintId) {
    throw new CraftRequestServiceError(400, 'Blueprint id is required.');
  }
  if (!normalizedOwnerHandle) {
    throw new CraftRequestServiceError(400, 'Owner RSI handle is required.');
  }
  if (!requesterAccount?.accountId) {
    throw new CraftRequestServiceError(401, 'Authentication required.');
  }
  if (!requesterAccount?.rsi?.handle) {
    throw new CraftRequestServiceError(400, 'Link an RSI account before sending craft requests.');
  }
  if (!hasVerifiedOrganizationMembership(requesterAccount, normalizedSid)) {
    throw new CraftRequestServiceError(
      403,
      'Only verified organization members can send craft requests.',
    );
  }

  const organizationRecord = await readOrganizationRecord(store, normalizedSid);
  const requesterMember = findMemberByHandle(
    organizationRecord?.memberSnapshot,
    requesterAccount.rsi.handle,
  );
  const requesterOrganizationRef = getOrganizationRefBySid(requesterAccount, normalizedSid);
  if (!requesterMember && !hasVerifiedOrganizationMembership(requesterAccount, normalizedSid)) {
    throw new CraftRequestServiceError(
      403,
      'Your linked RSI handle was not found in this organization member snapshot.',
    );
  }

  const ownerAccountId = await readAccountIdByRsiHandle(store, normalizedOwnerHandle);
  if (!ownerAccountId) {
    throw new CraftRequestServiceError(
      404,
      'The selected shared blueprint owner is not linked in the app.',
    );
  }
  if (ownerAccountId === requesterAccount.accountId) {
    throw new CraftRequestServiceError(
      400,
      'You cannot request a craft from your own shared blueprint.',
    );
  }

  const ownerAccount = await readAccountRecord(store, ownerAccountId);
  if (!ownerAccount) {
    throw new CraftRequestServiceError(
      404,
      'The selected shared blueprint owner account could not be loaded.',
    );
  }

  const ownerMember = findMemberByHandle(
    organizationRecord?.memberSnapshot,
    ownerAccount.rsi?.handle ?? normalizedOwnerHandle,
  );
  const ownerOrganizationRef = getOrganizationRefBySid(ownerAccount, normalizedSid);
  if (!ownerMember && !hasVerifiedOrganizationMembership(ownerAccount, normalizedSid)) {
    throw new CraftRequestServiceError(
      404,
      'The selected shared blueprint owner is no longer verified for this organization.',
    );
  }

  const ownerInventoryIds = new Set(ownerAccount.inventoryBlueprintIds ?? []);
  const ownerSharedIds = new Set(
    ownerAccount.organizationBlueprintShares?.[normalizedSid] ?? [],
  );
  if (!ownerInventoryIds.has(normalizedBlueprintId) || !ownerSharedIds.has(normalizedBlueprintId)) {
    throw new CraftRequestServiceError(
      409,
      'This blueprint is no longer shared by that organization member.',
    );
  }

  if (
    hasPendingDuplicateRequest(requesterAccount, {
      organizationSid: normalizedSid,
      blueprintId: normalizedBlueprintId,
      ownerAccountId,
    })
  ) {
    throw new CraftRequestServiceError(
      409,
      'A craft request is already pending for this blueprint and owner.',
    );
  }

  const now = toIsoNow();
  const request = {
    id: createCraftRequestId(),
    appBaseUrl: normalizeBaseUrl(appBaseUrl),
    storageScope: normalizeStorageScope(storageScope),
    organizationSid: normalizedSid,
    organizationName:
      organizationRecord?.name ??
      requesterOrganizationRef?.name ??
      ownerOrganizationRef?.name ??
      normalizedSid,
    blueprintId: normalizedBlueprintId,
    blueprintName: normalizeText(blueprintName) || normalizedBlueprintId,
    requesterAccountId: requesterAccount.accountId,
    requesterDisplayName: getProfileDisplayName(requesterAccount),
    requesterAvatarUrl: requesterAccount.profile?.avatarUrl ?? null,
    requesterRsiHandle: requesterAccount.rsi.handle,
    ownerAccountId,
    ownerDisplayName: getProfileDisplayName(ownerAccount),
    ownerAvatarUrl: ownerAccount.profile?.avatarUrl ?? null,
    ownerRsiHandle: ownerAccount.rsi?.handle ?? ownerMember.handle,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
  };

  const nextRequesterAccount = {
    ...requesterAccount,
    outgoingCraftRequests: [request, ...(requesterAccount.outgoingCraftRequests ?? [])],
    updatedAt: now,
  };
  const nextOwnerAccount = {
    ...ownerAccount,
    incomingCraftRequests: [request, ...(ownerAccount.incomingCraftRequests ?? [])],
    updatedAt: now,
  };

  const savedRequesterAccount = await writeAccountRecord(store, nextRequesterAccount);
  const savedOwnerAccount = await writeAccountRecord(store, nextOwnerAccount);

  return {
    request,
    account: savedRequesterAccount,
    requesterAccount: savedRequesterAccount,
    ownerAccount: savedOwnerAccount,
  };
}

export async function respondToCraftRequest(
  store,
  actingAccount,
  requestId,
  decision,
) {
  const normalizedRequestId = normalizeText(requestId);
  const normalizedDecision = normalizeComparableText(decision);
  if (!normalizedRequestId) {
    throw new CraftRequestServiceError(400, 'Craft request id is required.');
  }
  if (
    normalizedDecision !== 'accepted' &&
    normalizedDecision !== 'denied' &&
    normalizedDecision !== 'closed'
  ) {
    throw new CraftRequestServiceError(400, 'Craft request decision is invalid.');
  }
  if (!actingAccount?.accountId) {
    throw new CraftRequestServiceError(401, 'Authentication required.');
  }

  const existingRequest =
    [
      ...(actingAccount.incomingCraftRequests ?? []),
      ...(actingAccount.outgoingCraftRequests ?? []),
    ].find(
      (request) => request.id === normalizedRequestId,
    ) ?? null;
  if (!existingRequest) {
    throw new CraftRequestServiceError(404, 'Craft request not found.');
  }

  const isOwner = existingRequest.ownerAccountId === actingAccount.accountId;
  const isRequester = existingRequest.requesterAccountId === actingAccount.accountId;
  if (!isOwner && !isRequester) {
    throw new CraftRequestServiceError(403, 'You are not allowed to update this craft request.');
  }

  if (normalizedDecision === 'accepted' || normalizedDecision === 'denied') {
    if (!isOwner) {
      throw new CraftRequestServiceError(403, 'Only the blueprint owner can answer this request.');
    }
    if (existingRequest.status !== 'pending') {
      throw new CraftRequestServiceError(
        409,
        'This craft request has already been answered.',
      );
    }
  } else if (normalizedDecision === 'closed' && existingRequest.status === 'closed') {
    throw new CraftRequestServiceError(409, 'This craft request is already closed.');
  }

  const requesterAccount = await readAccountRecord(store, existingRequest.requesterAccountId);
  if (!requesterAccount) {
    throw new CraftRequestServiceError(
      404,
      'The requester account could not be loaded.',
    );
  }
  const ownerAccount = isOwner
    ? actingAccount
    : await readAccountRecord(store, existingRequest.ownerAccountId);
  if (!ownerAccount) {
    throw new CraftRequestServiceError(404, 'The owner account could not be loaded.');
  }

  const now = toIsoNow();
  const applyDecision = (request) => ({
    ...request,
    status: normalizedDecision,
    updatedAt: now,
    respondedAt:
      normalizedDecision === 'accepted' || normalizedDecision === 'denied'
        ? now
        : request.respondedAt,
  });

  const nextOwnerAccount = {
    ...ownerAccount,
    incomingCraftRequests: updateRequestCollection(
      ownerAccount.incomingCraftRequests,
      normalizedRequestId,
      applyDecision,
    ),
    updatedAt: now,
  };
  const nextRequesterAccount = {
    ...requesterAccount,
    outgoingCraftRequests: updateRequestCollection(
      requesterAccount.outgoingCraftRequests,
      normalizedRequestId,
      applyDecision,
    ),
    updatedAt: now,
  };

  const savedOwnerAccount = await writeAccountRecord(store, nextOwnerAccount);
  const savedRequesterAccount = await writeAccountRecord(store, nextRequesterAccount);
  const updatedRequest =
    (savedOwnerAccount.incomingCraftRequests ?? []).find((request) => request.id === normalizedRequestId) ??
    (savedRequesterAccount.outgoingCraftRequests ?? []).find((request) => request.id === normalizedRequestId) ??
    applyDecision(existingRequest);

  return {
    account: isOwner ? savedOwnerAccount : savedRequesterAccount,
    requestId: normalizedRequestId,
    status: normalizedDecision,
    request: updatedRequest,
    ownerAccount: savedOwnerAccount,
    requesterAccount: savedRequesterAccount,
  };
}
