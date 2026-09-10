import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '../../test/render';
import { AuthApiError, type OrganizationSharedBlueprintPayload, type OrganizationSharedResourcePayload, type AccountCraftRequest } from '../../services/authService';
import { useOrganizationCatalog } from './useOrganizationCatalog';
import { useOrganizationNavigation } from './useOrganizationNavigation';
import { hasVerifiedOrganizationIdentity, pendingOrganizationRequestKeys } from './organizationOffers';

const organization = { sid: 'TEST', name: 'Test Org', image: null, logo: null, url: null, claimed: false, blueprintSharingEnabled: true, lastLiveSyncAt: null, staleAt: null, memberCount: 0, syncStatus: 'never' as const };
const blueprints: OrganizationSharedBlueprintPayload = { organization, members: [] };
const resources: OrganizationSharedResourcePayload = { organization, members: [] };

beforeEach(() => window.history.replaceState({}, '', '/organizations'));

describe('organization catalog and navigation', () => {
  it('requires a verified RSI timestamp and provider before exposing organization catalogs', () => {
    const rsi = { handle: 'Citizen', displayName: null, profileUrl: null, verifiedAt: '2026-09-07T12:00:00Z', verificationProvider: 'citizenid' as const };
    expect(hasVerifiedOrganizationIdentity(rsi)).toBe(true);
    expect(hasVerifiedOrganizationIdentity({ ...rsi, verifiedAt: null })).toBe(false);
    expect(hasVerifiedOrganizationIdentity({ ...rsi, verifiedAt: 'invalid' })).toBe(false);
    expect(hasVerifiedOrganizationIdentity({ ...rsi, verificationRequired: true })).toBe(false);
    expect(hasVerifiedOrganizationIdentity({ ...rsi, verificationProvider: null })).toBe(false);
  });
  it('shows resources after a blueprint failure and retries only the failed endpoint', async () => {
    const loadBlueprints = vi.fn().mockRejectedValueOnce(new Error('Blueprint endpoint unavailable')).mockResolvedValue(blueprints);
    const loadResources = vi.fn().mockResolvedValue(resources);
    const { result } = renderHook(() => useOrganizationCatalog({ sid: 'TEST', loadBlueprints, loadResources }));
    await waitFor(() => expect(result.current.resources.data).toEqual(resources));
    expect(result.current.blueprints.error).toBe('Blueprint endpoint unavailable');
    act(() => result.current.blueprints.reload());
    await waitFor(() => expect(result.current.blueprints.data).toEqual(blueprints));
    expect(loadBlueprints).toHaveBeenCalledTimes(2);
    expect(loadResources).toHaveBeenCalledOnce();
  });

  it('recognizes genuine empty catalogs without swallowing an organization access error', async () => {
    const loadBlueprints = vi.fn().mockRejectedValue(new AuthApiError(404, 'No shared blueprints are available for this organization yet.'));
    const loadResources = vi.fn().mockRejectedValue(new AuthApiError(403, 'Only verified members may access this organization.'));
    const { result } = renderHook(() => useOrganizationCatalog({ sid: 'TEST', loadBlueprints, loadResources }));
    await waitFor(() => expect(result.current.blueprints.loading).toBe(false));
    expect(result.current.blueprints.error).toBeNull();
    expect(result.current.resources.error).toMatch(/verified members/);
  });

  it('ignores a late response from the previously selected organization', async () => {
    let resolveOld!: (value: OrganizationSharedBlueprintPayload) => void;
    const oldResponse = new Promise<OrganizationSharedBlueprintPayload>(resolve => { resolveOld = resolve; });
    const loadBlueprints = vi.fn((sid: string) => sid === 'OLD' ? oldResponse : Promise.resolve(blueprints));
    const loadResources = vi.fn().mockResolvedValue(resources);
    const { result, rerender } = renderHook(({ sid }) => useOrganizationCatalog({ sid, loadBlueprints, loadResources }), { initialProps: { sid: 'OLD' } });
    rerender({ sid: 'TEST' });
    await waitFor(() => expect(result.current.blueprints.data).toEqual(blueprints));
    await act(async () => resolveOld({ ...blueprints, organization: { ...organization, sid: 'OLD' } }));
    expect(result.current.blueprints.data?.organization.sid).toBe('TEST');
  });

  it('restores URL organization and tab and returns to the directory through browser history', async () => {
    const { result } = renderHook(useOrganizationNavigation);
    expect(result.current.sid).toBeNull();
    act(() => result.current.navigate('test', 'resources'));
    expect(window.location.search).toBe('?org=TEST&tab=resources');
    expect(result.current.tab).toBe('resources');
    act(() => window.history.back());
    await waitFor(() => expect(result.current.sid).toBeNull());
    act(() => window.history.forward());
    await waitFor(() => expect(result.current.tab).toBe('resources'));
    const reopened = renderHook(useOrganizationNavigation);
    expect(reopened.result.current.sid).toBe('TEST');
    expect(reopened.result.current.tab).toBe('resources');
  });

  it('keeps community and organization pending requests separate', () => {
    const base = { blueprintId: 'rifle', ownerRsiHandle: 'OtherCitizen', status: 'pending' };
    const requests = [
      { ...base, organizationSid: 'TEST', source: 'organization' },
      { ...base, organizationSid: null, source: 'community' },
      { ...base, organizationSid: 'OTHER', source: 'community' },
    ] as AccountCraftRequest[];
    expect([...pendingOrganizationRequestKeys(requests)]).toEqual(['TEST::rifle::othercitizen']);
  });
});
