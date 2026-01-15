/**
 * Cache-Aware Strava Client
 *
 * Wraps Strava API calls with persistent caching to avoid rate limits.
 * Tracks rate limit headers and provides intelligent batch fetching.
 */

import { getActivityPhotos, StravaPhoto, StravaActivity } from '../strava'
import {
  getCachedPhotos,
  cachePhotos,
  isActivityCached,
  getCachedPhotosMultiple,
  CachedActivityPhotos
} from './photo-cache'

// Rate limit tracking
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
 * Header format: "X-RateLimit-Usage: 45,100" (short-term, daily)
 * Header format: "X-RateLimit-Limit: 100,1000"
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

/**
 * Get current rate limit info
 */
export function getRateLimitInfo(): RateLimitInfo {
  return { ...rateLimitInfo }
}

/**
 * Check if we're approaching rate limits
 */
export function isNearRateLimit(): { nearShortTerm: boolean; nearDaily: boolean; canMakeRequest: boolean } {
  const shortTermRemaining = rateLimitInfo.shortTermLimit - rateLimitInfo.shortTermUsage
  const dailyRemaining = rateLimitInfo.dailyLimit - rateLimitInfo.dailyUsage

  return {
    nearShortTerm: shortTermRemaining < 20,
    nearDaily: dailyRemaining < 100,
    canMakeRequest: shortTermRemaining > 0 && dailyRemaining > 0
  }
}

/**
 * Calculate optimal delay between requests based on rate limits
 */
export function getOptimalDelay(): number {
  const { nearShortTerm, nearDaily } = isNearRateLimit()

  if (nearDaily) {
    // If near daily limit, slow way down
    return 5000 // 5 seconds
  }
  if (nearShortTerm) {
    // If near 15-min limit, moderate delay
    return 1000 // 1 second
  }
  // Normal operation: ~100 requests per 15 min = 9 sec each
  // But we can burst faster and let the limit handle it
  return 200 // 200ms
}

/**
 * Fetch photos with caching - checks cache first, falls back to API
 */
export async function getActivityPhotosWithCache(
  accessToken: string,
  activityId: string,
  athleteId: string,
  options?: { forceRefresh?: boolean }
): Promise<{ photos: StravaPhoto[]; fromCache: boolean; cached: CachedActivityPhotos | null }> {
  // Check cache first (unless force refresh)
  if (!options?.forceRefresh) {
    const cached = await getCachedPhotos(activityId)
    if (cached) {
      return { photos: cached.photos, fromCache: true, cached }
    }
  }

  // Fetch from API
  const photos = await getActivityPhotosWithRateTracking(accessToken, activityId)

  // Cache the result
  await cachePhotos(activityId, athleteId, photos)

  return { photos, fromCache: false, cached: null }
}

/**
 * Fetch photos from API and track rate limits
 */
async function getActivityPhotosWithRateTracking(
  accessToken: string,
  activityId: string
): Promise<StravaPhoto[]> {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/photos?size=5000`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  // Parse rate limit headers
  parseRateLimitHeaders(res.headers)

  if (!res.ok) {
    return []
  }

  return res.json()
}

/**
 * Batch fetch photos for multiple activities with intelligent caching
 * Returns activities enriched with photos
 */
export async function batchFetchPhotosWithCache(
  accessToken: string,
  activities: StravaActivity[],
  athleteId: string,
  options?: {
    onProgress?: (progress: BatchProgress) => void
    maxConcurrent?: number
    respectRateLimits?: boolean
  }
): Promise<BatchFetchResult> {
  const { onProgress, maxConcurrent = 3, respectRateLimits = true } = options || {}

  const activityIds = activities.map(a => String(a.id))

  // Check which are already cached
  const cachedMap = await getCachedPhotosMultiple(activityIds)

  const needsFetching: string[] = []
  const fromCache: Map<string, StravaPhoto[]> = new Map()

  for (const [id, cached] of cachedMap) {
    if (cached) {
      fromCache.set(id, cached.photos)
    } else {
      needsFetching.push(id)
    }
  }

  const result: BatchFetchResult = {
    total: activities.length,
    fromCache: fromCache.size,
    fetched: 0,
    failed: 0,
    skippedRateLimit: 0,
    photos: new Map(fromCache)
  }

  // Report initial progress
  onProgress?.({
    phase: 'starting',
    total: activities.length,
    cached: fromCache.size,
    fetched: 0,
    remaining: needsFetching.length,
    rateLimitInfo: getRateLimitInfo()
  })

  // Fetch in batches
  for (let i = 0; i < needsFetching.length; i += maxConcurrent) {
    // Check rate limits before each batch
    if (respectRateLimits && !isNearRateLimit().canMakeRequest) {
      result.skippedRateLimit = needsFetching.length - i
      onProgress?.({
        phase: 'rate_limited',
        total: activities.length,
        cached: fromCache.size,
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
          const photos = await getActivityPhotosWithRateTracking(accessToken, activityId)
          await cachePhotos(activityId, athleteId, photos)
          return { activityId, photos, success: true }
        } catch {
          return { activityId, photos: [], success: false }
        }
      })
    )

    for (const { activityId, photos, success } of batchResults) {
      if (success) {
        result.fetched++
        result.photos.set(activityId, photos)
      } else {
        result.failed++
      }
    }

    // Progress update
    onProgress?.({
      phase: 'fetching',
      total: activities.length,
      cached: fromCache.size,
      fetched: result.fetched,
      remaining: needsFetching.length - i - batch.length,
      rateLimitInfo: getRateLimitInfo()
    })

    // Delay between batches
    if (i + maxConcurrent < needsFetching.length) {
      const delay = getOptimalDelay()
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  onProgress?.({
    phase: 'complete',
    total: activities.length,
    cached: fromCache.size,
    fetched: result.fetched,
    remaining: 0,
    rateLimitInfo: getRateLimitInfo()
  })

  return result
}

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
  photos: Map<string, StravaPhoto[]>
}

/**
 * Enrich activities with cached photos (no API calls)
 * Fast path for when you just want to attach cached photos to activities
 */
export async function enrichActivitiesWithCachedPhotos(
  activities: StravaActivity[]
): Promise<{ enriched: StravaActivity[]; uncachedCount: number }> {
  const activityIds = activities.map(a => String(a.id))
  const cachedMap = await getCachedPhotosMultiple(activityIds)

  let uncachedCount = 0

  const enriched = activities.map(activity => {
    const cached = cachedMap.get(String(activity.id))
    if (cached) {
      return {
        ...activity,
        allPhotos: cached.photos,
        comprehensiveData: {
          ...activity.comprehensiveData,
          photos: cached.photos
        }
      }
    }
    uncachedCount++
    return activity
  })

  return { enriched, uncachedCount }
}
