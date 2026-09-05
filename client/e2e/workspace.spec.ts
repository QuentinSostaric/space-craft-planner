import { expect, test } from '@playwright/test';

const blueprint = {
  id: 'workspace-rifle',
  name: 'CQ7 Rifle',
  manufacturer: 'Behring',
  category: 'fps-weapon',
  craftTimeSecs: 180,
  baseStats: { damage: 18 },
  detailsLoaded: true,
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
  blueprints: [blueprint],
  resources: [],
  blueprintCount: 1,
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

test('register opens a craft and browser history restores the neutral landing page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your next craft starts here.' })).toBeVisible();
  await expect(page).toHaveScreenshot('workspace-register.png');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.getByText('No blueprints in this selection.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search the blueprint register' }).fill('Behring');
  await page.getByRole('button', { name: 'CQ7 Rifle Behring / FPS Weapon', exact: true }).click();
  await expect(page).toHaveURL(/\/item\/cq7-rifle$/);
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'MAX', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Quality value for Iron', exact: true }),
  ).toHaveValue('1000');
  await page.getByRole('link', { name: '01 / Configure' }).click();
  await expect(page.locator('#craft-configure')).toBeInViewport();
  const slotPositions = await page
    .getByRole('listitem', { name: 'Iron — Frame' })
    .evaluate((row) => {
      const children = [...row.children];
      return children.map((child) => getComputedStyle(child).gridRowStart);
    });
  if ((page.viewportSize()?.width ?? 0) < 900) expect(slotPositions).toContain('2');
  await page.getByRole('button', { name: '← Blueprint register', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: 'Blueprint register', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'CQ7 Rifle', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('density persists and the shell fits the viewport', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Blueprint register', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Comfort', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Comfort', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  const bounds = await page.locator('header').first().boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  if ((page.viewportSize()?.width ?? 0) < 900) {
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeInViewport();
  }
  await page.locator('body').press('Control+k');
  await expect(page.getByRole('combobox', { name: 'Global search', exact: true })).toBeFocused();
});
