import type { AccountCraftRequest, AccountInventoryResourceEntry, LinkedRsiAccount, OrganizationSharedBlueprintPayload, OrganizationSharedResourcePayload } from '../../services/authService';
import type { Blueprint } from '../../types';
import type { SharedOfferOwner } from './sharedOfferTypes';

export interface OrganizationBlueprintOffer { key: string; blueprint: Blueprint; owner: SharedOfferOwner }
export interface OrganizationResourceOffer { key: string; entry: AccountInventoryResourceEntry; owner: SharedOfferOwner }
export interface OrganizationContributor { owner: SharedOfferOwner; blueprintCount: number; resourceCount: number }
export function hasVerifiedOrganizationIdentity(rsi: LinkedRsiAccount | null | undefined): boolean {
  return Boolean(rsi?.handle.trim()) && rsi?.verificationRequired !== true
    && Number.isFinite(Date.parse(rsi?.verifiedAt ?? ''))
    && (rsi?.verificationProvider === 'citizenid' || rsi?.verificationProvider === 'rsi-profile');
}
export function normalizeOfferSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}
export function organizationRequestKey(sid: string, blueprintId: string, handle: string | null | undefined) {
  return `${sid.trim().toUpperCase()}::${blueprintId}::${normalizeOfferSearch(handle ?? '')}`;
}
export function pendingOrganizationRequestKeys(requests: AccountCraftRequest[]) {
  return new Set(requests.filter(request => request.status === 'pending' && request.source !== 'community' && request.organizationSid).map(request => organizationRequestKey(request.organizationSid ?? '', request.blueprintId, request.ownerRsiHandle)));
}
export function buildOrganizationOffers(blueprintPayload: OrganizationSharedBlueprintPayload | null, resourcePayload: OrganizationSharedResourcePayload | null, blueprintById: Map<string, Blueprint>) {
  const blueprints: OrganizationBlueprintOffer[] = [];
  const resources: OrganizationResourceOffer[] = [];
  const contributors = new Map<string, OrganizationContributor>();
  let hiddenBlueprintCount = 0;
  const ownerFromMember = (member: { handle: string; display: string; image: string | null; rank: string | null }): SharedOfferOwner => ({ handle: member.handle, displayName: member.display, imageUrl: member.image, rank: member.rank });
  const contributor = (owner: SharedOfferOwner) => {
    const key = normalizeOfferSearch(owner.handle);
    if (!contributors.has(key)) contributors.set(key, { owner, blueprintCount: 0, resourceCount: 0 });
    return contributors.get(key)!;
  };
  // These endpoint payloads contain only verified RSI/organization members.
  // Do not supplement them with an unverified roster or account lookup.
  for (const member of blueprintPayload?.members ?? []) {
    if (!member.handle.trim()) continue;
    const owner = ownerFromMember(member);
    for (const id of new Set(member.sharedBlueprintIds)) {
      contributor(owner).blueprintCount += 1;
      const blueprint = blueprintById.get(id);
      if (!blueprint) { hiddenBlueprintCount += 1; continue; }
      blueprints.push({ key: `${owner.handle}:${id}`, blueprint, owner });
    }
  }
  for (const member of resourcePayload?.members ?? []) {
    if (!member.handle.trim()) continue;
    const owner = ownerFromMember(member);
    for (const entry of member.sharedResources) {
      contributor(owner).resourceCount += 1;
      resources.push({ key: `${owner.handle}:${entry.id}`, entry, owner });
    }
  }
  return { blueprints, resources, contributors: [...contributors.values()], hiddenBlueprintCount };
}
