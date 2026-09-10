import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { dispatchAccountRoute, isSharedAccountRoute } from '../functions/_shared/accountRouter.js';
import { projectAccountForClient } from '../shared/accountPrivacy.mjs';
import {
  buildAuthSessionPayload,
  buildDiscordAuthorizationUrl,
  buildExpiredCookie,
  createDesktopSessionToken,
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
  readSessionFromRequest,
  revokeDesktopSessionToken,
  sanitizeReturnTo,
  appendQueryParam,
} from '../shared/discordAuth.mjs';
import {
  buildCitizenIdAuthorizationUrl,
  buildCitizenIdCallbackErrorRedirect,
  buildExpiredCitizenIdStateCookie,
  CitizenIdDiscordLinkRequiredError,
  createCitizenIdStateCookie,
  consumeCitizenIdWebState,
  exchangeCitizenIdCode,
  getCitizenIdBrandEnvironment,
  isCitizenIdAuthConfigured,
  readCitizenIdStateFromCookies,
  resolveCitizenIdAccountData,
  resolveCitizenIdDiscordUser,
} from '../shared/citizenIdAuth.mjs';
import {
  appendDesktopCallbackParams,
  consumeDesktopExchangeCode,
  consumeDesktopOAuthState,
  createDesktopExchangeCode,
  createDesktopOAuthState,
  isDesktopOAuthRequest,
} from '../shared/desktopAuth.mjs';
import {
  createR2Client,
  getJsonObject,
  getR2Config,
} from '../shared/r2Storage.mjs';
import {
  createS3AccountStore,
  readAccountRecord,
  readAccountSessionEpoch,
  saveRsiAccountLink,
  upsertDiscordAccount,
} from '../shared/accountStorage.mjs';
import {
  syncCitizenIdAccountOrganizations,
  syncAndDecorateAccountOrganizations,
} from '../shared/organizationService.mjs';
import { isTrustedAuthMutationRequest } from '../shared/authRequestSecurity.mjs';
import { buildBlueprintCatalogPage } from '../shared/blueprintCatalog.mjs';

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

function getOrganizationClaimReviewerEmail() {
  const reviewerEmail = String(process.env.ORGANIZATION_CLAIM_REVIEWER_EMAIL ?? '').trim();
  return reviewerEmail || null;
}

function isDesktopOAuthState(value) {
  return String(value ?? '').startsWith('desktop.');
}

function logBackgroundTaskError(label, error) {
  console.error(`[${label}]`, error);
}

async function buildDecoratedAccount(account) {
  try {
    return projectAccountForClient(await syncAndDecorateAccountOrganizations(accountStore, account));
  } catch {
    return projectAccountForClient(account);
  }
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

async function getBlueprintCatalog(response, requestUrl, datasetId) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for id "${datasetId}".`);
    return;
  }

  const catalog = await readJson(`datasets/${datasetId}/blueprint-catalog.json`);
  if (!catalog) {
    sendError(response, 404, `No blueprint catalog for dataset "${datasetId}".`);
    return;
  }

  sendJson(response, 200, buildBlueprintCatalogPage(catalog, requestUrl));
}

async function getBlueprintCatalogByChannel(response, requestUrl, channel) {
  const dataset = await readJson(`aliases/all/${channel}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for channel "${channel}".`);
    return;
  }

  const catalog = await readJson(`aliases/all/${channel}/blueprint-catalog.json`);
  if (!catalog) {
    sendError(response, 404, `No blueprint catalog for channel "${channel}".`);
    return;
  }

  sendJson(response, 200, buildBlueprintCatalogPage(catalog, requestUrl));
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
  const session = await readSessionFromRequest(
    { headers: { get: (name) => request.headers[String(name).toLowerCase()] } },
    process.env,
    accountStore,
  );
  sendJson(
    response,
    200,
    {
      ...buildAuthSessionPayload(process.env, session),
      citizenIdLoginEnabled: isCitizenIdAuthConfigured(process.env),
      citizenIdRsiLinkEnabled: isCitizenIdAuthConfigured(process.env),
      citizenIdBrandEnvironment: getCitizenIdBrandEnvironment(process.env),
    },
    {
      'Cache-Control': 'no-store',
    },
  );
}

async function requireAuthenticatedSession(request) {
  const session = await readSessionFromRequest(
    { headers: { get: (name) => request.headers[String(name).toLowerCase()] } },
    process.env,
    accountStore,
  );
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

// Best-effort linking of RSI profile + organizations from a Citizen iD token.
// RSI verification is optional (only a linked Discord account is required to
// sign in), so failures here must never block authentication.
async function linkCitizenIdAccountDataBestEffort(accountId, user, tokenPayload) {
  try {
    const { rsiLink, organizations, organizationsComplete = false } = await resolveCitizenIdAccountData(tokenPayload, process.env);
    let account = rsiLink
      ? await saveRsiAccountLink(accountStore, accountId, rsiLink, user)
      : null;
    if (organizations.length > 0 || organizationsComplete) {
      const base = account ?? await ensureAccountForSession({ accountId, user });
      account = await syncCitizenIdAccountOrganizations(accountStore, base, organizations, { organizationsComplete });
    }
    return account;
  } catch (error) {
    console.error('[citizenid-login-link]', error);
    return null;
  }
}

async function handleDiscordLogin(request, response, url) {
  if (!isDiscordAuthConfigured(process.env)) {
    sendError(response, 503, 'Discord auth is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  if (isDesktopOAuthRequest(url)) {
    const state = await createDesktopOAuthState(accountStore, process.env, {
      flow: 'discord',
      callbackUrl: url.searchParams.get('desktopCallback'),
      codeChallenge: url.searchParams.get('desktopCodeChallenge'),
    });
    const authorizationUrl = buildDiscordAuthorizationUrl(url.toString(), process.env, state);
    sendRedirect(response, authorizationUrl);
    return;
  }

  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const { state, cookie } = await createOauthStateCookie(url.toString(), process.env, returnTo);
  const authorizationUrl = buildDiscordAuthorizationUrl(url.toString(), process.env, state);

  sendRedirect(response, authorizationUrl, {
    'Set-Cookie': cookie,
  });
}

function handleDiscordBotInvite(response) {
  const clientId = String(process.env.DISCORD_CLIENT_ID ?? '').trim();
  if (!clientId) {
    sendError(response, 503, 'Discord bot invite is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  sendRedirect(response, `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}`);
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
  const desktopState = isDesktopOAuthState(state)
    ? await consumeDesktopOAuthState(accountStore, process.env, state, 'discord')
    : null;

  if (desktopState) {
    try {
      const tokenPayload = await exchangeDiscordCode(url.toString(), process.env, code);
      const user = await fetchDiscordUserProfile(tokenPayload.access_token);
      const account = await upsertDiscordAccount(accountStore, user);
      const exchangeCode = await createDesktopExchangeCode(accountStore, {
        flow: 'discord',
        codeChallenge: desktopState.codeChallenge,
        session: {
          provider: 'discord',
          user,
          accountId: account.accountId,
        },
      });
      sendRedirect(response, appendDesktopCallbackParams(desktopState.callbackUrl, {
        flow: 'discord',
        code: exchangeCode,
      }));
    } catch (error) {
      sendRedirect(response, appendDesktopCallbackParams(desktopState.callbackUrl, {
        flow: 'discord',
        error: error instanceof Error ? error.message : 'discord_oauth_failed',
      }));
    }
    return;
  }

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
      request,
      process.env,
      user,
      account.accountId,
      { crossSite: isDesktopReturnTo(returnTo), sessionEpoch: await readAccountSessionEpoch(accountStore, account.accountId) },
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

async function handleCitizenIdLogin(request, response, url) {
  if (!isCitizenIdAuthConfigured(process.env)) {
    sendError(response, 503, 'Citizen iD auth is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  if (isDesktopOAuthRequest(url)) {
    const state = await createDesktopOAuthState(accountStore, process.env, {
      flow: 'citizenid',
      callbackUrl: url.searchParams.get('desktopCallback'),
      codeChallenge: url.searchParams.get('desktopCodeChallenge'),
    });
    const authorizationUrl = buildCitizenIdAuthorizationUrl(url.toString(), process.env, state);
    sendRedirect(response, authorizationUrl);
    return;
  }

  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const { state, cookie } = await createCitizenIdStateCookie(url.toString(), process.env, returnTo, accountStore);
  const authorizationUrl = buildCitizenIdAuthorizationUrl(url.toString(), process.env, state);

  sendRedirect(response, authorizationUrl, {
    'Set-Cookie': cookie,
  });
}

async function handleCitizenIdCallback(request, response, url) {
  if (!isCitizenIdAuthConfigured(process.env)) {
    sendError(response, 503, 'Citizen iD auth is not configured.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthState = await readCitizenIdStateFromCookies(request.headers.cookie, process.env);
  const returnTo = oauthState?.returnTo ?? '/';
  const expiredStateCookie = buildExpiredCitizenIdStateCookie(url.toString(), process.env);
  const desktopState = isDesktopOAuthState(state)
    ? await consumeDesktopOAuthState(accountStore, process.env, state, 'citizenid')
    : null;

  if (desktopState) {
    try {
      const tokenPayload = await exchangeCitizenIdCode(url.toString(), process.env, code);
      const user = resolveCitizenIdDiscordUser(tokenPayload);
      const account = await upsertDiscordAccount(accountStore, user);
      await linkCitizenIdAccountDataBestEffort(account.accountId, user, tokenPayload);
      const exchangeCode = await createDesktopExchangeCode(accountStore, {
        flow: 'citizenid',
        codeChallenge: desktopState.codeChallenge,
        session: {
          provider: 'discord',
          user,
          accountId: account.accountId,
        },
      });
      sendRedirect(response, appendDesktopCallbackParams(desktopState.callbackUrl, {
        flow: 'citizenid',
        code: exchangeCode,
      }));
    } catch (error) {
      sendRedirect(response, appendDesktopCallbackParams(desktopState.callbackUrl, {
        flow: 'citizenid',
        error: error instanceof Error ? error.message : 'citizenid_oauth_failed',
      }));
    }
    return;
  }

  if (!code || !state || !oauthState || oauthState.nonce !== state) {
    sendRedirect(response, buildCitizenIdCallbackErrorRedirect(returnTo, 'state_mismatch'), {
      'Set-Cookie': [expiredStateCookie],
    });
    return;
  }

  if (!await consumeCitizenIdWebState(accountStore, oauthState)) {
    sendRedirect(response, buildCitizenIdCallbackErrorRedirect(returnTo,
      'This sign-in attempt has already been processed. Return to Account and start a new sign-in if needed.'));
    return;
  }

  try {
    const tokenPayload = await exchangeCitizenIdCode(url.toString(), process.env, code);
    const user = resolveCitizenIdDiscordUser(tokenPayload);
    const account = await upsertDiscordAccount(accountStore, user);
    await linkCitizenIdAccountDataBestEffort(account.accountId, user, tokenPayload);
    const sessionCookie = await createSessionCookie(
      request,
      process.env,
      user,
      account.accountId,
      { crossSite: isDesktopReturnTo(returnTo), sessionEpoch: await readAccountSessionEpoch(accountStore, account.accountId) },
    );

    sendRedirect(response, returnTo, {
      'Set-Cookie': [sessionCookie, expiredStateCookie],
    });
  } catch (error) {
    const message =
      error instanceof CitizenIdDiscordLinkRequiredError
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : 'citizenid_oauth_failed';
    sendRedirect(response, buildCitizenIdCallbackErrorRedirect(returnTo, message), {
      'Set-Cookie': [expiredStateCookie],
    });
  }
}

async function handleDesktopExchange(request, response) {
  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendError(response, 400, error instanceof Error ? error.message : 'Invalid JSON body.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const exchange = await consumeDesktopExchangeCode(accountStore, payload?.code, payload?.codeVerifier);
  if (!exchange?.session?.user?.id || !exchange.session.accountId) {
    sendError(response, 400, 'Invalid or expired desktop auth code.', {
      'Cache-Control': 'no-store',
    });
    return;
  }

  const account = await ensureAccountForSession(exchange.session);
  const sessionToken = await createDesktopSessionToken(
    accountStore,
    process.env,
    exchange.session.user,
    exchange.session.accountId,
  );
  const decoratedAccount = await buildDecoratedAccount(account);
  sendJson(
    response,
    200,
    {
      ok: true,
      flow: exchange.flow ?? 'discord',
      sessionToken,
      session: buildAuthSessionPayload(process.env, exchange.session),
      account: decoratedAccount,
    },
    {
      'Cache-Control': 'no-store',
    },
  );
}

async function handleLogout(request, url, response) {
  await revokeDesktopSessionToken(
    accountStore,
    request.headers.authorization,
    process.env,
  );
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
    if (path.startsWith('/api/auth/') && !isTrustedAuthMutationRequest({
      url: url.toString(), method: request.method,
      headers: new Headers(Object.entries(request.headers).filter(([, value]) => typeof value === 'string')),
    }, { AUTH_PUBLIC_ORIGIN: getAllowedOrigin(request) ?? process.env.AUTH_PUBLIC_ORIGIN })) {
      sendError(response, 403, 'Untrusted request origin.');
      return;
    }

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
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'authorization,content-type',
      });
      response.end();
      return;
    }

    if (isSharedAccountRoute(path)) {
      const fetchRequest = new Request(url, {
        method: request.method,
        headers: new Headers(Object.entries(request.headers).filter(([, value]) => typeof value === 'string')),
        ...(!['GET', 'HEAD'].includes(request.method) ? { body: Readable.toWeb(request), duplex: 'half' } : {}),
      });
      const result = await dispatchAccountRoute(fetchRequest, {
        ...process.env,
        ACCOUNT_STORE: accountStore,
        AUTH_PUBLIC_ORIGIN: getAllowedOrigin(request) ?? process.env.AUTH_PUBLIC_ORIGIN,
      });
      response.statusCode = result.status;
      for (const [name, value] of result.headers) {
        if (name.toLowerCase() !== 'set-cookie') response.setHeader(name, value);
      }
      const cookies = result.headers.getSetCookie();
      if (cookies.length) response.setHeader('set-cookie', cookies);
      response.end(Buffer.from(await result.arrayBuffer()));
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

    if (request.method === 'GET' && path === '/api/auth/discord/bot-invite') {
      handleDiscordBotInvite(response);
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/discord/callback') {
      await handleDiscordCallback(request, response, url);
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/citizenid/login') {
      await handleCitizenIdLogin(request, response, url);
      return;
    }

    if (request.method === 'GET' && path === '/api/auth/citizenid/callback') {
      await handleCitizenIdCallback(request, response, url);
      return;
    }

    if (request.method === 'POST' && path === '/api/auth/desktop/exchange') {
      await handleDesktopExchange(request, response);
      return;
    }

    if (request.method === 'POST' && path === '/api/auth/logout') {
      await handleLogout(request, url, response);
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

    const blueprintCatalogMatch = path.match(
      /^\/api\/game-data\/public\/by-id\/([^/]+)\/blueprints$/,
    );
    if (blueprintCatalogMatch) {
      await getBlueprintCatalog(
        response,
        url.toString(),
        decodeURIComponent(blueprintCatalogMatch[1]),
      );
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

    const blueprintCatalogByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/blueprints$/);
    if (blueprintCatalogByChannelMatch) {
      await getBlueprintCatalogByChannel(response, url.toString(), blueprintCatalogByChannelMatch[1]);
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
