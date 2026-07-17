import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { renderWithProviders, screen } from '../../test/render';

describe('Button', () => {
  it('is keyboard operable and defaults to a non-submit button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(<Button onClick={onClick}>Craft</Button>);
    const button = screen.getByRole('button', { name: 'Craft' });

    expect(button).toHaveAttribute('type', 'button');
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<Button variant="primary">Craft</Button>);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
