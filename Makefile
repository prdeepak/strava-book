# Shortcuts for Docker & Antigravity

.PHONY: up down build shell run logs clean help

help:
	@echo "Available commands:"
	@echo "  make up      - Start the container in the background"
	@echo "  make down    - Stop the container"
	@echo "  make build   - Rebuild the image (run this after changing requirements.txt)"
	@echo "  make shell   - Enter the container terminal"
	@echo "  make run     - Run main.py inside the container"
	@echo "  make logs    - View container logs"

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

logs:
	docker-compose logs -f app

clean:
	docker-compose down --rmi all -v
