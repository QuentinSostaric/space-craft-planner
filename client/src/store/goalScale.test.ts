import { describe, expect, it } from 'vitest';
import { normalizeGoalScale } from './CraftContext';
import { BUILD_INDEX_MAX } from '../hooks/useCraftSimulator';
import type { CraftGoal } from '../types';

function goal(overrides: Partial<CraftGoal>): CraftGoal {
  return {
    id: 'g1',
    blueprintId: 'bp1',
    blueprintName: 'CQ7 Rifle',
    category: 'weapon',
    slotAssignments: {},
    quantity: 1,
    qualityScore: 0,
    projectedStats: {},
    createdAt: 0,
    ...overrides,
  } as CraftGoal;
}

describe('normalizeGoalScale', () => {
  it('rescales a goal written before the build index moved to 0-1000', () => {
    // No marker is what identifies the old scale — the value alone cannot,
    // because 72 is a legal score on both.
    const result = normalizeGoalScale(goal({ qualityScore: 72 }));
    expect(result.qualityScore).toBe(720);
    expect(result.qualityScoreScale).toBe(BUILD_INDEX_MAX);
  });

  it('leaves an already-converted goal untouched', () => {
    const current = goal({ qualityScore: 720, qualityScoreScale: BUILD_INDEX_MAX });
    expect(normalizeGoalScale(current)).toBe(current);
  });

  it('is idempotent, so re-reading can never multiply a goal twice', () => {
    const once = normalizeGoalScale(goal({ qualityScore: 72 }));
    const twice = normalizeGoalScale(once);
    expect(twice.qualityScore).toBe(720);
  });

  it('clamps rather than exceeding the scale', () => {
    expect(normalizeGoalScale(goal({ qualityScore: 5000 })).qualityScore).toBe(BUILD_INDEX_MAX);
  });

  it('coerces a non-numeric score to zero instead of producing NaN', () => {
    const broken = goal({ qualityScore: undefined as unknown as number });
    expect(normalizeGoalScale(broken).qualityScore).toBe(0);
  });
});
