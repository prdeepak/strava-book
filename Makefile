# Shortcuts for Docker & Antigravity

.PHONY: up down build shell run test logs clean help sync web-shell web-dev web-build web-check check-docker test-visual test-template test-list test-pdf test-integration test-integration-quick

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
	@echo "  make test-integration - Run full book integration tests"
	@echo "  make test-list        - List available templates and fixtures"


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
	# Running interactively (-it) so you can see logs and Ctrl+C
	docker-compose run --rm --service-ports -w /app/web web npm run dev

web-build:
	docker-compose run --rm -w /app/web web npm run build

web-check:
	docker-compose run --rm -w /app/web web npm run lint
	docker-compose run --rm -w /app/web web npm run build

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

test-integration:
	@echo "📚 Running integration tests (full book generation)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --verbose

test-integration-quick:
	@echo "📚 Running integration tests (no visual judge)..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --skip-judge --verbose

test-book-generation:
	@echo "📖 Running book generation tests..."
	docker-compose run --rm -w /app/web web npx tsx lib/testing/book-generation-tests.ts --verbose


# --- Start the day ---
start-work:
	make up
	make web-restart
