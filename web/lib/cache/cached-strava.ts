/**
 * Cache-Aware Strava Client
 *
 * Wraps Strava API calls with persistent caching to avoid rate limits.
 * Matches actual Strava API endpoints:
 *
 *   GET /athlete/activities          → cachedStrava.getAthleteActivities()
 *   GET /activities/{id}             → cachedStrava.getActivity()
 *   GET /activities/{id}/laps        → cachedStrava.getActivityLaps()
 *   GET /activities/{id}/comments    → cachedStrava.getActivityComments()
 *
 * Note: Photos are included in DetailedActivity response, not separate endpoint.
 */

import {
  StravaActivity,
  StravaComment,
  StravaLap,
  StravaPhoto,
  getAthleteActivities as fetchAthleteActivities,
  getActivity as fetchActivity,
  getActivityLaps as fetchLaps,
  getActivityComments as fetchComments,
  getActivityPhotos as fetchPhotos
} from '../strava'
import { enrichActivityWithGeocoding } from '../activity-utils'
import {
  getCachedActivity,
  getCachedActivityList,
  cacheActivityDetails,
  cacheActivityLaps,
  cacheActivityComments,
  cacheActivityPhotos,
  cacheActivityList,
  cacheCompleteActivity,
  CachedActivity,
  StravaLap as CachedStravaLap
} from './strava-cache'

// ============================================
// Rate Limit Tracking
// ============================================

interface RateLimitInfo {
  shortTermUsage: number    // Usage in current 15-min window
  shortTermLimit: number    // 100 requests / 15 min
  dailyUsage: number        // Usage today
  dailyLimit: number        // 1000 requests / day
  lastUpdated: Date
}

const rateLimitInfo: RateLimitInfo = {
  shortTermUsage: 0,
  shortTermLimit: 100,
  dailyUsage: 0,
  dailyLimit: 1000,
  lastUpdated: new Date()
}

export function getRateLimitInfo(): RateLimitInfo {
  return { ...rateLimitInfo }
}

export function isNearRateLimit(): {
  nearShortTerm: boolean
  nearDaily: boolean
  canMakeRequest: boolean
} {
  const shortTermRemaining = rateLimitInfo.shortTermLimit - rateLimitInfo.shortTermUsage
  const dailyRemaining = rateLimitInfo.dailyLimit - rateLimitInfo.dailyUsage

  return {
    nearShortTerm: shortTermRemaining < 20,
    nearDaily: dailyRemaining < 100,
    canMakeRequest: shortTermRemaining > 0 && dailyRemaining > 0
  }
}

export function getOptimalDelay(): number {
  const { nearShortTerm, nearDaily } = isNearRateLimit()
  if (nearDaily) return 5000
  if (nearShortTerm) return 1000
  return 200
}

// ============================================
// Cached API Calls
// ============================================

interface CacheOptions {
  forceRefresh?: boolean
}

interface CachedResult<T> {
  data: T
  fromCache: boolean
  cachedAt: string | null
}

/**
 * Get athlete activities with caching
 * GET /athlete/activities
 */
async function getAthleteActivities(
  accessToken: string,
  athleteId: string,
  options?: { after?: number; before?: number; perPage?: number; page?: number } & CacheOptions
): Promise<CachedResult<StravaActivity[]>> {
  const { forceRefresh, ...queryOptions } = options || {}

  // Check cache for non-paginated queries
  if (!forceRefresh && !queryOptions.page) {
    const cached = await getCachedActivityList(athleteId, {
      after: queryOptions.after,
      before: queryOptions.before
    })

    if (cached) {
      return {
        data: cached.activities,
        fromCache: true,
        cachedAt: cached.fetchedAt
      }
    }
  }

  // Fetch all pages
  const allActivities: StravaActivity[] = []
  let page = queryOptions.page || 1
  const perPage = queryOptions.perPage || 100

  while (true) {
    const activities = await fetchAthleteActivities(accessToken, {
      ...queryOptions,
      page,
      perPage
    })

    allActivities.push(...activities)

    if (activities.length < perPage) break
    page++

    // Small delay between pagination calls
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Cache the result (only for non-paginated full fetches)
  if (!queryOptions.page) {
    await cacheActivityList(athleteId, allActivities, {
      after: queryOptions.after,
      before: queryOptions.before
    })
  }

  return {
    data: allActivities,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity details with caching
 * GET /activities/{id}
 *
 * Note: DetailedActivity includes photos in the response
 */
async function getActivity(
  accessToken: string,
  activityId: string,
  options?: CacheOptions
): Promise<CachedResult<StravaActivity>> {
  if (!options?.forceRefresh) {
    const cached = await getCachedActivity(activityId)
    if (cached?.activity) {
      return {
        data: cached.activity,
        fromCache: true,
        cachedAt: cached.activityFetchedAt
      }
    }
  }

  const activity = await fetchActivity(accessToken, activityId)
  await cacheActivityDetails(activityId, activity)

  return {
    data: activity,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity laps with caching
 * GET /activities/{id}/laps
 */
async function getActivityLaps(
  accessToken: string,
  activityId: string,
  options?: CacheOptions
): Promise<CachedResult<StravaLap[]>> {
  if (!options?.forceRefresh) {
    const cached = await getCachedActivity(activityId)
    if (cached?.lapsFetchedAt) {
      // Convert cached laps to StravaLap type
      return {
        data: cached.laps as unknown as StravaLap[],
        fromCache: true,
        cachedAt: cached.lapsFetchedAt
      }
    }
  }

  const laps = await fetchLaps(accessToken, activityId)
  await cacheActivityLaps(activityId, laps as unknown as CachedStravaLap[])

  return {
    data: laps,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity comments with caching
 * GET /activities/{id}/comments
 */
async function getActivityComments(
  accessToken: string,
  activityId: string,
  options?: CacheOptions
): Promise<CachedResult<StravaComment[]>> {
  if (!options?.forceRefresh) {
    const cached = await getCachedActivity(activityId)
    if (cached?.commentsFetchedAt) {
      return {
        data: cached.comments,
        fromCache: true,
        cachedAt: cached.commentsFetchedAt
      }
    }
  }

  const comments = await fetchComments(accessToken, activityId)
  await cacheActivityComments(activityId, comments)

  return {
    data: comments,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity photos with caching
 * GET /activities/{id}/photos
 */
async function getActivityPhotos(
  accessToken: string,
  activityId: string,
  options?: CacheOptions
): Promise<CachedResult<StravaPhoto[]>> {
  if (!options?.forceRefresh) {
    const cached = await getCachedActivity(activityId)
    if (cached?.photosFetchedAt) {
      return {
        data: cached.photos,
        fromCache: true,
        cachedAt: cached.photosFetchedAt
      }
    }
  }

  const photos = await fetchPhotos(accessToken, activityId)
  await cacheActivityPhotos(activityId, photos)

  return {
    data: photos,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get all data needed for PDF generation with caching
 * Fetches: activity details + laps + comments + photos (only if not cached)
 */
async function getActivityForPdf(
  accessToken: string,
  activityId: string,
  options?: CacheOptions
): Promise<CachedResult<{
  activity: StravaActivity
  laps: StravaLap[]
  comments: StravaComment[]
  photos: StravaPhoto[]
}>> {
  // Check what's already cached
  const cached = options?.forceRefresh ? null : await getCachedActivity(activityId)

  const needsActivity = !cached?.activityFetchedAt
  const needsLaps = !cached?.lapsFetchedAt
  const needsComments = !cached?.commentsFetchedAt
  const needsPhotos = !cached?.photosFetchedAt

  // If everything is cached, check if we need to geocode, then return
  if (!needsActivity && !needsLaps && !needsComments && !needsPhotos && cached) {
    let activity = cached.activity!

    // Geocode if location is missing but coordinates exist (even for cached data)
    if (!activity.location_city && activity.start_latlng) {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (mapboxToken) {
        activity = await enrichActivityWithGeocoding(activity, mapboxToken)
        // Update cache with geocoded location
        if (activity.location_city) {
          await cacheCompleteActivity(activityId, { activity })
        }
      }
    }

    return {
      data: {
        activity,
        laps: cached.laps as unknown as StravaLap[],
        comments: cached.comments,
        photos: cached.photos
      },
      fromCache: true,
      cachedAt: cached.lastUpdatedAt
    }
  }

  // Fetch what's missing in parallel
  const [activityResult, lapsResult, commentsResult, photosResult] = await Promise.all([
    needsActivity
      ? fetchActivity(accessToken, activityId)
      : Promise.resolve(cached?.activity || null),
    needsLaps
      ? fetchLaps(accessToken, activityId)
      : Promise.resolve(cached?.laps as unknown as StravaLap[] || []),
    needsComments
      ? fetchComments(accessToken, activityId)
      : Promise.resolve(cached?.comments || []),
    needsPhotos
      ? fetchPhotos(accessToken, activityId)
      : Promise.resolve(cached?.photos || [])
  ])

  // Get the activity (either freshly fetched or from cache)
  let activity = (activityResult || cached?.activity) as StravaActivity

  // Geocode location if missing but coordinates exist
  // This enriches the activity and the result gets cached
  if (activity && !activity.location_city && activity.start_latlng) {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (mapboxToken) {
      activity = await enrichActivityWithGeocoding(activity, mapboxToken)
    }
  }

  // Cache what was fetched (including geocoded location if added)
  const activityToCache = needsActivity || activity?.location_city
    ? activity
    : undefined
  await cacheCompleteActivity(activityId, {
    activity: activityToCache,
    laps: needsLaps ? (lapsResult as unknown as CachedStravaLap[]) : undefined,
    comments: needsComments ? commentsResult : undefined,
    photos: needsPhotos ? photosResult : undefined
  })

  return {
    data: {
      activity,
      laps: lapsResult as StravaLap[],
      comments: commentsResult,
      photos: photosResult
    },
    fromCache: false,
    cachedAt: null
  }
}

// ============================================
// Batch Operations
// ============================================

export interface BatchProgress {
  phase: 'starting' | 'fetching' | 'rate_limited' | 'complete'
  total: number
  cached: number
  fetched: number
  remaining: number
  rateLimitInfo: RateLimitInfo
}

export interface BatchFetchResult {
  total: number
  fromCache: number
  fetched: number
  failed: number
  skippedRateLimit: number
  activities: Map<string, CachedActivity>
}

/**
 * Batch fetch activity data for PDF generation
 * Fetches: activity + laps + comments for each (only if not cached)
 */
async function batchFetchForPdf(
  accessToken: string,
  activityIds: string[],
  options?: {
    onProgress?: (progress: BatchProgress) => void
    maxConcurrent?: number
    respectRateLimits?: boolean
  }
): Promise<BatchFetchResult> {
  const { onProgress, maxConcurrent = 3, respectRateLimits = true } = options || {}

  const result: BatchFetchResult = {
    total: activityIds.length,
    fromCache: 0,
    fetched: 0,
    failed: 0,
    skippedRateLimit: 0,
    activities: new Map()
  }

  // Check what's already cached
  const needsFetching: string[] = []

  for (const activityId of activityIds) {
    const cached = await getCachedActivity(activityId)
    const isComplete = cached?.activityFetchedAt &&
                      cached?.lapsFetchedAt &&
                      cached?.commentsFetchedAt &&
                      cached?.photosFetchedAt

    if (isComplete && cached) {
      result.fromCache++
      result.activities.set(activityId, cached)
    } else {
      needsFetching.push(activityId)
    }
  }

  onProgress?.({
    phase: 'starting',
    total: activityIds.length,
    cached: result.fromCache,
    fetched: 0,
    remaining: needsFetching.length,
    rateLimitInfo: getRateLimitInfo()
  })

  // Fetch in batches
  for (let i = 0; i < needsFetching.length; i += maxConcurrent) {
    if (respectRateLimits && !isNearRateLimit().canMakeRequest) {
      result.skippedRateLimit = needsFetching.length - i
      onProgress?.({
        phase: 'rate_limited',
        total: activityIds.length,
        cached: result.fromCache,
        fetched: result.fetched,
        remaining: result.skippedRateLimit,
        rateLimitInfo: getRateLimitInfo()
      })
      break
    }

    const batch = needsFetching.slice(i, i + maxConcurrent)

    const batchResults = await Promise.all(
      batch.map(async (activityId) => {
        try {
          await getActivityForPdf(accessToken, activityId)
          const cached = await getCachedActivity(activityId)
          return { activityId, cached, success: true }
        } catch (error) {
          console.error(`[Cache] Failed to fetch ${activityId}:`, error)
          return { activityId, cached: null, success: false }
        }
      })
    )

    for (const { activityId, cached, success } of batchResults) {
      if (success && cached) {
        result.fetched++
        result.activities.set(activityId, cached)
      } else {
        result.failed++
      }
    }

    onProgress?.({
      phase: 'fetching',
      total: activityIds.length,
      cached: result.fromCache,
      fetched: result.fetched,
      remaining: needsFetching.length - i - batch.length,
      rateLimitInfo: getRateLimitInfo()
    })

    // Delay between batches
    if (i + maxConcurrent < needsFetching.length) {
      await new Promise(resolve => setTimeout(resolve, getOptimalDelay()))
    }
  }

  onProgress?.({
    phase: 'complete',
    total: activityIds.length,
    cached: result.fromCache,
    fetched: result.fetched,
    remaining: 0,
    rateLimitInfo: getRateLimitInfo()
  })

  return result
}

/**
 * Enrich activities with cached data (no API calls)
 */
async function enrichActivitiesFromCache(
  activities: StravaActivity[]
): Promise<{ enriched: StravaActivity[]; uncachedCount: number }> {
  let uncachedCount = 0

  const enriched = await Promise.all(
    activities.map(async (activity) => {
      const cached = await getCachedActivity(String(activity.id))

      if (cached?.activity) {
        return {
          ...cached.activity,
          cachedLaps: cached.laps,
          cachedComments: cached.comments
        }
      }

      uncachedCount++
      return activity
    })
  )

  return { enriched, uncachedCount }
}

// ============================================
// Exported Client
// ============================================

export const cachedStrava = {
  // Activity list
  getAthleteActivities,

  // Individual activity data
  getActivity,
  getActivityLaps,
  getActivityComments,
  getActivityPhotos,

  // Combined fetch for PDF generation
  getActivityForPdf,

  // Batch operations
  batchFetchForPdf,
  enrichActivitiesFromCache,

  // Rate limit utilities
  getRateLimitInfo,
  isNearRateLimit,
  getOptimalDelay
}

// Named exports for direct imports
export {
  getAthleteActivities,
  getActivity,
  getActivityLaps,
  getActivityComments,
  getActivityPhotos,
  getActivityForPdf,
  batchFetchForPdf,
  enrichActivitiesFromCache
}
