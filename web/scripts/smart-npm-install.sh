#!/bin/sh
# Smart npm install - uses cached node_modules from Docker image when possible
#
# Strategy:
# 1. If node_modules is empty and cache exists, copy from cache (~5 seconds)
# 2. If package.json has changed since image was built, run npm install
# 3. Otherwise, skip install entirely

CACHE_DIR="/opt/node_modules_cache/node_modules"
CACHE_CHECKSUM="/opt/package.json.md5"

# Check if node_modules is empty or missing
if [ ! -f "node_modules/.bin/next" ]; then
    # Check if we have a cache to copy from
    if [ -d "$CACHE_DIR" ]; then
        echo "Copying cached node_modules from Docker image..."
        cp -r "$CACHE_DIR" ./node_modules
        echo "Done copying cache."

        # Check if package.json has changed since the image was built
        if [ -f "$CACHE_CHECKSUM" ]; then
            CURRENT_MD5=$(md5sum package.json | cut -d' ' -f1)
            CACHED_MD5=$(cut -d' ' -f1 "$CACHE_CHECKSUM")

            if [ "$CURRENT_MD5" != "$CACHED_MD5" ]; then
                echo "package.json has changed, running npm install for updates..."
                npm install --legacy-peer-deps
            else
                echo "package.json unchanged, using cached dependencies."
            fi
        fi
    else
        # No cache available, do full install
        echo "No cache available, running full npm install..."
        npm install --legacy-peer-deps
    fi
else
    echo "Dependencies already installed, skipping."
fi
