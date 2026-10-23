import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '../../../test/render';
import { calcProjectedStats, calcQualityScore } from '../../../hooks/useCraftSimulator';
import { GPP_LOWER_IS_BETTER, type Blueprint } from '../../../types';
import { StatImpactRadar } from './StatImpactRadar';

// Cassandra's published LIVE 4.10.2 recipe, including its two quality ranges.
const cassandra: Blueprint = {
  id: 'bp_craft_radr_bltr_s02_cassandra',
  name: 'Cassandra',
  manufacturer: 'Blue Triangle Inc.',
  category: 'radar',
  craftTimeSecs: 750,
  baseStats: { maxHealth: 920, radarMinAimAssistDistance: 1, radarMaxAimAssistDistance: 1 },
  slots: [
    ['case', 'Borase', 'GPP_Health_MaxHealth', 1.2],
    ['transmitter', 'Bexalite', 'GPP_Radar_MinAimAssistDistance', 0.3],
    ['signal_processor', 'Savrilium', 'GPP_Radar_MaxAimAssistDistance', 0.3],
  ].map(([id, resource, gppId, quantity]) => ({
    id: String(id),
    label: { en: String(id), fr: String(id) },
    requirementType: 'resource',
    requirementName: String(resource),
    requiredResource: String(resource),
    requiredItem: null,
    requiredItemClass: null,
    minQuality: 1,
    quantityScu: Number(quantity),
    quantityValue: Number(quantity),
    quantityUnit: 'scu',
    quantityMultiplier: null,
    modifiers: [{
      gppId: String(gppId), occurrenceCount: 1, modifierType: 'multiplier',
      qualityStart: 0, qualityEnd: 1000, modAtMin: 0.8, modAtMax: 1.2,
      ranges: [
        { modifierType: 'multiplier', qualityStart: 0, qualityEnd: 500, modAtMin: 0.8, modAtMax: 1 },
        { modifierType: 'multiplier', qualityStart: 501, qualityEnd: 1000, modAtMin: 1, modAtMax: 1.2 },
      ],
    }],
  })),
};

describe('Cassandra radar quality direction', () => {
  it.each([
    { quality: 200, value: 0.88, score: 400, state: 'degraded' },
    { quality: 700, value: 1.08, score: 567, state: 'improved' },
  ])('labels Bexalite Q$quality as $state without reversing the recipe', ({ quality, value, score, state }) => {
    const assignments = { case: 500, transmitter: quality, signal_processor: 500 };
    const projectedStats = calcProjectedStats(cassandra, assignments);
    expect(projectedStats.radarMinAimAssistDistance).toBeCloseTo(value, 2);
    expect(projectedStats.maxHealth).toBe(920);
    expect(projectedStats.radarMaxAimAssistDistance).toBe(1);
    expect(calcQualityScore(cassandra, assignments)).toBe(score);
    renderWithProviders(<StatImpactRadar blueprint={cassandra} projectedStats={projectedStats} />);
    expect(screen.getByText(`${state === 'improved' ? '↑' : '↓'} Min Aim Assist`)).toBeInTheDocument();
    expect(screen.getByText('Max Aim Assist')).toBeInTheDocument();
    expect(GPP_LOWER_IS_BETTER.has('GPP_Radar_MinAimAssistDistance')).toBe(false);
  });
});
