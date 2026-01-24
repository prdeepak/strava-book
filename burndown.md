# Manual Book Generation - Burndown

Issues identified for "generate manual book" feature.

---

## 1. Cover.tsx

### 1a. Image stretched - not using PdfImage correctly
**Status:** Bug confirmed
**File:** `web/components/templates/Cover.tsx`, `web/components/pdf/FullBleedBackground.tsx`

**Issue:** Cover uses `FullBleedBackground` which calls `PdfImage` without passing `sourceWidth`/`sourceHeight` dimensions. From `FullBleedBackground.tsx:102`:
```tsx
<PdfImage src={image} opacity={resolvedImageOpacity} />
```

This triggers PdfImage's fallback mode (line 118-137) which uses `minWidth/minHeight: 100%` and can cause stretching/squishing.

**Fix:** FullBleedBackground needs to accept and pass image dimensions to PdfImage, or images need to be pre-processed to extract dimensions.

### 1b. Title doesn't appear
**Status:** Needs verification in latest code
**File:** `web/components/templates/Cover.tsx`

**Observation:** In older sample output (page-01.png from Jan 24 06:48), the title "April 2025 to January 2026" was visible. However, the title may have regressed in more recent code changes.

**Action:** Verify current Cover.tsx behavior:
1. Check that `mainPeriodDisplay` is being populated correctly
2. Verify `textColor={theme.accentColor}` renders visibly against background
3. Test with a fresh book generation to confirm title appears

### 1c. Audit against StyleGuide
**Status:** Partially compliant

**Compliant:**
- Uses `resolveTypography` and `resolveSpacing`
- Uses `FullBleedBackground` primitive
- Uses `AutoResizingPdfText` primitive
- Uses content container pattern (padding: 0 on page)
- Colors from theme

**Non-compliant:**
- Does not use `PageHeader` primitive (has custom text box layout - may be intentional for cover design)

---

## 2. Foreword.tsx

### 2a. Body text fontsize range too small
**Status:** Bug confirmed
**File:** `web/components/templates/Foreword.tsx:176`

**Current:**
```tsx
max_fontsize={bodyTypo.fontSize * 1.2}
```

**Fix:** Increase to 2x:
```tsx
max_fontsize={bodyTypo.fontSize * 2}
```

### 2b. Body text not centered
**Status:** Bug confirmed
**File:** `web/components/templates/Foreword.tsx:178-179`

**Current:**
```tsx
h_align="left"
v_align="top"
```

**Fix:** Center both:
```tsx
h_align="center"
v_align="middle"
```

Also update `bodyArea` style (line 103) from `justifyContent: 'flex-start'` to `justifyContent: 'center'`. Note: Keep the quote mark left-aligned (do NOT center it).

### 2c. Body text should be italic
**Status:** Enhancement
**File:** `web/components/templates/Foreword.tsx`

**Issue:** Body text should use italic style for a more elegant foreword appearance.

**Fix:** Add `fontStyle: 'italic'` to the AutoResizingPdfText or use an italic font variant if available. Note: May need to check if `bodyTypo.fontFamily` has an italic variant (e.g., "Helvetica-Oblique" vs "Helvetica"). Future consideration: support a handwriting-style font option.

---

## 3. TableOfContents.tsx

### 3a. Listing all races in cache, not just daterange
**Status:** Bug - needs data flow investigation
**File:** `web/components/templates/TableOfContents.tsx`

**Issue:** TOC receives `entries` prop but doesn't filter by date range. The filtering should happen upstream when generating the entries, or TOC needs startDate/endDate props to filter.

**Fix:** Ensure the component generating TOC entries filters races by the book's date range before passing to TableOfContents.

### 3b. Races in reverse order, should be date order
**Status:** Bug confirmed
**File:** `web/components/templates/TableOfContents.tsx:117-119`

**Current:** Sorts by page number within category:
```tsx
Object.values(groupedEntries).forEach(categoryEntries => {
  categoryEntries.sort((a, b) => a.pageNumber - b.pageNumber)
})
```

**Issue:** If races are added to the book in reverse chronological order, they'll appear that way in TOC.

**Fix:** For the "Races" category specifically, sort by date (need to parse subtitle or add a `date` field to TOCEntry):
```tsx
if (category === 'Races') {
  categoryEntries.sort((a, b) => /* date comparison */)
}
```

### 3c. Multipage header format
**Status:** Bug confirmed
**File:** `web/components/templates/TableOfContents.tsx:237`

**Current:**
```tsx
title={isFirstPage ? 'Contents' : 'Contents (cont.)'}
```

**Fix:** Use subtitle for "Continued" indicator:
```tsx
title="Contents"
subtitle={isFirstPage ? undefined : 'Continued'}
```

---

## 4. YearStats.tsx

### 4a. Calculates for all activities in cache, not daterange
**Status:** Bug - needs data flow investigation
**File:** `web/components/templates/YearStats.tsx`

**Issue:** `YearStatsPage` receives `activities` prop and calculates stats from all provided activities (line 294-295). The filtering should happen upstream.

**Fix:** Ensure caller passes only activities within the book's date range, OR add startDate/endDate props and filter internally:
```tsx
const filteredActivities = activities.filter(a => {
  const date = new Date(a.start_date_local)
  return date >= startDate && date <= endDate
})
```

---

## 5. YearCalendar.tsx (Year In Review)

### 5a. Calendar bottom row layout
**Status:** Bug confirmed
**File:** `web/components/templates/YearCalendar.tsx:73-79`

**Current:**
```tsx
monthsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',  // Spreads items across row
  ...
}
```

**Issue:** When bottom row has fewer than 4 months, `space-between` spreads them across. Should left-justify.

**Fix:** Change to `flex-start` with explicit gap, or use a conditional approach:
```tsx
justifyContent: 'flex-start',
gap: 12 * format.scaleFactor,  // explicit gap instead of space-between
```

### 5b. "Least" color invisible
**Status:** Bug confirmed
**File:** `web/components/templates/YearCalendar.tsx:266-267`

**Current:** Intensity 0 (no activity) uses `#f0f0f0` on white background - nearly invisible.

**Issue:** The "least activity" color (intensity 1) at line 268 uses `${accentColor}40` (25% opacity) which is also very faint.

**Fix:** Increase minimum opacity for intensity 1:
```tsx
`${accentColor}60`,  // 1 - lightest (37% opacity) - more visible
```

### 5c. Monthly Distance title spacing
**Status:** Bug confirmed
**File:** `web/components/templates/YearCalendar.tsx:161-170`

**Current:** Chart title has `marginBottom: 6 * format.scaleFactor` but chart container starts immediately.

**Fix:** Increase margin or add padding:
```tsx
chartTitle: {
  ...
  marginBottom: 12 * format.scaleFactor,  // More space
}
```

And/or reduce chart height slightly.

### 5d. Remove duplicate stats at bottom
**Status:** Enhancement
**File:** `web/components/templates/YearCalendar.tsx:536-562`

**Issue:** Bottom stats (Distance, Time, Elevation, Activities) duplicate YearStats page.

**Fix:** Remove the `statsGrid` section entirely (lines 536-562), or make it conditional with a prop.

---

## 6. Global: All images being squished

### 6a. PdfImage not receiving pixel dimensions
**Status:** Bug confirmed
**Files:** Multiple templates, `web/components/pdf/FullBleedBackground.tsx`, `web/components/pdf/PdfImage.tsx`

**Root cause:** `PdfImage` requires `sourceWidth` and `sourceHeight` (in pixels) for precise aspect-fill calculation. Without these, it falls back to CSS-based approach that can squish images.

From `PdfImage.tsx:118`:
```tsx
// Fallback mode: use CSS-based approach when dimensions unknown (will squish image)
```

**Affected components:**
1. `FullBleedBackground.tsx:102` - doesn't pass dimensions
2. `YearCalendar.tsx:420-421` - doesn't pass dimensions
3. Likely other templates using PdfImage

**Fix options:**
1. **Extract dimensions at fetch time:** When fetching photos from Strava API, store width/height in the photo data
2. **Pass dimensions through props:** Add sourceWidth/sourceHeight to FullBleedBackground and thread through
3. **Pre-process images:** Use a library to read image dimensions before rendering

**Priority:** HIGH - affects visual quality across entire book

---

---

## 7. PNG Page Images Not Generated

### 7a. Pages folder empty after book generation
**Status:** Bug confirmed
**File:** Likely in PDF generation or post-processing code

**Issue:** When generating a book in production (e.g., "road-to-comrades-2026-01-24T16-29-11"), the `-pages` folder is created but remains empty - no PNG images are generated from the PDF.

**Observation:** The folder `road-to-comrades-2026-01-24T16-29-11-pages/` exists but contains no files, while the PDF itself was generated successfully.

**Fix:** Investigate the PDF-to-PNG conversion step:
1. Check if the conversion process is being triggered
2. Verify dependencies (e.g., pdf-to-img, sharp, or similar library)
3. Check for errors in the conversion pipeline that may be silently failing

**Priority:** HIGH - users cannot preview individual pages

---

## Summary Priority

| Priority | Issue | Impact |
|----------|-------|--------|
| HIGH | 7a - PNG pages not generated | Users cannot preview pages |
| HIGH | 6a - Images squished | All photo pages affected |
| HIGH | 3a - TOC wrong races | Incorrect book content |
| HIGH | 4a - YearStats wrong data | Incorrect statistics |
| HIGH | 1b - Cover title verification | Possible regression |
| MEDIUM | 5d - Duplicate stats | Redundant info |
| MEDIUM | 2a/2b/2c - Foreword styling | Layout polish, italic text |
| MEDIUM | 5a - Calendar layout | Visual polish |
| MEDIUM | 5b - Legend visibility | Visual polish |
| MEDIUM | 5c - Chart spacing | Visual polish |
| LOW | 3b - Race order | Minor UX |
| LOW | 3c - TOC header format | Minor UX |
