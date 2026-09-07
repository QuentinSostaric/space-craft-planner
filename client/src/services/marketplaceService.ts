import {
  authApiFetch,
  withDatasetScope,
  type AccountCraftRequest,
  type AccountCraftRequestResourcesOption,
  type AccountDatasetScope,
  type AccountInventoryResourceEntry,
  type MarketplaceSettings,
  type StoredAccount,
} from './authService';

export interface MarketplaceMember {
  handle: string;
  display: string;
  profileUrl: string;
  sharedBlueprintIds: string[];
  sharedResources: Omit<AccountInventoryResourceEntry, 'createdAt' | 'updatedAt'>[];
  updatedAt: string | null;
}

export interface MarketplacePage {
  datasetScope: AccountDatasetScope;
  members: MarketplaceMember[];
  nextCursor: string | null;
}

export interface MarketplaceFilters {
  blueprintId?: string;
  resourceId?: string;
  ownerHandle?: string;
  cursor?: string;
  limit?: number;
}

export type MarketplacePublication = Pick<
  MarketplaceSettings,
  'enabled' | 'blueprintIds' | 'resourceEntryIds'
>;
export interface MarketplaceCraftDraft {
  blueprintId: string;
  blueprintName?: string;
  ownerHandle: string;
  comment?: string | null;
  resourcesOption?: AccountCraftRequestResourcesOption;
}
export type MarketplaceReportReason = 'spam' | 'misleading' | 'abuse';
export interface MarketplaceReport {
  id: string;
  ownerHandle: string;
  reporterHandle: string | null;
  reason: MarketplaceReportReason;
  status: 'pending' | 'dismissed' | 'suspended' | 'restored';
  createdAt: string;
}

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function fetchMarketplace(scope: AccountDatasetScope, filters: MarketplaceFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return authApiFetch<MarketplacePage>(withDatasetScope(`/api/auth/marketplace?${params}`, scope));
}

export function saveMarketplacePublication(scope: AccountDatasetScope, publication: MarketplacePublication) {
  return authApiFetch<{ account: StoredAccount }>(
    withDatasetScope('/api/auth/account/marketplace', scope),
    jsonRequest('PUT', publication),
  );
}

export function createMarketplaceCraftRequest(scope: AccountDatasetScope, draft: MarketplaceCraftDraft) {
  return authApiFetch<{ account: StoredAccount; request: AccountCraftRequest }>(
    withDatasetScope('/api/auth/marketplace/craft-requests', scope),
    jsonRequest('POST', draft),
  );
}

export function setMarketplaceBlock(scope: AccountDatasetScope, handle: string, blocked: boolean) {
  return authApiFetch<{ account: StoredAccount }>(
    withDatasetScope('/api/auth/marketplace/block', scope),
    jsonRequest('POST', { handle, blocked }),
  );
}

export function reportMarketplaceMember(
  scope: AccountDatasetScope,
  ownerHandle: string,
  reason: MarketplaceReportReason,
) {
  return authApiFetch<{ report: { id: string; status: 'pending' } }>(
    withDatasetScope('/api/auth/marketplace/reports', scope),
    jsonRequest('POST', { ownerHandle, reason }),
  );
}

export function fetchMarketplaceReports(scope: AccountDatasetScope, cursor?: string) {
  return authApiFetch<{ reports: MarketplaceReport[]; nextCursor: string | null }>(
    withDatasetScope(
      `/api/auth/marketplace/reports?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      scope,
    ),
  );
}

export function moderateMarketplaceReport(
  scope: AccountDatasetScope,
  id: string,
  action: 'dismiss' | 'suspend' | 'restore',
) {
  return authApiFetch<{ report: MarketplaceReport }>(
    withDatasetScope(`/api/auth/marketplace/reports/${encodeURIComponent(id)}`, scope),
    jsonRequest('PATCH', { action }),
  );
}
