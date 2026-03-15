import { useMemo } from 'react';
import type { Blueprint, ItemStats } from '../types';
import { GPP_TO_STAT, STAT_LOWER_IS_BETTER } from '../types';

/**
 * Compute the GPP modifier multiplier for a given numeric quality value.
 * The game interpolates linearly between startQuality=500 (modAtMin) and
 * endQuality=1000 (modAtMax). Values below 500 receive modAtMin (no bonus).
 */
export function gppModifier(modAtMin: number, modAtMax: number, qualityValue: number): number {
  const t = Math.max(0, Math.min(1, (qualityValue - 500) / 500));
  return modAtMin + (modAtMax - modAtMin) * t;
}

/** Project all base stats through slot GPP modifiers. Only stats present in baseStats are projected. */
function calcProjectedStats(
  blueprint: Blueprint,
  assignments: Record<string, number | undefined>,
): ItemStats {
  const result: Record<string, number> = { ...blueprint.baseStats };

  for (const slot of blueprint.slots) {
    const qualityValue = assignments[slot.id];
    if (qualityValue === undefined) continue;
    if (slot.minQuality !== null && qualityValue < slot.minQuality) continue;

    for (const mod of slot.modifiers) {
      const statKey = GPP_TO_STAT[mod.gppId];
      if (!statKey || !(statKey in result)) continue;
      result[statKey] *= gppModifier(mod.modAtMin, mod.modAtMax, qualityValue);
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

/**
 * Quality score 0–100 based on the average GPP bonus potential across assigned slots.
 * Derived from the game's quality scale: t = (qualityValue - 500) / 500, clamped to [0,1].
 * Chunks (300) → 0%, Scraps (500) → 0%, Powder (1000) → 100%.
 * Penalised by unfilled slot ratio.
 */
function calcQualityScore(
  blueprint: Blueprint,
  assignments: Record<string, number | undefined>,
): number {
  if (blueprint.slots.length === 0) return 0;

  let total = 0;
  let filled = 0;

  for (const slot of blueprint.slots) {
    const qualityValue = assignments[slot.id];
    if (qualityValue === undefined) continue;
    if (slot.minQuality !== null && qualityValue < slot.minQuality) continue;
    const t = Math.max(0, Math.min(1, (qualityValue - 500) / 500));
    total += t * 100;
    filled++;
  }

  if (filled === 0) return 0;
  const fillRatio = filled / blueprint.slots.length;
  return Math.round((total / blueprint.slots.length) * fillRatio);
}

export function useCraftSimulator(
  blueprint: Blueprint | null,
  assignments: Record<string, number | undefined>,
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
