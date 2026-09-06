import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from '../test/render';
import { DatasetChangelogPage } from './DatasetChangelogPage';

const data = vi.hoisted(() => {
  const blueprint = { id: 'part', name: 'Engine test', category: 'cooler', slots: [], craftTimeSecs: 1, media: null };
  const base = { datasetId: 'base', channel: 'live', version: '1', label: 'Before', blueprints: [{ ...blueprint, baseStats: Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`metric-${String(n).padStart(2, '0')}`, 1])) }], resources: [] };
  const target = { ...base, datasetId: 'target', label: 'After', blueprints: [{ ...blueprint, baseStats: Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`metric-${String(n).padStart(2, '0')}`, 2])) }] };
  return { base, target };
});
vi.mock('../store/CraftContext', () => ({ useCraft: () => ({ activeDataset: data.target, availableDatasets: [data.base, data.target] }) }));
vi.mock('../hooks/gameDataApi', () => ({ fetchPublishedDatasetById: async () => data.base }));

describe('changelog information disclosure', () => {
  it('keeps every change accessible beyond the former eight-detail limit and preserves status/search filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DatasetChangelogPage />);
    await screen.findAllByText('Engine test');
    const trigger = screen.getAllByRole('button', { name: 'View all 12 changes — Engine test' }).at(-1)!;
    expect(screen.queryByText('metric-00')).not.toBeInTheDocument();
    expect(screen.queryByText('metric-11')).not.toBeInTheDocument();
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Engine test' });
    expect(within(dialog).getByText('metric-00')).toBeVisible();
    expect(within(dialog).getByText('metric-11')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search changes' }), 'metric-11');
    expect(screen.getAllByText('Engine test').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /^Added/ }));
    expect(screen.queryByText('Engine test')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^All/ }));
    expect(screen.getAllByText('Engine test').length).toBeGreaterThan(0);
  });
});
