# Task: Self-contained photo cache for Azure deployment

## Problem

When importing a Strava export via `scripts/import-strava-export.ts`, the photo-mapper stores **absolute file paths** (e.g., `/Users/deepak/bin/strava-book/main/strava-export-deepak/export_112292663/media/photo.jpg`) as photo URLs in `.cache/strava/activities/`. This works locally but breaks in Docker/Azure where the export folder doesn't exist.

## Solution

Two changes make the app self-contained:

### 1. `web/lib/import/photo-mapper.ts`
- Added `copyPhotoToCache()` — copies each photo from the export into `.cache/strava/photos/`
- Changed the URL stored in the cache from an absolute path to `cache-photo://{filename}`
- Photos are deduplicated by filename (skips copy if already present)

### 2. `web/lib/pdf-image-loader.ts`
- Added handler for `cache-photo://` URLs in `resolveImageForPdf()`
- Resolves `cache-photo://{filename}` to `{cwd}/.cache/strava/photos/{filename}`
- Existing HTTP URLs (from Strava API) and absolute paths continue to work

### No Dockerfile changes needed
`Dockerfile.prod` already copies `.cache/` into the runner stage, so `.cache/strava/photos/` is included automatically.

## What to test

1. **Import with photo copying**: Run the import and verify photos land in `.cache/strava/photos/`:
   ```bash
   cd web
   npx tsx scripts/import-strava-export.ts \
     --export-dir=../../strava-export-deepak/export_112292663 \
     --athlete-id=112292663
   ls .cache/strava/photos/ | head
   ```

2. **PDF generation**: Generate a book and verify imported photos render correctly (no broken images).

3. **Existing API photos still work**: Activities with Strava CDN URLs (https://dgtzuqphqg23d.cloudfront.net/...) should be unaffected.

4. **E2E tests**: `make test-e2e-ci` should pass (these use mock data, not the import path, so they should be unaffected).

5. **Docker build** (optional): Build with `Dockerfile.prod` and verify the photos are baked into the image:
   ```bash
   docker build -f Dockerfile.prod -t strava-book-test .
   docker run --rm strava-book-test ls .cache/strava/photos/ | head
   ```
