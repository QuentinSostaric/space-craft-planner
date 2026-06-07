import {
  appendQueryParam,
  buildExpiredCookie,
  getPublicOrigin,
  sanitizeReturnTo,
  serializeCookie,
} from './discordAuth.mjs';
import { normalizeRsiLink } from './rsiLink.mjs';
import {
  normalizeOrganizationSid,
  normalizeText,
} from './normalize.mjs';

const DEFAULT_CITIZENID_ORIGIN = 'https://citizenid.space';

const CITIZENID_STATE_COOKIE_NAME = 'sc_craft_citizenid_oauth_state';
const CITIZENID_STATE_COOKIE_MAX_AGE = 60 * 10;
const DEFAULT_CITIZENID_SCOPES = [
  'openid',
  'profile',
  'discord.profile',
  'rsi.profile',
  'rsi.orgs.primary',
  'rsi.orgs.public',
];

/**
 * Thrown when a Citizen iD profile authenticates successfully but has no linked
 * Discord account. The app keys accounts on the Discord identity, so a linked
 * Discord account is mandatory to sign in.
 */
export class CitizenIdDiscordLinkRequiredError extends Error {
  constructor(
    message = 'No Discord account is linked to this Citizen iD profile. Link Discord in Citizen iD, then sign in again.',
  ) {
    super(message);
    this.name = 'CitizenIdDiscordLinkRequiredError';
    this.code = 'discord_not_linked';
  }
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

export function getCitizenIdBrandEnvironment(env) {
  const explicitEnvironment = String(env?.CITIZENID_BRAND_ENVIRONMENT ?? '').trim().toLowerCase();
  if (explicitEnvironment === 'production' || explicitEnvironment === 'prod') {
    return 'production';
  }
  if (
    explicitEnvironment === 'development' ||
    explicitEnvironment === 'dev' ||
    explicitEnvironment === 'staging' ||
    explicitEnvironment === 'unstable' ||
    explicitEnvironment === 'test'
  ) {
    return 'unstable';
  }

  const origin = getCitizenIdOrigin(env).toLowerCase();
  return origin.includes('citizenid.dev') ? 'unstable' : 'production';
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

async function fetchCitizenIdJson(accessToken, env, path, label) {
  if (!accessToken) {
    throw new Error(`${label} failed: missing access token.`);
  }

  const response = await fetch(`${getCitizenIdOrigin(env)}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${message}`);
  }

  return payload;
}

function normalizeCitizenIdRsiProfilePayload(payload) {
  const rsiLink = normalizeRsiLink({
    handle: payload?.username,
    displayName: payload?.communityMoniker ?? payload?.username,
    profileUrl: payload?.username
      ? `https://robertsspaceindustries.com/citizens/${encodeURIComponent(payload.username)}`
      : null,
    verifiedAt: new Date().toISOString(),
    verificationProvider: 'citizenid',
  });

  if (!rsiLink) {
    throw new Error('Citizen iD did not return a linked RSI profile.');
  }

  return rsiLink;
}

export async function fetchCitizenIdRsiProfile(accessToken, env = {}) {
  return normalizeCitizenIdRsiProfilePayload(
    await fetchCitizenIdJson(
      accessToken,
      env,
      '/api/v1/profile/@me/rsi/profile',
      'Citizen iD RSI profile lookup',
    ),
  );
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
    verificationProvider: 'citizenid',
  });
}

/**
 * Builds the app's Discord-shaped user object from a Citizen iD token's Discord
 * claims (`urn:user:discord:*`, available with the `discord.profile` scope).
 * Returns null when no linked Discord account is present in the claims.
 */
export function extractCitizenIdDiscordUser(claims) {
  if (!claims || typeof claims !== 'object') {
    return null;
  }

  const discordId = normalizeText(claims['urn:user:discord:accountId']);
  if (!discordId) {
    return null;
  }

  const discordUsername = normalizeText(claims['urn:user:discord:username']) || null;
  const avatarUrl = normalizeText(claims['urn:user:discord:avatar:url']) || null;
  const displayName =
    discordUsername ||
    normalizeText(claims.name) ||
    normalizeText(claims.preferred_username) ||
    'Discord user';

  return {
    id: String(discordId),
    username: discordUsername || displayName,
    globalName: null,
    discriminator: null,
    avatarUrl,
    displayName,
  };
}

/**
 * Resolves the linked Discord identity from a Citizen iD token response.
 * Throws {@link CitizenIdDiscordLinkRequiredError} when none is linked.
 */
export function resolveCitizenIdDiscordUser(tokenPayload) {
  const user = getCitizenIdTokenClaims(tokenPayload)
    .map((claims) => extractCitizenIdDiscordUser(claims))
    .find(Boolean) ?? null;

  if (!user) {
    throw new CitizenIdDiscordLinkRequiredError();
  }

  return user;
}

function normalizeCitizenIdOrganizationMetadataPayload(payload, fallbackSid = null) {
  const sid = normalizeOrganizationSid(
    payload?.sid ??
      payload?.SID ??
      payload?.spectrumId ??
      payload?.spectrumID ??
      payload?.spectrumIdentification ??
      fallbackSid,
  );
  if (!sid) {
    return null;
  }

  const avatarUrl = payload?.avatarUrl ?? payload?.image ?? payload?.logo ?? null;
  const memberCount = Number(payload?.memberCount ?? payload?.members);
  return {
    sid,
    name:
      normalizeText(payload?.displayName ?? payload?.name ?? payload?.display ?? sid) ||
      sid,
    image: avatarUrl ? String(avatarUrl) : null,
    logo: payload?.logo ? String(payload.logo) : (avatarUrl ? String(avatarUrl) : null),
    banner: payload?.bannerUrl ? String(payload.bannerUrl) : null,
    url: payload?.url
      ? String(payload.url)
      : `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
    archetype: payload?.archetype ? String(payload.archetype) : null,
    commitment: payload?.commitment ? String(payload.commitment) : null,
    primaryFocus: payload?.primaryFocus ?? payload?.primaryActivity ?? null,
    secondaryFocus: payload?.secondaryFocus ?? payload?.secondaryActivity ?? null,
    lang: payload?.lang ?? payload?.language ?? null,
    members: Number.isFinite(memberCount) && memberCount > 0 ? memberCount : null,
  };
}

function normalizeCitizenIdOrganizationMembership(
  value,
  { source = 'manual', metadata = null } = {},
) {
  const parsedValue = parseMaybeJson(value);
  if (!parsedValue) {
    return null;
  }

  if (typeof parsedValue === 'string') {
    const sid = normalizeOrganizationSid(parsedValue);
    return sid
      ? {
          sid,
          source,
          name: metadata?.name ?? sid,
          image: metadata?.image ?? metadata?.logo ?? null,
          logo: metadata?.logo ?? null,
          url: metadata?.url ?? `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
          members: metadata?.members ?? null,
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

  const sid = normalizeOrganizationSid(
    parsedValue.sid ??
      parsedValue.SID ??
      parsedValue.spectrumId ??
      parsedValue.spectrumID ??
      parsedValue.spectrumIdentification ??
      parsedValue.identifier,
  );
  if (!sid) {
    return null;
  }

  const membershipMetadata =
    metadata ?? normalizeCitizenIdOrganizationMetadataPayload(parsedValue, sid);
  const stars = Number(
    parsedValue.stars ??
      parsedValue.rankStars ??
      parsedValue.rankLevel,
  );
  const rank =
    parsedValue.rankName ??
    parsedValue.rank ??
    parsedValue.title ??
    null;
  const isPrimary =
    source === 'profile-main' ||
    parsedValue.isPrimary === true ||
    String(parsedValue.type ?? '').toLowerCase() === 'primary';

  return {
    sid,
    source: isPrimary ? 'profile-main' : source,
    name:
      normalizeText(
        membershipMetadata?.name ??
          parsedValue.name ??
          parsedValue.displayName ??
          parsedValue.display ??
          sid,
      ) || sid,
    image: membershipMetadata?.image ?? parsedValue.image ?? parsedValue.logo ?? parsedValue.avatarUrl ?? null,
    logo: membershipMetadata?.logo ?? parsedValue.logo ?? null,
    url: membershipMetadata?.url ?? parsedValue.url ?? `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
    archetype: membershipMetadata?.archetype ?? parsedValue.archetype ?? null,
    commitment: membershipMetadata?.commitment ?? parsedValue.commitment ?? null,
    primaryFocus: membershipMetadata?.primaryFocus ?? parsedValue.primaryFocus ?? parsedValue.primaryActivity ?? null,
    secondaryFocus: membershipMetadata?.secondaryFocus ?? parsedValue.secondaryFocus ?? parsedValue.secondaryActivity ?? null,
    lang: membershipMetadata?.lang ?? parsedValue.lang ?? parsedValue.language ?? null,
    members: membershipMetadata?.members ?? (
      Number.isFinite(Number(parsedValue.members ?? parsedValue.memberCount))
        ? Number(parsedValue.members ?? parsedValue.memberCount)
        : null
    ),
    status: 'verified_member',
    rank: rank ? String(rank) : null,
    stars: Number.isFinite(stars) ? stars : null,
    lastSeenAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
  };
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
  return normalizeCitizenIdOrganizationMembership(value, { source });
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

function dedupeCitizenIdOrganizations(organizations) {
  const bySid = new Map();
  for (const organization of organizations) {
    const sid = normalizeOrganizationSid(organization?.sid);
    if (!sid) {
      continue;
    }

    const existing = bySid.get(sid);
    bySid.set(sid, {
      ...(existing ?? {}),
      ...organization,
      sid,
      source:
        existing?.source === 'profile-main' || organization.source === 'profile-main'
          ? 'profile-main'
          : 'manual',
      name:
        normalizeText(organization.name) ||
        normalizeText(existing?.name) ||
        sid,
      image: organization.image ?? existing?.image ?? null,
      logo: organization.logo ?? existing?.logo ?? null,
      url: organization.url ?? existing?.url ?? `https://robertsspaceindustries.com/orgs/${encodeURIComponent(sid)}`,
      members: organization.members ?? existing?.members ?? null,
    });
  }

  return [...bySid.values()];
}

async function fetchCitizenIdRsiOrganizationMetadata(accessToken, env, sid) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    return null;
  }

  try {
    return normalizeCitizenIdOrganizationMetadataPayload(
      await fetchCitizenIdJson(
        accessToken,
        env,
        `/api/v1/rsi/orgs/by-sid/${encodeURIComponent(normalizedSid)}`,
        'Citizen iD RSI organization lookup',
      ),
      normalizedSid,
    );
  } catch {
    return null;
  }
}

export async function fetchCitizenIdRsiProfileDetail(accessToken, env = {}) {
  const payload = await fetchCitizenIdJson(
    accessToken,
    env,
    '/api/v1/profile/@me/rsi/profile/detail',
    'Citizen iD RSI profile detail lookup',
  );
  const rsiLink = normalizeCitizenIdRsiProfilePayload(payload);
  const rawMemberships = [
    payload?.primaryOrg
      ? { value: payload.primaryOrg, source: 'profile-main' }
      : null,
    ...(Array.isArray(payload?.orgs)
      ? payload.orgs.map((organization) => ({
          value: organization,
          source: organization?.isPrimary === true ? 'profile-main' : 'manual',
        }))
      : []),
  ].filter(Boolean);

  const metadataBySid = new Map();
  await Promise.all(
    rawMemberships.map(async ({ value }) => {
      const sid = normalizeOrganizationSid(value?.spectrumId ?? value?.sid ?? value?.SID);
      if (!sid || metadataBySid.has(sid)) {
        return;
      }

      metadataBySid.set(sid, await fetchCitizenIdRsiOrganizationMetadata(accessToken, env, sid));
    }),
  );

  const organizations = rawMemberships
    .map(({ value, source }) => {
      const sid = normalizeOrganizationSid(value?.spectrumId ?? value?.sid ?? value?.SID);
      return normalizeCitizenIdOrganizationMembership(value, {
        source,
        metadata: sid ? metadataBySid.get(sid) ?? null : null,
      });
    })
    .filter(Boolean);

  return {
    rsiLink,
    organizations: dedupeCitizenIdOrganizations(organizations),
  };
}

export async function resolveCitizenIdAccountData(tokenPayload, env = {}) {
  const tokenClaims = getCitizenIdTokenClaims(tokenPayload);
  const claimRsiLink =
    tokenClaims
      .map((claims) => extractCitizenIdRsiProfileFromClaims(claims))
      .find(Boolean) ?? null;
  const claimOrganizations = tokenClaims.flatMap((claims) => extractCitizenIdOrganizationsFromClaims(claims));

  if (tokenPayload?.access_token) {
    try {
      const detail = await fetchCitizenIdRsiProfileDetail(tokenPayload.access_token, env);
      return {
        rsiLink: claimRsiLink ?? detail.rsiLink,
        organizations: dedupeCitizenIdOrganizations([
          ...detail.organizations,
          ...claimOrganizations,
        ]),
      };
    } catch {
      // Some Citizen iD tenants may not grant profile/detail yet. Claims and the
      // basic profile endpoint remain enough to link the RSI account.
    }
  }

  if (claimRsiLink) {
    return {
      rsiLink: claimRsiLink,
      organizations: dedupeCitizenIdOrganizations(claimOrganizations),
    };
  }

  return {
    rsiLink: await fetchCitizenIdRsiProfile(tokenPayload?.access_token, env),
    organizations: dedupeCitizenIdOrganizations(claimOrganizations),
  };
}

export async function resolveCitizenIdRsiProfile(tokenPayload, env = {}) {
  return (await resolveCitizenIdAccountData(tokenPayload, env)).rsiLink;
}

export function buildCitizenIdCallbackErrorRedirect(returnTo, message) {
  return appendQueryParam(returnTo, 'auth_error', message);
}
