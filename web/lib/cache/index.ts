/**
 * Strava Data Cache Module
 *
 * Persistent caching for Strava data to avoid API rate limits.
 *
 * Cached data (matching actual Strava API):
 * - Activity list from GET /athlete/activities
 * - Activity details from GET /activities/{id} (includes photos)
 * - Laps from GET /activities/{id}/laps
 * - Comments from GET /activities/{id}/comments
 *
 * Usage:
 *
 * 1. Use the cached Strava client:
 *    import { cachedStrava } from '@/lib/cache'
 *
 *    const { data, fromCache } = await cachedStrava.getActivity(token, activityId)
 *    const { data, fromCache } = await cachedStrava.getActivityLaps(token, activityId)
 *
 * 2. Batch fetch for PDF generation:
 *    const result = await cachedStrava.batchFetchForPdf(token, activityIds)
 *
 * 3. Cache management:
 *    import { getCacheStats, clearAllCache } from '@/lib/cache'
 *
 * Note: athleteId is derived from activity.athlete.id (authoritative Strava data),
 * not stored redundantly at the cache entry level.
 */

// Main cached client
export { cachedStrava } from './cached-strava'

// Individual cached operations
export {
  getAthleteActivities,
  getActivity,
  getActivityLaps,
  getActivityComments,
  getActivityForPdf,
  batchFetchForPdf,
  enrichActivitiesFromCache,
  getRateLimitInfo,
  isNearRateLimit,
  getOptimalDelay,
  type BatchProgress,
  type BatchFetchResult
} from './cached-strava'

// Cache storage operations
export {
  // Activity cache
  getCachedActivity,
  isActivityCached,
  getCachedActivitiesMultiple,
  cacheActivityDetails,
  cacheActivityLaps,
  cacheActivityComments,
  cacheCompleteActivity,
  deleteCachedActivity,
  getCacheStatus,

  // Activity list cache
  getCachedActivityList,
  cacheActivityList,

  // Cache management
  getCacheStats,
  listCachedActivityIds,
  clearAllCache,
  clearOldCache,

  // Types
  type CachedActivity,
  type CachedActivityList,
  type CacheStats,
  type StravaLap
} from './strava-cache'
