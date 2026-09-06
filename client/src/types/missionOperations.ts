export type OperationText = string | { en: string; fr: string };

export interface OperationEvidence {
  kind: string;
  path?: string;
  token?: string;
  recordId?: string;
  text?: string;
  url?: string;
  title?: string;
}

export interface OperationStep {
  id: string;
  title: OperationText;
  description: OperationText;
  optional: boolean;
  dependsOn: string[];
  evidence: OperationEvidence[];
}

export interface OperationContract {
  id: string;
  debugName: string;
  title: string;
  description: string;
  notForRelease: boolean;
  workInProgress: boolean;
  recordPath: string;
  templateId: string | null;
  buyInAmount?: number | null;
  blueprintRewards: { chance: number | null; poolId: string; poolName: string; blueprints: { id: string; name: string | null }[] }[];
  prerequisites: { type: string; attributes: Record<string, unknown>; refs: unknown[] }[];
}

export interface MissionOperation {
  id: string;
  title: string;
  subtitle: OperationText;
  systems: string[];
  kind: 'operation' | 'campaign' | 'sandbox' | 'event';
  groupGuidance: OperationText;
  summary: OperationText;
  availability: { kind: string; liveStatus: string };
  steps: OperationStep[];
  requirements: { text: OperationText; evidence: OperationEvidence[] }[];
  caveats: OperationText[];
  contracts: OperationContract[];
  unavailableContracts?: OperationContract[];
  sources: OperationEvidence[];
  accessGoals?: {
    title: OperationText;
    factionReputationGuid: string;
    scopeGuid: string;
    targetReputation: number;
    buyInUec?: number;
    completionTag?: string;
    note: OperationText;
  }[];
}

export interface MissionOperationsData {
  schemaVersion: number;
  build: { label: string; channel: string; version: string; buildNumber: string };
  summary: { operationCount: number; contractCount: number; stepCount: number };
  operations: MissionOperation[];
}
