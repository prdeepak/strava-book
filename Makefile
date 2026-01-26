# Shortcuts for Docker & Antigravity

.PHONY: up down build shell run test logs clean help sync web-shell web-dev web-build web-check check-docker test-visual test-template test-list test-pdf test-integration test-integration-quick test-ai test-e2e test-graphic test-graphic-list workspace-new workspace-claude workspace-list workspace-start workspace-stop workspace-destroy workspace-cleanup workspace-info sync-main workspace-merge web-restart restart web-install dev dev-attach dev-stop dev-rebuild

# =============================================================================
# Environment Detection
# =============================================================================
# Automatically detect if running in a devcontainer or workspace.
# This allows the same Makefile to work in all environments.
# =============================================================================

# Devcontainer detection (set by containerEnv in devcontainer.json)
IS_DEVCONTAINER := $(shell test "$$DEVCONTAINER" = "1" && echo yes || echo no)

# Workspace detection
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
	@echo "  make test-book        - Generate test book PDF (filter=X scoring=1 pdfByPage=1)"
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
	@echo "  make workspace-merge pr=N              - Merge PR and sync main worktree"
	@echo "  make sync-main                         - Sync main worktree with origin/main"
	@echo ""
	@echo "Devcontainer commands:"
	@echo "  make dev           - Start devcontainer and attach interactive shell"
	@echo "  make dev-attach    - Attach to running devcontainer"
	@echo "  make dev-stop      - Stop devcontainer"
	@echo "  make dev-rebuild   - Rebuild devcontainer from scratch"
	@echo "  make restart       - Restart dev server (alias for web-restart)"
ifeq ($(IS_DEVCONTAINER),yes)
	@echo ""
	@echo "Current context: DEVCONTAINER"
	@echo "  Commands run directly (no docker-compose)"
else ifeq ($(IS_WORKSPACE),yes)
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
	$(COMPOSE_CMD) up -d app
	$(MAKE) web-dev

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


# --- Web App Commands (workspace-aware, devcontainer-aware) ---
web-shell:
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && /bin/bash
else
	$(COMPOSE_CMD) run --rm -w /app/web web /bin/sh
endif

web-dev:
ifeq ($(IS_DEVCONTAINER),yes)
	@echo "Starting dev server (devcontainer, port: 3000)..."
	cd /app/web && ./scripts/smart-npm-install.sh && npm run dev
else
	@echo "Starting dev server (context: $(WORKSPACE_ID), port: $(WEB_PORT))..."
	$(COMPOSE_CMD) run --rm --service-ports -w /app/web web sh -c "./scripts/smart-npm-install.sh && npm run dev"
endif

web-install:
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npm install --legacy-peer-deps
else
	$(COMPOSE_CMD) run --rm -w /app/web web npm install --legacy-peer-deps
endif

web-build:
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && ./scripts/smart-npm-install.sh && npm run build
else
	$(COMPOSE_CMD) run --rm -w /app/web web sh -c "./scripts/smart-npm-install.sh && npm run build"
endif

web-check:
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && ./scripts/smart-npm-install.sh && npm run lint && npm run build
else
	$(COMPOSE_CMD) run --rm -w /app/web web sh -c "./scripts/smart-npm-install.sh && npm run lint && npm run build"
endif

web-restart:
ifeq ($(IS_DEVCONTAINER),yes)
	@echo "Stopping dev server..."
	@pkill -f "next dev" 2>/dev/null || true
	@echo "Starting dev server..."
	@$(MAKE) web-dev
else
	@echo "Stopping web containers (context: $(WORKSPACE_ID))..."
	@docker ps -q --filter "$(CONTAINER_FILTER)" | xargs -r docker stop
	@echo "Starting new web server on port $(WEB_PORT)..."
	$(MAKE) web-dev
endif

# Shorthand alias for restart
restart: web-restart

# Show current workspace context
workspace-info:
	@echo "Environment Detection:"
	@echo "  IS_DEVCONTAINER: $(IS_DEVCONTAINER)"
	@echo "  IS_WORKSPACE: $(IS_WORKSPACE)"
	@echo "  WORKSPACE_ID: $(WORKSPACE_ID)"
	@echo "  WEB_PORT: $(WEB_PORT)"
ifeq ($(IS_DEVCONTAINER),yes)
	@echo "  Mode: Running directly (no docker-compose)"
else
	@echo "  CONTAINER_NAME: $(CONTAINER_NAME)"
	@echo "  COMPOSE_CMD: $(COMPOSE_CMD)"
	@echo "  CONTAINER_FILTER: $(CONTAINER_FILTER)"
endif


# --- Testing Commands (workspace-aware, devcontainer-aware) ---
test-visual:
	@echo "🧪 Running visual template tests..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/test-harness.ts --all --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --all --verbose
endif

test-template:
	@echo "🧪 Testing template $(template) with fixture $(fixture)..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --verbose
endif

test-list:
	@echo "📋 Available templates and fixtures:"
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/test-harness.ts --list
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --list
endif

test-pdf:
	@echo "📄 Generating PDF only (no visual judge)..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --skip-judge --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/test-harness.ts --template $(template) --fixture $(fixture) --skip-judge --verbose
endif

test-graphic:
	@echo "🎨 Testing $(graphic) graphic with fixture $(fixture)..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/graphic-test-harness.tsx --graphic $(graphic) --fixture $(fixture) --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/graphic-test-harness.tsx --graphic $(graphic) --fixture $(fixture) --verbose
endif

test-graphic-list:
	@echo "🎨 Available graphics and fixtures:"
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/graphic-test-harness.tsx --list
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/graphic-test-harness.tsx --list
endif

test-integration:
	@echo "📚 Running integration tests (full book generation)..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/integration-tests.ts --all --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --verbose
endif

test-integration-quick:
	@echo "📚 Running integration tests (no visual judge)..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/integration-tests.ts --all --skip-judge --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/integration-tests.ts --all --skip-judge --verbose
endif

test-book-generation:
	@echo "📖 Running book generation tests..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/book-generation-tests.ts --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/book-generation-tests.ts --verbose
endif

test-api:
	@echo "🔌 Running API-level tests (matches browser environment)..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/api-tests.ts --verbose
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/api-tests.ts --verbose
endif

test-ai:
	@echo "🤖 Running AI output validation tests..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/ai-output-tests.ts
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/ai-output-tests.ts
endif

test-fonts:
	@echo "🔤 Running font validation tests..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/font-validation-tests.ts
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts
endif

test-e2e:
	@echo "🔤 Running font validation..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/font-validation-tests.ts
	@echo "🎭 Running Playwright e2e tests..."
	cd /app/web && npx playwright test --reporter=line
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts
	@echo "🎭 Running Playwright e2e tests (requires web dev server)"
	@echo "Note: Start server with 'make web-dev' first"
	$(COMPOSE_CMD) run --rm playwright npx playwright test --reporter=line
endif

test-e2e-local:
	@echo "🎭 Running Playwright e2e tests locally..."
	@echo "Note: Requires local npm install and web dev server running"
	cd web && npm run e2e

# Quick book integration test (no UI tests)
# Usage: make test-book [scoring=1] [pdfByPage=1] [filter=COVER,YEAR_STATS]
# Examples:
#   make test-book                                      # Generate PDF (no scoring)
#   make test-book scoring=1                            # With visual scoring
#   make test-book pdfByPage=1                          # Individual PDFs
#   make test-book filter=RACE_PAGE pdfByPage=1         # Only race pages as individual PDFs
test-book:
	@echo "📚 Running book integration test..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/book-integration-test.ts \
		$(if $(scoring),--score) \
		$(if $(pdfByPage),--pdfByPage) \
		$(if $(filter),--filter=$(filter))
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/book-integration-test.ts \
		$(if $(scoring),--score) \
		$(if $(pdfByPage),--pdfByPage) \
		$(if $(filter),--filter=$(filter))
endif

test-e2e-ci:
	@echo "🔤 Running font validation..."
ifeq ($(IS_DEVCONTAINER),yes)
	cd /app/web && npx tsx lib/testing/font-validation-tests.ts
	@echo "📚 Running book integration test (generates PDF with photos)..."
	cd /app/web && npx tsx lib/testing/book-integration-test.ts $(if $(scoring),--score)
	@echo "🎭 Running Playwright e2e tests..."
	cd /app/web && npx playwright test --reporter=line
else
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/font-validation-tests.ts
	@echo "📚 Running book integration test (generates PDF with photos)..."
	$(COMPOSE_CMD) run --rm -w /app/web web npx tsx lib/testing/book-integration-test.ts $(if $(scoring),--score)
	@echo "🎭 Running self-contained e2e tests in Docker..."
	@echo "Using cached node_modules and Next.js build (run 'make e2e-rebuild' if deps changed)"
	$(COMPOSE_CMD) run --rm e2e
endif

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

# Sync main worktree with origin/main (run after PRs are merged)
sync-main:
	@echo "🔄 Syncing main worktree with origin/main..."
	@git -C ~/bin/strava-book/main fetch origin main
	@git -C ~/bin/strava-book/main reset --hard origin/main
	@echo "✅ Main worktree updated to $(shell git -C ~/bin/strava-book/main rev-parse --short HEAD)"

# Merge a PR and sync main worktree
# Usage: make workspace-merge pr=83
workspace-merge:
	@if [ -z "$(pr)" ]; then echo "Usage: make workspace-merge pr=<PR_NUMBER>"; exit 1; fi
	@echo "🔀 Merging PR #$(pr)..."
	@gh pr merge $(pr) --squash
	@echo "🔄 Syncing main worktree..."
	@git -C ~/bin/strava-book/main fetch origin main
	@git -C ~/bin/strava-book/main reset --hard origin/main
	@echo "✅ PR #$(pr) merged and main worktree synced"


# =============================================================================
# Development Container (devcontainer CLI)
# =============================================================================

# Start devcontainer and attach interactive shell
dev:
	@command -v devcontainer >/dev/null 2>&1 || { echo "Install devcontainer CLI: npm install -g @devcontainers/cli"; exit 1; }
	@echo "Starting devcontainer..."
	@devcontainer up --workspace-folder .
	@echo ""
	@echo "Attaching to container... Run 'claude' to start Claude Code"
	@echo ""
	@devcontainer exec --workspace-folder . /bin/bash

# Attach to running devcontainer
dev-attach:
	@devcontainer exec --workspace-folder . /bin/bash

# Stop devcontainer
dev-stop:
	@docker stop $$(docker ps -q --filter "label=devcontainer.local_folder=$$(pwd)") 2>/dev/null || true

# Rebuild devcontainer from scratch
dev-rebuild:
	@devcontainer up --workspace-folder . --remove-existing-container
