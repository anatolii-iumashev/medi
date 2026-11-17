SHELL := /bin/bash

REPO ?= anatolii-iumashev/medi
SITE_URL ?= https://anatolii-iumashev.github.io
BASE_PATH ?= /medi/
DEPLOY_BRANCH ?= gh-pages

.PHONY: help check test build deploy build-and-deploy

help:
	@echo "make check             — проверка Astro/TypeScript"
	@echo "make test              — unit-тесты Vitest"
	@echo "make build             — production-сборка с путями GitHub Pages"
	@echo "make deploy            — публикация dist/ в ветку $(DEPLOY_BRANCH)"
	@echo "make build-and-deploy  — проверки, сборка и публикация из текущей ветки"

check:
	npm run check

test:
	npm test

build:
	BASE_PATH=$(BASE_PATH) SITE_URL=$(SITE_URL) npm run build

deploy:
	@test -d dist || { echo "Нет dist/ — сначала выполните make build."; exit 1; }
	touch dist/.nojekyll
	npx gh-pages -d dist -b $(DEPLOY_BRANCH) -m "deploy: $$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	@echo "Опубликовано в $(DEPLOY_BRANCH): $(SITE_URL)$(BASE_PATH)"

build-and-deploy:
	$(MAKE) --no-print-directory check test build
	$(MAKE) --no-print-directory deploy
