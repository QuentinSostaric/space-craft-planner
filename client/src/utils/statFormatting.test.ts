import { describe, expect, it } from 'vitest';

import { formatStatValue } from './statFormatting';

describe('formatStatValue', () => {
  it('separates absolute values from their units', () => {
    expect(formatStatValue('damage', 12)).toBe('12.0 dmg');
    expect(formatStatValue('rateOfFire', 810)).toBe('810 rpm');
  });

  it('presents relative stats as explicit multipliers', () => {
    expect(formatStatValue('recoilKick', 1)).toBe('×1.00');
    expect(formatStatValue('recoilHandling', 0.825)).toBe('×0.82');
  });

  it('uses compact conventional formatting for percentages and temperatures', () => {
    expect(formatStatValue('damageResistanceKinetic', 0.3)).toBe('30.0%');
    expect(formatStatValue('hullScrapingEfficiency', 0.9)).toBe('90.0%');
    expect(formatStatValue('selfRepairHealthRatio', 0.2)).toBe('20.0%');
    expect(formatStatValue('temperatureMin', -75)).toBe('-75.0 °C');
  });
});
