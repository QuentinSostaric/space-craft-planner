import { invoke } from '@tauri-apps/api/core';
import { requireInternalPath } from '../utils/urlSafety';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const runtimeApiBaseUrl = configuredApiBaseUrl || (isTauriRuntime() ? 'https://itemfab.space' : '');

export function getApiUrl(path: string): string {
  const safePath = requireInternalPath(path);

  if (!runtimeApiBaseUrl) {
    return safePath;
  }

  return `${runtimeApiBaseUrl}${safePath}`;
}

export function getApiCredentials(): RequestCredentials {
  return runtimeApiBaseUrl ? 'include' : 'same-origin';
}

export function getDesktopInstallerUrl(): string {
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  let platform: string | null = null;
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase();
    if (p === 'windows' || p === 'linux' || p === 'macos') platform = p;
  }
  if (!platform) {
    const ua = navigator.userAgent;
    if (/windows/i.test(ua)) platform = 'windows';
    else if (/macintosh|mac os x/i.test(ua)) platform = 'macos';
    else if (/linux|x11/i.test(ua)) platform = 'linux';
  }
  return getApiUrl(`/api/desktop/latest-installer${platform ? `?platform=${platform}` : ''}`);
}

export async function fetchTauriApiJson<T>(path: string): Promise<T | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<T>('fetch_api_json', { path: requireInternalPath(path) });
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
    path: requireInternalPath(path),
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
