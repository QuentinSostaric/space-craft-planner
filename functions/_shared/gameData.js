export const SUMMARY_PROJECTION = {
  _id: 0,
  blueprints: 0,
  resources: 0,
  dismantling: 0,
  missionRewards: 0,
  changelog: 0,
  metrics: 0,
  sourceFiles: 0,
};

export const CORE_PROJECTION = {
  _id: 0,
  missionRewards: 0,
  metrics: 0,
  sourceFiles: 0,
  installPath: 0,
  outputLabel: 0,
};

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

const PAGES_PROJECT_HOSTNAME = 'space-craft-planner.pages.dev';
const PREVIEW_HOSTNAME = `preview.${PAGES_PROJECT_HOSTNAME}`;
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
  if (hostname === PREVIEW_HOSTNAME) {
    return true;
  }

  return hostname.endsWith(`.${PAGES_PROJECT_HOSTNAME}`) && hostname !== PAGES_PROJECT_HOSTNAME;
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

export function buildDatasetVisibilityFilter(request, env) {
  return shouldExposeUnpublishedDatasets(request, env) ? {} : { published: true };
}

export function toSummary(doc, channel) {
  return {
    channel,
    datasetId: doc.datasetId,
    label: doc.label,
    version: doc.version,
    branch: doc.branch ?? null,
    buildNumber: doc.buildNumber ?? null,
    buildDateStamp: doc.buildDateStamp ?? null,
    buildTimeStamp: doc.buildTimeStamp ?? null,
    published: Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? (doc.blueprints?.length ?? 0),
    resourceCount: doc.resourceCount ?? (doc.resources?.length ?? 0),
    hasDismantling: Boolean(doc.dismantlingAvailable ?? doc.dismantling),
    hasMissionRewards:
      (doc.missionRewardContractCount ?? 0) > 0 ||
      (doc.missionRewardFactionGroupCount ?? 0) > 0,
    missionRewardContractCount: doc.missionRewardContractCount ?? 0,
    missionRewardFactionGroupCount: doc.missionRewardFactionGroupCount ?? 0,
    importedAt: doc.importedAt ?? null,
    updatedAt: doc.updatedAt ?? doc.importedAt ?? null,
    hasChangelog: Boolean(doc.changelog),
  };
}

export function normalizeCoreDataset(doc, channel) {
  if (!doc) {
    return null;
  }

  return {
    channel,
    datasetId: doc.datasetId,
    label: doc.label,
    version: doc.version,
    branch: doc.branch ?? null,
    buildNumber: doc.buildNumber ?? null,
    buildDateStamp: doc.buildDateStamp ?? null,
    buildTimeStamp: doc.buildTimeStamp ?? null,
    published: Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? doc.blueprints?.length ?? 0,
    resourceCount: doc.resourceCount ?? doc.resources?.length ?? 0,
    blueprints: doc.blueprints ?? [],
    manufacturers: doc.manufacturers ?? [],
    resources: doc.resources ?? [],
    resourceInsights: doc.resourceInsights ?? null,
    changelog: doc.changelog ?? null,
    dismantling: doc.dismantling ?? null,
    materialSources: doc.materialSources ?? null,
    missionRewards: null,
    shipComponents: doc.shipComponents ?? null,
    importedAt: doc.importedAt ?? null,
    updatedAt: doc.updatedAt ?? doc.importedAt ?? null,
  };
}
