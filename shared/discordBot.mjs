const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_COMPONENT_TYPE_ACTION_ROW = 1;
const DISCORD_COMPONENT_TYPE_BUTTON = 2;
const DISCORD_BUTTON_STYLE_PRIMARY = 1;
const DISCORD_BUTTON_STYLE_SECONDARY = 2;
const DISCORD_BUTTON_STYLE_SUCCESS = 3;
const DISCORD_BUTTON_STYLE_DANGER = 4;

function normalizeText(value) {
  return String(value ?? '').trim();
}

function getAppBaseUrl(env) {
  return normalizeText(env?.APP_BASE_URL ?? process.env.APP_BASE_URL ?? 'https://itemfab.space').replace(/\/+$/, '');
}

function getCraftRequestBaseUrl(request, env) {
  return normalizeText(request?.appBaseUrl ?? '').replace(/\/+$/, '') || getAppBaseUrl(env);
}

function getDiscordBotToken(env) {
  return normalizeText(env?.DISCORD_BOT_TOKEN ?? process.env.DISCORD_BOT_TOKEN ?? '');
}

function getDiscordApiBaseUrl(env) {
  return normalizeText(env?.DISCORD_API_BASE_URL ?? process.env.DISCORD_API_BASE_URL ?? DISCORD_API_BASE_URL).replace(/\/+$/, '');
}

function buildDiscordUserMention(userId) {
  const normalizedUserId = normalizeText(userId);
  return normalizedUserId ? `<@${normalizedUserId}>` : 'Unknown user';
}

async function discordApiFetch(
  env,
  path,
  {
    method = 'GET',
    body,
    headers = {},
    fetchImpl = fetch,
  } = {},
) {
  const botToken = getDiscordBotToken(env);
  if (!botToken) {
    throw new Error('Discord bot token is not configured.');
  }

  const requestHeaders = {
    authorization: `Bot ${botToken}`,
    ...headers,
  };
  if (body) {
    requestHeaders['content-type'] = 'application/json; charset=utf-8';
  }

  const response = await fetchImpl(`${getDiscordApiBaseUrl(env)}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function openDiscordDmChannel(env, userId, options = {}) {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) {
    throw new Error('Discord user id is required to open a DM channel.');
  }

  const payload = await discordApiFetch(env, '/users/@me/channels', {
    method: 'POST',
    body: {
      recipient_id: normalizedUserId,
    },
    ...options,
  });

  const channelId = normalizeText(payload?.id);
  if (!channelId) {
    throw new Error('Discord DM channel could not be created.');
  }

  return channelId;
}

export async function sendDiscordChannelMessage(env, channelId, payload, options = {}) {
  const normalizedChannelId = normalizeText(channelId);
  if (!normalizedChannelId) {
    throw new Error('Discord channel id is required to send a message.');
  }

  return discordApiFetch(env, `/channels/${normalizedChannelId}/messages`, {
    method: 'POST',
    body: payload,
    ...options,
  });
}

export async function sendDiscordDirectMessage(env, userId, payload, options = {}) {
  const channelId = await openDiscordDmChannel(env, userId, options);
  return sendDiscordChannelMessage(env, channelId, payload, options);
}

export function buildCraftRequestActionCustomId(action, ownerAccountId, requestId, storageScope = 'prod') {
  const normalizedAction = normalizeText(action).toLowerCase();
  const normalizedStorageScope = normalizeText(storageScope).toLowerCase() === 'dev' ? 'dev' : 'prod';
  const normalizedOwnerAccountId = normalizeText(ownerAccountId);
  const normalizedRequestId = normalizeText(requestId);
  if (!normalizedAction || !normalizedOwnerAccountId || !normalizedRequestId) {
    throw new Error('Craft request action identifiers are required.');
  }

  return `craftreq:${normalizedAction}:${normalizedStorageScope}:${normalizedOwnerAccountId}:${normalizedRequestId}`;
}

export function parseCraftRequestActionCustomId(value) {
  const normalizedValue = normalizeText(value);
  const parts = normalizedValue.split(':');
  if (parts[0] !== 'craftreq') {
    return null;
  }

  if (parts.length === 4) {
    return {
      action: parts[1],
      storageScope: 'prod',
      ownerAccountId: parts[2],
      requestId: parts[3],
    };
  }

  if (parts.length !== 5) {
    return null;
  }

  return {
    action: parts[1],
    storageScope: parts[2] === 'dev' ? 'dev' : 'prod',
    ownerAccountId: parts[3],
    requestId: parts[4],
  };
}

function buildCraftRequestButtons(request) {
  const storageScope = normalizeText(request?.storageScope).toLowerCase() === 'dev' ? 'dev' : 'prod';
  return [
    {
      type: DISCORD_COMPONENT_TYPE_ACTION_ROW,
      components: [
        {
          type: DISCORD_COMPONENT_TYPE_BUTTON,
          style: DISCORD_BUTTON_STYLE_SUCCESS,
          label: 'Accept',
          custom_id: buildCraftRequestActionCustomId('accept', request.ownerAccountId, request.id, storageScope),
        },
        {
          type: DISCORD_COMPONENT_TYPE_BUTTON,
          style: DISCORD_BUTTON_STYLE_DANGER,
          label: 'Deny',
          custom_id: buildCraftRequestActionCustomId('deny', request.ownerAccountId, request.id, storageScope),
        },
        {
          type: DISCORD_COMPONENT_TYPE_BUTTON,
          style: DISCORD_BUTTON_STYLE_PRIMARY,
          label: 'Get in touch',
          custom_id: buildCraftRequestActionCustomId('contact', request.ownerAccountId, request.id, storageScope),
        },
      ],
    },
  ];
}

function buildDisabledCraftRequestButtons(request, disabledLabel) {
  const storageScope = normalizeText(request?.storageScope).toLowerCase() === 'dev' ? 'dev' : 'prod';
  return [
    {
      type: DISCORD_COMPONENT_TYPE_ACTION_ROW,
      components: [
        {
          type: DISCORD_COMPONENT_TYPE_BUTTON,
          style: DISCORD_BUTTON_STYLE_SECONDARY,
          label: disabledLabel,
          custom_id: buildCraftRequestActionCustomId('status', request.ownerAccountId, request.id, storageScope),
          disabled: true,
        },
      ],
    },
  ];
}

export function buildCraftRequestOwnerDmPayload(env, request, requesterAccount) {
  const requesterDiscordId = requesterAccount?.profile?.id ?? null;
  const requesterMention = buildDiscordUserMention(requesterDiscordId);
  const requesterDisplayName =
    normalizeText(requesterAccount?.profile?.displayName) ||
    normalizeText(request.requesterDisplayName) ||
    'Unknown requester';

  return {
    content: `Manage this request from ItemFab: ${getItemFabAccountUrl(env, request)}`,
    embeds: [
      {
        title: 'New ItemFab craft request',
        color: 0x4f8cff,
        description: `${requesterDisplayName} is asking you to craft **${request.blueprintName}**.`,
        thumbnail: requesterAccount?.profile?.avatarUrl
          ? { url: requesterAccount.profile.avatarUrl }
          : undefined,
        fields: [
          {
            name: 'Requester',
            value: `${requesterDisplayName}\n${requesterMention}`,
            inline: true,
          },
          {
            name: 'RSI handle',
            value: normalizeText(request.requesterRsiHandle) || 'Not linked',
            inline: true,
          },
          {
            name: 'Organization',
            value: `${request.organizationName} (${request.organizationSid})`,
            inline: false,
          },
          {
            name: 'Blueprint',
            value: request.blueprintName,
            inline: false,
          },
        ],
        footer: {
          text: `Request ID: ${request.id}`,
        },
      },
    ],
    components: buildCraftRequestButtons(request),
  };
}

export function buildCraftRequestResolvedMessagePayload(env, request, status, requesterAccount) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const statusLabel =
    normalizedStatus === 'accepted'
      ? 'Accepted'
      : normalizedStatus === 'denied'
        ? 'Denied'
        : normalizedStatus === 'closed'
          ? 'Closed'
          : 'Pending';
  const color =
    normalizedStatus === 'accepted'
      ? 0x2ecc71
      : normalizedStatus === 'denied'
        ? 0xe74c3c
        : normalizedStatus === 'closed'
          ? 0x95a5a6
          : 0x4f8cff;

  const payload = buildCraftRequestOwnerDmPayload(env, request, requesterAccount);
  const [embed] = payload.embeds;

  return {
    content: payload.content,
    embeds: [
      {
        ...embed,
        color,
        title: `Craft request ${statusLabel.toLowerCase()}`,
        fields: [
          ...embed.fields,
          {
            name: 'Status',
            value: statusLabel,
            inline: false,
          },
        ],
      },
    ],
    components: buildDisabledCraftRequestButtons(request, statusLabel),
  };
}

export function buildCraftRequestIntroductionPayload({
  counterpartDisplayName,
  counterpartDiscordId,
  counterpartRsiHandle,
  blueprintName,
  organizationName,
  requestId,
}) {
  return {
    embeds: [
      {
        title: 'ItemFab intro',
        color: 0xf1c40f,
        description: `You asked to get in touch about **${blueprintName}** on **${organizationName}**.`,
        fields: [
          {
            name: 'Discord',
            value: `${counterpartDisplayName}\n${buildDiscordUserMention(counterpartDiscordId)}`,
            inline: true,
          },
          {
            name: 'RSI handle',
            value: normalizeText(counterpartRsiHandle) || 'Not linked',
            inline: true,
          },
          {
            name: 'Request ID',
            value: requestId,
            inline: false,
          },
        ],
        footer: {
          text: 'Both parties received this introduction message.',
        },
      },
    ],
  };
}

export async function notifyCraftRequestOwner(env, request, ownerAccount, requesterAccount, options = {}) {
  const ownerDiscordUserId = normalizeText(ownerAccount?.profile?.id);
  if (!ownerDiscordUserId || !getDiscordBotToken(env)) {
    return false;
  }

  await sendDiscordDirectMessage(
    env,
    ownerDiscordUserId,
    buildCraftRequestOwnerDmPayload(env, request, requesterAccount),
    options,
  );
  return true;
}

export async function sendCraftRequestIntroduction(env, request, ownerAccount, requesterAccount, options = {}) {
  const ownerDiscordUserId = normalizeText(ownerAccount?.profile?.id);
  const requesterDiscordUserId = normalizeText(requesterAccount?.profile?.id);
  if (!ownerDiscordUserId || !requesterDiscordUserId || !getDiscordBotToken(env)) {
    return false;
  }

  const ownerDisplayName =
    normalizeText(ownerAccount?.profile?.displayName) ||
    normalizeText(request.ownerDisplayName) ||
    'Blueprint owner';
  const requesterDisplayName =
    normalizeText(requesterAccount?.profile?.displayName) ||
    normalizeText(request.requesterDisplayName) ||
    'Requester';

  await Promise.all([
    sendDiscordDirectMessage(
      env,
      ownerDiscordUserId,
      buildCraftRequestIntroductionPayload({
        counterpartDisplayName: requesterDisplayName,
        counterpartDiscordId: requesterDiscordUserId,
        counterpartRsiHandle: request.requesterRsiHandle,
        blueprintName: request.blueprintName,
        organizationName: request.organizationName,
        requestId: request.id,
      }),
      options,
    ),
    sendDiscordDirectMessage(
      env,
      requesterDiscordUserId,
      buildCraftRequestIntroductionPayload({
        counterpartDisplayName: ownerDisplayName,
        counterpartDiscordId: ownerDiscordUserId,
        counterpartRsiHandle: request.ownerRsiHandle,
        blueprintName: request.blueprintName,
        organizationName: request.organizationName,
        requestId: request.id,
      }),
      options,
    ),
  ]);

  return true;
}

export function getItemFabAccountUrl(env, request = null) {
  return `${getCraftRequestBaseUrl(request, env)}/account`;
}
