import { useMemo } from 'react';
import type { Blueprint, GppModifier, GppModifierRange, ItemStats, NumericItemStatKey } from '../types';
import {
  ARMOR_DAMAGE_RESISTANCE_KEYS,
  DIRECT_GPP_TO_STAT,
  NUMERIC_ITEM_STAT_KEYS,
} from '../types';

/**
 * Compute one GPP modifier range value for a given numeric quality value.
 * Interpolates linearly between qualityStart and qualityEnd.
 * Values below qualityStart clamp to modAtMin; above qualityEnd clamp to modAtMax.
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

function getModifierRanges(modifier: GppModifier): GppModifierRange[] {
  if (modifier.ranges?.length) return modifier.ranges;
  return [
    {
      modifierType: modifier.modifierType === 'additive' ? 'additive' : 'multiplier',
      qualityStart: modifier.qualityStart,
      qualityEnd: modifier.qualityEnd,
      modAtMin: modifier.modAtMin,
      modAtMax: modifier.modAtMax,
    },
  ];
}

export function evaluateGppModifier(
  modifier: GppModifier,
  qualityValue: number,
): { modifierType: 'multiplier' | 'additive'; value: number } {
  const ranges = getModifierRanges(modifier).sort((left, right) => left.qualityStart - right.qualityStart);
  const activeRange =
    ranges.find((range) => qualityValue >= range.qualityStart && qualityValue <= range.qualityEnd) ??
    (qualityValue < ranges[0].qualityStart ? ranges[0] : ranges[ranges.length - 1]);

  return {
    modifierType: activeRange.modifierType,
    value: gppModifier(
      activeRange.modAtMin,
      activeRange.modAtMax,
      qualityValue,
      activeRange.qualityStart,
      activeRange.qualityEnd,
    ),
  };
}

function getModifierTargets(gppId: string, result: ItemStats): NumericItemStatKey[] {
  if (gppId === 'GPP_Armor_DamageMitigation') {
    const existingTargets = ARMOR_DAMAGE_RESISTANCE_KEYS.filter((key) => typeof result[key] === 'number');
    return existingTargets.length > 0 ? existingTargets : [...ARMOR_DAMAGE_RESISTANCE_KEYS];
  }

  if (gppId === 'GPP_Weapon_Damage') {
    const damageTargets: NumericItemStatKey[] = ['damage'];
    if (typeof result.burstDps === 'number') damageTargets.push('burstDps');
    if (typeof result.sustainedDps === 'number') damageTargets.push('sustainedDps');
    return damageTargets;
  }

  const statKey = DIRECT_GPP_TO_STAT[gppId];
  return statKey ? [statKey] : [];
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

      const modifier = evaluateGppModifier(mod, qualityValue);
      const occurrenceCount = mod.occurrenceCount ?? 1;

      for (const statKey of targets) {
        const currentValue =
          typeof result[statKey] === 'number'
            ? result[statKey]
            : modifier.modifierType === 'additive'
              ? 0
              : 1;
        result[statKey] =
          modifier.modifierType === 'additive'
            ? currentValue + modifier.value * occurrenceCount
            : currentValue * Math.pow(modifier.value, occurrenceCount);
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
