import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/render';
import { AccountGuestView } from './AccountGuestView';

describe('AccountGuestView', () => {
  it('keeps login and bot callbacks and lets users choose a preview', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const onInviteBot = vi.fn();
    const { container } = renderWithProviders(
      <AccountGuestView enabled brandEnvironment="production" onLogin={onLogin} onInviteBot={onInviteBot} />,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in with Citizen iD' }));
    await user.click(screen.getByRole('button', { name: 'Add the Discord bot' }));
    expect(onLogin).toHaveBeenCalledOnce();
    expect(onInviteBot).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Your organizations' }));
    expect(screen.getByRole('button', { name: 'Your organizations' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Share on your terms' })).toBeVisible();
    expect(screen.getByAltText('Preview of organization blueprint sharing')).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('explains unavailable sign-in without disabling independent tools', () => {
    renderWithProviders(
      <AccountGuestView
        enabled={false}
        brandEnvironment="unstable"
        onLogin={vi.fn()}
        onInviteBot={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sign in with Citizen iD' })).toBeDisabled();
    expect(screen.getByText('Sign-in is temporarily unavailable in this environment.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add the Discord bot' })).toBeEnabled();
    expect(screen.getByAltText('Citizen iD')).toHaveAttribute(
      'src',
      expect.stringContaining('dev-logo-light'),
    );
  });
});
