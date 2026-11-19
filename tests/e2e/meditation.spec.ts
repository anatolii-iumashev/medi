import { expect, test, type Page } from '@playwright/test';

type MenuName = 'settings' | 'sound';

const playerButton = (page: Page) => page.locator('[data-player-toggle]');
const practiceRadio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(name) });
const durationGroup = (page: Page) => page.getByRole('group', { name: 'Длительность практики' });
const durationRadio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const audio = (page: Page) => page.locator('audio');
const dock = (page: Page) => page.getByRole('group', { name: 'Управление практикой' });
const menu = (page: Page, name: MenuName) => page.locator(`details[data-player-dropdown="${name}"]`);
const summary = (page: Page, name: MenuName) => menu(page, name).locator('summary');
const panel = (page: Page, name: MenuName) => menu(page, name).locator('.dropdown-content');
const practiceInput = (page: Page, id: string) => page.locator(`input[name="practice"][value="${id}"]`);
const durationInput = (page: Page, value: number) => page.locator(`input[name="session-duration"][value="${value}"]`);
const currentTitle = (page: Page) => page.locator('[data-player-current-title]');

async function openMenu(page: Page, name: MenuName): Promise<void> {
  const details = menu(page, name);
  const isOpen = await details.evaluate((element: HTMLDetailsElement) => element.open);
  if (!isOpen) await summary(page, name).click();
  await expect(details).toHaveJSProperty('open', true);
}

async function closeMenu(page: Page, name: MenuName): Promise<void> {
  const isOpen = await menu(page, name).evaluate((element: HTMLDetailsElement) => element.open);
  if (isOpen) await summary(page, name).click();
  await expect(menu(page, name)).toHaveJSProperty('open', false);
}

async function choosePractice(page: Page, name: string): Promise<void> {
  await openMenu(page, 'sound');
  const radio = practiceRadio(page, name);
  if (!(await radio.isChecked())) await radio.check();
  await closeMenu(page, 'sound');
}

async function chooseDuration(page: Page, name: string): Promise<void> {
  await openMenu(page, 'settings');
  const radio = durationRadio(page, name);
  if (!(await radio.isChecked())) await radio.check();
  await closeMenu(page, 'settings');
}

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`fits ${viewport.width}×${viewport.height} and keeps all controls accessible`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');

    await expect(dock(page)).toBeVisible();
    await expect(page.getByRole('status')).toBeAttached();
    await expect(currentTitle(page)).toBeVisible();

    const button = playerButton(page);
    const buttonBox = await button.boundingBox();
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);

    for (const name of ['settings', 'sound'] as const) {
      const box = await summary(page, name).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.x).toBeGreaterThanOrEqual((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0));
    }

    const dockBox = await dock(page).boundingBox();
    expect(Math.round((dockBox?.y ?? 0) + (dockBox?.height ?? 0))).toBe(viewport.height);
    const contentBox = await currentTitle(page).boundingBox();
    expect((contentBox?.y ?? 0) + (contentBox?.height ?? 0)).toBeLessThan(dockBox?.y ?? 0);

    for (const name of ['sound', 'settings'] as const) {
      await openMenu(page, name);
      const panelBox = await panel(page, name).boundingBox();
      expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      expect(panelBox?.y ?? -1).toBeGreaterThanOrEqual(0);
      expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual((await summary(page, name).boundingBox())?.y ?? 0);
      const radios = name === 'sound'
        ? ['Треугольник дыхания', 'Шаманские барабаны', 'Мягкий белый шум'].map((practice) => practiceRadio(page, practice))
        : ['3 минуты', '5 минут', '10 минут'].map((duration) => durationRadio(page, duration));
      for (const radio of radios) {
        await expect(radio).toBeVisible();
        const labelBox = await radio.locator('..').boundingBox();
        expect(labelBox?.height).toBeGreaterThanOrEqual(44);
        expect(labelBox?.width).toBeGreaterThanOrEqual(44);
      }
      await page.keyboard.press('Escape');
      await expect(menu(page, name)).toHaveJSProperty('open', false);
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

    await openMenu(page, 'settings');
    await durationRadio(page, '3 минуты').focus();
    await page.keyboard.press('ArrowRight');
    await expect(durationInput(page, 5)).toBeChecked();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveText('Стоп');
  });
}

test('selects practices and durations from the dock dropdowns', async ({ page }) => {
  await page.goto('./');
  await expect(summary(page, 'sound')).toHaveAttribute('aria-label', 'Звук: Треугольник дыхания');
  await openMenu(page, 'sound');
  await expect(page.getByRole('group', { name: 'Выберите практику' })).toBeVisible();
  const drums = practiceRadio(page, 'Шаманские барабаны');
  await drums.focus();
  await page.keyboard.press('Space');
  await expect(practiceInput(page, 'shamanic-drums')).toBeChecked();
  await expect(menu(page, 'sound')).toHaveJSProperty('open', false);
  await expect(summary(page, 'sound')).toBeFocused();
  await expect(audio(page)).toHaveAttribute('src', /\/medi\/audio\/shamanic-drums-loop\.mp3$/);
  await expect(page.getByRole('status')).toContainText('Шаманские барабаны');
  await expect(currentTitle(page)).toHaveText('Шаманские барабаны');
  await expect(summary(page, 'sound')).toHaveAttribute('aria-label', 'Звук: Шаманские барабаны');
  await expect(playerButton(page)).toHaveText('Начать');

  await openMenu(page, 'settings');
  await expect(durationGroup(page)).toBeHidden();
  await expect(page.locator('[data-player-duration-empty]')).toBeVisible();
  await expect(page.locator('[data-player-duration-empty]')).toContainText('нет дополнительных настроек');
  await page.keyboard.press('Escape');
  await expect(summary(page, 'settings')).toBeFocused();

  await choosePractice(page, 'Треугольник дыхания');
  await chooseDuration(page, '5 минут');
  await expect(durationInput(page, 5)).toBeChecked();

  await choosePractice(page, 'Мягкий белый шум');
  await expect(page.locator('[data-player-current-description]')).toHaveText('Спокойный фон на час');
  await choosePractice(page, 'Треугольник дыхания');
  await openMenu(page, 'settings');
  await expect(durationGroup(page)).toBeVisible();
  await expect(durationInput(page, 5)).toBeChecked();
  await page.keyboard.press('Escape');
  await page.reload();
  await openMenu(page, 'sound');
  await expect(practiceInput(page, 'breathing-triangle')).toBeChecked();
  await page.keyboard.press('Escape');
  await openMenu(page, 'settings');
  await expect(durationRadio(page, '3 минуты')).toBeChecked();
});

test('dock dropdowns are mutually exclusive and dismiss on Escape and outside taps', async ({ page }) => {
  await page.goto('./');
  await summary(page, 'sound').focus();
  await page.keyboard.press('Enter');
  await expect(menu(page, 'sound')).toHaveJSProperty('open', true);

  await summary(page, 'settings').click();
  await expect(menu(page, 'settings')).toHaveJSProperty('open', true);
  await expect(menu(page, 'sound')).toHaveJSProperty('open', false);

  await page.keyboard.press('Escape');
  await expect(menu(page, 'settings')).toHaveJSProperty('open', false);
  await expect(summary(page, 'settings')).toBeFocused();

  await summary(page, 'sound').click();
  await expect(menu(page, 'sound')).toHaveJSProperty('open', true);
  await page.locator('h1').click();
  await expect(menu(page, 'sound')).toHaveJSProperty('open', false);

  await openMenu(page, 'sound');
  await practiceRadio(page, 'Треугольник дыхания').focus();
  await page.keyboard.press('ArrowDown');
  await expect(practiceInput(page, 'shamanic-drums')).toBeChecked();
  await expect(menu(page, 'sound')).toHaveJSProperty('open', false);
  await expect(summary(page, 'sound')).toBeFocused();
});

test('keeps the logo aura static when motion is reduced', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const aura = page.locator('.aura');
  await expect(aura).toBeVisible();
  await expect(aura.locator('img')).toHaveAttribute('alt', 'Мягкие круги на спокойном тёмном фоне');
  expect(await aura.evaluate((element) => element.hasAttribute('tabindex') || element.getAttribute('role') !== null)).toBe(false);
  const reduced = await aura.evaluate((element) => ({
    self: getComputedStyle(element).animationName,
    before: getComputedStyle(element, '::before').animationName,
    after: getComputedStyle(element, '::after').animationName,
    background: getComputedStyle(element).backgroundImage,
  }));
  expect(reduced).toMatchObject({ self: 'none', before: 'none', after: 'none' });
  expect(reduced.background).toContain('gradient');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  const animated = await aura.evaluate((element) => ({
    before: getComputedStyle(element, '::before').animationName,
    after: getComputedStyle(element, '::after').animationName,
  }));
  expect(animated).toEqual({ before: 'aura-glow', after: 'aura-glow-after' });
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
    await choosePractice(page, practice.name);
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
  await chooseDuration(page, '5 минут');
  await expect(button).toHaveText('Начать');
  expect(await audio(page).evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  expect(await audio(page).evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
  await expect(audio(page)).toHaveAttribute('src', '/medi/audio/breathing-triangle.mp3');
  await chooseDuration(page, '10 минут');
  await openMenu(page, 'settings');
  await expect(durationRadio(page, '10 минут')).toBeChecked();
  await page.keyboard.press('Escape');
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
    await chooseDuration(page, name);
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
    await chooseDuration(page, name);
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Стоп');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Начать');
  }
  for (const name of ['Шаманские барабаны', 'Мягкий белый шум']) {
    await choosePractice(page, name);
    await openMenu(page, 'settings');
    await expect(durationGroup(page)).toBeHidden();
    await expect(page.locator('[data-player-duration-empty]')).toBeVisible();
    await page.keyboard.press('Escape');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Стоп');
    await playerButton(page).click();
    await expect(playerButton(page)).toHaveText('Начать');
  }
  await choosePractice(page, 'Треугольник дыхания');
  await chooseDuration(page, '3 минуты');
  await page.waitForFunction(() => document.querySelector('audio')?.readyState === 4);
  await page.clock.install();
  await playerButton(page).click();
  await expect(playerButton(page)).toHaveText('Стоп');
  await page.clock.fastForward(181_000);
  await expect(page.getByRole('status')).toContainText('Практика завершена');
});
