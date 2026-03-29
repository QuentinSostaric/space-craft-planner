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
  isDiscordAuthConfigured,
  readOauthStateFromCookies,
  readSessionFromCookies,
  sanitizeReturnTo,
} from '../../shared/discordAuth.mjs';
import {
  clearRsiAccountLink,
  createBucketAccountStore,
  deleteAccountRecord,
  getNextAllowedRsiLinkAt,
  isRsiLinkRateLimited,
  readAccountRecord,
  saveAccountOrganizationBlueprintShares,
  saveAccountState,
  saveRsiAccountLink,
  upsertDiscordAccount,
} from '../../shared/accountStorage.mjs';
import {
  addAccountOrganizationBySid,
  buildOrganizationSharedBlueprints,
  claimAccountOrganization,
  OrganizationServiceError,
  refreshAccountOrganizationMembers,
  removeAccountOrganizationBySid,
  syncAndDecorateAccountOrganizations,
} from '../../shared/organizationService.mjs';
import { notifyOrganizationClaimRequest } from '../../shared/organizationClaimNotification.mjs';
import {
  createOrganizationCraftRequest,
  CraftRequestServiceError,
  respondToCraftRequest,
} from '../../shared/craftRequestService.mjs';
import {
  notifyCraftRequestOwnerViaWorker,
  resolveAppBaseUrlFromRequest,
  resolveCraftRequestStorageScope,
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

function getStarCitizenApiKey(env) {
  return String(env?.STARCITIZEN_API_KEY ?? '').trim();
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
  return noStoreJson(buildAuthSessionPayload(env, session));
}

export async function handleDiscordLoginRequest(request, env) {
  if (!isDiscordAuthConfigured(env)) {
    return errorResponse(503, 'Discord auth is not configured.');
  }

  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get('returnTo'));
  const { state, cookie } = await createOauthStateCookie(request, env, returnTo);
  const authorizationUrl = buildDiscordAuthorizationUrl(request, env, state);

  return redirectResponse(authorizationUrl, {
    cookies: [cookie],
  });
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
    const sessionCookie = await createSessionCookie(request, env, user, account.accountId);

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

export async function handleAccountRequest(request, env) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  const accountStore = getAccountStore(request, env);
  const account = await ensureAccountForSession(accountStore, session);
  const decoratedAccount = await buildDecoratedAccount(accountStore, account, env);
  return noStoreJson({ account: decoratedAccount });
}

export async function handleAccountUpdateRequest(request, env) {
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
  await ensureAccountForSession(accountStore, session);
  const account = await saveAccountState(accountStore, session.accountId, payload, session.user);
  const decoratedAccount = await buildDecoratedAccount(accountStore, account, env);
  return noStoreJson({ account: decoratedAccount });
}

export async function handleAccountSharedBlueprintsUpdateRequest(request, env) {
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
  await ensureAccountForSession(accountStore, session);
  const account = await saveAccountOrganizationBlueprintShares(
    accountStore,
    session.accountId,
    payload?.organizationBlueprintShares,
    session.user,
  );
  const decoratedAccount = await buildDecoratedAccount(accountStore, account, env);
  return noStoreJson({ account: decoratedAccount });
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
    const decoratedAccount = await buildDecoratedAccount(accountStore, account, env);
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
    const decoratedAccount = await buildDecoratedAccount(accountStore, account, env);
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
    return noStoreJson({ account: nextAccount });
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
    const decoratedAccount = await buildDecoratedAccount(accountStore, nextAccount, env);
    return noStoreJson({ account: decoratedAccount });
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to remove the organization.');
  }
}

export async function handleOrganizationClaimRequest(request, env, sid) {
  const session = await requireAuthenticatedSession(request, env);
  if (!session) {
    return errorResponse(401, 'Authentication required.');
  }

  try {
    const accountStore = getAccountStore(request, env);
    const account = await ensureAccountForSession(accountStore, session);
    const nextAccount = await claimAccountOrganization(accountStore, account, sid);
    const claimRequest = nextAccount.organizations.find((organization) => organization.sid === String(sid).trim().toUpperCase());
    if (claimRequest?.claimRequestStatus === 'pending') {
      void notifyOrganizationClaimRequest(env, {
        sid: claimRequest.sid,
        organizationName: claimRequest.name,
        accountId: nextAccount.accountId,
        requestedByDiscordDisplayName: nextAccount.profile.displayName,
        requestedByDiscordUsername: nextAccount.profile.username,
        requestedByRsiHandle: nextAccount.rsi?.handle ?? null,
        reviewerEmail: 'thsamon@proton.me',
        submittedAt: claimRequest.claimRequestSubmittedAt,
      });
    }
    return noStoreJson({ account: nextAccount });
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
    return noStoreJson({ account: nextAccount });
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
    const decoratedAccount = await buildDecoratedAccount(accountStore, account, env);
    const payload = await buildOrganizationSharedBlueprints(accountStore, decoratedAccount, sid);
    return noStoreJson(payload);
  } catch (error) {
    return organizationErrorResponse(error, 'Failed to load shared organization blueprints.');
  }
}

export async function handleOrganizationCraftRequestCreateRequest(request, env, sid) {
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
    const result = await createOrganizationCraftRequest(accountStore, account, {
      organizationSid: sid,
      blueprintId: payload?.blueprintId,
      blueprintName: payload?.blueprintName,
      ownerHandle: payload?.ownerHandle,
      appBaseUrl: resolveAppBaseUrlFromRequest(request, env),
      storageScope: resolveCraftRequestStorageScope(request, env),
    });
    void notifyCraftRequestOwnerViaWorker(
      env,
      result.request,
      result.ownerAccount,
      result.requesterAccount,
    ).catch(() => {});
    const decoratedAccount = await buildDecoratedAccount(accountStore, result.account, env);
    return noStoreJson({
      account: decoratedAccount,
      request: result.request,
    });
  } catch (error) {
    return craftRequestErrorResponse(error, 'Failed to create the craft request.');
  }
}

export async function handleCraftRequestDecisionRequest(request, env, requestId) {
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
    const result = await respondToCraftRequest(
      accountStore,
      account,
      requestId,
      payload?.decision,
    );
    const decoratedAccount = await buildDecoratedAccount(accountStore, result.account, env);
    return noStoreJson({
      account: decoratedAccount,
      requestId: result.requestId,
      status: result.status,
    });
  } catch (error) {
    return craftRequestErrorResponse(error, 'Failed to answer the craft request.');
  }
}
