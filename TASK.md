# WS3: Book Reviewer Agent — Holistic Design Feedback Loop

## Your Mission

Build an agent that evaluates the *entire book* — not just individual pages — and provides actionable improvement suggestions. This creates a design feedback loop for ongoing quality improvement.

## Mandatory Workflow

1. Read CLAUDE.md for project rules
2. Read `docs/StyleGuide.md` for PDF design system
3. Work in this workspace's devcontainer
4. Run `make test-e2e-ci` before creating your PR
5. Create a PR when done — do NOT merge it

## Architecture Overview

```
BookReviewer
├── Input:
│   ├── Book manifest (JSON: page types, race names, months, photo counts)
│   ├── Contact sheet (grid of all page thumbnails, ~20 per sheet)
│   └── Current variant assignments per section
├── Rubric (scored 1-10 each):
│   ├── PACING: Are high-energy pages (races) well-spaced? Is there breathing room?
│   ├── VARIETY: Do consecutive spreads look visually different?
│   ├── DENSITY: Are there empty/sparse pages that waste the reader's attention?
│   ├── RHYTHM: Light/dark alternation? Full-bleed vs whitespace balance?
│   ├── NARRATIVE: Does it build toward the A-Race? Does it tell a story?
│   └── ENGAGEMENT: "Would a non-runner keep flipping?" (the phone-book test)
├── Output (JSON):
│   ├── scores: { pacing: 7, variety: 4, density: 5, ... }
│   ├── suggestions: [
│   │     { type: "swap_variant", page: 12, from: "default", to: "map-hero", reason: "..." },
│   │     { type: "remove_page", page: 30, reason: "Nearly blank comments page" },
│   │     { type: "merge_pages", pages: [35,36], reason: "Sparse divider + short log" },
│   │     { type: "reorder", ... }
│   │   ]
│   └── overall_score: 5.2
└── Iteration: Apply suggestions → re-render → re-evaluate → until score > 7
```

## Files to Create

### 1. `web/lib/book-reviewer.ts` — Main Agent

The core reviewer function:

```typescript
interface BookManifest {
  pages: Array<{
    pageNumber: number
    type: string       // BookPageType
    title?: string
    activityId?: number
    variant?: string
    photoCount?: number
    hasMap?: boolean
    wordCount?: number
  }>
  totalPages: number
  raceCount: number
  monthCount: number
  aRace?: string
}

interface ReviewScore {
  pacing: number      // 1-10
  variety: number     // 1-10
  density: number     // 1-10
  rhythm: number      // 1-10
  narrative: number   // 1-10
  engagement: number  // 1-10
}

interface ReviewSuggestion {
  type: 'swap_variant' | 'remove_page' | 'merge_pages' | 'reorder' | 'add_content' | 'change_layout'
  page?: number
  pages?: number[]
  from?: string
  to?: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface BookReview {
  scores: ReviewScore
  overallScore: number
  suggestions: ReviewSuggestion[]
  summary: string
}

async function reviewBook(
  manifest: BookManifest,
  contactSheetPaths: string[],  // PNG paths of contact sheets
  options?: { verbose?: boolean }
): Promise<BookReview>
```

**Implementation approach:**
- Build on existing patterns in `web/lib/testing/visual-judge.ts` (reuse the LLM provider chain: Bedrock → Gemini → Anthropic)
- Build on `web/lib/ai-book-designer.ts` for Gemini API integration patterns
- Send contact sheets (thumbnail grids) + manifest JSON to the LLM
- Parse structured JSON response matching the `BookReview` interface

### 2. `web/lib/book-reviewer-rubric.ts` — Rubric Prompt Template

Separate file for the prompt template so it's easy to iterate on:

```typescript
export function buildReviewPrompt(manifest: BookManifest): string
```

The prompt should:
- Describe each rubric criterion with examples of good (8-10) and bad (1-3) scores
- Include the manifest data inline
- Ask for JSON output matching the `BookReview` schema
- Emphasize the "phone book test" — would a non-runner keep flipping?

### 3. `web/lib/contact-sheet-generator.ts` — Contact Sheet Generator

Stitches individual page PNGs into contact sheets for efficient LLM context:

```typescript
async function generateContactSheets(
  pagePngPaths: string[],
  options?: {
    pagesPerSheet?: number  // default: 20
    thumbnailWidth?: number // default: 200px
    columns?: number        // default: 5
  }
): Promise<string[]>  // Returns paths to generated contact sheet PNGs
```

**Implementation:**
- Use `sharp` or `canvas` npm package to composite images
- Each contact sheet: 5 columns × 4 rows = 20 thumbnails
- Add page numbers as labels below each thumbnail
- Save to temp directory, return paths

### 4. `web/app/api/review-book/route.ts` — API Endpoint

```typescript
POST /api/review-book
Body: { manifestJson: string, contactSheetPaths: string[] }
Response: BookReview (JSON)
```

Also support generating manifest from existing book output:

```typescript
POST /api/review-book
Body: { bookEntriesJson: string }  // BookEntry[] from generateBookEntries
Response: BookReview (JSON)
```

### 5. `web/lib/book-manifest.ts` — Manifest Builder

Helper to convert `BookEntry[]` (from `generateBookEntries`) into a `BookManifest`:

```typescript
function buildManifest(
  entries: BookEntry[],
  activities: StravaActivity[]
): BookManifest
```

## Key Integration Points

1. The `suggestions` output format should map to actionable changes:
   - `swap_variant` → change the variant prop passed to RaceSection or MonthlyDivider
   - `remove_page` → filter out the BookEntry
   - `merge_pages` → combine entries in generateBookEntries
   - These are inputs for WS2's variant system (they should be compatible)

2. The manifest should capture enough metadata for the reviewer to reason about variety without seeing every pixel:
   - Page type, variant, photo count, word count, has map, etc.

## Existing Code to Build On

- `web/lib/testing/visual-judge.ts` — LLM provider chain, image-based evaluation
- `web/lib/visual-judge-iteration.ts` — render→judge→adjust iteration loop
- `web/lib/ai-book-designer.ts` — Gemini API client, session management
- `web/lib/testing/book-integration-test.ts` — book generation pipeline

## Testing Strategy

1. Generate a test book using `make test-book`
2. Build manifest from the generated book entries
3. Run the reviewer against it
4. Verify it returns valid JSON matching the schema
5. Verify scores are reasonable (variety should be low for current output)
6. Verify at least 5 actionable suggestions
7. Before PR: `make test-e2e-ci` — all tests must pass

## PR Details

- PR title: "feat: Book reviewer agent — holistic design feedback loop"
- Include example review output in PR description
- Show the rubric criteria and how scoring works
