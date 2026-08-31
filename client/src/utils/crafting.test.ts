import { describe, expect, it } from 'vitest';

import { formatResourceQuantity, getObtainableBlueprintIds } from './crafting';

describe('formatResourceQuantity', () => {
  it('keeps sub-milli-SCU dismantle returns visible', () => {
    expect(formatResourceQuantity(0.0005, 'scu', 'en')).toBe('0.0005 SCU');
    expect(formatResourceQuantity(0.000001, 'scu', 'en')).toBe('0.000001 SCU');
  });

  it('keeps the compact precision used by ordinary recipe amounts', () => {
    expect(formatResourceQuantity(0.005, 'scu', 'en')).toBe('0.005 SCU');
    expect(formatResourceQuantity(0.03, 'scu', 'en')).toBe('0.03 SCU');
  });
});

describe('getObtainableBlueprintIds', () => {
  it('only exposes blueprints backed by the acquisition graph', () => {
    const ids = getObtainableBlueprintIds({
      blueprintAcquisitionGraph: [
        { blueprint: { id: 'obtainable-rifle' } },
        { blueprint: { id: 'obtainable-armor' } },
      ],
    });

    expect([...ids]).toEqual(['obtainable-rifle', 'obtainable-armor']);
    expect(ids.has('internal-unobtainable-item')).toBe(false);
  });

  it('returns an empty catalog while acquisition data is unavailable', () => {
    expect(getObtainableBlueprintIds(null).size).toBe(0);
  });
});
