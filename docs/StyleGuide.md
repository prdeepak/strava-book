# Strava Book Style Guide

This document defines the design system for PDF book templates. All templates must use these systems for consistency and maintainability.

## Design System Architecture

```
BookTheme (book-types.ts)
├── colors: primaryColor, accentColor, backgroundColor
├── typography: displayLarge, heading, body, caption, stat
├── spacing: xs, sm, md, lg, xl
└── effects: backgroundImageOpacity, textOverlayOpacity

    ↓ resolved by

Typography Utilities (typography.ts)
├── resolveTypography(role, theme, format) → fontSize, minFontSize, fontFamily
├── resolveSpacing(theme, format) → scaled spacing values
└── resolveEffects(theme) → effect values

    ↓ used by

Primitives (components/pdf/)
├── FullBleedBackground - hero/background images with cropping
├── PdfImage - images with "cover" behavior (fills container, clips excess)
├── PdfImageCollection - arranges multiple photos in a grid layout
├── AutoResizingPdfText - text with auto-sizing and background opacity
├── PageHeader - standardized section headers
├── RaceDataViz - splits chart + elevation profile container
└── BestEffortsTable - best efforts with PR rank color-coding

    ↓ composed into

Templates (components/templates/)
├── Cover.tsx, BackCover.tsx
├── YearStats.tsx, YearCalendar.tsx
└── RaceSection.tsx, MonthlyDivider.tsx, etc.
```

## Typography System

### Typography Roles

Define text styles semantically, not by size:

| Role | Purpose | Base Size (10x10) | Scaling |
|------|---------|-------------------|---------|
| `displayLarge` | Cover titles, hero text | 72pt | display |
| `displaySmall` | Section headers | 48pt | display |
| `heading` | Page titles | 24pt | heading |
| `subheading` | Secondary titles | 18pt | heading |
| `body` | Paragraphs, descriptions | 14pt | body |
| `caption` | Photo labels, fine print | 10pt | body |
| `stat` | Big numbers on stats pages | 32pt | display |

### Scaling Behaviors

- **display**: Scales linearly with page size (maintains visual proportion)
- **heading**: Scales moderately (85% fixed + 15% scaled)
- **body**: Scales minimally (95% fixed + 5% scaled) for readability

### Usage

```tsx
import { resolveTypography } from '@/lib/typography'

const displayLarge = resolveTypography('displayLarge', theme, format)
// Returns: { fontSize: 72, minFontSize: 48, fontFamily: 'Helvetica-Bold', letterSpacing: 2 }
```

With AutoResizingPdfText:
```tsx
<AutoResizingPdfText
  text={title}
  width={contentWidth}
  height={titleHeight}
  font={displayLarge.fontFamily}
  min_fontsize={displayLarge.minFontSize}
  max_fontsize={displayLarge.fontSize}
  // ...
/>
```

## Color System

### Theme Colors

| Color | Purpose | Default |
|-------|---------|---------|
| `primaryColor` | Dark brand color, text backgrounds | `#2d2d2d` |
| `accentColor` | Highlights, titles, decorative elements | `#ff6b35` |
| `backgroundColor` | Page background, light text on dark | `#ffffff` |
| `surfaceColor` | Subtle inset backgrounds, map fallbacks | `#f5f5f5` |
| `borderColor` | Borders, grid lines, dividers (valid hex for SVG) | `#e0e0e0` |
| `textOverAccent` | Text on accent-colored backgrounds | `#ffffff` |
| `accentForWhiteBg` | Accessible accent on white (optional) | - |
| `accentBackground` | Background for accent-colored text | - |

### Color Usage Patterns

**Text on hero images:**
- Title: `theme.accentColor`
- Body text: `theme.backgroundColor` (inverted for contrast)
- Text background: `theme.primaryColor` with opacity

**Text on solid backgrounds:**
- Use `theme.primaryColor` for text
- No text background needed

### Never Hardcode Colors

```tsx
// BAD
textColor="#ffffff"
backgroundColor="black"

// GOOD
textColor={theme.backgroundColor}
backgroundColor={theme.primaryColor}
```

## Spacing System

### Spacing Scale

| Token | Base Value | Purpose |
|-------|------------|---------|
| `xs` | 8pt | Tight spacing, icon gaps |
| `sm` | 16pt | Default element spacing |
| `md` | 24pt | Section spacing |
| `lg` | 48pt | Major section breaks |
| `xl` | 72pt | Page-level spacing |

### Usage

```tsx
import { resolveSpacing } from '@/lib/typography'

const spacing = resolveSpacing(theme, format)
// Returns scaled values: { xs: 8, sm: 16, md: 24, lg: 48, xl: 72 } for 10x10
// For 8x8: { xs: 6, sm: 13, md: 19, lg: 38, xl: 58 }

// Use in styles:
marginBottom: spacing.sm,
padding: spacing.md,
```

## Effects System

### Effect Values

| Effect | Purpose | Default |
|--------|---------|---------|
| `backgroundImageOpacity` | Faded background images | 0.5 |
| `textOverlayOpacity` | Dark scrim behind text on images | 0.3 |

### Conditional Application

Text backgrounds are only needed when there's an image behind:

```tsx
const effects = resolveEffects(theme)
const hasImageBackground = !!bgImage
const textBgOpacity = hasImageBackground ? effects.textOverlayOpacity : 0

<AutoResizingPdfText
  backgroundColor={theme.primaryColor}
  backgroundOpacity={textBgOpacity}  // 0.3 if image, 0 if solid color
/>
```

## Primitive Components

### FullBleedBackground

Full-page background with image cropping and overlay support.

```tsx
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'

<FullBleedBackground
  image={photoUrl}              // Optional - falls back to solid color
  fallbackColor={theme.primaryColor}
  role="hero"                   // 'hero' (full opacity) or 'background' (faded + overlay)
  width={format.dimensions.width}
  height={format.dimensions.height}
  sourceWidth={photo.width}     // REQUIRED when image is provided
  sourceHeight={photo.height}   // REQUIRED when image is provided
/>
```

**Photo Roles:**
- `hero`: Full opacity, no overlay. The photo IS the content.
- `background`: Reduced opacity + dark overlay for text readability.

**Always pass `sourceWidth`/`sourceHeight`** when an image is provided. Without them, PdfImage assumes 4:3 aspect ratio and will stretch/distort non-4:3 images.

### AutoResizingPdfText

Text that auto-sizes to fit container with optional background.

```tsx
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

<AutoResizingPdfText
  text="Title Text"
  width={300}
  height={80}
  font={typography.fontFamily}
  min_fontsize={typography.minFontSize}
  max_fontsize={typography.fontSize}
  h_align="center"
  v_align="middle"
  textColor={theme.accentColor}
  backgroundColor={theme.primaryColor}
  backgroundOpacity={0.3}       // Only when over images
  resize_to_text={true}         // Background hugs text vs fills container
/>
```

### PageHeader

Standardized section headers with size variants.

```tsx
import { PageHeader } from '@/components/pdf/PageHeader'

<PageHeader
  title="2024"
  subtitle="Year in Review"
  size="hero"                   // 'medium' | 'large' | 'hero'
  alignment="center"
  theme={theme}
  format={format}
/>
```

### PdfImage

Images with "cover" behavior - fills container, maintains aspect ratio, clips excess.

**Important:** react-pdf does NOT support `objectFit` or `objectPosition`. Never use these properties. Use `PdfImage` instead.

```tsx
import { PdfImage } from '@/components/pdf/PdfImage'

// Container must have known dimensions and position: 'relative'
<View style={{ width: 300, height: 200, position: 'relative', overflow: 'hidden' }}>
  <PdfImage
    src={photo.url}
    containerWidth={300}
    containerHeight={200}
    sourceWidth={photo.width}   // REQUIRED — use extractPhotos() to get this
    sourceHeight={photo.height} // REQUIRED — use extractPhotos() to get this
  />
</View>
```

**Always provide `sourceWidth` and `sourceHeight`.** Without them, PdfImage assumes 4:3 (1200×900) and calculates wrong aspect-fill geometry. react-pdf then stretches the image to the calculated dimensions, distorting non-4:3 photos. Use `extractPhotos()` to get photo URLs with their dimensions (see Photo Extraction below).

### PdfImageCollection

Arranges multiple photos in a container using an automatic grid-based layout.

```tsx
import { PdfImageCollection } from '@/components/pdf/PdfImageCollection'

// Container must have known dimensions and position: 'relative'
<View style={{ width: 400, height: 300, position: 'relative' }}>
  <PdfImageCollection
    photos={[
      { url: photo1Url, width: 1920, height: 1080 },
      { url: photo2Url, width: 1080, height: 1920 },
      // ...
    ]}
    containerWidth={400}
    containerHeight={300}
    gap={4}                     // Gap between photos in points
  />
</View>
```

**Algorithm:**
1. Finds optimal grid where `rows × cols >= N` photos
2. Grid aspect ratio matches container aspect ratio
3. Merges adjacent cells when `grid cells > N` to fill space
4. Each photo uses `PdfImage` for proper aspect-fill

**Layout examples:**

| Photos | Wide Container | Square Container | Tall Container |
|--------|----------------|------------------|----------------|
| 1 | Full container | Full container | Full container |
| 2 | Side-by-side | Side-by-side | Stacked |
| 3 | 1 large + 2 stacked | 1 large + 2 stacked | 1 large + 2 side-by-side |
| 4 | 2×2 grid | 2×2 grid | 2×2 grid |
| 5+ | Grid with merged cells | Grid with merged cells | Grid with merged cells |

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `photos` | `CollectionPhoto[]` | required | Array of photos with url and optional dimensions |
| `containerWidth` | `number` | required | Container width in points |
| `containerHeight` | `number` | required | Container height in points |
| `gap` | `number` | `4` | Gap between photos in points |
| `borderRadius` | `number` | `0` | Border radius for photos |
| `placeholderColor` | `string` | `'#f5f5f5'` | Background for empty photo cells (pass `theme.surfaceColor`) |

### RaceDataViz

Composable race data visualization container for splits charts and elevation profiles.

```tsx
import { RaceDataViz } from '@/components/pdf/RaceDataViz'

<RaceDataViz
  splits={activity.splits_metric}
  totalTime={activity.moving_time}
  width={contentWidth}
  height={120}
  showSplits={true}        // Pace/splits bar chart
  showElevation={true}     // Elevation profile line chart
  gap={8}                  // Gap between charts when both shown
  theme={theme}
  backgroundColor={theme.surfaceColor}
/>
```

**How it works:**
- When both charts are shown, splits get 60% height and elevation gets 40%
- When only one is shown, it gets the full height
- Returns `null` if no splits data or nothing to show
- Internally uses `SplitsChartSVG` and `ElevationProfileFromSplits`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `splits` | `Array<{moving_time, distance, elevation_difference}>` | required | Splits/laps data |
| `totalTime` | `number` | required | Total activity time in seconds |
| `width` | `number` | required | Container width in points |
| `height` | `number` | required | Total container height |
| `showSplits` | `boolean` | `true` | Show pace bar chart |
| `showElevation` | `boolean` | `true` | Show elevation profile |
| `gap` | `number` | `8` | Gap between charts |
| `theme` | `BookTheme` | `DEFAULT_THEME` | Theme for chart colors |
| `backgroundColor` | `string` | `'transparent'` | Background color |

### BestEffortsTable

Displays an athlete's best efforts with PR rank color-coding.

```tsx
import { BestEffortsTable } from '@/components/pdf/BestEffortsTable'

<BestEffortsTable
  activity={activity}
  format={format}
  theme={theme}
  maxEfforts={10}
/>
```

**How it works:**
- Prioritizes top-3 PR efforts (gold/silver/bronze highlighting)
- Then shows longest-distance efforts
- Color-codes: gold (#FFD700) for 1st, silver (#C0C0C0) for 2nd, bronze (#CD7F32) for 3rd
- Returns `null` if no best efforts data

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `activity` | `StravaActivity` | required | Activity with `best_efforts` data |
| `format` | `BookFormat` | `FORMATS['10x10']` | Book format for scaling |
| `theme` | `BookTheme` | `DEFAULT_THEME` | Theme for colors and fonts |
| `maxEfforts` | `number` | `10` | Maximum number of efforts to display |

## Chart Colors

### Default Chart Colors

Charts use `resolveChartColors()` to get theme-aware colors with sensible defaults:

| Token | Default | Purpose |
|-------|---------|---------|
| `barFill` | `#7ed3f7` | Splits bar fill (Strava-style light blue) |
| `barStroke` | `#5bc0de` | Splits bar stroke |
| `gridLine` | `#e5e7eb` | Grid lines |
| `axisLine` | `#9ca3af` | Axis lines |
| `axisLabel` | `#6b7280` | Axis label text |
| `markerLine` | `#d1d5db` | Marker/reference lines |
| `markerText` | `#374151` | Marker text |
| `elevationFill` | `#e5e7eb` | Elevation profile fill |
| `elevationStroke` | `#9ca3af` | Elevation profile stroke |

### Usage

```tsx
import { resolveChartColors } from '@/lib/typography'

const chartColors = resolveChartColors(theme)
// Returns DEFAULT_CHART_COLORS merged with theme.chartColors overrides

// Use in chart SVG:
<Rect fill={chartColors.barFill} stroke={chartColors.barStroke} />
<Line stroke={chartColors.gridLine} />
<SvgText fill={chartColors.axisLabel}>...</SvgText>
```

Themes can override individual chart colors via `theme.chartColors`:
```tsx
const customTheme: BookTheme = {
  ...DEFAULT_THEME,
  chartColors: {
    barFill: '#4ade80',    // Override just the bar color
    barStroke: '#22c55e',
  }
}
```

## Photo Extraction

### The Rule

**Always use `extractPhotos()` to get photos from activities.** Never access `activity.photos?.primary?.urls` directly.

```tsx
import { extractPhotos } from '@/lib/photo-gallery-utils'

const photos = extractPhotos(activity)
if (photos.length > 0) {
  const hero = photos[0]
  // hero.url — resolved URL for react-pdf
  // hero.width — source pixel width (from Strava sizes data)
  // hero.height — source pixel height
  // hero.isPortrait — true if height > width
  // hero.caption — optional caption text
}
```

### Why This Matters

Strava photos come from two sources:
- `activity.comprehensiveData.photos[]` — includes `sizes` with pixel dimensions
- `activity.photos.primary.urls` — does NOT include dimensions

PdfImage needs `sourceWidth`/`sourceHeight` for correct aspect-fill. Without them, it assumes 4:3 and stretches non-4:3 images. `extractPhotos()` handles the fallback chain and always extracts dimensions when available.

### Anti-patterns (DO NOT use)

```tsx
// BAD — no dimensions available from primary photo
const url = activity.photos?.primary?.urls?.['600']
<PdfImage src={url} containerWidth={300} containerHeight={200} />

// BAD — local getPhotos() that duplicates extractPhotos logic
const getPhotos = (activity) => { ... }

// GOOD — extractPhotos with dimensions
const photos = extractPhotos(activity)
<PdfImage
  src={photos[0].url}
  containerWidth={300}
  containerHeight={200}
  sourceWidth={photos[0].width}
  sourceHeight={photos[0].height}
/>
```

### Mapbox Satellite Images

`getMapboxSatelliteUrl()` and `getMapboxLightUrl()` in `activity-utils.ts` generate Mapbox Static Images API URLs. Key constraints:

- **1280px dimension cap** — API maximum is 1280×1280. Both functions clamp internally.
- **`@2x` suffix** — Appended automatically. Actual pixel output is 2× the request.
- **PdfImage only needs aspect ratio** — `sourceWidth`/`sourceHeight` determine crop geometry, not resolution. Pass the request dimensions directly.

```tsx
import { getMapboxSatelliteUrl } from '@/lib/activity-utils'

// Request size: double the container for sharpness, capped at 1280
const satW = Math.min(Math.round(containerWidth * 2), 1280)
const satH = Math.min(Math.round(containerHeight * 2), 1280)
const url = getMapboxSatelliteUrl(polyline, token, satW, satH)

// Pass request dimensions as source — aspect ratio is what matters
<PdfImage src={url} sourceWidth={satW} sourceHeight={satH} />
```

## Activity Data Utilities

### Shared Formatters

All activity formatting lives in `@/lib/activity-utils`. Never format distances, times, or paces inline.

```tsx
import {
  formatDuration,       // seconds → "1:23:45" or "23:45"
  formatPace,           // (movingTime, distance) → "5:30"
  formatDistanceValue,  // meters → "42.2" (no unit)
  formatDistance,        // meters → "42.2 km" (with unit)
  formatElevation,      // meters → "856m" or "1.2K"
  formatTotalHours,     // seconds → "156 hrs" (for summaries)
  resolveActivityLocation, // activity → "Boston, MA" or null
  processSplits,        // activity → SplitData[] (pace per km)
  processBestEfforts,   // activity → BestEffortData[] (PRs)
} from '@/lib/activity-utils'
```

ESLint flags inline distance division (`activity.distance / 1000`) and `.toFixed()` on divisions in template files.

### Date Formatting

Use `toLocaleDateString()` directly — there is no shared date formatter yet:

```tsx
const dateStr = new Date(activity.start_date_local || activity.start_date)
    .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
```

## Page Layout Pattern

### The Problem

react-pdf has a layout bug when combining:
- Page with `padding` (e.g., `padding: format.safeMargin`)
- Absolutely positioned elements (e.g., `FullBleedBackground`)
- Complex content (e.g., `PageHeader` with `AutoResizingPdfText`)

This combination causes content to overflow to additional pages, creating unwanted blank pages or split content.

### The Solution: Content Container Pattern

**Always use `padding: 0` on the Page and wrap content in an absolutely positioned container:**

```tsx
const styles = StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: 0,  // IMPORTANT: No padding on Page
    position: 'relative',
  },
  // Content container with safe margins
  contentContainer: {
    position: 'absolute',
    top: format.safeMargin,
    left: format.safeMargin,
    right: format.safeMargin,
    bottom: format.safeMargin,
    flexDirection: 'column',
  },
})

// In JSX:
<Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
  {/* Background - absolutely positioned, covers full page */}
  <FullBleedBackground
    fallbackColor={theme.backgroundColor}
    width={format.dimensions.width}
    height={format.dimensions.height}
  />

  {/* All content inside container */}
  <View style={styles.contentContainer}>
    <PageHeader ... />
    {/* Rest of content */}
  </View>
</Page>
```

### Key Rules

1. **Page padding must be 0** - Never use `padding: format.safeMargin` directly on Page
2. **Background first** - `FullBleedBackground` or background images go directly under Page
3. **Content in container** - All other content wrapped in `contentContainer`
4. **Container uses absolute positioning** - With `top/left/right/bottom` set to `format.safeMargin`

### Exceptions

Templates without `FullBleedBackground` or complex headers (e.g., simple single-element pages) may work with page padding, but for consistency, prefer the content container pattern for all templates.

## Template Checklist

When creating or modifying a template:

1. **Use the content container pattern:**
   - Set `padding: 0` on Page style
   - Add `contentContainer` with absolute positioning and safe margins
   - Place `FullBleedBackground` directly under Page
   - Wrap all other content in `contentContainer`

2. **Import typography utilities:**
   ```tsx
   import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
   ```

3. **Resolve all values from theme:**
   ```tsx
   const displayLarge = resolveTypography('displayLarge', theme, format)
   const spacing = resolveSpacing(theme, format)
   const effects = resolveEffects(theme)
   ```

4. **Use primitives for backgrounds and text:**
   - `FullBleedBackground` for full-page images
   - `AutoResizingPdfText` for dynamic text sizing
   - `PageHeader` for section headers

5. **Use `extractPhotos()` for all photo access:**
   ```tsx
   import { extractPhotos } from '@/lib/photo-gallery-utils'
   const photos = extractPhotos(activity)
   // Always pass sourceWidth/sourceHeight to PdfImage and FullBleedBackground
   ```

6. **Never hardcode:**
   - Colors (use `theme.*`)
   - Font sizes (use `resolveTypography`)
   - Spacing (use `resolveSpacing`)
   - Opacity values (use `resolveEffects`)

7. **Conditional text backgrounds:**
   ```tsx
   const textBgOpacity = hasImageBackground ? effects.textOverlayOpacity : 0
   ```

## Format Support

The system supports multiple book formats:

| Format | Dimensions | Scale Factor |
|--------|------------|--------------|
| 8x8 | 576 × 576pt | 0.8 |
| 10x10 | 720 × 720pt | 1.0 (reference) |
| 12x12 | 864 × 864pt | 1.2 |

Future non-square formats (8x10, 10x8) will work automatically - the typography system derives scale factors from dimensions.

## react-pdf Limitations

These CSS properties do NOT work reliably in react-pdf:

| Property | Workaround |
|----------|------------|
| `objectFit` | Use `PdfImage` component |
| `objectPosition` | Use `PdfImage` component |
| `transform` | Use absolute positioning with calculated offsets |
| Page `padding` with absolute children | Use content container pattern (see above) |

## ESLint Rules for Templates

Files in `components/templates/**/*.tsx` and `components/pdf/**/*.tsx` have extra lint rules:

| Rule | What it catches | Fix |
|------|----------------|-----|
| Ban `objectFit` / `objectPosition` | Doesn't work in react-pdf | Use `PdfImage` |
| Ban raw `<Image>` | Stretches without aspect-fill | Use `PdfImage` |
| Ban `activity.photos.primary` | Missing dimensions | Use `extractPhotos()` |
| Ban hardcoded hex colors | Breaks theming | Use `theme.*` colors |
| Ban hardcoded font names | Breaks font pairing | Use `theme.fontPairing.*` |
| Ban inline distance math | Inconsistent formatting | Use `formatDistanceValue()` etc. |

## Files Reference

- **Type definitions:** `web/lib/book-types.ts`
- **Typography utilities:** `web/lib/typography.ts`
- **Activity formatters:** `web/lib/activity-utils.ts`
- **Photo extraction:** `web/lib/photo-gallery-utils.ts`
- **Primitives:** `web/components/pdf/`
- **Templates:** `web/components/templates/`
- **Default theme:** `DEFAULT_THEME` in `book-types.ts`
- **ESLint config:** `web/eslint.config.mjs`

## Adding a New Race Section Variant

### Registration Points (all 4 required)
1. `web/lib/book-types.ts` — add to `RaceSectionVariant` union type
2. `web/components/templates/RaceSection.tsx` — add import + switch case in `renderPages()`
3. `web/lib/testing/section-manifest.ts` — add manifest builder function + switch case
4. `web/components/templates/BookDocument.tsx` — add to `pageCounts` record AND round-robin pool

### Props Interface
Every race section variant accepts exactly 5 props:
- `activity: StravaActivity`
- `format: BookFormat`
- `theme: BookTheme`
- `mapboxToken: string`
- `highlightLabel?: string`

### Manifest Accuracy Requirement
The section manifest builder MUST exactly predict the page count for every
data profile. After any change to conditional rendering logic, re-validate:
```
npx tsx web/lib/testing/design-iteration.ts --variant NAME --all-profiles --validate-manifest
```

### Degradation Rules
- Skip pages with missing primary content (don't render empty)
- Merge short adjacent pages when each is <50% utilized
- Evaluate content length, not just existence (20 chars ≠ full page)
- Target: `max(1, pages_with_sufficient_content)`
- Update manifest builder whenever conditional rendering changes

### Style Guide Compliance Checklist
- [ ] `padding: 0` on Page, content in absolutely-positioned contentContainer with safeMargin
- [ ] All colors from `theme.*` tokens (no hex literals)
- [ ] All fonts from `resolveTypography()` (no hardcoded font names)
- [ ] All spacing from `resolveSpacing()` (no hardcoded multipliers)
- [ ] Photos via `extractPhotos()` + `PdfImage`/`PdfImageCollection`
- [ ] Display-sized text wrapped in `AutoResizingPdfText`
- [ ] Effects via `resolveEffects()`
- [ ] `make web-check` passes with 0 errors
