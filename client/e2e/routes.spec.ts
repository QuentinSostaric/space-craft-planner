import { expect, test } from '@playwright/test';
import { installDeterministicState } from './fixtures';

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
