import { hasMarketplaceConsent } from './marketplaceStorage.mjs';

// Internal participant IDs encode Discord IDs. Decisions use the request ID,
// so a community peer needs only an opaque, request-local participant token.
export function projectCraftRequestForAccount(request, accountId) {
  if (request?.source !== 'community') return request;
  return {
    ...request,
    ownerAccountId: request.ownerAccountId === accountId ? accountId : `community:owner:${request.id}`,
    requesterAccountId: request.requesterAccountId === accountId ? accountId : `community:requester:${request.id}`,
    ownerAvatarUrl: null,
    requesterAvatarUrl: null,
    ownerDiscordChannelId: null,
    ownerDiscordMessageId: null,
  };
}

export function projectAccountForClient(account) {
  if (!account) return account;
  const { marketplaceBlockedAccounts: _privateBlocks, marketplaceIdentityVersion: _identityVersion, ...projected } = account;
  if (account.marketplace) {
    const { identityHandle: _identityHandle, identityVersion: _consentVersion, ...marketplace } = account.marketplace;
    projected.marketplace = { ...marketplace, enabled: hasMarketplaceConsent(account) };
  }
  projected.incomingCraftRequests = (account.incomingCraftRequests ?? []).map(request => projectCraftRequestForAccount(request, account.accountId));
  projected.outgoingCraftRequests = (account.outgoingCraftRequests ?? []).map(request => projectCraftRequestForAccount(request, account.accountId));
  return projected;
}
