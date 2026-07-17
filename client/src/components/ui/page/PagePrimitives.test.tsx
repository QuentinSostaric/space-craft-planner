import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/render';
import { AppTextField } from '../controls';
import { Panel } from '../Panel';
import { SurfaceState } from '../feedback';
import { PageHeader } from './PageHeader';
import { PageLayout } from './PageLayout';
import { ResponsiveFilters } from './ResponsiveFilters';

function ResponsiveFiltersHarness() {
  const [query, setQuery] = useState('');
  return (
    <ResponsiveFilters
      title="Catalog filters"
      triggerLabel="Open filters"
      closeLabel="Apply filters"
      dismissLabel="Close filters"
      summary={<span>2 active</span>}
    >
      <AppTextField label="Search" value={query} onValueChange={setQuery} />
    </ResponsiveFilters>
  );
}

describe('page normalization primitives', () => {
  it('provides one page heading and accessible layout semantics', async () => {
    const { container } = renderWithProviders(
      <PageLayout width="reading" component="article">
        <PageHeader variant="reading" eyebrow="Legal" title="Privacy policy" description="How account data is handled." meta="Updated today" />
        <p>Policy body</p>
      </PageLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('labels collapsible panels and exposes their controlled body', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Panel component="section" title="Simulation" collapsible collapseLabel="Toggle simulation">
        <p>Results</p>
      </Panel>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle simulation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls');
    expect(screen.getByRole('heading', { level: 2, name: 'Simulation' })).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens mobile filters in the shared dialog and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResponsiveFiltersHarness />);
    const trigger = screen.getByRole('button', { name: 'Open filters' });

    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Catalog filters' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('announces loading and error states with appropriate semantics', async () => {
    const { container, rerender } = renderWithProviders(
      <SurfaceState tone="loading" title="Loading catalog" description="Please wait" />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');

    rerender(<SurfaceState tone="error" title="Catalog unavailable" description="Try again later" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Catalog unavailable');
    expect((await axe(container)).violations).toEqual([]);
  });
});
