import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../test/render';
import { AppChip } from './AppChip';

describe('AppChip', () => {
  it('supports keyboard activation for interactive chips', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(<AppChip label="Resources" onClick={onClick} selected />);

    const chip = screen.getByRole('button', { name: 'Resources' });
    await user.tab();
    expect(chip).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses a specific accessible label for remove actions', async () => {
    const onRemove = vi.fn();
    const { container } = renderWithProviders(
      <AppChip label="Agricium" onRemove={onRemove} removeLabel="Remove Agricium" />,
    );

    expect(screen.getByRole('button', { name: 'Remove Agricium' })).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
