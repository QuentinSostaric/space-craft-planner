import {
  COMMAND_DEFINITIONS,
  DISCORD_INTERACTION_RESPONSE_TYPE_CHANNEL_MESSAGE_WITH_SOURCE,
  DISCORD_INTERACTION_RESPONSE_TYPE_PONG,
  DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND,
  DISCORD_INTERACTION_TYPE_MESSAGE_COMPONENT,
  DISCORD_INTERACTION_TYPE_PING,
  DISCORD_INTERACTION_RESPONSE_TYPE_UPDATE_MESSAGE,
  DISCORD_MESSAGE_FLAG_EPHEMERAL,
  getCommandOption,
} from './commands.mjs';
import { createBucketAccountStore, readScopedAccountRecord } from '../../../shared/accountStorage.mjs';
import { respondToCraftRequest, saveCraftRequestNotificationState } from '../../../shared/craftRequestService.mjs';
import {
  buildCraftRequestOwnerDmPayload,
  buildCraftRequestResolvedMessagePayload,
  buildOrganizationClaimResolvedDmPayload,
  buildOrganizationClaimReviewDmPayload,
  notifyCraftRequestOwner,
  notifyOrganizationClaimReviewer,
  parseCraftRequestActionCustomId,
  parseOrganizationClaimActionCustomId,
  removeCraftRequestOwnerMessage,
  syncCraftRequestOwnerMessage,
} from '../../../shared/discordBot.mjs';
import {
  readOrganizationClaimRequest,
  writeOrganizationClaimRequest,
} from '../../../shared/organizationClaimRequestStorage.mjs';
import {
  readOrganizationRecord,
  writeOrganizationRecord,
} from '../../../shared/organizationStorage.mjs';
import { toIsoNow } from '../../../shared/normalize.mjs';

const PAGE_PATHS = {
  site: '/',
  account: '/account',
  blueprints: '/blueprints',
  organizations: '/organizations',
  resources: '/resources',
  missions: '/missions',
};

function getBaseUrl(env) {
  return String(env.APP_BASE_URL ?? 'https://itemfab.space').replace(/\/+$/, '');
}

function getInternalToken(env) {
  return String(env.DISCORD_BOT_INTERNAL_TOKEN ?? '').trim();
}

function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(String(left ?? ''));
  const rightBytes = encoder.encode(String(right ?? ''));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function textResponse(body, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'text/plain; charset=utf-8');
  }
  return new Response(body, { ...init, headers });
}

async function readJsonRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isAuthorizedInternalRequest(request, env) {
  const expectedToken = getInternalToken(env);
  if (!expectedToken) {
    return false;
  }

  const authorization = String(request.headers.get('authorization') ?? '').trim();
  return timingSafeEqual(authorization, `Bearer ${expectedToken}`);
}

function hexToUint8Array(value) {
  if (!value || value.length % 2 !== 0) {
    throw new Error('Invalid hex input.');
  }

  const normalized = value.toLowerCase();
  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }

  return bytes;
}

let discordPublicKeyPromise;

function getDiscordPublicKey(env) {
  if (!env.DISCORD_PUBLIC_KEY) {
    throw new Error('Missing DISCORD_PUBLIC_KEY.');
  }

  if (!discordPublicKeyPromise) {
    discordPublicKeyPromise = crypto.subtle.importKey(
      'raw',
      hexToUint8Array(env.DISCORD_PUBLIC_KEY),
      { name: 'Ed25519' },
      false,
      ['verify'],
    ).catch((error) => {
      discordPublicKeyPromise = null;
      throw error;
    });
  }

  return discordPublicKeyPromise;
}

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return { ok: false, status: 401, message: 'Missing Discord signature headers.' };
  }

  const body = await request.text();
  const key = await getDiscordPublicKey(env);
  const verified = await crypto.subtle.verify(
    'Ed25519',
    key,
    hexToUint8Array(signature),
    new TextEncoder().encode(timestamp + body),
  );

  if (!verified) {
    return { ok: false, status: 401, message: 'Invalid Discord request signature.' };
  }

  return { ok: true, body };
}

function interactionMessagePayload(content, { ephemeral = true } = {}) {
  return {
    type: DISCORD_INTERACTION_RESPONSE_TYPE_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: ephemeral ? DISCORD_MESSAGE_FLAG_EPHEMERAL : undefined,
    },
  };
}

function interactionUpdateMessage(data) {
  return {
    type: DISCORD_INTERACTION_RESPONSE_TYPE_UPDATE_MESSAGE,
    data,
  };
}

function getOrganizationClaimReviewerDiscordUserId(env) {
  return String(env.ORGANIZATION_CLAIM_REVIEWER_DISCORD_USER_ID ?? '').trim() || null;
}

function getAccountStore(env, storageScope = 'prod') {
  if (storageScope === 'dev') {
    if (!env.GAME_DATA_DEV) {
      throw new Error('Missing GAME_DATA_DEV binding for Discord bot dev storage scope.');
    }

    return createBucketAccountStore(env.GAME_DATA_DEV);
  }

  if (!env.GAME_DATA) {
    throw new Error('Missing GAME_DATA binding for Discord bot production storage scope.');
  }

  return createBucketAccountStore(env.GAME_DATA);
}

async function loadOwnerCraftRequestContext(env, interaction) {
  const parsedCustomId = parseCraftRequestActionCustomId(interaction?.data?.custom_id);
  if (!parsedCustomId) {
    return { error: 'Unknown craft request action.' };
  }

  const accountStore = getAccountStore(env, parsedCustomId.storageScope);
  const ownerAccount = await readScopedAccountRecord(
    accountStore,
    parsedCustomId.ownerAccountId,
    null,
    parsedCustomId.datasetScope,
  );
  if (!ownerAccount) {
    return { error: 'The blueprint owner account could not be loaded.' };
  }

  const interactionUserId = String(interaction?.member?.user?.id ?? interaction?.user?.id ?? '').trim();
  if (!interactionUserId || ownerAccount.profile?.id !== interactionUserId) {
    return { error: 'Only the blueprint owner can use this action.' };
  }

  const request =
    (ownerAccount.incomingCraftRequests ?? []).find((entry) => entry.id === parsedCustomId.requestId) ??
    null;
  if (!request) {
    return { error: 'This craft request could not be found anymore.' };
  }

  const requesterAccount = await readScopedAccountRecord(
    accountStore,
    request.requesterAccountId,
    null,
    request.datasetScope ?? parsedCustomId.datasetScope,
  );
  if (!requesterAccount) {
    return { error: 'The requester account could not be loaded.' };
  }

  return {
    action: parsedCustomId.action,
    storageScope: parsedCustomId.storageScope,
    datasetScope: request.datasetScope ?? parsedCustomId.datasetScope,
    accountStore,
    ownerAccount,
    requesterAccount,
    request,
  };
}

async function handleOrganizationClaimComponent(env, interaction) {
  const parsed = parseOrganizationClaimActionCustomId(interaction?.data?.custom_id);
  if (!parsed || parsed.action === 'status') {
    return jsonResponse(interactionMessagePayload('This action is no longer available.'), { status: 200 });
  }

  const reviewerUserId = getOrganizationClaimReviewerDiscordUserId(env);
  const interactionUserId = String(interaction?.member?.user?.id ?? interaction?.user?.id ?? '').trim();
  if (!reviewerUserId || interactionUserId !== reviewerUserId) {
    return jsonResponse(interactionMessagePayload('Only the designated reviewer can use this action.'), { status: 200 });
  }

  const accountStore = getAccountStore(env, parsed.storageScope);
  const claimRequest = await readOrganizationClaimRequest(accountStore, parsed.sid, parsed.accountId);
  if (!claimRequest) {
    return jsonResponse(interactionMessagePayload('This claim request could not be found.'), { status: 200 });
  }

  if (claimRequest.status !== 'pending') {
    return jsonResponse(
      interactionUpdateMessage(buildOrganizationClaimResolvedDmPayload(env, claimRequest, claimRequest.status)),
    );
  }

  if (parsed.action !== 'approve' && parsed.action !== 'reject') {
    return jsonResponse(interactionMessagePayload('Unknown claim action.'), { status: 200 });
  }

  try {
    if (parsed.action === 'approve') {
      const orgRecord = await readOrganizationRecord(accountStore, parsed.sid);
      if (orgRecord?.claimed && orgRecord.claimedByAccountId !== parsed.accountId) {
        return jsonResponse(
          interactionMessagePayload('This organization has already been claimed by another account.'),
          { status: 200 },
        );
      }
      await writeOrganizationRecord(accountStore, {
        ...(orgRecord ?? {}),
        sid: parsed.sid,
        claimed: true,
        claimedByAccountId: parsed.accountId,
        updatedAt: toIsoNow(),
      });
    }

    await writeOrganizationClaimRequest(accountStore, {
      ...claimRequest,
      status: parsed.action === 'approve' ? 'approved' : 'rejected',
      updatedAt: toIsoNow(),
    });

    return jsonResponse(
      interactionUpdateMessage(
        buildOrganizationClaimResolvedDmPayload(env, claimRequest, parsed.action === 'approve' ? 'approved' : 'rejected'),
      ),
    );
  } catch (error) {
    return jsonResponse(
      interactionMessagePayload(error instanceof Error ? error.message : 'The claim request could not be updated.'),
      { status: 200 },
    );
  }
}

async function handleInternalOrganizationClaimCreated(request, env) {
  if (!isAuthorizedInternalRequest(request, env)) {
    return textResponse('Unauthorized.', { status: 401 });
  }

  const payload = await readJsonRequestBody(request);
  const claimData = payload?.claimData ?? null;
  const currentOwnerName = payload?.currentOwnerName ?? null;

  if (!claimData?.sid || !claimData?.accountId) {
    return jsonResponse({ ok: false, message: 'Invalid claim notification payload.' }, { status: 400 });
  }

  const reviewerUserId = getOrganizationClaimReviewerDiscordUserId(env);
  if (!reviewerUserId) {
    return jsonResponse({ ok: false, message: 'No reviewer Discord user ID configured.' }, { status: 503 });
  }

  try {
    await notifyOrganizationClaimReviewer(env, reviewerUserId, claimData, currentOwnerName);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { ok: false, message: error instanceof Error ? error.message : 'Reviewer notification failed.' },
      { status: 500 },
    );
  }
}

async function handleCraftRequestComponent(env, interaction) {
  const context = await loadOwnerCraftRequestContext(env, interaction);
  if (context.error) {
    return jsonResponse(interactionMessagePayload(context.error), { status: 200 });
  }

  if (context.action === 'accept' || context.action === 'deny' || context.action === 'close') {
    const targetStatus =
      context.action === 'accept' ? 'accepted'
        : context.action === 'deny' ? 'denied'
          : 'closed';

    // Guard: already in a terminal state for that action
    if (context.action === 'close' && context.request.status === 'closed') {
      return jsonResponse(
        interactionUpdateMessage(
          buildCraftRequestResolvedMessagePayload(
            env,
            context.request,
            context.request.status,
            context.requesterAccount,
          ),
        ),
      );
    }
    if ((context.action === 'accept' || context.action === 'deny') && context.request.status !== 'pending') {
      return jsonResponse(
        interactionUpdateMessage(
          buildCraftRequestResolvedMessagePayload(
            env,
            context.request,
            context.request.status,
            context.requesterAccount,
          ),
        ),
      );
    }

    try {
      const result = await respondToCraftRequest(
        context.accountStore,
        context.ownerAccount,
        context.request.id,
        targetStatus,
        { datasetScope: context.datasetScope },
      );

      return jsonResponse(
        interactionUpdateMessage(
          buildCraftRequestResolvedMessagePayload(
            env,
            result.request,
            result.status,
            result.requesterAccount,
          ),
        ),
      );
    } catch (error) {
      return jsonResponse(
        interactionMessagePayload(
          error instanceof Error ? error.message : 'The craft request could not be updated.',
        ),
        { status: 200 },
      );
    }
  }

  return jsonResponse(interactionMessagePayload('Unknown craft request action.'), { status: 200 });
}

async function handleInternalCraftRequestCreated(request, env) {
  if (!isAuthorizedInternalRequest(request, env)) {
    return textResponse('Unauthorized.', { status: 401 });
  }

  const payload = await readJsonRequestBody(request);
  const craftRequest = payload?.request ?? null;
  const ownerAccount = payload?.ownerAccount ?? null;
  const requesterAccount = payload?.requesterAccount ?? null;

  if (!craftRequest?.id || !ownerAccount?.accountId || !requesterAccount?.accountId) {
    return jsonResponse({ ok: false, message: 'Invalid craft request notification payload.' }, { status: 400 });
  }

  try {
    const delivery = await notifyCraftRequestOwner(env, craftRequest, ownerAccount, requesterAccount);
    const deliveredChannelId = String(delivery?.channel_id ?? '').trim();
    const deliveredMessageId = String(delivery?.id ?? '').trim();
    if (deliveredChannelId && deliveredMessageId) {
      const accountStore = getAccountStore(env, craftRequest.storageScope ?? 'prod');
      await saveCraftRequestNotificationState(
        accountStore,
        ownerAccount.accountId,
        craftRequest.id,
        {
          ownerDiscordChannelId: deliveredChannelId,
          ownerDiscordMessageId: deliveredMessageId,
        },
        { datasetScope: craftRequest.datasetScope },
      );
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'The craft request owner notification failed.',
      },
      { status: 500 },
    );
  }
}

async function handleInternalCraftRequestStatusChanged(request, env) {
  if (!isAuthorizedInternalRequest(request, env)) {
    return textResponse('Unauthorized.', { status: 401 });
  }

  const payload = await readJsonRequestBody(request);
  const craftRequest = payload?.request ?? null;
  const requesterAccount = payload?.requesterAccount ?? null;
  const ownerAccount = payload?.ownerAccount ?? null;

  if (!craftRequest?.id || !ownerAccount?.accountId || !requesterAccount?.accountId) {
    return jsonResponse({ ok: false, message: 'Invalid craft request status payload.' }, { status: 400 });
  }

  const accountStore = getAccountStore(env, craftRequest.storageScope ?? 'prod');

  try {
    if (craftRequest.status === 'accepted' || craftRequest.status === 'denied') {
      await syncCraftRequestOwnerMessage(env, craftRequest, requesterAccount);
      return jsonResponse({ ok: true, action: 'updated' });
    }

    if (craftRequest.status === 'closed' || craftRequest.status === 'deleted') {
      try {
        await removeCraftRequestOwnerMessage(env, craftRequest);
      } catch {
        // Ignore deletion failures for already-removed DMs.
      }
      await saveCraftRequestNotificationState(
        accountStore,
        ownerAccount.accountId,
        craftRequest.id,
        {
          ownerDiscordChannelId: null,
          ownerDiscordMessageId: null,
        },
        { datasetScope: craftRequest.datasetScope },
      );
      return jsonResponse({ ok: true, action: 'deleted' });
    }

    return jsonResponse({ ok: true, action: 'noop' });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'The craft request Discord message could not be synchronized.',
      },
      { status: 500 },
    );
  }
}

async function handleDatasetCommand(env, interaction) {
  const channel = String(getCommandOption(interaction, 'channel')?.value ?? 'live').toLowerCase();
  const baseUrl = getBaseUrl(env);
  const response = await fetch(`${baseUrl}/api/game-data/public/${encodeURIComponent(channel)}`, {
    headers: {
      accept: 'application/json',
      'user-agent': 'itemfab-discord-bot/1.0',
    },
  });

  if (!response.ok) {
    return interactionMessagePayload(
      `ItemFab could not load the ${channel.toUpperCase()} dataset summary right now (${response.status}).`,
    );
  }

  const payload = await response.json();
  const dataset = payload?.dataset;

  if (!dataset) {
    return interactionMessagePayload(`No ${channel.toUpperCase()} dataset is currently published.`);
  }

  const publishedAt = dataset.updatedAt ?? dataset.importedAt ?? 'unknown date';
  const version = dataset.version ?? 'unknown version';
  const buildNumber = dataset.buildNumber ?? 'n/a';

  return interactionMessagePayload(
    [
      `**${channel.toUpperCase()} dataset**`,
      `Version: \`${version}\``,
      `Build: \`${buildNumber}\``,
      `Updated: ${publishedAt}`,
      `${baseUrl}/blueprints`,
    ].join('\n'),
  );
}

function handleOpenCommand(env, interaction) {
  const page = String(getCommandOption(interaction, 'page')?.value ?? 'site').toLowerCase();
  const baseUrl = getBaseUrl(env);
  const path = PAGE_PATHS[page] ?? '/';
  return interactionMessagePayload(`${baseUrl}${path}`);
}

async function handleInteraction(env, interaction) {
  if (interaction.type === DISCORD_INTERACTION_TYPE_PING) {
    return jsonResponse({ type: DISCORD_INTERACTION_RESPONSE_TYPE_PONG });
  }

  if (interaction.type === DISCORD_INTERACTION_TYPE_MESSAGE_COMPONENT) {
    const customId = String(interaction?.data?.custom_id ?? '');
    if (customId.startsWith('orgclaim:')) {
      return handleOrganizationClaimComponent(env, interaction);
    }
    return handleCraftRequestComponent(env, interaction);
  }

  if (interaction.type !== DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND) {
    return jsonResponse(interactionMessagePayload('Unsupported interaction type.'), { status: 400 });
  }

  const commandName = interaction?.data?.name;

  switch (commandName) {
    case 'open':
      return jsonResponse(handleOpenCommand(env, interaction));
    case 'dataset':
      return jsonResponse(await handleDatasetCommand(env, interaction));
    default:
      return jsonResponse(interactionMessagePayload(`Unknown command: ${commandName ?? 'undefined'}.`), {
        status: 400,
      });
  }
}

function buildHealthPayload(env) {
  return {
    ok: true,
    worker: 'sc-craft-discord-bot',
    baseUrl: getBaseUrl(env),
    commands: COMMAND_DEFINITIONS.map((command) => command.name),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return jsonResponse(buildHealthPayload(env));
    }

    if (request.method === 'GET' && url.pathname === '/commands') {
      return jsonResponse({ commands: COMMAND_DEFINITIONS });
    }

    if (request.method === 'POST' && url.pathname === '/internal/craft-request-created') {
      return handleInternalCraftRequestCreated(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/internal/craft-request-status-changed') {
      return handleInternalCraftRequestStatusChanged(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/internal/organization-claim-created') {
      return handleInternalOrganizationClaimCreated(request, env);
    }

    if (request.method !== 'POST') {
      return textResponse('Method not allowed.', { status: 405 });
    }

    const verification = await verifyDiscordRequest(request, env);
    if (!verification.ok) {
      return textResponse(verification.message, { status: verification.status });
    }

    let interaction;
    try {
      interaction = JSON.parse(verification.body);
    } catch {
      return textResponse('Invalid JSON payload.', { status: 400 });
    }

    return handleInteraction(env, interaction);
  },
};
