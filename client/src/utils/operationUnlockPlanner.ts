import type {
  MissionIntelligenceData,
  MissionIntelligenceMission,
  MissionIntelligenceTrack,
  MissionRouteInput,
  MissionRouteResult,
  MissionRouteStep,
} from '../types/missionIntelligence';
import type { MissionOperation } from '../types/missionOperations';
import { getMissionRouteCandidates, planMissionRoute } from './missionRoutePlanner';

type AccessGoal = NonNullable<MissionOperation['accessGoals']>[number];

export interface OperationUnlockInput {
  data: MissionIntelligenceData;
  track: MissionIntelligenceTrack;
  goal: AccessGoal;
  currentReputation: number;
  /** Explicit player history; reputation alone never proves an introduction was completed. */
  introductionCompleted?: boolean;
}

export interface OperationUnlockIntroduction {
  missionId: string;
  title: string;
  description: string | null;
  reputationGain: number | null;
  completionTag: string;
  completed: boolean;
  planned: boolean;
  blocked: boolean;
}

export interface OperationUnlockResult {
  route: MissionRouteResult;
  introduction?: OperationUnlockIntroduction;
  missingCompletionTags: string[];
}

// These entry contracts and their success completion tags were checked against
// build 12519617 XML. Amounts, standing boundaries, and every other restriction
// are still read from the selected snapshot, never supplied by this registry.
const INTRODUCTIONS: Record<string, { missionId: string; tag: string }> = {
  'a9ab3e4f-30a3-4816-a1dd-4df51fd6678c': {
    missionId: '1850226f-16e3-4160-9172-698e5397ed18',
    tag: '893d5cad-2a8c-4c27-bdbe-98f05603bf5a',
  },
  'afc25254-554d-4409-8893-383a58eb7e8a': {
    missionId: '1035d0f0-82e7-4cee-8d10-789925b3d138',
    tag: 'ab960018-6478-4e5d-9c74-175662c57129',
  },
  'e4527dd7-f0eb-4342-afe8-5ded1fe428df': {
    missionId: '81b50195-3314-42fe-9ba4-551430f88d5d',
    tag: '9bbb0de3-76b0-4021-a3b2-fbd236e6b136',
  },
};

function baseInput(input: OperationUnlockInput, missions: MissionIntelligenceMission[], currentReputation = input.currentReputation): MissionRouteInput {
  return {
    missions,
    trackId: input.track.id,
    currentReputation,
    targetReputation: input.goal.targetReputation,
    reputationCeiling: input.track.reputationCeiling,
    mode: 'count',
  };
}

function acceptsReputation(mission: MissionIntelligenceMission, reputation: number): boolean {
  return mission.requirements.every((requirement) => {
    const inside = (requirement.minReputation === null || reputation >= requirement.minReputation)
      && (requirement.maxReputationExclusive === null || reputation < requirement.maxReputationExclusive);
    return requirement.exclude ? !inside : inside;
  });
}

/**
 * A narrow history model: one verified introduction, followed by ordinary
 * repeatable contracts whose entire history gate is now satisfied. Other tags,
 * once-only content, subcontracts, cooldowns, and runtime gates stay excluded.
 * The introduction is a mandatory prefix in this model, not a repeatable edge.
 */
export function planOperationUnlockRoute(input: OperationUnlockInput): OperationUnlockResult {
  const knownTags = new Set<string>();
  const configured = INTRODUCTIONS[input.track.factionGuid];
  const introductionMission = configured && input.data.missions.find((mission) => mission.id === configured.missionId);
  const expectedGoalTrack = `${input.goal.factionReputationGuid}:${input.goal.scopeGuid}`;
  const inputValidation = planMissionRoute(baseInput(input, [], input.currentReputation));
  if (inputValidation.status === 'invalid' || expectedGoalTrack !== input.track.id) {
    return {
      route: { ...inputValidation, status: 'invalid', message: 'Select the reputation track required by this operation.' },
      missingCompletionTags: input.goal.completionTag ? [input.goal.completionTag] : [],
    };
  }

  let introduction: OperationUnlockIntroduction | undefined;
  let prefix: MissionRouteStep | undefined;
  let reputation = input.currentReputation;
  const historyVerified = introductionMission && configured
    && introductionMission.completionTags.length === 1
    && introductionMission.completionTags[0] === configured.tag
    && introductionMission.excludedCompletionTags.length === 1
    && introductionMission.excludedCompletionTags[0] === configured.tag
    && introductionMission.requiredCompletionTags.length === 0;
  if (historyVerified) {
    // Only the verified one-time history gate is removed for this single run.
    // All exporter restrictions and normal route candidate checks still apply.
    const introForValidation = { ...introductionMission, excludedCompletionTags: [] };
    const candidate = getMissionRouteCandidates(baseInput(input, [introForValidation])).candidates[0];
    const rewards = introductionMission.reputationRewards.filter((reward) => reward.trackId === input.track.id);
    const gain = rewards.length && rewards.every((reward) => typeof reward.success === 'number' && Number.isFinite(reward.success))
      ? rewards.reduce((sum, reward) => sum + reward.success!, 0) : null;
    introduction = {
      missionId: introductionMission.id,
      title: introductionMission.title,
      description: introductionMission.description,
      reputationGain: gain,
      completionTag: configured.tag,
      completed: input.introductionCompleted === true,
      planned: false,
      blocked: !candidate || introductionMission.onceOnly !== false || introductionMission.cooldownSeconds !== 0,
    };
    if (introduction.completed) {
      knownTags.add(configured.tag);
    } else if (candidate && !introduction.blocked
      && acceptsReputation(introductionMission, reputation)
      && (input.goal.completionTag === configured.tag || reputation < input.goal.targetReputation)) {
      const after = Math.min(input.track.reputationCeiling ?? Infinity, reputation + candidate.reputationGain);
      prefix = {
        missionId: introductionMission.id, title: introductionMission.title, count: 1,
        reputationBefore: reputation, reputationAfter: after, reputationGain: after - reputation, minutes: null,
      };
      reputation = after;
      knownTags.add(configured.tag);
      introduction.planned = true;
    }
  }

  const missions = input.data.missions.map((mission) => {
    if (mission.onceOnly !== false || mission.cooldownSeconds !== 0) {
      return { ...mission, plannerBlockers: [...mission.plannerBlockers, 'Explicit repeatability and zero personal cooldown are required.'] };
    }
    // New tags could change future offer exclusions. Those transitions require
    // a larger history graph and must not silently become repeatable here.
    if (mission.completionTags.some((tag) => !knownTags.has(tag))) {
      return { ...mission, plannerBlockers: [...mission.plannerBlockers, 'Additional completion history is not modeled.'] };
    }
    if (mission.requiredCompletionTags.every((tag) => knownTags.has(tag)) && mission.excludedCompletionTags.length === 0) {
      return { ...mission, requiredCompletionTags: [] };
    }
    return mission;
  });
  const missingCompletionTags = input.goal.completionTag && !knownTags.has(input.goal.completionTag)
    ? [input.goal.completionTag] : [];
  let route = planMissionRoute(baseInput(input, missions, reputation));
  if (missingCompletionTags.length) {
    route = {
      ...route, status: 'unreachable', steps: [], totalRuns: 0, totalMinutes: null,
      finalReputation: input.currentReputation,
      message: 'The required introduction must be completed; reputation alone does not unlock this operation.',
    };
  } else if (route.status === 'optimal' && prefix) {
    route = {
      ...route, steps: [prefix, ...route.steps], totalRuns: route.totalRuns + 1,
      totalMinutes: null,
    };
  } else if (route.status !== 'optimal' && prefix) {
    // A known first step is still useful even if no complete route can be
    // established. The non-optimal status is deliberately retained.
    route = { ...route, steps: [prefix], totalRuns: 1, totalMinutes: null, finalReputation: reputation };
  }
  if (introduction) {
    route = {
      ...route,
      assumptions: [
        ...route.assumptions,
        introduction.completed
          ? 'The player has confirmed completion of the displayed introduction; its reward is not added again.'
          : 'The verified introduction is a single initial step; only its explicit success reward and completion tag are applied.',
        'Optimality applies to this introduction-first route and the modeled repeatable contracts; other mission histories remain excluded.',
      ],
    };
  }
  return { route, introduction, missingCompletionTags };
}
