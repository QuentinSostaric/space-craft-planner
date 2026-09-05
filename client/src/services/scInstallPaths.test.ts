import { beforeEach, describe, expect, it } from 'vitest';
import { readCustomScPaths, resolveScPaths } from './scInstallPaths';

describe('Star Citizen installation paths', () => {
  beforeEach(() => localStorage.clear());
  it('includes all custom and detected channels, preferring custom LIVE for monitoring', () => {
    localStorage.setItem('sc-custom-install-paths', JSON.stringify([
      { id: '1', label: 'LIVE', path: 'Z:\\My Games\\LIVE' },
      { id: '2', label: 'EPTU', path: 'Y:\\SC\\EPTU' },
    ]));
    expect(resolveScPaths({ live: 'C:\\StarCitizen\\LIVE', ptu: null, channels: ['C:\\StarCitizen\\LIVE', 'D:\\SC\\PTU'] })).toEqual([
      { path: 'Z:\\My Games\\LIVE', scope: 'live' },
      { path: 'Y:\\SC\\EPTU', scope: 'ptu' },
      { path: 'C:\\StarCitizen\\LIVE', scope: 'live' },
      { path: 'D:\\SC\\PTU', scope: 'ptu' },
    ]);
  });
  it('deduplicates Windows paths regardless of casing or separators', () => {
    expect(resolveScPaths({ live: 'Z:\\Games\\LIVE', ptu: null }, [{ id: '1', label: 'LIVE', path: 'z:/games/live/' }])).toHaveLength(1);
  });
  it('reports invalid saved configuration', () => {
    localStorage.setItem('sc-custom-install-paths', '{}');
    expect(readCustomScPaths).toThrow('Saved installation paths are invalid');
  });
});
