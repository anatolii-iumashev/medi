import { expect, test, type Page } from '@playwright/test';

const playerButton = (page: Page) => page.locator('[data-player-toggle]');

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`fits ${viewport.width}×${viewport.height} and keeps the action accessible`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const button = playerButton(page);
    await expect(button).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveText('Стоп');
  });
}

test('starts, stops, rewinds and restarts the local loop', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(url.href);
  });
  await page.goto('./');
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  const button = playerButton(page);
  await button.click();
  await expect(button).toHaveText('Стоп');
  await page.waitForFunction(() => (document.querySelector('audio')?.currentTime ?? 0) > 0.1);
  await button.click();
  await expect(button).toHaveText('Начать');
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBe(0);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.loop)).toBe(true);
  await button.click();
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeLessThan(1);
  expect(externalRequests).toEqual([]);
});

test('reflects an external pause', async ({ page }) => {
  await page.goto('./');
  const button = playerButton(page);
  await button.click();
  await expect(button).toHaveText('Стоп');
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.pause());
  await expect(button).toHaveText('Начать');
  await expect(page.getByRole('status')).toContainText('Пауза');
});

test('uses base-aware manifest icons and precaches every runtime asset', async ({ page, request }) => {
  await page.goto('./');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/medi/manifest.webmanifest');
  const manifestResponse = await request.get('/medi/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe('/medi/');
  expect(manifest.scope).toBe('/medi/');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/^\/medi\/icons\//);
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  const worker = await request.get('/medi/sw.js');
  expect((await worker.text()).includes('audio/meditation.mp3')).toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cachedUrls = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const entries = await Promise.all(cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      return (await cache.keys()).map((entry) => entry.url);
    }));
    return entries.flat();
  });
  for (const suffix of ['/medi/', 'audio/meditation.mp3', 'icons/icon-192.png', 'icons/icon-512.png', 'manifest.webmanifest']) {
    expect(cachedUrls.some((url) => url.endsWith(suffix))).toBe(true);
  }
  expect(cachedUrls.some((url) => url.includes('/medi/_astro/') && url.endsWith('.css'))).toBe(true);
});

test('restarts and plays in airplane mode after the first online visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Тихое дыхание' })).toBeVisible();
  await playerButton(page).click();
  await expect(playerButton(page)).toHaveText('Стоп');
  await playerButton(page).click();
  await expect(playerButton(page)).toHaveText('Начать');
});

test('shows the native install action and iOS instructions', async ({ page, browser }) => {
  await page.goto('./');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
  await expect(page.getByRole('button', { name: 'Установить приложение' })).toBeVisible();
  const iosContext = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1' });
  const iosPage = await iosContext.newPage();
  await iosPage.goto('http://127.0.0.1:4321/medi/');
  await expect(iosPage.locator('[data-install-instructions]')).toContainText('Поделиться');
  await iosContext.close();
});
