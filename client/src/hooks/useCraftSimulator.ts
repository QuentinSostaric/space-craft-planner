import { useMemo } from 'react';
import type { Blueprint, ItemStats, NumericItemStatKey } from '../types';
import {
  ARMOR_DAMAGE_RESISTANCE_KEYS,
  DIRECT_GPP_TO_STAT,
  NUMERIC_ITEM_STAT_KEYS,
} from '../types';

/**
 * Compute the GPP modifier multiplier for a given numeric quality value.
 * Interpolates linearly between qualityStart and qualityEnd.
 * Values below qualityStart clamp to modAtMin; above qualityEnd clamp to modAtMax.
 * For curves spanning 0-1000, quality 500 remains the neutral point (modifier 1.0).
 * Curves starting at 500 are neutral below 500 and apply a bonus above.
 */
export function gppModifier(
  modAtMin: number,
  modAtMax: number,
  qualityValue: number,
  qualityStart: number = 0,
  qualityEnd: number = 1000,
): number {
  if (qualityValue <= qualityStart) return modAtMin;
  if (qualityValue >= qualityEnd) return modAtMax;
  const t = (qualityValue - qualityStart) / (qualityEnd - qualityStart);
  return modAtMin + (modAtMax - modAtMin) * t;
}

function getModifierTargets(gppId: string, result: ItemStats): NumericItemStatKey[] {
  if (gppId === 'GPP_Armor_DamageMitigation') {
    return ARMOR_DAMAGE_RESISTANCE_KEYS.filter((key) => typeof result[key] === 'number');
  }

  const statKey = DIRECT_GPP_TO_STAT[gppId];
  return statKey && typeof result[statKey] === 'number' ? [statKey] : [];
}

function roundStatValue(value: number): number {
  return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
}

/** Project all base stats through slot GPP modifiers. Only stats present in baseStats are projected. */
function calcProjectedStats(
  blueprint: Blueprint,
  assignments: Record<string, number | undefined>,
): ItemStats {
  const result: ItemStats = { ...blueprint.baseStats };

  for (const slot of blueprint.slots) {
    const qualityValue = assignments[slot.id];
    if (qualityValue === undefined) continue;
    if (slot.minQuality !== null && qualityValue < slot.minQuality) continue;

    for (const mod of slot.modifiers) {
      const targets = getModifierTargets(mod.gppId, result);
      if (targets.length === 0) continue;

      const modifier = gppModifier(
        mod.modAtMin,
        mod.modAtMax,
        qualityValue,
        mod.qualityStart,
        mod.qualityEnd,
      );
      const appliedModifier = Math.pow(modifier, mod.occurrenceCount);

      for (const statKey of targets) {
        const currentValue = result[statKey];
        if (typeof currentValue !== 'number') continue;
        result[statKey] = currentValue * appliedModifier;
      }
    }
  }

  for (const statKey of NUMERIC_ITEM_STAT_KEYS) {
    const value = result[statKey];
    if (typeof value === 'number') {
      result[statKey] = roundStatValue(value);
    }
  }

  return result;
}

/**
 * Quality score 0–100 based on the average quality potential across assigned slots.
 * Uses the full game scale: t = qualityValue / 1000, clamped to [0,1].
 * Quality 500 maps to 50 (neutral midpoint), 1000 maps to 100.
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
    const t = Math.max(0, Math.min(1, qualityValue / 1000));
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
