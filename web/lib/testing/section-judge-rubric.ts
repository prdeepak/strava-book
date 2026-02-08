/**
 * Section Judge Rubric — Prompt Template for LLM-based Section Evaluation
 *
 * Defines the evaluation criteria, scoring rubric, and output format
 * for the section-level judge (1-6 pages of a race section).
 */

import { SectionManifest } from './section-judge'

// ============================================================================
// Types
// ============================================================================

export interface SectionJudgment {
  completeness: SectionCriterionScore
  pageUtilization: SectionCriterionScore
  contentFlow: SectionCriterionScore
  gracefulDegradation: SectionCriterionScore
  overallScore: number  // 0-100
  pass: boolean
  summary: string
  suggestions: string[]
  provider?: string
  model?: string
}

export interface SectionCriterionScore {
  score: number  // 0-100
  issues: string[]
}

// ============================================================================
// Rubric Prompt Builder
// ============================================================================

export function buildSectionJudgePrompt(manifest: SectionManifest): string {
  const manifestJson = JSON.stringify(manifest, null, 2)

  return `You are evaluating a RACE SECTION (1-6 pages) from a coffee-table yearbook. This section covers a single race activity.

## SECTION MANIFEST
\`\`\`json
${manifestJson}
\`\`\`

## EVALUATION CRITERIA

Score each criterion from 0-100. Be critical but constructive.

### 1. COMPLETENESS (0-100)
Does the section include content for all available data?
- If photos are available but no page shows photos: -30
- If description exists but no page shows it: -20
- If splits exist but no page shows them: -15
- If 3+ comments exist but no page shows comments: -15
Base score: 100, subtract penalties.

### 2. PAGE UTILIZATION (0-100)
Are pages well-filled with content?
- A page with fill ratio < 0.2 is "sparse": -15
- A page with fill ratio < 0.1 is "empty": -30
Base score: 100, subtract penalties per page.

### 3. CONTENT FLOW (0-100)
Are pages in the expected order for this variant?
- Each variant has a natural page progression
- -10 per ordering violation
Base score: 100, subtract penalties.

### 4. GRACEFUL DEGRADATION (0-100)
Does the section handle missing data well?
- With all data missing, section should produce 1-2 compact pages, not 4+ sparse ones
- Penalize if page count equals max even when data is missing
- Bonus for clean compaction
Base score: 70, add bonuses for clean fallbacks.

## PASS CRITERIA
- Overall score >= 60
- No individual criterion below 40

Return ONLY valid JSON:
{
  "completeness": { "score": <0-100>, "issues": ["..."] },
  "pageUtilization": { "score": <0-100>, "issues": ["..."] },
  "contentFlow": { "score": <0-100>, "issues": ["..."] },
  "gracefulDegradation": { "score": <0-100>, "issues": ["..."] },
  "overallScore": <0-100>,
  "pass": <true if overall >= 60 and no criterion below 40>,
  "summary": "Brief assessment",
  "suggestions": ["improvement 1", "improvement 2"]
}`
}
