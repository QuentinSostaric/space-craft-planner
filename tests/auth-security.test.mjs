import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import {
  createSessionToken, createDesktopSessionToken, readSessionFromCookies,
  readSessionFromRequest, readOauthStateFromCookies, sanitizeReturnTo,
  parseCookieHeader, createOauthStateCookie,
} from '../shared/discordAuth.mjs';
import { createCitizenIdStateCookie, readCitizenIdStateFromCookies, resolveCitizenIdAccountData } from '../shared/citizenIdAuth.mjs';
import {
  createBucketAccountStore, createS3AccountStore, createDefaultAccountRecord,
  getAccountObjectKey, getAccountSessionEpochKey, isRsiLinkRateLimited,
  normalizeAccountRecord, saveRsiAccountLink, clearRsiAccountLink, readAccountIdByRsiHandle,
} from '../shared/accountStorage.mjs';
import { isTrustedAuthMutationRequest } from '../shared/authRequestSecurity.mjs';
import { normalizeOrganizationSid } from '../shared/normalize.mjs';
import {
  createRsiVerificationChallenge, requireRsiVerificationChallenge,
} from '../shared/rsiVerification.mjs';
import { normalizeRsiLink } from '../shared/rsiLink.mjs';
import {
  createDesktopOAuthState, consumeDesktopOAuthState, createDesktopExchangeCode,
  consumeDesktopExchangeCode,
} from '../shared/desktopAuth.mjs';
import { buildOrganizationSharedBlueprints, buildOrganizationSharedResources, syncAndDecorateAccountOrganizations, syncCitizenIdAccountOrganizations } from '../shared/organizationService.mjs';
import { createDefaultOrganizationRecord, getOrganizationObjectKey, getVerifiedOrganizationMemberSnapshot, upsertOrganizationMetadata } from '../shared/organizationStorage.mjs';
import { createOrganizationCraftRequest } from '../shared/craftRequestService.mjs';
import { handleRsiLinkRequest } from '../functions/_shared/auth.js';
import { onRequest as authMiddleware } from '../functions/api/auth/_middleware.js';

const env = { AUTH_SESSION_SECRET: 'test-only-secret', AUTH_PUBLIC_ORIGIN: 'https://itemfab.space' };
const user = { id: '123', username: 'test', displayName: 'Test' };
const accountId = 'discord_123';
const legacyLink = { handle: 'Citizen', verifiedAt: new Date().toISOString(), verificationProvider: 'rsi-profile' };

function bucketFixture() {
  const records = new Map();
  let etag = 0;
  const bucket = {
    async get(key) {
      const record = records.get(key);
      return record ? { etag: record.etag, text: async () => record.body } : null;
    },
    async put(key, body, options = {}) {
      if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== records.get(key)?.etag) return null;
      const record = { etag: String(++etag), body };
      records.set(key, record);
      return { etag: record.etag };
    },
    async delete(key) { records.delete(key); },
    async list({ prefix }) { return { objects: [...records.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
  return { bucket, store: createBucketAccountStore(bucket), records };
}

function signed(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', env.AUTH_SESSION_SECRET).update(body).digest('base64url')}`;
}

test('OAuth returnTo blocks WHATWG host escapes and credentials while preserving app routes', () => {
  for (const unsafe of ['/\\attacker.example', '/\t/attacker.example', '//attacker.example', 'https://user:pass@tauri.localhost/']) {
    assert.equal(sanitizeReturnTo(unsafe), '/', unsafe);
  }
  assert.equal(sanitizeReturnTo('/account?tab=organizations'), '/account?tab=organizations');
  assert.equal(sanitizeReturnTo('https://tauri.localhost/account'), 'https://tauri.localhost/account');
});

test('malformed cookies and token encodings fail closed without throwing', async () => {
  assert.equal(parseCookieHeader('bad=%E0%A4%A; ordinary=ok').ordinary, 'ok');
  assert.equal(parseCookieHeader('__proto__=value').__proto__, 'value');
  const token = await createSessionToken(env, user, accountId);
  for (const malformed of ['body.%%%%', `${token}.extra`, '%E0%A4%A', 'a'.repeat(10000)]) {
    assert.equal(await readSessionFromCookies(`sc_craft_session=${malformed}`, env), null);
    assert.equal(await readOauthStateFromCookies(`sc_craft_discord_oauth_state=${malformed}`, env), null);
    assert.equal(await readCitizenIdStateFromCookies(`sc_craft_citizenid_oauth_state=${malformed}`, env), null);
  }
  assert.equal((await readSessionFromCookies(`bad=%E0%A4%A; sc_craft_session=${token}`, env)).accountId, accountId);
});

test('signed session claims require expiry and consistent identity and fail closed on revocation outages', async () => {
  const base = { v: 2, provider: 'discord', user, accountId, issuedAt: Date.now(), expiresAt: Date.now() + 60000 };
  for (const patch of [{ expiresAt: undefined }, { expiresAt: 'invalid' }, { expiresAt: 0 }, { accountId: 'discord_999' }, { user: { id: '../another' } }]) {
    assert.equal(await readSessionFromCookies(`sc_craft_session=${signed({ ...base, ...patch })}`, env), null);
  }
  const token = await createSessionToken(env, user, accountId);
  const store = { readJson: async () => { throw new Error('storage unavailable'); } };
  assert.equal(await readSessionFromCookies(`sc_craft_session=${token}`, env, store), null);
  const request = new Request('https://itemfab.space/api/auth/account', { headers: { Cookie: `sc_craft_session=${token}`, Authorization: 'Bearer invalid' } });
  assert.equal(await readSessionFromRequest(request, env), null);
  for (const state of [{ epoch: 'invalid' }, {}, { epoch: -1 }, { epoch: 1.5 }]) {
    assert.equal(await readSessionFromCookies(`sc_craft_session=${token}`, env, { readJson: async () => state }), null);
  }
});

test('existing web and desktop sessions remain valid with the stored epoch', async () => {
  const { store } = bucketFixture();
  await store.writeJson(getAccountSessionEpochKey(accountId), { epoch: 3 });
  const webToken = await createSessionToken(env, user, accountId, { sessionEpoch: 3 });
  assert.equal((await readSessionFromCookies(`sc_craft_session=${webToken}`, env, store)).accountId, accountId);
  const desktopToken = await createDesktopSessionToken(store, env, user, accountId);
  assert.equal((await readSessionFromRequest(new Request('https://itemfab.space', { headers: { Authorization: `Bearer ${desktopToken}` } }), env, store)).accountId, accountId);
  await store.writeJson(getAccountSessionEpochKey(accountId), { epoch: 4 });
  assert.equal(await readSessionFromCookies(`sc_craft_session=${webToken}`, env, store), null);
});

test('valid OAuth cookies remain compatible across both providers', async () => {
  for (const [create, read] of [[createOauthStateCookie, readOauthStateFromCookies], [createCitizenIdStateCookie, readCitizenIdStateFromCookies]]) {
    const { state, cookie } = await create('https://itemfab.space', env, '/account');
    assert.equal((await read(cookie, env)).nonce, state);
  }
});

test('CSRF denies foreign and sibling origins, null origins and cookied mutations without origin', async () => {
  const makeRequest = (headers) => new Request('https://itemfab.space/api/auth/account', { method: 'DELETE', headers });
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: 'https://preview.itemfab.space' }, { Origin: 'null' }, { Cookie: 'sc_craft_session=token' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal(isTrustedAuthMutationRequest(makeRequest(headers), env), false);
  }
  for (const headers of [{ Origin: 'https://itemfab.space' }, { Origin: 'https://tauri.localhost' }, { Authorization: 'Bearer native-token' }]) {
    assert.equal(isTrustedAuthMutationRequest(makeRequest(headers), env), true);
  }
  let reached = false;
  const response = await authMiddleware({ request: makeRequest({ Origin: 'https://attacker.example' }), env, next: () => { reached = true; } });
  assert.equal(response.status, 403);
  assert.equal(reached, false);
});

test('RSI proof is server-generated, bound to account and handle, and expires', async () => {
  const { store } = bucketFixture();
  await assert.rejects(requireRsiVerificationChallenge(store, accountId, 'Victim', 'STAR'), /Invalid or expired/);
  const challenge = await createRsiVerificationChallenge(store, accountId, 'Citizen');
  assert.match(challenge.code, /^SC-[A-F0-9]{32}$/);
  assert.deepEqual(await createRsiVerificationChallenge(store, accountId, 'Citizen'), challenge);
  await assert.rejects(requireRsiVerificationChallenge(store, 'discord_456', 'Citizen', challenge.code), /Invalid or expired/);
  await assert.rejects(requireRsiVerificationChallenge(store, accountId, 'Victim', challenge.code), /Invalid or expired/);
  await requireRsiVerificationChallenge(store, accountId, 'citizen', challenge.code);
  await store.writeJson(`auth/rsi-challenges/${accountId}.json`, { ...challenge, accountId, expiresAt: new Date(0).toISOString() });
  await assert.rejects(requireRsiVerificationChallenge(store, accountId, 'Citizen', challenge.code), /Invalid or expired/);
});

test('RSI API rejects public biography words before contacting RSI', async () => {
  const { store, bucket } = bucketFixture();
  await store.writeJson(getAccountObjectKey(accountId), createDefaultAccountRecord(user));
  const token = await createSessionToken(env, user, accountId);
  const request = new Request('https://itemfab.space/api/auth/account/rsi-link', {
    method: 'POST', headers: { Cookie: `sc_craft_session=${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'Victim', code: 'STAR' }),
  });
  const response = await handleRsiLinkRequest(request, { ...env, GAME_DATA_PROD: bucket });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Invalid or expired RSI verification challenge/);
  assert.equal((await store.readJson(getAccountObjectKey(accountId))).rsi, null);
});

test('RSI API accepts its account-bound challenge and consumes it after successful proof', async () => {
  const { store, bucket } = bucketFixture();
  await store.writeJson(getAccountObjectKey(accountId), createDefaultAccountRecord(user));
  const challenge = await createRsiVerificationChallenge(store, accountId, 'Citizen');
  const token = await createSessionToken(env, user, accountId);
  const originalFetch = globalThis.fetch;
  let lookups = 0;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/robertsspaceindustries\.com\/en\/citizens\/Citizen(?:\/organizations)?$/);
    lookups += 1;
    return new Response(`<div class="profile left-col"><span class="label">Handle name</span><strong class="value">Citizen</strong><div class="main-org right-col"><div class="bio">${challenge.code}</div>`);
  };
  try {
    const request = new Request('https://itemfab.space/api/auth/account/rsi-link', {
      method: 'POST', headers: { Cookie: `sc_craft_session=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: challenge.handle, code: challenge.code }),
    });
    const response = await handleRsiLinkRequest(request, { ...env, GAME_DATA_PROD: bucket });
    assert.equal(response.status, 200);
    const { account } = await response.json();
    assert.equal(account.rsi.verificationVersion, 2);
    assert.equal(account.rsi.verificationRequired, false);
    assert.ok(lookups > 0);
    await assert.rejects(requireRsiVerificationChallenge(store, accountId, challenge.handle, challenge.code), /Invalid or expired/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('auth JSON bodies are bounded even without Content-Length or with a forged small value', async () => {
  const { store, bucket } = bucketFixture();
  await store.writeJson(getAccountObjectKey(accountId), createDefaultAccountRecord(user));
  const token = await createSessionToken(env, user, accountId);
  for (const contentLength of [null, '1']) {
    const headers = new Headers({ Cookie: `sc_craft_session=${token}`, 'Content-Type': 'application/json' });
    if (contentLength) headers.set('Content-Length', contentLength);
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`{"handle":"${'x'.repeat(2 * 1024 * 1024)}"}`));
      controller.close();
    } });
    const response = await handleRsiLinkRequest(new Request('https://itemfab.space/api/auth/account/rsi-link', {
      method: 'POST', headers, body, duplex: 'half',
    }), { ...env, GAME_DATA_PROD: bucket });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /Request body too large/);
  }
});

test('legacy RSI links retain data but cannot authorize organization access or craft requests', async () => {
  const legacy = normalizeAccountRecord({ ...createDefaultAccountRecord(user), rsi: legacyLink, inventoryBlueprintIds: ['blueprint'], organizations: [{ sid: 'TEST', status: 'verified_member' }] });
  assert.equal(legacy.rsi.verificationRequired, true);
  assert.deepEqual(legacy.inventoryBlueprintIds, ['blueprint']);
  assert.equal(isRsiLinkRateLimited(legacy), false);
  assert.equal(normalizeRsiLink({ ...legacyLink, verificationVersion: 2 }).verificationRequired, false);
  assert.equal(normalizeRsiLink({ ...legacyLink, verificationProvider: 'citizenid' }).verificationRequired, false);
  const { store } = bucketFixture();
  await assert.rejects(buildOrganizationSharedBlueprints(store, legacy, 'TEST'), /Verify your RSI/);
  await assert.rejects(buildOrganizationSharedResources(store, legacy, 'TEST'), /Verify your RSI/);
  await assert.rejects(createOrganizationCraftRequest(store, legacy, { organizationSid: 'TEST', blueprintId: 'blueprint', ownerHandle: 'Owner' }), /Verify your RSI/);
});

test('a proven RSI owner can recover an untrusted legacy index without later legacy unlink deleting it', async () => {
  const { store } = bucketFixture();
  const old = { ...createDefaultAccountRecord(user), rsi: legacyLink };
  await store.writeJson(getAccountObjectKey(accountId), old);
  await store.writeJson('accounts-indexes/rsi-handles/citizen.json', { accountId });
  const owner = { id: '456', username: 'owner' };
  await store.writeJson(getAccountObjectKey('discord_456'), createDefaultAccountRecord(owner));
  await saveRsiAccountLink(store, 'discord_456', { ...legacyLink, verificationVersion: 2 }, owner);
  await clearRsiAccountLink(store, accountId, user);
  assert.equal(await readAccountIdByRsiHandle(store, 'Citizen'), 'discord_456');
});

test('a successful complete membership refresh revokes departed organizations including primary membership', async () => {
  const { store } = bucketFixture();
  const account = normalizeAccountRecord({ ...createDefaultAccountRecord(user), rsi: { ...legacyLink, verificationVersion: 2 },
    organizations: [{ sid: 'OLD', status: 'verified_member', source: 'profile-main' }],
  });
  await store.writeJson(getAccountObjectKey(accountId), account);
  const updated = await syncCitizenIdAccountOrganizations(store, account, [], { organizationsComplete: true });
  assert.equal(updated.organizations[0].status, 'observed');
  await assert.rejects(buildOrganizationSharedBlueprints(store, updated, 'OLD'), /Only verified organization members/);
});

test('incomplete or failed membership lookups do not revoke existing organizations', async () => {
  const { store } = bucketFixture();
  const account = normalizeAccountRecord({ ...createDefaultAccountRecord(user), rsi: { ...legacyLink, verificationVersion: 2 },
    organizations: [{ sid: 'OLD', status: 'verified_member', source: 'profile-main' }],
  });
  await store.writeJson(getAccountObjectKey(accountId), account);
  const originalFetch = globalThis.fetch;
  try {
    for (const incomplete of [false, true]) {
      globalThis.fetch = async (url) => {
        if (String(url).endsWith('/detail')) {
          if (!incomplete) throw new Error('temporary lookup failure');
          return new Response(JSON.stringify({ username: 'Citizen' }));
        }
        return new Response(JSON.stringify({ username: 'Citizen' }));
      };
      const data = await resolveCitizenIdAccountData({ access_token: 'provider-token' });
      assert.equal(Boolean(data.organizationsComplete), false);
      const updated = await syncCitizenIdAccountOrganizations(store, account, data.organizations, { organizationsComplete: data.organizationsComplete });
      assert.equal(updated.organizations[0].status, 'verified_member');
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ username: 'Citizen', orgs: [] }));
    assert.equal((await resolveCitizenIdAccountData({ access_token: 'provider-token' })).organizationsComplete, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('verified fresh roster absence revokes primary membership but metadata cannot revive legacy rosters', async () => {
  const { store } = bucketFixture();
  const account = normalizeAccountRecord({ ...createDefaultAccountRecord(user), rsi: { ...legacyLink, verificationVersion: 2 },
    organizations: [{ sid: 'OLD', status: 'verified_member', source: 'profile-main' }],
  });
  await store.writeJson(getAccountObjectKey(accountId), account);
  const organization = { ...createDefaultOrganizationRecord({ sid: 'OLD' }),
    memberSnapshot: [{ handle: 'OtherCitizen' }], memberSnapshotComplete: true,
    memberSnapshotVerifiedAt: new Date().toISOString(),
  };
  await store.writeJson(getOrganizationObjectKey('OLD'), organization);
  const updated = await syncAndDecorateAccountOrganizations(store, account);
  assert.equal(updated.organizations[0].status, 'observed');
  await assert.rejects(buildOrganizationSharedResources(store, account, 'OLD'), /no longer a member/);
  const legacyRoster = { ...organization, memberSnapshotVerifiedAt: null, memberSnapshotComplete: false };
  await store.writeJson(getOrganizationObjectKey('OLD'), legacyRoster);
  const metadataRefreshed = await upsertOrganizationMetadata(store, { sid: 'OLD', members: 500 });
  assert.equal(metadataRefreshed.syncStatus, 'fresh');
  assert.equal(getVerifiedOrganizationMemberSnapshot(metadataRefreshed), null);
});

test('desktop PKCE rejects intercepted codes and consumes exactly once under concurrent requests', async () => {
  const { store } = bucketFixture();
  const verifier = 'a'.repeat(64);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  await assert.rejects(createDesktopOAuthState(store, env, { flow: 'discord', callbackUrl: 'http://127.0.0.1:4567/callback' }), /PKCE/);
  const state = await createDesktopOAuthState(store, env, { flow: 'discord', callbackUrl: 'http://127.0.0.1:4567/callback', codeChallenge: challenge });
  assert.equal(await consumeDesktopOAuthState(store, env, state, 'citizenid'), null);
  const states = await Promise.all(Array.from({ length: 8 }, () => consumeDesktopOAuthState(store, env, state, 'discord')));
  assert.equal(states.filter(Boolean).length, 1);
  const code = await createDesktopExchangeCode(store, { codeChallenge: challenge, session: { user, accountId } });
  assert.equal(await consumeDesktopExchangeCode(store, code), null);
  assert.equal(await consumeDesktopExchangeCode(store, code, 'b'.repeat(64)), null);
  const results = await Promise.all(Array.from({ length: 8 }, () => consumeDesktopExchangeCode(store, code, verifier)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.find(Boolean).session.accountId, accountId);
});

test('S3 auth consumption fails closed on a lost conditional write', async () => {
  const calls = [];
  const client = { async send(command) {
    calls.push(command.input);
    if (command.constructor.name === 'GetObjectCommand') {
      return { ETag: 'original-etag', Body: { transformToString: async () => JSON.stringify({ value: 'code' }) } };
    }
    throw Object.assign(new Error('already consumed'), { name: 'PreconditionFailed' });
  } };
  assert.equal(await createS3AccountStore(client, 'test').consumeJson('auth/test'), null);
  assert.equal(calls[1].IfMatch, 'original-etag');
});

test('organization identifiers reject object key traversal and invalid URL input', () => {
  for (const value of ['../../accounts/admin', 'A/B', 'A\\B', 'A%2fB', 'A'.repeat(65)]) assert.equal(normalizeOrganizationSid(value), null);
  assert.equal(normalizeOrganizationSid('https://robertsspaceindustries.com/orgs/TEST'), 'TEST');
});
