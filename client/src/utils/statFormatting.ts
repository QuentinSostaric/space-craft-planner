import type { NumericItemStatKey } from '../types';
import { STAT_PERCENT_KEYS, STAT_UNITS } from '../types';

export function formatStatValue(key: NumericItemStatKey, value: number): string {
  const displayValue = STAT_PERCENT_KEYS.has(key) ? value * 100 : value;
  const abs = Math.abs(displayValue);
  const formatted = abs < 10
    ? displayValue.toFixed(2)
    : abs < 100
      ? displayValue.toFixed(1)
      : String(Math.round(displayValue));
  const unit = STAT_UNITS[key] ?? '';

  if (unit === 'x') {
    return `×${formatted}`;
  }

  if (unit === '%') {
    return `${formatted}%`;
  }

  if (unit === 'C') {
    return `${formatted} °C`;
  }

  return unit ? `${formatted} ${unit}` : formatted;
}
