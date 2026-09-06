import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '../../test/render';
import { PlannerSavedWork } from './PlannerSavedWork';
import type { Blueprint, CraftGoal } from '../../types';
import { GoalsList } from './GoalsList';
import { FabricatorPage } from '../FabricatorPage';

const craft = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../store/CraftContext', () => ({ useCraft: () => craft.value }));

beforeEach(() => {
  window.history.replaceState({}, '', '/planner#planner-production');
  craft.value = {
    goals: [{ id: 'goal', blueprintId: 'rifle', blueprintName: 'Saved Rifle', category: 'fps-weapon', quantity: 2, qualityScore: 500, qualityScoreScale: 1000, slotAssignments: {}, projectedStats: {}, createdAt: 1 }],
    blueprints: [{ id: 'rifle', name: 'Saved Rifle', category: 'fps-weapon', detailsLoaded: true, craftTimeSecs: 30, slots: [{ id: 'iron', requiredResource: 'Iron', quantityUnit: 'scu', quantityScu: 2, minQuality: 0 }] }],
    plannerResourceRequirements: { Iron: { quantity: 3, quantityUnit: 'scu' } },
    plannerTodoItems: [{ id: 'task', title: 'Recover my mission blueprint', description: 'A saved task from an earlier session.', source: 'mission-blueprint', relatedBlueprintId: 'rifle', relatedBlueprintName: 'Saved Rifle', completed: false, createdAt: 1, completedAt: null }],
    resourceProgress: {}, activeBlueprint: null,
    ensureBlueprintDetailLoaded: vi.fn(), selectGoalBlueprint: vi.fn(), removeGoal: vi.fn(), updateGoalQuantity: vi.fn(), updateGoal: vi.fn(),
    clearPlannerResourceRequirement: vi.fn(), setResourceCollected: vi.fn(), setResourceMethod: vi.fn(),
    setActiveBlueprint: vi.fn(), addPlannerTodoItem: vi.fn(), updatePlannerTodoItem: vi.fn(), togglePlannerTodoItem: vi.fn(), removePlannerTodoItem: vi.fn(), clearCompletedPlannerTodoItems: vi.fn(),
  };
});

describe('saved planner work', () => {
  it('opens the saved plans when a same-page navigation targets their fragment', () => {
    window.history.replaceState({}, '', '/planner');
    renderWithProviders(<PlannerSavedWork />);
    expect(document.getElementById('planner-production')).not.toHaveAttribute('open');
    window.history.pushState({}, '', '/planner#planner-production');
    fireEvent.popState(window);
    expect(document.getElementById('planner-production')).toHaveAttribute('open');
    expect(screen.getByRole('link', { name: 'Goal: Saved Rifle' })).toBeInTheDocument();
  });

  it('shows a saved craft and reopens its configuration in the Fabricator', () => {
    renderWithProviders(<PlannerSavedWork />);
    fireEvent.click(screen.getByRole('link', { name: 'Goal: Saved Rifle' }));
    expect(craft.value.selectGoalBlueprint).toHaveBeenCalledWith('goal');
    expect(window.location.pathname).toBe('/item/saved-rifle');
    expect(window.location.search).toBe('?goal=goal');
  });

  it('combines material requests with the actual requirements of queued crafts', () => {
    renderWithProviders(<PlannerSavedWork />);
    fireEvent.click(screen.getByRole('button', { name: 'Materials · 1' }));
    expect(screen.getByText('Iron')).toBeInTheDocument();
    const amount = screen.getByRole('slider', { name: 'Collected amount' });
    expect(amount).toHaveAttribute('aria-valuemax', '7');
  });

  it('makes persisted manual and blueprint tasks reachable without showing all boards at once', () => {
    renderWithProviders(<PlannerSavedWork />);
    expect(screen.queryByText('Recover my mission blueprint')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tasks · 1' }));
    expect(screen.getByText('Recover my mission blueprint')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Goal: Saved Rifle' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark task completed' }));
    expect(craft.value.togglePlannerTodoItem).toHaveBeenCalledWith('task');
  });
});

const blueprint: Blueprint = {
  id: 'saved-rifle', name: 'Saved Rifle', category: 'fps-weapon', manufacturer: 'Test', detailsLoaded: true,
  baseStats: {}, craftTimeSecs: 30,
  slots: [{ id: 'iron', label: { en: 'Iron', fr: 'Fer' }, requirementType: 'resource', requirementName: 'Iron', requiredResource: 'Iron', requiredItem: null, requiredItemClass: null, minQuality: 0, quantityScu: 2, quantityValue: 2, quantityUnit: 'scu', quantityMultiplier: null, modifiers: [] }],
};
const goal: CraftGoal = { id: 'my-saved-goal', blueprintId: blueprint.id, blueprintName: blueprint.name, category: blueprint.category, quantity: 4, slotAssignments: { iron: 750 }, qualityScore: 750, qualityScoreScale: 1000, projectedStats: {}, createdAt: 1 };

const quality = () => screen.getByRole('slider', { name: 'Quality for Iron' });
const quantity = (value: number) => within(screen.getByRole('group', { name: 'Craft quantity' })).getByText(`×${value}`);

describe('saved goal to Fabricator handoff', () => {
beforeEach(() => {
  window.history.replaceState({}, '', '/planner');
  craft.value = {
    goals: [goal], blueprints: [blueprint], activeDataset: { datasetId: 'test-dataset', blueprints: [blueprint] }, activeBlueprint: null,
    missionRewards: null, missionRewardsLoading: false, inventoryIds: [], favoriteIds: [], factionContractsByFactionId: {}, dismantlingData: null, materialSources: null,
    selectGoalBlueprint: vi.fn(), removeGoal: vi.fn(), updateGoalQuantity: vi.fn(), updateGoal: vi.fn(), addGoal: vi.fn(),
    ensureBlueprintDetailLoaded: vi.fn(), ensureMissionRewardsLoaded: vi.fn(), ensureFactionContractsLoaded: vi.fn(), ensureResourceDataLoaded: vi.fn(),
    toggleInventory: vi.fn(), toggleFavorite: vi.fn(), addPlannerResourceRequirement: vi.fn(),
  };
});

  it('reopens the actual local simulator with the saved quantities and slot qualities', () => {
    const list = renderWithProviders(<GoalsList />);
    fireEvent.click(screen.getByRole('link', { name: 'Goal: Saved Rifle' }));
    expect(window.location.search).toBe('?goal=my-saved-goal');
    list.unmount();
    renderWithProviders(<FabricatorPage />);
    expect(quality()).toHaveAttribute('aria-valuetext', '75% quality, 750 of 1000');
    expect(quantity(4)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Planner' }));
    expect(craft.value.addGoal).toHaveBeenCalledWith(750, {}, 4, blueprint, { iron: 750 });
  });

  it('restores before delayed details arrive and preserves later user edits across detail refreshes', () => {
    window.history.replaceState({}, '', '/item/saved-rifle?goal=my-saved-goal');
    craft.value.activeDataset = { datasetId: 'test-dataset', blueprints: [{ ...blueprint, detailsLoaded: false, slots: [] }] };
    const page = renderWithProviders(<FabricatorPage />);
    expect(quantity(4)).toBeInTheDocument();
    craft.value.activeDataset = { datasetId: 'test-dataset', blueprints: [{ ...blueprint }] };
    page.rerender(<FabricatorPage />);
    expect(quality()).toHaveAttribute('aria-valuetext', '75% quality, 750 of 1000');
    fireEvent.click(screen.getByRole('button', { name: 'Increase quality' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    craft.value.activeDataset = { datasetId: 'test-dataset', blueprints: [{ ...blueprint, identity: { description: 'Later detail metadata' } }] };
    page.rerender(<FabricatorPage />);
    expect(quality()).toHaveAttribute('aria-valuetext', '80% quality, 800 of 1000');
    expect(quantity(5)).toBeInTheDocument();
  });

  it('resets an ordinary deep link and refuses a goal that belongs to another blueprint', () => {
    window.history.replaceState({}, '', '/item/saved-rifle?goal=my-saved-goal');
    const page = renderWithProviders(<FabricatorPage />);
    expect(quality()).toHaveAttribute('aria-valuetext', '75% quality, 750 of 1000');
    window.history.pushState({}, '', '/item/saved-rifle');
    fireEvent.popState(window);
    expect(quality()).toHaveAttribute('aria-valuenow', '0');
    expect(quantity(1)).toBeInTheDocument();

    craft.value.goals = [{ ...goal, blueprintId: 'different-item' }];
    window.history.pushState({}, '', '/item/saved-rifle?goal=my-saved-goal');
    fireEvent.popState(window);
    page.rerender(<FabricatorPage />);
    expect(quality()).toHaveAttribute('aria-valuenow', '0');
    expect(quantity(1)).toBeInTheDocument();
  });
});
