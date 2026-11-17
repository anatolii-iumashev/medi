SHELL := /bin/bash

REPO ?= anatolii-iumashev/medi
SITE_URL ?= https://anatolii-iumashev.github.io
BASE_PATH ?= /medi/

.PHONY: help check test build build-and-deploy

help:
	@echo "make check             — проверка Astro/TypeScript"
	@echo "make test              — unit-тесты Vitest"
	@echo "make build             — production-сборка с путями GitHub Pages"
	@echo "make build-and-deploy  — проверки, сборка, push в main и запуск деплоя"

check:
	npm run check

test:
	npm test

build:
	BASE_PATH=$(BASE_PATH) SITE_URL=$(SITE_URL) npm run build

build-and-deploy:
	@test "$$(git branch --show-current)" = "main" || { \
		echo "Деплой идёт только из main — переключитесь на main и повторите."; \
		exit 1; \
	}
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo "Есть незакоммиченные изменения — закоммитьте их перед деплоем."; \
		exit 1; \
	fi
	$(MAKE) --no-print-directory check test build
	git push origin main
	@echo "Push в main запустил деплой: https://github.com/$(REPO)/actions/workflows/deploy.yml"
	@echo "Приложение после публикации: $(SITE_URL)$(BASE_PATH)"
