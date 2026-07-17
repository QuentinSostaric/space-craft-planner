import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '../../../test/render';
import { AppAlert } from './AppAlert';

describe('AppAlert', () => {
  it('announces errors assertively via role="alert"', () => {
    renderWithProviders(<AppAlert severity="error">Sync failed</AppAlert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Sync failed');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces info politely via role="status"', async () => {
    const { container } = renderWithProviders(<AppAlert severity="info">Synced</AppAlert>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Synced');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect((await axe(container)).violations).toEqual([]);
  });
});
