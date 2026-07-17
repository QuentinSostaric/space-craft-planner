/** Convert a blueprint name to a URL-safe slug. */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Extract a blueprint slug from a pathname like /item/some-slug. Returns null if no match. */
export function itemSlugFromPathname(pathname: string): string | null {
  const match = /^\/item\/(.+)$/.exec(pathname);
  return match ? match[1] : null;
}

/** Backward-compatible alias for item slug parsing. */
export function slugFromPathname(pathname: string): string | null {
  return itemSlugFromPathname(pathname);
}

/** Extract a mission slug from a pathname like /missions/some-slug. Returns null if no match. */
export function missionSlugFromPathname(pathname: string): string | null {
  const match = /^\/missions\/(.+)$/.exec(pathname);
  return match ? match[1] : null;
}

/** Extract a resource slug from a pathname like /resources/some-slug. Returns null if no match. */
export function resourceSlugFromPathname(pathname: string): string | null {
  const match = /^\/resources\/(.+)$/.exec(pathname);
  return match ? match[1] : null;
}

export function mainViewFromPathname(pathname: string): 'fabricator' | 'blueprints' | 'missions' | 'resources' | 'organizations' | 'planner' | 'changelog' | 'account' | 'privacy' {
  if (pathname === '/' || pathname === '/fabricator' || pathname.startsWith('/fabricator/')) return 'fabricator';
  if (pathname === '/missions' || pathname.startsWith('/missions/')) return 'missions';
  if (pathname === '/resources' || pathname.startsWith('/resources/')) return 'resources';
  if (pathname === '/organizations' || pathname.startsWith('/organizations/')) return 'organizations';
  if (pathname === '/planner' || pathname.startsWith('/planner/')) return 'planner';
  if (pathname === '/changelog' || pathname.startsWith('/changelog/')) return 'changelog';
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'account';
  if (pathname === '/privacy' || pathname.startsWith('/privacy/')) return 'privacy';
  return 'blueprints';
}

export function missionSlugFromContract(
  contractDebugName: string | null | undefined,
  contractorDisplayName?: string | null,
): string {
  const basis = [contractorDisplayName, contractDebugName].filter(Boolean).join(' ');
  return toSlug(basis || 'mission');
}

export function missionPathFromSlug(slug: string | null | undefined): string {
  return slug ? `/missions/${slug}` : '/missions';
}

export function resourcePathFromSlug(slug: string | null | undefined): string {
  return slug ? `/resources/${slug}` : '/resources';
}

export function navigateToPath(path: string, state?: Record<string, unknown>): void {
  window.history.pushState(state ?? null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: state ?? null }));
}
