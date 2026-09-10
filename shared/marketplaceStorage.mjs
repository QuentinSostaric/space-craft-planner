import { isVerifiedRsiLink } from './rsiLink.mjs';
import { normalizeStringArray } from './normalize.mjs';

export class MarketplaceError extends Error {
  constructor(status, message) { super(message); this.name = 'MarketplaceError'; this.status = status; }
}

const LOCK_TTL = 120_000;
const HELD_ACCOUNT_LOCKS = Symbol('heldMarketplaceAccountLocks');

// A persisted lease serializes creation across workers; rate records use CAS
// as well. Busy requests fail closed and can be retried without duplicate writes.
export async function withMarketplaceAccountLocks(store, accountIds, callback) {
  if (typeof store.updateJsonAtomically !== 'function') throw new MarketplaceError(503, 'Atomic marketplace storage is unavailable.');
  const held = store[HELD_ACCOUNT_LOCKS] ?? new Set();
  const missing = [...new Set(accountIds)].filter(accountId => !held.has(accountId));
  if (!missing.length) return callback(store);
  const keys = await Promise.all(missing.sort().map(async accountId => `marketplace/locks/${await marketplaceAccountKey(accountId)}.json`));
  const token = crypto.randomUUID();
  const acquired = [];
  try {
    for (const key of keys) {
      await store.updateJsonAtomically(key, current => {
        if (current?.expiresAt > Date.now() && current?.token !== token) throw new MarketplaceError(409, 'Another account action is in progress. Retry shortly.');
        return { token, expiresAt: Date.now() + LOCK_TTL };
      });
      acquired.push(key);
    }
    const lockedStore = Object.create(store);
    lockedStore[HELD_ACCOUNT_LOCKS] = new Set([...held, ...missing]);
    return await callback(lockedStore);
  } finally {
    for (const key of acquired.reverse()) {
      await store.updateJsonAtomically(key, current => current?.token === token ? { token, expiresAt: 0 } : undefined).catch(() => {});
    }
  }
}

export const MARKETPLACE_SELECTION_LIMIT = 400;
export const MARKETPLACE_BLOCK_LIMIT = 100;

export function normalizeMarketplaceBlocks(value) {
  if (!Array.isArray(value)) return [];
  const entries = new Map();
  for (const entry of value.slice(0, MARKETPLACE_BLOCK_LIMIT)) {
    if (typeof entry?.accountId !== 'string' || typeof entry?.handle !== 'string') continue;
    const accountId = entry.accountId.trim();
    const handle = entry.handle.trim();
    if (accountId && handle) entries.set(accountId, { accountId, handle });
  }
  return [...entries.values()];
}

export function normalizeMarketplaceSelection(value, inventoryBlueprintIds = [], inventoryResources = [], blockedAccounts = []) {
  const blueprintIds = new Set(inventoryBlueprintIds);
  const resourceIds = new Set(inventoryResources.map(entry => entry.id));
  const selectedBlueprintIds = normalizeStringArray(value?.blueprintIds).filter(id => blueprintIds.has(id)).slice(0, MARKETPLACE_SELECTION_LIMIT);
  return {
    enabled: value?.enabled === true,
    identityHandle: typeof value?.identityHandle === 'string' ? value.identityHandle.trim().toLowerCase() : null,
    identityVersion: typeof value?.identityVersion === 'string' ? value.identityVersion : null,
    blueprintIds: selectedBlueprintIds,
    resourceEntryIds: normalizeStringArray(value?.resourceEntryIds).filter(id => resourceIds.has(id)).slice(0, MARKETPLACE_SELECTION_LIMIT - selectedBlueprintIds.length),
    blockedHandles: normalizeMarketplaceBlocks(blockedAccounts).map(entry => entry.handle),
  };
}

export function hasMarketplaceConsent(account) {
  return Boolean(account?.marketplace?.enabled && isVerifiedRsiLink(account.rsi)
    && account.marketplace.identityHandle === account.rsi.handle.toLowerCase()
    && account.marketplace.identityVersion === (account.marketplaceIdentityVersion ?? null));
}

export async function marketplaceAccountKey(accountId) {
  const bytes = new TextEncoder().encode(String(accountId));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function marketplaceIndexPrefix(datasetScope = 'live', { blueprintId, resourceId } = {}) {
  const scope = datasetScope === 'ptu' ? 'ptu' : 'live';
  if (blueprintId) return `marketplace/index/${scope}/blueprints/${encodeURIComponent(blueprintId)}/`;
  if (resourceId) return `marketplace/index/${scope}/resources/${encodeURIComponent(resourceId)}/`;
  return `marketplace/index/${scope}/members/`;
}

async function indexKeys(account, datasetScope) {
  if (!account?.accountId || !hasMarketplaceConsent(account)) return [];
  const selection = normalizeMarketplaceSelection(account.marketplace, account.inventoryBlueprintIds, account.inventoryResources);
  if (!selection.blueprintIds.length && !selection.resourceEntryIds.length) return [];
  const suffix = `${await marketplaceAccountKey(account.accountId)}.json`;
  const resourceIds = new Set(account.inventoryResources.filter(entry => selection.resourceEntryIds.includes(entry.id)).map(entry => entry.resourceId));
  return [
    marketplaceIndexPrefix(datasetScope) + suffix,
    ...selection.blueprintIds.map(blueprintId => marketplaceIndexPrefix(datasetScope, { blueprintId }) + suffix),
    ...[...resourceIds].map(resourceId => marketplaceIndexPrefix(datasetScope, { resourceId }) + suffix),
  ];
}

// Index records contain only an internal reference. Every directory projection
// rechecks current account state, so even a failed index cleanup cannot expose
// withdrawn stock or an unlinked/deleted identity.
export async function syncMarketplaceIndexes(store, previousAccount, nextAccount, datasetScope = 'live', { forceWrite = false } = {}) {
  const previousKeys = new Set(await indexKeys(previousAccount, datasetScope));
  const nextKeys = new Set(await indexKeys(nextAccount, datasetScope));
  const accountId = nextAccount?.accountId ?? previousAccount?.accountId;
  if (!accountId) return;
  const changed = previousKeys.size !== nextKeys.size || [...previousKeys].some(key => !nextKeys.has(key));
  if (!forceWrite && nextAccount && !changed) return;
  const manifestKey = `marketplace/manifests/${datasetScope === 'ptu' ? 'ptu' : 'live'}/${await marketplaceAccountKey(accountId)}.json`;
  const manifest = await store.readJson(manifestKey);
  const knownKeys = new Set([...previousKeys, ...(Array.isArray(manifest?.keys) ? manifest.keys : [])]);
  // Persist cleanup information before touching an index. A partial publish or
  // withdrawal remains repairable even after the scope record has been saved.
  await store.writeJson(manifestKey, { keys: [...new Set([...knownKeys, ...nextKeys])] });
  const operations = [
    ...[...knownKeys].filter(key => !nextKeys.has(key)).map(key => () => store.deleteObject(key)),
    ...[...nextKeys].filter(key => forceWrite || !previousKeys.has(key)).map(key => () => store.writeJson(key, { accountId: nextAccount.accountId })),
  ];
  for (let offset = 0; offset < operations.length; offset += 16) {
    await Promise.all(operations.slice(offset, offset + 16).map(operation => operation()));
  }
  if (nextKeys.size) await store.writeJson(manifestKey, { keys: [...nextKeys] });
  else await store.deleteObject(manifestKey);
}

export function areMarketplaceAccountsBlocked(left, right) {
  return normalizeMarketplaceBlocks(left?.marketplaceBlockedAccounts).some(entry => entry.accountId === right?.accountId)
    || normalizeMarketplaceBlocks(right?.marketplaceBlockedAccounts).some(entry => entry.accountId === left?.accountId);
}

export async function marketplaceSuspensionKey(accountId) {
  return `marketplace/suspensions/${await marketplaceAccountKey(accountId)}.json`;
}

export async function marketplaceBlockedByKey(targetAccountId, blockerAccountId) {
  return `marketplace/blocked-by/${await marketplaceAccountKey(targetAccountId)}/${await marketplaceAccountKey(blockerAccountId)}.json`;
}

export async function marketplaceReportParticipantKey(accountId, reportId) {
  return `marketplace/report-participants/${await marketplaceAccountKey(accountId)}/${reportId}.json`;
}

// Account deletion follows participant indexes, never a scan of other accounts.
// A report about a remaining provider can stay actionable after its reporter's
// identity is erased; reports about the deleted provider are removed entirely.
export async function purgeMarketplaceAccountData(store, account, { readAccount, removeBlock }) {
  if (!account?.accountId) return;
  const accountId = account.accountId;
  const accountKey = await marketplaceAccountKey(accountId);
  for (const block of normalizeMarketplaceBlocks(account.marketplaceBlockedAccounts)) {
    await store.deleteObject(await marketplaceBlockedByKey(block.accountId, accountId));
  }
  for (const key of await store.listJsonKeys(`marketplace/blocked-by/${accountKey}/`)) {
    const reference = await store.readJson(key);
    const blocker = reference?.accountId ? await readAccount(reference.accountId) : null;
    if (blocker) await removeBlock(blocker.accountId, accountId);
    await store.deleteObject(key);
  }
  for (const key of await store.listJsonKeys(`marketplace/report-participants/${accountKey}/`)) {
    const reference = await store.readJson(key);
    const reportKey = reference?.id ? `marketplace/reports/${reference.id}.json` : null;
    const report = reportKey ? await store.readJson(reportKey) : null;
    if (report) {
      if (report.reporterAccountId && report.ownerAccountId) {
        await store.deleteObject(`marketplace/report-dedupe/${await marketplaceAccountKey(report.reporterAccountId)}/${await marketplaceAccountKey(report.ownerAccountId)}.json`);
      }
      if (report.ownerAccountId === accountId) {
        await store.deleteObject(reportKey);
        if (report.reporterAccountId) await store.deleteObject(await marketplaceReportParticipantKey(report.reporterAccountId, report.id));
      } else if (report.reporterAccountId === accountId) {
        await store.updateJsonAtomically(reportKey, current => current ? { ...current, reporterAccountId: null, reporterHandle: null } : undefined);
      }
    }
    await store.deleteObject(key);
  }
  for (const key of await store.listJsonKeys(`marketplace/report-dedupe/${accountKey}/`)) await store.deleteObject(key);
  for (const key of [
    `marketplace/locks/${accountKey}.json`,
    `marketplace/rates/craft requests/${accountKey}.json`,
    `marketplace/rates/reports/${accountKey}.json`,
    `marketplace/suspensions/${accountKey}.json`,
  ]) await store.deleteObject(key);
}
