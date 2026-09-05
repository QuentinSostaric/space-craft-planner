import { normalizeBaseUrl, normalizeText, readProcessEnv } from './normalize.mjs';
import { resolveRuntimeStorageScope } from '../functions/_shared/runtimeBuckets.js';

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
  // Notification links must never trust caller-controlled Origin/Referer.
  return normalizeBaseUrl(env?.APP_BASE_URL ?? readProcessEnv('APP_BASE_URL')) ??
    normalizeBaseUrl(request?.url) ?? 'https://itemfab.space';
}

export function resolveCraftRequestStorageScope(request, env = null) {
  const runtimeEnv = { CF_PAGES_BRANCH: env?.CF_PAGES_BRANCH ?? readProcessEnv('CF_PAGES_BRANCH') };
  // The Node development server supplies a relative IncomingMessage URL;
  // Cloudflare Requests always have an absolute URL.
  const url = String(request?.url ?? '');
  const runtimeRequest = { url: url.startsWith('/') ? `http://localhost${url}` : url };
  return resolveRuntimeStorageScope(runtimeEnv, runtimeRequest);
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
