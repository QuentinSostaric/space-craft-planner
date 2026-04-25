import {
  appendVaryHeader,
  buildHomeLinkHeader,
  buildMarkdownResponse,
  wantsMarkdown,
} from './_shared/agentMetadata.js';

function shouldBypass(pathname) {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/.well-known/')) return true;
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') return true;
  return /\.[a-z0-9]+$/iu.test(pathname);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!shouldBypass(url.pathname) && wantsMarkdown(request)) {
    return buildMarkdownResponse(request, env);
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
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
