# Task: Fix book generation issues for demo deployment

## Context

We're preparing a production Docker deployment for celebratemyrace.com so a friend (Dan) can see what a real book looks like. The app runs in demo mode with cached data from a Strava export (987 activities, 449 photos). Book generation works end-to-end but the output has quality issues.

The generated test book is at `web/outputs/2025-race-season.pdf` (508 pages, 288MB).

## Issues to fix (priority order)

### 1. Activity Log pages are nearly empty (CRITICAL)

Page ~500 shows "ACTIVITY LOG" header with a single tiny clipped card, rest of the page is blank. This is a rendering bug in the ActivityLog template — cards aren't filling the page.

Look at: `web/components/templates/ActivityLog.tsx`

To reproduce: generate a book and check activity log pages (they start around page 88+ based on the TOC).

### 2. Date range defaults to full export (Jan 2010 - Feb 2026) instead of a sensible range

The book was generated with all 987 activities spanning 16 years. This causes:
- 508 pages (way too many)
- 7+ pages of table of contents
- Many sparse months from 2010-2015 with 1-2 activities each
- Monthly training log pages showing 0.0km for most weeks

The modal in `web/components/ManualBookGenerationModal.tsx` gets its default range from `getDefaultDateRange()` in `web/lib/period-name-generator.ts`. For a demo, the range should be something like the most recent 12 months of data (which would be roughly Feb 2025 back to Feb 2024, based on the export ending at Feb 2026).

### 3. Empty "Community" section on race stats pages

Race stats pages (e.g., "The Brief" on page 21) show a "COMMUNITY / Support & Comments" header with nothing below it. Imported data has no comments. The template should hide this section when there are no comments.

Look at: `web/components/templates/RaceSectionStatsPage.tsx` or similar race templates.

### 4. Cover has no photo

The cover page shows a dark gray rectangle instead of a photo. This is expected since no cover photo was selected in the modal — but for the demo, consider auto-selecting the first available photo as a default.

## How to test

```bash
make web-dev          # Start dev server
make web-check        # Lint + build
make test-e2e-ci      # E2e tests (must pass before PR)
```

To generate a test book, use the builder UI or the script:
```bash
cd web && npx tsx scripts/generate-real-book.ts
```

## Notes

- Focus on issues 1 and 2 — those are the most visible problems for the demo
- Issue 3 is a nice-to-have polish
- Issue 4 can be left for the user to select a photo manually
- The cached data is in `web/.cache/strava/` with photos in `web/.cache/strava/photos/`
- Don't break e2e tests — they use mock data (3 activities), not the full cache
