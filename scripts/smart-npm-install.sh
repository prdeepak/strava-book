#!/bin/sh
# Smart npm install - only runs if package.json has changed
# This script significantly reduces startup time for Docker containers
# by caching the package.json checksum and skipping npm install when unchanged.

set -e

LOCK_FILE="/app/web/node_modules/.package-json-checksum"
PACKAGE_FILE="/app/web/package.json"

# Calculate checksum of package.json
current_checksum=$(sha256sum "$PACKAGE_FILE" 2>/dev/null | cut -d' ' -f1 || md5sum "$PACKAGE_FILE" | cut -d' ' -f1)

# Check if we have a cached checksum
if [ -f "$LOCK_FILE" ]; then
    cached_checksum=$(cat "$LOCK_FILE")

    if [ "$current_checksum" = "$cached_checksum" ]; then
        echo "📦 Dependencies up to date (package.json unchanged)"
        exit 0
    else
        echo "📦 package.json changed, running npm install..."
    fi
else
    echo "📦 First run, installing dependencies..."
fi

# Run npm install
cd /app/web
npm install --legacy-peer-deps

# Cache the new checksum
echo "$current_checksum" > "$LOCK_FILE"
echo "✅ Dependencies installed and cached"
