/**
 * Book Entry Generator
 *
 * Single source of truth for generating BookEntry[] from activities.
 * Used by both production (generate-manual-book API) and tests (book-integration-test).
 */

import { BookEntry } from './curator'
import { StravaActivity } from './strava'

/**
 * Configuration for book entry generation
 */
export interface BookGenerationConfig {
  // Required
  bookName: string
  athleteName: string
  startDate: string  // ISO date string (YYYY-MM-DD)
  endDate: string    // ISO date string (YYYY-MM-DD)

  // Optional content
  forewordText?: string
  coverPhotoUrl?: string | null
  backgroundPhotoUrl?: string | null
  backCoverPhotoUrl?: string | null

  // Highlight activity IDs by month (key format: "YYYY-MM" with 1-indexed month)
  // If not provided, will auto-select activities with photos
  highlightActivityIds?: Map<string, number>

  // Limits (for testing - production uses no limits)
  maxRaces?: number        // Limit number of race pages
  maxMonths?: number       // Limit number of monthly sections
  activitiesPerPage?: number  // Activities per ACTIVITY_LOG page (default: 6)
}

/**
 * Input data for book generation
 */
export interface BookGenerationInput {
  activities: StravaActivity[]  // All activities (non-races)
  races: StravaActivity[]       // Race activities (workout_type === 1)
}

/**
 * Check if an activity has photos
 */
function activityHasPhotos(activity: StravaActivity): boolean {
  const hasComprehensivePhotos = (activity.comprehensiveData?.photos?.length ?? 0) > 0
  const hasPrimaryPhoto = !!(activity.photos?.primary?.urls &&
    Object.keys(activity.photos.primary.urls).length > 0)
  return hasComprehensivePhotos || hasPrimaryPhoto
}

/**
 * Find the best highlight activity for a month
 * Prefers activities with photos, falls back to any activity
 */
function findHighlightActivity(
  monthActivities: StravaActivity[],
  allActivities: StravaActivity[]
): StravaActivity | undefined {
  // First try to find one from the month's activities with photos
  const monthActivityWithPhotos = monthActivities.find(activityHasPhotos)
  if (monthActivityWithPhotos) return monthActivityWithPhotos

  // Fall back to any activity with photos
  const anyActivityWithPhotos = allActivities.find(activityHasPhotos)
  if (anyActivityWithPhotos) return anyActivityWithPhotos

  // Last resort: first activity in the month
  return monthActivities[0]
}

/**
 * Generate book entries from activities and configuration
 *
 * This is the single source of truth for book structure.
 * Both production API and tests should use this function.
 */
export function generateBookEntries(
  input: BookGenerationInput,
  config: BookGenerationConfig
): BookEntry[] {
  const { activities, races } = input
  const entries: BookEntry[] = []

  // Track page numbers
  let currentPage = 1

  // Get year from date range (use end year as primary for display)
  const endYear = new Date(config.endDate).getFullYear()
  const primaryYear = endYear

  const activitiesPerPage = config.activitiesPerPage ?? 6

  // 1. COVER
  entries.push({
    type: 'COVER',
    title: config.bookName,
    pageNumber: currentPage++,
    heroImage: config.coverPhotoUrl || undefined,
  })

  // 2. FOREWORD
  entries.push({
    type: 'FOREWORD',
    title: 'Foreword',
    forewordText: config.forewordText || undefined,
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // 3. TABLE OF CONTENTS
  entries.push({
    type: 'TABLE_OF_CONTENTS',
    title: 'Contents',
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // Handle empty activities - just add back cover
  const allActivities = [...activities, ...races]
  if (allActivities.length === 0) {
    entries.push({
      type: 'BACK_COVER',
      backCoverPhotoUrl: config.backCoverPhotoUrl || undefined,
      pageNumber: currentPage++,
    })
    return entries
  }

  // 4. YEAR STATS
  entries.push({
    type: 'YEAR_STATS',
    year: primaryYear,
    title: 'Summary',
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // 5. YEAR CALENDAR
  entries.push({
    type: 'YEAR_AT_A_GLANCE',
    year: primaryYear,
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    title: 'Year at a Glance',
    pageNumber: currentPage++,
  })

  // 6. RACE PAGES
  const racesToInclude = config.maxRaces !== undefined
    ? races.slice(0, config.maxRaces)
    : races

  for (const race of racesToInclude) {
    entries.push({
      type: 'RACE_PAGE',
      activityId: race.id,
      title: race.name,
      highlightLabel: race.name,
      pageNumber: currentPage,
    })
    currentPage += 2 // Race spreads use 2 pages
  }

  // 7. MONTHLY SECTIONS
  // Group activities by year-month
  const activitiesByYearMonth = new Map<string, StravaActivity[]>()

  for (const activity of allActivities) {
    const date = new Date(activity.start_date_local || activity.start_date)
    // Key uses 0-indexed month for internal grouping
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`

    if (!activitiesByYearMonth.has(key)) {
      activitiesByYearMonth.set(key, [])
    }
    activitiesByYearMonth.get(key)?.push(activity)
  }

  // Sort year-month keys chronologically
  let sortedYearMonths = Array.from(activitiesByYearMonth.keys()).sort()

  // Apply month limit if specified
  if (config.maxMonths !== undefined) {
    sortedYearMonths = sortedYearMonths.slice(0, config.maxMonths)
  }

  // Filter to only months within the selected date range
  const startDateObj = new Date(config.startDate)
  const endDateObj = new Date(config.endDate)

  for (const yearMonthKey of sortedYearMonths) {
    const [yearStr, monthStr] = yearMonthKey.split('-')
    const entryYear = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)  // 0-indexed

    // Check if this month is within the date range
    const monthStart = new Date(entryYear, month, 1)
    const monthEnd = new Date(entryYear, month + 1, 0)

    if (monthEnd < startDateObj || monthStart > endDateObj) {
      continue // Skip months outside the range
    }

    const monthActivities = activitiesByYearMonth.get(yearMonthKey) || []
    const monthNonRaces = monthActivities.filter(a => a.workout_type !== 1)

    if (monthNonRaces.length === 0) {
      continue // Skip months with only races
    }

    // Determine highlight activity for this month
    let highlightActivityId: number | undefined

    if (config.highlightActivityIds) {
      // Use provided highlight (key format: "YYYY-MM" with 1-indexed month)
      const highlightKey = `${entryYear}-${String(month + 1).padStart(2, '0')}`
      highlightActivityId = config.highlightActivityIds.get(highlightKey)
    } else {
      // Auto-select: find activity with photos
      const highlightActivity = findHighlightActivity(monthActivities, allActivities)
      highlightActivityId = highlightActivity?.id
    }

    // MONTHLY DIVIDER (2-page spread)
    entries.push({
      type: 'MONTHLY_DIVIDER',
      month,
      year: entryYear,
      title: new Date(entryYear, month, 1).toLocaleString('en-US', { month: 'long' }),
      highlightLabel: `${monthNonRaces.length} activities`,
      highlightActivityId,
      pageNumber: currentPage++,
    })

    // ACTIVITY LOG pages for this month
    const totalLogPages = Math.ceil(monthNonRaces.length / activitiesPerPage)

    for (let pageNum = 0; pageNum < totalLogPages; pageNum++) {
      const startIdx = pageNum * activitiesPerPage
      const pageActivities = monthNonRaces.slice(startIdx, startIdx + activitiesPerPage)

      entries.push({
        type: 'ACTIVITY_LOG',
        activityIds: pageActivities.map(a => a.id),
        pageNumber: currentPage++,
        title: new Date(entryYear, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      })
    }
  }

  // 8. BACK COVER
  entries.push({
    type: 'BACK_COVER',
    title: 'Back Cover',
    backCoverPhotoUrl: config.backCoverPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  return entries
}

/**
 * Find photos from activities that can be used for covers
 * Useful for tests and auto-discovery scenarios
 */
export function findCoverPhotosFromActivities(activities: StravaActivity[]): {
  coverPhotoUrl: string | null
  backgroundPhotoUrl: string | null
  backCoverPhotoUrl: string | null
} {
  const photos: string[] = []

  // Collect all photo URLs from activities
  for (const activity of activities) {
    const activityPhotos = activity.comprehensiveData?.photos || []
    for (const photo of activityPhotos) {
      // Get the largest available URL
      const url = photo.urls?.['600'] || photo.urls?.['100'] || Object.values(photo.urls || {})[0]
      if (url) {
        photos.push(url)
      }
    }

    // Also check primary photo
    if (activity.photos?.primary?.urls) {
      const urls = activity.photos.primary.urls as Record<string, string>
      const url = urls['600'] || urls['100'] || Object.values(urls)[0]
      if (url && !photos.includes(url)) {
        photos.push(url)
      }
    }
  }

  return {
    coverPhotoUrl: photos[0] || null,
    backgroundPhotoUrl: photos[1] || photos[0] || null,
    backCoverPhotoUrl: photos[2] || photos[0] || null,
  }
}
