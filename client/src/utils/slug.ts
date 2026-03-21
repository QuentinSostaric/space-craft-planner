/** Convert a blueprint name to a URL-safe slug. */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Extract a blueprint slug from a pathname like /item/some-slug. Returns null if no match. */
export function slugFromPathname(pathname: string): string | null {
  const match = /^\/item\/(.+)$/.exec(pathname);
  return match ? match[1] : null;
}
