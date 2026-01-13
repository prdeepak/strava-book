#!/bin/sh
# Smart npm install - checks if dependencies are actually installed
# Checks for next binary since that's what we need to run the dev server

if [ ! -f "node_modules/.bin/next" ]; then
  echo "Installing npm dependencies..."
  npm install --legacy-peer-deps
else
  echo "Dependencies up to date, skipping install"
fi
