import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
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
  appendQueryParam,
} from '../shared/discordAuth.mjs';
import {
  createR2Client,
  getJsonObject,
  getR2Config,
} from '../shared/r2Storage.mjs';
import {
  clearRsiAccountLink,
  createS3AccountStore,
  deleteAccountRecord,
  getNextAllowedRsiLinkAt,
  isRsiLinkRateLimited,
  readAccountRecord,
  saveAccountOrganizationBlueprintShares,
  saveAccountState,
  saveRsiAccountLink,
  upsertDiscordAccount,
} from '../shared/accountStorage.mjs';
import {
  addAccountOrganizationBySid,
  buildOrganizationSharedBlueprints,
  claimAccountOrganization,
  deleteOwnedOrganizationFromApp,
  OrganizationServiceError,
  refreshAccountOrganizationMembers,
  removeAccountOrganizationBySid,
  setOwnedOrganizationBlueprintSharingEnabled,
  syncAndDecorateAccountOrganizations,
} from '../shared/organizationService.mjs';
import { notifyOrganizationClaimRequest } from '../shared/organizationClaimNotification.mjs';
import {
  createOrganizationCraftRequest,
  CraftRequestServiceError,
  respondToCraftRequest,
  respondToCraftRequestsBulk,
} from '../shared/craftRequestService.mjs';
import {
  notifyCraftRequestOwnerViaWorker,
  resolveAppBaseUrlFromRequest,
  resolveCraftRequestStorageScope,
  syncCraftRequestStatusViaWorker,
} from '../shared/discordBotRelay.mjs';
import { verifyRsiHandleOwnership } from '../shared/rsiLink.mjs';

const PORT = 8788;
const DEV_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const MAX_JSON_BODY_BYTES = 1024 * 1024;

function loadDevVars() {
  const envPath = resolve('.dev.vars');
  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getAllowedOrigin(request) {
  const origin = String(request?.headers?.origin ?? '').trim();
  return DEV_ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function applyCorsHeaders(response, request) {
  const allowedOrigin = getAllowedOrigin(request);
  if (!allowedOrigin) {
    return;
  }

  response.setHeader('access-control-allow-origin', allowedOrigin);
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('vary', 'origin');
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message, headers = {}) {
  sendJson(response, status, { message }, headers);
}

function sendRedirect(response, location, headers = {}) {
  response.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end();
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += Buffer.byteLength(chunk);
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new Error('Request body too large.');
    }
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

loadDevVars();

const r2Config = getR2Config(process.env);
const client = createR2Client(process.env);
const accountStore = createS3AccountStore(client, r2Config.bucketName);

function getStarCitizenApiKey() {
  return String(process.env.STARCITIZEN_API_KEY ?? '').trim();
}

function getOrganizationClaimReviewerEmail() {
  const reviewerEmail = String(process.env.ORGANIZATION_CLAIM_REVIEWER_EMAIL ?? '').trim();
  return reviewerEmail || null;
}

function logBackgroundTaskError(label, error) {
  console.error(`[${label}]`, error);
}

async function buildDecoratedAccount(account) {
  try {
    return await syncAndDecorateAccountOrganizations(
      accountStore,
      account,
      getStarCitizenApiKey(),
    );
  } catch {
    return account;
  }
}

function sendOrganizationError(response, error, fallbackMessage) {
  const status = error instanceof OrganizationServiceError ? error.status : 400;
  const message = error instanceof Error ? error.message : fallbackMessage;
  sendError(response, status, message, {
    'Cache-Control': 'no-store',
  });
}

function sendCraftRequestError(response, error, fallbackMessage) {
  const status = error instanceof CraftRequestServiceError ? error.status : 400;
  const message = error instanceof Error ? error.message : fallbackMessage;
  sendError(response, status, message, {
    'Cache-Control': 'no-store',
  });
}

async function readJson(key) {
  return getJsonObject(client, r2Config.bucketName, key);
}

async function listDatasets(response) {
  const index = await readJson('indexes/all.json');
  sendJson(
    response,
    200,
    index ?? {
      datasets: [],
      defaultChannel: null,
      latestByChannel: { live: null, ptu: null },
    },
  );
}

async function getDatasetByChannel(response, channel) {
  const dataset = await readJson(`aliases/all/${channel}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No published dataset for channel "${channel}".`);
    return;
  }

  sendJson(response, 200, { dataset });
}

async function getDatasetById(response, datasetId) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No published dataset for id "${datasetId}".`);
    return;
  }

  sendJson(response, 200, { dataset });
}

async function getChunkById(response, datasetId, chunkName, payloadBuilder) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for id "${datasetId}".`);
    return;
  }

  const chunk = await readJson(`datasets/${datasetId}/${chunkName}.json`);
  sendJson(response, 200, payloadBuilder(chunk));
}

async function getBlueprintDetail(response, datasetId, blueprintId) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for id "${datasetId}".`);
    return;
  }

  const blueprint = await readJson(
    `datasets/${datasetId}/blueprints/${encodeURIComponent(blueprintId)}.json`,
  );
  if (!blueprint) {
    sendError(response, 404, `No blueprint "${blueprintId}" for dataset "${datasetId}".`);
    return;
  }

  sendJson(response, 200, {
    datasetId,
    blueprint,
  });
}

async function getFactionContractsById(response, datasetId, factionId) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for id "${datasetId}".`);
    return;
  }

  const chunk = await readJson(
    `datasets/${datasetId}/mission-rewards/factions/${encodeURIComponent(factionId)}.json`,
  );
  if (!chunk) {
    sendError(response, 404, `No faction contracts for "${factionId}" in dataset "${datasetId}".`);
    return;
  }

  sendJson(response, 200, chunk);
}

async function getFactionContractsByChannel(response, channel, factionId) {
  const dataset = await readJson(`aliases/all/${channel}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for channel "${channel}".`);
    return;
  }

  const chunk = await readJson(
    `aliases/all/${channel}/mission-rewards/factions/${encodeURIComponent(factionId)}.json`,
  );
  if (!chunk) {
    sendError(response, 404, `No faction contracts for "${factionId}" in channel "${channel}".`);
    return;
  }

  sendJson(response, 200, chunk);
}

async function handleAuthSession(request, response) {
  const session = await readSessionFromCookies(request.headers.cookie, process.env);
  sendJson(
    response,
    200,
    buildAuthSessionPayload(process.env, session),
    {
      'Cache-Control': 'no-store',
    },
  );
}

async function requireAuthenticatedSession(request) {
  const session = await readSessionFromCookies(request.headers.cookie, process.env);
  if (!session?.user?.id || !session.accountId) {
    return null;
  }

  return session;
}

async function ensureAccountForSession(session) {
  const existingAccount = await readAccountRecord(accountStore, session.accountId, session.user);
  if (existingAccount) {
    return existingAccount;
  }

  return upsertDiscordAccount(accountStore, session.user);
}

async function handleDiscordLogin(request, response, url) {
  if (!isDiscordAuthConfigured(process.env)) {
    sendError(response, 503, 'Discord auth is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const { state, cookie } = await createOauthStateCookie(url.toString(), process.env, returnTo);
  const authorizationUrl = buildDiscordAuthorizationUrl(url.toString(), process.env, state);

  sendRedirect(response, authorizationUrl, {
    'Set-Cookie': cookie,
  });
}

async function handleDiscordCallback(request, response, url) {
  if (!isDiscordAuthConfigured(process.env)) {
    sendError(response, 503, 'Discord auth is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthState = await readOauthStateFromCookies(request.headers.cookie, process.env);
  const returnTo = oauthState?.returnTo ?? '/';
  const expiredStateCookie = buildExpiredCookie(getOauthStateCookieName(), url.toString(), process.env);
  const expiredSessionCookie = buildExpiredCookie(getSessionCookieName(), url.toString(), process.env);

  if (!code || !state || !oauthState || oauthState.nonce !== state) {
    sendRedirect(response, appendQueryParam(returnTo, 'auth_error', 'state_mismatch'), {
      'Set-Cookie': [expiredStateCookie, expiredSessionCookie],
    });
    return;
  }

  try {
    const tokenPayload = await exchangeDiscordCode(url.toString(), process.env, code);
    const user = await fetchDiscordUserProfile(tokenPayload.access_token);
    const account = await upsertDiscordAccount(accountStore, user);
    const sessionCookie = await createSessionCookie(
      url.toString(),
      process.env,
      user,
      account.accountId,
    );

    sendRedirect(response, returnTo, {
      'Set-Cookie': [sessionCookie, expiredStateCookie],
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'discord_oauth_failed';
    sendRedirect(response, appendQueryParam(returnTo, 'auth_error', message), {
      'Set-Cookie': [expiredStateCookie, expiredSessionCookie],
    });
  }
}

function handleLogout(url, response) {
  sendJson(
    response,
    200,
    { ok: true },
    {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        buildExpiredCookie(getSessionCookieName(), url.toString(), process.env),
        buildExpiredCookie(getOauthStateCookieName(), url.toString(), process.env),
      ],
    },
  );
}

async function handleAccount(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const account = await ensureAccountForSession(session);
  const decoratedAccount = await buildDecoratedAccount(account);
  sendJson(
    response,
    200,
    { account: decoratedAccount },
    {
      'Cache-Control': 'no-store',
    },
  );
}

async function handleAccountUpdate(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  await ensureAccountForSession(session);
  const account = await saveAccountState(accountStore, session.accountId, payload, session.user);
  const decoratedAccount = await buildDecoratedAccount(account);
  sendJson(
    response,
    200,
    { account: decoratedAccount },
    {
      'Cache-Control': 'no-store',
    },
  );
}

async function handleAccountSharedBlueprintsUpdate(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  await ensureAccountForSession(session);
  const account = await saveAccountOrganizationBlueprintShares(
    accountStore,
    session.accountId,
    payload?.organizationBlueprintShares,
    session.user,
  );
  const decoratedAccount = await buildDecoratedAccount(account);
  sendJson(
    response,
    200,
    { account: decoratedAccount },
    {
      'Cache-Control': 'no-store',
    },
  );
}

async function handleRsiLink(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const apiKey = String(process.env.STARCITIZEN_API_KEY ?? '').trim();
  if (!apiKey) {
    sendError(response, 503, 'Star Citizen API is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  const handle = String(payload?.handle ?? '').trim();
  const code = String(payload?.code ?? '').trim().toUpperCase();
  if (!handle) {
    sendError(response, 400, 'RSI handle is required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }
  if (!code) {
    sendError(response, 400, 'Verification code is required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    const existingAccount = await ensureAccountForSession(session);
    if (isRsiLinkRateLimited(existingAccount)) {
      const nextAllowedAt = getNextAllowedRsiLinkAt(existingAccount);
      sendError(
        response,
        429,
        nextAllowedAt
          ? `You can link an RSI account only once every 5 days. Try again after ${nextAllowedAt}.`
          : 'You can link an RSI account only once every 5 days.',
        {
          'Cache-Control': 'no-store',
        },
      );
      return;
    }

    const verifiedLink = await verifyRsiHandleOwnership(apiKey, handle, code);
    const account = await saveRsiAccountLink(accountStore, session.accountId, verifiedLink, session.user);
    const decoratedAccount = await buildDecoratedAccount(account);
    sendJson(
      response,
      200,
      { account: decoratedAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Failed to verify the RSI account.',
      {
        'Cache-Control': 'no-store',
      },
    );
  }
}

async function handleRsiUnlink(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    await ensureAccountForSession(session);
    const account = await clearRsiAccountLink(accountStore, session.accountId, session.user);
    const decoratedAccount = await buildDecoratedAccount(account);
    sendJson(
      response,
      200,
      { account: decoratedAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Failed to remove the RSI account link.',
      {
        'Cache-Control': 'no-store',
      },
    );
  }
}

async function handleAccountOrganizationsCreate(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const apiKey = getStarCitizenApiKey();
  if (!apiKey) {
    sendError(response, 503, 'Star Citizen API is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const nextAccount = await addAccountOrganizationBySid(
      accountStore,
      account,
      apiKey,
      payload?.sid,
    );
    sendJson(
      response,
      200,
      { account: nextAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to add the organization.');
  }
}

async function handleAccountOrganizationDelete(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const nextAccount = await removeAccountOrganizationBySid(accountStore, account, sid);
    const decoratedAccount = await buildDecoratedAccount(nextAccount);
    sendJson(
      response,
      200,
      { account: decoratedAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to remove the organization.');
  }
}

async function handleOrganizationDelete(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const nextAccount = await deleteOwnedOrganizationFromApp(accountStore, account, sid);
    sendJson(
      response,
      200,
      { account: nextAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to delete the organization.');
  }
}

async function handleOrganizationSharingUpdate(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const nextAccount = await setOwnedOrganizationBlueprintSharingEnabled(
      accountStore,
      account,
      sid,
      payload?.enabled,
    );
    sendJson(
      response,
      200,
      { account: nextAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to update organization blueprint sharing.');
  }
}

async function handleOrganizationClaim(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const reviewerEmail = getOrganizationClaimReviewerEmail();
    const nextAccount = await claimAccountOrganization(accountStore, account, sid, {
      reviewerEmail,
    });
    const claimRequest = nextAccount.organizations.find((organization) => organization.sid === String(sid).trim().toUpperCase());
    const notificationPromise =
      claimRequest?.claimRequestStatus === 'pending' && reviewerEmail
        ? notifyOrganizationClaimRequest(process.env, {
            sid: claimRequest.sid,
            organizationName: claimRequest.name,
            accountId: nextAccount.accountId,
            requestedByDiscordDisplayName: nextAccount.profile.displayName,
            requestedByDiscordUsername: nextAccount.profile.username,
            requestedByRsiHandle: nextAccount.rsi?.handle ?? null,
            reviewerEmail,
            submittedAt: claimRequest.claimRequestSubmittedAt,
          }).catch((error) => logBackgroundTaskError('organization-claim-review-notify', error))
        : null;
    sendJson(
      response,
      200,
      { account: nextAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
    await notificationPromise;
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to submit the organization claim request.');
  }
}

async function handleOrganizationRefresh(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const apiKey = getStarCitizenApiKey();
  if (!apiKey) {
    sendError(response, 503, 'Star Citizen API is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const nextAccount = await refreshAccountOrganizationMembers(accountStore, account, apiKey, sid);
    sendJson(
      response,
      200,
      { account: nextAccount },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to refresh organization members.');
  }
}

async function handleOrganizationSharedBlueprints(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const decoratedAccount = await buildDecoratedAccount(account);
    const payload = await buildOrganizationSharedBlueprints(accountStore, decoratedAccount, sid);
    sendJson(
      response,
      200,
      payload,
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    sendOrganizationError(response, error, 'Failed to load shared organization blueprints.');
  }
}

async function handleOrganizationCraftRequestCreate(request, response, sid) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const result = await createOrganizationCraftRequest(accountStore, account, {
      organizationSid: sid,
      blueprintId: payload?.blueprintId,
      blueprintName: payload?.blueprintName,
      ownerHandle: payload?.ownerHandle,
      comment: payload?.comment,
      resourcesOption: payload?.resourcesOption,
      appBaseUrl: resolveAppBaseUrlFromRequest(request, process.env),
      storageScope: resolveCraftRequestStorageScope(request, process.env),
    });
    const notificationPromise = notifyCraftRequestOwnerViaWorker(
      process.env,
      result.request,
      result.ownerAccount,
      result.requesterAccount,
    ).catch((error) => logBackgroundTaskError('craft-request-owner-notify', error));
    const decoratedAccount = await buildDecoratedAccount(result.account);
    sendJson(
      response,
      200,
      {
        account: decoratedAccount,
        request: result.request,
      },
      {
        'Cache-Control': 'no-store',
      },
    );
    await notificationPromise;
  } catch (error) {
    sendCraftRequestError(response, error, 'Failed to create the craft request.');
  }
}

async function handleCraftRequestDecision(request, response, requestId) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const result = await respondToCraftRequest(
      accountStore,
      account,
      requestId,
      payload?.decision,
    );
    const notificationPromise = syncCraftRequestStatusViaWorker(
      process.env,
      result.request,
      result.ownerAccount,
      result.requesterAccount,
    ).catch((error) => logBackgroundTaskError('craft-request-status-sync', error));
    const decoratedAccount = await buildDecoratedAccount(result.account);
    sendJson(
      response,
      200,
      {
        account: decoratedAccount,
        requestId: result.requestId,
        status: result.status,
      },
      {
        'Cache-Control': 'no-store',
      },
    );
    await notificationPromise;
  } catch (error) {
    sendCraftRequestError(response, error, 'Failed to answer the craft request.');
  }
}

async function handleCraftRequestBulkDecision(request, response) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : 'Invalid JSON body.',
      {
        'Cache-Control': 'no-store',
      },
    );
    return;
  }

  try {
    const account = await ensureAccountForSession(session);
    const result = await respondToCraftRequestsBulk(
      accountStore,
      account,
      payload?.actions,
    );

    const notificationPromises = result.results
      .filter((entry) => entry.ok && entry.request && entry.ownerAccount && entry.requesterAccount)
      .map((entry) =>
        syncCraftRequestStatusViaWorker(
          process.env,
          entry.request,
          entry.ownerAccount,
          entry.requesterAccount,
        ).catch((error) => logBackgroundTaskError('craft-request-bulk-status-sync', error)),
      );

    const decoratedAccount = await buildDecoratedAccount(result.account);
    sendJson(
      response,
      200,
      {
        account: decoratedAccount,
        results: result.results.map((entry) => ({
          requestId: entry.requestId,
          ok: entry.ok,
          status: entry.status ?? null,
          error: entry.error ?? null,
          errorStatus: entry.errorStatus ?? null,
        })),
      },
      {
        'Cache-Control': 'no-store',
      },
    );
    await Promise.all(notificationPromises);
  } catch (error) {
    sendCraftRequestError(response, error, 'Failed to answer the craft requests.');
  }
}

async function handleDeleteAccount(request, response, url) {
  const session = await requireAuthenticatedSession(request);
  if (!session) {
    sendError(response, 401, 'Authentication required.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  await deleteAccountRecord(accountStore, session.accountId);
  sendJson(
    response,
    200,
    { ok: true },
    {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        buildExpiredCookie(getSessionCookieName(), url.toString(), process.env),
        buildExpiredCookie(getOauthStateCookieName(), url.toString(), process.env),
      ],
    },
  );
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendError(response, 400, 'Missing request URL.');
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? '127.0.0.1'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    applyCorsHeaders(response, request);

    if (request.method === 'OPTIONS') {
      const allowedOrigin = getAllowedOrigin(request);
      response.writeHead(204, {
        ...(allowedOrigin
          ? {
              'access-control-allow-origin': allowedOrigin,
              'access-control-allow-credentials': 'true',
              vary: 'origin',
            }
          : {}),
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/session') {
      await handleAuthSession(request, response);
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/discord/login') {
      await handleDiscordLogin(request, response, url);
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/discord/callback') {
      await handleDiscordCallback(request, response, url);
      return;
    }

    if (request.method === 'POST' && path === '/api/auth/logout') {
      handleLogout(url, response);
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/account') {
      await handleAccount(request, response);
      return;
    }

    if (request.method === 'PUT' && path === '/api/auth/account') {
      await handleAccountUpdate(request, response);
      return;
    }

    if (request.method === 'PUT' && path === '/api/auth/account/shared-blueprints') {
      await handleAccountSharedBlueprintsUpdate(request, response);
      return;
    }

    if (request.method === 'DELETE' && path === '/api/auth/account') {
      await handleDeleteAccount(request, response, url);
      return;
    }

    if (request.method === 'POST' && path === '/api/auth/account/organizations') {
      await handleAccountOrganizationsCreate(request, response);
      return;
    }

    const accountOrganizationDeleteMatch = path.match(/^\/api\/auth\/account\/organizations\/([^/]+)$/);
    if (request.method === 'DELETE' && accountOrganizationDeleteMatch) {
      await handleAccountOrganizationDelete(
        request,
        response,
        decodeURIComponent(accountOrganizationDeleteMatch[1]),
      );
      return;
    }

    if (request.method === 'POST' && path === '/api/auth/account/rsi-link') {
      await handleRsiLink(request, response);
      return;
    }

    if (request.method === 'DELETE' && path === '/api/auth/account/rsi-link') {
      await handleRsiUnlink(request, response);
      return;
    }

    const organizationClaimMatch = path.match(/^\/api\/auth\/organizations\/([^/]+)\/claim$/);
    if (request.method === 'POST' && organizationClaimMatch) {
      await handleOrganizationClaim(
        request,
        response,
        decodeURIComponent(organizationClaimMatch[1]),
      );
      return;
    }

    const organizationSharingMatch = path.match(/^\/api\/auth\/organizations\/([^/]+)\/sharing$/);
    if (request.method === 'PUT' && organizationSharingMatch) {
      await handleOrganizationSharingUpdate(
        request,
        response,
        decodeURIComponent(organizationSharingMatch[1]),
      );
      return;
    }

    const organizationRefreshMatch = path.match(/^\/api\/auth\/organizations\/([^/]+)\/refresh$/);
    if (request.method === 'POST' && organizationRefreshMatch) {
      await handleOrganizationRefresh(
        request,
        response,
        decodeURIComponent(organizationRefreshMatch[1]),
      );
      return;
    }

    const organizationDeleteMatch = path.match(/^\/api\/auth\/organizations\/([^/]+)$/);
    if (request.method === 'DELETE' && organizationDeleteMatch) {
      await handleOrganizationDelete(
        request,
        response,
        decodeURIComponent(organizationDeleteMatch[1]),
      );
      return;
    }

    const organizationSharedBlueprintsMatch = path.match(
      /^\/api\/auth\/organizations\/([^/]+)\/shared-blueprints$/,
    );
    if (request.method === 'GET' && organizationSharedBlueprintsMatch) {
      await handleOrganizationSharedBlueprints(
        request,
        response,
        decodeURIComponent(organizationSharedBlueprintsMatch[1]),
      );
      return;
    }

    const organizationCraftRequestsMatch = path.match(
      /^\/api\/auth\/organizations\/([^/]+)\/craft-requests$/,
    );
    if (request.method === 'POST' && organizationCraftRequestsMatch) {
      await handleOrganizationCraftRequestCreate(
        request,
        response,
        decodeURIComponent(organizationCraftRequestsMatch[1]),
      );
      return;
    }

    if (request.method === 'POST' && path === '/api/auth/craft-requests/bulk') {
      await handleCraftRequestBulkDecision(request, response);
      return;
    }

    const craftRequestDecisionMatch = path.match(/^\/api\/auth\/craft-requests\/([^/]+)$/);
    if (request.method === 'POST' && craftRequestDecisionMatch) {
      await handleCraftRequestDecision(
        request,
        response,
        decodeURIComponent(craftRequestDecisionMatch[1]),
      );
      return;
    }

    if (request.method !== 'GET') {
      sendError(response, 405, 'Method not allowed.');
      return;
    }

    if (path === '/api/game-data/public') {
      await listDatasets(response);
      return;
    }

    const blueprintDetailMatch = path.match(
      /^\/api\/game-data\/public\/by-id\/([^/]+)\/blueprints\/([^/]+)$/,
    );
    if (blueprintDetailMatch) {
      await getBlueprintDetail(
        response,
        decodeURIComponent(blueprintDetailMatch[1]),
        decodeURIComponent(blueprintDetailMatch[2]),
      );
      return;
    }

    const byIdResourceDataMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/resource-data$/);
    if (byIdResourceDataMatch) {
      const datasetId = decodeURIComponent(byIdResourceDataMatch[1]);
      await getChunkById(response, datasetId, 'resource-data', (chunk) => ({
        datasetId,
        resourceInsights: chunk?.resourceInsights ?? null,
        materialSources: chunk?.materialSources ?? null,
      }));
      return;
    }

    const byIdShipComponentsMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/ship-components$/);
    if (byIdShipComponentsMatch) {
      const datasetId = decodeURIComponent(byIdShipComponentsMatch[1]);
      await getChunkById(response, datasetId, 'ship-components', (chunk) => ({
        datasetId,
        shipComponents: chunk?.shipComponents ?? null,
      }));
      return;
    }

    const byIdMissionRewardsMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/mission-rewards$/);
    if (byIdMissionRewardsMatch) {
      const datasetId = decodeURIComponent(byIdMissionRewardsMatch[1]);
      await getChunkById(response, datasetId, 'mission-rewards', (chunk) => ({
        datasetId,
        missionRewards: chunk?.missionRewards ?? null,
      }));
      return;
    }

    const byIdFactionContractsMatch = path.match(
      /^\/api\/game-data\/public\/by-id\/([^/]+)\/mission-rewards\/factions\/([^/]+)$/,
    );
    if (byIdFactionContractsMatch) {
      await getFactionContractsById(
        response,
        decodeURIComponent(byIdFactionContractsMatch[1]),
        decodeURIComponent(byIdFactionContractsMatch[2]),
      );
      return;
    }

    const byIdChangelogMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/changelog$/);
    if (byIdChangelogMatch) {
      const datasetId = decodeURIComponent(byIdChangelogMatch[1]);
      await getChunkById(response, datasetId, 'changelog', (chunk) => ({
        datasetId,
        changelog: chunk?.changelog ?? null,
      }));
      return;
    }

    const datasetByIdMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)$/);
    if (datasetByIdMatch) {
      await getDatasetById(response, decodeURIComponent(datasetByIdMatch[1]));
      return;
    }

    const resourceDataByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/resource-data$/);
    if (resourceDataByChannelMatch) {
      const channel = resourceDataByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/resource-data.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        resourceInsights: chunk?.resourceInsights ?? null,
        materialSources: chunk?.materialSources ?? null,
      });
      return;
    }

    const shipComponentsByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/ship-components$/);
    if (shipComponentsByChannelMatch) {
      const channel = shipComponentsByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/ship-components.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        shipComponents: chunk?.shipComponents ?? null,
      });
      return;
    }

    const missionRewardsByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/mission-rewards$/);
    if (missionRewardsByChannelMatch) {
      const channel = missionRewardsByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/mission-rewards.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        missionRewards: chunk?.missionRewards ?? null,
      });
      return;
    }

    const factionContractsByChannelMatch = path.match(
      /^\/api\/game-data\/public\/(live|ptu)\/mission-rewards\/factions\/([^/]+)$/,
    );
    if (factionContractsByChannelMatch) {
      await getFactionContractsByChannel(
        response,
        factionContractsByChannelMatch[1],
        decodeURIComponent(factionContractsByChannelMatch[2]),
      );
      return;
    }

    const changelogByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/changelog$/);
    if (changelogByChannelMatch) {
      const channel = changelogByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/changelog.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        changelog: chunk?.changelog ?? null,
      });
      return;
    }

    const datasetByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)$/);
    if (datasetByChannelMatch) {
      await getDatasetByChannel(response, datasetByChannelMatch[1]);
      return;
    }

    sendError(response, 404, 'Not found.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local API failure.';
    console.error(`[dev-api] ${message}`);
    sendError(response, 500, message);
  }
});

server.on('error', (error) => {
  console.error(`[dev-api] ${error instanceof Error ? error.message : 'Local API server failed.'}`);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-api] ready on http://127.0.0.1:${PORT}`);
});
