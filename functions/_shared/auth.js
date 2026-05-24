import { errorResponse, jsonResponse } from './gameData.js';
import {
  appendQueryParam,
  buildAuthSessionPayload,
  buildDiscordAuthorizationUrl,
  buildExpiredCookie,
  createOauthStateCookie,
  createSessionCookie,
  exchangeDiscordCode,
  fetchDiscordUserProfile,
  getOauthStateCookieName,
  getSessionCookieName,
  isDesktopRequest,
  isDesktopReturnTo,
  isDiscordAuthConfigured,
  readOauthStateFromCookies,
  readSessionFromCookies,
  sanitizeReturnTo,
} from '../../shared/discordAuth.mjs';
import {
  buildCitizenIdAuthorizationUrl,
  buildCitizenIdCallbackErrorRedirect,
  buildExpiredCitizenIdStateCookie,
  createCitizenIdStateCookie,
  exchangeCitizenIdCode,
  fetchCitizenIdRsiProfile,
  isCitizenIdAuthConfigured,
  readCitizenIdStateFromCookies,
} from '../../shared/citizenIdAuth.mjs';
import {
  clearRsiAccountLink,
  copyLiveAccountScopeToPtu,
  createBucketAccountStore,
  deleteAccountRecord,
  getNextAllowedRsiLinkAt,
  isRsiLinkRateLimited,
  normalizeAccountDatasetScope,
  readAccountRecord,
  readScopedAccountRecord,
  saveAccountInventoryResources,
  saveAccountOrganizationBlueprintShares,
  saveAccountOrganizationResourceShares,
  saveAccountState,
  saveRsiAccountLink,
  upsertDiscordAccount,
} from '../../shared/accountStorage.mjs';
import {
  addAccountOrganizationBySid,
  buildOrganizationSharedBlueprints,
  buildOrganizationSharedResources,
  claimAccountOrganization,
  deleteOwnedOrganizationFromApp,
  OrganizationServiceError,
  refreshAccountOrganizationMembers,
  removeAccountOrganizationBySid,
  setOwnedOrganizationBlueprintSharingEnabled,
  syncAndDecorateAccountOrganizations,
} from '../../shared/organizationService.mjs';
import { notifyOrganizationClaimRequest } from '../../shared/organizationClaimNotification.mjs';
import {
  createOrganizationCraftRequest,
  CraftRequestServiceError,
  deleteCraftRequest,
  respondToCraftRequest,
  respondToCraftRequestsBulk,
} from '../../shared/craftRequestService.mjs';
import {
  notifyCraftRequestOwnerViaWorker,
  resolveAppBaseUrlFromRequest,
  resolveCraftRequestStorageScope,
  syncCraftRequestStatusViaWorker,
} from '../../shared/discordBotRelay.mjs';
import { verifyRsiHandleOwnership } from '../../shared/rsiLink.mjs';
import { getGameDataBucket } from './runtimeBuckets.js';

function noStoreJson(payload, init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('Cache-Control', 'no-store');
  return jsonResponse(payload, { ...init, headers });
}

function redirectResponse(location, { status = 302, headers = {}, cookies = [] } = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Location', location);
  responseHeaders.set('Cache-Control', 'no-store');
  for (const cookie of cookies) {
    responseHeaders.append('Set-Cookie', cookie);
  }
  return new Response(null, { status, headers: responseHeaders });
}

function getAccountStore(request, env) {
  return createBucketAccountStore(getGameDataBucket(env, request));
}

function getAccountDatasetScopeFromRequest(request, payload = null) {
  const url = new URL(request.url);
  return normalizeAccountDatasetScope(
    url.searchParams.get('datasetScope') ??
      request.headers.get('X-Account-Dataset-Scope') ??
      payload?.datasetScope,
  );
}

function getStarCitizenApiKey(env) {
  return String(env?.STARCITIZEN_API_KEY ?? '').trim();
}

function getOrganizationClaimReviewerEmail(env) {
  const reviewerEmail = String(env?.ORGANIZATION_CLAIM_REVIEWER_EMAIL ?? '').trim();
  return reviewerEmail || null;
}

function runBackgroundTask(executionContext, task, label = 'background-task') {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(`[${label}]`, error);
    });

  if (typeof executionContext?.waitUntil === 'function') {
    executionContext.waitUntil(promise);
    return null;
  }

  return promise;
}

async function syncCraftRequestStatusBestEffort(
  env,
  requestRecord,
  ownerAccount,
  requesterAccount,
  label = 'craft-request-status-sync',
) {
  try {
    await syncCraftRequestStatusViaWorker(
      env,
      requestRecord,
      ownerAccount,
      requesterAccount,
    );
  } catch (error) {
    console.error(`[${label}]`, error);
  }
}

async function requireAuthenticatedSession(request, env) {
  const session = await readSessionFromCookies(request.headers.get('cookie'), env);
  if (!session?.user?.id || !session.accountId) {
    return null;
  }

  return session;
}

async function ensureAccountForSession(accountStore, session) {
  const existingAccount = await readAccountRecord(accountStore, session.accountId, session.user);
  if (existingAccount) {
    return existingAccount;
  }

  return upsertDiscordAccount(accountStore, session.user);
}

async function buildDecoratedAccount(accountStore, account, env) {
  try {
    return await syncAndDecorateAccountOrganizations(
      accountStore,
      account,
      getStarCitizenApiKey(env),
    );
  } catch {
    return account;
  }
}

async function buildScopedDecoratedAccount(accountStore, account, env, datasetScope = 'live') {
  const normalizedDatasetScope = normalizeAccountDatasetScope(datasetScope);
  const scopedAccount = await readScopedAccountRecord(
    accountStore,
    account.accountId,
    account.profile,
    normalizedDatasetScope,
  );
  const decoratedAccount = await buildDecoratedAccount(accountStore, scopedAccount ?? account, env);
  const refreshedScopedAccount = await readScopedAccountRecord(
    accountStore,
    decoratedAccount.accountId,
    decoratedAccount.profile,
    normalizedDatasetScope,
  );
  const scopedState = refreshedScopedAccount ?? scopedAccount ?? {};
  return {
    ...decoratedAccount,
    datasetScope: scopedState.datasetScope ?? normalizedDatasetScope,
    favoriteBlueprintIds: scopedState.favoriteBlueprintIds ?? decoratedAccount.favoriteBlueprintIds,
    inventoryBlueprintIds: scopedState.inventoryBlueprintIds ?? decoratedAccount.inventoryBlueprintIds,
    inventoryResources: scopedState.inventoryResources ?? decoratedAccount.inventoryResources,
    planner: scopedState.planner ?? decoratedAccount.planner,
    organizationBlueprintShares:
      scopedState.organizationBlueprintShares ?? decoratedAccount.organizationBlueprintShares,
    organizationResourceShares:
      scopedState.organizationResourceShares ?? decoratedAccount.organizationResourceShares,
    sharedBlueprintIds: scopedState.sharedBlueprintIds ?? decoratedAccount.sharedBlueprintIds,
    sharedResourceEntryIds:
      scopedState.sharedResourceEntryIds ?? decoratedAccount.sharedResourceEntryIds,
    organizations: decoratedAccount.organizations,
    incomingCraftRequests: scopedState.incomingCraftRequests ?? decoratedAccount.incomingCraftRequests,
    outgoingCraftRequests: scopedState.outgoingCraftRequests ?? decoratedAccount.outgoingCraftRequests,
  };
}

async function readAccountJsonFromRequest(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

function organizationErrorResponse(error, fallbackMessage) {
  if (error instanceof OrganizationServiceError) {
    return errorResponse(error.status, error.message);
  }

  return errorResponse(
    400,
    error instanceof Error ? error.message : fallbackMessage,
  );
}

function craftRequestErrorResponse(error, fallbackMessage) {
  if (error instanceof CraftRequestServiceError) {
    return errorResponse(error.status, error.message);
  }

  return errorResponse(
    400,
    error instanceof Error ? error.message : fallbackMessage,
  );
}

export async function handleAuthSessionRequest(request, env) {
  const session = await readSessionFromCookies(request.headers.get('cookie'), env);
  return noStoreJson({
    ...buildAuthSessionPayload(env, session),
    citizenIdRsiLinkEnabled: isCitizenIdAuthConfigured(env),
  });
}

export async function handleDiscordLoginRequest(request, env) {
  if (!isDiscordAuthConfigured(env)) {
    return errorResponse(503, 'Discord auth is not configured.');
  }

  const requestUrl = new URL(request.url);
  // Desktop app: always redirect back to tauri.localhost after OAuth regardless
  // of the returnTo param (relative paths would land on the real website).
  const rawReturnTo = isDesktopRequest(request)
    ? 'https://tauri.localhost/'
    : requestUrl.searchParams.get('returnTo');
  const returnTo = sanitizeReturnTo(rawReturnTo);
  const { state, cookie } = await createOauthStateCookie(request, env, returnTo);
  const authorizationUrl = buildDiscordAuthorizationUrl(request, env, state);

  return redirectResponse(authorizationUrl, {
    cookies: [cookie],
  });
}

export function handleDiscordBotInviteRequest(env) {
  const clientId = String(env?.DISCORD_CLIENT_ID ?? '').trim();
  if (!clientId) {
    return errorResponse(503, 'Discord bot invite is not configured.');
  }

  return redirectResponse(`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}`);
}

export async function handleDiscordCallbackRequest(request, env) {
  if (!isDiscordAuthConfigured(env)) {
    return errorResponse(503, 'Discord auth is not configured.');
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthState = await readOauthStateFromCookies(request.headers.get('cookie'), env);
  const expiredStateCookie = buildExpiredCookie(getOauthStateCookieName(), request, env);
  const expiredSessionCookie = buildExpiredCookie(getSessionCookieName(), request, env);
  const returnTo = oauthState?.returnTo ?? '/';

  if (!code || !state || !oauthState || oauthState.nonce !== state) {
    return redirectResponse(appendQueryParam(returnTo, 'auth_error', 'state_mismatch'), {
      cookies: [expiredStateCookie, expiredSessionCookie],
    });
  }

  try {
    const tokenPayload = await exchangeDiscordCode(request, env, code);
    const user = await fetchDiscordUserProfile(tokenPayload.access_token);
    const accountStore = getAccountStore(request, env);
    const account = await upsertDiscordAccount(accountStore, user);
    const sessionCookie = await createSessionCookie(request, env, user, account.accountId, {
      crossSite: isDesktopReturnTo(returnTo),
    });

    return redirectResponse(returnTo, {
      cookies: [sessionCookie, expiredStateCookie],
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'discord_oauth_failed';
    return redirectResponse(
      appendQueryParam(returnTo, 'auth_error', message),
      {
        cookies: [expiredStateCookie, expiredSessionCookie],
      },
    );
  }
}

export async function handleCitizenIdLoginRequest(request, env) {
  if (!isCitizenIdAuthConfigured(env)) {
    return errorResponse(503, 'Citizen iD auth is not configured.');
  }

  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get('returnTo'));
  const { state, cookie } = await createCitizenIdStateCookie(request, env, returnTo);
  const authorizationUrl = buildCitizenIdAuthorizationUrl(request, env, state);

  return redirectResponse(authorizationUrl, {
    cookies: [cookie],
  });
}

export async function handleCitizenIdCallbackRequest(request, env) {
  if (!isCitizenIdAuthConfigured(env)) {
    return errorResponse(503, 'Citizen iD auth is not configured.');
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthState = await readCitizenIdStateFromCookies(request.headers.get('cookie'), env);
  const expiredStateCookie = buildExpiredCitizenIdStateCookie(request, env);
  const returnTo = oauthState?.returnTo ?? '/';

  if (!code || !state || !oauthState || oauthState.nonce !== state) {
    return redirectResponse(buildCitizenIdCallbackErrorRedirect(returnTo, 'state_mismatch'), {
      cookies: [expiredStateCookie],
    });
  }

  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return redirectResponse(buildCitizenIdCallbackErrorRedirect(returnTo, 'Authentication required.'), {
      cookies: [expiredStateCookie],
    });
  }

  try {
    const tokenPayload = await exchangeCitizenIdCode(request, env, code);
    const verifiedLink = await fetchCitizenIdRsiProfile(tokenPayload.access_token, env);
    const accountStore = getAccountStore(request, env);
    await ensureAccountForSession(accountStore, session);
    await saveRsiAccountLink(accountStore, session.accountId, verifiedLink, session.user);

    return redirectResponse(returnTo, {
      cookies: [expiredStateCookie],
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'citizenid_oauth_failed';
    return redirectResponse(buildCitizenIdCallbackErrorRedirect(returnTo, message), {
      cookies: [expiredStateCookie],
    });
  }
}

export function handleLogoutRequest(request, env) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', buildExpiredCookie(getSessionCookieName(), request, env));
  headers.append('Set-Cookie', buildExpiredCookie(getOauthStateCookieName(), request, env));

  return jsonResponse(
    { ok: true },
    {
      headers,
    },
  );
}

/**
 * Higher-order helper: authenticates the request, ensures an account record
 * exists, then delegates to `handler(accountStore, session, account, env)`.
 * The handler should return the updated account record; the wrapper decorates
 * it and returns a no-store JSON response.
 */
async function withAuthenticatedAccount(request, env, handler) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const accountStore = getAccountStore(request, env);
  const ensuredAccount = await ensureAccountForSession(accountStore, session);
  const datasetScope = getAccountDatasetScopeFromRequest(request);
  const scopedAccount =
    await readScopedAccountRecord(accountStore, ensuredAccount.accountId, session.user, datasetScope) ??
    ensuredAccount;
  const account = await handler(accountStore, session, scopedAccount, env, datasetScope);
  const decoratedAccount = await buildScopedDecoratedAccount(accountStore, account, env, datasetScope);
  return noStoreJson({ account: decoratedAccount });
}

/**
 * Like `withAuthenticatedAccount` but also parses the JSON body before
 * delegating.  Handler receives `(accountStore, session, account, payload, env)`.
 */
async function withAuthenticatedAccountJson(request, env, handler) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  const accountStore = getAccountStore(request, env);
  const ensuredAccount = await ensureAccountForSession(accountStore, session);
  const datasetScope = getAccountDatasetScopeFromRequest(request, payload);
  const scopedAccount =
    await readScopedAccountRecord(accountStore, ensuredAccount.accountId, session.user, datasetScope) ??
    ensuredAccount;
  const account = await handler(accountStore, session, scopedAccount, payload, env, datasetScope);
  const decoratedAccount = await buildScopedDecoratedAccount(accountStore, account, env, datasetScope);
  return noStoreJson({ account: decoratedAccount });
}

export async function handleAccountRequest(request, env) {
  return withAuthenticatedAccount(request, env, (_accountStore, _session, account) => account);
}

export async function handleAccountUpdateRequest(request, env) {
  return withAuthenticatedAccountJson(request, env, async (accountStore, session, _account, payload, _env, datasetScope) => {
    return saveAccountState(accountStore, session.accountId, payload, session.user, { datasetScope });
  });
}

export async function handleAccountSharedBlueprintsUpdateRequest(request, env) {
  return withAuthenticatedAccountJson(request, env, async (accountStore, session, _account, payload, _env, datasetScope) => {
    return saveAccountOrganizationBlueprintShares(
      accountStore,
      session.accountId,
      payload?.organizationBlueprintShares,
      session.user,
      { datasetScope },
    );
  });
}

export async function handleAccountResourcesUpdateRequest(request, env) {
  return withAuthenticatedAccountJson(request, env, async (accountStore, session, _account, payload, _env, datasetScope) => {
    return saveAccountInventoryResources(
      accountStore,
      session.accountId,
      payload?.inventoryResources,
      session.user,
      { datasetScope },
    );
  });
}

export async function handleAccountSharedResourcesUpdateRequest(request, env) {
  return withAuthenticatedAccountJson(request, env, async (accountStore, session, _account, payload, _env, datasetScope) => {
    return saveAccountOrganizationResourceShares(
      accountStore,
      session.accountId,
      payload?.organizationResourceShares,
      session.user,
      { datasetScope },
    );
  });
}

export async function handleAccountCopyLiveToPtuRequest(request, env) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    await ensureAccountForSession(accountStore, session);
    const account = await copyLiveAccountScopeToPtu(accountStore, session.accountId, session.user);
    const decoratedAccount = await buildScopedDecoratedAccount(accountStore, account, env, 'ptu');
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return errorResponse(
      400,
      error instanceof Error ? error.message : 'Failed to copy LIVE account data to PTU.',
    );
  }
}

export async function handleDeleteAccountRequest(request, env) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const accountStore = getAccountStore(request, env);
  await deleteAccountRecord(accountStore, session.accountId, session.user);

  const headers = new Headers({
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', buildExpiredCookie(getSessionCookieName(), request, env));
  headers.append('Set-Cookie', buildExpiredCookie(getOauthStateCookieName(), request, env));

  return jsonResponse(
    { ok: true },
    {
      headers,
    },
  );
}

export async function handleRsiLinkRequest(request, env) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const apiKey = getStarCitizenApiKey(env);
  if (!apiKey) {
    return errorResponse(503, 'Star Citizen API is not configured.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  const handle = String(payload?.handle ?? '').trim();
  const code = String(payload?.code ?? '').trim().toUpperCase();
  if (!handle) {
    return errorResponse(400, 'RSI handle is required.');
  }
  if (!code) {
    return errorResponse(400, 'Verification code is required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const existingAccount = await ensureAccountForSession(accountStore, session);
    if (isRsiLinkRateLimited(existingAccount)) {
      const nextAllowedAt = getNextAllowedRsiLinkAt(existingAccount);
      return errorResponse(
        429,
        nextAllowedAt
          ? `You can link an RSI account only once every 5 days. Try again after ${nextAllowedAt}.`
          : 'You can link an RSI account only once every 5 days.',
      );
    }

    const verifiedLink = await verifyRsiHandleOwnership(apiKey, handle, code);
    const account = await saveRsiAccountLink(accountStore, session.accountId, verifiedLink, session.user);
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      account,
      env,
      getAccountDatasetScopeFromRequest(request, payload),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return errorResponse(
      400,
      error instanceof Error ? error.message : 'Failed to verify the RSI account.',
    );
  }
}

export async function handleRsiUnlinkRequest(request, env) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    await ensureAccountForSession(accountStore, session);
    const account = await clearRsiAccountLink(accountStore, session.accountId, session.user);
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      account,
      env,
      getAccountDatasetScopeFromRequest(request),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return errorResponse(
      400,
      error instanceof Error ? error.message : 'Failed to remove the RSI account link.',
    );
  }
}

export async function handleAccountOrganizationsCreateRequest(request, env) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const apiKey = getStarCitizenApiKey(env);
  if (!apiKey) {
    return errorResponse(503, 'Star Citizen API is not configured.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const nextAccount = await addAccountOrganizationBySid(
      accountStore,
      account,
      apiKey,
      payload?.sid,
    );
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      nextAccount,
      env,
      getAccountDatasetScopeFromRequest(request, payload),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to add the organization.');
  }
}

export async function handleAccountOrganizationDeleteRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const nextAccount = await removeAccountOrganizationBySid(accountStore, account, sid);
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      nextAccount,
      env,
      getAccountDatasetScopeFromRequest(request),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to remove the organization.');
  }
}

export async function handleOrganizationDeleteRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const nextAccount = await deleteOwnedOrganizationFromApp(accountStore, account, sid);
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      nextAccount,
      env,
      getAccountDatasetScopeFromRequest(request),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to delete the organization.');
  }
}

export async function handleOrganizationSharingUpdateRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const nextAccount = await setOwnedOrganizationBlueprintSharingEnabled(
      accountStore,
      account,
      sid,
      payload?.enabled,
    );
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      nextAccount,
      env,
      getAccountDatasetScopeFromRequest(request, payload),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to update organization blueprint sharing.');
  }
}

export async function handleOrganizationClaimRequest(request, env, sid, executionContext = null) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const reviewerEmail = getOrganizationClaimReviewerEmail(env);
    const nextAccount = await claimAccountOrganization(accountStore, account, sid, {
      reviewerEmail,
    });
    const claimRequest = nextAccount.organizations.find((organization) => organization.sid === String(sid).trim().toUpperCase());
    if (claimRequest?.claimRequestStatus === 'pending' && reviewerEmail) {
      runBackgroundTask(
        executionContext,
        () =>
          notifyOrganizationClaimRequest(env, {
            sid: claimRequest.sid,
            organizationName: claimRequest.name,
            accountId: nextAccount.accountId,
            requestedByDiscordDisplayName: nextAccount.profile.displayName,
            requestedByDiscordUsername: nextAccount.profile.username,
            requestedByRsiHandle: nextAccount.rsi?.handle ?? null,
            reviewerEmail,
            submittedAt: claimRequest.claimRequestSubmittedAt,
          }),
        'organization-claim-review-notify',
      );
    }
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      nextAccount,
      env,
      getAccountDatasetScopeFromRequest(request),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to submit the organization claim request.');
  }
}

export async function handleOrganizationRefreshRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const apiKey = getStarCitizenApiKey(env);
  if (!apiKey) {
    return errorResponse(503, 'Star Citizen API is not configured.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const nextAccount = await refreshAccountOrganizationMembers(accountStore, account, apiKey, sid);
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      nextAccount,
      env,
      getAccountDatasetScopeFromRequest(request),
    );
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to refresh organization members.');
  }
}

export async function handleOrganizationSharedBlueprintsRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const datasetScope = getAccountDatasetScopeFromRequest(request);
    const decoratedAccount = await buildScopedDecoratedAccount(accountStore, account, env, datasetScope);
    const payload = await buildOrganizationSharedBlueprints(accountStore, decoratedAccount, sid, { datasetScope });
    return noStoreJson(payload);
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to load shared organization blueprints.');
  }
}

export async function handleOrganizationSharedResourcesRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const datasetScope = getAccountDatasetScopeFromRequest(request);
    const decoratedAccount = await buildScopedDecoratedAccount(accountStore, account, env, datasetScope);
    const payload = await buildOrganizationSharedResources(accountStore, decoratedAccount, sid, { datasetScope });
    return noStoreJson(payload);
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to load shared organization resources.');
  }
}

export async function handleOrganizationCraftRequestCreateRequest(request, env, sid, executionContext = null) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const datasetScope = getAccountDatasetScopeFromRequest(request, payload);
    const ensuredAccount = await ensureAccountForSession(accountStore, session);
    const account =
      await readScopedAccountRecord(accountStore, ensuredAccount.accountId, session.user, datasetScope) ??
      ensuredAccount;
    const result = await createOrganizationCraftRequest(accountStore, account, {
      organizationSid: sid,
      blueprintId: payload?.blueprintId,
      blueprintName: payload?.blueprintName,
      ownerHandle: payload?.ownerHandle,
      comment: payload?.comment,
      resourcesOption: payload?.resourcesOption,
      appBaseUrl: resolveAppBaseUrlFromRequest(request, env),
      storageScope: resolveCraftRequestStorageScope(request, env),
      datasetScope,
    });
    runBackgroundTask(
      executionContext,
      () =>
        notifyCraftRequestOwnerViaWorker(
          env,
          result.request,
          result.ownerAccount,
          result.requesterAccount,
        ),
      'craft-request-owner-notify',
    );
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      result.account,
      env,
      datasetScope,
    );
    return noStoreJson({
      account: decoratedAccount,
      request: result.request,
    });
  } catch (error) {
    return craftRequestErrorResponse(error, 'Failed to create the craft request.');
  }
}

export async function handleCraftRequestDecisionRequest(request, env, requestId, executionContext = null) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const datasetScope = getAccountDatasetScopeFromRequest(request, payload);
    const ensuredAccount = await ensureAccountForSession(accountStore, session);
    const account =
      await readScopedAccountRecord(accountStore, ensuredAccount.accountId, session.user, datasetScope) ??
      ensuredAccount;

    if (payload?.decision === 'deleted') {
      const result = await deleteCraftRequest(accountStore, account, requestId, { datasetScope });
      runBackgroundTask(
        executionContext,
        () => syncCraftRequestStatusBestEffort(
          env,
          { ...result.request, status: 'deleted' },
          result.ownerAccount,
          result.requesterAccount,
          'craft-request-delete-sync',
        ),
        'craft-request-delete-sync',
      );
      const decoratedAccount = await buildScopedDecoratedAccount(
        accountStore,
        result.account,
        env,
        datasetScope,
      );
      return noStoreJson({
        account: decoratedAccount,
        requestId,
        status: 'deleted',
      });
    }

    const result = await respondToCraftRequest(
      accountStore,
      account,
      requestId,
      payload?.decision,
      { datasetScope },
    );
    await syncCraftRequestStatusBestEffort(
      env,
      result.request,
      result.ownerAccount,
      result.requesterAccount,
      'craft-request-status-sync',
    );
    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      result.account,
      env,
      datasetScope,
    );
    return noStoreJson({
      account: decoratedAccount,
      requestId: result.requestId,
      status: result.status,
    });
  } catch (error) {
    return craftRequestErrorResponse(error, 'Failed to answer the craft request.');
  }
}

export async function handleCraftRequestBulkDecisionRequest(request, env, executionContext = null) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  let payload;
  try {
    payload = await readAccountJsonFromRequest(request);
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Invalid JSON body.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const datasetScope = getAccountDatasetScopeFromRequest(request, payload);
    const ensuredAccount = await ensureAccountForSession(accountStore, session);
    const account =
      await readScopedAccountRecord(accountStore, ensuredAccount.accountId, session.user, datasetScope) ??
      ensuredAccount;
    const result = await respondToCraftRequestsBulk(
      accountStore,
      account,
      payload?.actions,
      { datasetScope },
    );

    await Promise.all(
      result.results.map(async (entry) => {
        if (!entry.ok || !entry.request || !entry.ownerAccount || !entry.requesterAccount) {
          return;
        }

        await syncCraftRequestStatusBestEffort(
          env,
          entry.request,
          entry.ownerAccount,
          entry.requesterAccount,
          'craft-request-bulk-status-sync',
        );
      }),
    );

    const decoratedAccount = await buildScopedDecoratedAccount(
      accountStore,
      result.account,
      env,
      datasetScope,
    );
    return noStoreJson({
      account: decoratedAccount,
      results: result.results.map((entry) => ({
        requestId: entry.requestId,
        ok: entry.ok,
        status: entry.status ?? null,
        error: entry.error ?? null,
        errorStatus: entry.errorStatus ?? null,
      })),
    });
  } catch (error) {
    return craftRequestErrorResponse(error, 'Failed to answer the craft requests.');
  }
}
