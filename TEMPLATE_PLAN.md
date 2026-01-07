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
interface BookConfig {
  title: string
  subtitle?: string
  year: number
  dateRange: { start: Date; end: Date }
  athlete: { name: string; profileUrl?: string }
  theme: 'minimal' | 'bold' | 'classic'
  units: 'metric' | 'imperial'
}

interface YearSummary {
  totalDistance: number
  totalTime: number
  totalElevation: number
  activityCount: number
  longestActivity: StravaActivity
  fastestActivity: StravaActivity
  activeDays: Set<string>  // ISO date strings
  monthlyStats: MonthlyStats[]
}
```

### 1.3 Page Size Decision
**Decision needed:** The PRD mentions "Shift format to square?"

Options:
- A) Keep LETTER (8.5x11") - standard, easy printing
- B) Square (8x8" or 10x10") - more "coffee table" aesthetic
- C) Support both via config

**Recommendation:** Start with LETTER, add square as option later.

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

## Implementation Priority Order

**Tier 1 - Core Book Structure (Do First):**
1. Foundation types (1.1, 1.2)
2. Cover (2.1)
3. Year Calendar (3.1)
4. Monthly Divider (4.1)
5. Activity Log (5.1)
6. Back Cover (8.1)
7. BookDocument routing (9.1)

**Tier 2 - Enhanced Content:**
8. Year Stats (3.3)
9. Best Efforts Page (6.1)
10. Foreword (2.2)
11. Table of Contents (2.3)

**Tier 3 - Visual Polish:**
12. Route Heatmap (6.2)
13. Monthly Trends (3.4)
14. Race improvements (7.x)
15. Achievement Showcase (6.3)

**Tier 4 - Advanced Features:**
16. Activity Journal style (5.2)
17. Weekly Summary (5.3)
18. Multi-page races (7.3)

---

## Agent Work Packages

Each package is independently implementable:

### Package A: Foundation + Types
- 1.1 Extend BookPageType
- 1.2 Create book-types.ts
- 9.1 Update BookDocument.tsx routing

### Package B: Front/Back Matter
- 2.1 Cover (enhanced)
- 2.2 Foreword
- 8.1 Back Cover

### Package C: Year Overview
- 3.1 Year Calendar
- 3.2 Year Streak (optional)
- 3.3 Year Stats

### Package D: Journal System
- 5.1 Activity Log
- 5.2 Activity Journal
- 4.1 Monthly Divider

### Package E: Highlights
- 6.1 Best Efforts Page
- 6.2 Route Heatmap
- 6.3 Achievement Showcase

### Package F: Race Polish
- 7.1 Race_1p improvements
- 7.2 Race_2p improvements
- 7.3 Race Multi-Page

### Package G: Navigation
- 2.3 Table of Contents
- 9.2 Smart Draft Generator

---

## Testing Strategy

For each template:
1. Create with mock data first
2. Test with real Strava data
3. Verify PDF renders correctly
4. Check print preview at actual size
5. Test edge cases (missing photos, long text, etc.)

---

## Notes for Agents

1. **Always use existing patterns** - Look at Race_1p.tsx and Race_2pLeft.tsx for styling patterns
2. **Reuse components** - StatsGrid, Header, etc. should be used where appropriate
3. **Handle missing data** - Every field might be null/undefined
4. **Use proxy for images** - Always route external images through `/api/proxy-image`
5. **Font considerations** - Stick to registered fonts (Helvetica family for now)
6. **No executable code from AI** - JSON config only per PRD security requirements
