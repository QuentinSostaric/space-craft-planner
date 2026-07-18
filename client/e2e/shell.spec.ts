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

async function installDeterministicState(page: Page, theme: 'dark' | 'light') {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('Failed to load resource')) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(({ selectedTheme }) => {
    localStorage.setItem('sc-craft-theme', JSON.stringify(selectedTheme));
    localStorage.setItem('sc-craft-lang', JSON.stringify('en'));
    localStorage.setItem('sc-craft-cookie-consent', JSON.stringify(true));
  }, { selectedTheme: theme });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/game-data/public') {
      await route.fulfill({
        json: {
          datasets: [{
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
            importedAt: emptyDataset.importedAt,
            updatedAt: emptyDataset.updatedAt,
          }],
          defaultChannel: 'live',
        },
      });
      return;
    }

    if (path === '/api/game-data/public/e2e-live' || path === '/api/game-data/public/by-id/e2e-live') {
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

test('renders the deterministic application shell', async ({ page, colorScheme }) => {
  const errors = await installDeterministicState(page, colorScheme === 'light' ? 'light' : 'dark');

  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('nav').first()).toBeVisible();

  // Baselines are committed per developer platform, and hosted runners render
  // fonts differently enough to exceed the diff tolerance. Keep the pixel
  // comparison as a local regression tool; the assertions above still guard the
  // shell on CI.
  if (!process.env.CI) {
    await expect(page).toHaveScreenshot('application-shell.png', { fullPage: true });
  }

  expect(errors).toEqual([]);
});
