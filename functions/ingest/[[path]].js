import { readBoundedBody } from '../_shared/requestBody.js';

const POSTHOG_UPSTREAMS = new Map([
  ['https://eu.i.posthog.com', 'https://eu-assets.i.posthog.com'],
  ['https://us.i.posthog.com', 'https://us-assets.i.posthog.com'],
]);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
// An allowlist prevents app bearer tokens, Access credentials, and future
// authentication headers from ever leaving the first-party origin.
const FORWARDED_HEADERS = ['accept', 'accept-encoding', 'content-type', 'content-encoding', 'user-agent'];

function errorResponse(status, message) {
  return new Response(message, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
  }
  const apiHost = String(env.POSTHOG_HOST ?? env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com').trim().replace(/\/+$/u, '');
  const assetHost = POSTHOG_UPSTREAMS.get(apiHost);
  if (!assetHost) return errorResponse(503, 'Analytics unavailable.');

  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/ingest/u, '') || '/';
  if (!subPath.startsWith('/') || subPath.startsWith('//') || /\\|%(?:2f|5c|2e|00)/iu.test(subPath)) {
    return errorResponse(400, 'Invalid analytics path.');
  }
  const upstreamBase = (subPath.startsWith('/static/') || subPath.startsWith('/array/')) ? assetHost : apiHost;
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  }

  try {
    const body = request.method === 'POST' ? await readBoundedBody(request, MAX_BODY_BYTES) : undefined;
    const upstream = await fetch(`${upstreamBase}${subPath}${url.search}`, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    // Do not follow or relay redirects: the app CSP trusts this same-origin proxy.
    if (upstream.status >= 300 && upstream.status < 400) {
      return errorResponse(502, 'Unexpected analytics redirect.');
    }
    const response = new Response(upstream.body, upstream);
    response.headers.delete('set-cookie');
    response.headers.delete('clear-site-data');
    response.headers.delete('access-control-allow-origin');
    response.headers.delete('access-control-allow-credentials');
    if (request.method === 'POST') response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error instanceof RangeError ? 413 : 502,
      error instanceof RangeError ? 'Request body too large.' : 'Analytics unavailable.');
  }
}
