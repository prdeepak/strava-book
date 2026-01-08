#!/bin/bash
# Run eslint --fix on edited TypeScript/JavaScript files

# Read JSON from stdin
input=$(cat)

# Extract file path using jq
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Exit if no file path
if [ -z "$file_path" ]; then
  exit 0
fi

# Only run on JS/TS files in the web directory
if [[ "$file_path" == *"/web/"* ]] && [[ "$file_path" =~ \.(js|ts|jsx|tsx)$ ]]; then
  cd /Users/deepak/bin/strava-book/web
  npx eslint --fix "$file_path" 2>/dev/null || true
fi

exit 0
