import { expect, test, type Page } from '@playwright/test';

const playerButton = (page: Page) => page.locator('[data-player-toggle]');
const practiceRadio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(name) });
const practiceLabel = (page: Page, name: string) => page.locator('label').filter({ hasText: name });
const durationGroup = (page: Page) => page.getByRole('group', { name: 'Длительность практики' });
const durationRadio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const audio = (page: Page) => page.locator('audio');

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`fits ${viewport.width}×${viewport.height} and keeps all controls accessible`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const button = playerButton(page);
    await expect(button).toBeVisible();
    await expect(page.getByRole('status')).toBeAttached();
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    for (const name of ['Треугольник дыхания', 'Шаманские барабаны', 'Мягкий белый шум']) {
      const radio = practiceRadio(page, name);
      await expect(radio).toBeVisible();
      const labelBox = await practiceLabel(page, name).boundingBox();
      expect(labelBox?.height).toBeGreaterThanOrEqual(44);
      expect(labelBox?.width).toBeGreaterThanOrEqual(44);
    }
    await expect(durationGroup(page)).toBeVisible();
    for (const name of ['3 минуты', '5 минут', '10 минут']) {
      const radio = durationRadio(page, name);
      await expect(radio).toBeVisible();
      const labelBox = await radio.locator('..').boundingBox();
      expect(labelBox?.height).toBeGreaterThanOrEqual(44);
      expect(labelBox?.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await durationRadio(page, '3 минуты').focus();
    await page.keyboard.press('ArrowRight');
    await expect(durationRadio(page, '5 минут')).toBeChecked();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveText('Стоп');
  });
}

test('selects practices with the keyboard and shows duration only for breathing', async ({ page }) => {
  await page.goto('./');
  const group = page.getByRole('group', { name: 'Выберите практику' });
  await expect(group).toBeVisible();
  await expect(durationRadio(page, '3 минуты')).toBeChecked();
  await durationRadio(page, '5 минут').check();
  const drums = practiceRadio(page, 'Шаманские барабаны');
  await drums.focus();
  await page.keyboard.press('Space');
  await expect(drums).toBeChecked();
  await expect(durationGroup(page)).toBeHidden();
  await expect(audio(page)).toHaveAttribute('src', /\/medi\/audio\/shamanic-drums-loop\.mp3$/);
  await expect(playerButton(page)).toHaveText('Начать');
  await practiceRadio(page, 'Треугольник дыхания').check();
  await expect(durationGroup(page)).toBeVisible();
  await expect(durationRadio(page, '5 минут')).toBeChecked();
  await page.reload();
  await expect(durationRadio(page, '3 минуты')).toBeChecked();
});

for (const practice of [
  { name: 'Треугольник дыхания', file: 'breathing-triangle.mp3', minDuration: 20.9, maxDuration: 21.1 },
  { name: 'Шаманские барабаны', file: 'shamanic-drums-loop.mp3', minDuration: 3500, maxDuration: 3700 },
  { name: 'Мягкий белый шум', file: 'soft-white-noise.mp3', minDuration: 3500, maxDuration: 3700 },
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
    await expect(audio(page)).toHaveAttribute('src', new RegExp(`/medi/audio/${practice.file}$`));
    const duration = await audio(page).evaluate((element: HTMLAudioElement) => element.duration);
    expect(duration).toBeGreaterThan(practice.minDuration);
    expect(duration).toBeLessThan(practice.maxDuration);
    const button = playerButton(page);
    await button.click();
    await expect(button).toHaveText('Стоп');
    await page.waitForFunction(() => (document.querySelector('audio')?.currentTime ?? 0) > 0.1);
    await button.click();
    await expect(button).toHaveText('Начать');
    expect(await audio(page).evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
    expect(await audio(page).evaluate((element: HTMLAudioElement) => element.loop)).toBe(true);
    await button.click();
    expect(await audio(page).evaluate((element: HTMLAudioElement) => element.currentTime)).toBeLessThan(1);
    expect(externalRequests).toEqual([]);
  });
}

test('changes duration during playback without autoplay and keeps the last selection', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  const button = playerButton(page);
  await button.click();
  await expect(button).toHaveText('Стоп');
  await page.waitForFunction(() => (document.querySelector('audio')?.currentTime ?? 0) > 0.1);
  await durationRadio(page, '5 минут').check();
  await expect(button).toHaveText('Начать');
  expect(await audio(page).evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  expect(await audio(page).evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
  await expect(audio(page)).toHaveAttribute('src', '/medi/audio/breathing-triangle.mp3');
  await durationRadio(page, '10 минут').check();
  await expect(durationRadio(page, '10 минут')).toBeChecked();
  await expect(button).toHaveText('Начать');
  expect(await audio(page).evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
});

test('completes all three session durations and restarts from the beginning', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  const button = playerButton(page);
  for (const [name, milliseconds] of [
    ['3 минуты', 180_000],
    ['5 минут', 300_000],
    ['10 минут', 600_000],
  ] as const) {
    await durationRadio(page, name).check();
    await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
    await button.click();
    await expect(button).toHaveText('Стоп');
    await page.clock.fastForward(milliseconds + 1_000);
    await expect(button).toHaveText('Начать');
    await expect(page.getByRole('status')).toContainText('Практика завершена');
    expect(await audio(page).evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
    expect(await audio(page).evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  }
  await button.click();
  await expect(button).toHaveText('Стоп');
  expect(await audio(page).evaluate((element: HTMLAudioElement) => element.currentTime)).toBeLessThan(1);
});

test('reflects an external pause', async ({ page }) => {
  await page.goto('./');
  const button = playerButton(page);
  await button.click();
  await expect(button).toHaveText('Стоп');
  await audio(page).evaluate((element: HTMLAudioElement) => element.pause());
  await expect(button).toHaveText('Начать');
  await expect(page.getByRole('status')).toContainText('Пауза');
});

test('uses base-aware manifest icons and precaches every runtime asset', async ({ page, request }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('medi — спокойные практики');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/medi/manifest.webmanifest');
  const manifestResponse = await request.get('/medi/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('medi — спокойные практики');
  expect(manifest.short_name).toBe('medi');
  expect(manifest.start_url).toBe('/medi/');
  expect(manifest.scope).toBe('/medi/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.display_override).toEqual(['minimal-ui', 'standalone', 'browser']);
  expect(manifest.description).toContain('Три спокойные практики');
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/^\/medi\/icons\//);
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  const worker = await request.get('/medi/sw.js');
  const workerText = await worker.text();
  expect(workerText.includes('audio/breathing-triangle.mp3')).toBe(true);
  expect(workerText.includes('audio/shamanic-drums-loop.mp3')).toBe(true);
  expect(workerText.includes('audio/soft-white-noise.mp3')).toBe(true);
  expect(workerText.includes('audio/meditation.mp3')).toBe(false);
  expect(workerText.includes('audio/breathing-triangle-3min.mp3')).toBe(false);
  expect(workerText.includes('audio/breathing-triangle-5min.mp3')).toBe(false);
  expect(workerText.includes('audio/breathing-triangle-10min.mp3')).toBe(false);
  expect(workerText.includes('.wav')).toBe(false);
  expect(/audio\/[^`]*\.webm/.test(workerText)).toBe(false);
  expect(await audio(page).getAttribute('src')).toBe('/medi/audio/breathing-triangle.mp3');
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
    'audio/breathing-triangle.mp3',
    'audio/shamanic-drums-loop.mp3',
    'audio/soft-white-noise.mp3',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'manifest.webmanifest',
  ]) {
    expect(cachedUrls.some((url) => new URL(url).pathname.endsWith(suffix))).toBe(true);
  }
  expect(cachedUrls.some((url) => url.includes('/medi/_astro/') && url.endsWith('.css'))).toBe(true);
});

test('restarts and plays every practice and duration in airplane mode', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'medi' })).toBeVisible();
  for (const name of ['3 минуты', '5 минут', '10 минут']) {
    await durationRadio(page, name).check();
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Стоп');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Начать');
  }
  for (const name of ['Шаманские барабаны', 'Мягкий белый шум']) {
    await practiceRadio(page, name).check();
    await expect(durationGroup(page)).toBeHidden();
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Стоп');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Начать');
  }
  await practiceRadio(page, 'Треугольник дыхания').check();
  await durationRadio(page, '3 минуты').check();
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  await page.clock.install();
  await playerButton(page).click();
  await expect(playerButton(page)).toHaveText('Стоп');
  await page.clock.fastForward(181_000);
  await expect(page.getByRole('status')).toContainText('Практика завершена');
});
