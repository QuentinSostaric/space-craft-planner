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
  const pagesProjectHostnames = [
    'itemfab.pages.dev',
    'space-craft-planner.pages.dev',
  ];

  return (
    hostname.startsWith('preview.') ||
    pagesProjectHostnames.some(
      (projectHostname) =>
        hostname.endsWith(`.${projectHostname}`) &&
        hostname !== projectHostname,
    )
  );
}

export function resolveRuntimeStorageScope(env, request = null) {
  const branch = normalizeText(env?.CF_PAGES_BRANCH).toLowerCase();
  if (branch) {
    return branch === 'production' || branch === 'prod' ? 'prod' : 'dev';
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
    return env?.GAME_DATA_DEV ?? env?.GAME_DATA ?? null;
  }

  return env?.GAME_DATA_PROD ?? env?.GAME_DATA ?? null;
}
