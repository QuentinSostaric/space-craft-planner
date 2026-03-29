function normalizeText(value) {
  return String(value ?? '').trim();
}

function getHostnameFromRequest(request) {
  try {
    return new URL(request?.url ?? '').hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isPreviewHostname(hostname) {
  return (
    hostname.startsWith('preview.') ||
    (hostname.endsWith('.space-craft-planner.pages.dev') &&
      hostname !== 'space-craft-planner.pages.dev')
  );
}

export function resolveRuntimeStorageScope(env, request = null) {
  const branch = normalizeText(env?.CF_PAGES_BRANCH).toLowerCase();
  if (branch) {
    return branch === 'main' ? 'prod' : 'dev';
  }

  const hostname = getHostnameFromRequest(request);
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    isPreviewHostname(hostname)
  ) {
    return 'dev';
  }

  return 'prod';
}

export function getGameDataBucket(env, request = null) {
  const scope = resolveRuntimeStorageScope(env, request);
  if (scope === 'dev') {
    return env?.GAME_DATA_DEV ?? env?.GAME_DATA ?? env?.GAME_DATA_PROD ?? null;
  }

  return env?.GAME_DATA_PROD ?? env?.GAME_DATA ?? env?.GAME_DATA_DEV ?? null;
}
