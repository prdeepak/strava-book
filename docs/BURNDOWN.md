# MedalBook Gap Analysis & Burndown

## Summary
NOTE: Monthly dividers still not showing properly in book.


Comparing **current output** (`Strava-book output 20260111 1125.pdf`) against **reference** (`TrainingSparkle Strava book to 20250609.pdf`) and **PRD vision**.

| Aspect | Reference | Current | Gap Severity |
|--------|-----------|---------|--------------|
| Cover | Full-bleed hero photo + title/theme | Plain text on solid color | **Critical** |
| Race sections | Multi-page, galleries, splits, elevation, emotional content | Utilitarian photo + stats | **Critical** |
| Year calendar/heatmap | Strava-style heatmap grouped by month | Missing | **Critical** |
| Monthly dividers | Large photo + date overlay | None | **High** |
| Year overview | Photo BG + sport icons + bar chart | Text-only stats | **High** |
| Activity log | Photos, descriptions, kudos, comments | Route maps + basic stats only | **High** |
| Map style | Light/standard Mapbox | Dark satellite | **Medium** |
| TOC | N/A in reference | Clean, functional | **Good** |

---

## Prioritized Burndown

### P0 - Critical (Coffee-table aesthetic blockers)

#### 1. Cover Page - Full-Bleed Hero Photo
- **Current:** Plain navy background with text only
- **Target:** Full-bleed athlete photo with overlaid year/name/title (like reference page-01)
- **PRD:** "Cover: Full-bleed hero image, Athlete Name, DateRange, Book title / theme"
- **Effort:** Medium
- **Files:** Cover template component

#### 2. Improve race sections
- **Current:** Utilitarian; photo hero + stats.
- **Target:** Multi-page (see existing "full" race-section variant). Add all emotional content (descriptions, kudos, comments(.  Multi-photo artistic layouts with B&W treatments, decorative stripes (like reference page-11).  Add split charts and elevation profiles (SVG visualizations).
- **PRD:** "Extended Photo Gallery" for Full race spreads
- **Effort:** High
- **Files:** New PhotoGallery component; could be used in race section, but also in monthly dividers?

#### 3. Year Calendar / Heatmap
- **Current:** Missing entirely
- **Target:** Strava-style heatmap visualization grouped by month
- **PRD:** "Year Calendar: Strava-style heatmap visualization of consistency... group icons into months"
- **Reference:** See `outputs/strava-streaks` or `outputs/strava-training` for examples
- **Effort:** High
- **Files:** New YearCalendar template component

### P1 - High (Visual polish gaps)

#### 4. Monthly Divider Pages
- **Current:** Missing entirely
- **Target:** Full-bleed photo with month/date overlay in corner (like reference page-06)
- **PRD:** "Monthly Dividers: Visually distinct chapter breaks for each active month"
- **Effort:** Medium
- **Files:** New MonthlyDivider template component

#### 5. Year Overview Page Enhancement
- **Current:** Clean stats page (distance, time, elevation) - functional
- **Target:** Photo/generated background + sport-type icons + monthly bar chart (like reference page-05)
- **PRD:** "Year Stats: Magazine style dashboard. Big typography... Choose or generate an image for the background"
- **Effort:** Medium
- **Files:** YearStats template component

#### 6. Foreword Page
- **Current:** Missing or basic
- **Target:** Personal note and/or inspiring quote or dedication
- **PRD:** "Foreword: Optional personal note and/or inspiring quote or dedication"
- **Effort:** Low
- **Files:** New Foreword template component

### P2 - Medium (Polish & refinement)

#### 7. Map Style - Light/Standard vs Dark Satellite
- **Current:** Dark satellite style maps in activity log
- **Target:** Light/standard Mapbox style for better print readability (like reference page-08, page-14)
- **PRD:** "Mapbox Satellite style (dark mode)" - but reference uses light style
- **Effort:** Low
- **Files:** Map generation utilities

#### 8. Activity Log Enhancements
- **Current:** Route maps + basic stats only; no photos, descriptions, kudos, or comments
- **Target:** Two variants:
  - **Concise:** Route map + stats + kudo count + 1 photo thumbnail (if available)
  - **Full:** All of concise + description excerpt + comments + larger photo
- **PRD:** Aligns with "Emphasize emotional content" - even the grind should feel human
- **Effort:** Medium
- **Files:** ActivityLog template component, new ActivityCard variants

#### 9. TOC Structure (Section-based)
- **Current:** Lists individual pages
- **Target:** Lists sections, not individual pages (e.g., each month is a section)
- **PRD:** "Table of Contents: Auto-generated; lists sections not individual pages"
- **Effort:** Low
- **Files:** TOC template component

#### 10. Print-Ready Blank Pages
- **Current:** No intentional blank pages
- **Target:** Blank pages for proper print spreads (reference page-02, page-03)
- **Effort:** Low
- **Files:** BookDocument structure

### P3 - Low (Nice-to-have enhancements)

#### 11. Decorative Design Elements
- **Current:** Clean but utilitarian
- **Target:** Decorative stripes, corner accents (like reference top-right stripes)
- **Effort:** Low
- **Files:** PDF components library

#### 12. B&W Photo Treatments
- **Current:** All photos in color
- **Target:** Selective B&W for artistic effect (like reference page-11)
- **Effort:** Low
- **Files:** Image processing utilities

---

## What's Working Well

| Feature | Status |
|---------|--------|
| Table of Contents | Clean, well-organized with page numbers |
| Year in Review Stats | Big typography, good hierarchy |
| Race Pages (basic) | Photo backgrounds with stats overlay working |
| Activity Log (basic) | Dense, functional, includes route maps |
| Typography | Professional fonts, good hierarchy |
| Color scheme | Consistent navy/orange theme |

---

## Recommended Sprint Order

1. **Sprint 1:** Cover Page (quick win, high visibility)
2. **Sprint 2:** Improve Race Sections (galleries, emotional content, splits, elevation, kudos/comments)
3. **Sprint 3:** Year Calendar/Heatmap + Year Overview Enhancement
4. **Sprint 4:** Monthly Dividers + Activity Log Enhancements (concise/full variants) + Foreword
5. **Sprint 5:** Polish (TOC restructure, map style, print blanks, decorative elements)
