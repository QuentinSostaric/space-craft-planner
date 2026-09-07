import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBucketAccountStore, createS3AccountStore, upsertDiscordAccount, saveRsiAccountLink,
  readScopedAccountRecord, saveAccountState, saveAccountInventoryResources,
  clearRsiAccountLink, deleteAccountRecord, copyLiveAccountScopeToPtu,
  saveAccountOnboardingState,
} from '../shared/accountStorage.mjs';
import {
  updateMarketplaceSelection, listMarketplaceMembers, createMarketplaceCraftRequest,
  updateMarketplaceBlock, reportMarketplaceProvider, listMarketplaceReports, moderateMarketplaceReport,
} from '../shared/marketplaceService.mjs';
import { marketplaceAccountKey, marketplaceIndexPrefix, normalizeMarketplaceSelection } from '../shared/marketplaceStorage.mjs';
import { respondToCraftRequest, deleteCraftRequest } from '../shared/craftRequestService.mjs';
import { createSessionToken } from '../shared/discordAuth.mjs';
import { dispatchAccountRoute } from '../functions/_shared/accountRouter.js';

const now = '2026-09-07T12:00:00.000Z';
const emptyPlanner = { goals: [], todoItems: [], resourceRequirements: {}, resourceProgress: {} };

function fixture() {
  const records = new Map();
  const lists = [];
  const reads = [];
  let etag = 0;
  const bucket = {
    async get(key) {
      reads.push(key);
      const record = records.get(key);
      return record ? { etag: record.etag, text: async () => record.body } : null;
    },
    async put(key, body, options = {}) {
      const existing = records.get(key);
      if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== existing?.etag) return null;
      if (options.onlyIf?.etagDoesNotMatch === '*' && existing) return null;
      const record = { body, etag: String(++etag) };
      records.set(key, record);
      return { etag: record.etag };
    },
    async delete(key) { records.delete(key); },
    async list({ prefix, cursor, limit = 1000 }) {
      lists.push({ prefix, cursor, limit });
      assert.ok(!prefix.startsWith('accounts/'), 'Directory must never scan accounts');
      const after = cursor ? Buffer.from(cursor, 'base64url').toString() : '';
      const keys = [...records.keys()].filter(key => key.startsWith(prefix) && key > after).sort();
      const selected = keys.slice(0, limit);
      return { objects: selected.map(key => ({ key })), truncated: keys.length > limit, cursor: keys.length > limit ? Buffer.from(selected.at(-1)).toString('base64url') : undefined };
    },
  };
  return { store: createBucketAccountStore(bucket), records, lists, reads };
}

async function seed(store, id, handle = `Citizen${id}`, { verified = true } = {}) {
  const profile = { id, username: `private-discord-${id}`, displayName: `Private Discord ${id}`, avatarUrl: 'https://cdn.discordapp.com/private-avatar.png' };
  let account = await upsertDiscordAccount(store, profile);
  if (verified) account = await saveRsiAccountLink(store, account.accountId, { handle, displayName: `Public ${handle}`, verifiedAt: now, verificationProvider: 'citizenid' }, profile);
  await saveAccountState(store, account.accountId, { favoriteBlueprintIds: ['private-favorite'], inventoryBlueprintIds: ['blueprint-a', 'blueprint-b'], planner: emptyPlanner }, profile);
  await saveAccountInventoryResources(store, account.accountId, [
    { id: 'iron-lot', resourceId: 'iron', resourceName: 'Iron', quantity: 1.234567, quantityUnit: 'scu', quality: 700, createdAt: now, updatedAt: now },
    { id: 'private-lot', resourceId: 'copper', resourceName: 'Private Copper', quantity: 2, quantityUnit: 'scu', quality: null },
  ], profile);
  return readScopedAccountRecord(store, account.accountId);
}
const publish = (store, actor, scope = 'live') => updateMarketplaceSelection(store, actor, { enabled: true, blueprintIds: ['blueprint-a'], resourceEntryIds: ['iron-lot'] }, scope);
const reload = (store, account, scope = 'live') => readScopedAccountRecord(store, account.accountId, null, scope);
const requestPayload = (owner, patch = {}) => ({ ownerHandle: owner.rsi.handle, blueprintId: 'blueprint-a', ...patch });

async function api(store, actor, path, method = 'GET', body) {
  const env = { AUTH_SESSION_SECRET: 'test-only-marketplace-secret', AUTH_PUBLIC_ORIGIN: 'https://itemfab.space', ACCOUNT_STORE: store };
  const token = actor ? await createSessionToken(env, actor.profile, actor.accountId) : null;
  return dispatchAccountRoute(new Request('https://itemfab.space' + path, {
    method, headers: { ...(token ? { Cookie: `sc_craft_session=${token}` } : {}), Origin: 'https://itemfab.space', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
}

test('marketplace starts private, publishes explicit stock, and never exposes private account fields', async () => {
  const { store } = fixture();
  const owner = await seed(store, '101');
  const viewer = await seed(store, '102');
  assert.equal(owner.marketplace.enabled, false);
  assert.deepEqual((await listMarketplaceMembers(store, viewer)).members, []);
  await publish(store, owner);
  const listing = await listMarketplaceMembers(store, viewer);
  assert.equal(listing.members.length, 1);
  assert.deepEqual(listing.members[0].sharedBlueprintIds, ['blueprint-a']);
  assert.deepEqual(listing.members[0].sharedResources.map(entry => entry.id), ['iron-lot']);
  assert.equal(listing.members[0].sharedResources[0].quantity, 1.234567);
  assert.deepEqual(Object.keys(listing.members[0]).sort(), ['display', 'handle', 'profileUrl', 'sharedBlueprintIds', 'sharedResources', 'updatedAt'].sort());
  const serialized = JSON.stringify(listing);
  for (const secret of ['discord_', 'Private Discord', 'private-discord', 'discordapp', 'private-favorite', 'private-lot', 'Private Copper', 'organizations', 'createdAt', 'accountId']) assert.ok(!serialized.includes(secret), secret);
});

test('publication validates identities, ownership, bounds and allows unverified withdrawal', async () => {
  const { store } = fixture();
  const owner = await seed(store, '101');
  const unverified = await seed(store, '102', 'Legacy', { verified: false });
  await assert.rejects(publish(store, unverified), { status: 403 });
  await assert.rejects(listMarketplaceMembers(store, unverified), { status: 403 });
  await assert.rejects(updateMarketplaceSelection(store, owner, { enabled: true, blueprintIds: ['not-owned'], resourceEntryIds: [] }), { status: 400 });
  await assert.rejects(updateMarketplaceSelection(store, owner, { enabled: true, blueprintIds: Array(501).fill('blueprint-a'), resourceEntryIds: [] }), { status: 400 });
  const manyBlueprints = Array.from({ length: 300 }, (_, index) => `blueprint-${index}`);
  const manyResources = Array.from({ length: 101 }, (_, index) => ({ id: `lot-${index}` }));
  await assert.rejects(updateMarketplaceSelection(store, owner, { enabled: true, blueprintIds: manyBlueprints, resourceEntryIds: manyResources.map(entry => entry.id) }), /400.*combined/);
  const normalized = normalizeMarketplaceSelection({ blueprintIds: manyBlueprints, resourceEntryIds: manyResources.map(entry => entry.id) }, manyBlueprints, manyResources);
  assert.equal(normalized.blueprintIds.length + normalized.resourceEntryIds.length, 400);
  await updateMarketplaceSelection(store, unverified, { enabled: false });
  await publish(store, owner);
  await updateMarketplaceSelection(store, owner, { enabled: false, blueprintIds: ['stale-deleted-id'], resourceEntryIds: [] });
  assert.deepEqual((await listMarketplaceMembers(store, owner)).members, []);
});

test('listing pagination and asset lookup read only dedicated indexes and a bounded page', async () => {
  const { store, lists, reads } = fixture();
  const viewer = await seed(store, '100');
  for (const id of ['101', '102', '103']) await publish(store, await seed(store, id));
  reads.length = 0;
  const first = await listMarketplaceMembers(store, viewer, { limit: 2 });
  assert.equal(first.members.length, 2);
  assert.ok(first.nextCursor);
  const second = await listMarketplaceMembers(store, viewer, { limit: 2, cursor: first.nextCursor });
  assert.equal(second.members.length, 1);
  assert.equal(new Set([...first.members, ...second.members].map(member => member.handle)).size, 3);
  assert.equal(second.nextCursor, null);
  assert.equal(lists.at(-1).limit, 2);
  assert.ok(lists.every(call => call.prefix.startsWith('marketplace/index/live/')));
  const resources = await listMarketplaceMembers(store, viewer, { resourceId: 'iron' });
  assert.equal(resources.members.length, 3);
  assert.deepEqual(resources.members[0].sharedBlueprintIds, []);
  assert.ok(lists.at(-1).prefix.includes('/resources/iron/'));
  assert.ok(reads.filter(key => key.startsWith('accounts/')).length < 25);
  await assert.rejects(listMarketplaceMembers(store, viewer, { limit: 51 }), { status: 400 });
  assert.equal((await listMarketplaceMembers(store, viewer, { blueprintId: 'blueprint-a', ownerHandle: 'Citizen101' })).members.length, 1);
  assert.equal((await listMarketplaceMembers(store, viewer, { blueprintId: 'blueprint-b', ownerHandle: 'Citizen101' })).members.length, 0);
  await assert.rejects(listMarketplaceMembers(store, viewer, { blueprintId: 'blueprint-a', resourceId: 'iron' }), { status: 400 });
});

test('scope isolation, inventory pruning, unlink and deletion hide listings even with stale indexes', async () => {
  const { store, records } = fixture();
  let owner = await seed(store, '101');
  const viewer = await seed(store, '102');
  owner = await publish(store, owner);
  assert.deepEqual((await listMarketplaceMembers(store, viewer, { datasetScope: 'ptu' })).members, []);
  const copied = await copyLiveAccountScopeToPtu(store, owner.accountId);
  assert.equal(copied.marketplace.enabled, false);
  assert.deepEqual(copied.marketplace.blueprintIds, []);
  await publish(store, copied, 'ptu');
  await saveAccountState(store, owner.accountId, { inventoryBlueprintIds: ['blueprint-b'], favoriteBlueprintIds: [], planner: emptyPlanner }, owner.profile);
  await saveAccountInventoryResources(store, owner.accountId, [], owner.profile);
  assert.deepEqual((await listMarketplaceMembers(store, viewer)).members, []);
  assert.equal((await listMarketplaceMembers(store, viewer, { datasetScope: 'ptu' })).members.length, 1);
  const index = marketplaceIndexPrefix('ptu') + await marketplaceAccountKey(owner.accountId) + '.json';
  const oldRecord = records.get(index);
  await clearRsiAccountLink(store, owner.accountId);
  assert.equal((await reload(store, owner, 'ptu')).marketplace.enabled, false);
  records.set(index, oldRecord); // Simulate a failed cleanup: projection must fail closed.
  assert.deepEqual((await listMarketplaceMembers(store, viewer, { datasetScope: 'ptu' })).members, []);
  await deleteAccountRecord(store, owner.accountId);
  records.set(index, oldRecord);
  assert.deepEqual((await listMarketplaceMembers(store, viewer, { datasetScope: 'ptu' })).members, []);
});

test('community requests persist both sides and reuse the owner/requester lifecycle without fake organizations', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const requester = await seed(store, '102');
  const result = await createMarketplaceCraftRequest(store, requester, requestPayload(owner, { comment: 'Please craft this.', resourcesOption: 'has_resources' }));
  assert.equal(result.request.source, 'community');
  assert.equal(result.request.organizationSid, null);
  assert.equal(result.request.organizationName, null);
  assert.equal((await reload(store, owner)).incomingCraftRequests[0].id, result.request.id);
  assert.equal((await reload(store, requester)).outgoingCraftRequests[0].source, 'community');
  await assert.rejects(respondToCraftRequest(store, await reload(store, requester), result.request.id, 'accepted'), { status: 403 });
  const accepted = await respondToCraftRequest(store, await reload(store, owner), result.request.id, 'accepted');
  assert.equal(accepted.status, 'accepted');
  assert.equal((await reload(store, requester)).outgoingCraftRequests[0].status, 'accepted');
  await assert.rejects(createMarketplaceCraftRequest(store, requester, requestPayload(owner)), { status: 409 });
  await respondToCraftRequest(store, await reload(store, requester), result.request.id, 'closed');
  await deleteCraftRequest(store, await reload(store, owner), result.request.id);
  assert.deepEqual((await reload(store, requester)).outgoingCraftRequests, []);
});

test('requests reject self, duplicate, unlisted stock, oversized text, rate abuse and cross-scope offers', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const requester = await seed(store, '102');
  await assert.rejects(createMarketplaceCraftRequest(store, owner, requestPayload(owner)), { status: 400 });
  await assert.rejects(createMarketplaceCraftRequest(store, requester, requestPayload(owner, { blueprintId: 'blueprint-b' })), { status: 409 });
  await assert.rejects(createMarketplaceCraftRequest(store, requester, requestPayload(owner, { comment: 'x'.repeat(1001) })), { status: 400 });
  await assert.rejects(createMarketplaceCraftRequest(store, requester, requestPayload(owner), { datasetScope: 'ptu' }), { status: 409 });
  const concurrent = await Promise.allSettled([createMarketplaceCraftRequest(store, requester, requestPayload(owner)), createMarketplaceCraftRequest(store, requester, requestPayload(owner))]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await reload(store, owner)).incomingCraftRequests.length, 1);
  for (let i = 0; i < 9; i += 1) {
    const current = await reload(store, requester);
    const last = current.outgoingCraftRequests.find(request => request.status === 'pending');
    if (last) await respondToCraftRequest(store, current, last.id, 'closed');
    await createMarketplaceCraftRequest(store, await reload(store, requester), requestPayload(owner));
  }
  const current = await reload(store, requester);
  await respondToCraftRequest(store, current, current.outgoingCraftRequests.find(request => request.status === 'pending').id, 'closed');
  await assert.rejects(createMarketplaceCraftRequest(store, await reload(store, requester), requestPayload(owner)), { status: 429 });
});

test('blocks are account-wide, hide providers in both directions, stop requests, and can be removed', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const viewer = await publish(store, await seed(store, '102'));
  let blocked = await updateMarketplaceBlock(store, viewer, { handle: owner.rsi.handle, blocked: true });
  assert.deepEqual(blocked.marketplace.blockedHandles, [owner.rsi.handle]);
  assert.deepEqual((await reload(store, viewer, 'ptu')).marketplace.blockedHandles, [owner.rsi.handle]);
  assert.ok(!(await listMarketplaceMembers(store, blocked)).members.some(member => member.handle === owner.rsi.handle));
  assert.ok(!(await listMarketplaceMembers(store, owner)).members.some(member => member.handle === viewer.rsi.handle));
  await assert.rejects(createMarketplaceCraftRequest(store, viewer, requestPayload(owner)), { status: 403 });
  await assert.rejects(createMarketplaceCraftRequest(store, owner, requestPayload(viewer)), { status: 403 });
  blocked = await updateMarketplaceBlock(store, viewer, { handle: owner.rsi.handle, blocked: false });
  assert.deepEqual(blocked.marketplace.blockedHandles, []);
  await createMarketplaceCraftRequest(store, blocked, requestPayload(owner));
});

test('bounded reports require admin moderation; suspension hides offers and restore never republishes', async () => {
  const { store } = fixture();
  let owner = await publish(store, await seed(store, '101'));
  const reporter = await seed(store, '102', 'Unverified', { verified: false });
  const admin = await seed(store, '183946313669410816');
  assert.equal(admin.isAdmin, true);
  await assert.rejects(reportMarketplaceProvider(store, reporter, { ownerHandle: owner.rsi.handle, reason: 'free-text' }), { status: 400 });
  const report = await reportMarketplaceProvider(store, reporter, { ownerHandle: owner.rsi.handle, reason: 'misleading', text: 'not stored' });
  await assert.rejects(listMarketplaceReports(store, reporter), { status: 403 });
  await assert.rejects(moderateMarketplaceReport(store, reporter, report.id, { action: 'suspend' }), { status: 403 });
  const reports = await listMarketplaceReports(store, admin);
  assert.equal(reports.reports[0].reporterHandle, null);
  assert.ok(!JSON.stringify(reports).includes('not stored'));
  await moderateMarketplaceReport(store, admin, report.id, { action: 'suspend' });
  assert.deepEqual((await listMarketplaceMembers(store, admin)).members, []);
  await assert.rejects(publish(store, owner), { status: 403 });
  await moderateMarketplaceReport(store, admin, report.id, { action: 'restore' });
  owner = await reload(store, owner);
  assert.equal(owner.marketplace.enabled, false);
  await publish(store, owner);
  assert.equal((await listMarketplaceMembers(store, admin)).members.length, 1);
});

test('shared Node/Pages routing enforces authentication, CSRF, JSON bounds and scope for Account/marketplace', async () => {
  const { store } = fixture();
  const owner = await seed(store, '101');
  assert.equal((await api(store, null, '/api/auth/marketplace')).status, 401);
  const response = await api(store, owner, '/api/auth/account/marketplace', 'PUT', { enabled: true, blueprintIds: ['blueprint-a'], resourceEntryIds: [] });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).account.marketplace.enabled, true);
  const ptu = await api(store, owner, '/api/auth/account?datasetScope=ptu');
  assert.equal((await ptu.json()).account.datasetScope, 'ptu');
  const copied = await api(store, owner, '/api/auth/account/copy-live-to-ptu', 'POST');
  assert.equal(copied.status, 200);
  const copiedAccount = (await copied.json()).account;
  assert.equal(copiedAccount.datasetScope, 'ptu');
  assert.equal(copiedAccount.marketplace.enabled, false);
  const result = await api(store, owner, '/api/auth/account?datasetScope=ptu', 'PUT', { inventoryBlueprintIds: ['ptu-only'], favoriteBlueprintIds: [], planner: emptyPlanner });
  assert.equal((await result.json()).account.datasetScope, 'ptu');
  assert.deepEqual((await reload(store, owner)).inventoryBlueprintIds, ['blueprint-a', 'blueprint-b']);
  assert.equal((await api(store, owner, '/api/auth/marketplace?datasetScope=other')).status, 400);
  const env = { AUTH_SESSION_SECRET: 'test-only-marketplace-secret', ACCOUNT_STORE: store };
  const token = await createSessionToken(env, owner.profile, owner.accountId);
  assert.equal((await dispatchAccountRoute(new Request('https://itemfab.space/api/auth/account/marketplace', { method: 'PUT', headers: { Cookie: `sc_craft_session=${token}`, Origin: 'https://evil.example' }, body: '{}' }), env)).status, 403);
  assert.equal((await api(store, owner, '/api/auth/account/marketplace', 'PUT', { padding: 'x'.repeat(1024 * 1024 + 1) })).status, 400);
});

test('S3 marketplace pagination stays bounded and atomic updates use conditional creation', async () => {
  const commands = [];
  const store = createS3AccountStore({ send: async (command) => {
    commands.push(command);
    if (command.constructor.name === 'GetObjectCommand') { const error = new Error('missing'); error.name = 'NoSuchKey'; throw error; }
    if (command.constructor.name === 'ListObjectsV2Command') return { Contents: [{ Key: 'marketplace/index/live/members/a.json' }], IsTruncated: true, NextContinuationToken: 'next' };
    return {};
  } }, 'test-bucket');
  assert.deepEqual(await store.listJsonPage('marketplace/index/live/members/', { limit: 3 }), { keys: ['marketplace/index/live/members/a.json'], nextCursor: 'next' });
  assert.equal(commands[0].input.MaxKeys, 3);
  await store.updateJsonAtomically('lock', () => ({ token: 'owner' }));
  assert.equal(commands.at(-1).input.IfNoneMatch, '*');
});

test('republishing identical choices repairs interrupted indexes, and account deletion cleans their manifests', async () => {
  const { store, records } = fixture();
  const owner = await seed(store, '101');
  const viewer = await seed(store, '102');
  const writeJson = store.writeJson;
  store.writeJson = async (key, payload) => {
    if (key.startsWith('marketplace/index/live/members/')) throw new Error('Interrupted index write');
    return writeJson(key, payload);
  };
  await assert.rejects(publish(store, owner), /Interrupted index write/);
  assert.equal((await reload(store, owner)).marketplace.enabled, true);
  store.writeJson = writeJson;
  await publish(store, await reload(store, owner));
  assert.equal((await listMarketplaceMembers(store, viewer)).members.length, 1);
  const ownerHash = await marketplaceAccountKey(owner.accountId);
  assert.ok([...records.keys()].some(key => key.startsWith('marketplace/manifests/') && key.includes(ownerHash)));
  await deleteAccountRecord(store, owner.accountId);
  assert.ok(![...records.keys()].some(key => key.startsWith('marketplace/index/') && key.includes(ownerHash)));
  assert.ok(![...records.keys()].some(key => key.startsWith('marketplace/manifests/') && key.includes(ownerHash)));
});

test('account deletion removes provider reports and inbound blocks and erases a reporters identity without losing moderation', async () => {
  const { store, records } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const reporter = await seed(store, '102');
  const admin = await seed(store, '183946313669410816');
  await updateMarketplaceBlock(store, reporter, { handle: owner.rsi.handle, blocked: true });
  const report = await reportMarketplaceProvider(store, reporter, { ownerHandle: owner.rsi.handle, reason: 'abuse' });
  await deleteAccountRecord(store, reporter.accountId);
  const reports = await listMarketplaceReports(store, admin);
  assert.equal(reports.reports[0].id, report.id);
  assert.equal(reports.reports[0].reporterHandle, null);
  assert.equal((await store.readJson(`marketplace/reports/${report.id}.json`)).reporterAccountId, null);
  const reporterHash = await marketplaceAccountKey(reporter.accountId);
  assert.ok(![...records.keys()].some(key => key.startsWith('marketplace/') && key.includes(reporterHash)));
  const other = await seed(store, '103');
  await updateMarketplaceBlock(store, other, { handle: owner.rsi.handle, blocked: true });
  await moderateMarketplaceReport(store, admin, report.id, { action: 'suspend' });
  await deleteAccountRecord(store, owner.accountId);
  assert.deepEqual((await reload(store, other)).marketplace.blockedHandles, []);
  assert.deepEqual((await listMarketplaceReports(store, admin)).reports, []);
  const ownerHash = await marketplaceAccountKey(owner.accountId);
  assert.ok(![...records.keys()].some(key => key.startsWith('marketplace/') && key.includes(ownerHash)));
});

function pauseNextScopeWrite(store, prefix = 'account-scopes/') {
  const atomicUpdate = store.updateJsonAtomically;
  let release;
  let reached;
  let pause = true;
  const blocked = new Promise(resolve => { reached = resolve; });
  const resumed = new Promise(resolve => { release = resolve; });
  store.updateJsonAtomically = (key, updater) => atomicUpdate(key, async current => {
    const next = await updater(current);
    if (pause && key.startsWith(prefix)) {
      pause = false;
      reached();
      await resumed;
    }
    return next;
  });
  return { blocked, release, restore: () => { store.updateJsonAtomically = atomicUpdate; } };
}

test('concurrent inventory writes cannot undo withdrawal and publication cannot restore removed stock', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const viewer = await seed(store, '102');
  let gate = pauseNextScopeWrite(store, 'marketplace/locks/');
  const inventorySave = saveAccountInventoryResources(store, owner.accountId, owner.inventoryResources.map(entry => ({ ...entry, quantity: 3 })), owner.profile);
  await gate.blocked;
  await updateMarketplaceSelection(store, owner, { enabled: false });
  gate.release();
  await inventorySave;
  gate.restore();
  assert.equal((await reload(store, owner)).marketplace.enabled, false);
  assert.deepEqual((await listMarketplaceMembers(store, viewer, { ownerHandle: owner.rsi.handle })).members, []);
  gate = pauseNextScopeWrite(store);
  const publication = publish(store, await reload(store, owner));
  await gate.blocked;
  await assert.rejects(saveAccountInventoryResources(store, owner.accountId, [], owner.profile), { status: 409 });
  gate.release();
  await publication;
  gate.restore();
  await saveAccountInventoryResources(store, owner.accountId, [], owner.profile);
  const current = await reload(store, owner);
  assert.deepEqual(current.inventoryResources, []);
  assert.deepEqual(current.marketplace.resourceEntryIds, []);
});

test('consent stays bound to its RSI identity even when identity-change cleanup fails', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const viewer = await seed(store, '102');
  const atomicUpdate = store.updateJsonAtomically;
  store.updateJsonAtomically = (key, updater) => {
    if (key.startsWith('account-scopes/')) throw new Error('Interrupted identity cleanup');
    return atomicUpdate(key, updater);
  };
  await assert.rejects(saveRsiAccountLink(store, owner.accountId, { handle: 'NewIdentity', displayName: 'New Identity', verifiedAt: now, verificationProvider: 'citizenid' }), /Interrupted identity cleanup/);
  store.updateJsonAtomically = atomicUpdate;
  assert.equal((await reload(store, owner)).rsi.handle, 'NewIdentity');
  assert.deepEqual((await listMarketplaceMembers(store, viewer)).members, []);
  assert.deepEqual((await listMarketplaceMembers(store, viewer, { ownerHandle: 'NewIdentity' })).members, []);
  const accountResponse = await api(store, owner, '/api/auth/account');
  assert.equal((await accountResponse.json()).account.marketplace.enabled, false);
  // Returning to the same handle after a failed unlink must not reactivate
  // consent from an earlier verification lifecycle either.
  await publish(store, await reload(store, owner));
  store.updateJsonAtomically = (key, updater) => {
    if (key.startsWith('account-scopes/')) throw new Error('Interrupted identity cleanup');
    return atomicUpdate(key, updater);
  };
  await assert.rejects(clearRsiAccountLink(store, owner.accountId), /Interrupted identity cleanup/);
  await assert.rejects(saveRsiAccountLink(store, owner.accountId, { handle: 'NewIdentity', displayName: 'New Identity', verifiedAt: now, verificationProvider: 'citizenid' }), /Interrupted identity cleanup/);
  store.updateJsonAtomically = atomicUpdate;
  assert.deepEqual((await listMarketplaceMembers(store, viewer)).members, []);
});

test('community API and Account lifecycle expose no other participant Discord ID or private safety data', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const requester = await seed(store, '102');
  const created = await api(store, requester, '/api/auth/marketplace/craft-requests', 'POST', requestPayload(owner));
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  const requestId = createdBody.request.id;
  assert.equal(createdBody.request.requesterAccountId, requester.accountId);
  assert.equal(createdBody.request.ownerAccountId, `community:owner:${requestId}`);
  assert.ok(!JSON.stringify(createdBody).includes(owner.accountId));
  const ownerResponse = await api(store, owner, '/api/auth/account');
  const ownerBody = await ownerResponse.json();
  assert.equal(ownerBody.account.incomingCraftRequests[0].ownerAccountId, owner.accountId);
  assert.equal(ownerBody.account.incomingCraftRequests[0].requesterAccountId, `community:requester:${requestId}`);
  assert.ok(!JSON.stringify(ownerBody).includes(requester.accountId));
  assert.ok(!JSON.stringify(ownerBody).includes('identityHandle'));
  assert.ok(!JSON.stringify(ownerBody).includes('marketplaceBlockedAccounts'));
  const decision = await api(store, owner, `/api/auth/craft-requests/${requestId}`, 'POST', { decision: 'accepted' });
  assert.equal(decision.status, 200);
  assert.ok(!(await decision.text()).includes(requester.accountId));
  assert.equal((await reload(store, owner)).incomingCraftRequests[0].requesterAccountId, requester.accountId, 'Storage retains IDs for authorization');
});

test('unexpected marketplace storage errors return generic 500 without internal information', async () => {
  const { store } = fixture();
  const actor = await seed(store, '101');
  store.listJsonPage = () => { throw new Error('Private R2 bucket and credential details'); };
  const response = await api(store, actor, '/api/auth/marketplace');
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.ok(!body.includes('Private R2'));
  assert.ok(body.includes('Please try again'));
});

test('a stale inventory snapshot preserves a community request created before its write', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const requester = await seed(store, '102');
  const gate = pauseNextScopeWrite(store, 'marketplace/locks/');
  const saving = saveAccountInventoryResources(store, owner.accountId, owner.inventoryResources.map(entry => ({ ...entry, quantity: 7 })));
  await gate.blocked;
  const created = await createMarketplaceCraftRequest(store, requester, requestPayload(owner));
  gate.release();
  await saving;
  gate.restore();
  const current = await reload(store, owner);
  assert.equal(current.incomingCraftRequests[0].id, created.request.id);
  assert.equal(current.inventoryResources[0].quantity, 7);
});

test('stale onboarding writes preserve newer blocks and RSI unlink state', async () => {
  const { store } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const viewer = await seed(store, '102');
  const gate = pauseNextScopeWrite(store, 'marketplace/locks/');
  const saving = saveAccountOnboardingState(store, viewer.accountId, viewer.profile, { completed: true });
  await gate.blocked;
  await updateMarketplaceBlock(store, viewer, { handle: owner.rsi.handle, blocked: true });
  await clearRsiAccountLink(store, viewer.accountId);
  gate.release();
  await saving;
  gate.restore();
  const current = await reload(store, viewer);
  assert.deepEqual(current.marketplace.blockedHandles, [owner.rsi.handle]);
  assert.equal(current.rsi, null);
  assert.ok(current.onboardingCompletedAt);
});

test('account deletion and report creation share participant locks so purged reports cannot reappear', async () => {
  const { store, records } = fixture();
  const owner = await publish(store, await seed(store, '101'));
  const reporter = await seed(store, '102');
  const writeJson = store.writeJson;
  let reached;
  let resume;
  const blocked = new Promise(resolve => { reached = resolve; });
  const resumed = new Promise(resolve => { resume = resolve; });
  store.writeJson = async (key, payload) => {
    if (key.startsWith('marketplace/reports/')) { reached(); await resumed; }
    return writeJson(key, payload);
  };
  const pending = reportMarketplaceProvider(store, reporter, { ownerHandle: owner.rsi.handle, reason: 'spam' });
  await blocked;
  await assert.rejects(deleteAccountRecord(store, owner.accountId), { status: 409 });
  resume();
  const report = await pending;
  store.writeJson = writeJson;
  await deleteAccountRecord(store, owner.accountId);
  assert.equal(await store.readJson(`marketplace/reports/${report.id}.json`), null);
  assert.ok(![...records.keys()].some(key => key.startsWith('marketplace/report-participants/') && key.includes(report.id)));
});

test('publishers see their own valid offers on the first page regardless of index order', async () => {
  const { store } = fixture();
  const owner = await seed(store, '501');
  await publish(store, owner);
  const other = await seed(store, '502');
  await publish(store, other);
  const paged = { ...store, listJsonPage: async () => ({ keys: [], nextCursor: 'later' }) };
  const first = await listMarketplaceMembers(paged, owner);
  assert.equal(first.members.length, 1);
  assert.equal(first.members[0].handle, owner.rsi.handle);
  assert.deepEqual(first.members[0].sharedBlueprintIds, ['blueprint-a']);
  assert.equal(first.members[0].sharedResources[0].id, 'iron-lot');
  assert.equal((await listMarketplaceMembers(store, owner)).members.filter(member => member.handle === owner.rsi.handle).length, 1);
  assert.deepEqual((await listMarketplaceMembers(paged, owner, { blueprintId: 'blueprint-b' })).members, []);
  assert.deepEqual((await listMarketplaceMembers(paged, owner, { cursor: 'later' })).members, []);
  await updateMarketplaceSelection(store, owner, { enabled: false });
  assert.deepEqual((await listMarketplaceMembers(paged, owner)).members, []);
});
