# Layout Decomposition: Filmstrip Race Section Variant

## 1. Page-by-Page Plan

### Page 1 (Left of Spread A — "Journey Left")
- **Role:** Hero map + title overlay
- **Primary content:** Full-bleed satellite map (top half, spanning across to page 2 as a visual concept). Semi-transparent text box overlaid on map with race title and key stats (distance, time, pace, elevation).
- **Secondary content:** Two-column race report/description text below the map.
- **Estimated fill ratio:** 0.85
- **Notes:** Map occupies ~50% of page height. Title overlay uses `AutoResizingPdfText` with `theme.primaryColor` background at `textOverlayOpacity`. Stats rendered as compact inline row beneath title.

### Page 2 (Right of Spread A — "Journey Right")
- **Role:** Map continuation + description continuation + filmstrip
- **Primary content:** Full-bleed satellite map (top half, matching page 1). Two-column description text continues below the map.
- **Secondary content:** Vertical filmstrip of 5 photos on the far right edge of the page.
- **Estimated fill ratio:** 0.90
- **Notes:** Filmstrip is positioned absolutely on the right edge, ~70pt wide. Description text column width reduced to accommodate the filmstrip. Photos in filmstrip have sprocket-hole border effect.

### Page 3 (Left of Spread B — "Hero + Best Efforts")
- **Role:** Visual hero + best efforts data
- **Primary content:** Hero photo taking top 2/3 of the page.
- **Secondary content:** BestEffortsTable in bottom 1/3.
- **Estimated fill ratio:** 0.85
- **Notes:** Hero photo uses `PdfImage` in a container with `overflow: 'hidden'`. BestEffortsTable imported from `web/components/pdf/BestEffortsTable.tsx`.

### Page 4 (Right of Spread B — "Data & Community")
- **Role:** Stats/data + community comments
- **Primary content:** Splits chart (RaceDataViz) in top ~40% of the page.
- **Secondary content:** Support & Comments section with individual comments in bottom ~60%.
- **Estimated fill ratio:** 0.80
- **Notes:** Uses `RaceDataViz` for splits. Comments in two-column layout similar to editorial variant. Kudos banner if kudos exist.

## 2. Spread Pairing

### Spread A: Pages 1 + 2 (Journey)
- **Visual balance:** Both pages share a satellite map across the top, creating a visual spread. Left page has title/stats overlay + description, right page has description continuation + filmstrip. The filmstrip adds visual weight to the right side, balancing the title overlay on the left.
- **Content flow:** Description flows from page 1 to page 2 (split mid-text).

### Spread B: Pages 3 + 4 (Data & Community)
- **Visual balance:** Left page is photo-heavy (hero + small data table), right page is data-heavy (chart + comments). Good contrast between visual and data content.
- **Content flow:** Independent pages, no content flowing across.

## 3. Primitive Reuse

| Primitive | Usage |
|-----------|-------|
| `PdfImage` | Pages 1 & 2: satellite map in positioned View container (top half of each page). Fallback: SVG polyline on solid `theme.surfaceColor` background, following Editorial P2PanoramicMap pattern. Page 3: hero photo. |
| `PdfImageCollection` | Not used — filmstrip replaces the collection pattern |
| `AutoResizingPdfText` | Page 1: race title overlay on map |
| `RaceDataViz` | Page 4: splits chart |
| `BestEffortsTable` | Page 3: best efforts table |
| `PdfFilmstrip` (new) | Page 2: vertical filmstrip with sprocket-hole effect |

### Map Rendering Pattern (Pages 1 & 2)
Uses a positioned `View` container (top half of page, `height: contentHeight * 0.5`) with `PdfImage` inside for the satellite map. **Does NOT use `FullBleedBackground`** since the map only covers part of the page. Follows the content container pattern from StyleGuide §8: `padding: 0` on Page, content in absolutely-positioned contentContainer with `format.safeMargin`. Map uses `getMapboxSatelliteUrl()` with `resolveImageForPdf()`. Fallback when no polyline: SVG route trace on `theme.surfaceColor` background (same as Editorial P2PanoramicMap).

### New Primitive: `PdfFilmstrip`
A vertical (or horizontal) strip of photos with film sprocket-hole borders. Created in Stage 2 at `web/components/pdf/PdfFilmstrip.tsx`. Photo count fallback handled inside the component:
- **5+ photos:** Render as filmstrip (ideal case)
- **2-4 photos:** Cycle/repeat photos to fill the strip
- **0-1 photos:** Fall back to single `PdfImage` filling the same dimensions (no sprocket holes)

### Page 3 Sizing (10x10 format reference)
- Total content height: `720 - (45 * 2) = 630pt`
- Hero photo container: top 65% = `~410pt`
- Spacing: `spacing.md = 24pt`
- BestEffortsTable: bottom 35% = `~196pt`
- Uses `extractPhotos()` for all photo access with `sourceWidth`/`sourceHeight`

## 4. Closest Existing Variant

**`RaceSectionEditorial.tsx`** is the closest structural reference:
- Multi-page layout (2-5 pages, adaptive)
- Uses satellite map (P2PanoramicMap)
- Uses BestEffortsTable (P5Stats)
- Uses two-column description text (P3DescriptionSplits)
- Has community/comments page (P6Comments)

Key differences from editorial:
- Filmstrip variant has a **2-page map spread** (pages 1+2) vs editorial's single map page
- Filmstrip adds the **PdfFilmstrip** primitive on page 2
- Filmstrip has **hero photo + BestEffortsTable** on page 3 (editorial puts stats and best efforts on same page)
- Description text **wraps across pages 1→2** instead of being on a single page

**`RaceSectionMagazine.tsx`** provides additional reference for:
- Full-bleed hero page patterns (HeroPage)
- Compact stats + comments on a single page (TheBriefPage)

## 5. Data Requirements Summary

| Data | Required for | Fallback |
|------|-------------|----------|
| `activity.map.summary_polyline` | Pages 1-2 map | Skip map, use solid background |
| `activity.description` | Pages 1-2 description | Skip description area |
| Photos (5+) | Page 2 filmstrip, Page 3 hero | Filmstrip: cycle photos or fall back to single PdfImage. Hero: skip page 3 |
| `activity.splits_metric` | Page 4 splits chart | Skip chart section |
| `activity.best_efforts` | Page 3 best efforts | Skip best efforts section |
| Comments | Page 4 comments | Skip comments section |
| `activity.kudos_count` | Page 4 kudos banner | Skip banner |

## 6. Conditional Rendering Rules

- **Pages 1-2 (Journey):** Always rendered (at minimum 2 pages). Map is optional — falls back to solid/SVG polyline background.
- **Page 3 (Hero + Best Efforts):** Rendered if photos > 0 OR best_efforts exist. Skip if neither.
- **Page 4 (Data & Community):** Always rendered (shows at minimum the stats; splits and comments are optional sections).
- **Minimum pages:** 2 (pages 1+2 always), **Maximum pages:** 4

## 7. Page Count Formula

```
pages = 2 (journey spread, always)
      + (hasPhotos || hasBestEfforts ? 1 : 0)  // page 3
      + 1 (data & community, always)            // page 4
= min 3 (no photos, no best_efforts → skip page 3), max 4 (full data)
```

## Review Concerns

Addressed from layout review (cycle 1):
- ✅ Clarified map rendering: uses positioned View + PdfImage, NOT FullBleedBackground (map is partial height)
- ✅ Added sizing calculations for page 3 (hero photo 65% + BestEffortsTable 35%)
- ✅ Specified filmstrip photo count fallback (5+ ideal, 2-4 cycle, 0-1 single PdfImage)
- ✅ Corrected page count formula to show min=3, max=4
- ✅ Referenced StyleGuide content container pattern explicitly
- ✅ PdfFilmstrip primitive created in Stage 2 before use in Stage 3
