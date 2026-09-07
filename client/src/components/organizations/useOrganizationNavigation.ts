import { useCallback, useEffect, useState } from 'react';

export type OrganizationTab = 'blueprints' | 'resources' | 'members';
export interface OrganizationLocation { sid: string | null; tab: OrganizationTab }
function readLocation(): OrganizationLocation {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('tab');
  return { sid: params.get('org')?.trim().toUpperCase() || null, tab: requested === 'resources' || requested === 'members' ? requested : 'blueprints' };
}
export function useOrganizationNavigation() {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((sid: string | null, tab: OrganizationTab = 'blueprints') => {
    const normalized = sid?.trim().toUpperCase() || null;
    const url = new URL(window.location.href);
    if (normalized) { url.searchParams.set('org', normalized); url.searchParams.set('tab', tab); }
    else { url.searchParams.delete('org'); url.searchParams.delete('tab'); }
    if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url);
    setLocation({ sid: normalized, tab });
  }, []);
  return { ...location, navigate };
}
