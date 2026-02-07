/**
 * Book Manifest Builder
 *
 * Converts BookEntry[] (from generateBookEntries/generateSmartDraft) into a
 * BookManifest suitable for the book reviewer agent. The manifest captures
 * enough metadata for the reviewer to reason about variety, pacing, and
 * narrative without seeing every pixel.
 *
 * IMPORTANT: The manifest expands each BookEntry into the actual number of
 * PDF pages it will render. Race sections produce 1-6 pages depending on
 * variant and data; monthly dividers produce 2-page spreads; TOC can span
 * multiple pages. The totalPages count must match the rendered PDF exactly.
 */

import { BookEntry, BookPageType } from './curator'
import { StravaActivity } from './strava'
import { buildSectionManifest } from '@/lib/testing/section-manifest'
import { RaceSectionVariant, MonthlyDividerVariant } from './book-types'
import { applyVariantSelection, insertBlankPagesForPrint } from '@/components/templates/BookDocument'

// ============================================================================
// Types
// ============================================================================

export interface BookManifestPage {
  pageNumber: number
  type: BookPageType
  title?: string
  activityId?: number
  variant?: string
  photoCount?: number
  hasMap?: boolean
  wordCount?: number
  /** For multi-page entries, which sub-page this is (e.g. "hero", "stats", "photos") */
  subPageType?: string
}

export interface BookManifest {
  pages: BookManifestPage[]
  totalPages: number
  raceCount: number
  monthCount: number
  aRace?: string
}

export interface BuildManifestOptions {
  /** Mapbox token — affects editorial variant page count (map page) */
  mapboxToken?: string
  /** If true, account for blank pages inserted for print spreads */
  printReady?: boolean
}

// ============================================================================
// Page count per entry type
// ============================================================================

/** Monthly divider spreads always render 2 pages (all variants) */
const MONTHLY_DIVIDER_PAGES = 2

/** Simple entry types that always render exactly 1 page */
const SINGLE_PAGE_TYPES: BookPageType[] = [
  'COVER',
  'FOREWORD',
  'YEAR_STATS',
  'YEAR_AT_A_GLANCE',
  'ACTIVITY_LOG',
  'BEST_EFFORTS',
  'ROUTE_HEATMAP',
  'STATS_SUMMARY',
  'BACK_COVER',
  'BLANK_PAGE',
]

// ============================================================================
// TOC page count — mirrors TableOfContents.tsx getTocPageCount()
// ============================================================================

const ENTRIES_PER_PAGE_FIRST = 12
const ENTRIES_PER_PAGE_CONTINUATION = 16

/**
 * Calculate how many TOC pages are needed.
 * Mirrors the logic in TableOfContents.tsx exactly.
 */
function computeTocPageCount(tocEntryCount: number): number {
  if (tocEntryCount <= ENTRIES_PER_PAGE_FIRST) return 1
  const remaining = tocEntryCount - ENTRIES_PER_PAGE_FIRST
  return 1 + Math.ceil(remaining / ENTRIES_PER_PAGE_CONTINUATION)
}

/**
 * Count TOC entries the same way BookDocument.tsx does:
 * exclude COVER, TABLE_OF_CONTENTS, ACTIVITY_LOG, BLANK_PAGE, BACK_COVER
 */
function countTocEntries(entries: BookEntry[]): number {
  return entries.filter(entry =>
    entry.type !== 'COVER' &&
    entry.type !== 'TABLE_OF_CONTENTS' &&
    entry.type !== 'ACTIVITY_LOG' &&
    entry.type !== 'BLANK_PAGE' &&
    entry.type !== 'BACK_COVER'
  ).length
}

// ============================================================================
// Builder
// ============================================================================

/**
 * Build a BookManifest from BookEntry[] and the activity list.
 *
 * Each BookEntry is expanded into its actual rendered page count:
 * - RACE_PAGE: uses buildSectionManifest to predict exact pages per variant
 * - MONTHLY_DIVIDER: always 2 pages (spread)
 * - TABLE_OF_CONTENTS: 1+ pages based on entry count
 * - All others: 1 page each
 *
 * When printReady is true, also accounts for blank pages inserted by
 * insertBlankPagesForPrint().
 *
 * @param entries    - The book entries produced by generateBookEntries or generateSmartDraft
 * @param activities - All Strava activities (used to enrich manifest with metadata)
 * @param options    - Optional settings (mapboxToken, printReady)
 */
export function buildManifest(
  entries: BookEntry[],
  activities: StravaActivity[],
  options: BuildManifestOptions = {}
): BookManifest {
  const { mapboxToken, printReady = false } = options

  const activityMap = new Map<number, StravaActivity>()
  for (const a of activities) {
    activityMap.set(a.id, a)
  }

  // Step 1: Apply variant selection (same as BookDocument.tsx)
  const enrichedEntries = applyVariantSelection(entries, activities)

  // Step 2: Insert blank pages for print if requested (same as BookDocument.tsx)
  const processedEntries = printReady
    ? insertBlankPagesForPrint(enrichedEntries)
    : enrichedEntries

  // Step 3: Compute TOC entry count from the original (non-print-processed) entries
  // BookDocument.tsx builds TOC from the original entries, not processedEntries
  const tocEntryCount = countTocEntries(entries)

  // Step 4: Expand each entry into its actual page count
  const pages: BookManifestPage[] = []
  let currentPage = 1

  for (const entry of processedEntries) {
    const activity = entry.activityId ? activityMap.get(entry.activityId) : undefined

    if (entry.type === 'RACE_PAGE') {
      // Use section manifest to predict exact page count for this variant + activity
      if (!activity) {
        // No activity found — BookDocument.tsx returns null, so 0 pages
        continue
      }
      const variant: RaceSectionVariant = entry.raceVariant || 'default'
      const sectionManifest = buildSectionManifest(activity, variant, mapboxToken)

      for (const subPage of sectionManifest.pages) {
        pages.push({
          pageNumber: currentPage++,
          type: 'RACE_PAGE',
          title: entry.title,
          activityId: entry.activityId,
          variant,
          subPageType: subPage.pageType,
          photoCount: subPage.hasPhoto ? countPhotos(entry, activity) : 0,
          hasMap: subPage.hasMap,
          wordCount: subPage.hasDescription ? estimateWordCount(entry, activity) : 0,
        })
      }
    } else if (entry.type === 'TABLE_OF_CONTENTS') {
      const tocPages = computeTocPageCount(tocEntryCount)
      for (let i = 0; i < tocPages; i++) {
        pages.push({
          pageNumber: currentPage++,
          type: 'TABLE_OF_CONTENTS',
          title: i === 0 ? entry.title : `${entry.title} (continued)`,
          variant: undefined,
          subPageType: i === 0 ? 'toc' : 'toc-continuation',
        })
      }
    } else if (entry.type === 'MONTHLY_DIVIDER') {
      const variant: MonthlyDividerVariant = entry.monthlyDividerVariant || 'default'
      for (let i = 0; i < MONTHLY_DIVIDER_PAGES; i++) {
        pages.push({
          pageNumber: currentPage++,
          type: 'MONTHLY_DIVIDER',
          title: entry.title,
          variant,
          subPageType: i === 0 ? 'left' : 'right',
          photoCount: i === 0 ? countPhotosForMonth(entry, activities) : 0,
          wordCount: i === 0 ? estimateWordCount(entry, undefined) : 0,
        })
      }
    } else if (SINGLE_PAGE_TYPES.includes(entry.type)) {
      const variant = entry.activityLogVariant
      pages.push({
        pageNumber: currentPage++,
        type: entry.type,
        title: entry.title,
        activityId: entry.activityId,
        variant: variant || undefined,
        photoCount: countPhotos(entry, activity),
        hasMap: hasMap(activity),
        wordCount: estimateWordCount(entry, activity),
      })
    } else {
      // Unknown entry type — render as 1 page (matches BookDocument.tsx fallback)
      pages.push({
        pageNumber: currentPage++,
        type: entry.type,
        title: entry.title,
        activityId: entry.activityId,
        wordCount: estimateWordCount(entry, activity),
      })
    }
  }

  // Count unique months from MONTHLY_DIVIDER entries
  const monthSet = new Set<string>()
  for (const entry of processedEntries) {
    if (entry.type === 'MONTHLY_DIVIDER' && entry.month !== undefined && entry.year !== undefined) {
      monthSet.add(`${entry.year}-${entry.month}`)
    }
  }

  // Count race entries (not race pages — one entry per race)
  const raceCount = processedEntries.filter(e => e.type === 'RACE_PAGE').length

  // Detect A-race (longest race by distance)
  const raceActivities = processedEntries
    .filter(e => e.type === 'RACE_PAGE' && e.activityId)
    .map(e => activityMap.get(e.activityId!))
    .filter((a): a is StravaActivity => !!a)

  const aRace = raceActivities.length > 0
    ? [...raceActivities].sort((a, b) => b.distance - a.distance)[0]
    : undefined

  return {
    pages,
    totalPages: pages.length,
    raceCount,
    monthCount: monthSet.size,
    aRace: aRace?.name,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function countPhotos(entry: BookEntry, activity?: StravaActivity): number {
  if (!activity) return 0

  // Check comprehensive data first
  const comprehensivePhotos = activity.comprehensiveData?.photos?.length ?? 0
  if (comprehensivePhotos > 0) return comprehensivePhotos

  // Fall back to photo count from activity summary
  return activity.total_photo_count ?? activity.photos?.count ?? 0
}

function countPhotosForMonth(entry: BookEntry, activities: StravaActivity[]): number {
  if (entry.month === undefined || entry.year === undefined) return 0
  const monthActivities = activities.filter(a => {
    const d = new Date(a.start_date_local || a.start_date)
    return d.getMonth() === entry.month && d.getFullYear() === entry.year
  })
  let total = 0
  for (const a of monthActivities) {
    total += a.comprehensiveData?.photos?.length ?? a.total_photo_count ?? a.photos?.count ?? 0
  }
  return total
}

function hasMap(activity?: StravaActivity): boolean {
  if (!activity) return false
  return !!(activity.map?.summary_polyline)
}

function estimateWordCount(entry: BookEntry, activity?: StravaActivity): number {
  let words = 0

  // Title
  if (entry.title) {
    words += entry.title.split(/\s+/).length
  }

  // Activity description
  if (activity?.description) {
    words += activity.description.split(/\s+/).length
  }

  // Foreword text
  if (entry.forewordText) {
    words += entry.forewordText.split(/\s+/).length
  }

  return words
}
