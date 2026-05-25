const DESKTOP_OAUTH_STATE_PREFIX = 'auth/desktop/oauth-state/';
const DESKTOP_EXCHANGE_PREFIX = 'auth/desktop/exchange/';
const DESKTOP_OAUTH_STATE_MAX_AGE_MS = 5 * 60 * 1000;
const DESKTOP_EXCHANGE_MAX_AGE_MS = 2 * 60 * 1000;
const DESKTOP_CLEANUP_PREFIXES = [DESKTOP_OAUTH_STATE_PREFIX, DESKTOP_EXCHANGE_PREFIX];

const textEncoder = new TextEncoder();
const hmacKeyCache = new Map();

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

async function importHmacKey(secret) {
  const cacheKey = String(secret);
  if (!hmacKeyCache.has(cacheKey)) {
    hmacKeyCache.set(
      cacheKey,
      crypto.subtle.importKey(
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
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

async function hashValue(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(String(value)));
  return encodeBase64Url(new Uint8Array(digest));
}

function generateSecret(bytesLength = 32) {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function getSessionSecret(env) {
  const secret = String(env?.AUTH_SESSION_SECRET ?? '').trim();
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is required for desktop auth.');
  }
  return secret;
}

export function isValidDesktopCallbackUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      Number(url.port) > 0 &&
      Number(url.port) <= 65535
    );
  } catch {
    return false;
  }
}

export function isDesktopOAuthRequest(url) {
  return url.searchParams.get('desktop') === '1' &&
    isValidDesktopCallbackUrl(url.searchParams.get('desktopCallback'));
}

async function buildStateSignature(nonce, env) {
  return signValue(`desktop-oauth-state:${nonce}`, getSessionSecret(env));
}

export async function cleanupExpiredDesktopAuthArtifacts(store, now = Date.now()) {
  if (!store?.listJsonKeys || !store?.readJson || !store?.deleteObject) {
    return 0;
  }

  let deleted = 0;
  for (const prefix of DESKTOP_CLEANUP_PREFIXES) {
    const keys = await store.listJsonKeys(prefix);
    for (const key of keys) {
      const payload = await store.readJson(key);
      if (!payload || Number(payload.expiresAt) < now) {
        await store.deleteObject(key);
        deleted += 1;
      }
    }
  }

  return deleted;
}

export async function createDesktopOAuthState(store, env, {
  flow,
  callbackUrl,
  session = null,
} = {}) {
  if (flow !== 'discord' && flow !== 'citizenid') {
    throw new Error('Unsupported desktop OAuth flow.');
  }
  if (!isValidDesktopCallbackUrl(callbackUrl)) {
    throw new Error('Invalid desktop callback URL.');
  }

  await cleanupExpiredDesktopAuthArtifacts(store);
  const nonce = generateSecret(24);
  const signature = await buildStateSignature(nonce, env);
  const now = Date.now();
  await store.writeJson(`${DESKTOP_OAUTH_STATE_PREFIX}${nonce}.json`, {
    flow,
    callbackUrl,
    session,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + DESKTOP_OAUTH_STATE_MAX_AGE_MS,
  });

  return `desktop.${nonce}.${signature}`;
}

export async function consumeDesktopOAuthState(store, env, state, expectedFlow) {
  const parts = String(state ?? '').split('.');
  if (parts.length !== 3 || parts[0] !== 'desktop') {
    return null;
  }

  const [, nonce, signature] = parts;
  if (!nonce || !signature || signature !== await buildStateSignature(nonce, env)) {
    return null;
  }

  const key = `${DESKTOP_OAUTH_STATE_PREFIX}${nonce}.json`;
  const payload = await store.readJson(key);
  await store.deleteObject(key);

  if (
    !payload ||
    payload.flow !== expectedFlow ||
    !isValidDesktopCallbackUrl(payload.callbackUrl) ||
    Number(payload.expiresAt) < Date.now()
  ) {
    return null;
  }

  return payload;
}

export function appendDesktopCallbackParams(callbackUrl, params) {
  const url = new URL(callbackUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function createDesktopExchangeCode(store, payload) {
  await cleanupExpiredDesktopAuthArtifacts(store);
  const code = generateSecret(32);
  const codeHash = await hashValue(code);
  const now = Date.now();
  await store.writeJson(`${DESKTOP_EXCHANGE_PREFIX}${codeHash}.json`, {
    ...payload,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + DESKTOP_EXCHANGE_MAX_AGE_MS,
  });
  return code;
}

export async function consumeDesktopExchangeCode(store, code) {
  const normalizedCode = String(code ?? '').trim();
  if (!normalizedCode) {
    return null;
  }

  const codeHash = await hashValue(normalizedCode);
  const key = `${DESKTOP_EXCHANGE_PREFIX}${codeHash}.json`;
  const payload = await store.readJson(key);
  await store.deleteObject(key);

  if (!payload || Number(payload.expiresAt) < Date.now()) {
    return null;
  }

  return payload;
}
