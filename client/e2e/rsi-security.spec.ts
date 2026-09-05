import { expect, test } from '@playwright/test';
import type { AuthenticatedUser, StoredAccount } from '../src/services/authService';
import { installDeterministicState } from './fixtures';

test('legacy RSI links require a server challenge and invalidate it when the handle changes', async ({ page, context }) => {
  const errors = await installDeterministicState(page);
  await page.addInitScript(() => {
    // This account is returning; no guest inventory import should obscure it.
    localStorage.setItem('sc-craft-inventory', '[]');
    localStorage.setItem('sc-craft-inventory-seed-version', '1');
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const user: AuthenticatedUser = {
    id: 'e2e-account', username: 'test-user', globalName: null,
    discriminator: null, avatarUrl: null, displayName: 'Test User',
  };
  let account: StoredAccount = {
    accountId: user.id,
    provider: 'discord',
    providerUserId: user.id,
    profile: user,
    favoriteBlueprintIds: [],
    inventoryBlueprintIds: [],
    inventoryResources: [],
    planner: { goals: [], todoItems: [], resourceRequirements: {}, resourceProgress: {} },
    organizationBlueprintShares: {},
    organizationResourceShares: {},
    sharedBlueprintIds: [],
    sharedResourceEntryIds: [],
    organizations: [],
    incomingCraftRequests: [],
    outgoingCraftRequests: [],
    rsi: {
      handle: 'LegacyCitizen', displayName: 'Legacy Citizen', profileUrl: null,
      verifiedAt: '2026-01-01T00:00:00.000Z', verificationProvider: 'rsi-profile',
      verificationRequired: true,
    },
    isAdmin: false,
    lastRsiLinkAt: '2026-01-01T00:00:00.000Z',
    onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    onboardingDismissedAt: null,
    createdAt: null,
    updatedAt: null,
    lastLoginAt: null,
  };
  const challengeRequests: Array<{ handle: string }> = [];
  const verificationRequests: Array<{ handle: string; code: string }> = [];
  const firstCode = `SC-${'A'.repeat(32)}`;
  const secondCode = `SC-${'B'.repeat(32)}`;

  // Overrides the shared anonymous routes while retaining deterministic game data.
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/auth/session') {
      await route.fulfill({ json: {
        enabled: true, provider: 'discord', user,
        citizenIdLoginEnabled: false, citizenIdRsiLinkEnabled: false,
      } });
    } else if (pathname === '/api/auth/account') {
      await route.fulfill({ json: { account } });
    } else if (pathname === '/api/auth/account/rsi-link/challenge') {
      expect(request.method()).toBe('POST');
      const payload = request.postDataJSON() as { handle: string };
      challengeRequests.push(payload);
      await route.fulfill({ json: { challenge: {
        handle: payload.handle,
        code: challengeRequests.length === 1 ? firstCode : secondCode,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      } } });
    } else if (pathname === '/api/auth/account/rsi-link') {
      expect(request.method()).toBe('POST');
      const payload = request.postDataJSON() as { handle: string; code: string };
      verificationRequests.push(payload);
      account = { ...account, rsi: {
        ...account.rsi!, handle: payload.handle,
        verificationRequired: false, verifiedAt: new Date().toISOString(),
      } };
      await route.fulfill({ json: { account } });
    } else {
      await route.fallback();
    }
  });

  await page.goto('/account');
  const revalidationNotice = page.getByText('Please verify your RSI account again to restore access to organization sharing. Your saved inventory is preserved.');
  await expect(revalidationNotice).toBeVisible();
  await expect(page.getByText('LegacyCitizen · verification required')).toBeVisible();
  await page.getByRole('button', { name: 'Verify RSI account', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Manual RSI verification/ });
  await expect(dialog).toBeVisible();
  const handleInput = dialog.getByRole('textbox', { name: 'RSI handle', exact: true });
  await expect(handleInput).toHaveValue('LegacyCitizen');
  expect(challengeRequests).toEqual([]);
  expect(verificationRequests).toEqual([]);

  await dialog.getByRole('button', { name: 'Get verification code', exact: true }).click();
  await expect(dialog.getByText(firstCode, { exact: true })).toBeVisible();
  expect(challengeRequests).toEqual([{ handle: 'LegacyCitizen' }]);
  expect(verificationRequests).toEqual([]);
  await dialog.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(dialog.getByText('Verification code copied.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(firstCode);

  await handleInput.fill('OtherCitizen');
  await expect(dialog.getByText(firstCode, { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Verify and link', exact: true })).toHaveCount(0);
  expect(verificationRequests).toEqual([]);
  await dialog.getByRole('button', { name: 'Get verification code', exact: true }).click();
  await expect(dialog.getByText(secondCode, { exact: true })).toBeVisible();
  expect(challengeRequests).toEqual([{ handle: 'LegacyCitizen' }, { handle: 'OtherCitizen' }]);
  await dialog.getByRole('button', { name: 'Verify and link', exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(revalidationNotice).toHaveCount(0);
  await expect(page.getByText('OtherCitizen · verified', { exact: true })).toBeVisible();
  expect(verificationRequests).toEqual([{ handle: 'OtherCitizen', code: secondCode }]);
  expect(errors).toEqual([]);
});
