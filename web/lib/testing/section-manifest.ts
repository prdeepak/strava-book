/**
 * Section Manifest Builder
 *
 * Predicts the exact page count and page types that each race section variant
 * will render for a given activity. The logic here mirrors the conditional
 * rendering in each variant's .tsx file so that predicted counts exactly match
 * actual React-PDF output.
 */

import { StravaActivity } from '@/lib/strava'
import { RaceSectionVariant } from '@/lib/book-types'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'

// ============================================================================
// Types
// ============================================================================

export interface SectionManifestPage {
  pageIndex: number
  pageType: string
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
  variantName: string
  pageCount: number
  pages: SectionManifestPage[]
}

// ============================================================================
// Shared helpers — mirror the logic in the variant .tsx files
// ============================================================================

/**
 * Count resolvable photos — mirrors the getPhotos() function used across
 * RaceSectionPhotosPage, RaceSectionEditorial, and RaceSectionMagazine.
 *
 * The variants filter photos through resolveImageForPdf which can return null
 * for invalid URLs, so we must do the same filtering here.
 */
function countResolvablePhotos(activity: StravaActivity): number {
  let count = 0

  // Check comprehensiveData photos first
  if (activity.comprehensiveData?.photos?.length) {
    for (const photo of activity.comprehensiveData.photos) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const photoAny = photo as any
      const photoUrls = photoAny.urls as Record<string, string> | undefined
      if (photoUrls) {
        const url = photoUrls['5000'] || photoUrls['600'] || Object.values(photoUrls)[0]
        if (url) {
          const resolved = resolveImageForPdf(url)
          if (resolved) count++
        }
      }
    }
  }

  // Fall back to primary photo if no comprehensiveData photos resolved
  if (count === 0) {
    const primaryUrls = activity.photos?.primary?.urls as Record<string, string> | undefined
    if (primaryUrls) {
      const url = primaryUrls['600'] || primaryUrls['5000'] || Object.values(primaryUrls)[0]
      if (url) {
        const resolved = resolveImageForPdf(url)
        if (resolved) count = 1
      }
    }
  }

  return count
}

function getCommentCount(activity: StravaActivity): number {
  return activity.comprehensiveData?.comments?.length || activity.comments?.length || 0
}

function getComments(activity: StravaActivity): unknown[] {
  return activity.comprehensiveData?.comments || activity.comments || []
}

function hasMap(activity: StravaActivity, mapboxToken?: string): boolean {
  return !!(mapboxToken && activity.map?.summary_polyline)
}

function makePage(
  pageIndex: number,
  pageType: string,
  overrides: Partial<SectionManifestPage> = {}
): SectionManifestPage {
  return {
    pageIndex,
    pageType,
    hasPhoto: false,
    hasDescription: false,
    hasStats: false,
    hasComments: false,
    hasMap: false,
    hasSplits: false,
    hasBestEfforts: false,
    estimatedFillRatio: 0.7,
    ...overrides,
  }
}

// ============================================================================
// Variant-specific manifest builders
// ============================================================================

/**
 * Default variant — RaceSection.tsx renderDefaultPages()
 *
 * Pages:
 *   1. Hero (always)
 *   2. Description (if activity.description)
 *   3. Comments (if commentCount >= 3)
 *   4. Stats (always)
 *   5+. Photo pages (ceil(resolvablePhotos / 4))
 */
function buildDefaultManifest(activity: StravaActivity): SectionManifestPage[] {
  const pages: SectionManifestPage[] = []
  let idx = 0

  const hasDescription = !!activity.description
  const commentCount = getCommentCount(activity)
  const hasEnoughComments = commentCount >= 3
  const photoCount = countResolvablePhotos(activity)
  const photoPageCount = Math.ceil(photoCount / 4)

  // 1. Hero — always
  pages.push(makePage(idx++, 'hero', { hasPhoto: true, hasStats: true }))

  // 2. Description — conditional
  if (hasDescription) {
    pages.push(makePage(idx++, 'description', {
      hasDescription: true,
      hasComments: !hasEnoughComments, // inline comments when < 3
    }))
  }

  // 3. Comments — conditional (>= 3 comments)
  if (hasEnoughComments) {
    pages.push(makePage(idx++, 'comments', { hasComments: true }))
  }

  // 4. Stats — always
  pages.push(makePage(idx++, 'stats', {
    hasStats: true,
    hasMap: true,
    hasSplits: !!(activity.splits_metric?.length),
    hasBestEfforts: !!(activity.best_efforts?.length),
  }))

  // 5+. Photo gallery pages
  for (let i = 0; i < photoPageCount; i++) {
    pages.push(makePage(idx++, 'photos', { hasPhoto: true }))
  }

  return pages
}

/**
 * Editorial variant — RaceSectionEditorial.tsx
 *
 * Pages:
 *   1. P1 Photo Gallery (if photos > 0)
 *   2. P2 Panoramic Map (if mapboxToken && summary_polyline)
 *   3. P3 Description+Splits (always)
 *   4. P5 Stats (always)
 *   5. P6 Comments (if comments > 0 AND NOT (comments <= 3 AND description < 300))
 */
function buildEditorialManifest(activity: StravaActivity, mapboxToken?: string): SectionManifestPage[] {
  const pages: SectionManifestPage[] = []
  let idx = 0

  const photoCount = countResolvablePhotos(activity)
  const hasPhotos = photoCount > 0
  const hasMapData = hasMap(activity, mapboxToken)
  const comments = getComments(activity)
  const description = activity.description || ''
  const shouldInlineComments = comments.length <= 3 && description.length < 300
  const showCommentsPage = comments.length > 0 && !shouldInlineComments

  // P1: Photo Gallery
  if (hasPhotos) {
    pages.push(makePage(idx++, 'photos', { hasPhoto: true }))
  }

  // P2: Panoramic Map
  if (hasMapData) {
    pages.push(makePage(idx++, 'map', { hasMap: true }))
  }

  // P3: Description+Splits (always)
  pages.push(makePage(idx++, 'description', {
    hasDescription: true,
    hasSplits: !!(activity.splits_metric?.length),
    hasComments: shouldInlineComments && comments.length > 0,
  }))

  // P5: Stats (always)
  pages.push(makePage(idx++, 'stats', {
    hasStats: true,
    hasBestEfforts: !!(activity.best_efforts?.length),
  }))

  // P6: Comments
  if (showCommentsPage) {
    pages.push(makePage(idx++, 'comments', { hasComments: true }))
  }

  return pages
}

/**
 * Magazine variant — RaceSectionMagazine.tsx
 *
 * Pages:
 *   1. Hero (always)
 *   2. Race Report (if activity.description)
 *   3. Photo Collage (if photos > 0)
 *   4. The Brief (always)
 */
function buildMagazineManifest(activity: StravaActivity): SectionManifestPage[] {
  const pages: SectionManifestPage[] = []
  let idx = 0

  const photoCount = countResolvablePhotos(activity)
  const hasPhotos = photoCount > 0
  const hasDescription = !!activity.description

  // Hero — always
  pages.push(makePage(idx++, 'hero', { hasPhoto: true, hasMap: true }))

  // Race Report — conditional on description
  if (hasDescription) {
    pages.push(makePage(idx++, 'description', { hasDescription: true, hasMap: true }))
  }

  // Photo Collage — conditional
  if (hasPhotos) {
    pages.push(makePage(idx++, 'photos', { hasPhoto: true }))
  }

  // The Brief — always
  pages.push(makePage(idx++, 'stats', {
    hasStats: true,
    hasSplits: !!(activity.splits_metric?.length),
    hasComments: true,
  }))

  return pages
}

/**
 * Map Hero variant — RaceSectionMapHero.tsx
 * Fixed: 1 page always.
 */
function buildMapHeroManifest(_activity: StravaActivity): SectionManifestPage[] {
  return [
    makePage(0, 'hero', {
      hasMap: true,
      hasStats: true,
      hasPhoto: false,
    }),
  ]
}

/**
 * Photo Essay variant — RaceSectionPhotoEssay.tsx
 * Fixed: 1 page always.
 */
function buildPhotoEssayManifest(activity: StravaActivity): SectionManifestPage[] {
  const photoCount = countResolvablePhotos(activity)
  return [
    makePage(0, 'hero', {
      hasPhoto: photoCount > 0,
      hasStats: true,
    }),
  ]
}

/**
 * Stats Forward variant — RaceSectionStatsForward.tsx
 * Fixed: 1 page always.
 */
function buildStatsForwardManifest(activity: StravaActivity): SectionManifestPage[] {
  return [
    makePage(0, 'stats', {
      hasStats: true,
      hasPhoto: countResolvablePhotos(activity) > 0,
      hasBestEfforts: !!(activity.best_efforts?.length),
    }),
  ]
}

/**
 * Compact variant — RaceSectionCompact.tsx
 * Fixed: 1 page always.
 */
function buildCompactManifest(activity: StravaActivity): SectionManifestPage[] {
  return [
    makePage(0, 'compact', {
      hasPhoto: countResolvablePhotos(activity) > 0,
      hasDescription: !!activity.description,
      hasStats: true,
      hasSplits: !!(activity.splits_metric?.length),
      hasBestEfforts: !!(activity.best_efforts?.length),
      hasMap: true,
    }),
  ]
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Build a section manifest that predicts exactly which pages a variant will
 * render for the given activity.
 *
 * @param activity The Strava activity data
 * @param variant Which race section variant to predict for
 * @param mapboxToken Optional Mapbox token (affects editorial variant map page)
 * @returns Manifest with predicted page count and page details
 */
export function buildSectionManifest(
  activity: StravaActivity,
  variant: RaceSectionVariant,
  mapboxToken?: string
): SectionManifest {
  let pages: SectionManifestPage[]

  switch (variant) {
    case 'default':
      pages = buildDefaultManifest(activity)
      break
    case 'editorial':
      pages = buildEditorialManifest(activity, mapboxToken)
      break
    case 'magazine':
      pages = buildMagazineManifest(activity)
      break
    case 'map-hero':
      pages = buildMapHeroManifest(activity)
      break
    case 'photo-essay':
      pages = buildPhotoEssayManifest(activity)
      break
    case 'stats-forward':
      pages = buildStatsForwardManifest(activity)
      break
    case 'compact':
      pages = buildCompactManifest(activity)
      break
    default:
      pages = buildDefaultManifest(activity)
  }

  return {
    variantName: variant,
    pageCount: pages.length,
    pages,
  }
}
