import { normalizeRsiHandle } from './rsiLink.mjs';

const CHALLENGE_MAX_AGE_MS = 15 * 60 * 1000;

function challengeKey(accountId) {
  if (!/^discord_\d+$/.test(String(accountId ?? ''))) {
    throw new Error('A valid account is required for RSI verification.');
  }
  return `auth/rsi-challenges/${accountId}.json`;
}

function isActiveChallenge(challenge, accountId, handle) {
  return challenge?.accountId === accountId &&
    String(challenge.handle).toLowerCase() === handle.toLowerCase() &&
    /^SC-[A-F0-9]{32}$/.test(challenge.code ?? '') &&
    Number.isFinite(Date.parse(challenge.expiresAt)) &&
    Date.parse(challenge.expiresAt) > Date.now();
}

export async function createRsiVerificationChallenge(store, accountId, handle) {
  const normalizedHandle = normalizeRsiHandle(handle);
  if (!normalizedHandle) {
    throw new Error('A valid RSI handle is required.');
  }
  const key = challengeKey(accountId);
  const existing = await store.readJson(key);
  if (isActiveChallenge(existing, accountId, normalizedHandle)) {
    return { code: existing.code, handle: existing.handle, expiresAt: existing.expiresAt };
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const challenge = {
    accountId,
    handle: normalizedHandle,
    code: `SC-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`,
    expiresAt: new Date(Date.now() + CHALLENGE_MAX_AGE_MS).toISOString(),
  };
  await store.writeJson(key, challenge);
  return { code: challenge.code, handle: challenge.handle, expiresAt: challenge.expiresAt };
}

export async function requireRsiVerificationChallenge(store, accountId, handle, code) {
  const normalizedHandle = normalizeRsiHandle(handle);
  const challenge = await store.readJson(challengeKey(accountId));
  if (!normalizedHandle || !isActiveChallenge(challenge, accountId, normalizedHandle) ||
      challenge.code !== String(code ?? '').trim().toUpperCase()) {
    throw new Error('Invalid or expired RSI verification challenge. Request a new code.');
  }
  return challenge;
}

export async function clearRsiVerificationChallenge(store, accountId) {
  await store.deleteObject(challengeKey(accountId));
}
