---
title: "Meditation PWA на Astro с офлайн-аудио"
status: delivery
created: 2026-11-17
rfc: ../rfc/archive/meditation-pwa.md
---

# Spec: Meditation PWA на Astro с офлайн-аудио

> Набор из трёх практик, переключатель треков и выбор длительности «Треугольника дыхания», добавленные после этой поставки, описаны в [audio-tracks.md](./audio-tracks.md).

## Что сделано

- Статическая одностраничная Astro/daisyUI PWA с практикой «Тихое дыхание», одним `<audio loop>` и кнопкой «Начать»/«Стоп».
- Start запускается только явным действием; Stop ставит паузу и сбрасывает позицию. Внешняя пауза сохраняет позицию, а ошибки и отказ `play()` отображаются в live-статусе.
- Media Session получает название, medi, обложку и play/pause/stop там, где браузер поддерживает API.
- Manifest, иконки, аудио и обложка используют `base`. Workbox предкэширует HTML, CSS, JS, manifest, иконки, обложку и полный MP3.
- Android install prompt и iOS-инструкция реализованы. Browser E2E подтверждает offline-reload и воспроизведение после него.
- Unit-тесты отделены от Playwright через `vitest.config.ts`; `@types/node` позволяет `astro check` проходить на чистой установке.
- README.md и AGENTS.md описывают команды, архитектуру, ограничения и обязательную устройственную приёмку.

## Ключевые решения

- Только статический `dist/`, без backend, аккаунтов, внешних аудиосервисов и JS-таймеров для фонового звука.
- `generateSW.navigateFallback` равен `base`. Astro помещает главную страницу в precache по этому URL; `${base}index.html` создаёт несуществующий ключ и ошибку `non-precached-url` при инициализации worker.
- `maximumFileSizeToCacheInBytes` на момент этой поставки был равен 8 МиБ (достаточно для MP3 2,88 МБ); актуальное значение — 24 МиБ для часовых треков, см. [audio-tracks.md](./audio-tracks.md).
- В проверках Cache Storage сравнивается `URL.pathname`, поскольку Workbox добавляет revision query к URL.
- Публикация выполняется в ветку `gh-pages`: GitHub Actions использует `peaceiris/actions-gh-pages`, а локальные `make build-and-deploy` и `make deploy` — пакет `gh-pages`. Pages должен использовать источник **Deploy from a branch**, `gh-pages`, `/ (root)`.
- Деплой из Actions использует стандартный `GITHUB_TOKEN`; персональные токены не требуются. Локальный `make build-and-deploy` публикует текущее рабочее дерево, включая незакоммиченные изменения.

## Отклонения от RFC

- Вместо первоначально предложенных официальных Pages artifact/deploy actions фактически применяется публикация `dist/` в `gh-pages` через `peaceiris/actions-gh-pages`; добавлены Makefile-цели для локального деплоя.
- `navigateFallback` исправлен на `base`, а не `${base}index.html`, чтобы совпасть с фактическим ключом Astro в precache.
- Добавлены `@types/node`, `vitest.config.ts` и корректная проверка revisioned cache URL — без этого заявленные чистая проверка и автотесты не проходили.

## Обновление после поставки

- В manifest добавлен `display_override: ['minimal-ui', 'standalone', 'browser']` при сохранённом `display: 'standalone'`. На Android и desktop установленная PWA получает минимальную шапку с меню из трёх точек и «Поделиться»; iOS, не поддерживающий `minimal-ui`, продолжает запускаться как standalone. Это изменение не затрагивает офлайн-контур и service worker.
- Экран упрощён до логотипа, названия, выбора практики и кнопки «Начать»/«Стоп». Подзаголовок, видимая строка статуса и блок установки убраны; live-статус остался только для screen reader.
- Встроенные `beforeinstallprompt`-кнопка и iOS-инструкция удалены вместе с `install.ts`: установка выполняется через меню браузера или «Поделиться» → «На экран “Домой”».
- При `controllerchange` страница перезагружается только если аудио на паузе; во время звучания обновление откладывается до следующего запуска.

## Известные ограничения / дальнейшие шаги

- Runtime MP3 — технические placeholder-файлы. Источники, права, лицензии и атрибуция актуальных треков не подтверждены; актуальное состояние и новый фрагмент Olaf Ruf описаны в [audio-tracks.md](./audio-tracks.md).
- Реальные iOS/Safari и Android/Chrome не проверены: установка, standalone offline, пятиминутные фоновые проверки для каждой практики и системная Media Session остаются обязательными перед релизом.
- Обновление service worker во время воспроизведения и последующий запуск новой сборки не проверены end-to-end.
- GitHub Actions из `main` и последующий Pages build завершились успешно; публичный HTTPS URL отвечает 200, повторные push обновляют сайт. Standalone-запуск с домашнего экрана на реальном устройстве ещё не проверен.
- RFC перенесён в `docs/rfc/archive/meditation-pwa.md`; перечисленные устройственные критерии остаются открытыми.
