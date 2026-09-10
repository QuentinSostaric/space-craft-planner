import { describe, expect, it } from 'vitest';
import {
  normalizeBatchResourceQuantity,
  parseResourceQuality,
  sortAccountLibrary,
  type AccountLibraryEntry,
} from './accountHelpers';

describe('resource form validation', () => {
  it.each(['', ' ', '-2', '0', 'NaN', 'Infinity', 'not a number'])(
    'rejects an invalid SCU quantity %j instead of creating a minimum-size lot',
    (value) => {
      expect(normalizeBatchResourceQuantity(value, 'scu')).toBeNaN();
    },
  );
  it('preserves micro SCU and rounds to the server precision', () => {
    expect(normalizeBatchResourceQuantity('0.000001', 'scu')).toBe(0.000001);
    expect(normalizeBatchResourceQuantity('0.0000001', 'scu')).toBeNaN();
    expect(normalizeBatchResourceQuantity('3.1415926', 'scu')).toBe(3.141593);
  });
  it('requires a positive integer for item quantities', () => {
    expect(normalizeBatchResourceQuantity('2.5', 'count')).toBeNaN();
    expect(normalizeBatchResourceQuantity('2', 'count')).toBe(2);
  });
  it('distinguishes unknown quality from zero and rejects out-of-range values', () => {
    expect(parseResourceQuality('')).toBeNull();
    expect(parseResourceQuality('0')).toBe(0);
    expect(parseResourceQuality('1000')).toBe(1000);
    for (const value of ['-1', '1001', 'invalid', 'Infinity']) expect(parseResourceQuality(value)).toBeNaN();
  });
});

const entry = (name: string, quality: number | null, updatedAt: string): AccountLibraryEntry => ({
  kind: 'resource',
  key: name,
  resource: null,
  searchHaystack: name,
  isShared: false,
  sharedOrganizationIds: [],
  resourceEntry: {
    id: name,
    resourceId: name,
    resourceName: name,
    quantity: 1,
    quantityUnit: 'scu',
    quality,
    createdAt: updatedAt,
    updatedAt,
  },
});
it('sorts resource quality and recency without mutating stored inventory', () => {
  const original = [
    entry('Zinc', null, '2026-09-01'),
    entry('Iron 10', 800, '2026-09-05'),
    entry('Iron 2', 200, '2026-09-07'),
  ];
  expect(sortAccountLibrary(original, 'quality', 'en').map((e) => e.key)).toEqual([
    'Iron 10',
    'Iron 2',
    'Zinc',
  ]);
  expect(sortAccountLibrary(original, 'recent', 'en').map((e) => e.key)).toEqual([
    'Iron 2',
    'Iron 10',
    'Zinc',
  ]);
  expect(sortAccountLibrary(original, 'name-asc', 'en').map((e) => e.key)).toEqual([
    'Iron 2',
    'Iron 10',
    'Zinc',
  ]);
  expect(original.map((e) => e.key)).toEqual(['Zinc', 'Iron 10', 'Iron 2']);
});
