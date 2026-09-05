import {
  appendVaryHeader,
  buildHomeLinkHeader,
  buildMarkdownResponse,
  wantsMarkdown,
} from './_shared/agentMetadata.js';

function shouldBypass(pathname) {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/ingest/')) return true;
  if (pathname.startsWith('/.well-known/')) return true;
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') return true;
  return /\.[a-z0-9]+$/iu.test(pathname);
}

// Fallback Content-Security-Policy for dynamic responses that don't already set
// one (static assets get an equivalent policy from client/public/_headers). This
// mirrors that policy so JSON/API responses — and any document that falls
// through — are constrained rather than left with only frame-ancestors. Note:
// `upgrade-insecure-requests` is intentionally omitted because the middleware
// also runs over plain http during local dev, where upgrading would break the
// API calls. Responses that need inline scripts (the desktop OAuth redirect page)
// set their own nonce-based CSP and are therefore left untouched below.
const FALLBACK_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-src 'none'",
  "form-action 'self'",
].join('; ');

// Baseline security headers applied to every response. Intentionally
// conservative so resource loading (Vite assets, PostHog, Discord/RSI images)
// is not broken: clickjacking is blocked via frame-ancestors / X-Frame-Options,
// MIME sniffing is disabled, the referrer is trimmed cross-origin, and HSTS is
// set (browsers ignore it over plain http, so it is safe for localhost dev).
function applySecurityHeaders(headers) {
  if (!headers.has('X-Content-Type-Options')) {
    headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (!headers.has('X-Frame-Options')) {
    headers.set('X-Frame-Options', 'DENY');
  }
  if (!headers.has('Referrer-Policy')) {
    headers.set('Referrer-Policy', 'no-referrer');
  }
  if (!headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (!headers.has('Permissions-Policy')) {
    headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  }
  if (!headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', FALLBACK_CSP);
  }
  return headers;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!shouldBypass(url.pathname) && wantsMarkdown(request)) {
    const markdownResponse = await buildMarkdownResponse(request, env);
    const markdownHeaders = applySecurityHeaders(new Headers(markdownResponse.headers));
    return new Response(markdownResponse.body, {
      status: markdownResponse.status,
      statusText: markdownResponse.statusText,
      headers: markdownHeaders,
    });
  }

  const response = await context.next();
  const headers = applySecurityHeaders(new Headers(response.headers));
  appendVaryHeader(headers, 'Accept');
  if (url.pathname === '/') {
    headers.set('Link', buildHomeLinkHeader(new URL(request.url).origin));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
