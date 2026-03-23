#!/bin/bash
# Build and run the production Docker image locally for testing
# Usage: ./scripts/run-prod-docker.sh

set -e

echo "Building production Docker image..."
docker build -f Dockerfile.prod -t strava-book-prod .

echo "Starting container on http://localhost:3000"
echo "Login: dan / letmein"
docker run -p 3000:3000 \
  -e NEXTAUTH_SECRET=test-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e DEMO_USERNAME=dan \
  -e DEMO_PASSWORD=letmein \
  -e MOCK_ATHLETE_ID=112292663 \
  -e NEXT_PUBLIC_MOCK_AUTH=true \
  strava-book-prod
