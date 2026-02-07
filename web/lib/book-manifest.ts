/**
 * Book Manifest Builder
 *
 * Converts BookEntry[] (from generateBookEntries/generateSmartDraft) into a
 * BookManifest suitable for the book reviewer agent. The manifest captures
 * enough metadata for the reviewer to reason about variety, pacing, and
 * narrative without seeing every pixel.
 */

import { BookEntry, BookPageType } from './curator'
import { StravaActivity } from './strava'

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
}

export interface BookManifest {
  pages: BookManifestPage[]
  totalPages: number
  raceCount: number
  monthCount: number
  aRace?: string
}

// ============================================================================
// Builder
// ============================================================================

/**
 * Build a BookManifest from BookEntry[] and the activity list.
 *
 * @param entries  - The book entries produced by generateBookEntries or generateSmartDraft
 * @param activities - All Strava activities (used to enrich manifest with metadata)
 */
export function buildManifest(
  entries: BookEntry[],
  activities: StravaActivity[]
): BookManifest {
  const activityMap = new Map<number, StravaActivity>()
  for (const a of activities) {
    activityMap.set(a.id, a)
  }

  const pages: BookManifestPage[] = entries.map((entry, index) => {
    const activity = entry.activityId ? activityMap.get(entry.activityId) : undefined

    return {
      pageNumber: entry.pageNumber ?? index + 1,
      type: entry.type,
      title: entry.title,
      activityId: entry.activityId,
      variant: undefined, // Will be populated when variant system is integrated
      photoCount: countPhotos(entry, activity),
      hasMap: hasMap(activity),
      wordCount: estimateWordCount(entry, activity),
    }
  })

  // Count unique months from MONTHLY_DIVIDER entries
  const monthSet = new Set<string>()
  for (const entry of entries) {
    if (entry.type === 'MONTHLY_DIVIDER' && entry.month !== undefined && entry.year !== undefined) {
      monthSet.add(`${entry.year}-${entry.month}`)
    }
  }

  // Count race pages
  const raceCount = entries.filter(e => e.type === 'RACE_PAGE').length

  // Detect A-race (longest race by distance)
  const raceActivities = entries
    .filter(e => e.type === 'RACE_PAGE' && e.activityId)
    .map(e => activityMap.get(e.activityId!))
    .filter((a): a is StravaActivity => !!a)

  const aRace = raceActivities.length > 0
    ? raceActivities.sort((a, b) => b.distance - a.distance)[0]
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
