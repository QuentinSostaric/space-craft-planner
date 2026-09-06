import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '../../test/render';
import type { MaterialSourceProvider, MissionContract, Resource, ResourceInsight } from '../../types';
import { readLocalInventoryResources } from '../../auth/localAccountImport';
import { ResourcesPage } from '../ResourcesPage';

const mock = vi.hoisted(() => ({
  craft: {} as Record<string, unknown>,
  addPlanner: vi.fn(),
  ensureResources: vi.fn(),
  ensureMissions: vi.fn(),
  ensureFaction: vi.fn(),
}));
vi.mock('../../store/CraftContext', () => ({ useCraft: () => mock.craft }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ account: null, updateInventoryResources: vi.fn() }) }));
// The resource guide owns filtering and resource actions; catalog cards bring
// unrelated desktop-sync and analytics providers into the shared VM module graph.
vi.mock('../BlueprintGrid', () => ({ BlueprintCard: () => null }));

function resource(id: string, visualKind: Resource['visualKind']): Resource {
  return { id, name: id === 'ferron' ? 'Ferron' : 'Bexalite', description: `${id} resource properties`, color: '#829ba1', visualKind, visual: null, visualStatus: null, visualNotes: `${id} visual notes` };
}
const provider: MaterialSourceProvider = {
  providerId: 'daymar', providerDisplayName: 'Daymar', providerType: 'body-provider', sourceMethod: 'ship-mining',
  mineableGroupName: 'Surface_deposits', system: 'Stanton', tier: '3', providerProbabilityPct: 35,
  groupProbabilityPct: null, craftOnlyProbabilityPct: null, labelConfidence: 'localized-starmap-record',
};

beforeEach(() => {
  window.history.replaceState({}, '', '/resources');
  mock.addPlanner.mockClear();
  mock.ensureFaction.mockClear();
  mock.craft = {
    activeDataset: { resources: [resource('ferron', 'metal'), resource('bexalite', 'mineral')] },
    blueprints: [], materialSources: { resources: { ferron: { providers: [provider] } }, providers: [provider] },
    factionContractsByFactionId: {}, ensureFactionContractsLoaded: mock.ensureFaction,
    missionRewards: { factionGroups: [] }, missionRewardsLoading: false, resourceDataLoading: false,
    resourceProgress: {}, favoriteIds: [], inventoryIds: [], toggleFavorite: vi.fn(), toggleInventory: vi.fn(),
    addPlannerResourceRequirement: mock.addPlanner, ensureResourceDataLoaded: mock.ensureResources,
    ensureMissionRewardsLoaded: mock.ensureMissions, setActiveBlueprint: vi.fn(),
  };
});

describe('resource guide', () => {
  it('selects one resource preview and keeps search, properties and collection actions available', () => {
    renderWithProviders(<ResourcesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Explore Ferron' }));
    const preview = screen.getByLabelText('Ferron preview');
    expect(within(preview).getByText('Daymar')).toBeInTheDocument();
    expect(within(preview).getByText('35%')).toBeInTheDocument();
    fireEvent.click(within(preview).getByText('Plan collection'));
    expect(mock.addPlanner).toHaveBeenCalledWith('Ferron', 1, 'scu');
    expect(screen.getByRole('link', { name: 'View planner' })).toHaveAttribute('href', '/planner#planner-production');
    const properties = within(preview).getByText('Uses & properties').closest('details');
    expect(properties).not.toHaveAttribute('open');
    fireEvent.click(within(preview).getByText('Uses & properties'));
    expect(properties).toHaveAttribute('open');
    expect(within(preview).getByText('ferron resource properties')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search resources' }), { target: { value: 'Bexalite' } });
    expect(screen.queryByRole('button', { name: 'Explore Ferron' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bexalite preview')).toBeInTheDocument();
  });

  it('opens source details and switches to mission or blueprint use without losing resource properties', () => {
    window.history.replaceState({}, '', '/resources/ferron');
    renderWithProviders(<ResourcesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ferron' })).toBeInTheDocument();
    const sourceDetails = screen.getByText('Daymar').closest('details');
    expect(sourceDetails).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Daymar'));
    expect(sourceDetails).toHaveAttribute('open');
    expect(screen.getByText('Surface deposits')).toBeVisible();
    expect(screen.getByText('Mapped location')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Missions 0' }));
    expect(screen.queryByText('Daymar')).not.toBeInTheDocument();
    expect(screen.getByText('No mission objectives currently reference this resource.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Blueprints 0' }));
    expect(screen.getByText('No blueprint currently uses this resource.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Properties & uses'));
    expect(screen.getByText('ferron resource properties')).toBeVisible();
    expect(screen.getByText('ferron visual notes')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Where to find it 1' }));
    expect(screen.getByText('Daymar')).toBeInTheDocument();
  });

  it('loads only indexed faction chunks when missions are requested and shows the matching contracts', () => {
    window.history.replaceState({}, '', '/resources/ferron');
    mock.craft.missionRewards = {
      factionGroups: [{ id: 'shubin', contractorDisplayName: 'Shubin', contractCount: 1, contracts: [] }, { id: 'unrelated', contractorDisplayName: 'Other', contractCount: 4 }],
      resourceObjectiveIndex: { ferron: ['shubin'] },
    };
    const view = renderWithProviders(<ResourcesPage />);
    expect(mock.ensureFaction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Missions/ }));
    expect(mock.ensureFaction).toHaveBeenCalledExactlyOnceWith('shubin');
    expect(screen.getByText('Loading mission data...')).toBeInTheDocument();
    expect(screen.queryByText('No mission objectives currently reference this resource.')).not.toBeInTheDocument();
    const contract: MissionContract = {
      contractFile: 'ferron-haul', handlerDebugName: null, contractDebugName: 'Ferron_Haul', contractType: null,
      title: { displayText: 'Deliver Ferron' }, contractorDisplayName: 'Shubin', faction: null, reputationScope: null,
      minimumRequiredStandings: [], availability: { derivedScale: 'local', localities: ['Daymar'], explicitLocations: [], hasHandlerAvailabilityRules: false },
      rewardedBlueprints: [], itemAwards: [], resourceObjectives: [{ resourceId: 'ferron', displayName: 'Ferron', minScu: 3, maxScu: 3, maxContainerSize: 1 }],
    };
    mock.craft.factionContractsByFactionId = { shubin: [contract] };
    view.rerender(<ResourcesPage />);
    expect(screen.getByText('Deliver Ferron')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Missions 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Loading mission data...')).not.toBeInTheDocument();
  });

  it.each([
    [120.72, '120.72 SCU'],
    [0, 'Unknown · 0/2 recipes loaded'],
  ])('uses published recipe volume %s instead of empty slim recipe slots', (volume, expected) => {
    window.history.replaceState({}, '', '/resources/ferron');
    const insight: ResourceInsight = {
      resourceId: 'ferron', providerCount: 1, systems: ['Stanton'], providerTypes: ['planetary'], sourceMethods: ['ship-mining'],
      missionObjectiveContractCount: 0, missionEmployers: [], missionLocations: [], blueprintUsageCount: 2,
      blueprintCategoryCounts: {}, blueprintIds: ['slim-a', 'slim-b'], totalScuPerCraftSum: volume,
    };
    mock.craft.activeDataset = { resources: [resource('ferron', 'metal')], resourceInsights: [insight] };
    mock.craft.blueprints = [{ id: 'slim-a', slots: [], detailsLoaded: false }, { id: 'slim-b', slots: [], detailsLoaded: false }];
    renderWithProviders(<ResourcesPage />);
    fireEvent.click(screen.getByText('Properties & uses'));
    expect(screen.getByText(expected)).toBeVisible();
    expect(screen.queryByText('0 SCU')).not.toBeInTheDocument();
  });

  it('adds inventory from the resource detail with the existing quantity and quality controls', async () => {
    window.history.replaceState({}, '', '/resources/ferron');
    renderWithProviders(<ResourcesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to inventory' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Ferron to inventory' });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Quantity (SCU)' }), { target: { value: '2.5' } });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Quality (optional)' }), { target: { value: '85' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add entry' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readLocalInventoryResources()).toEqual([expect.objectContaining({ resourceId: 'ferron', quantity: 2.5, quantityUnit: 'scu', quality: 85 })]);
  });
});
