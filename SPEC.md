# Strava Book Technical Specification

**Version:** 1.3
**Status:** In Development
**Updated:** 2025-01-08
**Goal:** Define project well enough for parallel autonomous agent development

---

## 1. Project Summary

Generate print-ready PDF "yearbooks" from Strava activity data. The book auto-scales based on user data: more races = more race pages, more activities = longer journal section.

### MVP Scope
1. **Core templates** working end-to-end with consistent theming
2. **Test infrastructure** with LLM-as-judge for visual quality
3. **Foundation** for AI theming (style guide generation)

### Non-Goals (Phase 2+)
- Full Art Director workflow with narrative generation
- Print-on-demand integration
- Real-time browser preview (HTML canvas)

### Design Reference: TrainingSparkle

Analysis of `outputs/TrainingSparkle book (shrunk).pdf` reveals key design patterns to emulate:

**Visual Hierarchy:**
- Bold, oversized typography for stats (100pt+ for hero numbers)
- Strong contrast between headings and body text
- Generous whitespace creating premium feel

**Photo Treatment:**
- Full-bleed hero photos on race spreads
- Photo grids for activity logs (3-4 photos per page max)
- Subtle drop shadows on floating photos
- Photos drive the visual interest; text supports

**Color & Branding:**
- Consistent accent color (orange) throughout
- Dark backgrounds for dramatic race pages
- Light backgrounds for activity logs (readability)
- Color used sparingly but intentionally

**Layout Patterns:**
- Race spreads: Left page = hero photo + title; Right page = stats + map
- Activity logs: Card-based layout, 4-6 activities per page
- Monthly dividers: Large month name, summary stats, optional hero photo
- Stats always use monospace/tabular figures for alignment

**Typography:**
- Sans-serif for headings (bold, condensed)
- Readable serif or sans for body text
- Monospace for numbers/stats/times

---

## 2. Book Structure

A book is a sequence of **BookEntry** items rendered by `BookDocument.tsx`. The structure adapts to available data.

### Page Types

| Type | Template | When Generated |
|------|----------|----------------|
| **Cover** | `Cover.tsx` | Always (1 page) |
| **Foreword** | `Foreword.tsx` | If user provides text (optional) |
| **Table of Contents** | `TableOfContents.tsx` | Always (1-2 pages) |
| **Year Summary** | `YearStats.tsx` | Variable pages |
| **Year Calendar** | `YearCalendar.tsx` | Always (1 page, GitHub-style heatmap) |
| **Monthly Divider** | `MonthlyDivider.tsx` | Per active month (1 page each) |
| **Race Section** | `RaceSection.tsx` | Per race activity (variable pages) |
| **Activity Log** | `ActivityLog.tsx` | Paginated journal (variable pages) |
| **Back Cover** | `BackCover.tsx` | Always (1 page) |

### Page Count Formula (Estimated)
```
pages = 4 (fixed: cover, TOC, calendar, back cover)
      + year_stats (variable pages)
      + active_months * 2 (dividers, with blank left page)
      + races * 3 (avg, some 2p some 4p)
      + ceil(activities / 15) (activity log, ~15 per page)
```

### Data-Driven Decisions
- **Race detection:** `workout_type === 1`
- **2-page vs 4-page race:** 4-page if: has (sufficient) photos, text, comments
- **Activity log inclusion:** All activities, grouped by month

---

## 3. Template Specifications

### 3.1 Design System Foundation

All templates share:

```typescript
interface BookTheme {
  primaryColor: string      // Main accent color
  secondaryColor: string    // Supporting color
  backgroundColor: string   // Page background
  textColor: string         // Primary text
  textMuted: string         // Secondary text
  fontHeading: string       // Heading font family
  fontBody: string          // Body font family
  fontMono: string          // Stats/numbers font
}

interface BookFormat {
  size: '8x8' | '10x10'
  dimensions: { width: number; height: number }
  bleed: number
  safeMargin: number
  scaleFactor: number
}
```

### 3.2 Template Requirements

Each template must:
1. Accept `format: BookFormat` and `theme: BookTheme` props
2. Handle missing data gracefully (no crashes on null photos, splits, etc.)
3. Scale typography using `format.scaleFactor`
4. Respect `safeMargin` for print bleed safety
5. Export a **fixture generator** for testing

### 3.3 Template-Specific Specs

#### Cover (`Cover.tsx`)
- Hero layout with year prominently displayed
- Optional background image (user's best photo or default)
- Title, subtitle, athlete name
- **Test cases:** With/without background image, long titles

#### YearStats (`YearStats.tsx`)
- Large hero stats: total distance, time, elevation
- Secondary stats grid: activities count, active days, averages; total kudos, total comments
- Graph(s) of distance / time / elevation over the year
- Strava "best efforts" for the period (for example layout, see race_1p.tsx Best Efforts section)
- **Test cases:** High volume athlete, low volume, zero elevation, no maps

#### YearMap (`YearMap.tsx`) — Phase 2
- Hero heatmap of the year's routes
- Color intensity = activity volume (count)
- Legend with scale
- If activities in many locations, then global / regional map (including all locations) with stars or bubbles for each location with activities
- For each location with a bubble, show a blow-up of the city / region, with a heatmap of the year's routes
- **Test cases:** Full year, partial year, streak patterns; some or all activities with no location
- **Note:** Deferred to Phase 2 due to complexity of multi-location rendering

#### YearCalendar (`YearCalendar.tsx`)
- 52-week grid, or 12-month grid, or both
- Consider using graphics / style of /outputs/Strava streaks.png or /outputs/Strava training log.png
- Legend with scale
- **Test cases:** Full year, partial year, streak patterns

#### Race_2p (`Race_2p.tsx`)
- Left page: Hero photo, title, key stats
- Right page: Map, detailed splits, best efforts
- See "race_1p.tsx" for the key elements to include: splits; kudos; comments; photos; best efforts
- **Test cases:** Marathon with full data, race with minimal data

#### Race_1p (`Race_1p.tsx`)
- Multi-page spread
- Consider what we can learn from /outputs/TrainingSparkle.pdf file; see race_1p.tsx for some key elements to include, if they exist
- **Test cases:** With/without photos, with/without GPS

#### ActivityLog (`ActivityLog.tsx`)
- Consider what we can learn from /outputs/trainingsparkle.pdf file. 
- If available in dataset, include description / summary text (highly valuable)map, all photos; add kudos, comments; best efforts if any in top-3
- For run or bike "workouts", include splits graph and/or detailed splits
- Auto-paginates
- Any ideas to keep these fresh and not robotic / repetitive? E.g., small variations in layout; and/or add logos or other graphics to break up the text?  AI-generated callouts?
- **Test cases:** 50, 100, 200 activities

#### MonthlyDivider (`MonthlyDivider.tsx`)
- Month name large, year
- Summary stats for the month -- see year pages for some ideas
- Highlight any races or best-efforts workouts
- Consider quoting any particularly notable or interesting activity descriptions and/or comments from activities?
- Optional hero background
- How to make these dynamic and not seem repetitive / like a template? (But still consistent)
- **Test cases:** Busy month, quiet month

---

## 4. Test Infrastructure ✅ COMPLETE

### 4.1 Quick Reference

```bash
# List available templates and fixtures
make test-list

# Test a specific template with a fixture
make test-template template=Race_1p fixture=race_marathon

# Generate PDF only (no LLM evaluation)
make test-pdf template=Race_1p fixture=race_marathon

# Run all visual tests
make test-visual
```

**Output Location:**
- PDFs: `test-output/<template>-<fixture>.pdf`
- Images: `test-output/<template>-<fixture>-*.png`
- Report: `test-output/report.md`

### 4.2 LLM-as-Judge Visual Testing ✅

**Status:** Implemented in `web/lib/testing/visual-judge.ts`
**Provider:** Gemini 2.0 Flash (with Bedrock/Anthropic fallback if configured)

**Purpose:** Autonomous agents can iterate on templates and get feedback without human review.

```typescript
interface VisualJudgment {
  pass: boolean
  overallScore: number  // 0-100
  criteria: {
    printReadability: CriterionScore
    layoutBalance: CriterionScore
    brandCohesion: CriterionScore
  }
  summary: string
  suggestions: string[]  // Actionable improvements
}
```

**Evaluation Criteria:**

1. **Print Readability (33%)**
   - Body text >= 10pt at final print size
   - Sufficient contrast (WCAG AA minimum)
   - Critical content within safe margins
   - No text overlapping images unintentionally

2. **Layout Balance (33%)**
   - Visual weight distributed (not all content in one corner)
   - Appropriate whitespace (not cramped, not empty)
   - Consistent alignment (grid adherence)
   - Photos/images properly sized and positioned

3. **Brand Cohesion (33%)**
   - Colors match theme palette
   - Fonts used consistently per role (heading/body/mono)
   - Spacing rhythm consistent with other pages
   - Visual style matches template intent

**Passing Threshold:** Overall score >= 70, no single criterion below 50

### 4.3 Test Fixtures ✅

**Location:** `web/lib/testing/fixtures/`
**Source:** Real data from Strava API (303 activities, 2024-07-01 to 2025-06-15)

**Available Fixtures (16 total):**

| Category | Fixture Name | Description |
|----------|--------------|-------------|
| **Races** | `race_ultramarathon` | Comrades 2025 (91km, 5 photos, 16 comments) |
| | `race_marathon` | Toronto Marathon (42km) |
| | `race_half_marathon` | Around the Bay 30km |
| **Training** | `training_long_run` | Comrades pace dry run (35km, 4 photos) |
| | `training_tempo` | 5km steady run (2 photos) |
| | `training_easy` | Gentle 5k by the Tiber (3 photos, 5 comments) |
| **Other** | `other_workout` | Strength workout (2 comments) |
| | `other_swim` | Morning swim |
| | `other_ride` | Sprint tri bike segment |
| | `other_walk` | Anniversary hike (5 photos) |
| | `other_hike` | Wandering through Rome (8 photos) |
| **Edge Cases** | `edge_no_gps` | Run without GPS data |
| | `edge_very_long` | Comrades ultra (11+ hours) |
| | `edge_very_short` | 15-minute mobility session |
| | `edge_high_elevation` | High elevation gain activity |
| **Rich Content** | `rich_full_content` | Activity with photos, comments, description |

**Year Fixtures:** (Phase 2 — requires aggregating activity fixtures)
```typescript
export const yearFixtures = {
  activeYear: { /* 300+ activities, multiple races */ },
  casualYear: { /* 50 activities, 1 race */ },
  marathonFocus: { /* training block + marathon */ },
}
```

### 4.4 Agent Iteration Loop

See `AGENT_INSTRUCTIONS.md` for detailed agent workflow. Summary:

1. **Make changes** to template in `web/components/templates/`
2. **Test:** `make test-template template=<Name> fixture=<name>`
3. **Read feedback** from stdout or `test-output/report.md`
4. **If FAIL** (score < 70 or criterion < 50): Fix issues, repeat
5. **If PASS:** Move to next fixture or template

---

## 5. Data Layer

### 5.1 Mock Server (Development)

**Purpose:** Decouple template development from Strava API

```typescript
// web/lib/testing/mock-strava-server.ts

class MockStravaServer {
  // Returns fixture data based on request
  getActivities(options: { year?: number }): Activity[]
  getActivity(id: string): DetailedActivity
  getActivityStreams(id: string): Streams
  getActivityPhotos(id: string): Photo[]
}
```

**Toggle:** `USE_MOCK_STRAVA=true` in `.env.local`

### 5.2 Data Flow

```
Strava API (or Mock)
       ↓
/api/comprehensive-activity-data
       ↓
BookDocument.tsx (computes entries)
       ↓
Individual Templates (render pages)
       ↓
@react-pdf/renderer
       ↓
PDF Binary
```

**Note:** User input mocking (theme selection, activity curation) deferred to Phase 2. Current test infrastructure uses fixtures with hardcoded themes.

---

## 6. AI Theming Foundation

### 6.1 Phase 1: Style Guide Generation

**Input:** User's activities, photos, detected races
**Output:** `BookTheme` object

```typescript
interface StyleGuideRequest {
  aRace?: Activity           // Primary "goal" race
  topPhotos: Photo[]         // Best photos by engagement
  activityTypes: string[]    // Running, cycling, etc.
  userPreference?: 'minimal' | 'bold' | 'classic'
}

interface StyleGuideResponse {
  theme: BookTheme
  reasoning: string          // Why these choices
  alternates: BookTheme[]    // 2-3 alternatives
}
```

**Implementation:** Call LLM with activity context, ask for color palette and font pairing.

**AI Provider Status:**
- **Gemini 2.0 Flash:** ✅ Configured and working (`GEMINI_API_KEY` in `.env.local`)
- **AWS Bedrock (Sonnet):** Available if AWS credentials configured
- **Anthropic API:** Available if `ANTHROPIC_API_KEY` configured

Visual judge uses auto-fallback: tries configured providers in order until one succeeds.

### 6.2 Phase 2: Full Art Director (Future)
- Race-specific theming (Boston = blue/yellow)
- Narrative generation for race pages
- Photo selection and cropping recommendations
- Layout variant selection

---

## 7. Agent Work Breakdown

### Work Streams Status

```
┌─────────────────────────────────────────────────────────────────┐
│                     PARALLEL WORK STREAMS                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Stream A      │    Stream B     │        Stream C             │
│   Templates     │    Testing      │        Data/AI              │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ A1: Cover ⚡     │ B1: Test infra ✅│ C1: Fixture library ✅      │
│ A2: YearStats ⚡ │ B2: LLM judge ✅ │ C2: Mock server (Phase 2)   │
│ A3: YearCalendar⚡│ B3: Visual tests✅│ C3: Style guide gen ✅      │
│ A4: Race_1p ⚡   │ B4: Integration✅│ C4: Book assembly ✅        │
│ A5: Race_2p ⚡   │                 │                             │
│ A6: ActivityLog⚡│                 │                             │
│ A7: Dividers ⚡  │                 │                             │
│ A8: BackCover ⚡ │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘

Legend: ✅ = Complete, ⚡ = Functional placeholder (needs visual polish)
```

### Completed Foundation

- ✅ **B1: Test Infrastructure** — `make test-template`, `make test-visual`, `make test-list`
- ✅ **B2: LLM Judge** — `visual-judge.ts` with Gemini (Bedrock/Anthropic fallback)
- ✅ **B3: Visual Tests** — Full pipeline: PDF → PNG → LLM evaluation → structured feedback
- ✅ **B4: Integration Tests** — `make test-integration`, year fixtures (activeYear, casualYear, etc.)
- ✅ **C1: Fixture Library** — 16 activity fixtures + 4 year fixtures from real Strava data
- ✅ **C3: Style Guide Generator** — AI theming with race detection (Boston, NYC, Comrades, etc.)
- ✅ **C4: Book Assembly Logic** — `BookDocument.tsx` routes all page types, `generateBookEntries()`
- ⚡ **A1-A8: All Templates** — Functional placeholders, pass tests (scores 70-83), need visual polish

### End-to-End Pipeline Complete ✅

Full book generation now works:
```bash
make test-integration-quick   # Generates 4 complete book PDFs
```

Generated books (in `test-output/`):
- `integration-activeYear.pdf` — 37 pages, 322 KB
- `integration-casualYear.pdf` — 14 pages, 35 KB
- `integration-marathonFocus.pdf` — 12 pages, 25 KB
- `integration-ultraFocus.pdf` — 16 pages, 67 KB

### Current Priority: Template Visual Polish

Now that the pipeline works end-to-end, focus on improving template visual quality.

### Remaining Work

**Phase 1 (MVP):**
- A1-A8: Template visual polish ← **NEXT**
- UI: Wire style guide generator to builder UI
- UI: Wire book generation to builder UI

**Phase 2:**
- C2: Mock Strava server for offline development
- YearMap template
- Full Art Director workflow

### Agent Task Definitions

Each task should include:
- **Objective:** What to build
- **Inputs:** What files/fixtures to use
- **Outputs:** What to produce
- **Tests:** How to verify success
- **Done criteria:** What "complete" looks like

---

## 8. Definition of Done

### Template Done Criteria
- [ ] Renders without errors for all relevant fixture variants
- [ ] Handles missing data gracefully (null photos, splits, GPS, etc.)
- [ ] Scales correctly for supported formats (8x8, 10x10)
- [ ] LLM visual judge overall score >= 70
- [ ] No single criterion (readability, balance, cohesion) below 50
- [ ] Integration test passes (PDF generates without errors)

### Book Done Criteria
- [ ] Full sample book generates for `yearFixtures.activeYear`
- [ ] All pages pass individual visual tests
- [ ] LLM book review passes (coherence, flow, consistency)
- [ ] PDF opens correctly in Preview/Acrobat
- [ ] File size reasonable (< 50MB for 50-page book)

### Test Infrastructure Done Criteria ✅
- [x] `make test-visual` runs visual tests with LLM judge
- [x] `make test-template` tests individual template/fixture combinations
- [x] Visual judge returns structured feedback (scores + suggestions)
- [x] Fixtures cover races, training, edge cases (16 total)
- [ ] Mock server returns realistic data shapes (deferred to Phase 2)

---

## 9. Decisions Made

1. **Photo quality:** Warn but include. Show warning in UI for low-res photos, let user decide to swap or keep.

2. **Performance budget:** Target < 5 minutes for ~50 page book. If longer, use background job with email notification.

3. **Error handling:** Agent decides based on context. Critical pages (cover, TOC) should fail fast; optional pages (individual race if user has many) can be skipped with warning.

4. **Font licensing:** Assume all 41 downloaded fonts are embeddable for commercial PDF distribution.


## 10. Open Questions

1. **Activity log variety:** How to keep activity log pages fresh and not repetitive? Ideas:
   - Small layout variations per page
   - AI-generated callouts for notable activities
   - Rotating accent graphics/icons
   - Decision: Explore during ActivityLog template development

2. **Monthly divider dynamism:** How to make dividers feel unique while staying consistent?
   - Pull notable quotes from activity descriptions
   - Feature "moment of the month" photo
   - Decision: Explore during MonthlyDivider template development

3. ~~**Photo loading in tests:**~~ ✅ RESOLVED
   - Fixture photos downloaded locally to `web/lib/testing/fixtures/photos/`
   - Templates use `resolveImageUrl()` helper to handle local vs proxy URLs


---

## Appendix A: File Locations

```
web/
├── components/
│   ├── templates/              # All page templates
│   │   ├── BookDocument.tsx    # Master router
│   │   ├── Cover.tsx
│   │   ├── YearStats.tsx
│   │   ├── YearCalendar.tsx
│   │   ├── Race_1p.tsx
│   │   ├── Race_2p.tsx
│   │   ├── ActivityLog.tsx
│   │   ├── MonthlyDivider.tsx
│   │   └── BackCover.tsx
│   └── pdf/                    # Reusable components
│       ├── Header.tsx
│       ├── StatsGrid.tsx
│       └── ...
├── lib/
│   ├── testing/
│   │   ├── fixtures/           # Test data (16 JSON files)
│   │   │   ├── index.ts        # Fixture loader
│   │   │   └── *.json          # Individual activity fixtures
│   │   ├── visual-judge.ts     # LLM evaluation (Gemini/Bedrock/Anthropic)
│   │   └── test-harness.ts     # PDF generation + evaluation runner
│   ├── book-format.ts          # Format definitions (8x8, 10x10)
│   └── book-theme.ts           # Theme definitions
├── app/
│   └── api/
│       ├── generate-pdf/       # PDF generation endpoint
│       └── comprehensive-activity-data/  # Strava data fetcher
└── Dockerfile                  # Node + poppler-utils + fonts

# Project root
├── SPEC.md                     # This file
├── AGENT_INSTRUCTIONS.md       # Agent workflow documentation
├── Makefile                    # Development commands
├── docker-compose.yml          # Container orchestration
└── test-output/                # Generated PDFs and images
```

---

## Appendix B: Sample LLM Judge Prompt

```
You are evaluating a PDF page screenshot for print quality.

Template: {templateName}
Page Type: {pageType}
Theme: {theme}

Evaluate on these criteria (score 0-100 each):

1. PRINT READABILITY
- Is body text large enough to read in print (>= 10pt)?
- Is there sufficient contrast between text and background?
- Is critical content within safe margins (not too close to edges)?
- Is text clearly separated from images?

2. LAYOUT BALANCE
- Is visual weight distributed across the page?
- Is there appropriate whitespace (not cramped or empty)?
- Are elements aligned consistently?
- Are images properly sized and positioned?

3. BRAND COHESION
- Do colors match the provided theme palette?
- Are fonts used consistently (headings vs body)?
- Is spacing rhythm consistent?
- Does the overall style match a professional print publication?

Return JSON:
{
  "printReadability": { "score": N, "issues": [...] },
  "layoutBalance": { "score": N, "issues": [...] },
  "brandCohesion": { "score": N, "issues": [...] },
  "overallScore": N,
  "pass": true/false,
  "summary": "Brief overall assessment",
  "suggestions": ["Specific actionable improvement 1", "..."]
}
```

**Note:** The `suggestions` array is critical for agent iteration — it provides specific, actionable feedback for the next iteration cycle.
