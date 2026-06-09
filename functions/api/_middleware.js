// Packaged desktop builds serve the webview over https://tauri.localhost. The
// plaintext http:// variant is intentionally excluded: it must never be a
// credentialed CORS origin.
const DESKTOP_ALLOWED_ORIGINS = new Set(['https://tauri.localhost']);

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin') ?? '';
  return DESKTOP_ALLOWED_ORIGINS.has(origin) ? origin : null;
}

export async function onRequest(context) {
  const { request } = context;
  const corsOrigin = getCorsOrigin(request);

  // Handle preflight
  if (request.method === 'OPTIONS' && corsOrigin) {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  const response = await context.next();

  if (!corsOrigin) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', corsOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
