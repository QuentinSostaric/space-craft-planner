const GITHUB_RELEASE_API =
  'https://api.github.com/repos/QuentinSostaric/space-craft-planner/releases/latest';

const PLATFORM_ASSET_MATCHERS = {
  windows: [/\.exe$/i, /\.msi$/i],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i],
  macos: [/\.dmg$/i, /\.app\.tar\.gz$/i],
};

function getRequestedPlatform(request) {
  const url = new URL(request.url);
  const explicit = url.searchParams.get('platform')?.toLowerCase();
  if (explicit && Object.prototype.hasOwnProperty.call(PLATFORM_ASSET_MATCHERS, explicit)) {
    return explicit;
  }

  const ua = request.headers.get('user-agent') ?? '';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux|x11/i.test(ua)) return 'linux';
  if (/macintosh|mac os x/i.test(ua)) return 'macos';
  return 'windows';
}

function selectInstallerAsset(assets, platform) {
  const matchers = PLATFORM_ASSET_MATCHERS[platform] ?? PLATFORM_ASSET_MATCHERS.windows;
  return assets.find((asset) => matchers.some((matcher) => matcher.test(asset.name)))
    ?? assets.find((asset) => /\.exe$|\.msi$|\.AppImage$|\.deb$|\.rpm$/i.test(asset.name));
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export async function onRequestGet(context) {
  const platform = getRequestedPlatform(context.request);
  const releaseResponse = await fetch(GITHUB_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'itemfab-pages-functions',
    },
    cf: { cacheTtl: 300, cacheEverything: true },
  });

  if (!releaseResponse.ok) {
    return jsonResponse(502, { error: 'latest_release_unavailable' });
  }

  const release = await releaseResponse.json();
  const asset = selectInstallerAsset(release.assets ?? [], platform);
  if (!asset?.browser_download_url) {
    return jsonResponse(404, { error: 'installer_not_found', platform });
  }

  return Response.redirect(asset.browser_download_url, 302);
}
