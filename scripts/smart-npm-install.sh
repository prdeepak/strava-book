#!/bin/sh
# Smart npm install - seeds from Docker cache and skips if unchanged
# This script significantly reduces startup time for Docker containers.

set -e

LOCK_FILE="/app/web/node_modules/.package-json-checksum"
PACKAGE_FILE="/app/web/package.json"
DOCKER_CACHE="/opt/node_modules_cache/node_modules"

cd /app/web

# Calculate checksum of package.json
current_checksum=$(sha256sum "$PACKAGE_FILE" 2>/dev/null | cut -d' ' -f1 || md5sum "$PACKAGE_FILE" | cut -d' ' -f1)

# Check if node_modules is empty or missing
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    # Check if Docker cache exists (from image build)
    if [ -d "$DOCKER_CACHE" ] && [ -n "$(ls -A $DOCKER_CACHE 2>/dev/null)" ]; then
        echo "📦 Seeding node_modules from Docker cache..."
        cp -r "$DOCKER_CACHE"/* node_modules/ 2>/dev/null || mkdir -p node_modules

        # Check if cached version matches current package.json
        if [ -f "/opt/package.json.md5" ]; then
            cached_md5=$(cat /opt/package.json.md5 | cut -d' ' -f1)
            current_md5=$(md5sum "$PACKAGE_FILE" | cut -d' ' -f1)

            if [ "$cached_md5" = "$current_md5" ]; then
                echo "✅ Dependencies loaded from cache (package.json unchanged)"
                echo "$current_checksum" > "$LOCK_FILE"
                exit 0
            else
                echo "📦 package.json differs from cache, running npm install..."
            fi
        fi
    else
        echo "📦 First run, installing dependencies..."
    fi

    npm install --legacy-peer-deps
    echo "$current_checksum" > "$LOCK_FILE"
    echo "✅ Dependencies installed"
    exit 0
fi

# node_modules exists - check if package.json changed
if [ -f "$LOCK_FILE" ]; then
    cached_checksum=$(cat "$LOCK_FILE")

    if [ "$current_checksum" = "$cached_checksum" ]; then
        echo "📦 Dependencies up to date (package.json unchanged)"
        exit 0
    else
        echo "📦 package.json changed, running npm install..."
    fi
else
    echo "📦 Verifying dependencies..."
fi

npm install --legacy-peer-deps
echo "$current_checksum" > "$LOCK_FILE"
echo "✅ Dependencies installed"
