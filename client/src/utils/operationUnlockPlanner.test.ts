import { describe, expect, it } from 'vitest';
import snapshot from '../../public/data/mission-intelligence-12519617.json';
import operations from '../../public/data/mission-operations-12519617.json';
import type { MissionIntelligenceData, MissionIntelligenceMission } from '../types/missionIntelligence';
import type { MissionOperation } from '../types/missionOperations';
import { planOperationUnlockRoute, type OperationUnlockInput } from './operationUnlockPlanner';

const data = snapshot as unknown as MissionIntelligenceData;
const intersecGoal = (operations.operations.find((operation) => operation.id === 'tactical-strike-groups') as unknown as MissionOperation).accessGoals![0];
const shubinGoal = (operations.operations.find((operation) => operation.id === 'qv-breaker') as unknown as MissionOperation).accessGoals![0];
const intersec = data.tracks.find((track) => track.factionGuid === intersecGoal.factionReputationGuid)!;
const shubin = data.tracks.find((track) => track.factionGuid === shubinGoal.factionReputationGuid)!;
const introId = '1850226f-16e3-4160-9172-698e5397ed18';
const introTag = '893d5cad-2a8c-4c27-bdbe-98f05603bf5a';

function input(overrides: Partial<OperationUnlockInput> = {}): OperationUnlockInput {
  return { data, track: intersec, goal: intersecGoal, currentReputation: 0, ...overrides };
}

function alterMission(id: string, changes: Partial<MissionIntelligenceMission>): MissionIntelligenceData {
  return { ...data, missions: data.missions.map((mission) => mission.id === id ? { ...mission, ...changes } : mission) };
}

describe('planOperationUnlockRoute', () => {
  it('reconstructs the verified InterSec route from zero with the introduction exactly once', () => {
    const result = planOperationUnlockRoute(input());
    expect(result.route.status).toBe('optimal');
    expect(result.route.totalRuns).toBe(36);
    expect(result.route.steps[0]).toMatchObject({ missionId: introId, count: 1, reputationBefore: 0, reputationAfter: 100 });
    expect(result.route.steps.filter((step) => step.missionId === introId)).toHaveLength(1);
    expect(result.route.finalReputation).toBeGreaterThanOrEqual(5800);
    expect(result.introduction).toMatchObject({ planned: true, completed: false, reputationGain: 100 });
    expect(result.missingCompletionTags).toEqual([]);
    expect(result.route.totalMinutes).toBeNull();
    for (const step of result.route.steps) {
      const mission = data.missions.find((entry) => entry.id === step.missionId)!;
      expect(mission.plannerBlockers).toEqual([]);
      expect(mission.requirements.every((requirement) => step.reputationBefore >= (requirement.minReputation ?? -Infinity))).toBe(true);
    }
  });

  it('does not infer introduction completion from reputation already above the operation threshold', () => {
    const result = planOperationUnlockRoute(input({ currentReputation: 5800 }));
    expect(result.route.status).toBe('optimal');
    expect(result.route.steps).toHaveLength(1);
    expect(result.route.steps[0].missionId).toBe(introId);
    expect(result.route.finalReputation).toBe(5900);
  });

  it('uses explicitly confirmed history without adding the introduction reward again', () => {
    const result = planOperationUnlockRoute(input({ currentReputation: 5800, introductionCompleted: true }));
    expect(result.route.status).toBe('optimal');
    expect(result.route.totalRuns).toBe(0);
    expect(result.route.finalReputation).toBe(5800);
    expect(result.introduction).toMatchObject({ planned: false, completed: true });
  });

  it('keeps an unknown or blocked required introduction unresolved even when the reputation is sufficient', () => {
    for (const changes of [
      { plannerBlockers: ['subcontract-prerequisites-unmodeled'] },
      { cooldownSeconds: null },
      { completionTags: ['other-tag'] },
      { onceOnly: null },
    ]) {
      const result = planOperationUnlockRoute(input({ data: alterMission(introId, changes), currentReputation: 5800 }));
      expect(result.route.status).toBe('unreachable');
      expect(result.route.totalRuns).toBe(0);
      expect(result.missingCompletionTags).toEqual([introTag]);
    }
  });

  it('does not bypass a second history prerequisite, cooldown, or other-track gate on a lucrative contract', () => {
    const base = data.missions.find((mission) => mission.id === 'af4ffb08-954a-4f75-9493-e3cd102af48d')!;
    const highGain = { ...base, reputationRewards: [{ ...base.reputationRewards[0], success: 9999 }] };
    const additions: MissionIntelligenceMission[] = [
      { ...highGain, id: 'unknown-history', requiredCompletionTags: [introTag, 'unverified'] },
      { ...highGain, id: 'cooldown', cooldownSeconds: null },
      { ...highGain, id: 'other-track', requirements: [{ ...base.requirements[0], trackId: 'other-track' }] },
      { ...highGain, id: 'new-history', completionTags: ['unmodeled-result'] },
    ];
    const result = planOperationUnlockRoute(input({ data: { ...data, missions: [...data.missions, ...additions] } }));
    expect(result.route.totalRuns).toBe(36);
    expect(result.route.steps.some((step) => additions.some((mission) => mission.id === step.missionId))).toBe(false);
  });

  it('leaves the Shubin introduction gap explicit, and plans after player confirmation of its completion', () => {
    const first = planOperationUnlockRoute(input({ track: shubin, goal: shubinGoal }));
    expect(first.route.status).toBe('unreachable');
    expect(first.introduction).toMatchObject({ blocked: true, planned: false, reputationGain: 100 });
    const confirmed = planOperationUnlockRoute(input({ track: shubin, goal: shubinGoal, currentReputation: 100, introductionCompleted: true }));
    expect(confirmed.route.status).toBe('optimal');
    expect(confirmed.route.totalRuns).toBe(7);
    expect(confirmed.route.finalReputation).toBe(800);
  });

  it('reconstructs the independent Rayari introduction and resource contracts', () => {
    const track = data.tracks.find((entry) => entry.factionName === 'Rayari Incorporated')!;
    const result = planOperationUnlockRoute(input({
      track,
      goal: { ...intersecGoal, factionReputationGuid: track.factionGuid, scopeGuid: track.scopeGuid, targetReputation: 2200, completionTag: 'ab960018-6478-4e5d-9c74-175662c57129' },
    }));
    expect(result.route.status).toBe('optimal');
    expect(result.route.steps[0]).toMatchObject({ missionId: '1035d0f0-82e7-4cee-8d10-789925b3d138', count: 1, reputationAfter: 100 });
    expect(result.route.finalReputation).toBeGreaterThanOrEqual(2200);
  });

  it('validates the selected track and input reputation without mutating the shared snapshot', () => {
    expect(planOperationUnlockRoute(input({ track: shubin })).route.status).toBe('invalid');
    expect(planOperationUnlockRoute(input({ currentReputation: NaN })).route.status).toBe('invalid');
    const before = JSON.stringify(data);
    planOperationUnlockRoute(input());
    expect(JSON.stringify(data)).toBe(before);
  });
});
