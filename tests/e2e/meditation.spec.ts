import { expect, test, type Page } from '@playwright/test';

const playerButton = (page: Page) => page.locator('[data-player-toggle]');
const practiceRadio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(name) });
const practiceLabel = (page: Page, name: string) => page.locator('label').filter({ hasText: name });

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
    for (const name of ['Тихое дыхание', 'Шаманские барабаны']) {
      const radio = practiceRadio(page, name);
      await expect(radio).toBeVisible();
      const labelBox = await practiceLabel(page, name).boundingBox();
      expect(labelBox?.height).toBeGreaterThanOrEqual(44);
      expect(labelBox?.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveText('Стоп');
  });
}

test('selects a practice with the keyboard and exposes one named group', async ({ page }) => {
  await page.goto('./');
  const group = page.getByRole('group', { name: 'Выберите практику' });
  await expect(group).toBeVisible();
  const drums = practiceRadio(page, 'Шаманские барабаны');
  await expect(drums).not.toBeChecked();
  await drums.focus();
  await page.keyboard.press('Space');
  await expect(drums).toBeChecked();
  await expect(page.locator('audio')).toHaveAttribute('src', /\/medi\/audio\/shamanic-drums-loop\.mp3$/);
  await expect(playerButton(page)).toHaveText('Начать');
});

for (const practice of [
  { name: 'Тихое дыхание', file: 'meditation.mp3' },
  { name: 'Шаманские барабаны', file: 'shamanic-drums-loop.mp3' },
]) {
  test(`plays and stops «${practice.name}» from the local loop`, async ({ page }) => {
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(url.href);
    });
    await page.goto('./');
    await practiceRadio(page, practice.name).check();
    await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
    await expect(page.locator('audio')).toHaveAttribute('src', new RegExp(`/medi/audio/${practice.file}$`));
    const duration = await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.duration);
    expect(duration).toBeGreaterThan(3500);
    expect(duration).toBeLessThan(3700);
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
}

test('switches practice during playback without autoplay', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  const button = playerButton(page);
  await button.click();
  await expect(button).toHaveText('Стоп');
  await page.waitForFunction(() => (document.querySelector('audio')?.currentTime ?? 0) > 0.1);
  await practiceRadio(page, 'Шаманские барабаны').check();
  await expect(button).toHaveText('Начать');
  await expect(page.getByRole('status')).toContainText('Шаманские барабаны');
  const audio = page.locator('audio');
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await button.click();
  await expect(button).toHaveText('Стоп');
  await expect(page.getByRole('status')).toContainText('Шаманские барабаны');
  await practiceRadio(page, 'Тихое дыхание').check();
  await expect(button).toHaveText('Начать');
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
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
  expect(manifest.description).not.toMatch(/одн/i);
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/^\/medi\/icons\//);
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  const worker = await request.get('/medi/sw.js');
  const workerText = await worker.text();
  expect(workerText.includes('audio/meditation.mp3')).toBe(true);
  expect(workerText.includes('audio/shamanic-drums-loop.mp3')).toBe(true);
  expect(workerText.includes('audio/shamanic-drums-loop.wav')).toBe(false);
  expect(workerText.includes('audio/shamanic-drums-loop.opus')).toBe(false);
  expect(await page.locator('audio').getAttribute('src')).toBe('/medi/audio/meditation.mp3');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cachedUrls = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const entries = await Promise.all(cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      return (await cache.keys()).map((entry) => entry.url);
    }));
    return entries.flat();
  });
  for (const suffix of [
    '/medi/',
    'audio/meditation.mp3',
    'audio/shamanic-drums-loop.mp3',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'manifest.webmanifest',
  ]) {
    expect(cachedUrls.some((url) => new URL(url).pathname.endsWith(suffix))).toBe(true);
  }
  expect(cachedUrls.some((url) => url.includes('/medi/_astro/') && url.endsWith('.css'))).toBe(true);
});

test('restarts and plays both practices in airplane mode after the first online visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Medi' })).toBeVisible();
  for (const name of ['Тихое дыхание', 'Шаманские барабаны']) {
    await practiceRadio(page, name).check();
    await expect(playerButton(page)).toHaveText('Начать');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Стоп');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Начать');
  }
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
