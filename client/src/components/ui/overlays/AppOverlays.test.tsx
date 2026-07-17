import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/render';
import { AppButton } from '../controls/AppButton';
import { AppDialog } from './AppDialog';
import { AppTooltip } from './AppTooltip';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AppButton onClick={() => setOpen(true)}>Open settings</AppButton>
      <AppDialog
        open={open}
        onOpenChange={setOpen}
        title="Craft settings"
        description="Choose how this craft should be simulated."
      >
        <AppButton onClick={() => setOpen(false)}>Save</AppButton>
      </AppDialog>
    </>
  );
}

describe('Prime-native overlays', () => {
  it('labels a dialog, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open settings' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Craft settings' });
    expect(dialog).toHaveAccessibleDescription('Choose how this craft should be simulated.');
    expect((await axe(container)).violations).toEqual([]);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('shows tooltip content for keyboard focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppTooltip content="Opens advanced settings" showDelay={0}>
        <button type="button">Advanced</button>
      </AppTooltip>,
    );

    await user.tab();

    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Opens advanced settings');
  });
});
