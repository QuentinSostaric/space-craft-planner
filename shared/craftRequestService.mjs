import {
  readAccountIdByRsiHandle,
  readAccountRecord,
  writeAccountRecord,
} from './accountStorage.mjs';
import { readOrganizationRecord } from './organizationStorage.mjs';
import {
  normalizeBaseUrl,
  normalizeOrganizationSid,
  normalizeText,
  toIsoNow,
} from './normalize.mjs';

function normalizeComparableText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeStorageScope(value) {
  const input = normalizeText(value).toLowerCase();
  return input === 'dev' ? 'dev' : 'prod';
}

function normalizeCraftRequestComment(value) {
  const comment = normalizeText(value);
  if (!comment) {
    return null;
  }
  return comment.slice(0, 1000);
}

function normalizeCraftRequestResourcesOption(value) {
  const option = normalizeText(value).toLowerCase();
  if (option === 'has-resources' || option === 'hasresources') {
    return 'has_resources';
  }
  if (option === 'buy-resources' || option === 'buyresources') {
    return 'buy_resources';
  }
  if (option === 'has_resources' || option === 'buy_resources') {
    return option;
  }
  return 'unspecified';
}

function createCraftRequestId() {
  if (typeof crypto?.randomUUID === 'function') {
    return `craftreq_${crypto.randomUUID()}`;
  }

  if (typeof crypto?.getRandomValues === 'function') {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const randomPart = Array.from(randomBytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `craftreq_${randomPart}`;
  }

  throw new CraftRequestServiceError(500, 'Secure random identifiers are unavailable in this runtime.');
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

async function writeMirroredCraftRequestAccounts(
  store,
  {
    ownerPreviousAccount,
    ownerNextAccount,
    requesterNextAccount,
  },
) {
  let savedOwnerAccount = null;

  try {
    savedOwnerAccount = await writeAccountRecord(store, ownerNextAccount);
    const savedRequesterAccount = await writeAccountRecord(store, requesterNextAccount);

    return {
      ownerAccount: savedOwnerAccount,
      requesterAccount: savedRequesterAccount,
    };
  } catch (error) {
    if (savedOwnerAccount) {
      try {
        await writeAccountRecord(store, ownerPreviousAccount);
      } catch (rollbackError) {
        console.error(
          '[craft-requests] failed to rollback owner account after mirrored write failure',
          rollbackError,
        );
      }
    }

    throw new CraftRequestServiceError(
      503,
      'Craft request persistence failed. Please retry.',
    );
  }
}

async function updateCraftRequestRecords(store, ownerAccount, requesterAccount, requestId, updater) {
  const normalizedRequestId = normalizeText(requestId);
  const ownerRequest =
    (ownerAccount?.incomingCraftRequests ?? []).find((request) => request.id === normalizedRequestId) ??
    null;
  if (!ownerRequest) {
    throw new CraftRequestServiceError(404, 'Craft request not found.');
  }

  const nextRequest = updater(ownerRequest);
  const nextOwnerAccount = {
    ...ownerAccount,
    incomingCraftRequests: updateRequestCollection(
      ownerAccount.incomingCraftRequests,
      normalizedRequestId,
      () => nextRequest,
    ),
  };
  const nextRequesterAccount = {
    ...requesterAccount,
    outgoingCraftRequests: updateRequestCollection(
      requesterAccount.outgoingCraftRequests,
      normalizedRequestId,
      () => nextRequest,
    ),
  };

  const {
    ownerAccount: savedOwnerAccount,
    requesterAccount: savedRequesterAccount,
  } = await writeMirroredCraftRequestAccounts(store, {
    ownerPreviousAccount: ownerAccount,
    ownerNextAccount: nextOwnerAccount,
    requesterNextAccount: nextRequesterAccount,
  });
  const savedRequest =
    (savedOwnerAccount.incomingCraftRequests ?? []).find((request) => request.id === normalizedRequestId) ??
    (savedRequesterAccount.outgoingCraftRequests ?? []).find((request) => request.id === normalizedRequestId) ??
    nextRequest;

  return {
    request: savedRequest,
    ownerAccount: savedOwnerAccount,
    requesterAccount: savedRequesterAccount,
  };
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
    comment = null,
    resourcesOption = 'unspecified',
    appBaseUrl = null,
    storageScope = 'prod',
  } = {},
) {
  const normalizedSid = normalizeOrganizationSid(organizationSid);
  const normalizedBlueprintId = normalizeText(blueprintId);
  const normalizedOwnerHandle = normalizeText(ownerHandle);
  const normalizedComment = normalizeCraftRequestComment(comment);
  const normalizedResourcesOption = normalizeCraftRequestResourcesOption(resourcesOption);
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
  if (organizationRecord?.deletedAt) {
    throw new CraftRequestServiceError(
      410,
      'This organization was removed from the app.',
    );
  }
  if (organizationRecord && organizationRecord.blueprintSharingEnabled === false) {
    throw new CraftRequestServiceError(
      403,
      'Blueprint sharing is currently disabled for this organization.',
    );
  }
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
    ownerRsiHandle:
      ownerAccount.rsi?.handle ??
      ownerMember?.handle ??
      normalizedOwnerHandle,
    comment: normalizedComment,
    resourcesOption: normalizedResourcesOption,
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

  const {
    ownerAccount: savedOwnerAccount,
    requesterAccount: savedRequesterAccount,
  } = await writeMirroredCraftRequestAccounts(store, {
    ownerPreviousAccount: ownerAccount,
    ownerNextAccount: nextOwnerAccount,
    requesterNextAccount: nextRequesterAccount,
  });

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
  const updated = await updateCraftRequestRecords(
    store,
    {
      ...ownerAccount,
      updatedAt: now,
    },
    {
      ...requesterAccount,
      updatedAt: now,
    },
    normalizedRequestId,
    applyDecision,
  );

  return {
    account: isOwner ? updated.ownerAccount : updated.requesterAccount,
    requestId: normalizedRequestId,
    status: normalizedDecision,
    request: updated.request,
    ownerAccount: updated.ownerAccount,
    requesterAccount: updated.requesterAccount,
  };
}

export async function respondToCraftRequestsBulk(
  store,
  actingAccount,
  actions,
) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new CraftRequestServiceError(400, 'At least one craft request action is required.');
  }

  let currentActingAccount = actingAccount;
  const results = [];

  for (const rawAction of actions) {
    const requestId = normalizeText(rawAction?.requestId);
    const decision = normalizeComparableText(rawAction?.decision);

    if (!requestId || !decision) {
      results.push({
        requestId,
        ok: false,
        error: 'Craft request action is incomplete.',
        errorStatus: 400,
      });
      continue;
    }

    try {
      if (decision === 'deleted') {
        const result = await deleteCraftRequest(
          store,
          currentActingAccount,
          requestId,
        );
        currentActingAccount = result.account;
        results.push({
          requestId,
          ok: true,
          status: 'deleted',
          request: {
            ...result.request,
            status: 'deleted',
          },
          ownerAccount: result.ownerAccount,
          requesterAccount: result.requesterAccount,
        });
      } else {
        const result = await respondToCraftRequest(
          store,
          currentActingAccount,
          requestId,
          decision,
        );
        currentActingAccount = result.account;
        results.push({
          requestId,
          ok: true,
          status: result.status,
          request: result.request,
          ownerAccount: result.ownerAccount,
          requesterAccount: result.requesterAccount,
        });
      }
    } catch (error) {
      results.push({
        requestId,
        ok: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Craft request update failed.',
        errorStatus:
          error instanceof CraftRequestServiceError && Number.isFinite(error.status)
            ? error.status
            : 500,
      });
    }
  }

  return {
    account: currentActingAccount,
    results,
  };
}

export async function deleteCraftRequest(
  store,
  actingAccount,
  requestId,
) {
  const normalizedRequestId = normalizeText(requestId);
  if (!normalizedRequestId) {
    throw new CraftRequestServiceError(400, 'Craft request id is required.');
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

  if (existingRequest.status !== 'denied' && existingRequest.status !== 'closed') {
    throw new CraftRequestServiceError(
      409,
      'Only denied or closed craft requests can be deleted.',
    );
  }

  const requesterAccount = await readAccountRecord(store, existingRequest.requesterAccountId);
  if (!requesterAccount) {
    throw new CraftRequestServiceError(404, 'The requester account could not be loaded.');
  }
  const isOwner = existingRequest.ownerAccountId === actingAccount.accountId;
  const ownerAccount = isOwner
    ? actingAccount
    : await readAccountRecord(store, existingRequest.ownerAccountId);
  if (!ownerAccount) {
    throw new CraftRequestServiceError(404, 'The owner account could not be loaded.');
  }

  const now = toIsoNow();
  const nextOwnerAccount = {
    ...ownerAccount,
    incomingCraftRequests: (ownerAccount.incomingCraftRequests ?? []).filter(
      (request) => request.id !== normalizedRequestId,
    ),
    updatedAt: now,
  };
  const nextRequesterAccount = {
    ...requesterAccount,
    outgoingCraftRequests: (requesterAccount.outgoingCraftRequests ?? []).filter(
      (request) => request.id !== normalizedRequestId,
    ),
    updatedAt: now,
  };

  const {
    ownerAccount: savedOwnerAccount,
    requesterAccount: savedRequesterAccount,
  } = await writeMirroredCraftRequestAccounts(store, {
    ownerPreviousAccount: ownerAccount,
    ownerNextAccount: nextOwnerAccount,
    requesterNextAccount: nextRequesterAccount,
  });

  return {
    account: isOwner ? savedOwnerAccount : savedRequesterAccount,
    request: existingRequest,
    ownerAccount: savedOwnerAccount,
    requesterAccount: savedRequesterAccount,
  };
}

export async function saveCraftRequestNotificationState(
  store,
  ownerAccountId,
  requestId,
  {
    ownerDiscordChannelId,
    ownerDiscordMessageId,
    contactInitiatedAt,
  } = {},
) {
  const normalizedOwnerAccountId = normalizeText(ownerAccountId);
  const normalizedRequestId = normalizeText(requestId);
  if (!normalizedOwnerAccountId || !normalizedRequestId) {
    throw new CraftRequestServiceError(400, 'Craft request identifiers are required.');
  }

  const ownerAccount = await readAccountRecord(store, normalizedOwnerAccountId);
  if (!ownerAccount) {
    throw new CraftRequestServiceError(404, 'The owner account could not be loaded.');
  }

  const existingRequest =
    (ownerAccount.incomingCraftRequests ?? []).find((request) => request.id === normalizedRequestId) ??
    null;
  if (!existingRequest) {
    throw new CraftRequestServiceError(404, 'Craft request not found.');
  }

  const requesterAccount = await readAccountRecord(store, existingRequest.requesterAccountId);
  if (!requesterAccount) {
    throw new CraftRequestServiceError(404, 'The requester account could not be loaded.');
  }

  const updatedAt = normalizeText(contactInitiatedAt)
    ? normalizeText(contactInitiatedAt)
    : existingRequest.updatedAt;

  return updateCraftRequestRecords(
    store,
    ownerAccount,
    requesterAccount,
    normalizedRequestId,
    (request) => ({
      ...request,
      ownerDiscordChannelId:
        ownerDiscordChannelId === undefined ? request.ownerDiscordChannelId ?? null : normalizeText(ownerDiscordChannelId) || null,
      ownerDiscordMessageId:
        ownerDiscordMessageId === undefined ? request.ownerDiscordMessageId ?? null : normalizeText(ownerDiscordMessageId) || null,
      contactInitiatedAt:
        contactInitiatedAt === undefined ? request.contactInitiatedAt ?? null : normalizeText(contactInitiatedAt) || null,
      updatedAt,
    }),
  );
}
