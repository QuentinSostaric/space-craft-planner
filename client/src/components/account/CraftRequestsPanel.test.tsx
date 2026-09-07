import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '../../test/render';
import type { OptimisticAccountState } from '../../auth/accountMutations';
import type { AccountCraftRequest, StoredAccount } from '../../services/authService';
import { CraftRequestsPanel } from './CraftRequestsPanel';

function request(id: string, overrides: Partial<AccountCraftRequest> = {}): AccountCraftRequest {
  return {
    id,
    blueprintId: id,
    blueprintName: `Blueprint ${id}`,
    organizationSid: 'CRAFT',
    organizationName: 'Craft Guild',
    requesterAccountId: 'requester',
    requesterDisplayName: 'Élodie',
    requesterAvatarUrl: null,
    requesterRsiHandle: 'Elodie',
    ownerAccountId: 'owner',
    ownerDisplayName: 'Alex',
    ownerAvatarUrl: null,
    ownerRsiHandle: 'Alex',
    comment: 'Ressources à récupérer',
    resourcesOption: 'has_resources',
    status: 'pending',
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-02T12:00:00Z',
    respondedAt: null,
    ...overrides,
  };
}

function account(
  incomingCraftRequests: AccountCraftRequest[],
  outgoingCraftRequests: AccountCraftRequest[] = [],
): StoredAccount {
  return {
    accountId: 'owner',
    provider: 'discord',
    providerUserId: 'owner',
    profile: {
      id: 'owner',
      username: 'Alex',
      globalName: null,
      discriminator: null,
      avatarUrl: null,
      displayName: 'Alex',
    },
    favoriteBlueprintIds: [],
    inventoryBlueprintIds: [],
    inventoryResources: [],
    planner: { goals: [], todoItems: [], resourceRequirements: {}, resourceProgress: {} },
    organizationBlueprintShares: {},
    organizationResourceShares: {},
    sharedBlueprintIds: [],
    sharedResourceEntryIds: [],
    organizations: [],
    incomingCraftRequests,
    outgoingCraftRequests,
    rsi: null,
    isAdmin: false,
    lastRsiLinkAt: null,
    onboardingCompletedAt: null,
    onboardingDismissedAt: null,
    createdAt: null,
    updatedAt: null,
    lastLoginAt: null,
  };
}

function propsFor(value: StoredAccount | null) {
  return {
    account: value,
    optimisticState: {
      account: value,
      pendingMutations: [],
      syncStatus: 'idle',
      lastFlushAt: null,
      lastError: null,
    } as OptimisticAccountState,
    syncStatus: 'idle' as const,
    syncError: null,
    craftRequestActionId: null,
    craftRequestError: null,
    craftRequestNotice: null,
    onRespondToCraftRequest: vi.fn(),
  };
}

describe('CraftRequestsPanel', () => {
  it('combines direction, status and accent-insensitive search, then restores the full history', async () => {
    const user = userEvent.setup();
    const value = account(
      [
        request('received'),
        request('done', {
          status: 'closed',
          requesterDisplayName: 'Pat',
          requesterRsiHandle: 'Pat',
          comment: null,
        }),
      ],
      [request('sent', { status: 'accepted' })],
    );
    renderWithProviders(<CraftRequestsPanel {...propsFor(value)} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Received · 2' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search requests' }), {
      target: { value: 'elodie' },
    });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Blueprint received' })).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search requests' }), {
      target: { value: 'recuperer' },
    });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Closed', hidden: true }));
    expect(screen.getByText('No matching requests')).toBeVisible();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('recovers from invalid saved preferences and presents a useful first-use empty state', () => {
    localStorage.setItem('craft-requests-view-mode', '"retired-filter"');
    localStorage.setItem('craft-requests-status-filter', 'null');
    const { rerender } = renderWithProviders(<CraftRequestsPanel {...propsFor(account([request('one')]))} />);
    expect(screen.getByRole('article')).toBeVisible();
    expect(screen.getByRole('button', { name: 'All requests · 1' })).toHaveAttribute('aria-pressed', 'true');
    rerender(<CraftRequestsPanel {...propsFor(account([]))} />);
    expect(screen.getByText('No craft requests yet')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('sorts by recent activity, unanswered incoming requests or creation date', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CraftRequestsPanel
        {...propsFor(
          account(
            [
              request('needs-reply', {
                createdAt: '2026-09-02T12:00:00Z',
                updatedAt: '2026-09-02T12:00:00Z',
              }),
              request('oldest', {
                status: 'accepted',
                createdAt: '2026-09-01T12:00:00Z',
                updatedAt: '2026-09-03T12:00:00Z',
              }),
            ],
            [request('recent', { updatedAt: '2026-09-04T12:00:00Z' })],
          ),
        )}
      />,
    );
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Blueprint recent');
    await user.click(screen.getByRole('button', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Awaiting my reply first', hidden: true }));
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Blueprint needs-reply');
    await user.click(screen.getByRole('button', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Oldest request first', hidden: true }));
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Blueprint oldest');
    expect(localStorage.getItem('craft-requests-sort')).toBe('"oldest"');
  });

  it('only offers decisions compatible with the request status and participant role', async () => {
    const user = userEvent.setup();
    const props = propsFor(
      account(
        [
          request('pending'),
          request('accepted', { status: 'accepted' }),
          request('declined', { status: 'denied' }),
          request('closed', { status: 'closed' }),
        ],
        [request('outgoing')],
      ),
    );
    renderWithProviders(<CraftRequestsPanel {...props} />);
    const pending = within(screen.getByRole('article', { name: 'Blueprint pending' }));
    await user.click(pending.getByRole('button', { name: 'Accept' }));
    await user.click(pending.getByRole('button', { name: 'Decline' }));
    expect(props.onRespondToCraftRequest).toHaveBeenNthCalledWith(1, 'pending', 'accepted');
    expect(props.onRespondToCraftRequest).toHaveBeenNthCalledWith(2, 'pending', 'denied');
    expect(pending.queryByRole('button', { name: 'Delete request' })).not.toBeInTheDocument();
    const outgoing = within(screen.getByRole('article', { name: 'Blueprint outgoing' }));
    expect(outgoing.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    await user.click(outgoing.getByRole('button', { name: 'Cancel request' }));
    expect(props.onRespondToCraftRequest).toHaveBeenLastCalledWith('outgoing', 'closed');
    const accepted = within(screen.getByRole('article', { name: 'Blueprint accepted' }));
    expect(accepted.queryByRole('button', { name: 'Delete request' })).not.toBeInTheDocument();
    await user.click(accepted.getByRole('button', { name: 'Close request' }));
    expect(props.onRespondToCraftRequest).toHaveBeenLastCalledWith('accepted', 'closed');
    expect(
      within(screen.getByRole('article', { name: 'Blueprint closed' })).queryByRole('button', {
        name: 'Close request',
      }),
    ).not.toBeInTheDocument();
  });

  it('blocks a second decision while an optimistic mutation is awaiting confirmation', () => {
    const props = propsFor(account([request('one', { status: 'accepted' })]));
    props.optimisticState.pendingMutations = [
      {
        id: 'mutation',
        kind: 'craft-request-decision',
        scope: 'command',
        accountId: 'owner',
        createdAt: 1,
        flushAfterMs: 0,
        payload: { requestId: 'one', decision: 'accepted' },
      },
    ];
    renderWithProviders(<CraftRequestsPanel {...props} syncStatus="syncing" />);
    expect(screen.getByRole('button', { name: 'Close request' })).toBeDisabled();
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/waiting for cloud confirmation/)).toBeVisible();
  });

  it('explains deletion affects both participants and requires the explicit delete action', async () => {
    const user = userEvent.setup();
    const props = propsFor(account([request('closed', { status: 'closed' })]));
    renderWithProviders(<CraftRequestsPanel {...props} />);
    await user.click(screen.getByRole('button', { name: 'Delete request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this craft request?' });
    expect(dialog).toHaveAccessibleDescription(/both your history and the other participant/);
    expect(props.onRespondToCraftRequest).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete for both participants' }));
    expect(props.onRespondToCraftRequest).toHaveBeenCalledExactlyOnceWith('closed', 'deleted');
  });

  it('only links to an active owner DM and encodes RSI path segments', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CraftRequestsPanel
        {...propsFor(
          account(
            [
              request('valid', {
                ownerDiscordChannelId: '123',
                ownerDiscordMessageId: '456',
                requesterRsiHandle: 'test/../../x',
                organizationSid: 'A?B',
              }),
              request('invalid', {
                ownerDiscordChannelId: 'javascript:alert(1)',
                ownerDiscordMessageId: '456',
              }),
              request('closed', {
                status: 'closed',
                ownerDiscordChannelId: '123',
                ownerDiscordMessageId: '456',
              }),
            ],
            [request('sent', { ownerDiscordChannelId: '123', ownerDiscordMessageId: '456' })],
          ),
        )}
      />,
    );
    const links = screen.getAllByRole('link', { name: 'Open in Discord' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://discord.com/channels/@me/123/456');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    const validArticle = screen.getByRole('article', { name: 'Blueprint valid' });
    await user.click(within(validArticle).getByText('Comment, activity & contact'));
    expect(within(validArticle).getByRole('link', { name: /RSI profile/ })).toHaveAttribute(
      'href',
      'https://robertsspaceindustries.com/citizens/test%2F..%2F..%2Fx',
    );
    expect(within(validArticle).getByRole('link', { name: /RSI organization/ })).toHaveAttribute(
      'href',
      'https://robertsspaceindustries.com/orgs/A%3FB',
    );
  });

  it('has accessible labels and list semantics', async () => {
    const { container } = renderWithProviders(
      <CraftRequestsPanel {...propsFor(account([request('one')]))} />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
