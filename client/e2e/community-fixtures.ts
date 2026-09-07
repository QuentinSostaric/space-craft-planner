import type { Page } from '@playwright/test';
import type { AccountCraftRequest, AccountDatasetScope, MarketplaceSettings, StoredAccount } from '../src/services/authService';
import type { MarketplaceMember, MarketplacePublication, MarketplaceReport } from '../src/services/marketplaceService';
import { accountBlueprints, createTestAccount, installAccountState } from './account-fixtures';
import { emptyDataset } from './fixtures';

const timestamp = '2026-09-07T12:00:00.000Z';
const ownHandle = 'AccountCitizen';
const clone = <T,>(value: T): T => structuredClone(value);
const privatePublication = (): MarketplaceSettings => ({ enabled: false, blueprintIds: [], resourceEntryIds: [], blockedHandles: [] });

export const communityMembers: MarketplaceMember[] = [
  { handle: 'OtherCitizen', display: 'Other Citizen', profileUrl: 'https://robertsspaceindustries.com/en/citizens/OtherCitizen',
    sharedBlueprintIds: ['account-rifle', 'account-pistol'],
    sharedResources: [{ id: 'other-iron', resourceId: 'iron', resourceName: 'Iron', quantity: 1.5, quantityUnit: 'scu', quality: 900 }], updatedAt: timestamp },
  { handle: 'QuietMiner', display: 'Quiet Miner', profileUrl: 'https://robertsspaceindustries.com/en/citizens/QuietMiner',
    sharedBlueprintIds: ['account-shotgun'],
    sharedResources: [{ id: 'miner-iron', resourceId: 'iron', resourceName: 'Iron', quantity: 3, quantityUnit: 'scu', quality: 650 }], updatedAt: timestamp },
];

/** Community/org routes are synthetic. Unhandled APIs still hit the strict Account fixture. */
export async function installCommunityState(page: Page, options: {
  colorScheme?: 'light' | 'dark' | 'no-preference';
  guest?: boolean;
  enabled?: boolean;
  published?: boolean;
  blueprintFailures?: number;
  craftFailures?: number;
  pageSize?: number;
  admin?: boolean;
  unverified?: boolean;
} = {}) {
  const base = await installAccountState(page, options);
  const live = base.getAccount();
  live.isAdmin = options.admin ?? false;
  if (options.unverified && live.rsi) live.rsi.verificationRequired = true;
  live.marketplace = options.published
    ? { enabled: true, blueprintIds: ['account-rifle'], resourceEntryIds: ['iron-lot'], blockedHandles: [] }
    : privatePublication();
  const ptu = createTestAccount();
  Object.assign(ptu, { datasetScope: 'ptu', inventoryBlueprintIds: ['account-shotgun'], inventoryResources: [],
    favoriteBlueprintIds: [], organizationBlueprintShares: {}, organizationResourceShares: {}, sharedBlueprintIds: [],
    sharedResourceEntryIds: [], incomingCraftRequests: [], outgoingCraftRequests: [], marketplace: privatePublication() });
  const accounts: Record<AccountDatasetScope, StoredAccount> = { live, ptu };
  const reads: Array<{ path: string; scope: string; query: Record<string, string> }> = [];
  const writes: Array<{ path: string; scope: string; body: Record<string, unknown> }> = [];
  const publicationWrites: Array<{ scope: AccountDatasetScope; publication: MarketplacePublication }> = [];
  const reports: MarketplaceReport[] = [
    { id: 'report-spam', ownerHandle: 'OtherCitizen', reporterHandle: 'ReporterOne', reason: 'spam', status: 'pending', createdAt: timestamp },
    { id: 'report-abuse', ownerHandle: 'QuietMiner', reporterHandle: null, reason: 'abuse', status: 'pending', createdAt: timestamp },
  ];
  let blueprintFailures = options.blueprintFailures ?? 0;
  let craftFailures = options.craftFailures ?? 0;
  const datasets = (['live', 'ptu'] as const).map(channel => ({
    ...emptyDataset, channel, datasetId: `e2e-community-${channel}`, label: `E2E ${channel.toUpperCase()}`,
    blueprints: accountBlueprints, blueprintCount: accountBlueprints.length,
    resources: [{ id: 'iron', name: 'Iron', description: 'Test metal', color: '#708090', visualKind: 'metal', visual: null },
      { id: 'copper', name: 'Copper', description: 'Test metal', color: '#B87333', visualKind: 'metal', visual: null }], resourceCount: 2,
  }));

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const scope: AccountDatasetScope = url.searchParams.get('datasetScope') === 'ptu' ? 'ptu' : 'live';
    const account = accounts[scope];
    const publication = account.marketplace!;
    const body = method === 'GET' ? {} : request.postDataJSON() as Record<string, unknown>;
    const isCommunityPath = path.startsWith('/api/auth/marketplace') || path.startsWith('/api/auth/organizations/')
      || path === '/api/auth/account/marketplace' || path === '/api/auth/account';
    if (isCommunityPath) {
      if (method === 'GET') reads.push({ path, scope, query: Object.fromEntries(url.searchParams) });
      else writes.push({ path, scope, body: clone(body) });
    }

    if (path === '/api/game-data/public') return route.fulfill({ json: { datasets, defaultChannel: 'live' } });
    if (path.startsWith('/api/game-data/public/')) {
      const dataset = datasets.find(entry => path.includes(entry.datasetId) || path.split('/').includes(entry.channel)) ?? datasets[0];
      if (path.includes('/blueprints/')) return route.fulfill({ json: { datasetId: dataset.datasetId,
        blueprint: accountBlueprints.find(entry => entry.id === decodeURIComponent(path.split('/').pop()!)) } });
      return route.fulfill({ json: { dataset } });
    }
    if (path === '/api/auth/account' && method === 'GET') return route.fulfill({ json: { account } });

    if (path === '/api/auth/marketplace' && method === 'GET') {
      let members = scope === 'live' ? clone(communityMembers) : [];
      if (publication.enabled) members.push({ handle: ownHandle, display: 'Account Citizen',
        profileUrl: `https://robertsspaceindustries.com/en/citizens/${ownHandle}`,
        sharedBlueprintIds: clone(publication.blueprintIds),
        sharedResources: account.inventoryResources.filter(entry => publication.resourceEntryIds.includes(entry.id)).map(entry => ({
          id: entry.id, resourceId: entry.resourceId, resourceName: entry.resourceName, quantity: entry.quantity,
          quantityUnit: entry.quantityUnit, quality: entry.quality,
        })), updatedAt: timestamp });
      members = members.filter(member => !publication.blockedHandles.some(handle => handle.toLowerCase() === member.handle.toLowerCase()));
      const owner = url.searchParams.get('ownerHandle')?.toLowerCase();
      const blueprint = url.searchParams.get('blueprintId');
      const resource = url.searchParams.get('resourceId');
      if (owner) members = members.filter(member => member.handle.toLowerCase() === owner);
      if (blueprint) members = members.filter(member => member.sharedBlueprintIds.includes(blueprint));
      if (resource) members = members.filter(member => member.sharedResources.some(entry => entry.resourceId === resource));
      const start = Number(url.searchParams.get('cursor') || 0);
      const size = options.pageSize ?? Number(url.searchParams.get('limit') || 20);
      return route.fulfill({ json: { datasetScope: scope, members: members.slice(start, start + size),
        nextCursor: members.length > start + size ? String(start + size) : null } });
    }

    if (path === '/api/auth/account/marketplace' && method === 'PUT') {
      const next = body as unknown as MarketplacePublication;
      publicationWrites.push({ scope, publication: clone(next) });
      account.marketplace = { ...publication, ...next };
      return route.fulfill({ json: { account } });
    }
    if (path === '/api/auth/marketplace/block' && method === 'POST') {
      const handle = String(body.handle);
      publication.blockedHandles = publication.blockedHandles.filter(entry => entry.toLowerCase() !== handle.toLowerCase());
      if (body.blocked) publication.blockedHandles.push(handle);
      return route.fulfill({ json: { account } });
    }
    if (path === '/api/auth/marketplace/reports' && method === 'POST') {
      return route.fulfill({ json: { report: { id: 'test-report', status: 'pending' } } });
    }
    if (path === '/api/auth/marketplace/reports' && method === 'GET') {
      if (!account.isAdmin) return route.fulfill({ status: 403, json: { message: 'Administrator access required.' } });
      const start = Number(url.searchParams.get('cursor') || 0);
      return route.fulfill({ json: { reports: reports.slice(start, start + 1), nextCursor: start + 1 < reports.length ? String(start + 1) : null } });
    }
    if (path.startsWith('/api/auth/marketplace/reports/') && method === 'PATCH') {
      if (!account.isAdmin) return route.fulfill({ status: 403, json: { message: 'Administrator access required.' } });
      const report = reports.find(entry => entry.id === path.split('/').pop())!;
      report.status = body.action === 'dismiss' ? 'dismissed' : body.action === 'suspend' ? 'suspended' : 'restored';
      return route.fulfill({ json: { report } });
    }

    const org = account.organizations[0];
    const orgPayload = { sid: org.sid, name: org.name, image: null, logo: null, url: null, claimed: true,
      blueprintSharingEnabled: true, lastLiveSyncAt: timestamp, staleAt: null, memberCount: 12, syncStatus: 'fresh' };
    if (path === '/api/auth/organizations/TESTORG/shared-blueprints' && method === 'GET') {
      if (blueprintFailures-- > 0) return route.fulfill({ status: 503, json: { message: 'Blueprint catalogue temporarily unavailable.' } });
      return route.fulfill({ json: { organization: orgPayload, members: [
        { handle: ownHandle, display: 'Account Citizen', image: null, rank: 'Director', stars: 5, sharedBlueprintIds: ['account-rifle'] },
        ...communityMembers.map(member => ({ handle: member.handle, display: member.display, image: null, rank: 'Member', stars: 1, sharedBlueprintIds: member.sharedBlueprintIds })),
      ] } });
    }
    if (path === '/api/auth/organizations/TESTORG/shared-resources' && method === 'GET') return route.fulfill({ json: {
      organization: orgPayload, members: communityMembers.map(member => ({ handle: member.handle, display: member.display,
        image: null, rank: 'Member', stars: 1, sharedResources: member.sharedResources.map(entry => ({ ...entry, createdAt: timestamp, updatedAt: timestamp })) })),
    } });

    if ((path === '/api/auth/marketplace/craft-requests' || path === '/api/auth/organizations/TESTORG/craft-requests') && method === 'POST') {
      if (craftFailures-- > 0) return route.fulfill({ status: 503, json: { message: 'Craft requests temporarily unavailable. Please retry.' } });
      const community = path === '/api/auth/marketplace/craft-requests';
      const ownerHandle = String(body.ownerHandle);
      const owner = communityMembers.find(member => member.handle === ownerHandle)!;
      const craftRequest: AccountCraftRequest = {
        id: `created-${account.outgoingCraftRequests.length}`, datasetScope: scope,
        source: community ? 'community' : 'organization', organizationSid: community ? null : 'TESTORG',
        organizationName: community ? null : 'Test Organization', blueprintId: String(body.blueprintId),
        blueprintName: String(body.blueprintName || accountBlueprints.find(entry => entry.id === body.blueprintId)?.name),
        requesterAccountId: account.accountId, requesterDisplayName: account.profile.displayName,
        requesterAvatarUrl: null, requesterRsiHandle: ownHandle, ownerAccountId: `fixture-${ownerHandle}`,
        ownerDisplayName: owner.display, ownerAvatarUrl: null, ownerRsiHandle: ownerHandle,
        comment: String(body.comment ?? ''), resourcesOption: (body.resourcesOption || 'unspecified') as AccountCraftRequest['resourcesOption'],
        status: 'pending', createdAt: timestamp, updatedAt: timestamp, respondedAt: null,
      };
      account.outgoingCraftRequests.push(craftRequest);
      return route.fulfill({ json: { account, request: craftRequest } });
    }
    return route.fallback();
  });

  return { ...base, reads, writes, publicationWrites, getReports: () => clone(reports),
    recoverBlueprintCatalog: () => { blueprintFailures = 0; },
    getAccount: (scope: AccountDatasetScope = 'live') => accounts[scope] };
}
