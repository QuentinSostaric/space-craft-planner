import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../../test/render';
import type { MissionIntelligenceData, MissionIntelligenceMission } from '../../types/missionIntelligence';
import type { MissionOperation, MissionOperationsData } from '../../types/missionOperations';
import { MissionProgressionPanel } from './MissionProgressionPanel';
import { MissionOperationsPanel } from './MissionOperationsPanel';
import { MissionWorkspace } from './MissionWorkspace';

const snapshots = vi.hoisted(() => ({ intelligence: null as unknown, operations: null as unknown }));
vi.mock('../../hooks/useMissionSnapshot', () => ({
  MISSION_REFERENCE_BUILD: '12519617',
  useMissionSnapshot: (kind: 'intelligence' | 'operations') => ({
    data: snapshots[kind], loading: false, error: false, retry: vi.fn(),
  }),
}));
vi.mock('../../store/CraftContext', () => ({
  useCraft: () => ({ activeDataset: { buildNumber: '12519617', channel: 'live' } }),
}));

const trackId = 'test-faction:test-scope';
function mission(id: string, title: string, gain: number): MissionIntelligenceMission {
  return {
    id, title, description: '', debugName: id, employer: 'Test Faction',
    sourceFile: 'test.xml', templateFile: null, systems: ['Stanton'],
    reputationRewards: [{ trackId, success: gain, failure: -1, abandon: -2, outcomeAmounts: [], evidence: [] }],
    requirements: [], prerequisites: [], completionTags: [], requiredCompletionTags: [], excludedCompletionTags: [],
    onceOnly: false, cooldownSeconds: 0, notForRelease: false, workInProgress: false, plannerBlockers: [], evidence: [],
    generationRefresh: { respawnTime: 0, respawnTimeVariation: 0 },
  };
}

function intelligence(): MissionIntelligenceData {
  return {
    schemaVersion: 1,
    build: { label: 'test', version: '4.10', buildNumber: '12519617', channel: 'live' },
    summary: {},
    tracks: [{
      id: trackId, factionGuid: 'test-faction', factionName: 'Test Faction',
      scopeGuid: 'test-scope', scopeName: 'Standing', initialReputation: 0, reputationCeiling: 100,
      standings: [{ id: 'neutral', name: 'Neutral', minReputation: 0, gated: false }, { id: 'goal', name: 'Contractor', minReputation: 10, gated: false }],
    }],
    missions: [mission('quick', 'Quick patrol', 6), mission('complete', 'Complete patrol', 10)],
  };
}

function operation(id: string, title: string): MissionOperation {
  return {
    id, title, subtitle: 'Test operation', systems: ['Stanton'], kind: 'operation',
    groupGuidance: 'Bring a crew.', summary: 'Complete the objectives.',
    availability: { kind: 'conditional', liveStatus: 'unknown' },
    requirements: [], caveats: [], contracts: [], sources: [],
    steps: [
      { id: 'switches', title: 'Activate switches', description: 'Activate the control switches.', optional: false, dependsOn: [], evidence: [] },
      { id: 'laser', title: 'Activate laser', description: 'Use the laser controls.', optional: false, dependsOn: ['switches'], evidence: [] },
    ],
  };
}

function operations(buildNumber = '12519617'): MissionOperationsData {
  return {
    schemaVersion: 1, build: { label: 'test', version: '4.10', buildNumber, channel: 'live' },
    summary: { operationCount: 2, contractCount: 0, stepCount: 4 },
    operations: [operation('one', 'Operation One'), operation('two', 'Operation Two')],
  };
}

beforeEach(() => {
  snapshots.intelligence = intelligence();
  snapshots.operations = operations();
  window.history.replaceState({}, '', '/missions');
});

describe('mission reputation controls', () => {
  it('invalidates the old route after time edits and computes a different route in count mode', () => {
    renderWithProviders(<MissionProgressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Fastest time' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration for Quick patrol' }), { target: { value: '4' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration for Complete patrol' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('1 missions')).toBeInTheDocument();
    expect(screen.getAllByText('7 min')).not.toHaveLength(0);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration for Quick patrol' }), { target: { value: '1' } });
    expect(screen.queryByText('Optimal within the selected model')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('2 missions')).toBeInTheDocument();
    expect(screen.getAllByText('2 min')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Fewest missions' }));
    expect(screen.queryByText('Optimal within the selected model')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('1 missions')).toBeInTheDocument();
    expect(screen.getAllByText('7 min')).not.toHaveLength(0);
  });

  it('rejects blank and above-ceiling targets instead of silently substituting zero', () => {
    renderWithProviders(<MissionProgressionPanel />);
    const target = screen.getByRole('spinbutton', { name: 'Target reputation points' });
    const calculate = screen.getByRole('button', { name: 'Calculate my route' });
    fireEvent.change(target, { target: { value: '' } });
    expect(calculate).toBeDisabled();
    fireEvent.change(target, { target: { value: '101' } });
    expect(calculate).toBeDisabled();
    fireEvent.change(target, { target: { value: '10' } });
    expect(calculate).toBeEnabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Current reputation points' }), { target: { value: '' } });
    expect(calculate).toBeDisabled();
  });

  it('recognizes operation access points that the player has already reached', () => {
    localStorage.setItem(`itemfab:mission-route:12519617:${trackId}`, JSON.stringify({ current: '20', target: '50' }));
    window.history.replaceState({}, '', `/missions?view=reputation&track=${encodeURIComponent(trackId)}&target=10`);
    renderWithProviders(<MissionProgressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('The target is already reached.')).toBeInTheDocument();
    expect(screen.getByText('0 missions')).toBeInTheDocument();
  });

  it('does not claim a time route when every completion estimate is missing', () => {
    renderWithProviders(<MissionProgressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Fastest time' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Default time per mission (min)' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('No verified route for this target')).toBeInTheDocument();
    expect(screen.queryByText('Optimal within the selected model')).not.toBeInTheDocument();
  });

  it('defaults to contract count without inventing an ETA and requires waiting estimates for a timed route', () => {
    const data = intelligence();
    // Same raw refresh values as the extracted Highpoint Breaker Station mission.
    for (const mission of data.missions) mission.generationRefresh = { respawnTime: 5, respawnTimeVariation: 2 };
    snapshots.intelligence = data;
    renderWithProviders(<MissionProgressionPanel />);
    expect(screen.getByRole('button', { name: 'Fewest missions' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('1 missions')).toBeInTheDocument();
    expect(screen.queryByText('15 min')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fastest time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('No verified route for this target')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /^My times include waiting for mission offers/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my route' }));
    expect(screen.getByText('1 missions')).toBeInTheDocument();
    expect(screen.getAllByText('15 min')).not.toHaveLength(0);
  });
});

describe('operation guidance', () => {
  it('opens the operation reputation goal while preserving the player’s stored current points', () => {
    const data = operations();
    data.operations[0].accessGoals = [{
      title: 'Unlock the operation', factionReputationGuid: 'test-faction', scopeGuid: 'test-scope',
      targetReputation: 50, note: 'Reach the reputation threshold.',
    }];
    snapshots.operations = data;
    localStorage.setItem(`itemfab:mission-route:12519617:${trackId}`, JSON.stringify({ current: '4', target: '10' }));
    window.history.replaceState({}, '', '/missions?view=operations');
    renderWithProviders(<MissionWorkspace catalog={<div>Contract catalog</div>} />);
    fireEvent.click(screen.getByText('Preparation', { exact: true }));
    fireEvent.click(screen.getByText('Plan this reputation'));
    expect(screen.getByRole('spinbutton', { name: 'Target reputation points' })).toHaveValue(50);
    expect(screen.getByRole('spinbutton', { name: 'Current reputation points' })).toHaveValue(4);
    const params = new URLSearchParams(window.location.search);
    expect(params.get('track')).toBe(trackId);
    expect(params.get('operation')).toBe('one');
  });

  it('completes the current step, resumes at the next objective and keeps each operation separate', () => {
    const view = renderWithProviders(<MissionOperationsPanel />);
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '1');
    fireEvent.click(screen.getByRole('button', { name: /Operation Two/ }));
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '0');
    fireEvent.click(screen.getByRole('button', { name: /Operation One/ }));
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
    view.unmount();
    renderWithProviders(<MissionOperationsPanel />);
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '1');
    fireEvent.click(screen.getByText('Route', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows completion and lets the player undo the last completed step', () => {
    renderWithProviders(<MissionOperationsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(screen.getByText('Operation complete', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.queryByRole('button', { name: 'Complete step' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByText('Operation complete', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '1');
    expect(JSON.parse(localStorage.getItem('itemfab:operation:12519617:one') ?? '[]')).toEqual(['switches']);
  });

  it('lets the player inspect the route without changing progress and resumes the first incomplete step after completion', () => {
    renderWithProviders(<MissionOperationsPanel />);
    fireEvent.click(screen.getByText('Route', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Activate laser' }));
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '1');
  });

  it('allows inspecting and reopening a completed objective after the operation is complete', () => {
    renderWithProviders(<MissionOperationsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(screen.getByText('Operation complete', { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Route', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Activate switches' }));
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Reopen step' }));
    expect(screen.getByRole('button', { name: 'Complete step' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '1');
    expect(JSON.parse(localStorage.getItem('itemfab:operation:12519617:one') ?? '[]')).toEqual(['laser']);
  });

  it('keeps reward groups usable when an extracted blueprint has no resolved name', () => {
    const data = operations();
    data.operations[0].contracts = [{
      id: 'asd-repeat-contract', debugName: 'ASD_Repeat', title: 'Project Hyperion', description: '',
      notForRelease: false, workInProgress: false, recordPath: 'test.xml', templateId: null,
      blueprintRewards: [{
        chance: null, poolId: 'asd-rewards', poolName: 'ASD reward pool',
        blueprints: [{ id: 'unresolved-blueprint', name: null }, { id: 'resolved-blueprint', name: 'Field Repair Tool' }],
      }],
      prerequisites: [],
    }];
    snapshots.operations = data;
    renderWithProviders(<MissionOperationsPanel />);
    fireEvent.click(screen.getByText('Rewards', { exact: true }));
    fireEvent.click(screen.getByText('Reward group 1 · 2 blueprints'));

    const unidentified = screen.getByText('Unidentified blueprint');
    expect(unidentified).toBeVisible();
    expect(unidentified.closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'Field Repair Tool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete step' })).toBeEnabled();
  });

  it('keeps the active objective usable if the location image fails to load', () => {
    const data = operations();
    data.operations[0] = operation('qv-breaker', 'QV Breaker Stations');
    snapshots.operations = data;
    renderWithProviders(<MissionOperationsPanel />);
    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
  });

  it('does not reuse old-build or unknown-step completion marks', () => {
    localStorage.setItem('itemfab:operation:12519617:one', JSON.stringify(['switches', 'removed-step']));
    const view = renderWithProviders(<MissionOperationsPanel />);
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('heading', { name: 'Activate laser' })).toBeInTheDocument();
    view.unmount();
    snapshots.operations = operations('next-build');
    renderWithProviders(<MissionOperationsPanel />);
    expect(screen.getByRole('heading', { name: 'Activate switches' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '0');
  });
});
