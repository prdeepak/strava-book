/**
 * Book Reviewer Rubric — Prompt Template
 *
 * Separate file for the prompt template so it's easy to iterate on.
 * Defines the evaluation criteria, scoring rubric, and output format
 * for the book reviewer agent.
 */

import { BookManifest } from './book-manifest'

// ============================================================================
// Types (re-exported for convenience)
// ============================================================================

export interface ReviewScore {
  pacing: number      // 1-10
  variety: number     // 1-10
  density: number     // 1-10
  rhythm: number      // 1-10
  narrative: number   // 1-10
  engagement: number  // 1-10
}

export interface ReviewSuggestion {
  type: 'swap_variant' | 'remove_page' | 'merge_pages' | 'reorder' | 'add_content' | 'change_layout'
  page?: number
  pages?: number[]
  from?: string
  to?: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface BookReview {
  scores: ReviewScore
  overallScore: number
  suggestions: ReviewSuggestion[]
  summary: string
}

// ============================================================================
// Rubric Prompt Builder
// ============================================================================

/**
 * Build the review prompt that will be sent to the LLM along with contact sheets.
 */
export function buildReviewPrompt(manifest: BookManifest): string {
  const manifestJson = JSON.stringify(manifest, null, 2)

  return `You are a professional book designer reviewing a coffee-table yearbook created from an athlete's Strava data. You are evaluating the ENTIRE book as a whole — not individual pages.

You will receive:
1. Contact sheet images showing thumbnail grids of all pages in the book
2. A JSON manifest describing each page's metadata

## BOOK MANIFEST
\`\`\`json
${manifestJson}
\`\`\`

## EVALUATION RUBRIC

Score each criterion from 1-10. Be critical but constructive.

### 1. PACING (1-10)
Are high-energy pages (races, stats) well-spaced throughout the book? Is there breathing room between intense content?

**Good (8-10):** Race pages are separated by calmer monthly summaries or activity logs. The book has a clear "inhale/exhale" rhythm. Readers never feel overwhelmed or bored.
**Average (4-7):** Some clustering of similar-energy pages. A few areas feel rushed or stagnant.
**Bad (1-3):** Race pages are clumped together. Long stretches of identical-looking pages. No variation in intensity.

### 2. VARIETY (1-10)
Do consecutive spreads look visually different? Are different page types, layouts, and photo treatments used?

**Good (8-10):** Each spread opening is visually distinct from the previous one. Mix of photo-heavy, stats-heavy, and text-heavy pages. Different background treatments and layouts.
**Average (4-7):** Some visual repetition but generally varied. A few runs of similar-looking pages.
**Bad (1-3):** Pages look like a phone book — same layout, same density, same visual weight repeated endlessly.

### 3. DENSITY (1-10)
Are pages well-utilized? No empty/sparse pages wasting the reader's attention, and no overcrowded pages?

**Good (8-10):** Every page earns its place. Pages with few elements use space deliberately (hero images, dramatic whitespace). No wasted pages.
**Average (4-7):** A few sparse pages that feel like filler. Most pages have appropriate content density.
**Bad (1-3):** Multiple nearly-blank pages. Activity logs with only 1-2 entries. Empty comments sections. Pages that should have been merged.

### 4. RHYTHM (1-10)
Is there a good light/dark alternation? Balance between full-bleed images and whitespace pages?

**Good (8-10):** Alternation between dark (photo-backed) and light (white/stats) pages. Full-bleed images used strategically, not on every page. Visual rhythm that guides the eye.
**Average (4-7):** Some alternation but not consistent. A few runs of all-light or all-dark pages.
**Bad (1-3):** Monotone visual weight throughout. Either all dense/dark or all sparse/light.

### 5. NARRATIVE (1-10)
Does the book build toward the A-Race? Does it tell a coherent story from cover to back cover?

**Good (8-10):** Clear narrative arc — opening sets the stage, middle builds momentum, climax is the A-Race, denouement wraps up the year. Monthly progression feels natural.
**Average (4-7):** Chronological order but no real narrative tension. The A-Race doesn't feel like a climax.
**Bad (1-3):** Random ordering. No sense of journey. The A-Race is buried among other pages with no special treatment.

### 6. ENGAGEMENT — The Phone Book Test (1-10)
"Would a non-runner keep flipping pages?" This is the ultimate test. If someone who doesn't care about running picked up this book, would the visuals, layout, and pacing keep them interested?

**Good (8-10):** Beautiful imagery, surprising layouts, compelling visual rhythm. Even without reading the stats, the book is visually engaging. A coffee-table book you'd actually display.
**Average (4-7):** Decent visual interest but some sections are boring to flip through. A non-runner might skip sections.
**Bad (1-3):** Looks like a data dump or spreadsheet. Only interesting to the athlete themselves. No visual hook to keep flipping.

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "scores": {
    "pacing": <1-10>,
    "variety": <1-10>,
    "density": <1-10>,
    "rhythm": <1-10>,
    "narrative": <1-10>,
    "engagement": <1-10>
  },
  "overallScore": <weighted average, 1 decimal>,
  "suggestions": [
    {
      "type": "swap_variant" | "remove_page" | "merge_pages" | "reorder" | "add_content" | "change_layout",
      "page": <page number if applicable>,
      "pages": [<page numbers if applicable>],
      "from": "<current variant/layout if applicable>",
      "to": "<suggested variant/layout>",
      "reason": "<specific, actionable reason>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": "<2-3 sentence overall assessment>"
}

Provide at least 5 actionable suggestions. Each suggestion must be specific enough to implement programmatically (reference exact page numbers, variant names, or layout changes).

IMPORTANT: The overall_score should be the arithmetic mean of the 6 criterion scores, rounded to 1 decimal place.`
}
