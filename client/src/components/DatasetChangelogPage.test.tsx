import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../test/render';
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
    const summary = screen.getAllByText('View all 12 changes').at(-1)!;
    const lastMetric = screen.getAllByText('metric-11').at(-1)!;
    expect(lastMetric).not.toBeVisible();
    await user.click(summary);
    expect(lastMetric).toBeVisible();
    await user.type(screen.getByRole('searchbox', { name: 'Search changes' }), 'metric-11');
    expect(screen.getAllByText('Engine test').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /^Added/ }));
    expect(screen.queryByText('Engine test')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^All/ }));
    expect(screen.getAllByText('Engine test').length).toBeGreaterThan(0);
  });
});
