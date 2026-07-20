import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../test/render';
import { AppMenu } from './AppMenu';

describe('AppMenu', () => {
  it('opens from its accessible trigger and selects an item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <AppMenu items={[{ key: 'account', label: 'Account', onSelect }]}>
        <button type="button">More</button>
      </AppMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'More' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Account', hidden: true }));

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
