import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { initialResourceEntries, installAccountState } from './account-fixtures';

async function chooseOption(page: Page, control: Locator, option: string) {
  await control.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const inventoryPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Inventory', exact: true });

async function capturePanel(panel: Locator, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`account-${name}-panel.png`);
  // The shell scrolls inside a fixed-height main element. Expand only those
  // containers during whole-panel capture; the viewport screenshots retain
  // the application's real scrolling and fixed navigation behavior.
  const expandedScrollStyle = await panel.page().addStyleTag({ content: `
    html, body, #root { height: auto !important; overflow: visible !important; }
    div:has(> #main-content) { height: auto !important; overflow: visible !important; }
    #main-content { overflow: visible !important; }
    .if-skip-link { visibility: hidden !important; }
  ` });
  try {
    await panel.evaluate(element => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) parent.scrollTop = 0;
    });
    await panel.screenshot({ path, animations: 'disabled', scale: 'css' });
  } finally {
    await expandedScrollStyle.evaluate(element => element.remove());
  }
  await testInfo.attach(`Account ${name} panel`, { path, contentType: 'image/png' });
}

test('Account sections support direct links, keyboard focus, browser history and reload', async ({ page, colorScheme }, testInfo) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=inventory');
  const inventoryTab = page.getByRole('tab', { name: 'Inventory', exact: true });
  await expect(inventoryTab).toHaveAttribute('aria-selected', 'true');
  await expect(inventoryPanel(page).getByRole('searchbox', { name: 'Search inventory', exact: true })).toBeVisible();

  await inventoryTab.focus();
  await inventoryTab.press('ArrowRight');
  const requestsTab = page.getByRole('tab', { name: /^Craft requests/ });
  await expect(requestsTab).toBeFocused();
  await expect(requestsTab).toHaveAttribute('aria-selected', 'true');
  await requestsTab.press('End');
  const settingsTab = page.getByRole('tab', { name: 'Settings', exact: true });
  await expect(settingsTab).toBeFocused();
  await expect(page).toHaveURL(/section=settings/);
  await page.reload();
  await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
  await inventoryTab.click();
  await expect(page).toHaveURL(/section=inventory/);
  await page.goBack();
  await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
  await page.goForward();
  await expect(inventoryTab).toHaveAttribute('aria-selected', 'true');
  await expect(inventoryPanel(page)).toBeVisible();

  const screenshotPath = testInfo.outputPath('account-inventory.png');
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Account inventory', { path: screenshotPath, contentType: 'image/png' });
  await capturePanel(inventoryPanel(page), testInfo, 'inventory-cards');
  await inventoryPanel(page).getByRole('group', { name: 'Inventory view', exact: true }).getByRole('button', { name: 'List', exact: true }).click();
  await expect(inventoryPanel(page).getByRole('listitem')).toHaveCount(4);
  await capturePanel(inventoryPanel(page), testInfo, 'inventory-list');
  await inventoryPanel(page).getByRole('group', { name: 'Inventory view', exact: true }).getByRole('button', { name: 'Cards', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await inventoryTab.focus();
  await inventoryTab.press('Home');
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused();
  const overviewPath = testInfo.outputPath('account-overview.png');
  await page.screenshot({ path: overviewPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Account overview', { path: overviewPath, contentType: 'image/png' });
  await page.goto('/account?section=orgs');
  await expect(page.getByRole('tab', { name: 'Organizations', exact: true })).toHaveAttribute('aria-selected', 'true');
  const organizationsPath = testInfo.outputPath('account-organizations.png');
  await page.screenshot({ path: organizationsPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Account organizations', { path: organizationsPath, contentType: 'image/png' });
  await capturePanel(page.getByRole('tabpanel', { name: 'Organizations', exact: true }), testInfo, 'organizations');
  await settingsTab.click();
  const settingsPath = testInfo.outputPath('account-settings.png');
  await page.screenshot({ path: settingsPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Account settings', { path: settingsPath, contentType: 'image/png' });
  await capturePanel(page.getByRole('tabpanel', { name: 'Settings', exact: true }), testInfo, 'settings');
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApiCalls).toEqual([]);
});

test('Inventory separates an empty search from an empty collection and resets filters', async ({ page, colorScheme }) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=inventory');
  const panel = inventoryPanel(page);
  const search = panel.getByRole('searchbox', { name: 'Search inventory', exact: true });
  await search.fill('nothing-matches-this-stock');
  await expect(panel.getByText(/No results|No matching/)).toBeVisible();
  await panel.getByRole('button', { name: /Reset filters|Clear filters/ }).first().click();
  await expect(search).toHaveValue('');
  await expect(panel.getByText('Iron', { exact: true }).first()).toBeVisible();

  const typeFilter = panel.getByRole('button', { name: /^(Asset type|Type|Filter)$/ }).first();
  await chooseOption(page, typeFilter, 'Resources');
  await expect(panel.getByText('Copper', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('Account Rifle', { exact: true })).toHaveCount(0);
  await chooseOption(page, panel.getByRole('button', { name: /^Sharing$/ }), 'Shared');
  await expect(panel.getByText('Iron', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('Copper', { exact: true })).toHaveCount(0);
  await chooseOption(page, panel.getByRole('button', { name: /^Sharing$/ }), 'Private');
  await expect(panel.getByText('Copper', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('Iron', { exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('Adding an existing favorite to owned blueprints preserves the collection and resource shares', async ({ page, colorScheme }) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=inventory');
  const panel = inventoryPanel(page);
  await panel.getByRole('button', { name: 'Add blueprints', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add blueprints', exact: true });
  const rifle = dialog.getByRole('checkbox', { name: /^Account Rifle/ });
  await expect(rifle).toBeChecked();
  await expect(rifle).toBeDisabled();
  await dialog.getByRole('searchbox', { name: 'Search blueprints', exact: true }).fill('Pistol');
  await dialog.getByRole('checkbox', { name: /^Account Pistol/ }).check();
  await dialog.getByRole('button', { name: /^Add selected/ }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.getAccount().inventoryBlueprintIds).toEqual(['account-rifle', 'account-pistol']);
  expect(state.getAccount().favoriteBlueprintIds).toEqual(['account-pistol']);
  expect(state.getAccount().inventoryResources).toEqual(initialResourceEntries);
  expect(state.getAccount().organizationBlueprintShares).toEqual({ TESTORG: ['account-rifle'] });
  expect(state.getAccount().organizationResourceShares).toEqual({ TESTORG: ['iron-lot'] });
  await page.reload();
  await panel.getByRole('button', { name: 'Add blueprints', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: /^Account Pistol/ })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /^Account Pistol/ })).toBeDisabled();
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApiCalls).toEqual([]);
});

test('Settings export both account scopes and apply local language and appearance preferences', async ({ page, colorScheme }, testInfo) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=settings');
  const panel = page.locator('#account-tabpanel-settings');
  const downloadPromise = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download my personal data', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^sc-craft-personal-data-\d{4}-\d{2}-\d{2}\.json$/);
  const downloadPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(downloadPath);
  const exported = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(exported).toMatchObject({ format: 'sc-craft-personal-data', version: 1 });
  expect(exported.accounts.live.datasetScope).toBe('live');
  expect(exported.accounts.ptu.datasetScope).toBe('ptu');
  expect(exported.accounts.live.inventoryBlueprintIds).toEqual(['account-rifle']);
  expect(exported.accounts.live.favoriteBlueprintIds).toEqual(['account-pistol']);
  expect(exported.accounts.live.inventoryResources).toEqual(initialResourceEntries);
  expect(exported.accounts.live.organizationResourceShares).toEqual({ TESTORG: ['iron-lot'] });
  expect(exported.accounts.live.incomingCraftRequests[0].id).toBe('incoming-request');

  const nextTheme = colorScheme === 'light' ? 'dark' : 'light';
  await chooseOption(page, panel.getByRole('button', { name: 'Appearance', exact: true }), nextTheme === 'dark' ? 'Dark' : 'Light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sc-craft-theme')!))).toBe(nextTheme);
  await chooseOption(page, panel.getByRole('button', { name: 'Language', exact: true }), 'Français');
  await expect(panel.getByRole('heading', { name: 'Paramètres', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Télécharger mes données personnelles', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sc-craft-lang')!))).toBe('fr');
  expect(state.mutations).toEqual([]);
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApiCalls).toEqual([]);
});

test('Resource quantity validation prevents invalid writes and keeps the draft open', async ({ page, colorScheme }) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=inventory');
  await inventoryPanel(page).getByRole('button', { name: 'Add resources', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Add resources/ });
  const quantity = dialog.getByRole('spinbutton', { name: /Quantity/ }).first();
  const save = dialog.getByRole('button', { name: /Save|Add to inventory|Add (?:resource )?entries/ }).last();
  for (const invalidValue of ['', '-2', '0']) {
    await quantity.fill(invalidValue);
    await save.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/quantity.*(positive|greater|valid)|Enter.*quantity|Quantity is required/i).first()).toBeVisible();
    expect(state.resourceWrites).toEqual([]);
  }
  await quantity.fill('1.125');
  await save.click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.resourceWrites.length).toBe(1);
  expect(state.getAccount().inventoryResources).toHaveLength(3);
  expect(state.resourceWrites[0].at(-1)?.quantity).toBe(1.125);
  expect(state.errors).toEqual([]);
});

test('Editing a resource preserves its identifier, creation date and organization shares', async ({ page, colorScheme }) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=inventory');
  const panel = inventoryPanel(page);
  await panel.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Iron');
  await panel.getByRole('button', { name: /^Edit(?: Iron| resource| lot)?$/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /Edit/ });
  await dialog.getByRole('spinbutton', { name: /Quantity/ }).fill('8.75');
  await dialog.getByRole('spinbutton', { name: /Quality/ }).fill('850');
  await dialog.getByRole('button', { name: /Save/ }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.resourceWrites.length).toBe(1);
  expect(state.getAccount().inventoryResources).toHaveLength(2);
  expect(state.getAccount().inventoryResources.find(entry => entry.id === 'iron-lot')).toMatchObject({
    id: 'iron-lot', resourceId: 'iron', quantity: 8.75, quality: 850, createdAt: initialResourceEntries[0].createdAt,
  });
  expect(state.getAccount().organizationResourceShares).toEqual({ TESTORG: ['iron-lot'] });
  expect(state.getAccount().sharedResourceEntryIds).toEqual(['iron-lot']);
  await page.reload();
  await expect(inventoryPanel(page).getByText(/8[.,]75/).first()).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('Removing a resource requires confirmation and cancellation preserves the lot', async ({ page, colorScheme }) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=inventory');
  const panel = inventoryPanel(page);
  await panel.getByRole('searchbox', { name: 'Search inventory', exact: true }).fill('Iron');
  const remove = panel.getByRole('button', { name: /^(Remove|Remove this resource entry|Remove Iron)$/ });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: /Remove/ });
  await expect(dialog).toBeVisible();
  expect(state.resourceWrites).toEqual([]);
  await dialog.getByRole('button', { name: /Cancel|Keep/ }).click();
  await expect(dialog).toBeHidden();
  expect(state.resourceWrites).toEqual([]);
  await remove.click();
  await dialog.getByRole('button', { name: /Remove/ }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.resourceWrites.length).toBe(1);
  expect(state.getAccount().inventoryResources.map(entry => entry.id)).toEqual(['copper-lot']);
  expect(state.getAccount().sharedResourceEntryIds).not.toContain('iron-lot');
  expect(state.errors).toEqual([]);
});

test('Craft requests combine direction, search and status filters and preserve an accepted decision', async ({ page, colorScheme }, testInfo) => {
  const state = await installAccountState(page, { colorScheme });
  await page.goto('/account?section=requests');
  const panel = page.getByRole('tabpanel', { name: /^Craft requests/ });
  const incoming = panel.getByRole('article', { name: 'Account Rifle', exact: true });
  const outgoing = panel.getByRole('article', { name: 'Account Pistol', exact: true });
  await expect(incoming).toBeVisible();
  await expect(outgoing).toBeVisible();
  await panel.getByRole('group', { name: 'Request direction', exact: true }).getByRole('button', { name: /^Received/ }).click();
  await expect(incoming).toBeVisible();
  await expect(outgoing).toHaveCount(0);
  const search = panel.getByRole('searchbox', { name: 'Search requests', exact: true });
  await search.fill('missing-blueprint');
  await expect(incoming).toHaveCount(0);
  await panel.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
  await expect(search).toHaveValue('');
  await expect(incoming).toBeVisible();
  await expect(outgoing).toBeVisible();
  await chooseOption(page, panel.getByRole('button', { name: 'Status', exact: true }), 'Pending');
  await expect(incoming).toBeVisible();
  await expect(outgoing).toHaveCount(0);
  await incoming.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(() => state.getAccount().incomingCraftRequests[0].status).toBe('accepted');
  await expect(incoming).toHaveCount(0);
  await chooseOption(page, panel.getByRole('button', { name: 'Status', exact: true }), 'Accepted');
  await expect(incoming).toBeVisible();
  await expect(incoming.getByRole('button', { name: 'Close request', exact: true })).toBeVisible();
  await page.reload();
  await expect(incoming).toBeVisible();
  await expect(outgoing).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Status', exact: true }).locator('..')).toContainText('Accepted');
  const screenshotPath = testInfo.outputPath('account-requests.png');
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Account craft requests', { path: screenshotPath, contentType: 'image/png' });
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApiCalls).toEqual([]);
});

test('A guest sees the unavailable sign-in state without account controls', async ({ page, colorScheme }, testInfo) => {
  const state = await installAccountState(page, { colorScheme, guest: true, enabled: false });
  await page.goto('/account');
  await expect(page.getByRole('button', { name: 'Sign in with Citizen iD', exact: true })).toBeDisabled();
  await expect(page.getByText(/Sign-in is temporarily unavailable/)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Inventory', exact: true })).toHaveCount(0);
  expect(state.mutations).toEqual([]);
  const screenshotPath = testInfo.outputPath('account-guest.png');
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Account guest', { path: screenshotPath, contentType: 'image/png' });
  expect(state.errors).toEqual([]);
});

test('Every owned blueprint has the same visible actions and starter blueprints can be removed', async ({ page, colorScheme }) => {
  const state = await installAccountState(page, { colorScheme, starterBlueprint: true });
  await page.goto('/account?section=inventory');
  const panel = inventoryPanel(page);
  const card = panel.locator('.blueprint-card').filter({ hasText: 'Field Recon Suit Arms' });
  await expect(card).toBeVisible();
  for (const name of ['Favorite', 'Inventory', 'Simulate']) await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(card.locator('.blueprint-card-actions')).toHaveCSS('opacity', '1');
  await card.getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect.poll(() => state.getAccount().inventoryBlueprintIds.includes('bp_craft_cds_armor_light_arms_01_01_01')).toBe(false);
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
