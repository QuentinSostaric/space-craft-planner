import {
  normalizeAccountDatasetScope, readAccountIdByRsiHandle, readAccountRecord,
  readScopedAccountRecord, saveAccountMarketplaceSelection, saveAccountMarketplaceBlocks,
} from './accountStorage.mjs';
import { persistNewCraftRequest } from './craftRequestService.mjs';
import { isVerifiedRsiLink } from './rsiLink.mjs';
import {
  MARKETPLACE_BLOCK_LIMIT, MARKETPLACE_SELECTION_LIMIT, areMarketplaceAccountsBlocked,
  marketplaceAccountKey, marketplaceIndexPrefix, marketplaceSuspensionKey,
  marketplaceBlockedByKey, marketplaceReportParticipantKey,
  normalizeMarketplaceBlocks, normalizeMarketplaceSelection, syncMarketplaceIndexes, hasMarketplaceConsent, MarketplaceError, withMarketplaceAccountLocks,
} from './marketplaceStorage.mjs';

const REPORT_REASONS = new Set(['spam', 'misleading', 'abuse']);
const REPORT_PREFIX = 'marketplace/reports/';
const MAX_REQUESTS_PER_HOUR = 10;
const MAX_PENDING_REQUESTS = 30;

export { MarketplaceError } from './marketplaceStorage.mjs';

function text(value, name, max = 200, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new MarketplaceError(400, `${name} is invalid.`);
  }
  return value.trim();
}

function rsiHandle(value, required = true) {
  const handle = text(value, 'RSI handle', 64, required);
  if (handle && !/^[a-z0-9_-]+$/i.test(handle)) throw new MarketplaceError(400, 'RSI handle contains unsupported characters.');
  return handle;
}

function assertAuthenticated(account) {
  if (!account?.accountId) throw new MarketplaceError(401, 'Authentication required.');
}

async function assertVerified(store, account) {
  assertAuthenticated(account);
  if (!isVerifiedRsiLink(account.rsi)) throw new MarketplaceError(403, 'Verify your RSI identity to access the marketplace.');
  if ((await store.readJson(await marketplaceSuspensionKey(account.accountId)))?.suspended) {
    throw new MarketplaceError(403, 'Marketplace access is suspended for this account.');
  }
}

function pageOptions({ limit = 20, cursor = null } = {}) {
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) throw new MarketplaceError(400, 'Page size must be between 1 and 50.');
  if (cursor != null && (typeof cursor !== 'string' || cursor.length > 2048 || !/^[\x20-\x7e]*$/.test(cursor))) throw new MarketplaceError(400, 'Pagination cursor is invalid.');
  return { limit: parsedLimit, cursor: cursor || null };
}

function selectionArray(value, name) {
  if (!Array.isArray(value) || value.length > MARKETPLACE_SELECTION_LIMIT) throw new MarketplaceError(400, `${name} must contain at most ${MARKETPLACE_SELECTION_LIMIT} entries.`);
  return [...new Set(value.map(entry => text(entry, name)))];
}

async function reserveRate(store, accountId, action, limit, windowMs) {
  const key = `marketplace/rates/${action}/${await marketplaceAccountKey(accountId)}.json`;
  await store.updateJsonAtomically(key, current => {
    const now = Date.now();
    const timestamps = Array.isArray(current?.timestamps) ? current.timestamps.filter(value => Number.isFinite(value) && value > now - windowMs) : [];
    if (timestamps.length >= limit) throw new MarketplaceError(429, `Too many ${action}. Please try again later.`);
    return { timestamps: [...timestamps, now] };
  });
}

function projectMember(account, filter = {}) {
  const selection = normalizeMarketplaceSelection(account.marketplace, account.inventoryBlueprintIds, account.inventoryResources);
  if (!hasMarketplaceConsent(account)) return null;
  const sharedBlueprintIds = selection.blueprintIds.filter(id => !filter.blueprintId || id === filter.blueprintId);
  const resourceIds = new Set(selection.resourceEntryIds);
  const sharedResources = account.inventoryResources
    .filter(entry => resourceIds.has(entry.id) && (!filter.resourceId || entry.resourceId === filter.resourceId))
    .map(({ id, resourceId, resourceName, quantity, quantityUnit, quality }) => ({ id, resourceId, resourceName, quantity, quantityUnit, quality }));
  if ((filter.blueprintId && !sharedBlueprintIds.length) || (filter.resourceId && !sharedResources.length)) return null;
  if (!sharedBlueprintIds.length && !sharedResources.length) return null;
  return {
    handle: account.rsi.handle,
    display: account.rsi.displayName || account.rsi.handle,
    profileUrl: `https://robertsspaceindustries.com/citizens/${encodeURIComponent(account.rsi.handle)}`,
    sharedBlueprintIds: filter.resourceId ? [] : sharedBlueprintIds,
    sharedResources: filter.blueprintId ? [] : sharedResources,
    updatedAt: account.updatedAt ?? null,
  };
}

export async function listMarketplaceMembers(store, actor, options = {}) {
  await assertVerified(store, actor);
  const datasetScope = normalizeAccountDatasetScope(options.datasetScope);
  const pagination = pageOptions(options);
  const blueprintId = text(options.blueprintId, 'Blueprint ID', 200, false);
  const resourceId = text(options.resourceId, 'Resource ID', 200, false);
  const ownerHandle = rsiHandle(options.ownerHandle, false);
  if (blueprintId && resourceId) throw new MarketplaceError(400, 'Choose either a blueprint or a resource filter.');
  let references;
  let nextCursor = null;
  if (ownerHandle) {
    const accountId = await readAccountIdByRsiHandle(store, ownerHandle);
    references = accountId ? [{ accountId }] : [];
  } else {
    const prefix = marketplaceIndexPrefix(datasetScope, { blueprintId, resourceId });
    const page = await store.listJsonPage(prefix, pagination);
    // Never trust a store cursor to change the index namespace being queried.
    const keys = page.keys.filter(key => key.startsWith(prefix)).slice(0, pagination.limit);
    references = await Promise.all(keys.map(key => store.readJson(key)));
    nextCursor = page.nextCursor;
  }
  // Include the current publisher on the first page, through the same privacy
  // checks as every other player. Index ordering must not hide their own offers.
  if (!options.cursor && !ownerHandle) references.unshift({ accountId: actor.accountId });
  const candidates = [...new Set(references.map(reference => reference?.accountId).filter(Boolean))];
  const members = await Promise.all(candidates.map(async accountId => {
    const account = await readScopedAccountRecord(store, accountId, null, datasetScope);
    if (!account || areMarketplaceAccountsBlocked(actor, account)) return null;
    if ((await store.readJson(await marketplaceSuspensionKey(account.accountId)))?.suspended) return null;
    return projectMember(account, { blueprintId, resourceId });
  }));
  return { datasetScope, members: members.filter(Boolean), nextCursor };
}

export async function updateMarketplaceSelection(store, actor, payload, datasetScope = 'live') {
  assertAuthenticated(actor);
  if (typeof payload?.enabled !== 'boolean') throw new MarketplaceError(400, 'Choose whether marketplace sharing is enabled.');
  const blueprintIds = selectionArray(payload.blueprintIds ?? [], 'Blueprint IDs');
  const resourceEntryIds = selectionArray(payload.resourceEntryIds ?? [], 'Resource entry IDs');
  if (blueprintIds.length + resourceEntryIds.length > MARKETPLACE_SELECTION_LIMIT) throw new MarketplaceError(400, `Choose at most ${MARKETPLACE_SELECTION_LIMIT} blueprints and resource batches combined.`);
  return withMarketplaceAccountLocks(store, [actor.accountId], async (store) => {
    const current = await readScopedAccountRecord(store, actor.accountId, actor.profile, datasetScope);
    if (!current) throw new MarketplaceError(404, 'Account not found.');
    if (payload.enabled) await assertVerified(store, current);
    const selection = normalizeMarketplaceSelection({ enabled: payload.enabled, blueprintIds, resourceEntryIds }, current.inventoryBlueprintIds, current.inventoryResources);
    if (payload.enabled && (selection.blueprintIds.length !== blueprintIds.length || selection.resourceEntryIds.length !== resourceEntryIds.length)) throw new MarketplaceError(400, 'Only owned blueprints and current resource batches can be published.');
    return saveAccountMarketplaceSelection(store, current.accountId, selection, current.profile, { datasetScope });
  });
}

export async function createMarketplaceCraftRequest(store, actor, payload, { datasetScope = 'live', appBaseUrl = null, storageScope = 'prod' } = {}) {
  await assertVerified(store, actor);
  const blueprintId = text(payload?.blueprintId, 'Blueprint ID');
  const ownerHandle = rsiHandle(payload?.ownerHandle);
  const blueprintName = text(payload?.blueprintName, 'Blueprint name', 200, false) || blueprintId;
  const comment = text(payload?.comment, 'Comment', 1000, false) || null;
  const resourcesOption = payload?.resourcesOption ?? 'unspecified';
  if (!['unspecified', 'has_resources', 'buy_resources'].includes(resourcesOption)) throw new MarketplaceError(400, 'Resource option is invalid.');
  const ownerAccountId = await readAccountIdByRsiHandle(store, ownerHandle);
  if (!ownerAccountId) throw new MarketplaceError(404, 'This provider is not available.');
  if (ownerAccountId === actor.accountId) throw new MarketplaceError(400, 'You cannot request a craft from yourself.');
  const scope = normalizeAccountDatasetScope(datasetScope);
  return withMarketplaceAccountLocks(store, [actor.accountId, ownerAccountId], async (store) => {
    const [requester, owner] = await Promise.all([
      readScopedAccountRecord(store, actor.accountId, actor.profile, scope),
      readScopedAccountRecord(store, ownerAccountId, null, scope),
    ]);
    await assertVerified(store, requester);
    if (!owner || owner.rsi?.handle.toLowerCase() !== ownerHandle.toLowerCase()) throw new MarketplaceError(404, 'This provider is not available.');
    await assertVerified(store, owner);
    if (areMarketplaceAccountsBlocked(requester, owner)) throw new MarketplaceError(403, 'This craft request is not allowed.');
    if (!projectMember(owner, { blueprintId })) throw new MarketplaceError(409, 'This blueprint is no longer offered by that provider.');
    const existing = requester.outgoingCraftRequests ?? [];
    if (existing.some(request => request.source === 'community' && request.ownerAccountId === ownerAccountId && request.blueprintId === blueprintId && ['pending', 'accepted'].includes(request.status))) throw new MarketplaceError(409, 'A craft request is already open for this provider and blueprint.');
    if (existing.filter(request => request.source === 'community' && request.status === 'pending').length >= MAX_PENDING_REQUESTS) throw new MarketplaceError(429, 'Close or resolve pending requests before sending more.');
    await reserveRate(store, requester.accountId, 'craft requests', MAX_REQUESTS_PER_HOUR, 3_600_000);
    const now = new Date().toISOString();
    return persistNewCraftRequest(store, requester, owner, {
      id: `craftreq_${crypto.randomUUID()}`, source: 'community', datasetScope: scope,
      organizationSid: null, organizationName: null, blueprintId, blueprintName,
      requesterAccountId: requester.accountId, requesterDisplayName: requester.rsi.displayName || requester.rsi.handle,
      requesterAvatarUrl: null, requesterRsiHandle: requester.rsi.handle,
      ownerAccountId: owner.accountId, ownerDisplayName: owner.rsi.displayName || owner.rsi.handle,
      ownerAvatarUrl: null, ownerRsiHandle: owner.rsi.handle,
      appBaseUrl, storageScope, comment, resourcesOption,
      status: 'pending', createdAt: now, updatedAt: now, respondedAt: null,
    }, scope);
  });
}

export async function updateMarketplaceBlock(store, actor, payload, datasetScope = 'live') {
  assertAuthenticated(actor);
  const handle = rsiHandle(payload?.handle);
  if (typeof payload?.blocked !== 'boolean') throw new MarketplaceError(400, 'Block state is invalid.');
  const actorCurrent = await readAccountRecord(store, actor.accountId);
  const targetId = await readAccountIdByRsiHandle(store, handle)
    ?? normalizeMarketplaceBlocks(actorCurrent?.marketplaceBlockedAccounts).find(entry => entry.handle.toLowerCase() === handle.toLowerCase())?.accountId;
  if (!targetId) throw new MarketplaceError(404, 'RSI account not found.');
  if (targetId === actor.accountId) throw new MarketplaceError(400, 'You cannot block your own account.');
  return withMarketplaceAccountLocks(store, [actor.accountId, targetId], async (store) => {
    const current = await readAccountRecord(store, actor.accountId, actor.profile);
    if (!current) throw new MarketplaceError(404, 'Account not found.');
    const blocks = normalizeMarketplaceBlocks(current.marketplaceBlockedAccounts);
    const target = await readAccountRecord(store, targetId);
    if (payload.blocked) {
      if (!target) throw new MarketplaceError(404, 'RSI account not found.');
      if (blocks.filter(entry => entry.accountId !== targetId).length >= MARKETPLACE_BLOCK_LIMIT) throw new MarketplaceError(400, 'Your block list is full.');
      await store.writeJson(await marketplaceBlockedByKey(targetId, current.accountId), { accountId: current.accountId });
    }
    await saveAccountMarketplaceBlocks(store, current.accountId, entries => {
      const next = entries.filter(entry => entry.accountId !== targetId);
      if (payload.blocked) next.push({ accountId: targetId, handle: target.rsi?.handle || handle });
      return next;
    });
    if (!payload.blocked) await store.deleteObject(await marketplaceBlockedByKey(targetId, current.accountId));
    return readScopedAccountRecord(store, current.accountId, current.profile, datasetScope);
  });
}

function reportProjection(report) {
  return { id: report.id, ownerHandle: report.ownerHandle, reporterHandle: report.reporterHandle ?? null, reason: report.reason, status: report.status, createdAt: report.createdAt };
}

export async function reportMarketplaceProvider(store, actor, payload) {
  assertAuthenticated(actor);
  const ownerHandle = rsiHandle(payload?.ownerHandle);
  if (!REPORT_REASONS.has(payload?.reason)) throw new MarketplaceError(400, 'Report reason must be spam, misleading or abuse.');
  const targetId = await readAccountIdByRsiHandle(store, ownerHandle);
  if (!targetId) throw new MarketplaceError(404, 'Provider not found.');
  if (targetId === actor.accountId) throw new MarketplaceError(400, 'You cannot report your own account.');
  return withMarketplaceAccountLocks(store, [actor.accountId, targetId], async (store) => {
    const [current, target] = await Promise.all([readAccountRecord(store, actor.accountId), readAccountRecord(store, targetId)]);
    if (!current || !target || target.rsi?.handle.toLowerCase() !== ownerHandle.toLowerCase()) throw new MarketplaceError(404, 'Provider or account not found.');
    const dedupeKey = `marketplace/report-dedupe/${await marketplaceAccountKey(actor.accountId)}/${await marketplaceAccountKey(targetId)}.json`;
    const existing = await store.readJson(dedupeKey);
    if (existing?.createdAt && Date.parse(existing.createdAt) > Date.now() - 86_400_000) return { id: existing.id, status: 'pending' };
    await reserveRate(store, actor.accountId, 'reports', 5, 86_400_000);
    const report = {
      id: crypto.randomUUID(), ownerAccountId: targetId, reporterAccountId: actor.accountId,
      ownerHandle: target.rsi.handle, reporterHandle: isVerifiedRsiLink(current.rsi) ? current.rsi.handle : null,
      reason: payload.reason, status: 'pending', createdAt: new Date().toISOString(),
    };
    await store.writeJson(await marketplaceReportParticipantKey(actor.accountId, report.id), { id: report.id });
    await store.writeJson(await marketplaceReportParticipantKey(targetId, report.id), { id: report.id });
    await store.writeJson(REPORT_PREFIX + report.id + '.json', report);
    await store.writeJson(dedupeKey, { id: report.id, createdAt: report.createdAt });
    return { id: report.id, status: report.status };
  });
}

function assertAdmin(actor) {
  assertAuthenticated(actor);
  if (!actor.isAdmin) throw new MarketplaceError(403, 'Administrator access required.');
}

export async function listMarketplaceReports(store, actor, options = {}) {
  assertAdmin(actor);
  const pagination = pageOptions(options);
  const page = await store.listJsonPage(REPORT_PREFIX, pagination);
  const reports = await Promise.all(page.keys.filter(key => key.startsWith(REPORT_PREFIX)).slice(0, pagination.limit).map(key => store.readJson(key)));
  return { reports: reports.filter(Boolean).map(reportProjection), nextCursor: page.nextCursor };
}

export async function moderateMarketplaceReport(store, actor, reportId, payload) {
  assertAdmin(actor);
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) throw new MarketplaceError(400, 'Report ID is invalid.');
  if (!['dismiss', 'suspend', 'restore'].includes(payload?.action)) throw new MarketplaceError(400, 'Moderation action is invalid.');
  const key = REPORT_PREFIX + reportId + '.json';
  const report = await store.readJson(key);
  if (!report) throw new MarketplaceError(404, 'Report not found.');
  return withMarketplaceAccountLocks(store, [report.ownerAccountId], async (store) => {
    if (!await readAccountRecord(store, report.ownerAccountId) || !await store.readJson(key)) throw new MarketplaceError(404, 'Provider or report not found.');
    if (payload.action === 'suspend') {
      await store.writeJson(await marketplaceSuspensionKey(report.ownerAccountId), { suspended: true, reportId, updatedAt: new Date().toISOString() });
      for (const scope of ['live', 'ptu']) {
        const account = await readScopedAccountRecord(store, report.ownerAccountId, null, scope);
        if (account) {
          await syncMarketplaceIndexes(store, account, null, scope);
          await saveAccountMarketplaceSelection(store, account.accountId, { enabled: false, blueprintIds: [], resourceEntryIds: [] }, account.profile, { datasetScope: scope });
        }
      }
    }
    if (payload.action === 'restore') {
      await store.writeJson(await marketplaceSuspensionKey(report.ownerAccountId), { suspended: false, reportId, updatedAt: new Date().toISOString() });
    }
    const updated = await store.updateJsonAtomically(key, current => {
      if (!current) throw new MarketplaceError(404, 'Report not found.');
      return { ...current, status: payload.action === 'suspend' ? 'suspended' : payload.action === 'restore' ? 'restored' : 'dismissed', reviewedAt: new Date().toISOString() };
    });
    return reportProjection(updated);
  });
}
