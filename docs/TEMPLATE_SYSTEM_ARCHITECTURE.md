# CURRENT TEMPLATE SYSTEM ARCHITECTURE

## GOAL

The Template System is designed to generate a unique and bespoke book for each user, by:
* starting from a collection of section templates, with variants;
* which are then assembled and customized (e.g., with distinctive fonts and colors) by an AI agent to form the final book

---

## TEMPLATE SYSTEM END-TO-END FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE SPECIFICATION                             │
│  web/lib/template-specs/                                                    │
│  ├── types.ts         - TemplateSpec, TemplateInputSpec, TemplateOutputSpec │
│  ├── registry.ts      - Maps template IDs to specs                          │
│  ├── book-templates.ts - Cover, YearStats, MonthlyDivider, YearCalendar    │
│  ├── race-1p.ts       - Single-page race template spec                      │
│  └── race-section.ts  - Two-page race spread spec                          │
└────────────────────────────────────────────────────────────────┬────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE COMPONENTS                               │
│  web/components/templates/                                                  │
│  ├── MonthlyDivider.tsx  - React-PDF component for month pages             │
│  ├── Cover.tsx           - Book cover component                            │
│  ├── YearStats.tsx       - Annual statistics component                     │
│  ├── YearCalendar.tsx    - GitHub-style heatmap                           │
│  ├── RaceSection.tsx     - 2-page race spread                             │
│  ├── Race_1p.tsx         - Single-page race layout                        │
│  ├── ActivityLog.tsx     - Activity listing pages                         │
│  └── BookDocument.tsx    - Orchestrator that routes entries to templates  │
└────────────────────────────────────────────────────────────────┬────────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┼─────────────────────────────────────────────┐
                    │                                             │                                             │
                    ▼                                             ▼                                             ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     TEST HARNESS PATH           │   │      AI DESIGNER PATH           │   │     PRODUCTION PATH             │
│                                 │   │                                 │   │                                 │
│  make test-template             │   │  AIBookDesignerModal            │   │  BookGenerationModal            │
│       │                         │   │       │                         │   │       │                         │
│       ▼                         │   │       ▼                         │   │       ▼                         │
│  test-harness.ts                │   │  /api/ai-book-designer/start    │   │  /api/generate-book             │
│  - Loads fixture JSON           │   │  - Art Director (Gemini)        │   │  - Receives theme from client   │
│  - Uses DEFAULT_THEME           │   │  - Narrator                     │   │  - Normalizes fonts             │
│  - Renders to PDF               │   │  - Designer                     │   │  - Renders FullBookDocument     │
│  - Runs visual judge            │   │  - Generates BookTheme          │   │       │                         │
│       │                         │   │       │                         │   │       ▼                         │
│       ▼                         │   │       ▼                         │   │  BookDocument.tsx               │
│  Template Component             │   │  /api/generate-book             │   │  - Routes entries to templates  │
│  (with DEFAULT_THEME)           │   │  (with AI-generated theme)      │   │  - Passes theme to each         │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

---

## Key Files by Layer

### Layer 1: Template Specifications
Define what each template expects and can produce.

| File | Purpose |
|------|---------|
| `web/lib/template-specs/types.ts` | Core types: `TemplateSpec`, `TemplateInputSpec`, `TemplateOutputSpec` |
| `web/lib/template-specs/registry.ts` | Maps template IDs to specs, provides lookup functions |
| `web/lib/template-specs/book-templates.ts` | Specs for Cover, YearStats, MonthlyDivider, YearCalendar |
| `web/lib/template-specs/race-1p.ts` | Race_1p template spec with variants |
| `web/lib/template-specs/race-section.ts` | RaceSection (2-page spread) spec |

### Layer 2: Template Components (React-PDF)
Actual React components that render to PDF.

| File | Purpose |
|------|---------|
| `web/components/templates/MonthlyDivider.tsx` | Month divider page - **uses `theme.fontPairing.heading`** |
| `web/components/templates/Cover.tsx` | Book cover |
| `web/components/templates/YearStats.tsx` | Year statistics page |
| `web/components/templates/YearCalendar.tsx` | GitHub-style heatmap |
| `web/components/templates/RaceSection.tsx` | 2-page race spread |
| `web/components/templates/Race_1p.tsx` | Single-page race |
| `web/components/templates/ActivityLog.tsx` | Activity listing |
| `web/components/templates/BookDocument.tsx` | Routes BookEntry to appropriate template |

### Layer 3: Theme System
Defines colors, fonts, and visual style.

| File | Purpose |
|------|---------|
| `web/lib/book-types.ts` | `BookTheme` interface, `DEFAULT_THEME` |
| `web/lib/font-registry.ts` | Available fonts, variant support |
| `web/lib/theme-defaults.ts` | Preset themes (Running, Cycling, etc.) |
| `web/lib/style-guide-generator.ts` | Calls Gemini to generate themes |
| `web/lib/ai-validation.ts` | Validates AI-generated themes |

### Layer 4: Test Infrastructure
Test and iterate on templates.

| File | Purpose |
|------|---------|
| `web/lib/testing/test-harness.ts` | Core test runner - loads fixtures, renders PDFs |
| `web/lib/testing/visual-judge.ts` | LLM-based visual quality scoring |
| `web/lib/testing/fixtures/*.json` | Test data (race_marathon, activeYear, etc.) |
| `Makefile` | `test-template`, `test-pdf`, `test-visual` commands |

### Layer 5: Production APIs
Generate actual books.

| File | Purpose |
|------|---------|
| `web/app/api/generate-book/route.ts` | Main book generation API |
| `web/app/api/generate-book-pdf/route.ts` | Legacy API |
| `web/app/api/ai-book-designer/start/route.ts` | AI design session start |
| `web/app/api/ai-book-designer/status/[sessionId]/route.ts` | Design session status |

---

## Makefile Commands

```bash
# List available templates and fixtures
make test-list

# Test a specific template with fixture
make test-template template=MonthlyDivider fixture=activeYear

# Generate PDF only (no visual judge)
make test-pdf template=MonthlyDivider fixture=activeYear

# Run all visual tests
make test-visual
```

---

## How the AI Book Designer Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIBookDesignerModal                         │
│  (web/components/AIBookDesignerModal.tsx)                       │
│  - User configures: title, format, athlete name                 │
│  - Starts design session → polls for progress                   │
│  - Shows theme preview during Art Director stage                │
│  - Auto-downloads PDF when complete                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    /api/ai-book-designer                         │
│  (web/app/api/ai-book-designer/start/route.ts)                  │
│  Input: activities[], photos[], options                         │
│  Output: sessionId (async) or full designSpec (sync)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Three-Stage AI Pipeline                        │
│  (web/lib/ai-book-designer.ts)                                  │
│                                                                  │
│  Stage 1: ART DIRECTOR                                          │
│  ├── Analyzes: activities, A-race, activity types, photos       │
│  ├── Calls: generateStyleGuide() → Gemini API                   │
│  └── Output: BookTheme (colors, fonts, motif)                   │
│                                                                  │
│  Stage 2: NARRATOR                                              │
│  ├── Analyzes: activities grouped by month                      │
│  └── Output: chapters[], highlights[], yearSummary              │
│                                                                  │
│  Stage 3: DESIGNER                                              │
│  ├── Converts chapters to pages via generateSmartDraft()        │
│  ├── Runs self-correction loop with simulateVisualJudge()       │
│  └── Output: pages[], iterations[], finalScore                  │
└─────────────────────────────────────────────────────────────────┘
```

### Theme Generation (Art Director Stage)

**File:** `web/lib/style-guide-generator.ts`

1. **Input Analysis:**
   - Detects A-Race (primary goal race)
   - Looks up known race colors (Boston, NYC, Chicago, etc.)
   - Calculates energy level from activity types
   - Counts photos

2. **Gemini API Call:**
   - Sends prompt with race info, activity breakdown, user preference
   - Includes available fonts from `font-registry.ts`
   - Requests JSON response with primaryTheme

3. **Output:**
   ```typescript
   interface BookTheme {
     primaryColor: string        // "#0D2240"
     accentColor: string         // "#FFD200"
     backgroundColor: string     // "#FFFFFF"
     fontPairing: {
       heading: string           // "BebasNeue"
       body: string              // "BarlowCondensed"
     }
     motif?: string              // "boston-marathon"
     backgroundStyle: 'solid' | 'gradient' | 'photo-fade' | 'pattern'
   }
   ```

---

## Font Registry System

**File:** `web/lib/font-registry.ts`

### Available Fonts

| Font | Category | Has Bold | Has Italic |
|------|----------|----------|------------|
| BebasNeue | display | ✗ | ✗ |
| Anton | display | ✗ | ✗ |
| ArchivoBlack | display | ✗ | ✗ |
| Bangers | display | ✗ | ✗ |
| Righteous | display | ✗ | ✗ |
| CrimsonText | serif | ✓ | ✗ |
| BarlowCondensed | condensed | ✓ | ✓ |
| Helvetica | sans-serif | ✓ | ✓ |

### Current Font Selection Logic

```typescript
// getHeadingFonts() returns ALL display + sans-serif + serif + condensed
// Does NOT filter out uppercase-only fonts
export function getHeadingFonts(): string[] {
  const headingCategories = ['display', 'sans-serif', 'serif', 'condensed']
  return FONT_REGISTRY.filter(f => headingCategories.includes(f.category))
}
```



---

## Validation & Normalization

**File:** `web/lib/ai-validation.ts`

### What Validation Does

1. **Font Validation:** Checks if font exists in registry, suggests replacement if not
2. **Color Validation:** WCAG contrast checks, hex format validation
3. **Content Validation:** XSS pattern detection, length checks



## Template Interaction

### How Themes Flow to Templates

```
BookTheme from Art Director
         │
         ▼
BookGenerationModal.tsx (line 277)
    theme: config.theme
         │
         ▼
/api/generate-book/route.ts (line 83-87)
    const rawTheme = config.theme || DEFAULT_THEME
    const theme = normalizeThemeFonts(rawTheme)
         │
         ▼
FullBookDocument (line 145)
    theme prop passed to BookDocument
         │
         ▼
BookDocument.tsx (line 543)
    <MonthlyDivider theme={theme} />
         │
         ▼
MonthlyDivider.tsx (line 279)
    <Text style={styles.monthName}>{monthName}</Text>
    // styles.monthName = { fontFamily: theme.fontPairing.heading }
```

### Key Template Files

| File | Purpose |
|------|---------|
| `MonthlyDivider.tsx` | Uses `theme.fontPairing.heading` for month name |
| `Cover.tsx` | Uses `theme.fontPairing.heading` for title |
| `YearStats.tsx` | Uses `theme.fontPairing.heading` for stats labels |
| `RaceSection.tsx` | Uses `theme.fontPairing.heading` for race name |

---

## Test Harness Interaction

**File:** `web/lib/testing/test-harness.ts`

### How Tests Work

```typescript
// Test harness ALWAYS uses DEFAULT_THEME (line 407)
const templateProps = {
    format: FORMATS['10x10'],
    theme: DEFAULT_THEME,  // Helvetica-Bold heading font
    mapboxToken
}
```

### Why Tests and Production Differ

| Aspect | Test Harness | Production |
|--------|--------------|------------|
| Theme Source | `DEFAULT_THEME` | AI-generated or user-selected |
| Heading Font | `Helvetica-Bold` | `BebasNeue` (or other AI-selected) |

---

# SIMPLIFYING THE ARCHITECTURE

## Current Architecture Complexity

  Looking at what exists:

  Layer 1: Template Specs       → Defines what templates CAN do
  Layer 2: Template Components  → Actually DOES the rendering
  Layer 3: Theme System         → Colors, fonts, validation
  Layer 4: AI Pipeline          → 3 stages (Art Director → Narrator → Designer)
  Layer 5: Test Infrastructure  → Visual judge, fixtures
  Layer 6: Production APIs      → Multiple endpoints

  This is more complex than it needs to be.

  ## Where the Complexity Creeps In

  1. Template Specs vs Template Components: Two parallel systems that should be one. The specs define variants/options, but the components also have their own logic. They can drift apart.
  2. 3-Stage AI Pipeline: Art Director → Narrator → Designer is elegant conceptually, but:
    - Each stage passes data to the next, adding coupling
    - Errors in early stages propagate
    - More API calls = more latency and cost
  3. Generative Themes: The AI generates colors/fonts from scratch, which requires:
    - Font registry with variant tracking
    - WCAG color validation
    - Normalization for unknown fonts
  4. Self-Correction Loop: The Designer runs simulateVisualJudge() in a loop to improve pages. Ambitious, but adds complexity.

## Revised Architecture: The Architect & Mason Pattern

To balance "bespoke design" with "robust engineering" (and avoid context window limits), we split the AI responsibility into two distinct phases.

### Phase 1: The Architect (Stateful & Global)
*   **Input**: *Summarized* Metadata (not raw activities).
    *   Monthly distance/elevation totals.
    *   List of "Epic" or "Race" tagged activities.
    *   Photo counts per month/event.
    *   User Preferences (Energy: "High/Low", Style: "Minimal/Data-Heavy").
*   **Responsibility**: Defines the **Book Structure**.
    *   Determines the "Theme" (Fonts, Colors).
    *   Designs the Table of Contents (`BookStructure`).
    *   Decides how to slice the time (e.g., "Spring Block" vs "May").
    *   Selects the *intent* for key sections (e.g., "This RaceSection should highlight the PR").
    *   **Global Highlights**: Selects key photos/comments for the Cover/Intro to ensure they aren't repeated inside sections.
    *   **Visual Motifs**: Chooses specific photos to serve as *background textures* (e.g., a faint mountain ridge for SectionDividers).
*   **Output**: `BookManifest` (JSON)
    ```json
    {
      "theme": "...",
      "backgroundAssets": {
        "motif": "photo_123_faded.jpg" 
      },
      "sections": [
        { "type": "Cover", "title": "2024 Year in Run", "heroImageId": "photo_555" },
        { "type": "SectionDivider", "label": "Spring Builders", "backgroundId": "photo_123_faded.jpg" },
        ...
      ],
      "globalExclusions": ["photo_555"] // Assets used on Cover, don't reuse in sections
    }
    ```

### Phase 2: The Mason (Stateless & Parallel)
*   **Input**:
    *   A single item from the Architect's `BookManifest.sections` array (a `SectionConfig`).
    *   The *full raw data* for *only that section* (GPS tracks, splits, specific photos).
    *   `excludedAssetIds`: List of photos/comments "claimed" by the Architect for global pages (to avoid repetition).
*   **Responsibility**: Lays out the specific bricks (content).
    *   Fits text to boundaries.
    *   Selects specific photos for specific slots.
    *   Optimizes map crop and zoom.
*   **Output**: `LayoutProps` for the React Component.

---

## Safety Layer: Default Layout Generator

To ensure the user *always* gets a book, even if the AI fails, we must implement deterministic fallback logic for *both* stages.

### 1. Architect Fallback (The "Safe" Structure)
If the Architect fails to return a valid manifest:
*   **Structure**: Strictly Chronological (Month 1 → Month 12).
*   **Dividers**: Standard `MonthlyDivider` for every month.
*   **Races**: Insert `Race_1p` for every activity type 'Race'.
*   **Theme**: `DEFAULT_THEME` (Helvetica).

### 2. Mason Fallback (The "Safe" Layout)
If the Mason fails to layout a specific section:
*   **RaceSection**: Use generic "Stats on Left, Map on Right" layout. Ignore extra photos if they don't fit.
*   **ActivityLog**: Standard table view.
*   **Photos**: Simple 2x2 grid.

*Crucially, the UI should indicate which sections are "AI Enhanced" vs "Fallback", allowing the user to manually trigger a re-design of specific sections.*

---

## Next Steps

### 1. Create a workplan to get from here to there
*   [ ] Ask user questions to really ensure I'm on the same page at a detailed level, before you get started
    * Architect and Mason should use Claude 3.5 Sonnet via AWS Bedrock, not Gemini 2.0 Flash

### 2. Improve the test strategy
*   [ ] How should the test strategy be adjusted so that tests genuinely validate the same outputs as the production pipeline?

### 3. Fix Known Bugs / Issues
*   [ ] **Review Font Loading**: Ensure custom fonts load reliably in the PDF renderer.
*   [ ] **Fix Text Overflow**: Handle variable length descriptions in fixed layout templates.

### 4. Core Refactoring
*   [ ] **Rename `Year*` to `Period*`**:
    *   Books may cover "Marathon Training Block" (4 months) or "Multi-Year Career".
    *   Rename `YearStats` → `PeriodStats`.
    *   Rename `YearCalendar` → `PeriodCalendar`.
*   [ ] **Rename `MonthlyDivider` to `SectionDivider`**:
    *   The Architect may decide to group activities by "Training Block" (e.g., "Base Building", "Peak Phase") rather than calendar months.
    *   Update component to accept arbitrary `label` and `dateRange` instead of just `month`.
*   [ ] **Expand `RaceSection`**:
    *   Should accommodate variable length (1-4+ pages).
    *   **Subsume `race_1p`**: `race_1p` becomes just a 1-page variant of `RaceSection`.
    *   Logic to handle: "Only 1 photo? Use 1-page layout." vs "50 photos? Use 4-page spread."
