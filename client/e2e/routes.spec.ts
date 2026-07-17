import { expect, test, type Page } from '@playwright/test';

const emptyDataset = {
  channel: 'live',
  datasetId: 'e2e-live',
  label: 'E2E LIVE',
  version: '0.0.0-e2e',
  branch: null,
  buildNumber: null,
  buildDateStamp: null,
  buildTimeStamp: null,
  published: true,
  blueprintCount: 0,
  resourceCount: 0,
  hasDismantling: false,
  hasMissionRewards: false,
  hasResourceData: false,
  hasShipComponents: false,
  hasChangelog: false,
  blueprints: [],
  resources: [],
  resourceInsights: null,
  changelog: null,
  dismantling: null,
  materialSources: null,
  missionRewards: null,
  shipComponents: null,
  importedAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
};

async function installDeterministicState(page: Page) {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('Failed to load resource')) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('sc-craft-theme', JSON.stringify('dark'));
    localStorage.setItem('sc-craft-lang', JSON.stringify('en'));
    localStorage.setItem('sc-craft-cookie-consent', JSON.stringify(true));
  });

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/game-data/public') {
      await route.fulfill({
        json: {
          datasets: [{
            channel: 'live', datasetId: 'e2e-live', label: 'E2E LIVE', version: '0.0.0-e2e',
            branch: null, buildNumber: null, buildDateStamp: null, buildTimeStamp: null,
            published: true, blueprintCount: 0, resourceCount: 0,
            importedAt: emptyDataset.importedAt, updatedAt: emptyDataset.updatedAt,
          }],
          defaultChannel: 'live',
        },
      });
      return;
    }
    if (path.startsWith('/api/game-data/public/')) {
      await route.fulfill({ json: { dataset: emptyDataset } });
      return;
    }
    if (path === '/api/auth/session') {
      await route.fulfill({ status: 401, json: { error: 'Not authenticated' } });
      return;
    }
    if (path === '/api/auth/feature-flags') {
      await route.fulfill({ json: {} });
      return;
    }
    await route.abort('blockedbyclient');
  });

  return consoleErrors;
}

const routes = ['/', '/blueprints', '/missions', '/resources', '/planner', '/changelog', '/account', '/privacy'];

for (const route of routes) {
  test(`route ${route} renders without runtime errors`, async ({ page }) => {
    const errors = await installDeterministicState(page);
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    // Give lazy chunks a moment to hydrate.
    await page.waitForTimeout(300);
    expect(errors, `Console/page errors on ${route}:\n${errors.join('\n')}`).toEqual([]);
  });
}
