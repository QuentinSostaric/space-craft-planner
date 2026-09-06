/** Build-specific facts extracted from game records; completion times are not game data. */
export interface MissionIntelligenceStanding {
  id: string;
  name: string | null;
  minReputation: number | null;
  gated: boolean;
}

export interface MissionIntelligenceTrack {
  id: string;
  factionGuid: string;
  factionName: string;
  scopeGuid: string;
  scopeName: string;
  initialReputation: number | null;
  reputationCeiling: number | null;
  standings: MissionIntelligenceStanding[];
}

export interface MissionIntelligenceReward {
  trackId: string;
  success: number | null;
  failure: number | null;
  abandon: number | null;
  outcomeAmounts: Array<number | null>;
  evidence: string[];
}

export interface MissionIntelligenceRequirement {
  trackId: string;
  minReputation: number | null;
  maxReputationExclusive: number | null;
  minStandingId: string | null;
  maxStandingId: string | null;
  minStandingResolved?: boolean;
  /** A resolved top standing has no next tier, so its upper boundary is null. */
  maxStandingResolved?: boolean;
  exclude: boolean;
}

export interface MissionIntelligencePrerequisite {
  type: string;
  summary: string;
  raw: unknown;
  evidence: string[];
}

export interface MissionIntelligenceMission {
  id: string;
  title: string;
  description: string | null;
  debugName: string;
  employer: string | null;
  sourceFile: string;
  templateFile: string | null;
  systems: string[];
  reputationRewards: MissionIntelligenceReward[];
  requirements: MissionIntelligenceRequirement[];
  prerequisites: MissionIntelligencePrerequisite[];
  completionTags: string[];
  requiredCompletionTags: string[];
  excludedCompletionTags: string[];
  onceOnly: boolean | null;
  cooldownSeconds: number | null;
  /** Raw generator values: their units have not been established. */
  generationRefresh?: { respawnTime: number | null; respawnTimeVariation: number | null };
  notForRelease: boolean;
  workInProgress: boolean;
  plannerBlockers: string[];
  evidence: string[];
}

export interface MissionIntelligenceData {
  schemaVersion: 1;
  build: {
    label: string;
    version: string;
    buildNumber: string | number;
    channel: string;
  };
  summary: Record<string, unknown>;
  tracks: MissionIntelligenceTrack[];
  missions: MissionIntelligenceMission[];
}

export type MissionRouteMode = 'count' | 'time';

export interface MissionRouteInput {
  missions: MissionIntelligenceMission[];
  trackId: string;
  currentReputation: number;
  targetReputation: number;
  reputationCeiling?: number | null;
  mode: MissionRouteMode;
  /** User estimates including travel, preparation, and completion, keyed by mission GUID. */
  durationMinutesByMissionId?: Record<string, number>;
  /** Optional user estimate for missions without their own duration. */
  defaultDurationMinutes?: number;
  /** User explicitly included waiting for new mission offers in duration estimates. */
  timingIncludesRefreshWait?: boolean;
  maxStates?: number;
}

export interface MissionRouteCandidate {
  mission: MissionIntelligenceMission;
  reputationGain: number;
  minutes: number | null;
}

export interface MissionRouteExclusion {
  missionId: string;
  title: string;
  reasons: string[];
}

export interface MissionRouteStep {
  missionId: string;
  title: string;
  count: number;
  reputationBefore: number;
  reputationAfter: number;
  reputationGain: number;
  /** Total assumed minutes for this group of consecutive contracts. */
  minutes: number | null;
}

export interface MissionRouteResult {
  status: 'optimal' | 'unreachable' | 'bounded' | 'invalid';
  steps: MissionRouteStep[];
  totalRuns: number;
  totalMinutes: number | null;
  finalReputation: number;
  exploredStates: number;
  eligibleMissionCount: number;
  excludedMissions: MissionRouteExclusion[];
  assumptions: string[];
  message: string | null;
}
