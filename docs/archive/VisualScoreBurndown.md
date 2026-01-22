# Burndown: Full Book Visual Scores → 80+

## Goal
Fix PDF templates so all pages score 80+ when generating a full book with photos and real data.

## Key Insight
Individual template tests pass, but full book generation with photos fails. Must iterate using full book generation, not isolated template tests.

---

## Iteration Workflow

### Step 1: Generate Full Book with Scoring
```bash
make test-e2e-ci
```
This runs `book-integration-test.ts` which:
- Loads fixtures with 16 activities, 5 races, 47 photos
- Generates complete book PDF
- Runs visual scoring on all pages
- Outputs: `web/outputs/integration-test-{timestamp}-scores.md`

### Step 2: Read Scores File
Check `web/outputs/integration-test-*-scores.md` for:
- Which pages failed (score < 80)
- Specific issues per page (printReadability, layoutBalance, brandCohesion)
- Suggestions for improvement

### Step 3: Fix One Template
Focus on ONE failing template at a time:
- Edit the template file
- Address the specific issues noted in scores.md

### Step 4: Re-generate Book
```bash
make test-e2e-ci
```
Check if that page now scores 80+.

### Step 5: Iterate
- If score >= 80: move to next failing template
- If score < 80 and iteration < 5: try different fix
- If iteration 5 reached: document and move on

---

## Pre-requisite Fix

**book-integration-test.ts** uses wrong theme (navy/yellow instead of Strava orange/black):
- Line 14: Add `DEFAULT_THEME` to import from `@/lib/book-types`
- Line 41-46: Delete the `TEST_THEME` constant
- Line 289: Change `theme: TEST_THEME` to `theme: DEFAULT_THEME`

This ensures visual scoring uses the actual default colors (orange/black like Strava).

---

## Current Failing Pages (Score < 80)

| Page | Type | Score | Template File | Primary Issues |
|------|------|-------|---------------|----------------|
| 2 | FOREWORD | 62 | Foreword.tsx | Text small, bg dominant |
| 6 | RACE_PAGE | 35 | RaceSectionHeroPage.tsx | Poor contrast, no brand colors |
| 9 | UNKNOWN | 15 | RaceSectionCommentsPage.tsx | Blank overflow page |
| 10 | RACE_PAGE | 62 | RaceSectionStatsPage.tsx | Small text, cramped tables |
| 12 | MONTHLY_DIVIDER | 38 | MonthlyDividerSpread.tsx | No text, only images |
| 14 | MONTHLY_DIVIDER | 17 | MonthlyDividerSpread.tsx | Only satellite map |
| 15 | ACTIVITY_LOG | 17 | ActivityLog.tsx | Only satellite image |
| 16 | BACK_COVER | 38 | BackCover.tsx | Minimal content |
| 17 | UNKNOWN | 52 | YearCalendar.tsx | Small text, unbalanced |
| 19 | UNKNOWN | 43 | MonthlyDividerSpread.tsx? | Section divider issues |
| 20 | UNKNOWN | 60 | YearCalendar.tsx | Calendar layout issues |

---

## Fix Priority Order

1. **Pre-requisite:** Fix theme in book-integration-test.ts
2. **Foreword** (62) - Closest to passing, quick win
3. **BackCover** (38) - Important book-end
4. **RaceSection pages** (35, 62) - High visibility content
5. **MonthlyDivider** (17, 38) - Section structure
6. **ActivityLog** (17) - Content pages
7. **YearCalendar** (43, 52, 60) - Complex layouts
8. **Overflow page** (15) - May need to skip rendering

---

## Cross-Cutting Requirements

These apply to multiple templates and may require fixes at template, book, or fixture level:

### 1. Page Dimensions Consistency
- Every page must be generated at the exact specified size (e.g., 720x720 for 10x10)
- All pages in the book must have identical dimensions
- If a background image doesn't bleed to all 4 edges, it may indicate wrong page dimensions

### 2. Route Maps Must Show Satellite Imagery
- Any route map on any page must display actual satellite imagery behind the route plot
- Check: RaceSection, ActivityLog, MonthlyDivider pages
- May need to verify Mapbox static image URL includes satellite style

### 3. Background Images Must Full-Bleed
- Background images must cover all four edges completely
- No white borders or gaps at edges
- If edges show, investigate: wrong dimensions, incorrect positioning, or missing bleed

### 4. Cover Photos from Fixture
- **Front Cover**: Must use `coverPhoto` from fixture as background
- **Back Cover**: Must use `backCoverPhoto` from fixture as background
- Verify fixture includes both photos and they're passed to templates correctly

### 5. Fixture Richness for 2-Page TOC
- Fixture must have enough content to generate a 2-page Table of Contents
- Verify both TOC pages render at correct dimensions
- May need to add more races/activities to fixture

---

## Template Fix Strategies

### Cover.tsx
- **Use `coverPhoto` as full-bleed background image**
- Ensure background bleeds to all 4 edges
- Verify fixture provides coverPhoto

### Foreword.tsx
- Increase body fontSize: 14 → 16pt base
- Reduce background opacity: 0.3 → 0.15
- Increase title size
- Better text/image contrast

### BackCover.tsx
- **Use `backCoverPhoto` as full-bleed background image**
- Add more content (stats, highlights)
- Better layout distribution
- Larger fonts
- Add accent elements
- Ensure background bleeds to all 4 edges

### RaceSectionHeroPage.tsx
- Add semi-transparent overlay behind text
- Use theme.accentColor prominently
- Increase stat font sizes

### RaceSectionStatsPage.tsx
- Increase table padding
- Larger fonts in data tables
- Better spacing between sections
- **Splits table**: Divide race into no more than 10 roughly equal parts (e.g., 91km → 9×10km + remainder, not 91 individual km splits). Edit underlying splits calculation code.

### RaceSectionCommentsPage.tsx / RaceSection.tsx
- Skip page when no comments (or kudos < threshold)
- OR add meaningful fallback content

### MonthlyDividerSpread.tsx
- **Left page**: Use Highlight Activity photo as full-bleed image (covers entire left page)
- **Right page**: Month name, calendar, stats
- Ensure month name always visible
- Add text content alongside images
- Use brand colors for headers
- Verify satellite imagery appears on any route maps

### ActivityLog.tsx
- Ensure text always visible
- Better fallback for missing maps
- Larger activity titles

### YearCalendar.tsx
- Increase overall scale
- Larger month labels
- Better legend visibility
- **Left-justify calendar rows**: Bottom row with 1-3 months should align left with months above, not spread across the row (use `justifyContent: 'flex-start'` not `space-between`)

### TableOfContents.tsx
- Ensure both pages of a 2-page TOC render at correct dimensions
- Verify content flows properly to second page
- Check page numbers and formatting on both pages

---

## Tracking Progress

Create `./tmp/iteration-log.md` to track:

```markdown
# Book Generation Iteration Log

## Run 1: Initial baseline (after theme fix)
- Scores file: integration-test-{timestamp}-scores.md
- Failing pages: TBD
- Average: TBD

## Run 2: After Foreword fix
- Changes: Increased font, reduced bg opacity
- Page 2 score: ? → ?
- Still failing: ?

...
```

---

## Validation

Target state after all iterations:
- All pages score >= 80 (OR documented reason why not achievable)
- All pages have identical dimensions (720x720 for 10x10 format)
- All route maps show satellite imagery behind route
- All background images bleed to all 4 edges
- Cover uses coverPhoto, BackCover uses backCoverPhoto
- TOC spans 2 pages with correct dimensions on both
- YearCalendar has left-justified month rows

Final command:
```bash
make test-e2e-ci
```

---

## Files to Modify

### Infrastructure / Fixtures
0. `web/lib/testing/book-integration-test.ts` (theme fix - DO FIRST)
1. `web/lib/testing/fixtures/` - Ensure coverPhoto, backCoverPhoto set; add content for 2-page TOC

### Templates
2. `web/components/templates/Cover.tsx` - coverPhoto as background
3. `web/components/templates/Foreword.tsx`
4. `web/components/templates/TableOfContents.tsx` - verify 2-page rendering
5. `web/components/templates/BackCover.tsx` - backCoverPhoto as background
6. `web/components/templates/RaceSectionHeroPage.tsx`
7. `web/components/templates/RaceSectionStatsPage.tsx`
8. `web/components/templates/RaceSectionCommentsPage.tsx`
9. `web/components/templates/RaceSection.tsx`
10. `web/components/templates/MonthlyDividerSpread.tsx` - full-bleed highlight photo on left
11. `web/components/templates/ActivityLog.tsx`
12. `web/components/templates/YearCalendar.tsx` - left-justify rows

### Book-Level
13. `web/components/templates/BookDocument.tsx` - ensure correct params passed to templates
