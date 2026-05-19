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

export async function fetchTauriApiJson<T>(path: string): Promise<T | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<T>('fetch_api_json', { path });
}
