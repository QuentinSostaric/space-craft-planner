import { invoke } from '@tauri-apps/api/core';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const runtimeApiBaseUrl = configuredApiBaseUrl || (isTauriRuntime() ? 'https://itemfab.space' : '');

export function getApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!runtimeApiBaseUrl) {
    return path;
  }

  return `${runtimeApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getApiCredentials(): RequestCredentials {
  return runtimeApiBaseUrl ? 'include' : 'same-origin';
}

export type DesktopPlatform = 'windows' | 'linux' | 'macos';

/** Flathub app-id of the Linux Flatpak (see flatpak/). */
export const FLATHUB_APP_ID = 'space.itemfab.ItemFabricator';

export function getDetectedPlatform(): DesktopPlatform | null {
  if (typeof navigator === 'undefined') return null;
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase();
    if (p === 'windows' || p === 'linux' || p === 'macos') return p as DesktopPlatform;
  }
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macos';
  if (/linux|x11/i.test(ua)) return 'linux';
  return null;
}

/**
 * URL of the latest installer for the detected (or given) platform. On Linux,
 * pass `format: 'appimage'` to pin the AppImage (the `.deb` is reserved as the
 * Flathub Flatpak source, not for direct download).
 */
export function getDesktopInstallerUrl(options?: { platform?: DesktopPlatform | null; format?: 'appimage' }): string {
  const platform = options?.platform === undefined ? getDetectedPlatform() : options.platform;
  const params = new URLSearchParams();
  if (platform) params.set('platform', platform);
  if (options?.format) params.set('format', options.format);
  const query = params.toString();
  return getApiUrl(`/api/desktop/latest-installer${query ? `?${query}` : ''}`);
}

/**
 * `appstream://` URI that opens the system software center (GNOME Software /
 * Zorin "Software", Discover, …) on the Flatpak's page so the user can install it.
 */
export function getFlatpakInstallUri(): string {
  return `appstream://${FLATHUB_APP_ID}`;
}

export async function fetchTauriApiJson<T>(path: string): Promise<T | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<T>('fetch_api_json', { path });
}

export async function fetchTauriApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  let body: unknown = null;
  if (typeof init?.body === 'string' && init.body.trim()) {
    body = JSON.parse(init.body);
  }

  return invoke<T>('fetch_api_json', {
    path,
    method: init?.method ?? 'GET',
    body,
  });
}

export async function startDesktopOAuth(flow: 'discord' | 'citizenid'): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke('start_desktop_oauth', {
    payload: { flow },
  });
}

export async function clearDesktopAuthSession(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke('clear_desktop_auth_session');
}
