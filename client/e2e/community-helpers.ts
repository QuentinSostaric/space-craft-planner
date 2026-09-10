import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export async function chooseCommunityOption(page: Page, control: Locator, name: string) {
  await control.click();
  await page.getByRole('option', { name, exact: true }).click();
}

export async function switchCommunityScope(page: Page, channel: 'LIVE' | 'PTU') {
  const group = page.getByRole('group', { name: 'Dataset channel', exact: true });
  if (await group.isVisible()) await group.getByRole('button', { name: channel, exact: true }).click();
  else await chooseCommunityOption(page, page.getByRole('button', { name: 'Dataset channel', exact: true }), channel);
}

export async function captureCommunityPanel(page: Page, panel: Locator, testInfo: TestInfo, name: string) {
  await expect(panel).toBeVisible();
  const viewportPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: viewportPath, animations: 'disabled', scale: 'css' });
  await testInfo.attach(name, { path: viewportPath, contentType: 'image/png' });
  const path = testInfo.outputPath(`${name}-panel.png`);
  const style = await page.addStyleTag({ content: `
    html, body, #root { height: auto !important; overflow: visible !important; }
    div:has(> #main-content) { height: auto !important; overflow: visible !important; }
    #main-content { overflow: visible !important; }
    a[href="#main-content"] { visibility: hidden !important; }
  ` });
  try {
    await panel.evaluate(element => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) parent.scrollTop = 0;
    });
    await panel.screenshot({ path, animations: 'disabled', scale: 'css' });
  } finally {
    await style.evaluate(element => element.parentNode?.removeChild(element));
  }
  await testInfo.attach(`${name} full panel`, { path, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}
