import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as proxy } from '../functions/ingest/[[path]].js';
import { onRequest as apiMiddleware } from '../functions/api/_middleware.js';
import { getGameDataBucket } from '../functions/_shared/runtimeBuckets.js';
import { readBoundedBody } from '../functions/_shared/requestBody.js';
import { resolveAppBaseUrlFromRequest, resolveCraftRequestStorageScope } from '../shared/discordBotRelay.mjs';
import worker from '../workers/discord-bot/src/index.mjs';

const request = (path, init) => new Request(`https://itemfab.space${path}`, init);

test('analytics never forwards first-party credentials or relays upstream cookies', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://eu.i.posthog.com/i/v0/e/?ip=1');
    for (const name of ['authorization', 'cookie', 'cf-access-client-secret', 'cf-access-jwt-assertion', 'x-api-key', 'referer']) {
      assert.equal(init.headers.get(name), null, name);
    }
    assert.equal(init.headers.get('content-type'), 'application/json');
    assert.equal(init.redirect, 'manual');
    return new Response('{}', { headers: { 'set-cookie': 'bad=1', 'clear-site-data': '"*"' } });
  });
  const response = await proxy({ env: {}, request: request('/ingest/i/v0/e/?ip=1', {
    method: 'POST', body: '{}', headers: {
      authorization: 'Bearer fixture-session', cookie: 'session=fixture',
      'cf-access-client-secret': 'fixture-access', 'cf-access-jwt-assertion': 'fixture-jwt',
      'x-api-key': 'fixture-key', referer: 'https://itemfab.space/?code=private', 'content-type': 'application/json',
    },
  }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('clear-site-data'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('analytics fixes upstream hosts and rejects redirects, oversized uploads and unsafe methods', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.redirect('https://untrusted.example/script.js'));
  assert.equal((await proxy({ env: {}, request: request('/ingest/static/a.js') })).status, 502);
  fetchMock.mock.resetCalls();
  assert.equal((await proxy({ env: { POSTHOG_HOST: 'http://127.0.0.1' }, request: request('/ingest/e/') })).status, 503);
  assert.equal((await proxy({ env: {}, request: request('/ingest/e/', { method: 'DELETE' }) })).status, 405);
  assert.equal((await proxy({ env: {}, request: request('/ingest/%2f%2fevil') })).status, 400);
  assert.equal((await proxy({ env: {}, request: request('/ingest/e/', { method: 'POST', body: 'x'.repeat(5 * 1024 * 1024 + 1) }) })).status, 413);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('bounded bodies count streamed bytes even when length is absent or false', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    await assert.rejects(readBoundedBody(request('/body', { method: 'POST', body: '12345', headers }), 4), RangeError);
  }
  assert.equal(new TextDecoder().decode(await readBoundedBody(request('/body', { method: 'POST', body: '1234' }), 4)), '1234');
});

test('CORS varies all responses by origin and authenticated responses cannot be cached', async () => {
  for (const origin of ['https://tauri.localhost', 'https://untrusted.example']) {
    const response = await apiMiddleware({ request: request('/api/auth/session', { headers: { origin } }),
      next: async () => new Response('{}', { headers: { Vary: 'Accept', 'Cache-Control': 'public' } }),
    });
    assert.equal(response.headers.get('Vary'), 'Accept, Origin');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin.includes('tauri') ? origin : null);
  }
});

test('missing environment bucket never falls back to the other environment', () => {
  const prod = {}, dev = {};
  assert.equal(getGameDataBucket({ CF_PAGES_BRANCH: 'preview', GAME_DATA_PROD: prod }), null);
  assert.equal(getGameDataBucket({ CF_PAGES_BRANCH: 'production', GAME_DATA_DEV: dev }), null);
  assert.equal(getGameDataBucket({ CF_PAGES_BRANCH: 'preview', GAME_DATA_PROD: prod, GAME_DATA_DEV: dev }), dev);
  assert.equal(getGameDataBucket({ CF_PAGES_BRANCH: 'production', GAME_DATA_PROD: prod, GAME_DATA_DEV: dev }), prod);
});

async function signedPing(keyPair, timestamp, body = '{"type":1}') {
  const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, new TextEncoder().encode(timestamp + body));
  return request('/interactions', { method: 'POST', body, headers: {
    'x-signature-ed25519': Buffer.from(signature).toString('hex'), 'x-signature-timestamp': timestamp,
  } });
}

test('Discord accepts fresh signatures, rejects stale/future and malformed signatures, and rotates keys', async () => {
  const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const env = { DISCORD_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', keyPair.publicKey)).toString('hex') };
  const timestamp = String(Math.floor(Date.now() / 1000));
  assert.deepEqual(await (await worker.fetch(await signedPing(keyPair, timestamp), env)).json(), { type: 1 });
  for (const offset of [-600, 600]) {
    assert.equal((await worker.fetch(await signedPing(keyPair, String(Number(timestamp) + offset)), env)).status, 401);
  }
  const malformed = request('/interactions', { method: 'POST', body: '{}', headers: {
    'x-signature-ed25519': 'zz'.repeat(64), 'x-signature-timestamp': timestamp,
  } });
  assert.equal((await worker.fetch(malformed, env)).status, 401);
  const newPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const newEnv = { DISCORD_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', newPair.publicKey)).toString('hex') };
  assert.equal((await worker.fetch(await signedPing(keyPair, timestamp), newEnv)).status, 401);
  assert.equal((await worker.fetch(await signedPing(newPair, timestamp), newEnv)).status, 200);
});


test('Discord relay shares the API storage scope and ignores spoofed link origins', () => {
  const req = request('/api/auth/organizations/TEST/craft-requests', { headers: {
    Origin: 'https://attacker.example', Referer: 'https://attacker.example/trap',
  } });
  assert.equal(resolveAppBaseUrlFromRequest(req, {}), 'https://itemfab.space');
  assert.equal(resolveAppBaseUrlFromRequest(req, { APP_BASE_URL: 'https://preview.itemfab.pages.dev' }), 'https://preview.itemfab.pages.dev');
  assert.equal(resolveCraftRequestStorageScope(req, { CF_PAGES_BRANCH: 'main' }), 'dev');
  assert.equal(resolveCraftRequestStorageScope(req, { CF_PAGES_BRANCH: 'production' }), 'prod');
  assert.equal(resolveCraftRequestStorageScope({ url: '/api/auth/account' }, { CF_PAGES_BRANCH: '' }), 'dev');
});


test('analytics routes static SDK and JSON remote configuration to the assets host', async (t) => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(url); return new Response('{}'); });
  for (const path of ['/static/array.js', '/array/public-project-key/config']) {
    assert.equal((await proxy({ env: {}, request: request(`/ingest${path}`) })).status, 200);
    assert.equal(urls.at(-1), `https://eu-assets.i.posthog.com${path}`);
  }
});
