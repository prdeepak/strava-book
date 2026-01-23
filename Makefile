# Shortcuts for Docker & Antigravity

.PHONY: up down build shell run test logs clean help sync web-shell web-dev web-build web-check check-docker test-visual test-template test-list test-pdf test-integration test-integration-quick test-ai test-e2e test-graphic test-graphic-list workspace-new workspace-claude workspace-list workspace-start workspace-stop workspace-destroy workspace-cleanup workspace-info

# =============================================================================
# Workspace Detection
# =============================================================================
# Automatically detect if running in a workspace and configure accordingly.
# This allows the same Makefile to work in both main repo and workspaces.
# =============================================================================

WORKSPACE_FILE := .workspace.json
IS_WORKSPACE := $(shell test -f $(WORKSPACE_FILE) && echo yes || echo no)

ifeq ($(IS_WORKSPACE),yes)
  # Running in a workspace - use workspace-specific configuration
  WORKSPACE_ID := $(shell jq -r .id $(WORKSPACE_FILE) 2>/dev/null)
  WEB_PORT := $(shell jq -r .port $(WORKSPACE_FILE) 2>/dev/null)
  CONTAINER_NAME := strava-ws-$(WORKSPACE_ID)
  COMPOSE_CMD := docker-compose -f docker-compose.workspace.yml
  CONTAINER_FILTER := name=strava-ws-$(WORKSPACE_ID)
else
  # Running in main repo - use default configuration
  WORKSPACE_ID := main
  WEB_PORT := 3000
  CONTAINER_NAME := strava-book-web
  COMPOSE_CMD := docker-compose
  CONTAINER_FILTER := name=strava-book
endif

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
	@echo "  make test-e2e-ci      - Self-contained e2e tests (uses cache)"
	@echo "  make e2e-rebuild      - Rebuild e2e image (after package.json changes)"
	@echo "  make e2e-clear-cache  - Clear e2e caches (force fresh build)"
	@echo "  make test-list        - List available templates and fixtures"
	@echo "  make test-graphic-list - List available graphics (splits, elevation, map, heatmap)"
	@echo ""
	@echo "Multi-agent workspace commands:"
	@echo "  make workspace-new name=X              - Create isolated workspace"
	@echo "  make workspace-claude name=X prompt=Y  - Create workspace + launch Claude"
	@echo "  make workspace-list                    - List all workspaces with status"
	@echo "  make workspace-start id=X              - Start a workspace container"
	@echo "  make workspace-stop id=X               - Stop a workspace container"
	@echo "  make workspace-destroy id=X            - Remove a workspace completely"
	@echo "  make workspace-cleanup                 - Remove stale workspaces (inactive >24h)"
	@echo "  make workspace-info                    - Show current workspace context"
ifeq ($(IS_WORKSPACE),yes)
	@echo ""
	@echo "Current context: WORKSPACE ($(WORKSPACE_ID))"
	@echo "  Port: $(WEB_PORT) | Container: $(CONTAINER_NAME)"
else
	@echo ""
	@echo "Current context: MAIN REPO"
	@echo "  Port: $(WEB_PORT) | Using default docker-compose.yml"
endif


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


# --- Standard Docker Commands (workspace-aware) ---
up:
	make check-docker
	$(COMPOSE_CMD) up -d app web

down:
	@echo "🛑 Stopping containers (context: $(WORKSPACE_ID))..."
	@docker ps -q --filter "$(CONTAINER_FILTER)" | xargs -r docker stop
	@echo "🧹 Cleaning up Docker Compose resources..."
	$(COMPOSE_CMD) down

build:
	$(COMPOSE_CMD) build

shell:
	$(COMPOSE_CMD) exec app /bin/bash

run:
	$(COMPOSE_CMD) exec app python main.py

test:
	$(COMPOSE_CMD) exec app pytest

# --- The Smart Sync Command ---
# Default to timestamp if no 'msg' is provided
msg ?= Antigravity Auto-save: $(shell date '+%Y-%m-%d %H:%M:%S')

sync:
	git add .
	@echo "📦 Committing with message: '$(msg)'"
	git commit -m "$(msg)"
	git push origin main


# --- Web App Commands (workspace-aware) ---
web-shell:
	$(COMPOSE_CMD) run --rm -w /app/web web /bin/sh

web-dev:
	@echo "Starting dev server (context: $(WORKSPACE_ID), port: $(WEB_PORT))..."
	$(COMPOSE_CMD) run --rm --service-ports -w /app/web web sh -c "./scripts/smart-npm-install.sh && npm run dev"

web-install:
	$(COMPOSE_CMD) run --rm -w /app/web web npm install --legacy-peer-deps

web-build:
	$(COMPOSE_CMD) run --rm -w /app/web web sh -c "./scripts/smart-npm-install.sh && npm run build"

web-check:
	$(COMPOSE_CMD) run --rm -w /app/web web sh -c "./scripts/smart-npm-install.sh && npm run lint && npm run build"

web-restart:
	@echo "Stopping web containers (context: $(WORKSPACE_ID))..."
	@docker ps -q --filter "$(CONTAINER_FILTER)" | xargs -r docker stop
	@echo "Starting new web server on port $(WEB_PORT)..."
	$(MAKE) web-dev

# Show current workspace context
workspace-info:
	@echo "Workspace Detection:"
	@echo "  IS_WORKSPACE: $(IS_WORKSPACE)"
	@echo "  WORKSPACE_ID: $(WORKSPACE_ID)"
	@echo "  WEB_PORT: $(WEB_PORT)"
	@echo "  CONTAINER_NAME: $(CONTAINER_NAME)"
	@echo "  COMPOSE_CMD: $(COMPOSE_CMD)"
	@echo "  CONTAINER_FILTER: $(CONTAINER_FILTER)"


# --- Testing Commands (workspace-aware) ---
test-visual:
	@echo "🧪 Running visual template tests..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --all --verbose

test-template:
	@echo "🧪 Testing template $(template) with fixture $(fixture)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --verbose

test-list:
	@echo "📋 Available templates and fixtures:"
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --list

test-pdf:
	@echo "📄 Generating PDF only (no visual judge)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --skip-judge --verbose

test-graphic:
	@echo "🎨 Testing $(graphic) graphic with fixture $(fixture)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/graphic-test-harness.tsx --graphic $(graphic) --fixture $(fixture) --verbose

test-graphic-list:
	@echo "🎨 Available graphics and fixtures:"
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/graphic-test-harness.tsx --list

test-integration:
	@echo "📚 Running integration tests (full book generation)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --verbose

test-integration-quick:
	@echo "📚 Running integration tests (no visual judge)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --skip-judge --verbose

test-book-generation:
	@echo "📖 Running book generation tests..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/book-generation-tests.ts --verbose

test-api:
	@echo "🔌 Running API-level tests (matches browser environment)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/api-tests.ts --verbose

test-ai:
	@echo "🤖 Running AI output validation tests..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/ai-output-tests.ts

test-fonts:
	@echo "🔤 Running font validation tests..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts

test-e2e:
	@echo "🔤 Running font validation..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts
	@echo "🎭 Running Playwright e2e tests (requires web dev server)"
	@echo "Note: Start server with 'make web-dev' first"
	$(COMPOSE_CMD) run --rm playwright npx playwright test --reporter=line

test-e2e-local:
	@echo "🎭 Running Playwright e2e tests locally..."
	@echo "Note: Requires local npm install and web dev server running"
	cd web && npm run e2e

# Quick book integration test with visual scoring (no UI tests)
# Usage: make test-book [no_score=1] [pdfByPage=1] [filter=COVER,YEAR_STATS]
# Examples:
#   make test-book no_score=1                           # Skip scoring
#   make test-book pdfByPage=1 no_score=1               # Individual PDFs, no scoring
#   make test-book filter=RACE_PAGE pdfByPage=1         # Only race pages as individual PDFs
test-book:
	@echo "📚 Running book integration test..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/book-integration-test.ts \
		$(if $(no_score),--no-score) \
		$(if $(pdfByPage),--pdfByPage) \
		$(if $(filter),--filter=$(filter))

test-e2e-ci:
	@echo "🔤 Running font validation..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts
	@echo "📚 Running book integration test (generates PDF with photos, runs visual scoring)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/book-integration-test.ts
	@echo "🎭 Running self-contained e2e tests in Docker..."
	@echo "Using cached node_modules and Next.js build (run 'make e2e-rebuild' if deps changed)"
	$(COMPOSE_CMD) run --rm e2e

# Rebuild e2e Docker image (needed when package.json changes)
e2e-rebuild:
	@echo "🔨 Rebuilding e2e Docker image with fresh dependencies..."
	$(COMPOSE_CMD) build --no-cache e2e
	@echo "🧹 Clearing e2e caches to use fresh image..."
	docker volume rm -f strava-book_e2e_node_modules strava-book_e2e_next_cache 2>/dev/null || true
	@echo "✅ E2E image rebuilt. Next test run will populate caches."

# Clear e2e caches (forces fresh npm install and build on next run)
e2e-clear-cache:
	@echo "🧹 Clearing e2e caches..."
	docker volume rm -f strava-book_e2e_node_modules strava-book_e2e_next_cache 2>/dev/null || true
	@echo "✅ Caches cleared. Next test run will rebuild."


# --- Start the day ---
start-work:
	make up
	make web-restart


# --- Multi-Agent Workspace Commands ---
# Create isolated workspaces for parallel development

workspace-new:
	@./scripts/workspace-manager.sh new $(name)

workspace-claude:
	@./scripts/workspace-manager.sh claude $(name) "$(prompt)"

workspace-list:
	@./scripts/workspace-manager.sh list

workspace-start:
	@./scripts/workspace-manager.sh start $(id)

workspace-stop:
	@./scripts/workspace-manager.sh stop $(id)

workspace-destroy:
	@./scripts/workspace-manager.sh destroy $(id) --force

workspace-cleanup:
	@./scripts/workspace-manager.sh cleanup
