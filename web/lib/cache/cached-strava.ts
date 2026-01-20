/**
 * Cache-Aware Strava Client
 *
 * Wraps ALL Strava API calls with persistent caching to avoid rate limits.
 * Tracks rate limit headers and provides intelligent batch fetching.
 *
 * Usage:
 *   import { cachedStrava } from '@/lib/cache'
 *
 *   // These check cache first, fall back to API
 *   const activities = await cachedStrava.getAthleteActivities(token, athleteId, options)
 *   const activity = await cachedStrava.getActivity(token, activityId, athleteId)
 *   const photos = await cachedStrava.getActivityPhotos(token, activityId, athleteId)
 *   const comments = await cachedStrava.getActivityComments(token, activityId, athleteId)
 *   const streams = await cachedStrava.getActivityStreams(token, activityId, athleteId)
 */

import {
  StravaActivity,
  StravaPhoto,
  StravaComment,
  StravaStreams
} from '../strava'
import {
  getCachedActivity,
  getCachedActivityList,
  cacheActivityDetails,
  cacheActivityPhotos,
  cacheActivityComments,
  cacheActivityStreams,
  cacheActivityList,
  cacheCompleteActivity,
  CachedActivity
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

let rateLimitInfo: RateLimitInfo = {
  shortTermUsage: 0,
  shortTermLimit: 100,
  dailyUsage: 0,
  dailyLimit: 1000,
  lastUpdated: new Date()
}

/**
 * Parse rate limit headers from Strava response
 */
function parseRateLimitHeaders(headers: Headers): void {
  const usage = headers.get('X-RateLimit-Usage')
  const limit = headers.get('X-RateLimit-Limit')

  if (usage) {
    const [shortTerm, daily] = usage.split(',').map(Number)
    rateLimitInfo.shortTermUsage = shortTerm || 0
    rateLimitInfo.dailyUsage = daily || 0
  }

  if (limit) {
    const [shortTermLimit, dailyLimit] = limit.split(',').map(Number)
    rateLimitInfo.shortTermLimit = shortTermLimit || 100
    rateLimitInfo.dailyLimit = dailyLimit || 1000
  }

  rateLimitInfo.lastUpdated = new Date()
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
// Raw API Calls (with rate limit tracking)
// ============================================

async function fetchWithRateTracking(url: string, accessToken: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  parseRateLimitHeaders(res.headers)
  return res
}

async function fetchAthleteActivitiesRaw(
  accessToken: string,
  options?: { after?: number; before?: number; perPage?: number; page?: number }
): Promise<StravaActivity[]> {
  const params = new URLSearchParams()
  params.set('per_page', (options?.perPage || 100).toString())
  if (options?.after) params.set('after', options.after.toString())
  if (options?.before) params.set('before', options.before.toString())
  if (options?.page) params.set('page', options.page.toString())

  const res = await fetchWithRateTracking(
    `https://www.strava.com/api/v3/athlete/activities?${params}`,
    accessToken
  )

  if (!res.ok) {
    throw new Error(`Failed to fetch activities: ${res.status}`)
  }

  return res.json()
}

async function fetchActivityRaw(accessToken: string, activityId: string): Promise<StravaActivity> {
  const res = await fetchWithRateTracking(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    accessToken
  )

  if (!res.ok) {
    throw new Error(`Failed to fetch activity ${activityId}: ${res.status}`)
  }

  return res.json()
}

async function fetchActivityPhotosRaw(accessToken: string, activityId: string): Promise<StravaPhoto[]> {
  const res = await fetchWithRateTracking(
    `https://www.strava.com/api/v3/activities/${activityId}/photos?size=5000`,
    accessToken
  )

  if (!res.ok) return []
  return res.json()
}

async function fetchActivityCommentsRaw(accessToken: string, activityId: string): Promise<StravaComment[]> {
  const res = await fetchWithRateTracking(
    `https://www.strava.com/api/v3/activities/${activityId}/comments`,
    accessToken
  )

  if (!res.ok) return []
  return res.json()
}

async function fetchActivityStreamsRaw(
  accessToken: string,
  activityId: string,
  keys: string[] = ['latlng', 'altitude', 'time', 'distance']
): Promise<StravaStreams> {
  const keysParam = keys.join(',')
  const res = await fetchWithRateTracking(
    `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${keysParam}&key_by_type=true`,
    accessToken
  )

  if (!res.ok) return {}
  return res.json()
}

// ============================================
// Cached API Calls
// ============================================

interface CacheOptions {
  forceRefresh?: boolean
  maxAge?: number // Max cache age in seconds (optional staleness check)
}

interface CachedResult<T> {
  data: T
  fromCache: boolean
  cachedAt: string | null
}

/**
 * Get athlete activities with caching
 * Note: Activity list caching is optional - mainly for avoiding repeated full fetches
 */
async function getAthleteActivities(
  accessToken: string,
  athleteId: string,
  options?: { after?: number; before?: number; perPage?: number; page?: number } & CacheOptions
): Promise<CachedResult<StravaActivity[]>> {
  const { forceRefresh, ...queryOptions } = options || {}

  // For activity lists, we typically want fresh data, but can use cache as fallback
  // Skip cache by default for pagination to ensure consistency
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
    const activities = await fetchAthleteActivitiesRaw(accessToken, {
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
 */
async function getActivity(
  accessToken: string,
  activityId: string,
  athleteId: string,
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

  const activity = await fetchActivityRaw(accessToken, activityId)
  await cacheActivityDetails(activityId, athleteId, activity)

  return {
    data: activity,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity photos with caching
 */
async function getActivityPhotos(
  accessToken: string,
  activityId: string,
  athleteId: string,
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

  const photos = await fetchActivityPhotosRaw(accessToken, activityId)
  await cacheActivityPhotos(activityId, athleteId, photos)

  return {
    data: photos,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity comments with caching
 */
async function getActivityComments(
  accessToken: string,
  activityId: string,
  athleteId: string,
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

  const comments = await fetchActivityCommentsRaw(accessToken, activityId)
  await cacheActivityComments(activityId, athleteId, comments)

  return {
    data: comments,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get activity streams with caching
 */
async function getActivityStreams(
  accessToken: string,
  activityId: string,
  athleteId: string,
  options?: CacheOptions & { keys?: string[] }
): Promise<CachedResult<StravaStreams>> {
  if (!options?.forceRefresh) {
    const cached = await getCachedActivity(activityId)
    if (cached?.streamsFetchedAt) {
      return {
        data: cached.streams || {},
        fromCache: true,
        cachedAt: cached.streamsFetchedAt
      }
    }
  }

  const streams = await fetchActivityStreamsRaw(accessToken, activityId, options?.keys)
  await cacheActivityStreams(activityId, athleteId, streams)

  return {
    data: streams,
    fromCache: false,
    cachedAt: null
  }
}

/**
 * Get all comprehensive data for an activity with caching
 */
async function getComprehensiveActivity(
  accessToken: string,
  activityId: string,
  athleteId: string,
  options?: CacheOptions
): Promise<CachedResult<{
  activity: StravaActivity
  photos: StravaPhoto[]
  comments: StravaComment[]
  streams: StravaStreams
}>> {
  // Check what's already cached
  const cached = options?.forceRefresh ? null : await getCachedActivity(activityId)

  const needsActivity = !cached?.activity
  const needsPhotos = !cached?.photosFetchedAt
  const needsComments = !cached?.commentsFetchedAt
  const needsStreams = !cached?.streamsFetchedAt

  // If everything is cached, return it
  if (!needsActivity && !needsPhotos && !needsComments && !needsStreams && cached) {
    return {
      data: {
        activity: cached.activity!,
        photos: cached.photos,
        comments: cached.comments,
        streams: cached.streams || {}
      },
      fromCache: true,
      cachedAt: cached.lastUpdatedAt
    }
  }

  // Fetch what's missing in parallel
  const promises: Promise<void>[] = []
  let activity = cached?.activity
  let photos = cached?.photos || []
  let comments = cached?.comments || []
  let streams = cached?.streams || {}

  if (needsActivity) {
    promises.push(
      fetchActivityRaw(accessToken, activityId).then(a => { activity = a })
    )
  }
  if (needsPhotos) {
    promises.push(
      fetchActivityPhotosRaw(accessToken, activityId).then(p => { photos = p })
    )
  }
  if (needsComments) {
    promises.push(
      fetchActivityCommentsRaw(accessToken, activityId).then(c => { comments = c })
    )
  }
  if (needsStreams) {
    promises.push(
      fetchActivityStreamsRaw(accessToken, activityId).then(s => { streams = s })
    )
  }

  await Promise.all(promises)

  // Cache everything that was fetched
  await cacheCompleteActivity(activityId, athleteId, {
    activity: needsActivity ? activity : undefined,
    photos: needsPhotos ? photos : undefined,
    comments: needsComments ? comments : undefined,
    streams: needsStreams ? streams : undefined
  })

  return {
    data: {
      activity: activity!,
      photos,
      comments,
      streams
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
 * Batch fetch comprehensive data for multiple activities
 */
async function batchFetchComprehensive(
  accessToken: string,
  activityIds: string[],
  athleteId: string,
  options?: {
    onProgress?: (progress: BatchProgress) => void
    maxConcurrent?: number
    respectRateLimits?: boolean
    includeStreams?: boolean
  }
): Promise<BatchFetchResult> {
  const { onProgress, maxConcurrent = 3, respectRateLimits = true, includeStreams = true } = options || {}

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
    const isComplete = cached?.activity &&
                      cached?.photosFetchedAt &&
                      cached?.commentsFetchedAt &&
                      (!includeStreams || cached?.streamsFetchedAt)

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
          const { data } = await getComprehensiveActivity(accessToken, activityId, athleteId)
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

      if (cached) {
        return {
          ...activity,
          ...(cached.activity || {}),
          allPhotos: cached.photos,
          comments: cached.comments,
          comprehensiveData: {
            photos: cached.photos,
            comments: cached.comments,
            streams: cached.streams || undefined
          }
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
  // Individual operations
  getAthleteActivities,
  getActivity,
  getActivityPhotos,
  getActivityComments,
  getActivityStreams,
  getComprehensiveActivity,

  // Batch operations
  batchFetchComprehensive,
  enrichActivitiesFromCache,

  // Rate limit utilities
  getRateLimitInfo,
  isNearRateLimit,
  getOptimalDelay
}

// Legacy exports for backward compatibility
export {
  getAthleteActivities,
  getActivity,
  getActivityPhotos,
  getActivityComments,
  getActivityStreams,
  getComprehensiveActivity,
  batchFetchComprehensive,
  enrichActivitiesFromCache
}

// Re-export the old function name for photo-cache API compatibility
export async function getActivityPhotosWithCache(
  accessToken: string,
  activityId: string,
  athleteId: string,
  options?: { forceRefresh?: boolean }
): Promise<{ photos: StravaPhoto[]; fromCache: boolean; cached: CachedActivity | null }> {
  const result = await getActivityPhotos(accessToken, activityId, athleteId, options)
  const cached = await getCachedActivity(activityId)
  return {
    photos: result.data,
    fromCache: result.fromCache,
    cached
  }
}
