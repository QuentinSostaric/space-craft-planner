import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../test/render';
import type { Blueprint } from '../types';
import { BlueprintCard } from './BlueprintGrid';

// Exercise the real card without booting the enclosing catalog's account,
// desktop synchronization and analytics providers in the shared VM worker.
vi.mock('../store/CraftContext', () => ({ useCraft: vi.fn(), DEFAULT_INVENTORY_IDS: [] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/apiBaseUrl', () => ({ isTauriRuntime: () => false }));
vi.mock('../analytics/posthog', () => ({ trackEvent: vi.fn() }));
vi.mock('../hooks/useFeatureFlag', () => ({ useFlag: () => false }));
vi.mock('./BlueprintExplorer', () => ({ BlueprintExplorer: () => null }));
vi.mock('./ScLogSyncDialog', () => ({ SyncBlueprintsButton: () => null }));

const blueprint: Blueprint = {
  id: 'cq7', name: 'CQ7 Rifle', manufacturer: 'Behring', category: 'fps-weapon',
  craftTimeSecs: 180, baseStats: { damage: 18 }, slots: [],
};

const baseProps = { blueprint, resources: [], isActive: true, isFavorite: false, isInInventory: false };

describe('blueprint card navigation', () => {
  it('reopens the active item through its primary link and offers simulation without a planner callback', () => {
    const onSelect = vi.fn();
    renderWithProviders(<BlueprintCard {...baseProps} onSelect={onSelect} onToggleFavorite={vi.fn()} />);

    const itemLink = screen.getByRole('link', { name: 'Blueprint CQ7 Rifle by Behring' });
    expect(itemLink).toHaveAttribute('href', '/item/cq7-rifle');
    fireEvent.click(itemLink);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(blueprint);

    onSelect.mockClear();
    expect(screen.queryByRole('button', { name: 'Planner' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(blueprint);
  });

  it('dispatches supplied planner and collection actions without opening or clearing the item', () => {
    const onSelect = vi.fn();
    const onAddToPlanner = vi.fn();
    const onToggleFavorite = vi.fn();
    const onToggleInventory = vi.fn();
    renderWithProviders(<BlueprintCard {...baseProps} onSelect={onSelect} onAddToPlanner={onAddToPlanner}
      onToggleFavorite={onToggleFavorite} onToggleInventory={onToggleInventory} />);

    expect(screen.queryByRole('button', { name: 'Simulate' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Planner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
    expect(onAddToPlanner).toHaveBeenCalledExactlyOnceWith('cq7');
    expect(onToggleFavorite).toHaveBeenCalledExactlyOnceWith('cq7');
    expect(onToggleInventory).toHaveBeenCalledExactlyOnceWith('cq7');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
