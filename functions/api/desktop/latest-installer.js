const GITHUB_RELEASE_API =
  'https://api.github.com/repos/QuentinSostaric/space-craft-planner/releases/latest';

// Matchers are listed in preference order: the first matcher with a matching
// asset wins. On Linux the AppImage is preferred for direct download (the .deb
// is reserved as the Flathub Flatpak source).
const PLATFORM_ASSET_MATCHERS = {
  windows: [/\.exe$/i, /\.msi$/i],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i],
  macos: [/\.dmg$/i, /\.app\.tar\.gz$/i],
};

// Optional `format` query param pins a specific bundle regardless of platform.
const FORMAT_MATCHERS = {
  appimage: /\.AppImage$/i,
  deb: /\.deb$/i,
  rpm: /\.rpm$/i,
  exe: /\.exe$/i,
  msi: /\.msi$/i,
  dmg: /\.dmg$/i,
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

function getRequestedFormat(request) {
  const format = new URL(request.url).searchParams.get('format')?.toLowerCase();
  return format && Object.prototype.hasOwnProperty.call(FORMAT_MATCHERS, format) ? format : null;
}

function selectInstallerAsset(assets, platform, format) {
  if (format) {
    return assets.find((asset) => FORMAT_MATCHERS[format].test(asset.name)) ?? null;
  }
  const matchers = PLATFORM_ASSET_MATCHERS[platform] ?? PLATFORM_ASSET_MATCHERS.windows;
  // Honour matcher preference order: try each matcher across all assets in turn.
  for (const matcher of matchers) {
    const match = assets.find((asset) => matcher.test(asset.name));
    if (match) return match;
  }
  return assets.find((asset) => /\.exe$|\.msi$|\.AppImage$|\.deb$|\.rpm$|\.dmg$/i.test(asset.name)) ?? null;
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
  const format = getRequestedFormat(context.request);
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
  const asset = selectInstallerAsset(release.assets ?? [], platform, format);
  if (!asset?.browser_download_url) {
    return jsonResponse(404, { error: 'installer_not_found', platform, format });
  }

  return Response.redirect(asset.browser_download_url, 302);
}
