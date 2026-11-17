# AGENTS.md

## Продукт и границы

Medi — статическая русскоязычная PWA с одной медитацией и одним основным действием. Ценность продукта: после первого полного онлайн-открытия пользователь запускает и останавливает локальный зацикленный трек без сети, в том числе с домашнего экрана мобильного устройства.

Не добавлять без нового RFC аккаунты, backend, библиотеку треков, таймеры, статистику, аналитику, push, внешние аудиосервисы или сложную навигацию. Сохранять спокойный mobile-first интерфейс, доступность с клавиатуры и screen reader, live-статус, видимый focus и область основного действия не менее 44×44 CSS px. Продуктовые принципы: [PRODUCT.md](PRODUCT.md). Исходные решения и критерии: [docs/rfc/meditation-pwa.md](docs/rfc/meditation-pwa.md).

## Окружение и команды

- Node.js 24, версия в `.nvmrc`; зависимости устанавливать только через `npm ci` в CI и на чистом checkout.
- `npm run dev` — dev-сервер Astro.
- `npm run check` — обязательная диагностика Astro/TypeScript.
- `npm test` — unit-тесты Vitest; `vitest.config.ts` ограничивает набор файлами `tests/**/*.test.ts`.
- `npm run build` — production-сборка в `dist/` вместе с manifest и service worker.
- `npm run preview` — просмотр сборки.
- `npx playwright install chromium` — однократная установка браузера в новом окружении.
- `npm run test:e2e` — Playwright; команда сама пересобирает сайт с `BASE_PATH=/medi/` и поднимает тестовый static server.
- `npm run test:all` — стандартная полная проверка перед завершением изменений.
- `make build-and-deploy` — check, unit-тесты, сборка и публикация `dist/` в `gh-pages` из любой ветки; `make deploy` — только публикация готового `dist/`.

Не считать работу проверенной только импортами или компиляцией: прогонять поведение, затронутое изменением. Не коммиттить `node_modules/`, `dist/`, `.astro/`, `test-results/` и отчёты Playwright. Локально Playwright может переиспользовать сервер на порту 4321; при несовпадающем `base` сначала остановить старый тестовый сервер, чтобы webServer выполнил новую сборку.

## Карта файлов

- `src/pages/index.astro` — единственная страница, метаданные, установка PWA и подключение скриптов.
- `src/components/MeditationPlayer.astro` — разметка плеера, `<audio>`, доступные подписи и URL обложки/аудио.
- `src/scripts/player.ts` — состояние воспроизведения, события аудио и Media Session.
- `src/scripts/install.ts` — `beforeinstallprompt`, standalone-статус и инструкция iOS.
- `src/styles/global.css` — Tailwind 4, daisyUI 5 и тема `medi`.
- `astro.config.mjs` — `site`, `base`, manifest, Workbox и precache.
- `vitest.config.ts` — отделение unit-тестов от Playwright.
- `public/audio/meditation.mp3` — единственный локальный трек.
- `public/icons/`, `public/images/` — PNG-иконки PWA и статическая обложка.
- `tests/player.test.ts` — unit-контракт плеера.
- `tests/e2e/meditation.spec.ts` — viewport, клавиатура, аудио, base, manifest, precache и offline.
- `tests/e2e/static-server.mjs` — локальный сервер собранного сайта с HTTP Range для MP3.
- `.github/workflows/deploy.yml` — проверка и публикация `dist/` в GitHub Pages.
- `README.md` — пользовательские и developer-инструкции; не превращать его в копию этого файла.

## Архитектурные правила

### Astro, TypeScript и стили

Сайт полностью статический (`output: 'static'`). Интерактивность — клиентский TypeScript и Web API, без React или другого UI-фреймворка. Использовать существующие Tailwind/daisyUI-классы и тему `medi`; не подключать вторую дизайн-систему. Сохранять строгую типизацию и обработку Promise без unhandled rejection.

### Плеер

Один `<audio>` с локальным URL и `loop`. Воспроизведение начинается только явным действием пользователя. UI синхронизируется с событиями `play`, `pause`, `waiting`, `canplay` и `error`, а не с одним успешным вызовом `audio.play()`.

«Стоп» делает `pause()` и сбрасывает `currentTime = 0`. Внешняя пауза показывает «Начать» и сохраняет позицию. Ошибка файла возвращает доступное действие запуска и честный статус. Media Session необязателен в браузере: код должен работать без API и без поддержки отдельных action handlers. Не использовать JS-таймеры для поддержания фонового звука.

### `base` и публичные ресурсы

Все runtime-ссылки на HTML-ресурсы, аудио, обложки и иконки должны учитывать `import.meta.env.BASE_URL`. В `astro.config.mjs` использовать вычисленный `base` для `manifest.id`, `start_url`, `scope`, иконок и `navigateFallback`. Не добавлять абсолютные пути вида `/audio/...` или `/icons/...`: они ломаются на `https://<user>.github.io/<repo>/`.

`generateSW.navigateFallback` должен быть равен `base`: Astro помещает страницу в precache по URL `base`, а не по `${base}index.html`. Несовпадающий ключ роняет инициализацию service worker с `non-precached-url`.

Для проверки непустого пути использовать:

```bash
BASE_PATH=/medi/ SITE_URL=https://anatolii-iumashev.github.io npm run build
npm run test:e2e
```

### PWA и обновления

PWA построена на `@vite-pwa/astro` с Workbox `generateSW`, `registerType: 'autoUpdate'` и `navigateFallback` внутри `base`. Не добавлять принудительный reload при обновлении service worker во время воспроизведения. Новая сборка применяется на следующей навигации/запуске; версионирование precache и удаление устаревших кэшей остаются за Workbox.

В precache обязаны HTML, JS, CSS, manifest, иконки, обложка и полный MP3. При увеличении аудио проверять `maximumFileSizeToCacheInBytes` (сейчас 8 МиБ) и фактическое присутствие файла в `dist/sw.js`. Workbox добавляет revision query к закэшированным URL: в проверках сравнивать `new URL(url).pathname`, а не полный URL через `endsWith()`. Основной сценарий не должен зависеть от сетевых fallback-запросов или внешних доменов. Первый запуск офлайн невозможен; очистка site data требует повторного онлайн-открытия.

### Деплой

Публикация только статического `dist/` в отдельную ветку `gh-pages`; GitHub Pages настроен на **Deploy from a branch** (`gh-pages`, `/ (root)`). Workflow `.github/workflows/deploy.yml` запускается при push в `main` и вручную, выполняет check, unit-тесты, сборку и публикует `dist/` через `peaceiris/actions-gh-pages`. Node в Actions берётся из `.nvmrc`. Локально `make build-and-deploy` делает то же из любой ветки через `gh-pages`; `make deploy` публикует уже собранный `dist/`. В GitHub Actions `site` и `base` выводятся из стандартных `GITHUB_REPOSITORY*`; ручные override — `SITE_URL` и `BASE_PATH`. Не добавлять персональные токены и секреты для штатного Pages-деплоя.

Целевой URL: `https://anatolii-iumashev.github.io/medi/`. Проверять его фактический HTTP-ответ и последний запуск Actions; не утверждать, что сайт доступен, пока workflow и HTTPS URL не проверены.

## Обязательная приёмка

После изменений плеера — unit и E2E-сценарии Start/Stop, сброса позиции, повторного старта, внешней паузы, ошибки и Media Session. После изменений разметки — viewport 360×640, 390×844, 768×1024, отсутствие горизонтальной прокрутки, клавиатура и focus. После изменений PWA или `base` — production build, manifest, пути ресурсов, precache MP3 и повторная загрузка в offline.

Перед релизом на реальных актуальных iOS/Safari и Android/Chrome отдельно проверить:

1. Установку и standalone-запуск.
2. Полный offline-перезапуск в авиарежиме после первого онлайн-открытия.
3. Непрерывный звук не менее 5 минут после сворачивания PWA.
4. Непрерывный звук не менее 5 минут после блокировки экрана.
5. Системные метаданные и действия Media Session там, где они поддерживаются.
6. Поведение при звонке/потере аудиофокуса и обновление service worker без принудительного reload.

Эмулятор и DevTools не заменяют эти устройственные проверки. Системные прерывания нельзя маскировать ложным состоянием UI.

## Текущие ограничения

- Происхождение, лицензия и атрибуция MP3 не подтверждены: это технический placeholder, не согласованный финальный трек.
- Реальные iOS/Android, standalone offline, пятиминутный фон и обновление service worker на устройствах не проверены.
- Доступность GitHub Pages зависит от текущего deploy; проверять целевой URL перед отметкой критерия выполненным.

При изменении поведения обновлять соответствующие README.md, PRODUCT.md, RFC и `docs/specs/`; этот AGENTS.md обновлять при изменении архитектуры, команд, карты файлов или правил приёмки. Не хранить в документации секреты, токены и персональные данные.
