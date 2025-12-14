# Shortcuts for Docker & Antigravity

.PHONY: up down build shell run test logs clean help sync web-shell web-dev web-build web-check

help:
	@echo "Available commands:"
	@echo "  make up      - Start the container in the background"
	@echo "  make run     - Run main.py inside the container"
	@echo "  make test    - Run the test suite (pytest)"
	@echo "  make sync    - Commit & Push to GitHub (usage: make sync msg=\"Your message\")"
	@echo "  make web-dev - Start the Next.js dev server"

# ... (Standard Docker commands kept for reference) ...
up:
	docker-compose up -d

down:
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

# --- Start the day ---
start-work:
	make up
	make web-restart
