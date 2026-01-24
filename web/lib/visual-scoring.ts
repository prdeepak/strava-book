/**
 * Visual Scoring Module
 *
 * Integrates PDF page extraction with visual judging to score
 * book pages for print quality.
 */

import { extractPdfPages, cleanupTempDir, isPdftoppmAvailable } from './pdf-to-images'
import { judgePageVisual, JudgeContext, JudgeOptions } from './testing/visual-judge'
import { PageScore } from './visual-scores-report'
import { BookEntry, BookPageType } from './curator'

// ============================================================================
// Types
// ============================================================================

export interface ScoringOptions {
  verbose?: boolean
  provider?: 'bedrock' | 'gemini' | 'anthropic' | 'auto'
  resolution?: number
  skipTypes?: BookPageType[]  // Page types to skip scoring
  outputDir?: string          // Directory to save extracted page images (persistent)
}

export interface ScoringResult {
  pageScores: PageScore[]
  totalPages: number
  scoredPages: number
  skippedPages: number
  errorPages: number
  averageScore: number
}

// ============================================================================
// Custom Prompts for Specific Page Types
// ============================================================================

/**
 * Get a custom evaluation prompt for specific page types.
 * Returns undefined to use the default prompt.
 */
function getCustomPromptForPageType(pageType: string, theme?: { primaryColor: string; accentColor: string; backgroundColor: string }): string | undefined {
  if (pageType === 'ACTIVITY_LOG') {
    let themeInfo = ''
    if (theme) {
      themeInfo = `Theme: Primary=${theme.primaryColor}, Accent=${theme.accentColor}, Background=${theme.backgroundColor}`
    }

    return `You are evaluating an ACTIVITY LOG page from a Strava coffee-table book.

This page displays a 2-column grid of activity cards. Each card should show:
- A satellite map image with the activity route overlaid (orange/accent line on satellite imagery)
- Activity name and date
- Key stats (distance, time, pace, elevation)
- Optional: kudos count, comments, PR badge

${themeInfo}

Evaluate on these criteria (score 0-100 each):

1. SATELLITE MAPS (40%)
- Do activity cards with GPS routes show SATELLITE IMAGERY backgrounds (aerial photos, not plain colors)?
- Is the route line visible against the satellite background?
- Are maps properly sized and not pixelated?
- Cards without GPS data should show a placeholder with activity type

2. PAGE DIMENSIONS & LAYOUT (30%)
- Is the page square (equal width and height)?
- Is the 2-column grid evenly spaced?
- Are cards consistently sized?
- Is there appropriate whitespace between cards?

3. STYLE GUIDE COMPLIANCE (30%)
- Are fonts consistent (headings vs body text)?
- Are colors from the theme used consistently (no random colors)?
- Is text readable (appropriate size, contrast)?
- Are stats clearly formatted and aligned?

IMPORTANT: The most critical requirement is that activity cards with GPS routes MUST show satellite map imagery (aerial photography) behind the route line. If maps are showing plain colors instead of satellite photos, this is a major failure.

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "printReadability": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "layoutBalance": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "brandCohesion": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "overallScore": <0-100>,
  "pass": <true if overall >= 70 and all cards with routes have satellite maps>,
  "summary": "Brief 1-2 sentence assessment",
  "suggestions": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"]
}`
  }

  return undefined
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score all pages in a PDF using visual judging
 *
 * @param pdfBuffer - The rendered PDF as a buffer
 * @param entries - Book entries with page metadata
 * @param theme - Book theme for context
 * @param options - Scoring options
 * @returns Scoring results with page scores
 */
export async function scorePdfPages(
  pdfBuffer: Buffer,
  entries: BookEntry[],
  theme?: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
  },
  options: ScoringOptions = {}
): Promise<ScoringResult> {
  const {
    verbose = false,
    provider = 'auto',
    resolution = 150,
    skipTypes = [],
    outputDir,
  } = options

  // Check if pdftoppm is available
  const available = await isPdftoppmAvailable()
  if (!available) {
    console.warn('[VisualScoring] pdftoppm not available - skipping visual scoring')
    return createSkippedResult(entries)
  }

  // Extract all pages as PNG images
  if (verbose) {
    console.log('[VisualScoring] Extracting PDF pages...')
    if (outputDir) {
      console.log(`[VisualScoring] Saving pages to: ${outputDir}`)
    }
  }

  let extraction
  try {
    extraction = await extractPdfPages(pdfBuffer, { resolution, outputDir })
  } catch (error) {
    console.error('[VisualScoring] Failed to extract PDF pages:', error)
    return createSkippedResult(entries)
  }

  if (verbose) {
    console.log(`[VisualScoring] Extracted ${extraction.totalPages} pages`)
  }

  const pageScores: PageScore[] = []
  let scoredCount = 0
  let skippedCount = 0
  let errorCount = 0
  let totalScore = 0

  const judgeOptions: JudgeOptions = { provider, verbose }

  try {
    // Score each page
    for (const pageImage of extraction.pages) {
      const { pageNumber, imagePath } = pageImage

      // Find corresponding entry
      const entry = entries.find(e => e.pageNumber === pageNumber)
      const pageType = entry?.type || 'UNKNOWN'
      const pageTitle = entry?.title || `Page ${pageNumber}`

      // Check if we should skip this page type
      if (skipTypes.includes(pageType as BookPageType)) {
        pageScores.push({
          pageNumber,
          pageType,
          title: pageTitle,
        })
        skippedCount++
        continue
      }

      // Build judge context with optional custom prompt for specific page types
      const customPrompt = getCustomPromptForPageType(pageType, theme)
      const context: JudgeContext = {
        templateName: pageType,
        pageType,
        pageNumber,
        theme,
        customPrompt,
      }

      try {
        if (verbose) {
          console.log(`[VisualScoring] Scoring page ${pageNumber}: ${pageType}`)
        }

        const judgment = await judgePageVisual(imagePath, context, judgeOptions)

        pageScores.push({
          pageNumber,
          pageType,
          title: pageTitle,
          judgment,
        })

        totalScore += judgment.overallScore
        scoredCount++

        if (verbose) {
          console.log(`[VisualScoring] Page ${pageNumber} score: ${judgment.overallScore}`)
        }
      } catch (error) {
        if (verbose) {
          console.error(`[VisualScoring] Error scoring page ${pageNumber}:`, error)
        }

        pageScores.push({
          pageNumber,
          pageType,
          title: pageTitle,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        errorCount++
      }
    }
  } finally {
    // Only clean up if using temp directory (not custom outputDir)
    if (!outputDir) {
      await cleanupTempDir(extraction.tempDir)
    }
  }

  const averageScore = scoredCount > 0 ? totalScore / scoredCount : 0

  return {
    pageScores,
    totalPages: extraction.totalPages,
    scoredPages: scoredCount,
    skippedPages: skippedCount,
    errorPages: errorCount,
    averageScore,
  }
}

/**
 * Score only a sample of pages (faster, for quick evaluation)
 *
 * @param pdfBuffer - The rendered PDF as a buffer
 * @param entries - Book entries with page metadata
 * @param sampleSize - Number of pages to sample
 * @param theme - Book theme for context
 * @param options - Scoring options
 */
export async function scoreSamplePages(
  pdfBuffer: Buffer,
  entries: BookEntry[],
  sampleSize: number = 5,
  theme?: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
  },
  options: ScoringOptions = {}
): Promise<ScoringResult> {
  const { verbose = false, provider = 'auto', resolution = 150 } = options

  // Check if pdftoppm is available
  const available = await isPdftoppmAvailable()
  if (!available) {
    console.warn('[VisualScoring] pdftoppm not available - skipping visual scoring')
    return createSkippedResult(entries)
  }

  // Import extractSamplePages
  const { extractSamplePages } = await import('./pdf-to-images')

  const totalPages = entries.length

  if (verbose) {
    console.log(`[VisualScoring] Extracting ${sampleSize} sample pages from ${totalPages} total`)
  }

  let extraction
  try {
    extraction = await extractSamplePages(pdfBuffer, totalPages, sampleSize)
  } catch (error) {
    console.error('[VisualScoring] Failed to extract sample pages:', error)
    return createSkippedResult(entries)
  }

  const pageScores: PageScore[] = []
  let scoredCount = 0
  let errorCount = 0
  let totalScore = 0

  const judgeOptions: JudgeOptions = { provider, verbose }

  try {
    // Score sampled pages
    for (const pageImage of extraction.pages) {
      const { pageNumber, imagePath } = pageImage

      // Find corresponding entry
      const entry = entries.find(e => e.pageNumber === pageNumber)
      const pageType = entry?.type || 'UNKNOWN'
      const pageTitle = entry?.title || `Page ${pageNumber}`

      // Build judge context with optional custom prompt for specific page types
      const customPrompt = getCustomPromptForPageType(pageType, theme)
      const context: JudgeContext = {
        templateName: pageType,
        pageType,
        pageNumber,
        theme,
        customPrompt,
      }

      try {
        if (verbose) {
          console.log(`[VisualScoring] Scoring page ${pageNumber}: ${pageType}`)
        }

        const judgment = await judgePageVisual(imagePath, context, judgeOptions)

        pageScores.push({
          pageNumber,
          pageType,
          title: pageTitle,
          judgment,
        })

        totalScore += judgment.overallScore
        scoredCount++
      } catch (error) {
        pageScores.push({
          pageNumber,
          pageType,
          title: pageTitle,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        errorCount++
      }
    }

    // Add placeholder entries for unscored pages
    for (const entry of entries) {
      const pageNumber = entry.pageNumber || 0
      if (!pageScores.find(p => p.pageNumber === pageNumber)) {
        pageScores.push({
          pageNumber,
          pageType: entry.type,
          title: entry.title,
          // No judgment = skipped
        })
      }
    }

    // Sort by page number
    pageScores.sort((a, b) => a.pageNumber - b.pageNumber)
  } finally {
    // Clean up temp directory
    await cleanupTempDir(extraction.tempDir)
  }

  const averageScore = scoredCount > 0 ? totalScore / scoredCount : 0

  return {
    pageScores,
    totalPages: entries.length,
    scoredPages: scoredCount,
    skippedPages: entries.length - scoredCount - errorCount,
    errorPages: errorCount,
    averageScore,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a result object when scoring is skipped
 */
function createSkippedResult(entries: BookEntry[]): ScoringResult {
  const pageScores: PageScore[] = entries.map((entry, idx) => ({
    pageNumber: entry.pageNumber || idx + 1,
    pageType: entry.type,
    title: entry.title,
    // No judgment = skipped
  }))

  return {
    pageScores,
    totalPages: entries.length,
    scoredPages: 0,
    skippedPages: entries.length,
    errorPages: 0,
    averageScore: 0,
  }
}

