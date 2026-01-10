# Strava Book Template Implementation Plan

This plan outlines all react-pdf templates needed to generate a complete "coffee table" book from Strava data. Each section is designed to be independently implementable by an agent.

## Current State Summary

**Existing Templates:**
- `Race_1p.tsx` - Single-page race template (functional)
- `Race_2p.tsx` / `Race_2pLeft.tsx` / `Race_2pRight.tsx` - Two-page race spread (functional)
- `BookDocument.tsx` - Container, only handles COVER and RACE_PAGE types
- `AIRace.tsx` - AI-driven layout (experimental)

**Existing Reusable Components:**
- `StatsGrid.tsx` - Distance, time, pace, elevation
- `Header.tsx` - Activity title and metadata
- `CommentsSection.tsx` - Social comments display
- `BestEffortsTable.tsx` - PR times table

**BookPageType enum (curator.ts):** Currently only `COVER | RACE_PAGE | STATS_SUMMARY`

---

## Phase 1: Foundation (Do First)

### 1.1 Extend BookPageType Enum
**File:** `web/lib/curator.ts`

Add new page types:
```typescript
export type BookPageType =
  | 'COVER'
  | 'TABLE_OF_CONTENTS'
  | 'FOREWORD'
  | 'YEAR_AT_A_GLANCE'
  | 'YEAR_STATS'
  | 'MONTHLY_DIVIDER'
  | 'RACE_PAGE'
  | 'ACTIVITY_LOG'      // Journal-style list
  | 'BEST_EFFORTS'
  | 'ROUTE_HEATMAP'
  | 'BACK_COVER'
```

Update `BookEntry` interface to support new page types with their specific data needs.

### 1.2 Create Shared Types
**File:** `web/lib/book-types.ts` (new)

Define interfaces for book-wide data:
```typescript
// === BOOK FORMAT (Square, print-ready) ===
interface BookFormat {
  size: '8x8' | '10x10' | '12x12'
  dimensions: { width: number; height: number }  // in points (72pt = 1 inch)
  bleed: number          // 9pt = 0.125" standard bleed
  safeMargin: number     // keep text/important content inside this
  scaleFactor: number    // relative to 10x10 base design
}

const FORMATS: Record<string, BookFormat> = {
  '8x8':   { width: 576, height: 576, bleed: 9, safeMargin: 36, scaleFactor: 0.8 },
  '10x10': { width: 720, height: 720, bleed: 9, safeMargin: 45, scaleFactor: 1.0 },  // BASE
  '12x12': { width: 864, height: 864, bleed: 9, safeMargin: 54, scaleFactor: 1.2 },
}

// === BOOK CONFIG ===
interface BookConfig {
  title: string
  subtitle?: string
  year: number
  dateRange: { start: Date; end: Date }
  athlete: { name: string; profileUrl?: string }
  format: BookFormat
  units: 'metric' | 'imperial'
  theme: BookTheme        // AI-generated or user-selected
  aRace?: StravaActivity  // Primary "goal race" for theming
}

// === AI-GENERATED THEME ===
interface BookTheme {
  primaryColor: string      // e.g., "#0D2240" (Boston blue)
  accentColor: string       // e.g., "#FFD200" (Boston yellow)
  backgroundColor: string
  fontPairing: {
    heading: string         // e.g., "Oswald"
    body: string            // e.g., "Source Sans Pro"
  }
  motif?: string            // e.g., "boston-marathon", "trail-running"
  backgroundStyle: 'solid' | 'gradient' | 'photo-fade' | 'pattern'
}

// === RACE-SPECIFIC THEME OVERLAY ===
interface RaceTheme {
  raceId: number
  raceName: string
  heroImage?: string        // User's best photo from race
  backgroundImage?: string  // Official race photo or location imagery
  logoUrl?: string          // Official race logo
  logoPlacement?: 'top-left' | 'top-right' | 'bottom-center'
  accentColor?: string      // Override book accent for this race
  narrative?: string        // AI-written emotional caption
}

// === YEAR SUMMARY ===
interface YearSummary {
  totalDistance: number
  totalTime: number
  totalElevation: number
  activityCount: number
  longestActivity: StravaActivity
  fastestActivity: StravaActivity
  activeDays: Set<string>  // ISO date strings
  monthlyStats: MonthlyStats[]
  races: StravaActivity[]  // Activities with workout_type === 1
  aRace?: StravaActivity   // Auto-detected or user-selected primary race
}
```

### 1.3 Square Format Implementation

**Decision: Square format for print-on-demand compatibility**

| Size | Dimensions | Use Case |
|------|------------|----------|
| 8" × 8" | 576pt × 576pt | Economy option |
| 10" × 10" | 720pt × 720pt | **Base design size** |
| 12" × 12" | 864pt × 864pt | Premium coffee table |

**How format flexibility works:**
1. Design all templates at 10×10 (720pt) base size
2. Templates receive `format: BookFormat` prop
3. Apply `scaleFactor` to font sizes and fixed spacing
4. Use percentage-based widths for layout (e.g., `width: '45%'`)
5. Respect `safeMargin` for all text content (avoid trim zone)

**Implementation pattern for templates:**
```typescript
const createStyles = (format: BookFormat) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    padding: format.safeMargin,
  },
  title: {
    fontSize: 36 * format.scaleFactor,  // Scales with format
  },
  body: {
    fontSize: Math.max(10, 12 * format.scaleFactor),  // Floor at 10pt
  },
})
```

---

## Phase 2: Front Matter Templates

### 2.1 Cover Page (Enhanced)
**File:** `web/components/templates/Cover.tsx`

Current cover is minimal. Enhance to include:
- Full-bleed background image (user's best photo or gradient)
- Title with custom typography
- Year prominently displayed
- Athlete name
- Optional tagline

**Props:**
```typescript
interface CoverProps {
  title: string
  subtitle?: string
  year: number
  athleteName: string
  backgroundImage?: string
  theme: BookTheme
}
```

### 2.2 Foreword / Dedication Page
**File:** `web/components/templates/Foreword.tsx`

Simple text page with elegant typography:
- Optional title ("Dedication", "About This Year", etc.)
- Body text (user-written or AI-generated reflection)
- Pull quote styling option
- Decorative flourish/border

**Props:**
```typescript
interface ForewordProps {
  title?: string
  body: string
  author?: string
  theme: BookTheme
}
```

### 2.3 Table of Contents
**File:** `web/components/templates/TableOfContents.tsx`

Auto-generated from book entries:
- List sections with page numbers
- Group by month or activity type
- Clean, scannable layout

**Props:**
```typescript
interface TOCProps {
  entries: { title: string; pageNumber: number; type: BookPageType }[]
  theme: BookTheme
}
```

---

## Phase 3: Overview Templates

### 3.1 Year at a Glance - Calendar View
**File:** `web/components/templates/YearCalendar.tsx`

GitHub contribution-style heatmap showing activity across the year:
- 12-month grid layout
- Color intensity = distance or time
- Activity type differentiation by color
- Summary stats below

**Data needed:**
```typescript
interface YearCalendarProps {
  year: number
  activities: StravaActivity[]
  colorBy: 'distance' | 'time' | 'elevation'
  theme: BookTheme
}
```

**Implementation notes:**
- Use react-pdf's `<View>` and `<Rect>` for grid cells
- Calculate cell size based on page dimensions
- Legend showing color scale

### 3.2 Year at a Glance - Streak View
**File:** `web/components/templates/YearStreak.tsx`

Alternative visualization:
- Horizontal timeline
- Streak highlighting (consecutive active days)
- Milestone markers

### 3.3 Year Stats Summary
**File:** `web/components/templates/YearStats.tsx`

Magazine-style stats page:
- Big hero numbers (total distance, hours, elevation)
- Comparison to previous year (if data available)
- "By the numbers" callouts
- Small charts/graphs

**Props:**
```typescript
interface YearStatsProps {
  summary: YearSummary
  previousYear?: YearSummary
  theme: BookTheme
}
```

### 3.4 Monthly Trends Graph
**File:** `web/components/templates/MonthlyTrends.tsx`

Line/bar charts showing progression:
- Monthly distance bars
- Pace trend line overlay
- Elevation gain secondary axis

**Note:** react-pdf doesn't have native charting. Options:
- A) Pre-render charts as images server-side
- B) Build charts with SVG primitives
- C) Use existing `SplitsChartSVG` pattern

---

## Phase 4: Section Dividers

### 4.1 Monthly Divider
**File:** `web/components/templates/MonthlyDivider.tsx`

Chapter page between months:
- Month name large
- Month stats summary
- Optional hero image from that month
- Decorative styling

**Props:**
```typescript
interface MonthlyDividerProps {
  month: number  // 0-11
  year: number
  stats: {
    activityCount: number
    totalDistance: number
    totalTime: number
  }
  heroImage?: string
  theme: BookTheme
}
```

### 4.2 Activity Type Divider
**File:** `web/components/templates/ActivityTypeDivider.tsx`

For books organized by activity type instead of chronologically:
- "Running", "Cycling", "Swimming" headers
- Type-specific icon
- Aggregate stats for that type

---

## Phase 5: Activity Journal Templates

### 5.1 Activity Log - Compact List
**File:** `web/components/templates/ActivityLog.tsx`

Dense, paginated list of all activities:
- One row per activity
- Date, name, distance, time, pace
- Small route thumbnail
- Paginate automatically (activities per page based on available space)

**Props:**
```typescript
interface ActivityLogProps {
  activities: StravaActivity[]
  pageNumber: number
  activitiesPerPage: number
  showMaps: boolean
  theme: BookTheme
}
```

### 5.2 Activity Log - Journal Style
**File:** `web/components/templates/ActivityJournal.tsx`

More spacious, 2-3 activities per page:
- Larger route map
- Description/notes if available
- Photo if available
- Dynamic layout based on content

### 5.3 Weekly Summary
**File:** `web/components/templates/WeeklySummary.tsx`

For training-focused books:
- Week number and date range
- Daily breakdown
- Weekly totals
- Training load indicators

---

## Phase 6: Highlight Templates

### 6.1 Best Efforts Page
**File:** `web/components/templates/BestEffortsPage.tsx`

Full-page PR showcase:
- Table of PRs (1K, 5K, 10K, Half, Full)
- Date achieved
- Comparison to all-time bests
- Medal/trophy iconography

**Props:**
```typescript
interface BestEffortsPageProps {
  efforts: {
    distance: string  // "5K", "10K", etc.
    time: number
    date: string
    activityId: number
    isAllTimePR: boolean
  }[]
  theme: BookTheme
}
```

### 6.2 Route Heatmap
**File:** `web/components/templates/RouteHeatmap.tsx`

All routes overlaid on single map:
- Aggregate all polylines
- Center on most-frequent location
- Darker where routes overlap
- Stats overlay

**Implementation:**
- Use Mapbox Static API with multiple paths
- Or pre-render server-side as image
- Fall back to SVG composite if no map token

### 6.3 Achievement Showcase
**File:** `web/components/templates/Achievements.tsx`

Highlight specific accomplishments:
- Longest run
- Biggest climb
- Fastest segment
- Streak records

---

## Phase 7: Race Templates (Polish Existing)

### 7.1 Race_1p Improvements
- Add PhotoGrid component for multiple photos
- Better handling of missing data
- Font/color theming support

### 7.2 Race_2p Improvements
- Ensure all modal-selected components render
- Add splits chart to right page
- Better comments integration

### 7.3 Race Multi-Page (New)
**File:** `web/components/templates/RaceMultiPage.tsx`

For major races (marathons, ultras):
- Dynamic page count based on content
- Page 1: Hero + title
- Page 2: Full route map
- Page 3: Splits analysis
- Page 4: Photos + comments

---

## Phase 8: Back Matter

### 8.1 Back Cover
**File:** `web/components/templates/BackCover.tsx`

- Simple closing page
- Final stat summary
- "Created with Strava Book"
- Optional barcode placeholder for print-on-demand

---

## Phase 9: Infrastructure Updates

### 9.1 Update BookDocument.tsx
Add routing for all new page types:
```typescript
switch (entry.type) {
  case 'COVER': return <Cover {...} />
  case 'TABLE_OF_CONTENTS': return <TableOfContents {...} />
  case 'YEAR_AT_A_GLANCE': return <YearCalendar {...} />
  // ... etc
}
```

### 9.2 Update Smart Draft Generator
Enhance `generateSmartDraft()` in curator.ts to:
- Auto-add Year at a Glance
- Auto-add monthly dividers
- Calculate optimal journal pages
- Detect and feature PRs

### 9.3 Add Preview Components
Create HTML/Canvas previews for each template for instant feedback in the builder UI.

---

## Phase 10: AI Theming System

### 10.1 Race Detection & A-Race Selection
**File:** `web/lib/race-detection.ts` (new)

Automatically identify and rank races:
```typescript
interface RaceInfo {
  activity: StravaActivity
  isRace: boolean          // workout_type === 1
  raceType: 'marathon' | 'half' | '10k' | '5k' | 'ultra' | 'other'
  significance: number     // Score based on distance, photos, kudos
  matchedEvent?: KnownRace // If matched to database
}

function detectRaces(activities: StravaActivity[]): RaceInfo[]
function selectARace(races: RaceInfo[]): RaceInfo | null
```

**A-Race Selection Logic:**
1. User explicit selection (highest priority)
2. Longest race distance in period
3. Race with most photos/social engagement
4. Most recent race (fallback)

### 10.2 Race Metadata Enrichment
**File:** `web/lib/race-enrichment.ts` (new)

Match races to known events and fetch assets:
```typescript
interface KnownRace {
  name: string                    // "Boston Marathon"
  aliases: string[]               // ["boston", "baa marathon"]
  colors: { primary: string; accent: string }
  logoUrl?: string
  defaultBackgroundQuery: string  // For stock photo search
  location: { city: string; country: string }
}

// Database of ~50-100 major races to start
const KNOWN_RACES: KnownRace[] = [
  {
    name: "Boston Marathon",
    aliases: ["boston", "baa", "boston marathon"],
    colors: { primary: "#0D2240", accent: "#FFD200" },
    logoUrl: "/assets/race-logos/boston.png",
    defaultBackgroundQuery: "boston marathon finish line",
    location: { city: "Boston", country: "USA" }
  },
  // ... NYC, Chicago, Berlin, London, Tokyo, etc.
]

function matchActivityToKnownRace(activity: StravaActivity): KnownRace | null
function fetchRaceAssets(race: KnownRace): Promise<RaceAssets>
```

### 10.3 Global Theme Generator
**File:** `web/lib/theme-generator.ts` (new)

AI agent that creates book-wide styling:
```typescript
interface ThemeGeneratorInput {
  aRace: RaceInfo | null
  topPhotos: StravaPhoto[]
  yearSummary: YearSummary
  userPreferences?: { style: 'bold' | 'minimal' | 'classic' }
}

async function generateBookTheme(input: ThemeGeneratorInput): Promise<BookTheme>
```

**AI Prompt Structure:**
```
You are an art director for a commemorative photo book.
The user's primary race: {aRace.name} in {aRace.location}
Race colors: {aRace.colors}
User ran {yearSummary.totalDistance}km across {yearSummary.activityCount} activities.

Generate a cohesive theme that:
1. Uses the race's brand colors as primary/accent
2. Selects complementary fonts for heading/body
3. Suggests a background treatment style
4. Ensures high contrast for readability

Output JSON: { primaryColor, accentColor, fontPairing, backgroundStyle }
```

### 10.4 Race Page Theme Agent
**File:** `web/lib/race-page-agent.ts` (new)

AI agent that themes individual race pages:
```typescript
interface RacePageInput {
  activity: StravaActivity
  photos: StravaPhoto[]
  knownRace: KnownRace | null
  globalTheme: BookTheme
}

async function generateRacePageTheme(input: RacePageInput): Promise<RaceTheme>
```

**Responsibilities:**
- Select best hero photo from user's race photos
- Fetch/generate background imagery (race logo, course photo, city imagery)
- Write narrative caption with emotional resonance
- Determine logo placement that doesn't conflict with stats

### 10.5 Theme Preview & Override UI
**File:** `web/components/ThemeEditor.tsx` (new)

Human-in-the-loop interface:
- Preview AI-generated theme
- Override colors, fonts
- Swap A-Race selection
- Accept/reject individual race themes
- Live preview updates

### 10.6 Asset Fallback Chain

When race-specific assets aren't available:
```
1. Known race database → official logo & colors
2. Location-based search → city skyline, landmarks
3. User's own photos → best activity photo as background
4. Polyline art → abstract pattern from route shape
5. Solid color → theme's primary color with gradient
```

---

## Implementation Priority Order

**Tier 1 - Core Book Structure (Do First):**
1. Foundation types (1.1, 1.2, 1.3) - includes BookFormat & BookTheme types
2. Cover (2.1) - with format scaling support
3. Year Calendar (3.1)
4. Monthly Divider (4.1)
5. Activity Log (5.1)
6. Back Cover (8.1)
7. BookDocument routing (9.1)

**Tier 2 - AI Theming Foundation:**
8. Race Detection (10.1) - identify races and A-Race
9. Known Race Database (10.2) - major marathons with colors/logos
10. Global Theme Generator (10.3) - AI-driven color/font selection

**Tier 3 - Enhanced Content:**
11. Year Stats (3.3)
12. Best Efforts Page (6.1)
13. Foreword (2.2)
14. Table of Contents (2.3)

**Tier 4 - AI Personalization:**
15. Race Page Theme Agent (10.4)
16. Theme Preview UI (10.5)
17. Race improvements with theming (7.x)

**Tier 5 - Visual Polish:**
18. Route Heatmap (6.2)
19. Monthly Trends (3.4)
20. Achievement Showcase (6.3)

**Tier 6 - Advanced Features:**
21. Activity Journal style (5.2)
22. Weekly Summary (5.3)
23. Multi-page races (7.3)

---

## Agent Work Packages

Each package is independently implementable:

### Package A: Foundation + Types (CRITICAL - Do First)
- 1.1 Extend BookPageType enum
- 1.2 Create book-types.ts (BookFormat, BookTheme, RaceTheme, etc.)
- 1.3 Implement format scaling utilities
- 9.1 Update BookDocument.tsx routing

**Deliverables:** All templates can receive `format` and `theme` props

### Package B: Front/Back Matter
- 2.1 Cover (enhanced) - with format scaling, theme colors, A-Race background
- 2.2 Foreword - AI-written or user text
- 8.1 Back Cover - final stats, branding

**Dependencies:** Package A (types)

### Package C: Year Overview
- 3.1 Year Calendar (heatmap style)
- 3.2 Year Streak (optional)
- 3.3 Year Stats (hero numbers page)

**Dependencies:** Package A (types)

### Package D: Journal System
- 5.1 Activity Log (compact list)
- 5.2 Activity Journal (spacious)
- 4.1 Monthly Divider

**Dependencies:** Package A (types)

### Package E: Highlights
- 6.1 Best Efforts Page
- 6.2 Route Heatmap
- 6.3 Achievement Showcase

**Dependencies:** Package A (types)

### Package F: Race Polish
- 7.1 Race_1p improvements (theming support)
- 7.2 Race_2p improvements (theming support)
- 7.3 Race Multi-Page (new)

**Dependencies:** Package A (types), Package H (race theming)

### Package G: Navigation
- 2.3 Table of Contents
- 9.2 Smart Draft Generator (auto-add pages, detect A-Race)

**Dependencies:** Package A (types)

### Package H: AI Theming Infrastructure (NEW)
- 10.1 Race Detection & A-Race Selection
- 10.2 Known Race Database (50-100 major races)
- 10.3 Global Theme Generator (Gemini integration)

**Deliverables:**
- `detectRaces()` and `selectARace()` functions
- KNOWN_RACES database with colors/logos for major events
- `generateBookTheme()` AI function

### Package I: Race-Specific Theming (NEW)
- 10.4 Race Page Theme Agent
- 10.5 Theme Preview & Override UI
- 10.6 Asset fallback chain implementation

**Dependencies:** Package H (theme infrastructure)
**Deliverables:**
- Per-race theme generation with logo/background selection
- ThemeEditor React component for human-in-the-loop

### Package J: Format Flexibility Testing (NEW)
- Test all templates at 8×8, 10×10, 12×12 sizes
- Verify text legibility at smallest size
- Check bleed/trim zones render correctly
- Generate sample PDFs for print preview

**Dependencies:** All template packages

---

## Testing Strategy

For each template:
1. Create with mock data first
2. Test with real Strava data
3. Verify PDF renders correctly
4. **Test at all three sizes** (8×8, 10×10, 12×12)
5. Check print preview at actual size
6. Test edge cases (missing photos, long text, etc.)
7. Verify theme colors apply correctly

**Format-specific testing:**
- 8×8: Ensure text remains legible (min 10pt body)
- 10×10: Base design should look balanced
- 12×12: Verify images don't appear pixelated

---

## Notes for Agents

### General Patterns
1. **Always use existing patterns** - Look at Race_1p.tsx and Race_2pLeft.tsx for styling patterns
2. **Reuse components** - StatsGrid, Header, etc. should be used where appropriate
3. **Handle missing data** - Every field might be null/undefined
4. **Use proxy for images** - Always route external images through `/api/proxy-image`
5. **No executable code from AI** - JSON config only per PRD security requirements

### Format Scaling (IMPORTANT)
6. **All templates must accept `format: BookFormat` prop**
7. **Use `format.scaleFactor`** for font sizes: `fontSize: 24 * format.scaleFactor`
8. **Use percentage widths** for layout: `width: '48%'` not `width: 300`
9. **Respect safe margins**: `padding: format.safeMargin`
10. **Set floor for body text**: `fontSize: Math.max(10, 12 * format.scaleFactor)`

### AI Theming (IMPORTANT)
11. **All templates must accept `theme: BookTheme` prop**
12. **Use theme colors**: `color: theme.primaryColor`, `backgroundColor: theme.accentColor`
13. **Fonts from theme**: Templates should use `theme.fontPairing.heading` and `.body`
14. **Race pages get additional `raceTheme?: RaceTheme` prop** for per-race customization
15. **Fallback gracefully** if theme/raceTheme is undefined (use sensible defaults)

### Example Template Signature
```typescript
interface MyTemplateProps {
  // Data
  activity?: StravaActivity
  // Format (required for all templates)
  format: BookFormat
  // Theming (required for all templates)
  theme: BookTheme
  raceTheme?: RaceTheme  // Only for race pages
}
```
