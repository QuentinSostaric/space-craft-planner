import { describe, expect, it } from 'vitest';
import type { MissionIntelligenceMission, MissionIntelligenceRequirement, MissionRouteInput } from '../types/missionIntelligence';
import { getMissionRouteCandidates, planMissionRoute } from './missionRoutePlanner';

const trackId = 'faction-a:security';
function mission(id: string, gain: number | null, overrides: Partial<MissionIntelligenceMission> = {}): MissionIntelligenceMission {
  return {
    id, title: id, description: null, debugName: id, employer: 'Faction A',
    sourceFile: 'missions/test.xml', templateFile: null, systems: ['Stanton'],
    reputationRewards: [{ trackId, success: gain, failure: -5, abandon: -10, outcomeAmounts: [], evidence: [] }],
    requirements: [], prerequisites: [], completionTags: [], requiredCompletionTags: [], excludedCompletionTags: [],
    onceOnly: false, cooldownSeconds: 0, notForRelease: false, workInProgress: false, plannerBlockers: [], evidence: [],
    generationRefresh: { respawnTime: 0, respawnTimeVariation: 0 },
    ...overrides,
  };
}
function requirement(min: number | null, max: number | null = null, overrides: Partial<MissionIntelligenceRequirement> = {}): MissionIntelligenceRequirement {
  return { trackId, minReputation: min, maxReputationExclusive: max, minStandingId: null, maxStandingId: null, exclude: false, ...overrides };
}
function input(missions: MissionIntelligenceMission[], overrides: Partial<MissionRouteInput> = {}): MissionRouteInput {
  return { missions, trackId, currentReputation: 0, targetReputation: 10, mode: 'count', ...overrides };
}

describe('planMissionRoute', () => {
  it('finds the fastest complete route even when greedy reputation/minute chooses incorrectly', () => {
    // 6 / 4 is the better ratio, but repeating it costs 8 minutes versus 7.
    const result = planMissionRoute(input([mission('quick', 6), mission('complete', 10)], {
      mode: 'time', durationMinutesByMissionId: { quick: 4, complete: 7 },
    }));
    expect(result.status).toBe('optimal');
    expect(result.steps.map((step) => [step.missionId, step.count])).toEqual([['complete', 1]]);
    expect(result.totalMinutes).toBe(7);
  });

  it('unlocks higher-tier contracts only after their reputation threshold', () => {
    const result = planMissionRoute(input([
      mission('entry', 3),
      mission('advanced', 8, { requirements: [requirement(5)] }),
    ], { targetReputation: 13, mode: 'time', defaultDurationMinutes: 1 }));
    expect(result.status).toBe('optimal');
    expect(result.steps.map((step) => [step.missionId, step.count])).toEqual([['entry', 2], ['advanced', 1]]);
    expect(result.steps[1].reputationBefore).toBe(6);
    expect(result.finalReputation).toBe(14);
    expect(result.totalMinutes).toBe(3);
  });

  it('optimizes contract count independently of completion estimates', () => {
    const result = planMissionRoute(input([mission('small', 5), mission('large', 10)], {
      durationMinutesByMissionId: { small: 1, large: 30 },
    }));
    expect(result.totalRuns).toBe(1);
    expect(result.steps[0].missionId).toBe('large');
    expect(result.totalMinutes).toBe(30);
  });

  it('respects exclusive maximum standings rather than repeating a retired entry mission', () => {
    const result = planMissionRoute(input([
      mission('entry', 4, { requirements: [requirement(null, 4)] }),
      mission('advanced', 3, { requirements: [requirement(4)] }),
    ]));
    expect(result.steps.map((step) => [step.missionId, step.count])).toEqual([['entry', 1], ['advanced', 2]]);
  });

  it('respects excluded standing intervals', () => {
    const result = planMissionRoute(input([
      mission('steady', 2),
      mission('surge', 10, { requirements: [requirement(4, 8, { exclude: true })] }),
    ], { currentReputation: 5, targetReputation: 15 }));
    expect(result.steps.map((step) => [step.missionId, step.count])).toEqual([['steady', 2], ['surge', 1]]);
  });

  it('does not convert unknown gains, negative gains, cooldowns, or unmet history to progress', () => {
    const result = planMissionRoute(input([
      mission('runtime', null), mission('loss', -4), mission('neutral', 0),
      mission('once', 10, { onceOnly: true }),
      mission('cooldown', 10, { cooldownSeconds: 60 }),
      mission('certification', 10, { requiredCompletionTags: ['passed'] }),
      mission('already-completed', 10, { excludedCompletionTags: ['done'] }),
      mission('unreleased', 10, { workInProgress: true }),
      mission('unresolved', 10, { plannerBlockers: ['Gated transition'] }),
    ]));
    expect(result.status).toBe('unreachable');
    expect(result.totalRuns).toBe(0);
    expect(result.excludedMissions).toHaveLength(9);
  });

  it('keeps faction/activity tracks distinct and blocks other-track prerequisites', () => {
    const otherTrack = 'faction-b:security';
    const other = mission('other-faction', 100);
    other.reputationRewards[0].trackId = otherTrack;
    const result = planMissionRoute(input([
      other,
      mission('cross-track', 10, { requirements: [requirement(0, null, { trackId: otherTrack })] }),
      mission('valid', 5),
    ]));
    expect(result.eligibleMissionCount).toBe(1);
    expect(result.totalRuns).toBe(2);
    expect(result.excludedMissions.map((entry) => entry.missionId)).toEqual(['cross-track']);
  });

  it('accepts location context while surfacing assumptions, without inventing measured times', () => {
    const contextual = mission('local', 5, {
      prerequisites: [{ type: 'location', summary: 'Hurston', raw: {}, evidence: [] }],
    });
    const count = planMissionRoute(input([contextual]));
    expect(count.status).toBe('optimal');
    expect(count.totalMinutes).toBeNull();
    expect(count.assumptions.join(' ')).toContain('CrimeStat 0');
    const time = planMissionRoute(input([contextual], { mode: 'time' }));
    expect(time.status).toBe('unreachable');
    expect(time.excludedMissions[0].reasons.join(' ')).toContain('completion-time estimate');
  });

  it('rejects invalid explicit duration overrides rather than replacing them with a default', () => {
    const result = getMissionRouteCandidates(input([mission('a', 5)], {
      mode: 'time', defaultDurationMinutes: 10, durationMinutesByMissionId: { a: 0 },
    }));
    expect(result.candidates).toHaveLength(0);
    expect(result.excludedMissions).toHaveLength(1);
  });

  it('returns a bounded result without claiming optimality or showing an incomplete route', () => {
    const result = planMissionRoute(input([mission('increment', 1)], { targetReputation: 1000, maxStates: 3 }));
    expect(result.status).toBe('bounded');
    expect(result.steps).toEqual([]);
    expect(result.message).toContain('no optimal route is claimed');
  });

  it('handles decimal reputation without floating-point state drift', () => {
    const result = planMissionRoute(input([mission('increment', 0.1)], { targetReputation: 0.3 }));
    expect(result.status).toBe('optimal');
    expect(result.totalRuns).toBe(3);
    expect(result.finalReputation).toBe(0.3);
    expect(result.steps[0].reputationGain).toBe(0.3);
  });

  it('returns no work for an already reached target and rejects invalid inputs', () => {
    expect(planMissionRoute(input([], { currentReputation: 15 })).status).toBe('optimal');
    expect(planMissionRoute(input([], { currentReputation: 15 })).totalRuns).toBe(0);
    expect(planMissionRoute(input([], { targetReputation: Number.NaN })).status).toBe('invalid');
  });

  it('does not treat an unresolved gated standing as having no requirement', () => {
    const result = planMissionRoute(input([mission('unresolved', 10, {
      requirements: [requirement(null, null, { minStandingId: 'gate' })],
    })]));
    expect(result.status).toBe('unreachable');
    expect(result.excludedMissions[0].reasons.join(' ')).toContain('standing boundary');
  });

  it('rejects targets above the declared ceiling and clamps final awarded progress to it', () => {
    const missions = [mission('large', 20)];
    expect(planMissionRoute(input(missions, { targetReputation: 11, reputationCeiling: 10 })).status).toBe('unreachable');
    const result = planMissionRoute(input(missions, { currentReputation: 3, reputationCeiling: 12 }));
    expect(result.status).toBe('optimal');
    expect(result.finalReputation).toBe(12);
    expect(result.steps[0].reputationGain).toBe(9);
  });

  it('accepts a verified top-rank interval with no upper boundary while rejecting unresolved rank ids', () => {
    const top = requirement(0, null, { maxStandingId: 'elite', maxStandingResolved: true });
    expect(planMissionRoute(input([mission('top-band', 10, { requirements: [top] })])).status).toBe('optimal');
    expect(planMissionRoute(input([mission('unknown-band', 10, {
      requirements: [{ ...top, maxStandingResolved: false }],
    })])).status).toBe('unreachable');
  });

  it('requires an explicit waiting-time estimate for mission generators with refresh delays', () => {
    const delayed = mission('delayed', 5, { generationRefresh: { respawnTime: 10, respawnTimeVariation: 2 } });
    const timed = input([delayed], { mode: 'time', defaultDurationMinutes: 15 });
    const excluded = planMissionRoute(timed);
    expect(excluded.status).toBe('unreachable');
    expect(excluded.excludedMissions[0].reasons.join(' ')).toContain('includes waiting');
    const confirmed = planMissionRoute({ ...timed, timingIncludesRefreshWait: true });
    expect(confirmed.status).toBe('optimal');
    expect(confirmed.totalMinutes).toBe(30);
    const count = planMissionRoute({ ...timed, mode: 'count' });
    expect(count.totalRuns).toBe(2);
    expect(count.totalMinutes).toBeNull();
  });

  it('treats unknown generator refresh as unknown instead of zero', () => {
    const timed = input([mission('unknown', 5, { generationRefresh: undefined })], {
      mode: 'time', defaultDurationMinutes: 15,
    });
    expect(planMissionRoute(timed).status).toBe('unreachable');
    expect(planMissionRoute({ ...timed, timingIncludesRefreshWait: true }).status).toBe('optimal');
  });
});
