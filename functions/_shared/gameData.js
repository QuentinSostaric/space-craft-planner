export function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(payload), { ...init, headers });
}

export function errorResponse(status, message) {
  return jsonResponse(
    { message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

export function publicApiJsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
  }
  return jsonResponse(payload, { ...init, headers });
}

const PAGES_PROJECT_HOSTNAMES = ['itemfab.pages.dev', 'space-craft-planner.pages.dev'];
const PREVIEW_HOSTNAMES = new Set(
  PAGES_PROJECT_HOSTNAMES.map((hostname) => `preview.${hostname}`),
);
const LOCAL_DATASET_HOSTS = new Set(['localhost', '127.0.0.1']);

function getAllowedUnpublishedDatasetHosts(env) {
  const hosts = new Set(LOCAL_DATASET_HOSTS);

  if (env?.ALLOW_UNPUBLISHED_DATASET_HOSTS) {
    for (const host of String(env.ALLOW_UNPUBLISHED_DATASET_HOSTS)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)) {
      hosts.add(host);
    }
  }

  return hosts;
}

function isPagesPreviewHostname(hostname) {
  if (PREVIEW_HOSTNAMES.has(hostname)) {
    return true;
  }

  return PAGES_PROJECT_HOSTNAMES.some(
    (projectHostname) =>
      hostname.endsWith(`.${projectHostname}`) &&
      hostname !== projectHostname,
  );
}

export function shouldExposeUnpublishedDatasets(request, env) {
  if (!request?.url) {
    return false;
  }

  const { hostname } = new URL(request.url);
  const normalizedHostname = hostname.toLowerCase();

  return (
    getAllowedUnpublishedDatasetHosts(env).has(normalizedHostname) ||
    isPagesPreviewHostname(normalizedHostname)
  );
}

export function getDatasetVisibilityNamespace(request, env) {
  return shouldExposeUnpublishedDatasets(request, env) ? 'all' : 'public';
}

export function isValidChannel(channel) {
  return channel === 'live' || channel === 'ptu';
}

export function compareDatasetSummaries(a, b) {
  const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
  const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }

  const buildA = Number(a.buildNumber ?? 0);
  const buildB = Number(b.buildNumber ?? 0);
  if (buildA !== buildB) {
    return buildB - buildA;
  }

  return String(b.version ?? '').localeCompare(String(a.version ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}
