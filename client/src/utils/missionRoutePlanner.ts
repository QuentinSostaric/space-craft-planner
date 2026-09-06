import type {
  MissionIntelligenceRequirement,
  MissionRouteCandidate,
  MissionRouteExclusion,
  MissionRouteInput,
  MissionRouteResult,
  MissionRouteStep,
} from '../types/missionIntelligence';

// Fixed-point states prevent 0.1 + 0.2 from producing distinct reputation nodes.
const REPUTATION_SCALE = 1_000_000;
const DEFAULT_MAX_STATES = 50_000;

function reputationUnits(value: number): number | null {
  const scaled = value * REPUTATION_SCALE;
  const units = Math.round(scaled);
  return Number.isFinite(value)
    && Number.isSafeInteger(units)
    && Math.abs(units - scaled) <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
    ? units : null;
}

function requirementIsResolved(requirement: MissionIntelligenceRequirement): boolean {
  if (requirement.minStandingId && requirement.minReputation === null) return false;
  if (requirement.maxStandingId && requirement.maxReputationExclusive === null && !requirement.maxStandingResolved) return false;
  if (requirement.minStandingResolved === false || requirement.maxStandingResolved === false) return false;
  if (requirement.minReputation !== null && reputationUnits(requirement.minReputation) === null) return false;
  if (requirement.maxReputationExclusive !== null && reputationUnits(requirement.maxReputationExclusive) === null) return false;
  return requirement.minReputation === null || requirement.maxReputationExclusive === null
    || requirement.minReputation < requirement.maxReputationExclusive;
}

/** Candidates are scoped to a faction AND activity, rather than scope name alone. */
export function getMissionRouteCandidates(input: MissionRouteInput): {
  candidates: MissionRouteCandidate[];
  excludedMissions: MissionRouteExclusion[];
} {
  const candidates: MissionRouteCandidate[] = [];
  const excludedMissions: MissionRouteExclusion[] = [];
  const seenIds = new Set<string>();
  for (const mission of input.missions) {
    if (seenIds.has(mission.id)) continue;
    seenIds.add(mission.id);
    const rewards = mission.reputationRewards.filter((reward) => reward.trackId === input.trackId);
    if (rewards.length === 0) continue;
    const reasons = [...mission.plannerBlockers];
    const successKnown = rewards.every((reward) => typeof reward.success === 'number' && Number.isFinite(reward.success));
    const reputationGain = rewards.reduce((sum, reward) => sum + (reward.success ?? 0), 0);
    if (!successKnown) reasons.push('Success reputation is resolved at runtime or is unknown.');
    else if (reputationGain <= 0) reasons.push('No positive reputation gain on this track.');
    else if (reputationUnits(reputationGain) === null) reasons.push('Reputation precision exceeds the supported model.');
    if (mission.notForRelease || mission.workInProgress) reasons.push('This record is marked unreleased or work in progress.');
    if (mission.onceOnly) reasons.push('This mission can only be completed once; completion history is not modeled.');
    if (mission.cooldownSeconds !== null && mission.cooldownSeconds !== 0) reasons.push('A cooldown or runtime refresh restriction is not modeled.');
    if (mission.requiredCompletionTags.length || mission.excludedCompletionTags.length) {
      reasons.push('Mission completion prerequisites require history that is not modeled.');
    }
    if (mission.requirements.some((requirement) => requirement.trackId !== input.trackId)) {
      reasons.push('A standing requirement on another reputation track is not modeled.');
    }
    if (mission.requirements.some((requirement) => !requirementIsResolved(requirement))) {
      reasons.push('At least one standing boundary could not be resolved.');
    }
    const estimate = input.durationMinutesByMissionId?.[mission.id] ?? input.defaultDurationMinutes;
    const refreshWaitUnaccounted = (mission.generationRefresh?.respawnTime !== 0
      || mission.generationRefresh?.respawnTimeVariation !== 0) && !input.timingIncludesRefreshWait;
    const hasDuration = typeof estimate === 'number' && Number.isFinite(estimate) && estimate > 0;
    const minutes = hasDuration && !refreshWaitUnaccounted ? estimate : null;
    if (input.mode === 'time' && refreshWaitUnaccounted) {
      reasons.push('Mission offer refresh is nonzero or unknown. Confirm that your duration estimate includes waiting for another offer.');
    }
    if (input.mode === 'time' && !hasDuration) reasons.push('Enter a positive completion-time estimate to compare this mission.');
    if (reasons.length) {
      excludedMissions.push({ missionId: mission.id, title: mission.title, reasons: [...new Set(reasons)] });
    } else {
      candidates.push({ mission, reputationGain, minutes });
    }
  }
  return { candidates, excludedMissions };
}

function isUnlocked(candidate: MissionRouteCandidate, reputation: number): boolean {
  return candidate.mission.requirements.every((requirement) => {
    const inside = (requirement.minReputation === null || reputation >= requirement.minReputation)
      && (requirement.maxReputationExclusive === null || reputation < requirement.maxReputationExclusive);
    return requirement.exclude ? !inside : inside;
  });
}

interface RouteNode {
  reputation: number;
  cost: number;
  runs: number;
  previous: RouteNode | null;
  candidate: MissionRouteCandidate | null;
}

function earlier(left: RouteNode, right: RouteNode): boolean {
  return left.cost < right.cost
    || (left.cost === right.cost && (left.runs < right.runs
      || (left.runs === right.runs && left.reputation > right.reputation)));
}

/** Minimal binary heap, keeping the search O((states + edges) log states). */
class RouteQueue {
  private nodes: RouteNode[] = [];

  push(node: RouteNode) {
    this.nodes.push(node);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!earlier(node, this.nodes[parent])) break;
      this.nodes[index] = this.nodes[parent];
      index = parent;
    }
    this.nodes[index] = node;
  }

  pop(): RouteNode | undefined {
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (last && this.nodes.length) {
      let index = 0;
      while (index * 2 + 1 < this.nodes.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.nodes.length && earlier(this.nodes[child + 1], this.nodes[child])) child += 1;
        if (!earlier(this.nodes[child], last)) break;
        this.nodes[index] = this.nodes[child];
        index = child;
      }
      this.nodes[index] = last;
    }
    return first;
  }
}

function reconstruct(node: RouteNode, currentReputation: number, ceiling: number | null): {
  steps: MissionRouteStep[];
  totalMinutes: number | null;
  finalReputation: number;
} {
  const actions: MissionRouteCandidate[] = [];
  for (let cursor: RouteNode | null = node; cursor?.candidate; cursor = cursor.previous) {
    actions.push(cursor.candidate);
  }
  actions.reverse();
  const steps: MissionRouteStep[] = [];
  let units = reputationUnits(currentReputation)!;
  let totalMinutes: number | null = 0;
  for (const candidate of actions) {
    const before = units / REPUTATION_SCALE;
    units = Math.min(ceiling ?? Number.POSITIVE_INFINITY, units + reputationUnits(candidate.reputationGain)!);
    const after = units / REPUTATION_SCALE;
    totalMinutes = totalMinutes === null || candidate.minutes === null ? null : totalMinutes + candidate.minutes;
    const previous = steps.at(-1);
    if (previous?.missionId === candidate.mission.id) {
      previous.count += 1;
      previous.reputationAfter = after;
      previous.reputationGain = (units - reputationUnits(previous.reputationBefore)!) / REPUTATION_SCALE;
      previous.minutes = previous.minutes === null || candidate.minutes === null ? null : previous.minutes + candidate.minutes;
    } else {
      steps.push({
        missionId: candidate.mission.id,
        title: candidate.mission.title,
        count: 1,
        reputationBefore: before,
        reputationAfter: after,
        reputationGain: (units - reputationUnits(before)!) / REPUTATION_SCALE,
        minutes: candidate.minutes,
      });
    }
  }
  return { steps, totalMinutes, finalReputation: units / REPUTATION_SCALE };
}

/**
 * Exact shortest path within the declared deterministic model, never a greedy
 * reward/time ranking. Every eligible mission is considered again after each
 * completion so unlocks, excluded standings, and final-run overshoot are honored.
 * Runtime availability, history, cooldowns, failures, and travel changes are not
 * inferred. Missions depending on unmodeled gates are listed separately.
 */
export function planMissionRoute(input: MissionRouteInput): MissionRouteResult {
  const assumptions = [
    'Optimality is limited to the listed missions with known positive success gains and modeled standing gates.',
    'Every planned mission completes successfully; failure and abandonment are not simulated.',
    'Missions are available at their stated locations, with CrimeStat 0 and no additional runtime restrictions.',
    'Records without an explicit repeatability restriction are assumed repeatable; live event availability is not known.',
    'Contract counts are conditional on receiving the required offers; generator refresh can require waiting.',
    'Only the selected reputation track changes the route; unrelated rewards are not valued.',
    ...(input.mode === 'time' ? ['Completion times are user estimates including preparation and travel, constant for every repeat.'] : []),
    ...(input.timingIncludesRefreshWait ? ['The user has included waiting for mission offers in all supplied duration estimates.'] : []),
  ];
  const result: MissionRouteResult = {
    status: 'invalid', steps: [], totalRuns: 0, totalMinutes: null,
    finalReputation: input.currentReputation, exploredStates: 0,
    eligibleMissionCount: 0, excludedMissions: [], assumptions, message: null,
  };
  const start = reputationUnits(input.currentReputation);
  const target = reputationUnits(input.targetReputation);
  const ceiling = input.reputationCeiling == null ? null : reputationUnits(input.reputationCeiling);
  if (start === null || target === null || (input.reputationCeiling != null && ceiling === null)
    || (ceiling !== null && start > ceiling) || !input.trackId || !['count', 'time'].includes(input.mode)) {
    return { ...result, message: 'Enter finite reputation values with at most six decimal places and select a reputation track.' };
  }
  if (ceiling !== null && target > ceiling) {
    return { ...result, status: 'unreachable', message: 'The target exceeds the reputation ceiling declared for this track.' };
  }
  if (target <= start) return { ...result, status: 'optimal', totalMinutes: 0 };
  const { candidates, excludedMissions } = getMissionRouteCandidates(input);
  result.excludedMissions = excludedMissions;
  result.eligibleMissionCount = candidates.length;
  const maxStates = Number.isFinite(input.maxStates)
    ? Math.max(1, Math.min(250_000, Math.floor(input.maxStates!))) : DEFAULT_MAX_STATES;
  const queue = new RouteQueue();
  const initial: RouteNode = { reputation: start, cost: 0, runs: 0, previous: null, candidate: null };
  const best = new Map<number, RouteNode>([[start, initial]]);
  queue.push(initial);
  let node: RouteNode | undefined;
  while ((node = queue.pop())) {
    if (best.get(node.reputation) !== node) continue;
    result.exploredStates += 1;
    if (node.reputation === target) {
      return { ...result, ...reconstruct(node, input.currentReputation, ceiling), status: 'optimal', totalRuns: node.runs };
    }
    for (const candidate of candidates) {
      if (!isUnlocked(candidate, node.reputation / REPUTATION_SCALE)) continue;
      const reputation = Math.min(target, node.reputation + reputationUnits(candidate.reputationGain)!);
      const cost = node.cost + (input.mode === 'count' ? 1 : candidate.minutes!);
      if (!Number.isFinite(cost)) return { ...result, message: 'Completion-time estimates exceed the numeric range of the route model.' };
      const runs = node.runs + 1;
      const existing = best.get(reputation);
      if (existing && (existing.cost < cost || (existing.cost === cost && existing.runs <= runs))) continue;
      if (!existing && best.size >= maxStates) {
        return { ...result, status: 'bounded', message: 'The search limit was reached. Narrow the mission selection or choose a nearer reputation target; no optimal route is claimed.' };
      }
      const next: RouteNode = { reputation, cost, runs, previous: node, candidate };
      best.set(reputation, next);
      queue.push(next);
    }
  }
  return { ...result, status: 'unreachable', message: 'No route reaches this target using the known repeatable missions and modeled standing requirements.' };
}
