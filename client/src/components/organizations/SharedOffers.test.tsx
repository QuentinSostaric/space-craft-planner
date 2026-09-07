import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../../test/render';
import type { Blueprint } from '../../types';
import { SharedBlueprintOfferCard } from './SharedBlueprintOfferCard';
import { SharedResourceOfferCard } from './SharedResourceOfferCard';
import { CraftRequestDialog } from './CraftRequestDialog';
import type { SharedOfferOwner } from './sharedOfferTypes';

const blueprint: Blueprint = { id: 'rifle', name: 'Account Rifle', manufacturer: 'Behring', category: 'fps-weapon', craftTimeSecs: 60, baseStats: {}, slots: [] };
const owner: SharedOfferOwner = { handle: 'OtherCitizen', displayName: 'Other Citizen', rank: 'Member' };

describe('shared offer components', () => {
  it('keeps the named owner and request action visible without hovering', async () => {
    const user = userEvent.setup();
    const onRequest = vi.fn();
    const { container } = renderWithProviders(<SharedBlueprintOfferCard blueprint={blueprint} owner={owner} onRequest={onRequest} />);
    expect(screen.getByRole('article', { name: 'Account Rifle · Other Citizen' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Other Citizen' })).toHaveAttribute('href', 'https://robertsspaceindustries.com/citizens/OtherCitizen');
    await user.click(screen.getByRole('button', { name: 'Request Account Rifle from Other Citizen' }));
    expect(onRequest).toHaveBeenCalledOnce();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('prevents pending and self requests while preserving useful follow-up actions', async () => {
    const user = userEvent.setup();
    const onFollow = vi.fn();
    const onManage = vi.fn();
    const { rerender } = renderWithProviders(<SharedBlueprintOfferCard blueprint={blueprint} owner={owner} requestState="pending" onViewRequests={onFollow} />);
    expect(screen.getByRole('button', { name: 'Request pending' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Follow my request' }));
    expect(onFollow).toHaveBeenCalledOnce();
    rerender(<SharedBlueprintOfferCard blueprint={blueprint} owner={owner} requestState="self" onManageSharing={onManage} />);
    expect(screen.getByText('Your shared blueprint')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Request Account Rifle/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manage my sharing' }));
    expect(onManage).toHaveBeenCalledOnce();
  });

  it('retains each resource lot’s own unit and quality, with a safe owner link', async () => {
    const { container } = renderWithProviders(<SharedResourceOfferCard owner={{ ...owner, handle: 'Other/?Citizen' }} entry={{ id: 'lot', resourceId: 'iron', resourceName: 'Iron', quantity: 2.5, quantityUnit: 'scu', quality: null, createdAt: null, updatedAt: null }} />);
    expect(screen.getByText(/2\.5 SCU/)).toBeVisible();
    expect(screen.getByText('Quality unspecified')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View RSI profile' })).toHaveAttribute('href', 'https://robertsspaceindustries.com/citizens/Other%2F%3FCitizen');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('shows an accepted request and routes to tracking without creating a duplicate', async () => {
    const user = userEvent.setup();
    const onRequest = vi.fn();
    const onFollow = vi.fn();
    renderWithProviders(<SharedBlueprintOfferCard blueprint={blueprint} owner={owner} requestState="accepted" onRequest={onRequest} onViewRequests={onFollow} />);
    const status = screen.getByRole('button', { name: 'Request accepted' });
    expect(status).toBeDisabled();
    await user.click(status);
    expect(onRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'View requests' }));
    expect(onFollow).toHaveBeenCalledOnce();
  });

  it('bounds comments, sends one resource choice and retains the draft after an error', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const props = { open: true, blueprintName: blueprint.name, owner, onClose: vi.fn(), onSubmit };
    const { rerender } = renderWithProviders(<CraftRequestDialog {...props} />);
    const dialog = screen.getByRole('dialog', { name: 'Request a craft' });
    expect(dialog).toHaveAccessibleDescription('Send your request for Account Rifle to Other Citizen.');
    const comment = screen.getByRole('textbox', { name: 'Comment (optional)' });
    fireEvent.change(comment, { target: { value: 'x'.repeat(1100) } });
    expect(comment).toHaveValue('x'.repeat(1000));
    fireEvent.change(comment, { target: { value: '  Available tonight  ' } });
    await user.click(screen.getByRole('button', { name: 'Resources' }));
    await user.click(await screen.findByRole('option', { name: 'I will provide the resources', hidden: true }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ comment: 'Available tonight', resourcesOption: 'has_resources' });
    rerender(<CraftRequestDialog {...props} error="Connection interrupted" />);
    expect(comment).toHaveValue('  Available tonight  ');
    expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted');
    expect((await axe(document.body)).violations).toEqual([]);
  });

  it('resets a draft for a different recipient and describes community visibility without promising Discord', () => {
    const props = { open: true, blueprintName: blueprint.name, owner, onClose: vi.fn(), onSubmit: vi.fn(), source: 'community' as const };
    const { rerender } = renderWithProviders(<CraftRequestDialog {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment (optional)' }), { target: { value: 'Only for this crafter' } });
    rerender(<CraftRequestDialog {...props} owner={{ handle: 'NewCitizen', displayName: 'New Citizen' }} />);
    expect(screen.getByRole('textbox', { name: 'Comment (optional)' })).toHaveValue('');
    expect(screen.getByText(/The crafter will see your RSI identity/)).toBeVisible();
    expect(screen.queryByText(/Discord bot/)).not.toBeInTheDocument();
  });
});
