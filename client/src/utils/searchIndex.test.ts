import { describe, expect, it } from 'vitest';
import { createSearchIndex, searchIndex } from './searchIndex';
const entries = [
  { label: 'CQ7 Rifle Magazine', description: 'Behring / Ammo' },
  { label: 'CQ7 Rifle', description: 'Behring / FPS' },
  { label: 'Aluminium', description: 'Métal / Ressource' },
];
const index = createSearchIndex(entries);
describe('search ranking', () => {
  it('puts exact titles before prefixes', () =>
    expect(searchIndex(index, 'cq7 rifle')).toEqual([entries[1], entries[0]]));
  it('matches accents, punctuation and words in any order', () => {
    expect(searchIndex(index, 'ressource metal')).toEqual([entries[2]]);
    expect(searchIndex(index, 'rifle-behring')).toEqual(
      [entries[0], entries[1]].sort((a, b) => a.label.localeCompare(b.label)),
    );
  });
  it('bounds the result list and rejects unmatched tokens', () => {
    expect(searchIndex(index, 'cq7', 1)).toHaveLength(1);
    expect(searchIndex(index, 'cq7 unknown')).toEqual([]);
  });
});
