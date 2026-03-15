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
  return jsonResponse({ message }, { status });
}

export function toSummary(doc, channel) {
  return {
    channel,
    datasetId: doc.datasetId,
    label: doc.label,
    version: doc.version,
    branch: doc.branch ?? null,
    buildNumber: doc.buildNumber ?? null,
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
    published: Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? doc.blueprints?.length ?? 0,
    resourceCount: doc.resourceCount ?? doc.resources?.length ?? 0,
    blueprints: doc.blueprints ?? [],
    resources: doc.resources ?? [],
    changelog: doc.changelog ?? null,
    dismantling: doc.dismantling ?? null,
    missionRewards: null,
    importedAt: doc.importedAt ?? null,
    updatedAt: doc.updatedAt ?? doc.importedAt ?? null,
  };
}
