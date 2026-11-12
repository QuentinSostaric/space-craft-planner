import { describe, expect, it } from 'vitest';
import type { Blueprint } from '../types';
import { compareBlueprintRecency } from './blueprintRecency';
const item = (id: string, introducedInBuild?: string | null, name = id) => ({ id, name, introducedInBuild }) as Blueprint;
describe('blueprint recency', () => {
  it('sorts numeric builds newest first, keeps a deterministic tie order, and puts missing history last', () => {
    const rows=[item('old','9'),item('z','100'),item('missing'),item('a','100'),item('invalid','unknown'),item('null',null)];
    expect([...rows].sort(compareBlueprintRecency).map(b=>b.id)).toEqual(['a','z','old','invalid','missing','null']);
    expect(rows[0].id).toBe('old');
  });
});
