import { describe, expect, it } from 'vitest';

import { formatResourceQuantity } from './crafting';

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
