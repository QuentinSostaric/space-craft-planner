import { expect, test } from '@playwright/test';

const blueprint = {
  id: 'workspace-rifle',
  name: 'CQ7 Rifle',
  manufacturer: 'Behring',
  category: 'fps-weapon',
  craftTimeSecs: 180,
  baseStats: { damage: 18 },
  detailsLoaded: true,
  dismantle: { dismantleTimeSecs: 15, efficiency: 0.5, deterministic: true, returns: [] },
  slots: [
    {
      id: 'frame',
      label: { en: 'Frame', fr: 'Structure' },
      requirementType: 'resource',
      requirementName: 'Iron',
      requiredResource: 'iron',
      requiredItem: null,
      requiredItemClass: null,
      minQuality: 0,
      quantityScu: 0.1,
      quantityValue: 0.1,
      quantityUnit: 'scu',
      quantityMultiplier: null,
      modifiers: [],
    },
  ],
};
const dataset = {
  channel: 'live',
  datasetId: 'workspace-test',
  label: 'Workspace test',
  version: '4.10.0',
  published: true,
  blueprints: [{ ...blueprint, id: 'vendetta', name: 'Vendetta HMG' }, blueprint],
  resources: [],
  blueprintCount: 2,
  resourceCount: 0,
  hasDismantling: false,
  hasMissionRewards: false,
  hasResourceData: false,
  hasShipComponents: false,
  hasChangelog: false,
  missionRewards: null,
  materialSources: null,
  dismantling: null,
  resourceInsights: null,
  shipComponents: null,
  changelog: null,
};

test.beforeEach(async ({ page, colorScheme }) => {
  await page.addInitScript((theme) => {
    localStorage.setItem('sc-craft-theme', JSON.stringify(theme));
    localStorage.setItem('sc-craft-lang', JSON.stringify('en'));
    localStorage.setItem('sc-craft-cookie-consent', JSON.stringify(false));
  }, colorScheme);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/game-data/public')
      return route.fulfill({ json: { datasets: [dataset], defaultChannel: 'live' } });
    if (path.startsWith('/api/game-data/public/')) return route.fulfill({ json: { dataset } });
    if (path === '/api/auth/session')
      return route.fulfill({ status: 401, json: { error: 'Not authenticated' } });
    if (path === '/api/auth/feature-flags') return route.fulfill({ json: {} });
    return route.abort();
  });
});

test('Fabricator opens a blueprint workspace and preserves craft navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('same key')) errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  await page.goto('/item/cq7-rifle');
  await expect(page).toHaveURL(/\/item\/cq7-rifle$/);
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('item-workspace.png');
  await page.getByRole('button', { name: 'MAX', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Quality value for Iron', exact: true }),
  ).toHaveValue('1000');
  if (page.viewportSize()!.width < 1400 || page.viewportSize()!.height < 850) {
    await page.getByRole('link', { name: '01 / Configure' }).click();
  }
  await expect(page.locator('#craft-configure')).toBeInViewport();
  const slotPositions = await page
    .getByRole('listitem', { name: 'Iron — Frame' })
    .evaluate((row) => {
      const children = [...row.children];
      return children.map((child) => getComputedStyle(child).gridRowStart);
    });
  if ((page.viewportSize()?.width ?? 0) < 900) expect(slotPositions).toContain('2');
  await page.getByRole('button', { name: '← Blueprints', exact: true }).click();
  await expect(page).toHaveURL(/\/blueprints$/);
  await expect(page.getByRole('heading', { name: 'Blueprints', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the workspace stays compact and the shell fits the viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect(page.getByRole('button', { name: /^(Comfort|Dense)$/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  const bounds = await page.locator('header').first().boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  if ((page.viewportSize()?.width ?? 0) < 900) {
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeInViewport();
  }
  await page.locator('body').press('Control+k');
  await expect(page.getByRole('combobox', { name: 'Global search', exact: true })).toBeFocused();
});

test('search preserves input on blur and navigates only on explicit selection', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Global search', exact: true });
  await search.fill('cq7 rifle');
  await expect(page.getByRole('listbox', { name: 'Search results' }).getByRole('option')).toHaveCount(1);
  await search.press('Tab');
  await expect(page).toHaveURL(/\/$/);
  await expect(search).toHaveValue('cq7 rifle');
  await search.focus();
  await search.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await search.fill('nonexistent');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await search.fill('rifle cq7');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/item\/cq7-rifle$/);
  await expect(search).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
});

test('reduced motion disables workspace entrances', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  const duration = await page
    .locator('.workspace-page')
    .first()
    .evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
});


test('the dashboard without acquisition routes keeps all six panels in a 1080p viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  const consent = page.getByRole('button', { name: 'Essential only', exact: true });
  if (await consent.isVisible()) await consent.click();
  for (const id of ['craft-configure', 'craft-result', 'craft-acquire', 'craft-materials', 'craft-dismantle', 'craft-data']) {
    const panel = page.locator(`#${id}`);
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1080);
    expect(await panel.evaluate(element => element.tagName)).not.toBe('DETAILS');
  }
  await page.goto('/item/vendetta-hmg');
  await expect(page.getByRole('heading', { name: 'Vendetta HMG', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
});


test('populated reputation routes show complete rank cards and usable mission lists', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const standings = [
    { displayName: 'Prospective Associate', minReputation: 0 },
    { displayName: 'Associate', minReputation: 2400 },
    { displayName: 'Trusted Associate', minReputation: 6000 },
  ];
  const scope = { guid: 'recco-standing', scopeName: 'Standing', displayName: 'Standing', standings };
  const requirement = (index: number) => ({ scopeGuid: scope.guid, scopeName: 'Standing', standingName: standings[index].displayName, minReputation: standings[index].minReputation });
  const contracts = standings.flatMap((_, rank) => Array.from({ length: 8 }, (_, index) => ({
    contractDebugName: `recco-rank-${rank}-mission-${index}`,
    contractorDisplayName: 'Recco Battaglia', title: { displayText: `Mining assignment ${rank + 1}.${index + 1}` },
    minimumRequiredStandings: [requirement(rank)], reputationScope: scope,
    availability: { localities: ['Nyx'] }, rewardedBlueprints: [],
  })));
  const target = {
    contractDebugName: 'recco-blackbox', title: { displayText: 'Blackbox Retrieval Very Dangerous' },
    minimumRequiredStandings: [requirement(2)], availability: { localities: ['Nyx'] }, maxChance: 1,
  };
  const missionRewards = {
    reputationScopesDetailed: [scope],
    factionGroups: [{ id: 'recco', contractorDisplayName: 'Recco Battaglia', contracts, reputationScopes: [scope] }],
    blueprintAcquisitionGraph: [{
      blueprint, contractCount: 1, factionCount: 1, localityCount: 1, standings: [requirement(2)],
      factions: [{ contractorDisplayName: 'Recco Battaglia', contracts: [target] }],
    }],
  };
  const populated = { ...dataset, hasMissionRewards: true, missionRewards };
  await page.route('**/api/game-data/public**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/game-data/public') return route.fulfill({ json: { datasets: [populated], defaultChannel: 'live' } });
    if (path.includes('/factions/')) return route.fulfill({ json: { datasetId: dataset.datasetId, factionId: 'recco', contracts } });
    if (path.endsWith('/mission-rewards')) return route.fulfill({ json: { datasetId: dataset.datasetId, missionRewards } });
    return route.fulfill({ json: { dataset: populated } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  const panel = page.locator('#craft-acquire');
  await expect(panel.getByRole('link', { name: /Mining assignment 1.1/ })).toBeVisible();
  await expect(panel.locator('.acquisition-rank-card')).toHaveCount(3);
  const dimensions = await panel.evaluate(element => {
    const body = element.querySelector('.fabricator-panel-body')!;
    return { height: element.clientHeight, bodyHeight: body.clientHeight, contentHeight: body.scrollHeight };
  });
  expect(dimensions.height).toBeGreaterThan(400);
  expect(dimensions.bodyHeight).toBeGreaterThanOrEqual(dimensions.contentHeight - 1);
  for (const list of await panel.locator('.acquisition-rank-missions').all()) {
    const bounds = await list.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(220);
    expect(bounds!.width).toBeGreaterThan(230);
    expect(bounds!.width).toBeLessThanOrEqual(268);
  }
  await expect(panel.getByRole('link', { name: /Blackbox Retrieval Very Dangerous/ })).toBeVisible();
  const reached = panel.getByRole('button', { name: 'Prospective Associate — mark as reached', exact: true });
  await reached.click();
  await expect(panel.getByRole('button', { name: 'Prospective Associate — undo reached rank' })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Prospective Associate — undo reached rank' }).click();
  const firstList = panel.locator('.acquisition-rank-missions').first();
  await firstList.getByRole('link', { name: /Mining assignment 1.8/ }).focus();
  await expect(firstList.getByRole('link', { name: /Mining assignment 1.8/ })).toBeInViewport();
  const pageScroll = page.locator('#main-content');
  await panel.getByText('Rank 1', { exact: true }).hover();
  const beforeRailWheel = await pageScroll.evaluate(element => element.scrollTop);
  await page.mouse.wheel(0, -140);
  await expect.poll(() => pageScroll.evaluate(element => element.scrollTop)).toBeLessThan(beforeRailWheel);
});

test('Fabricator panels let the page scroll instead of trapping the wheel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  const consent = page.getByRole('button', { name: 'Essential only', exact: true });
  if (await consent.isVisible()) await consent.click();
  const pageScroll = page.locator('#main-content');
  for (const id of ['craft-configure', 'craft-result', 'craft-acquire', 'craft-materials', 'craft-dismantle', 'craft-data']) {
    const body = page.locator(`#${id} > .fabricator-panel-body`);
    await body.scrollIntoViewIfNeeded();
    await body.hover();
    const before = await pageScroll.evaluate(element => element.scrollTop);
    const maximum = await pageScroll.evaluate(element => element.scrollHeight - element.clientHeight);
    const delta = before > maximum / 2 ? -120 : 120;
    await page.mouse.wheel(0, delta);
    await expect.poll(() => pageScroll.evaluate(element => element.scrollTop)).not.toBe(before);
    expect(await body.evaluate(element => getComputedStyle(element).overflowY)).toBe('visible');
  }
});
