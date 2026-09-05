import { getSessionCookieName, parseCookieHeader } from './discordAuth.mjs';

export function isTrustedAuthMutationRequest(request, env = {}) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set([requestOrigin, 'https://tauri.localhost']);
  if (env.AUTH_PUBLIC_ORIGIN) {
    try {
      allowedOrigins.add(new URL(env.AUTH_PUBLIC_ORIGIN).origin);
    } catch {
      return false;
    }
  }
  const origin = request.headers.get('Origin');
  if (origin !== null) {
    return allowedOrigins.has(origin);
  }

  // Native bearer clients do not send Origin. Browsers using ambient cookies
  // must supply a same-origin Origin or Referer; SameSite alone is insufficient
  // for sibling subdomains and legacy desktop cookies using SameSite=None.
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return false;
  }
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return allowedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return !parseCookieHeader(request.headers.get('Cookie'))[getSessionCookieName()];
}
