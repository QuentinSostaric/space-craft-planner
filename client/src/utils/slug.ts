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

export function mainViewFromPathname(pathname: string): 'blueprints' | 'missions' {
  return pathname === '/missions' || pathname.startsWith('/missions/')
    ? 'missions'
    : 'blueprints';
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

export function navigateToPath(path: string, state?: Record<string, unknown>): void {
  window.history.pushState(state ?? null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: state ?? null }));
}
