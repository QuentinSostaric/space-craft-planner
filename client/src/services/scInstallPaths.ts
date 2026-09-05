export const SC_PATHS_CHANGED = 'sc-install-paths-changed';
export interface CustomScPath { id: string; label: string; path: string }
export interface ScInstallPaths { live: string | null; ptu: string | null; channels?: string[] }

export function readCustomScPaths(): CustomScPath[] {
  const value: unknown = JSON.parse(localStorage.getItem('sc-custom-install-paths') ?? '[]');
  if (!Array.isArray(value) || value.some(p => !p || typeof p.path !== 'string' || !p.path.trim() || typeof p.label !== 'string')) {
    throw new Error('Saved installation paths are invalid. Remove and add them again in Settings.');
  }
  return value;
}

export function resolveScPaths(detected: ScInstallPaths, custom = readCustomScPaths()) {
  const entries = custom.map(p => ({ path: p.path.trim(), scope: p.label.toUpperCase() === 'LIVE' ? 'live' as const : 'ptu' as const }));
  for (const path of detected.channels ?? [detected.live, detected.ptu]) {
    if (!path) continue;
    const channel = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop()?.toUpperCase();
    entries.push({ path, scope: channel === 'LIVE' ? 'live' : 'ptu' });
  }
  const seen = new Set<string>();
  return entries.filter(({ path }) => {
    const key = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalized = /^[a-z]:/i.test(key) ? key.toLowerCase() : key;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
