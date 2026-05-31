// First-party reverse proxy for PostHog.
//
// Browser tracker blockers (uBlock, Brave/Vivaldi shields, …) drop requests to
// *.posthog.com, so analytics from real visitors never arrive. Routing the
// traffic through our own domain (/ingest/*) makes it first-party and keeps it
// out of those block lists.
//
// Mirrors PostHog's recommended split: everything goes to the ingestion host
// except /static/* which is served by the assets host. The /ingest prefix is
// stripped before forwarding. See https://posthog.com/docs/advanced/proxy.

const DEFAULT_API_HOST = 'https://eu.i.posthog.com';

// Headers that must never be forwarded to PostHog: cookies would leak the
// first-party auth session, and Host must follow the upstream URL.
const STRIPPED_REQUEST_HEADERS = ['cookie', 'host', 'x-forwarded-host'];

function resolveUpstreams(env) {
  const apiHost = (env.POSTHOG_HOST ?? env.VITE_POSTHOG_HOST ?? DEFAULT_API_HOST)
    .trim()
    .replace(/\/+$/u, '');

  // eu.i.posthog.com -> eu-assets.i.posthog.com (region-aware).
  let assetHost = apiHost;
  try {
    const url = new URL(apiHost);
    url.hostname = url.hostname.replace(/^([^.]+)\./u, '$1-assets.');
    assetHost = url.origin;
  } catch {
    // Keep apiHost as the fallback when POSTHOG_HOST is malformed.
  }

  return { apiHost, assetHost };
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/ingest/u, '') || '/';

  const { apiHost, assetHost } = resolveUpstreams(env);
  const upstreamBase = subPath.startsWith('/static/') ? assetHost : apiHost;
  const upstreamUrl = `${upstreamBase}${subPath}${url.search}`;

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) {
    headers.delete(name);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'follow',
  });

  const response = new Response(upstream.body, upstream);
  // Don't let PostHog set cookies on our apex domain.
  response.headers.delete('set-cookie');
  return response;
}
