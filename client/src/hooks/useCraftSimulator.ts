import { useMemo } from 'react';
import type { Blueprint, ItemStats, Quality } from '../types';
import { QUALITY_NUMERIC, GPP_TO_STAT, QUALITY_ORDER, STAT_LOWER_IS_BETTER } from '../types';

/**
 * Compute the GPP modifier value for a given quality tier.
 * Linear interpolation: t=0 at CMS (500), t=1.0 at CMR (1000).
 */
function gppModifier(modAtMin: number, modAtMax: number, quality: Quality): number {
  const t = (QUALITY_NUMERIC[quality] - 500) / 500;
  return modAtMin + (modAtMax - modAtMin) * t;
}

/** Project all base stats through slot GPP modifiers. Only stats present in baseStats are projected. */
function calcProjectedStats(
  blueprint: Blueprint,
  assignments: Record<string, Quality | undefined>,
): ItemStats {
  const result: Record<string, number> = { ...blueprint.baseStats };

  for (const slot of blueprint.slots) {
    const quality = assignments[slot.id];
    if (!quality) continue;
    if (slot.minQuality && QUALITY_ORDER[quality] < QUALITY_ORDER[slot.minQuality]) continue;

    for (const mod of slot.modifiers) {
      const statKey = GPP_TO_STAT[mod.gppId];
      if (!statKey || !(statKey in result)) continue;
      result[statKey] *= gppModifier(mod.modAtMin, mod.modAtMax, quality);
    }
  }

  const stats: ItemStats = {};
  for (const [key, val] of Object.entries(result) as [keyof ItemStats, number][]) {
    stats[key] = STAT_LOWER_IS_BETTER.has(key)
      ? Math.round(val * 100) / 100
      : Math.round(val) as never;
  }
  return stats;
}

/** 0–100 score based on filled slots and quality level, penalised by unfilled ratio. */
function calcQualityScore(
  blueprint: Blueprint,
  assignments: Record<string, Quality | undefined>,
): number {
  if (blueprint.slots.length === 0) return 0;

  let total = 0;
  let filled = 0;

  for (const slot of blueprint.slots) {
    const quality = assignments[slot.id];
    if (!quality) continue;
    if (slot.minQuality && QUALITY_ORDER[quality] < QUALITY_ORDER[slot.minQuality]) continue;
    const t = (QUALITY_NUMERIC[quality] - 500) / 500;
    total += t * 100;
    filled++;
  }

  if (filled === 0) return 0;
  const fillRatio = filled / blueprint.slots.length;
  return Math.round((total / blueprint.slots.length) * fillRatio);
}

export function useCraftSimulator(
  blueprint: Blueprint | null,
  assignments: Record<string, Quality | undefined>,
) {
  const projectedStats = useMemo<ItemStats>(() => {
    if (!blueprint) return {};
    return calcProjectedStats(blueprint, assignments);
  }, [blueprint, assignments]);

  const qualityScore = useMemo<number>(() => {
    if (!blueprint) return 0;
    return calcQualityScore(blueprint, assignments);
  }, [blueprint, assignments]);

  return { projectedStats, qualityScore };
}
