const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/v10/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/v10/users/@me';

const SESSION_COOKIE_NAME = 'sc_craft_session';
const OAUTH_STATE_COOKIE_NAME = 'sc_craft_discord_oauth_state';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const DESKTOP_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const OAUTH_STATE_COOKIE_MAX_AGE = 60 * 10;
const DESKTOP_SESSION_PREFIX = 'auth/desktop/sessions/';

const SESSION_VERSION = 2;
const DEFAULT_RETURN_TO = '/';
const DEFAULT_DISCORD_SCOPES = ['identify'];

// Allowed desktop app origins for cross-origin auth flows.
// Matched on exact protocol + hostname only (any port is allowed for the Tauri
// dev webview served at http://localhost:5173). Prefix/substring matching must
// NOT be used here: it would treat hostile hosts such as
// http://localhost.attacker.com or https://tauri.localhost.attacker.com as
// trusted, enabling an open redirect on the OAuth callback.
const DESKTOP_ALLOWED_HOSTS = [
  { protocol: 'https:', hostname: 'tauri.localhost' },
  { protocol: 'http:', hostname: 'localhost' },
];

function isAllowedDesktopUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    return false;
  }

  return DESKTOP_ALLOWED_HOSTS.some(
    (allowed) => url.protocol === allowed.protocol && url.hostname === allowed.hostname,
  );
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const hmacKeyCache = new Map();

function getCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this runtime.');
  }
  return globalThis.crypto;
}

function encodeBase64Url(input) {
  const bytes = input instanceof Uint8Array ? input : textEncoder.encode(String(input));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const normalized = String(value)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importHmacKey(secret) {
  const cacheKey = String(secret);
  if (!hmacKeyCache.has(cacheKey)) {
    hmacKeyCache.set(
      cacheKey,
      getCrypto().subtle.importKey(
        'raw',
        textEncoder.encode(cacheKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    );
  }

  return hmacKeyCache.get(cacheKey);
}

async function signValue(value, secret) {
  const key = await importHmacKey(secret);
  const signature = await getCrypto().subtle.sign('HMAC', key, textEncoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

async function verifyValueSignature(value, signature, secret) {
  const key = await importHmacKey(secret);
  return getCrypto().subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(signature),
    textEncoder.encode(value),
  );
}

async function encodeSignedPayload(payload, secret) {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(body, secret);
  return `${body}.${signature}`;
}

async function decodeSignedPayload(value, secret) {
  if (!value || !String(value).includes('.')) {
    return null;
  }

  const [body, signature] = String(value).split('.', 2);
  if (!body || !signature) {
    return null;
  }

  const valid = await verifyValueSignature(body, signature, secret);
  if (!valid) {
    return null;
  }

  try {
    return JSON.parse(textDecoder.decode(decodeBase64Url(body)));
  } catch {
    return null;
  }
}

function generateNonce() {
  const bytes = new Uint8Array(24);
  getCrypto().getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function normalizeBoolean(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase() === 'true';
}

function buildAccountIdFromDiscordUser(userId) {
  const normalizedUserId = String(userId ?? '').trim();
  return normalizedUserId ? `discord_${normalizedUserId}` : null;
}

function buildAvatarUrl(user) {
  if (!user?.id || !user?.avatar) {
    return null;
  }

  const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

export function isDiscordAuthConfigured(env) {
  return Boolean(
    env?.DISCORD_CLIENT_ID &&
    env?.DISCORD_CLIENT_SECRET &&
    env?.AUTH_SESSION_SECRET,
  );
}

export function getPublicOrigin(requestOrUrl, env) {
  const explicitOrigin = String(env?.AUTH_PUBLIC_ORIGIN ?? '').trim();
  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/g, '');
  }

  const requestUrl =
    typeof requestOrUrl === 'string'
      ? requestOrUrl
      : requestOrUrl?.url;

  if (!requestUrl) {
    throw new Error('Unable to resolve public origin without a request URL.');
  }

  return new URL(requestUrl).origin;
}

export function getDiscordRedirectUri(requestOrUrl, env) {
  const explicitRedirectUri = String(env?.DISCORD_REDIRECT_URI ?? '').trim();
  if (explicitRedirectUri) {
    return explicitRedirectUri;
  }

  return new URL('/api/auth/discord/callback', getPublicOrigin(requestOrUrl, env)).toString();
}

export function getDiscordScopes(env) {
  const rawScopes = String(env?.DISCORD_OAUTH_SCOPES ?? DEFAULT_DISCORD_SCOPES.join(' ')).trim();
  const scopes = rawScopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes.length > 0 ? [...new Set(scopes)] : [...DEFAULT_DISCORD_SCOPES];
}

export function parseCookieHeader(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of String(cookieHeader).split(/;\s*/)) {
    if (!part) {
      continue;
    }

    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!name) {
      continue;
    }

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

export function isDesktopRequest(request) {
  const referer = request?.headers?.get?.('Referer') ?? '';
  const origin = request?.headers?.get?.('Origin') ?? '';
  return isAllowedDesktopUrl(origin) || isAllowedDesktopUrl(referer);
}

export function isDesktopReturnTo(value) {
  return isAllowedDesktopUrl(value);
}

export function sanitizeReturnTo(value) {
  if (!value) {
    return DEFAULT_RETURN_TO;
  }

  const candidate = String(value).trim();

  // Allow desktop app origins as absolute return URLs (exact host match only).
  if (isAllowedDesktopUrl(candidate)) {
    return candidate;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return DEFAULT_RETURN_TO;
  }

  return candidate;
}

export function appendQueryParam(path, name, value) {
  const url = new URL(path, 'https://itemfab.local');
  url.searchParams.set(name, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function serializeCookie(name, value, options = {}) {
  const {
    maxAge,
    httpOnly = true,
    path = '/',
    sameSite = 'Lax',
    secure = false,
    domain,
  } = options;

  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];

  if (Number.isFinite(maxAge)) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  }
  if (httpOnly) {
    segments.push('HttpOnly');
  }
  if (secure) {
    segments.push('Secure');
  }
  if (domain) {
    segments.push(`Domain=${domain}`);
  }

  return segments.join('; ');
}

export function buildExpiredCookie(name, requestOrUrl, env) {
  const isSecure =
    normalizeBoolean(env?.AUTH_COOKIE_SECURE) ||
    getPublicOrigin(requestOrUrl, env).startsWith('https://');

  return serializeCookie(name, '', {
    maxAge: 0,
    secure: isSecure,
    path: '/',
  });
}

export async function createOauthStateCookie(requestOrUrl, env, returnTo = DEFAULT_RETURN_TO) {
  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    throw new Error('AUTH_SESSION_SECRET is required to create OAuth state cookies.');
  }

  const publicOrigin = getPublicOrigin(requestOrUrl, env);
  const isSecure =
    normalizeBoolean(env?.AUTH_COOKIE_SECURE) ||
    publicOrigin.startsWith('https://');
  const payload = {
    nonce: generateNonce(),
    returnTo: sanitizeReturnTo(returnTo),
    expiresAt: Date.now() + OAUTH_STATE_COOKIE_MAX_AGE * 1000,
  };
  const signedPayload = await encodeSignedPayload(payload, sessionSecret);

  return {
    state: payload.nonce,
    cookie: serializeCookie(OAUTH_STATE_COOKIE_NAME, signedPayload, {
      maxAge: OAUTH_STATE_COOKIE_MAX_AGE,
      secure: isSecure,
      path: '/',
    }),
  };
}

export async function readOauthStateFromCookies(cookieHeader, env) {
  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  const payload = await decodeSignedPayload(cookies[OAUTH_STATE_COOKIE_NAME], sessionSecret);
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (!payload.nonce || !payload.expiresAt || Number(payload.expiresAt) < Date.now()) {
    return null;
  }

  return {
    nonce: String(payload.nonce),
    returnTo: sanitizeReturnTo(payload.returnTo),
    expiresAt: Number(payload.expiresAt),
  };
}

export async function createSessionCookie(requestOrUrl, env, user, accountId, options = {}) {
  const signedPayload = await createSessionToken(env, user, accountId);
  const publicOrigin = getPublicOrigin(requestOrUrl, env);
  const isSecure =
    normalizeBoolean(env?.AUTH_COOKIE_SECURE) ||
    publicOrigin.startsWith('https://');
  const needsCrossSiteCookie = Boolean(options.crossSite) || isDesktopRequest(requestOrUrl);

  return serializeCookie(SESSION_COOKIE_NAME, signedPayload, {
    maxAge: SESSION_COOKIE_MAX_AGE,
    secure: isSecure,
    // Desktop auth needs cross-site cookies; web sessions should stay Lax.
    sameSite: isSecure && needsCrossSiteCookie ? 'None' : 'Lax',
    path: '/',
  });
}

export async function createSessionToken(env, user, accountId) {
  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    throw new Error('AUTH_SESSION_SECRET is required to create auth sessions.');
  }

  const now = Date.now();
  const payload = {
    v: SESSION_VERSION,
    provider: 'discord',
    issuedAt: now,
    expiresAt: now + SESSION_COOKIE_MAX_AGE * 1000,
    user,
    accountId: String(accountId ?? buildAccountIdFromDiscordUser(user?.id) ?? '').trim(),
  };
  return encodeSignedPayload(payload, sessionSecret);
}

export async function createDesktopSessionToken(store, env, user, accountId) {
  if (!store?.writeJson) {
    throw new Error('A valid account store is required to create desktop sessions.');
  }

  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    throw new Error('AUTH_SESSION_SECRET is required to create desktop auth sessions.');
  }

  const now = Date.now();
  const sessionId = generateNonce();
  const normalizedAccountId = String(accountId ?? buildAccountIdFromDiscordUser(user?.id) ?? '').trim();
  const payload = {
    v: SESSION_VERSION,
    tokenType: 'desktop',
    provider: 'discord',
    sid: sessionId,
    issuedAt: now,
    expiresAt: now + DESKTOP_SESSION_MAX_AGE * 1000,
    user,
    accountId: normalizedAccountId,
  };

  await store.writeJson(`${DESKTOP_SESSION_PREFIX}${sessionId}.json`, {
    accountId: normalizedAccountId,
    userId: String(user?.id ?? ''),
    issuedAt: new Date(now).toISOString(),
    expiresAt: payload.expiresAt,
  });

  return encodeSignedPayload(payload, sessionSecret);
}

async function isDesktopSessionActive(store, payload) {
  if (payload?.tokenType !== 'desktop') {
    return true;
  }
  if (!store?.readJson || !payload.sid) {
    return false;
  }

  const sessionRecord = await store.readJson(`${DESKTOP_SESSION_PREFIX}${payload.sid}.json`);
  if (
    !sessionRecord ||
    String(sessionRecord.accountId ?? '') !== String(payload.accountId ?? '') ||
    Number(sessionRecord.expiresAt) < Date.now()
  ) {
    if (store?.deleteObject && payload.sid) {
      await store.deleteObject(`${DESKTOP_SESSION_PREFIX}${payload.sid}.json`);
    }
    return false;
  }

  return true;
}

export async function revokeDesktopSessionToken(store, authorizationHeader, env) {
  if (!store?.deleteObject) {
    return false;
  }

  const match = String(authorizationHeader ?? '').match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return false;
  }

  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    return false;
  }

  const payload = await decodeSignedPayload(match[1], sessionSecret);
  if (payload?.tokenType !== 'desktop' || !payload.sid) {
    return false;
  }

  await store.deleteObject(`${DESKTOP_SESSION_PREFIX}${payload.sid}.json`);
  return true;
}

async function readSessionFromSignedValue(value, env, store = null) {
  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    return null;
  }

  const payload = await decodeSignedPayload(value, sessionSecret);
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (
    (payload.v !== 1 && payload.v !== SESSION_VERSION) ||
    payload.provider !== 'discord' ||
    !payload.user ||
    Number(payload.expiresAt) < Date.now()
  ) {
    return null;
  }

  if (!await isDesktopSessionActive(store, payload)) {
    return null;
  }

  return {
    ...payload,
    accountId:
      String(payload.accountId ?? buildAccountIdFromDiscordUser(payload.user?.id) ?? '').trim() || null,
  };
}

export async function readSessionFromCookies(cookieHeader, env) {
  const cookies = parseCookieHeader(cookieHeader);
  return readSessionFromSignedValue(cookies[SESSION_COOKIE_NAME], env);
}

export async function readSessionFromBearerToken(authorizationHeader, env, store = null) {
  const match = String(authorizationHeader ?? '').match(/^Bearer\s+(.+)$/i);
  return readSessionFromSignedValue(match?.[1], env, store);
}

export async function readSessionFromRequest(request, env, store = null) {
  return (
    await readSessionFromBearerToken(request?.headers?.get?.('Authorization'), env, store) ??
    await readSessionFromCookies(request?.headers?.get?.('cookie'), env)
  );
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getOauthStateCookieName() {
  return OAUTH_STATE_COOKIE_NAME;
}

export function buildAuthSessionPayload(env, session) {
  const enabled = isDiscordAuthConfigured(env);
  return {
    enabled,
    provider: enabled ? 'discord' : null,
    user: session?.user ?? null,
  };
}

export function buildDiscordAuthorizationUrl(requestOrUrl, env, state) {
  if (!isDiscordAuthConfigured(env)) {
    throw new Error('Discord auth is not configured.');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: String(env.DISCORD_CLIENT_ID),
    scope: getDiscordScopes(env).join(' '),
    state,
    redirect_uri: getDiscordRedirectUri(requestOrUrl, env),
  });

  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeDiscordCode(requestOrUrl, env, code) {
  if (!isDiscordAuthConfigured(env)) {
    throw new Error('Discord auth is not configured.');
  }

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getDiscordRedirectUri(requestOrUrl, env),
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Discord token exchange failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const message = payload?.error_description ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`Discord token exchange failed: ${message}`);
  }

  return payload;
}

export async function fetchDiscordUserProfile(accessToken) {
  const response = await fetch(DISCORD_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Discord user lookup failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const message = payload?.message ?? `HTTP ${response.status}`;
    throw new Error(`Discord user lookup failed: ${message}`);
  }

  const displayName = payload.global_name || payload.username || 'Discord user';

  return {
    id: String(payload.id),
    username: String(payload.username ?? displayName),
    globalName: payload.global_name ? String(payload.global_name) : null,
    discriminator: payload.discriminator ? String(payload.discriminator) : null,
    avatarUrl: buildAvatarUrl(payload),
    displayName,
  };
}
