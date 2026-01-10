# Shortcuts for Docker & Antigravity

.PHONY: up down build shell run test logs clean help sync web-shell web-dev web-build web-check check-docker test-visual test-template test-list test-pdf test-integration test-integration-quick test-ai test-e2e test-graphic test-graphic-list

help:
	@echo "Available commands:"
	@echo "  make up      - Start the container in the background"
	@echo "  make run     - Run main.py inside the container"
	@echo "  make test    - Run the test suite (pytest)"
	@echo "  make sync    - Commit & Push to GitHub (usage: make sync msg=\"Your message\")"
	@echo "  make web-dev - Start the Next.js dev server"
	@echo ""
	@echo "Testing commands:"
	@echo "  make test-visual      - Run all visual template tests"
	@echo "  make test-template    - Test specific template (template=X fixture=Y)"
	@echo "  make test-graphic     - Test graphic component (graphic=X fixture=Y)"
	@echo "  make test-integration - Run full book integration tests"
	@echo "  make test-ai          - Run AI output validation tests"
	@echo "  make test-e2e         - Run Playwright e2e tests (requires web-dev)"
	@echo "  make test-e2e-ci      - Self-contained e2e tests (fully isolated)"
	@echo "  make test-list        - List available templates and fixtures"
	@echo "  make test-graphic-list - List available graphics (splits, elevation, map, heatmap)"


# --- The Smart Check ---
# This checks if docker is responding. If not, it opens the app and waits.
DOCKER_APP := OrbStack

check-docker:
	@if ! docker info > /dev/null 2>&1; then \
		echo "🐳 Docker is not running. Launching $(DOCKER_APP)..."; \
		open -a "$(DOCKER_APP)"; \
		echo "⏳ Waiting for Docker to be ready..."; \
		while ! docker info > /dev/null 2>&1; do \
			sleep 1; \
			printf "."; \
		done; \
		echo ""; \
		echo "✅ Docker is ready!"; \
	fi


# ... (Standard Docker commands kept for reference) ...
up:
	make check-docker
	docker-compose up -d

down:
	@echo "🛑 Stopping all strava-book containers..."
	@docker ps -q --filter "name=strava-book" | xargs -r docker stop
	@echo "🧹 Cleaning up Docker Compose resources..."
	docker-compose down

build:
	docker-compose build

shell:
	docker-compose exec app /bin/bash

run:
	docker-compose exec app python main.py

test:
	docker-compose exec app pytest

# --- The Smart Sync Command ---
# Default to timestamp if no 'msg' is provided
msg ?= Antigravity Auto-save: $(shell date '+%Y-%m-%d %H:%M:%S')

sync:
	git add .
	@echo "📦 Committing with message: '$(msg)'"
	git commit -m "$(msg)"
	git push origin main


# --- Web App Commands ---
web-shell:
	docker-compose run --rm -w /app/web web /bin/sh

web-dev:
	# Install dependencies (for Linux native modules) then run dev server
	docker-compose run --rm --service-ports -w /app/web web sh -c "npm install --legacy-peer-deps && npm run dev"

web-install:
	docker-compose run --rm -w /app/web web npm install --legacy-peer-deps

web-build:
	docker-compose run --rm -w /app/web web sh -c "npm install --legacy-peer-deps && npm run build"

web-check:
	docker-compose run --rm -w /app/web web sh -c "npm install --legacy-peer-deps && npm run lint && npm run build"

web-restart:
	@echo "Stopping any running web containers..."
	@docker ps -q --filter "name=strava-book-web" | xargs -r docker stop
	@echo "Starting new web server..."
	$(MAKE) web-dev


# --- Testing Commands ---
test-visual:
	@echo "🧪 Running visual template tests..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --all --verbose

test-template:
	@echo "🧪 Testing template $(template) with fixture $(fixture)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --verbose

test-list:
	@echo "📋 Available templates and fixtures:"
	docker-compose run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --list

test-pdf:
	@echo "📄 Generating PDF only (no visual judge)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --skip-judge --verbose

test-graphic:
	@echo "🎨 Testing $(graphic) graphic with fixture $(fixture)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/graphic-test-harness.tsx --graphic $(graphic) --fixture $(fixture) --verbose

test-graphic-list:
	@echo "🎨 Available graphics and fixtures:"
	docker-compose run --rm -w /app/web web npx tsx lib/testing/graphic-test-harness.tsx --list

test-integration:
	@echo "📚 Running integration tests (full book generation)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --verbose

test-integration-quick:
	@echo "📚 Running integration tests (no visual judge)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --skip-judge --verbose

test-book-generation:
	@echo "📖 Running book generation tests..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/book-generation-tests.ts --verbose

test-api:
	@echo "🔌 Running API-level tests (matches browser environment)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/api-tests.ts --verbose

test-ai:
	@echo "🤖 Running AI output validation tests..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/ai-output-tests.ts

test-fonts:
	@echo "🔤 Running font validation tests..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts

test-e2e:
	@echo "🎭 Running Playwright e2e tests (requires web dev server)"
	@echo "Note: Start server with 'make web-dev' first"
	docker-compose run --rm playwright npx playwright test --reporter=line

test-e2e-local:
	@echo "🎭 Running Playwright e2e tests locally..."
	@echo "Note: Requires local npm install and web dev server running"
	cd web && npm run e2e

test-e2e-ci:
	@echo "🎭 Running self-contained e2e tests in Docker..."
	@echo "This builds, starts server, and runs tests - fully isolated"
	docker-compose run --rm e2e


# --- Start the day ---
start-work:
	make up
	make web-restart
