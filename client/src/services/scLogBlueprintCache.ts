import type { AccountDatasetScope } from './authService';

const SC_LOG_BLUEPRINT_CACHE_KEY = 'sc-log-blueprint-names-v1';

type BlueprintNameCache = Partial<Record<AccountDatasetScope, string[]>>;

function readCache(): BlueprintNameCache {
  try {
    const raw = localStorage.getItem(SC_LOG_BLUEPRINT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BlueprintNameCache;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      live: Array.isArray(parsed.live) ? parsed.live.filter((n) => typeof n === 'string') : [],
      ptu: Array.isArray(parsed.ptu) ? parsed.ptu.filter((n) => typeof n === 'string') : [],
    };
  } catch {
    return {};
  }
}

function writeCache(cache: BlueprintNameCache) {
  localStorage.setItem(SC_LOG_BLUEPRINT_CACHE_KEY, JSON.stringify(cache));
}

export function getCachedScLogBlueprintNames(scope: AccountDatasetScope): string[] {
  return readCache()[scope] ?? [];
}

export function rememberScLogBlueprintNames(
  scope: AccountDatasetScope,
  names: readonly string[],
): string[] {
  const cleanedNames = names.map((name) => name.trim()).filter(Boolean);
  if (cleanedNames.length === 0) {
    return getCachedScLogBlueprintNames(scope);
  }

  const cache = readCache();
  const mergedNames = [...new Set([...(cache[scope] ?? []), ...cleanedNames])];
  cache[scope] = mergedNames;
  writeCache(cache);
  return mergedNames;
}
