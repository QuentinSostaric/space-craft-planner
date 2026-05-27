import { normalizeBaseUrl, normalizeText, readProcessEnv } from './normalize.mjs';

function isPreviewHostname(hostname) {
  return (
    hostname.startsWith('preview.') ||
    (hostname.endsWith('.space-craft-planner.pages.dev') &&
      hostname !== 'space-craft-planner.pages.dev')
  );
}

function readHeader(request, name) {
  const headers = request?.headers;
  if (!headers) {
    return '';
  }

  if (typeof headers.get === 'function') {
    return normalizeText(headers.get(name));
  }

  const lowerName = name.toLowerCase();
  const value = headers[lowerName] ?? headers[name];
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  return normalizeText(value);
}

function getDiscordBotWorkerUrl(env) {
  return normalizeBaseUrl(
    env?.DISCORD_BOT_WORKER_URL ??
      readProcessEnv('DISCORD_BOT_WORKER_URL') ??
      '',
  );
}

function getDiscordBotInternalToken(env) {
  return normalizeText(
    env?.DISCORD_BOT_INTERNAL_TOKEN ??
      readProcessEnv('DISCORD_BOT_INTERNAL_TOKEN') ??
      '',
  );
}

export function resolveAppBaseUrlFromRequest(request, env = null) {
  const originHeader = normalizeBaseUrl(readHeader(request, 'origin'));
  if (originHeader) {
    return originHeader;
  }

  const refererHeader = normalizeBaseUrl(readHeader(request, 'referer'));
  if (refererHeader) {
    return refererHeader;
  }

  const requestUrlOrigin = normalizeBaseUrl(request?.url);
  if (requestUrlOrigin) {
    return requestUrlOrigin;
  }

  return normalizeBaseUrl(
    env?.APP_BASE_URL ??
      readProcessEnv('APP_BASE_URL') ??
      'https://itemfab.space',
  );
}

export function resolveCraftRequestStorageScope(request, env = null) {
  const branch = normalizeText(
    env?.CF_PAGES_BRANCH ??
      readProcessEnv('CF_PAGES_BRANCH') ??
      '',
  ).toLowerCase();
  if (branch) {
    return branch === 'main' ? 'prod' : 'dev';
  }

  const appBaseUrl = resolveAppBaseUrlFromRequest(request, env);
  const hostname = (() => {
    try {
      return new URL(appBaseUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    isPreviewHostname(hostname)
  ) {
    return 'dev';
  }

  return 'prod';
}

export async function notifyCraftRequestOwnerViaWorker(
  env,
  request,
  ownerAccount,
  requesterAccount,
  { fetchImpl = fetch } = {},
) {
  const workerUrl = getDiscordBotWorkerUrl(env);
  const internalToken = getDiscordBotInternalToken(env);
  if (!workerUrl || !internalToken) {
    return false;
  }

  const response = await fetchImpl(`${workerUrl}/internal/craft-request-created`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${internalToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      request,
      ownerAccount,
      requesterAccount,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord bot worker notification failed (${response.status}).`);
  }

  return true;
}

export async function notifyOrganizationClaimReviewerViaWorker(
  env,
  claimData,
  currentOwnerName = null,
  { fetchImpl = fetch } = {},
) {
  const workerUrl = getDiscordBotWorkerUrl(env);
  const internalToken = getDiscordBotInternalToken(env);
  if (!workerUrl || !internalToken) {
    return false;
  }

  const response = await fetchImpl(`${workerUrl}/internal/organization-claim-created`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${internalToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ claimData, currentOwnerName }),
  });

  if (!response.ok) {
    throw new Error(`Discord bot worker claim notification failed (${response.status}).`);
  }

  return true;
}

export async function syncCraftRequestStatusViaWorker(
  env,
  request,
  ownerAccount,
  requesterAccount,
  { fetchImpl = fetch } = {},
) {
  const workerUrl = getDiscordBotWorkerUrl(env);
  const internalToken = getDiscordBotInternalToken(env);
  if (!workerUrl || !internalToken) {
    return false;
  }

  const response = await fetchImpl(`${workerUrl}/internal/craft-request-status-changed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${internalToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      request,
      ownerAccount,
      requesterAccount,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord bot worker status sync failed (${response.status}).`);
  }

  return true;
}
