/**
 * Section Judge — Evaluates a Race Section (1-6 pages) as a Cohesive Unit
 *
 * Sits between the page-level visual judge (single page) and the
 * book-level reviewer (whole book). Two modes:
 *
 * 1. Heuristic (judgeSectionHeuristic) — fast, deterministic, no rendering.
 *    Default for CI.
 * 2. LLM-powered (judgeSectionVisual) — renders to PDF/PNG, sends to LLM.
 *    Uses the Bedrock → Gemini fallback chain via llm-provider.
 */

import * as fs from 'fs'
import { StravaActivity } from '@/lib/strava'
import { RaceSectionVariant } from '@/lib/book-types'
import { callLlmWithImages, stripJsonFences } from '@/lib/llm-provider'
import {
  SectionJudgment,
  SectionCriterionScore,
  buildSectionJudgePrompt,
} from './section-judge-rubric'

export type { SectionJudgment, SectionCriterionScore }

// ============================================================================
// Section Manifest
// ============================================================================

export interface PageManifest {
  pageIndex: number
  pageType: 'hero' | 'description' | 'comments' | 'stats' | 'photos' | 'map' | 'combined'
  hasPhoto: boolean
  hasDescription: boolean
  hasStats: boolean
  hasComments: boolean
  hasMap: boolean
  hasSplits: boolean
  hasBestEfforts: boolean
  estimatedFillRatio: number
}

export interface SectionManifest {
  variantName: RaceSectionVariant
  pageCount: number
  pages: PageManifest[]
  availableData: {
    hasPhotos: boolean
    photoCount: number
    hasDescription: boolean
    descriptionLength: number
    hasComments: boolean
    commentCount: number
    hasMap: boolean
    hasSplits: boolean
    splitCount: number
    hasBestEfforts: boolean
    bestEffortCount: number
    kudosCount: number
  }
}

// ============================================================================
// Data Analysis Helpers
// ============================================================================

function analyzeActivityData(activity: StravaActivity) {
  const photos = activity.comprehensiveData?.photos || activity.allPhotos || []
  const comments = activity.comprehensiveData?.comments || activity.comments || []
  const hasPhotos = photos.length > 0 || (activity.total_photo_count ?? 0) > 0
  const photoCount = photos.length || activity.total_photo_count || 0
  const hasDescription = !!activity.description
  const descriptionLength = activity.description?.length || 0
  const hasComments = comments.length > 0
  const commentCount = comments.length || activity.comment_count || 0
  const hasMap = !!(activity.map?.summary_polyline)
  const hasSplits = !!(activity.splits_metric && activity.splits_metric.length > 0)
  const splitCount = activity.splits_metric?.length || 0
  const hasBestEfforts = !!(activity.best_efforts && activity.best_efforts.length > 0)
  const bestEffortCount = activity.best_efforts?.length || 0
  const kudosCount = activity.kudos_count || 0

  return {
    hasPhotos, photoCount,
    hasDescription, descriptionLength,
    hasComments, commentCount,
    hasMap,
    hasSplits, splitCount,
    hasBestEfforts, bestEffortCount,
    kudosCount,
  }
}

// ============================================================================
// Expected Page Orders per Variant
// ============================================================================

type PageType = PageManifest['pageType']

const VARIANT_PAGE_ORDERS: Record<RaceSectionVariant, PageType[]> = {
  'default': ['hero', 'description', 'comments', 'stats', 'photos'],
  'editorial': ['photos', 'map', 'description', 'stats', 'comments'],
  'magazine': ['hero', 'description', 'photos', 'stats'],
  'map-hero': ['combined'],
  'photo-essay': ['combined'],
  'stats-forward': ['combined'],
  'compact': ['combined'],
}

// Max pages per variant
const VARIANT_MAX_PAGES: Record<RaceSectionVariant, number> = {
  'default': 6,   // hero + desc + comments + stats + 2 photo pages
  'editorial': 5,
  'magazine': 4,
  'map-hero': 1,
  'photo-essay': 1,
  'stats-forward': 1,
  'compact': 1,
}

// ============================================================================
// Build Section Manifest
// ============================================================================

/**
 * Analyze what a variant WOULD render given the activity data.
 * Returns a manifest of expected pages and their content.
 */
export function buildSectionManifest(
  activity: StravaActivity,
  variantName: RaceSectionVariant
): SectionManifest {
  const data = analyzeActivityData(activity)
  const pages: PageManifest[] = []

  switch (variantName) {
    case 'default':
      buildDefaultManifest(pages, data)
      break
    case 'editorial':
      buildEditorialManifest(pages, data)
      break
    case 'magazine':
      buildMagazineManifest(pages, data)
      break
    case 'map-hero':
      buildSinglePageManifest(pages, data, 'combined', true, false, true, false, true)
      break
    case 'photo-essay':
      buildSinglePageManifest(pages, data, 'combined', true, false, true, false, false)
      break
    case 'stats-forward':
      buildSinglePageManifest(pages, data, 'combined', data.hasPhotos, false, true, false, data.hasMap)
      break
    case 'compact':
      buildCompactManifest(pages, data)
      break
  }

  return {
    variantName,
    pageCount: pages.length,
    pages,
    availableData: data,
  }
}

function buildDefaultManifest(
  pages: PageManifest[],
  data: ReturnType<typeof analyzeActivityData>
) {
  let idx = 0

  // Hero page (always)
  pages.push({
    pageIndex: idx++,
    pageType: 'hero',
    hasPhoto: data.hasPhotos,
    hasDescription: false,
    hasStats: true,
    hasComments: false,
    hasMap: false,
    hasSplits: false,
    hasBestEfforts: false,
    estimatedFillRatio: data.hasPhotos ? 0.8 : 0.5,
  })

  // Description page (if exists)
  if (data.hasDescription) {
    const inlineComments = data.commentCount < 3
    pages.push({
      pageIndex: idx++,
      pageType: 'description',
      hasPhoto: false,
      hasDescription: true,
      hasStats: false,
      hasComments: inlineComments && data.hasComments,
      hasMap: false,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: 0.3 + (data.descriptionLength > 200 ? 0.3 : 0.1) + (inlineComments && data.hasComments ? 0.1 : 0),
    })
  }

  // Comments page (if 3+ comments)
  if (data.commentCount >= 3) {
    pages.push({
      pageIndex: idx++,
      pageType: 'comments',
      hasPhoto: false,
      hasDescription: false,
      hasStats: false,
      hasComments: true,
      hasMap: false,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: Math.min(0.8, 0.1 + data.commentCount * 0.05),
    })
  }

  // Stats page (always)
  pages.push({
    pageIndex: idx++,
    pageType: 'stats',
    hasPhoto: false,
    hasDescription: false,
    hasStats: true,
    hasComments: false,
    hasMap: data.hasMap,
    hasSplits: data.hasSplits,
    hasBestEfforts: data.hasBestEfforts,
    estimatedFillRatio: 0.3 + (data.hasMap ? 0.3 : 0) + (data.hasSplits ? 0.1 : 0) + (data.hasBestEfforts ? 0.1 : 0),
  })

  // Photo pages
  if (data.photoCount > 0) {
    const photoPages = Math.ceil(data.photoCount / 4)
    for (let i = 0; i < photoPages; i++) {
      const photosOnPage = Math.min(4, data.photoCount - i * 4)
      pages.push({
        pageIndex: idx++,
        pageType: 'photos',
        hasPhoto: true,
        hasDescription: false,
        hasStats: false,
        hasComments: false,
        hasMap: false,
        hasSplits: false,
        hasBestEfforts: false,
        estimatedFillRatio: photosOnPage * 0.2,
      })
    }
  }
}

function buildEditorialManifest(
  pages: PageManifest[],
  data: ReturnType<typeof analyzeActivityData>
) {
  let idx = 0

  // Photo gallery page (if photos exist)
  if (data.hasPhotos) {
    pages.push({
      pageIndex: idx++,
      pageType: 'photos',
      hasPhoto: true,
      hasDescription: false,
      hasStats: false,
      hasComments: false,
      hasMap: false,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: Math.min(0.9, data.photoCount * 0.15),
    })
  }

  // Map page (if map exists)
  if (data.hasMap) {
    pages.push({
      pageIndex: idx++,
      pageType: 'map',
      hasPhoto: false,
      hasDescription: false,
      hasStats: true,
      hasComments: false,
      hasMap: true,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: 0.7,
    })
  }

  // Description + splits page (always)
  const shouldInlineComments = data.commentCount <= 3 && data.descriptionLength < 300
  pages.push({
    pageIndex: idx++,
    pageType: 'description',
    hasPhoto: data.hasPhotos,
    hasDescription: data.hasDescription,
    hasStats: false,
    hasComments: shouldInlineComments && data.hasComments,
    hasMap: false,
    hasSplits: data.hasSplits,
    hasBestEfforts: false,
    estimatedFillRatio: 0.2 + (data.hasDescription ? 0.3 : 0) + (data.hasSplits ? 0.15 : 0) + (shouldInlineComments && data.hasComments ? 0.1 : 0),
  })

  // Stats + best efforts page (always)
  pages.push({
    pageIndex: idx++,
    pageType: 'stats',
    hasPhoto: false,
    hasDescription: false,
    hasStats: true,
    hasComments: false,
    hasMap: false,
    hasSplits: data.hasSplits,
    hasBestEfforts: data.hasBestEfforts,
    estimatedFillRatio: 0.3 + (data.hasSplits ? 0.2 : 0) + (data.hasBestEfforts ? 0.2 : 0),
  })

  // Comments page (if not inlined)
  if (data.hasComments && !shouldInlineComments) {
    pages.push({
      pageIndex: idx++,
      pageType: 'comments',
      hasPhoto: false,
      hasDescription: false,
      hasStats: false,
      hasComments: true,
      hasMap: false,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: Math.min(0.8, 0.1 + data.commentCount * 0.05),
    })
  }
}

function buildMagazineManifest(
  pages: PageManifest[],
  data: ReturnType<typeof analyzeActivityData>
) {
  let idx = 0

  // Hero page (always)
  pages.push({
    pageIndex: idx++,
    pageType: 'hero',
    hasPhoto: data.hasPhotos,
    hasDescription: false,
    hasStats: false,
    hasComments: false,
    hasMap: data.hasMap,
    hasSplits: false,
    hasBestEfforts: false,
    estimatedFillRatio: data.hasPhotos || data.hasMap ? 0.8 : 0.3,
  })

  // Description page (only if description exists)
  if (data.hasDescription) {
    pages.push({
      pageIndex: idx++,
      pageType: 'description',
      hasPhoto: false,
      hasDescription: true,
      hasStats: false,
      hasComments: false,
      hasMap: data.hasMap,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: 0.6,
    })
  }

  // Photo collage page (only if photos exist)
  if (data.hasPhotos) {
    pages.push({
      pageIndex: idx++,
      pageType: 'photos',
      hasPhoto: true,
      hasDescription: false,
      hasStats: false,
      hasComments: false,
      hasMap: false,
      hasSplits: false,
      hasBestEfforts: false,
      estimatedFillRatio: Math.min(0.9, data.photoCount * 0.15),
    })
  }

  // Stats page (always)
  pages.push({
    pageIndex: idx++,
    pageType: 'stats',
    hasPhoto: false,
    hasDescription: false,
    hasStats: true,
    hasComments: data.hasComments,
    hasMap: false,
    hasSplits: data.hasSplits,
    hasBestEfforts: false,
    estimatedFillRatio: 0.3 + (data.hasSplits ? 0.2 : 0) + (data.hasComments ? 0.1 : 0),
  })
}

function buildCompactManifest(
  pages: PageManifest[],
  data: ReturnType<typeof analyzeActivityData>
) {
  pages.push({
    pageIndex: 0,
    pageType: 'combined',
    hasPhoto: data.hasPhotos,
    hasDescription: data.hasDescription,
    hasStats: true,
    hasComments: false,
    hasMap: data.hasMap,
    hasSplits: data.hasSplits,
    hasBestEfforts: data.hasBestEfforts,
    estimatedFillRatio: 0.2 +
      (data.hasPhotos ? 0.2 : 0) +
      (data.hasDescription ? 0.15 : 0) +
      (data.hasSplits ? 0.1 : 0) +
      (data.hasBestEfforts ? 0.1 : 0) +
      (data.hasMap ? 0.15 : 0),
  })
}

function buildSinglePageManifest(
  pages: PageManifest[],
  data: ReturnType<typeof analyzeActivityData>,
  pageType: PageType,
  hasPhoto: boolean,
  hasDescription: boolean,
  hasStats: boolean,
  hasComments: boolean,
  hasMap: boolean,
) {
  const fillRatio = 0.2 +
    (hasPhoto && data.hasPhotos ? 0.3 : 0) +
    (hasDescription && data.hasDescription ? 0.2 : 0) +
    (hasStats ? 0.2 : 0) +
    (hasComments && data.hasComments ? 0.1 : 0) +
    (hasMap && data.hasMap ? 0.2 : 0)

  pages.push({
    pageIndex: 0,
    pageType,
    hasPhoto: hasPhoto && data.hasPhotos,
    hasDescription: hasDescription && data.hasDescription,
    hasStats,
    hasComments: hasComments && data.hasComments,
    hasMap: hasMap && data.hasMap,
    hasSplits: false,
    hasBestEfforts: false,
    estimatedFillRatio: Math.min(0.95, fillRatio),
  })
}

// ============================================================================
// Heuristic Judge
// ============================================================================

/**
 * Fast, deterministic section evaluation. No rendering needed.
 * Default for CI tests.
 */
export function judgeSectionHeuristic(
  activity: StravaActivity,
  variantName: RaceSectionVariant
): SectionJudgment {
  const manifest = buildSectionManifest(activity, variantName)
  const data = manifest.availableData

  // --- 1. Completeness ---
  let completenessScore = 100
  const completenessIssues: string[] = []

  if (data.hasPhotos && !manifest.pages.some(p => p.hasPhoto)) {
    completenessScore -= 30
    completenessIssues.push('Photos available but no page shows them')
  }
  if (data.hasDescription && !manifest.pages.some(p => p.hasDescription)) {
    completenessScore -= 20
    completenessIssues.push('Description available but no page shows it')
  }
  if (data.hasSplits && !manifest.pages.some(p => p.hasSplits || p.hasStats)) {
    completenessScore -= 15
    completenessIssues.push('Splits available but no page shows them')
  }
  if (data.hasComments && data.commentCount >= 3 && !manifest.pages.some(p => p.hasComments)) {
    completenessScore -= 15
    completenessIssues.push(`${data.commentCount} comments available but no page shows them`)
  }

  completenessScore = Math.max(0, completenessScore)

  // --- 2. Page Utilization ---
  let utilizationScore = 100
  const utilizationIssues: string[] = []

  for (const page of manifest.pages) {
    if (page.estimatedFillRatio < 0.1) {
      utilizationScore -= 30
      utilizationIssues.push(`Page ${page.pageIndex + 1} (${page.pageType}) appears empty (fill: ${(page.estimatedFillRatio * 100).toFixed(0)}%)`)
    } else if (page.estimatedFillRatio < 0.2) {
      utilizationScore -= 15
      utilizationIssues.push(`Page ${page.pageIndex + 1} (${page.pageType}) appears sparse (fill: ${(page.estimatedFillRatio * 100).toFixed(0)}%)`)
    }
  }

  utilizationScore = Math.max(0, utilizationScore)

  // --- 3. Content Flow ---
  let flowScore = 100
  const flowIssues: string[] = []

  const expectedOrder = VARIANT_PAGE_ORDERS[variantName]
  if (expectedOrder.length > 1) {
    const actualTypes = manifest.pages.map(p => p.pageType)
    // Check that actual types follow the expected order
    let expectedIdx = 0
    for (const actualType of actualTypes) {
      // Find this type in the expected order from current position
      let found = false
      for (let i = expectedIdx; i < expectedOrder.length; i++) {
        if (expectedOrder[i] === actualType) {
          expectedIdx = i + 1
          found = true
          break
        }
      }
      if (!found) {
        flowScore -= 10
        flowIssues.push(`Page type '${actualType}' appears out of expected order for ${variantName}`)
      }
    }
  }

  flowScore = Math.max(0, flowScore)

  // --- 4. Graceful Degradation ---
  let degradationScore = 70
  const degradationIssues: string[] = []

  const maxPages = VARIANT_MAX_PAGES[variantName]
  const dataAvailable = [
    data.hasPhotos, data.hasDescription, data.hasComments,
    data.hasMap, data.hasSplits, data.hasBestEfforts,
  ]
  const dataDimensionsPresent = dataAvailable.filter(Boolean).length
  const dataDimensionsTotal = dataAvailable.length

  // If most data is missing but page count is at max, that's bad
  if (dataDimensionsPresent <= 1 && manifest.pageCount >= maxPages && maxPages > 1) {
    degradationScore -= 20
    degradationIssues.push(`Section renders ${manifest.pageCount} pages despite most data being missing`)
  }

  // Bonus for clean compaction
  if (dataDimensionsPresent <= 2 && manifest.pageCount <= 2) {
    degradationScore += 10
  }
  if (dataDimensionsPresent === 0 && manifest.pageCount === 1) {
    degradationScore += 10
  }

  // Check for sparse pages when data is missing
  const sparsePages = manifest.pages.filter(p => p.estimatedFillRatio < 0.2)
  if (sparsePages.length > 0 && dataDimensionsPresent < dataDimensionsTotal / 2) {
    degradationScore += sparsePages.length <= 1 ? 5 : -5
  }

  degradationScore = Math.max(0, Math.min(100, degradationScore))

  // --- Overall ---
  const overallScore = Math.round(
    (completenessScore + utilizationScore + flowScore + degradationScore) / 4
  )

  const pass = overallScore >= 60 &&
    completenessScore >= 40 &&
    utilizationScore >= 40 &&
    flowScore >= 40 &&
    degradationScore >= 40

  const suggestions: string[] = []
  if (completenessIssues.length > 0) {
    suggestions.push(`Improve completeness: ${completenessIssues[0]}`)
  }
  if (utilizationIssues.length > 0) {
    suggestions.push(`Improve page utilization: ${utilizationIssues[0]}`)
  }
  if (flowIssues.length > 0) {
    suggestions.push(`Fix content flow: ${flowIssues[0]}`)
  }
  if (degradationIssues.length > 0) {
    suggestions.push(`Improve degradation handling: ${degradationIssues[0]}`)
  }

  return {
    completeness: { score: completenessScore, issues: completenessIssues },
    pageUtilization: { score: utilizationScore, issues: utilizationIssues },
    contentFlow: { score: flowScore, issues: flowIssues },
    gracefulDegradation: { score: degradationScore, issues: degradationIssues },
    overallScore,
    pass,
    summary: `${variantName} variant: ${manifest.pageCount} pages, ${dataDimensionsPresent}/${dataDimensionsTotal} data dimensions. Score: ${overallScore}/100.`,
    suggestions,
  }
}

// ============================================================================
// LLM-powered Judge
// ============================================================================

/**
 * Render section to PDF/PNG, send page images to LLM for evaluation.
 * Uses the Bedrock → Gemini fallback chain via llm-provider.
 */
export async function judgeSectionVisual(
  imagePaths: string[],
  activity: StravaActivity,
  variantName: RaceSectionVariant,
  options: { verbose?: boolean } = {}
): Promise<SectionJudgment> {
  const { verbose = false } = options
  const manifest = buildSectionManifest(activity, variantName)

  if (imagePaths.length === 0) {
    return judgeSectionHeuristic(activity, variantName)
  }

  const imagesBase64 = imagePaths.map(p => fs.readFileSync(p).toString('base64'))
  const prompt = buildSectionJudgePrompt(manifest)

  let result
  try {
    result = await callLlmWithImages(
      imagesBase64.map(b64 => ({ base64: b64, format: 'png' as const })),
      prompt,
      { maxTokens: 2000, temperature: 0.1, logPrefix: '[Section Judge]', verbose }
    )
  } catch {
    if (verbose) console.log('[Section Judge] All providers failed, using heuristic')
    return judgeSectionHeuristic(activity, variantName)
  }

  try {
    return { ...parseJudgmentResponse(result.text), provider: result.provider, model: result.model }
  } catch {
    if (verbose) console.log('[Section Judge] Failed to parse LLM response, using heuristic')
    return judgeSectionHeuristic(activity, variantName)
  }
}

function parseJudgmentResponse(responseText: string): SectionJudgment {
  const cleanJson = stripJsonFences(responseText)
  const parsed = JSON.parse(cleanJson)

  const clamp = (v: unknown) => {
    const n = Number(v)
    return isNaN(n) ? 0 : Math.max(0, Math.min(100, Math.round(n)))
  }

  const completeness = { score: clamp(parsed.completeness?.score), issues: parsed.completeness?.issues || [] }
  const pageUtilization = { score: clamp(parsed.pageUtilization?.score), issues: parsed.pageUtilization?.issues || [] }
  const contentFlow = { score: clamp(parsed.contentFlow?.score), issues: parsed.contentFlow?.issues || [] }
  const gracefulDegradation = { score: clamp(parsed.gracefulDegradation?.score), issues: parsed.gracefulDegradation?.issues || [] }

  const overallScore = Math.round(
    (completeness.score + pageUtilization.score + contentFlow.score + gracefulDegradation.score) / 4
  )

  const pass = overallScore >= 60 &&
    completeness.score >= 40 &&
    pageUtilization.score >= 40 &&
    contentFlow.score >= 40 &&
    gracefulDegradation.score >= 40

  return {
    completeness,
    pageUtilization,
    contentFlow,
    gracefulDegradation,
    overallScore,
    pass,
    summary: parsed.summary || '',
    suggestions: parsed.suggestions || [],
  }
}
