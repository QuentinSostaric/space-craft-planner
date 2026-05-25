import {
  appendQueryParam,
  buildExpiredCookie,
  getPublicOrigin,
  sanitizeReturnTo,
  serializeCookie,
} from './discordAuth.mjs';
import { normalizeRsiLink } from './rsiLink.mjs';

const DEFAULT_CITIZENID_ORIGIN = 'https://citizenid.space';

const CITIZENID_STATE_COOKIE_NAME = 'sc_craft_citizenid_oauth_state';
const CITIZENID_STATE_COOKIE_MAX_AGE = 60 * 10;
const DEFAULT_CITIZENID_SCOPES = [
  'openid',
  'rsi.profile',
  'rsi.orgs.primary',
  'rsi.orgs.public',
];

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

function decodeBase64UrlJson(value) {
  try {
    return JSON.parse(textDecoder.decode(decodeBase64Url(value)));
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  const parts = String(token ?? '').split('.');
  if (parts.length < 2 || !parts[1]) {
    return null;
  }

  const payload = decodeBase64UrlJson(parts[1]);
  return payload && typeof payload === 'object' ? payload : null;
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

function getCitizenIdOrigin(env) {
  const explicitOrigin = String(env?.CITIZENID_ORIGIN ?? '').trim();
  return (explicitOrigin || DEFAULT_CITIZENID_ORIGIN).replace(/\/+$/g, '');
}

function parseCookieHeader(cookieHeader) {
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
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  }

  return cookies;
}

export function isCitizenIdAuthConfigured(env) {
  return Boolean(
    env?.CITIZENID_CLIENT_ID &&
    env?.CITIZENID_CLIENT_SECRET &&
    env?.AUTH_SESSION_SECRET,
  );
}

export function getCitizenIdRedirectUri(requestOrUrl, env) {
  const explicitRedirectUri = String(env?.CITIZENID_REDIRECT_URI ?? '').trim();
  if (explicitRedirectUri) {
    return explicitRedirectUri;
  }

  return new URL('/api/auth/citizenid/callback', getPublicOrigin(requestOrUrl, env)).toString();
}

export function getCitizenIdScopes(env) {
  const rawScopes = String(env?.CITIZENID_OAUTH_SCOPES ?? DEFAULT_CITIZENID_SCOPES.join(' ')).trim();
  const scopes = rawScopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes.length > 0
    ? [...new Set([...scopes, ...DEFAULT_CITIZENID_SCOPES])]
    : [...DEFAULT_CITIZENID_SCOPES];
}

export async function createCitizenIdStateCookie(requestOrUrl, env, returnTo = '/') {
  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    throw new Error('AUTH_SESSION_SECRET is required to create Citizen iD OAuth state cookies.');
  }

  const publicOrigin = getPublicOrigin(requestOrUrl, env);
  const isSecure =
    normalizeBoolean(env?.AUTH_COOKIE_SECURE) ||
    publicOrigin.startsWith('https://');
  const payload = {
    nonce: generateNonce(),
    returnTo: sanitizeReturnTo(returnTo),
    expiresAt: Date.now() + CITIZENID_STATE_COOKIE_MAX_AGE * 1000,
  };
  const signedPayload = await encodeSignedPayload(payload, sessionSecret);

  return {
    state: payload.nonce,
    cookie: serializeCookie(CITIZENID_STATE_COOKIE_NAME, signedPayload, {
      maxAge: CITIZENID_STATE_COOKIE_MAX_AGE,
      secure: isSecure,
      path: '/',
    }),
  };
}

export async function readCitizenIdStateFromCookies(cookieHeader, env) {
  const sessionSecret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  const payload = await decodeSignedPayload(cookies[CITIZENID_STATE_COOKIE_NAME], sessionSecret);
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

export function buildExpiredCitizenIdStateCookie(requestOrUrl, env) {
  return buildExpiredCookie(CITIZENID_STATE_COOKIE_NAME, requestOrUrl, env);
}

export function buildCitizenIdAuthorizationUrl(requestOrUrl, env, state) {
  if (!isCitizenIdAuthConfigured(env)) {
    throw new Error('Citizen iD auth is not configured.');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: String(env.CITIZENID_CLIENT_ID),
    scope: getCitizenIdScopes(env).join(' '),
    state,
    redirect_uri: getCitizenIdRedirectUri(requestOrUrl, env),
  });

  return `${getCitizenIdOrigin(env)}/connect/authorize?${params.toString()}`;
}

export async function exchangeCitizenIdCode(requestOrUrl, env, code) {
  if (!isCitizenIdAuthConfigured(env)) {
    throw new Error('Citizen iD auth is not configured.');
  }

  const response = await fetch(`${getCitizenIdOrigin(env)}/connect/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.CITIZENID_CLIENT_ID}:${env.CITIZENID_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getCitizenIdRedirectUri(requestOrUrl, env),
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Citizen iD token exchange failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const message = payload?.error_description ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`Citizen iD token exchange failed: ${message}`);
  }

  if (!payload?.access_token) {
    throw new Error('Citizen iD token exchange did not return an access token.');
  }

  return payload;
}

export async function fetchCitizenIdRsiProfile(accessToken, env = {}) {
  const response = await fetch(`${getCitizenIdOrigin(env)}/api/v1/profile/@me/rsi/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Citizen iD RSI profile lookup failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`Citizen iD RSI profile lookup failed: ${message}`);
  }

  const rsiLink = normalizeRsiLink({
    handle: payload?.username,
    displayName: payload?.communityMoniker ?? payload?.username,
    profileUrl: payload?.username
      ? `https://robertsspaceindustries.com/citizens/${encodeURIComponent(payload.username)}`
      : null,
    verifiedAt: new Date().toISOString(),
  });

  if (!rsiLink) {
    throw new Error('Citizen iD did not return a linked RSI profile.');
  }

  return rsiLink;
}

export function extractCitizenIdRsiProfileFromClaims(claims) {
  if (!claims || typeof claims !== 'object') {
    return null;
  }

  return normalizeRsiLink({
    handle: claims['urn:user:rsi:username'],
    displayName:
      claims['urn:user:rsi:displayName'] ??
      claims['urn:user:rsi:username'],
    profileUrl: claims['urn:user:rsi:username']
      ? `https://robertsspaceindustries.com/citizens/${encodeURIComponent(claims['urn:user:rsi:username'])}`
      : null,
    verifiedAt: new Date().toISOString(),
  });
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeCitizenIdOrganizationClaim(value, { source = 'manual' } = {}) {
  const parsedValue = parseMaybeJson(value);
  if (!parsedValue) {
    return null;
  }

  if (typeof parsedValue === 'string') {
    const sid = parsedValue.trim().toUpperCase();
    return sid
      ? {
          sid,
          source,
          name: sid,
          image: null,
          logo: null,
          url: `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
          status: 'verified_member',
          rank: null,
          stars: null,
          lastSeenAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
        }
      : null;
  }

  if (typeof parsedValue !== 'object') {
    return null;
  }

  const sid = String(
    parsedValue.sid ??
      parsedValue.SID ??
      parsedValue.spectrumId ??
      parsedValue.spectrumID ??
      parsedValue.spectrumIdentification ??
      parsedValue.identifier ??
      '',
  ).trim().toUpperCase();
  if (!sid) {
    return null;
  }

  const stars = Number(parsedValue.stars ?? parsedValue.rankStars);
  const rank = parsedValue.rank ? String(parsedValue.rank) : null;
  return {
    sid,
    source,
    name: String(parsedValue.name ?? parsedValue.displayName ?? parsedValue.display ?? sid).trim() || sid,
    image: parsedValue.image ?? parsedValue.logo ?? parsedValue.avatarUrl ?? null,
    logo: parsedValue.logo ?? null,
    url: parsedValue.url ?? `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
    archetype: parsedValue.archetype ?? null,
    commitment: parsedValue.commitment ?? null,
    primaryFocus: parsedValue.primaryFocus ?? parsedValue.primaryActivity ?? null,
    secondaryFocus: parsedValue.secondaryFocus ?? parsedValue.secondaryActivity ?? null,
    lang: parsedValue.lang ?? parsedValue.language ?? null,
    members: Number.isFinite(Number(parsedValue.members)) ? Number(parsedValue.members) : null,
    status: 'verified_member',
    rank,
    stars: Number.isFinite(stars) ? stars : null,
    lastSeenAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
  };
}

function extractCitizenIdOrganizationsFromClaimValue(value, options) {
  const parsedValue = parseMaybeJson(value);
  const values = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
  return values
    .map((entry) => normalizeCitizenIdOrganizationClaim(entry, options))
    .filter(Boolean);
}

export function extractCitizenIdOrganizationsFromClaims(claims) {
  if (!claims || typeof claims !== 'object') {
    return [];
  }

  return [
    ...extractCitizenIdOrganizationsFromClaimValue(
      claims['urn:user:rsi:orgs:primary'],
      { source: 'profile-main' },
    ),
    ...extractCitizenIdOrganizationsFromClaimValue(
      claims['urn:user:rsi:orgs:public'],
      { source: 'manual' },
    ),
  ];
}

function getCitizenIdTokenClaims(tokenPayload) {
  const idTokenClaims = decodeJwtPayload(tokenPayload?.id_token);
  const accessTokenClaims = decodeJwtPayload(tokenPayload?.access_token);
  return [idTokenClaims, accessTokenClaims].filter(Boolean);
}

export async function resolveCitizenIdAccountData(tokenPayload, env = {}) {
  const tokenClaims = getCitizenIdTokenClaims(tokenPayload);
  const rsiLink =
    tokenClaims
      .map((claims) => extractCitizenIdRsiProfileFromClaims(claims))
      .find(Boolean) ?? null;

  if (rsiLink) {
    return {
      rsiLink,
      organizations: tokenClaims.flatMap((claims) => extractCitizenIdOrganizationsFromClaims(claims)),
    };
  }

  return {
    rsiLink: await fetchCitizenIdRsiProfile(tokenPayload?.access_token, env),
    organizations: [],
  };
}

export async function resolveCitizenIdRsiProfile(tokenPayload, env = {}) {
  return (await resolveCitizenIdAccountData(tokenPayload, env)).rsiLink;
}

export function buildCitizenIdCallbackErrorRedirect(returnTo, message) {
  return appendQueryParam(returnTo, 'auth_error', message);
}
