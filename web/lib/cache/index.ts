/**
 * Strava Data Cache Module
 *
 * Persistent caching for ALL Strava data to avoid API rate limits.
 *
 * Usage:
 *
 * 1. Use the cached Strava client (recommended):
 *    import { cachedStrava } from '@/lib/cache'
 *
 *    const { data, fromCache } = await cachedStrava.getActivity(token, activityId, athleteId)
 *    const { data, fromCache } = await cachedStrava.getActivityPhotos(token, activityId, athleteId)
 *
 * 2. Batch operations:
 *    import { cachedStrava } from '@/lib/cache'
 *
 *    const result = await cachedStrava.batchFetchComprehensive(token, activityIds, athleteId, {
 *      onProgress: (p) => console.log(`${p.fetched}/${p.total}`),
 *      maxConcurrent: 3
 *    })
 *
 * 3. Cache management:
 *    import { getCacheStats, clearAllCache } from '@/lib/cache'
 *
 * API endpoints:
 *   GET  /api/strava-cache        - Get cache status
 *   POST /api/strava-cache        - Start harvesting all data
 *   DELETE /api/strava-cache      - Clear cache
 */

// Main cached client
export { cachedStrava } from './cached-strava'

// Individual cached operations (for direct imports)
export {
  getAthleteActivities,
  getActivity,
  getActivityPhotos,
  getActivityComments,
  getActivityStreams,
  getComprehensiveActivity,
  batchFetchComprehensive,
  enrichActivitiesFromCache,
  getActivityPhotosWithCache, // Legacy compatibility
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
  cacheActivityPhotos,
  cacheActivityComments,
  cacheActivityStreams,
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
  migrateFromPhotoCache,

  // Types
  type CachedActivity,
  type CachedActivityList,
  type CacheStats
} from './strava-cache'
