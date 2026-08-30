import type { NumericItemStatKey } from '../types';
import { STAT_UNITS } from '../types';

export function formatStatValue(key: NumericItemStatKey, value: number): string {
  const abs = Math.abs(value);
  const formatted = abs < 10
    ? value.toFixed(2)
    : abs < 100
      ? value.toFixed(1)
      : String(Math.round(value));
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
