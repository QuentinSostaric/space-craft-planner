import type { Page } from '@playwright/test';
import type {
  AccountCraftRequest,
  AccountInventoryResourceEntry,
  AuthenticatedUser,
  StoredAccount,
} from '../src/services/authService';
import type { Blueprint, Resource } from '../src/types';
import { emptyDataset, installDeterministicState } from './fixtures';

const timestamp = '2026-09-01T12:00:00.000Z';

export const accountBlueprints: Blueprint[] = [
  { id: 'account-rifle', name: 'Account Rifle', manufacturer: 'Behring', category: 'fps-weapon', craftTimeSecs: 180, baseStats: { damage: 18 }, slots: [], detailsLoaded: true },
  { id: 'account-pistol', name: 'Account Pistol', manufacturer: 'Behring', category: 'fps-weapon', craftTimeSecs: 90, baseStats: { damage: 12 }, slots: [], detailsLoaded: true },
  { id: 'account-shotgun', name: 'Account Shotgun', manufacturer: 'Behring', category: 'fps-weapon', craftTimeSecs: 120, baseStats: { damage: 24 }, slots: [], detailsLoaded: true },
];

const resources: Resource[] = [
  { id: 'iron', name: 'Iron', description: 'Test metal resource', color: '#708090', visualKind: 'metal', visual: null, visualStatus: null, visualNotes: null },
  { id: 'copper', name: 'Copper', description: 'Test metal resource', color: '#B87333', visualKind: 'metal', visual: null, visualStatus: null, visualNotes: null },
];

export const initialResourceEntries: AccountInventoryResourceEntry[] = [
  { id: 'iron-lot', resourceId: 'iron', resourceName: 'Iron', quantity: 4.25, quantityUnit: 'scu', quality: 720, createdAt: timestamp, updatedAt: timestamp },
  { id: 'copper-lot', resourceId: 'copper', resourceName: 'Copper', quantity: 2, quantityUnit: 'scu', quality: 350, createdAt: timestamp, updatedAt: '2026-09-02T12:00:00.000Z' },
];

const user: AuthenticatedUser = {
  id: 'account-e2e-user', username: 'account-test', globalName: null,
  discriminator: null, avatarUrl: null, displayName: 'Account Test Citizen',
};

const incomingRequest: AccountCraftRequest = {
  id: 'incoming-request', datasetScope: 'live', organizationSid: 'TESTORG', organizationName: 'Test Organization',
  blueprintId: 'account-rifle', blueprintName: 'Account Rifle',
  requesterAccountId: 'other-citizen', requesterDisplayName: 'Other Citizen', requesterAvatarUrl: null, requesterRsiHandle: 'OtherCitizen',
  ownerAccountId: user.id, ownerDisplayName: user.displayName, ownerAvatarUrl: null, ownerRsiHandle: 'AccountCitizen',
  comment: 'Please craft this rifle for our mining escort.', resourcesOption: 'has_resources',
  status: 'pending', createdAt: timestamp, updatedAt: timestamp, respondedAt: null,
  ownerDiscordChannelId: 'test-dm', ownerDiscordMessageId: 'test-message',
};

export function createTestAccount(): StoredAccount {
  return {
    accountId: user.id, datasetScope: 'live', provider: 'discord', providerUserId: user.id, profile: user,
    favoriteBlueprintIds: ['account-pistol'], inventoryBlueprintIds: ['account-rifle'],
    inventoryResources: structuredClone(initialResourceEntries),
    planner: { goals: [], todoItems: [], resourceRequirements: {}, resourceProgress: {} },
    organizationBlueprintShares: { TESTORG: ['account-rifle'] },
    organizationResourceShares: { TESTORG: ['iron-lot'] },
    sharedBlueprintIds: ['account-rifle'], sharedResourceEntryIds: ['iron-lot'],
    organizations: [{
      sid: 'TESTORG', source: 'profile-main', name: 'Test Organization', image: null,
      status: 'verified_admin', rank: 'Director', stars: 5, lastSeenAt: timestamp, lastVerifiedAt: timestamp,
      claimed: true, claimedByCurrentUser: true, blueprintSharingEnabled: true, syncStatus: 'fresh', memberCount: 12,
    }],
    incomingCraftRequests: [structuredClone(incomingRequest)],
    outgoingCraftRequests: [{
      ...incomingRequest, id: 'outgoing-request', blueprintId: 'account-pistol', blueprintName: 'Account Pistol',
      requesterAccountId: user.id, requesterDisplayName: user.displayName, requesterRsiHandle: 'AccountCitizen',
      ownerAccountId: 'other-citizen', ownerDisplayName: 'Other Citizen', ownerRsiHandle: 'OtherCitizen',
      status: 'accepted', respondedAt: timestamp, comment: 'A sidearm for the next expedition.',
    }],
    rsi: { handle: 'AccountCitizen', displayName: 'Account Citizen', profileUrl: null, verifiedAt: timestamp, verificationProvider: 'citizenid', verificationRequired: false },
    isAdmin: false, lastRsiLinkAt: timestamp, onboardingCompletedAt: timestamp, onboardingDismissedAt: null,
    createdAt: timestamp, updatedAt: timestamp, lastLoginAt: timestamp,
  };
}

/** All Account API traffic is intercepted; no authenticated production requests. */
export async function installAccountState(page: Page, options: {
  colorScheme?: 'light' | 'dark' | 'no-preference';
  guest?: boolean;
  enabled?: boolean;
} = {}) {
  const errors = await installDeterministicState(page);
  await page.addInitScript((theme) => {
    localStorage.setItem('sc-craft-theme', JSON.stringify(theme));
    localStorage.setItem('sc-craft-inventory', '[]');
    localStorage.setItem('sc-craft-favorites', '[]');
    localStorage.setItem('sc-craft-inventory-resources', '[]');
    localStorage.setItem('sc-craft-inventory-seed-version', '1');
    localStorage.setItem('sc-craft-analytics-consent', 'false');
  }, options.colorScheme === 'light' ? 'light' : 'dark');

  let account = createTestAccount();
  const resourceWrites: AccountInventoryResourceEntry[][] = [];
  const shareWrites: Record<string, string[]>[] = [];
  const mutations: Array<{ path: string; method: string; body: unknown }> = [];
  const unexpectedApiCalls: string[] = [];
  const dataset = {
    ...emptyDataset, datasetId: 'e2e-account-live', blueprints: accountBlueprints, resources,
    blueprintCount: accountBlueprints.length, resourceCount: resources.length,
  };

  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/api/game-data/public') return route.fulfill({ json: { datasets: [dataset], defaultChannel: 'live' } });
    if (path.startsWith('/api/game-data/public/')) {
      if (path.includes('/blueprints/')) {
        const id = decodeURIComponent(path.split('/').pop()!);
        return route.fulfill({ json: { datasetId: dataset.datasetId, blueprint: accountBlueprints.find(blueprint => blueprint.id === id) } });
      }
      return route.fulfill({ json: { dataset } });
    }
    if (path === '/api/auth/feature-flags') return route.fulfill({ json: {} });
    if (path === '/api/auth/session') return route.fulfill({ json: {
      enabled: options.enabled ?? true, provider: 'discord', user: options.guest ? null : user,
      citizenIdLoginEnabled: true, citizenIdRsiLinkEnabled: true, citizenIdBrandEnvironment: 'production',
    } });
    if (path === '/api/auth/account' && method === 'GET') return route.fulfill({ json: { account } });

    if (method !== 'GET') mutations.push({ path, method, body: request.postData() ? request.postDataJSON() : null });
    if (path === '/api/auth/account/resources' && method === 'PUT') {
      const body = request.postDataJSON() as { inventoryResources: AccountInventoryResourceEntry[] };
      resourceWrites.push(structuredClone(body.inventoryResources));
      account = { ...account, inventoryResources: body.inventoryResources };
      // Resource persistence prunes references to removed lots, as the account API does.
      const ids = new Set(account.inventoryResources.map(entry => entry.id));
      account.organizationResourceShares = Object.fromEntries(Object.entries(account.organizationResourceShares)
        .map(([sid, entryIds]) => [sid, entryIds.filter(id => ids.has(id))]).filter(([, entryIds]) => entryIds.length > 0));
      account.sharedResourceEntryIds = [...new Set(Object.values(account.organizationResourceShares).flat())];
      return route.fulfill({ json: { account } });
    }
    if (path === '/api/auth/account/shared-resources' && method === 'PUT') {
      const body = request.postDataJSON() as { organizationResourceShares: Record<string, string[]> };
      shareWrites.push(structuredClone(body.organizationResourceShares));
      account = { ...account, organizationResourceShares: body.organizationResourceShares,
        sharedResourceEntryIds: [...new Set(Object.values(body.organizationResourceShares).flat())] };
      return route.fulfill({ json: { account } });
    }
    if (path === '/api/auth/account' && method === 'PUT') {
      const body = request.postDataJSON();
      account = { ...account, favoriteBlueprintIds: body.favoriteBlueprintIds, inventoryBlueprintIds: body.inventoryBlueprintIds, planner: body.planner };
      return route.fulfill({ json: { account } });
    }
    if (path.startsWith('/api/auth/craft-requests/') && method === 'POST') {
      const applyDecision = (entries: AccountCraftRequest[], requestId: string, decision: AccountCraftRequest['status'] | 'deleted') => entries
        .filter(entry => entry.id !== requestId || decision !== 'deleted')
        .map(entry => entry.id !== requestId || decision === 'deleted' ? entry : {
          ...entry, status: decision, updatedAt: timestamp,
          respondedAt: decision === 'accepted' || decision === 'denied' ? timestamp : entry.respondedAt,
        });
      const body = request.postDataJSON();
      const actions: Array<{ requestId: string; decision: AccountCraftRequest['status'] | 'deleted' }> = path.endsWith('/bulk')
        ? body.actions
        : [{ requestId: decodeURIComponent(path.split('/').pop()!), decision: body.decision }];
      for (const { requestId, decision } of actions) {
        account = { ...account,
          incomingCraftRequests: applyDecision(account.incomingCraftRequests, requestId, decision),
          outgoingCraftRequests: applyDecision(account.outgoingCraftRequests, requestId, decision),
        };
      }
      return route.fulfill({ json: path.endsWith('/bulk')
        ? { account, results: actions.map(({ requestId, decision }) => ({ requestId, ok: true, status: decision })) }
        : { account, requestId: actions[0].requestId, status: actions[0].decision },
      });
    }
    unexpectedApiCalls.push(`${method} ${path}`);
    return route.abort('blockedbyclient');
  });

  return { errors, resourceWrites, shareWrites, mutations, unexpectedApiCalls, getAccount: () => account };
}
