/**
 * Photo Cache Module
 *
 * Persistent caching for Strava photo URLs to avoid API rate limits.
 *
 * Usage:
 *
 * 1. Check/get cached photos:
 *    import { getCachedPhotos, isActivityCached } from '@/lib/cache'
 *
 * 2. Fetch with automatic caching:
 *    import { getActivityPhotosWithCache } from '@/lib/cache'
 *
 * 3. Batch operations:
 *    import { batchFetchPhotosWithCache, enrichActivitiesWithCachedPhotos } from '@/lib/cache'
 *
 * 4. Cache management:
 *    import { getCacheMetadata, clearCache, clearOldCache } from '@/lib/cache'
 *
 * API endpoints:
 *   GET  /api/photo-cache        - Get cache status
 *   POST /api/photo-cache        - Start harvesting (mode: 'recent' | 'full' | 'year')
 *   DELETE /api/photo-cache?all=true  - Clear cache
 */

// Core cache operations
export {
  getCachedPhotos,
  cachePhotos,
  isActivityCached,
  getCachedPhotosMultiple,
  getCacheMetadata,
  listCachedActivityIds,
  clearCache,
  clearOldCache,
  deleteCachedPhotos,
  type CachedActivityPhotos,
  type CacheMetadata
} from './photo-cache'

// Cache-aware Strava client
export {
  getActivityPhotosWithCache,
  batchFetchPhotosWithCache,
  enrichActivitiesWithCachedPhotos,
  getRateLimitInfo,
  isNearRateLimit,
  getOptimalDelay,
  type BatchProgress,
  type BatchFetchResult
} from './cached-strava'
