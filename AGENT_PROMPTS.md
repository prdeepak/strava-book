# Agent Prompts for Overnight Execution

These prompts are designed to be run sequentially or in parallel via Claude Code agents.

**Execution Order:**
1. **Package A** (Foundation) - MUST run first, others depend on it
2. **Packages B, C, D, H** - Can run in parallel after A completes
3. **Package G** - Run after A completes

---

## Package A: Foundation + Types (CRITICAL - Run First)

**Estimated tokens:** ~30K
**Model recommendation:** sonnet (needs precision for types)

```
You are implementing the foundation types and routing for the Strava Book project.

## Context
Read these files first to understand existing patterns:
- /home/user/strava-book/TEMPLATE_PLAN.md (full plan, focus on Phase 1)
- /home/user/strava-book/web/lib/curator.ts (existing BookPageType)
- /home/user/strava-book/web/lib/strava.ts (StravaActivity type)
- /home/user/strava-book/web/components/templates/BookDocument.tsx (current routing)

## Tasks

### 1. Extend BookPageType in curator.ts
Add these page types to the existing enum:
- TABLE_OF_CONTENTS
- FOREWORD
- YEAR_AT_A_GLANCE
- YEAR_STATS
- MONTHLY_DIVIDER
- ACTIVITY_LOG
- BEST_EFFORTS
- ROUTE_HEATMAP
- BACK_COVER

Update BookEntry interface to support new types with their data needs.

### 2. Create web/lib/book-types.ts
Implement exactly as specified in TEMPLATE_PLAN.md section 1.2:
- BookFormat interface with FORMATS constant
- BookConfig interface
- BookTheme interface
- RaceTheme interface
- YearSummary interface
- MonthlyStats interface
- Export all types

### 3. Create web/lib/format-utils.ts
Implement helper functions:
- getFormat(size: '8x8' | '10x10' | '12x12'): BookFormat
- scaledFontSize(baseSize: number, format: BookFormat, minSize?: number): number
- createScaledStyles(format: BookFormat): helper for StyleSheet.create patterns

### 4. Update BookDocument.tsx
Add switch/case routing for all new page types. For now, render placeholder pages that show the page type name - actual templates will be implemented by other agents.

## Deliverables
- Modified: web/lib/curator.ts
- New: web/lib/book-types.ts
- New: web/lib/format-utils.ts
- Modified: web/components/templates/BookDocument.tsx

## Validation
Run `cd /home/user/strava-book/web && npm run build` to ensure no TypeScript errors.

Commit your changes with message: "Add foundation types for book format, theming, and page routing"
```

---

## Package B: Front/Back Matter

**Estimated tokens:** ~55K
**Model recommendation:** sonnet
**Dependencies:** Package A must complete first

```
You are implementing the Cover, Foreword, and Back Cover templates for the Strava Book project.

## Context
Read these files first:
- /home/user/strava-book/TEMPLATE_PLAN.md (focus on sections 2.1, 2.2, 8.1)
- /home/user/strava-book/web/lib/book-types.ts (BookFormat, BookTheme types)
- /home/user/strava-book/web/lib/format-utils.ts (scaling utilities)
- /home/user/strava-book/web/components/templates/Race_2pLeft.tsx (example of full-bleed image page)

## Tasks

### 1. Create web/components/templates/Cover.tsx
Full-bleed cover page with:
- Background image (A-Race photo or gradient fallback)
- Title with theme heading font
- Year prominently displayed
- Athlete name
- Uses format scaling for all dimensions
- Respects safe margins for text

Props: { title, subtitle?, year, athleteName, backgroundImage?, format, theme }

### 2. Create web/components/templates/Foreword.tsx
Elegant text page with:
- Optional title ("Dedication", "About This Year", etc.)
- Body text with nice typography
- Optional author attribution
- Decorative styling that respects theme colors
- Format scaling

Props: { title?, body, author?, format, theme }

### 3. Create web/components/templates/BackCover.tsx
Simple closing page with:
- Final year stats summary (total distance, activities, etc.)
- "Created with Strava Book" branding
- Theme-consistent styling
- Optional barcode placeholder area

Props: { yearSummary, format, theme }

## Patterns to Follow
- Use `@react-pdf/renderer` components (Page, View, Text, Image, StyleSheet)
- Route images through `/api/proxy-image?url=...`
- Use format.scaleFactor for font sizes
- Use theme.primaryColor, theme.accentColor for colors
- Handle missing data gracefully (check for undefined)

## Validation
Run `cd /home/user/strava-book/web && npm run build` to ensure no TypeScript errors.

Commit with message: "Add Cover, Foreword, and BackCover templates with format/theme support"
```

---

## Package C: Year Overview (Calendar)

**Estimated tokens:** ~70K
**Model recommendation:** sonnet (complex SVG work)
**Dependencies:** Package A must complete first

```
You are implementing the Year Calendar (heatmap) template for the Strava Book project.

## Context
Read these files first:
- /home/user/strava-book/TEMPLATE_PLAN.md (focus on section 3.1)
- /home/user/strava-book/web/lib/book-types.ts (BookFormat, BookTheme, YearSummary)
- /home/user/strava-book/web/lib/strava.ts (StravaActivity type)
- /home/user/strava-book/web/components/templates/Race_1p.tsx (example of SVG usage in react-pdf)

## Tasks

### 1. Create web/components/templates/YearCalendar.tsx
GitHub contribution-style heatmap showing activity across the year:

Layout:
- 12-month grid (can be 4x3 or 6x2 arrangement)
- Each month shows days as small squares
- Color intensity based on distance/time that day
- Legend showing color scale
- Year title and summary stats

Technical approach:
- Use react-pdf's <Svg>, <Rect>, <Text> for the grid
- Calculate cell size based on format dimensions
- Use theme colors for the heatmap gradient
- Group by week columns within each month

Props interface:
```typescript
interface YearCalendarProps {
  year: number
  activities: StravaActivity[]
  colorBy: 'distance' | 'time' | 'count'
  format: BookFormat
  theme: BookTheme
}
```

Helper functions needed:
- groupActivitiesByDay(activities): Map<string, StravaActivity[]>
- getColorIntensity(value: number, max: number, theme: BookTheme): string
- generateMonthGrid(year: number, month: number): DayCell[][]

### 2. Create web/components/templates/YearStats.tsx
Magazine-style stats page with big hero numbers:
- Total distance (large, prominent)
- Total time
- Total elevation
- Activity count
- Comparison callouts if previous year data available

Props: { yearSummary, previousYearSummary?, format, theme }

## Validation
Run `cd /home/user/strava-book/web && npm run build` to ensure no TypeScript errors.

Commit with message: "Add YearCalendar heatmap and YearStats templates"
```

---

## Package D: Journal System

**Estimated tokens:** ~60K
**Model recommendation:** sonnet
**Dependencies:** Package A must complete first

```
You are implementing the Activity Log and Monthly Divider templates for the Strava Book project.

## Context
Read these files first:
- /home/user/strava-book/TEMPLATE_PLAN.md (focus on sections 4.1, 5.1)
- /home/user/strava-book/web/lib/book-types.ts (types)
- /home/user/strava-book/web/lib/strava.ts (StravaActivity)
- /home/user/strava-book/web/components/pdf/StatsGrid.tsx (reusable component pattern)

## Tasks

### 1. Create web/components/templates/MonthlyDivider.tsx
Chapter page between months:
- Month name large and prominent
- Month stats summary (activities, distance, time)
- Optional hero image from that month
- Theme-consistent decorative styling

Props:
```typescript
interface MonthlyDividerProps {
  month: number  // 0-11
  year: number
  stats: {
    activityCount: number
    totalDistance: number
    totalTime: number
    totalElevation: number
  }
  heroImage?: string
  format: BookFormat
  theme: BookTheme
}
```

### 2. Create web/components/templates/ActivityLog.tsx
Dense, paginated list of activities:
- One row per activity
- Columns: Date, Name, Distance, Time, Pace
- Small route thumbnail (SVG polyline, not map image to save API calls)
- Calculate activities per page based on format size
- Clean, scannable layout

Props:
```typescript
interface ActivityLogProps {
  activities: StravaActivity[]
  startIndex: number  // For pagination
  activitiesPerPage: number
  showMiniMaps: boolean
  format: BookFormat
  theme: BookTheme
}
```

### 3. Create web/lib/activity-log-utils.ts
Helper functions:
- calculateActivitiesPerPage(format: BookFormat): number
- formatPace(movingTime: number, distance: number, units: 'metric' | 'imperial'): string
- renderMiniPolyline(polyline: string, width: number, height: number): SVG element

## Patterns
- Use flex layouts for the log rows
- Alternate row background colors for readability
- Truncate long activity names with ellipsis
- Handle activities without polylines gracefully

## Validation
Run `cd /home/user/strava-book/web && npm run build` to ensure no TypeScript errors.

Commit with message: "Add MonthlyDivider and ActivityLog templates for journal sections"
```

---

## Package G: Navigation

**Estimated tokens:** ~45K
**Model recommendation:** haiku (simpler logic)
**Dependencies:** Package A must complete first

```
You are implementing the Table of Contents and enhancing the Smart Draft Generator for the Strava Book project.

## Context
Read these files first:
- /home/user/strava-book/TEMPLATE_PLAN.md (focus on sections 2.3, 9.2)
- /home/user/strava-book/web/lib/curator.ts (existing generateSmartDraft)
- /home/user/strava-book/web/lib/book-types.ts (types)
- /home/user/strava-book/web/lib/strava.ts (StravaActivity)

## Tasks

### 1. Create web/components/templates/TableOfContents.tsx
Auto-generated TOC page:
- List of sections with page numbers
- Group by category (Overview, Races, Journal, etc.)
- Clean typography with dot leaders to page numbers
- Theme-consistent styling

Props:
```typescript
interface TOCEntry {
  title: string
  pageNumber: number
  type: BookPageType
  indent?: number  // For sub-entries
}

interface TableOfContentsProps {
  entries: TOCEntry[]
  format: BookFormat
  theme: BookTheme
}
```

### 2. Enhance generateSmartDraft() in curator.ts
Update the function to create a more complete book structure:

```typescript
function generateSmartDraft(
  activities: StravaActivity[],
  options?: {
    year?: number
    includeJournal?: boolean
    includeMonthlyDividers?: boolean
  }
): BookEntry[]
```

New logic:
1. Add COVER as first page
2. Add TABLE_OF_CONTENTS
3. Add YEAR_AT_A_GLANCE
4. For each month with activities:
   - Add MONTHLY_DIVIDER
   - Add RACE_PAGE entries for races in that month
5. Add ACTIVITY_LOG pages (calculate based on activity count)
6. Add BEST_EFFORTS if any PRs exist
7. Add BACK_COVER

### 3. Add race detection helper
Create function to identify races:
```typescript
function detectRaces(activities: StravaActivity[]): StravaActivity[] {
  return activities.filter(a => a.workout_type === 1)
}

function findARace(activities: StravaActivity[]): StravaActivity | undefined {
  const races = detectRaces(activities)
  // Return longest race, or most recent if tied
  return races.sort((a, b) => b.distance - a.distance)[0]
}
```

## Validation
Run `cd /home/user/strava-book/web && npm run build` to ensure no TypeScript errors.

Commit with message: "Add TableOfContents template and enhance Smart Draft generation"
```

---

## Package H: AI Theming Infrastructure

**Estimated tokens:** ~55K
**Model recommendation:** sonnet
**Dependencies:** Package A must complete first

```
You are implementing the AI theming infrastructure for the Strava Book project.

## Context
Read these files first:
- /home/user/strava-book/TEMPLATE_PLAN.md (focus on Phase 10)
- /home/user/strava-book/strava-book PRD.txt (Section 8 for theming vision)
- /home/user/strava-book/web/lib/book-types.ts (BookTheme, RaceTheme)
- /home/user/strava-book/web/lib/strava.ts (StravaActivity)
- /home/user/strava-book/web/app/api/ai-generate/route.ts (existing Gemini integration pattern)

## Tasks

### 1. Create web/lib/race-detection.ts
```typescript
interface RaceInfo {
  activity: StravaActivity
  isRace: boolean
  raceType: 'marathon' | 'half' | '10k' | '5k' | 'ultra' | 'trail' | 'other'
  significance: number  // Higher = more important
}

function detectRaces(activities: StravaActivity[]): RaceInfo[]
function classifyRaceType(distance: number): RaceInfo['raceType']
function calculateSignificance(activity: StravaActivity): number
function selectARace(races: RaceInfo[]): RaceInfo | null
```

### 2. Create web/lib/known-races.ts
Database of major races with brand info:
```typescript
interface KnownRace {
  name: string
  aliases: string[]
  colors: { primary: string; accent: string }
  logoUrl?: string
  location: { city: string; country: string }
}

const KNOWN_RACES: KnownRace[] = [
  // Include at least 30 major races:
  // - World Marathon Majors (Boston, NYC, Chicago, Berlin, London, Tokyo)
  // - Major US races (LA Marathon, Marine Corps, Philly, etc.)
  // - Major trail races (Western States, UTMB, Leadville)
  // - Major triathlons (Ironman branded events)
]

function matchActivityToKnownRace(activity: StravaActivity): KnownRace | null
```

### 3. Create web/lib/theme-generator.ts
AI-powered theme generation:
```typescript
interface ThemeGeneratorInput {
  aRace: RaceInfo | null
  knownRace: KnownRace | null
  yearSummary: YearSummary
  userPreferences?: { style: 'bold' | 'minimal' | 'classic' }
}

async function generateBookTheme(input: ThemeGeneratorInput): Promise<BookTheme>
function getDefaultTheme(): BookTheme  // Fallback if AI fails
```

For the AI integration:
- Use existing GEMINI_API_KEY from env
- Create a focused prompt that outputs JSON
- Parse and validate the response
- Fall back to defaults if AI fails

### 4. Create web/lib/theme-defaults.ts
Default themes for fallback:
```typescript
const DEFAULT_THEMES = {
  running: { primaryColor: '#FC4C02', accentColor: '#000000', ... },
  cycling: { primaryColor: '#1A1A1A', accentColor: '#FFD700', ... },
  triathlon: { primaryColor: '#0066CC', accentColor: '#FF6600', ... },
}
```

## Validation
Run `cd /home/user/strava-book/web && npm run build` to ensure no TypeScript errors.

Commit with message: "Add AI theming infrastructure with race detection and known races database"
```

---

## Execution Script

To run these overnight, you could use a script like:

```bash
#!/bin/bash
# Run Package A first (required by all others)
claude --print "$(cat AGENT_PROMPTS.md | sed -n '/## Package A:/,/^---$/p')"

# Wait for A to complete, then run B, C, D, H in parallel
claude --print "$(cat AGENT_PROMPTS.md | sed -n '/## Package B:/,/^---$/p')" &
claude --print "$(cat AGENT_PROMPTS.md | sed -n '/## Package C:/,/^---$/p')" &
claude --print "$(cat AGENT_PROMPTS.md | sed -n '/## Package D:/,/^---$/p')" &
claude --print "$(cat AGENT_PROMPTS.md | sed -n '/## Package H:/,/^---$/p')" &
wait

# Run G last
claude --print "$(cat AGENT_PROMPTS.md | sed -n '/## Package G:/,/^---$/p')"
```

---

## Total Estimated Cost

| Package | Tokens | Model | Est. Cost |
|---------|--------|-------|-----------|
| A | ~30K | sonnet | ~$1.00 |
| B | ~55K | sonnet | ~$1.80 |
| C | ~70K | sonnet | ~$2.30 |
| D | ~60K | sonnet | ~$2.00 |
| G | ~45K | haiku | ~$0.50 |
| H | ~55K | sonnet | ~$1.80 |
| **Total** | **~315K** | - | **~$9-10** |

*Estimates assume successful execution without major iteration.*
