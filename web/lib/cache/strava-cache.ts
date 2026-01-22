/**
 * Unified Strava Data Cache
 *
 * Stores Strava data persistently to avoid API rate limits.
 * File-based storage: one JSON file per activity.
 *
 * Cached data types (matching actual Strava API):
 * - Activity details from GET /activities/{id} (includes photos in response)
 * - Laps from GET /activities/{id}/laps
 * - Comments from GET /activities/{id}/comments
 * - Activity list snapshots from GET /athlete/activities
 */

import { promises as fs } from 'fs'
import path from 'path'
import {
  StravaActivity,
  StravaComment,
  StravaPhoto
} from '../strava'

// Cache directories
const CACHE_BASE = path.join(process.cwd(), '.cache', 'strava')
const ACTIVITIES_DIR = path.join(CACHE_BASE, 'activities')
const LISTS_DIR = path.join(CACHE_BASE, 'lists')

/**
 * Lap data from GET /activities/{id}/laps
 */
export interface StravaLap {
  id: number
  name: string
  activity: { id: number }
  athlete: { id: number }
  elapsed_time: number
  moving_time: number
  start_date: string
  start_date_local: string
  distance: number
  start_index: number
  end_index: number
  total_elevation_gain: number
  average_speed: number
  max_speed: number
  average_cadence?: number
  average_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  lap_index: number
  split?: number
  pace_zone?: number
}

/**
 * Complete cached data for a single activity
 */
export interface CachedActivity {
  // Identifiers
  activityId: string
  athleteId: string

  // Activity details from GET /activities/{id}
  // Includes: photos, splits_metric, best_efforts, map, etc.
  activity: StravaActivity | null
  activityFetchedAt: string | null

  // Laps from GET /activities/{id}/laps
  laps: StravaLap[]
  lapsFetchedAt: string | null

  // Comments from GET /activities/{id}/comments
  comments: StravaComment[]
  commentsFetchedAt: string | null

  // Photos from GET /activities/{id}/photos
  photos: StravaPhoto[]
  photosFetchedAt: string | null

  // Metadata
  createdAt: string
  lastUpdatedAt: string
}

/**
 * Cached activity list (for a specific query)
 */
export interface CachedActivityList {
  athleteId: string
  query: {
    after?: number
    before?: number
  }
  activities: StravaActivity[]
  fetchedAt: string
  totalCount: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalActivities: number
  withDetails: number
  withLaps: number
  withComments: number
  totalLaps: number
  totalComments: number
  oldestEntry: string | null
  newestEntry: string | null
  cacheSize: string
  listSnapshots: number
}

// ============================================
// Directory Management
// ============================================

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function ensureCacheDirs(): Promise<void> {
  await Promise.all([
    ensureDir(ACTIVITIES_DIR),
    ensureDir(LISTS_DIR)
  ])
}

// ============================================
// Activity Cache Operations
// ============================================

function getActivityCachePath(activityId: string): string {
  return path.join(ACTIVITIES_DIR, `${activityId}.json`)
}

/**
 * Check if any data exists for an activity
 */
export async function isActivityCached(activityId: string): Promise<boolean> {
  try {
    await fs.access(getActivityCachePath(activityId))
    return true
  } catch {
    return false
  }
}

/**
 * Get all cached data for an activity
 */
export async function getCachedActivity(activityId: string): Promise<CachedActivity | null> {
  try {
    const content = await fs.readFile(getActivityCachePath(activityId), 'utf-8')
    return JSON.parse(content) as CachedActivity
  } catch {
    return null
  }
}

/**
 * Create or get existing cache entry for an activity
 */
async function getOrCreateCacheEntry(activityId: string, athleteId: string): Promise<CachedActivity> {
  const existing = await getCachedActivity(activityId)
  if (existing) {
    return existing
  }

  const now = new Date().toISOString()
  return {
    activityId,
    athleteId,
    activity: null,
    activityFetchedAt: null,
    laps: [],
    lapsFetchedAt: null,
    comments: [],
    commentsFetchedAt: null,
    photos: [],
    photosFetchedAt: null,
    createdAt: now,
    lastUpdatedAt: now
  }
}

/**
 * Save cached activity data
 */
async function saveCachedActivity(cached: CachedActivity): Promise<void> {
  await ensureDir(ACTIVITIES_DIR)
  cached.lastUpdatedAt = new Date().toISOString()
  await fs.writeFile(
    getActivityCachePath(cached.activityId),
    JSON.stringify(cached, null, 2)
  )
}

/**
 * Cache activity details (from GET /activities/{id})
 */
export async function cacheActivityDetails(
  activityId: string,
  athleteId: string,
  activity: StravaActivity
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  cached.activity = activity
  cached.activityFetchedAt = new Date().toISOString()
  await saveCachedActivity(cached)
}

/**
 * Cache activity laps (from GET /activities/{id}/laps)
 */
export async function cacheActivityLaps(
  activityId: string,
  athleteId: string,
  laps: StravaLap[]
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  cached.laps = laps
  cached.lapsFetchedAt = new Date().toISOString()
  await saveCachedActivity(cached)
}

/**
 * Cache activity comments (from GET /activities/{id}/comments)
 */
export async function cacheActivityComments(
  activityId: string,
  athleteId: string,
  comments: StravaComment[]
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  cached.comments = comments
  cached.commentsFetchedAt = new Date().toISOString()
  await saveCachedActivity(cached)
}

/**
 * Cache activity photos (from GET /activities/{id}/photos)
 */
export async function cacheActivityPhotos(
  activityId: string,
  athleteId: string,
  photos: StravaPhoto[]
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  cached.photos = photos
  cached.photosFetchedAt = new Date().toISOString()
  await saveCachedActivity(cached)
}

/**
 * Cache all activity data at once (for batch operations)
 */
export async function cacheCompleteActivity(
  activityId: string,
  athleteId: string,
  data: {
    activity?: StravaActivity
    laps?: StravaLap[]
    comments?: StravaComment[]
    photos?: StravaPhoto[]
  }
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  const now = new Date().toISOString()

  if (data.activity !== undefined) {
    cached.activity = data.activity
    cached.activityFetchedAt = now
  }
  if (data.laps !== undefined) {
    cached.laps = data.laps
    cached.lapsFetchedAt = now
  }
  if (data.comments !== undefined) {
    cached.comments = data.comments
    cached.commentsFetchedAt = now
  }
  if (data.photos !== undefined) {
    cached.photos = data.photos
    cached.photosFetchedAt = now
  }

  await saveCachedActivity(cached)
}

/**
 * Get cached data for multiple activities
 */
export async function getCachedActivitiesMultiple(
  activityIds: string[]
): Promise<Map<string, CachedActivity | null>> {
  const results = new Map<string, CachedActivity | null>()
  await Promise.all(
    activityIds.map(async (id) => {
      results.set(id, await getCachedActivity(id))
    })
  )
  return results
}

// ============================================
// Activity List Cache Operations
// ============================================

function getListCacheKey(athleteId: string, after?: number, before?: number): string {
  const parts = [athleteId]
  if (after) parts.push(`after-${after}`)
  if (before) parts.push(`before-${before}`)
  return parts.join('_')
}

function getListCachePath(key: string): string {
  return path.join(LISTS_DIR, `${key}.json`)
}

/**
 * Cache an activity list query result
 */
export async function cacheActivityList(
  athleteId: string,
  activities: StravaActivity[],
  options?: { after?: number; before?: number }
): Promise<void> {
  await ensureDir(LISTS_DIR)
  const key = getListCacheKey(athleteId, options?.after, options?.before)

  const cached: CachedActivityList = {
    athleteId,
    query: {
      after: options?.after,
      before: options?.before
    },
    activities,
    fetchedAt: new Date().toISOString(),
    totalCount: activities.length
  }

  await fs.writeFile(getListCachePath(key), JSON.stringify(cached, null, 2))
}

/**
 * Get cached activity list
 */
export async function getCachedActivityList(
  athleteId: string,
  options?: { after?: number; before?: number }
): Promise<CachedActivityList | null> {
  try {
    const key = getListCacheKey(athleteId, options?.after, options?.before)
    const content = await fs.readFile(getListCachePath(key), 'utf-8')
    return JSON.parse(content) as CachedActivityList
  } catch {
    return null
  }
}

// ============================================
// Cache Management
// ============================================

/**
 * List all cached activity IDs
 */
export async function listCachedActivityIds(): Promise<string[]> {
  try {
    await ensureDir(ACTIVITIES_DIR)
    const files = await fs.readdir(ACTIVITIES_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  } catch {
    return []
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  await ensureCacheDirs()

  const activityFiles = await fs.readdir(ACTIVITIES_DIR).catch(() => [])
  const listFiles = await fs.readdir(LISTS_DIR).catch(() => [])

  let withDetails = 0
  let withLaps = 0
  let withComments = 0
  let totalLaps = 0
  let totalComments = 0
  let oldestEntry: string | null = null
  let newestEntry: string | null = null
  let totalSize = 0

  for (const file of activityFiles.filter(f => f.endsWith('.json'))) {
    try {
      const filePath = path.join(ACTIVITIES_DIR, file)
      const stat = await fs.stat(filePath)
      totalSize += stat.size

      const content = await fs.readFile(filePath, 'utf-8')
      const cached = JSON.parse(content) as CachedActivity

      if (cached.activity) withDetails++
      if (cached.laps.length > 0) withLaps++
      if (cached.comments.length > 0) withComments++

      totalLaps += cached.laps.length
      totalComments += cached.comments.length

      if (!oldestEntry || cached.createdAt < oldestEntry) {
        oldestEntry = cached.createdAt
      }
      if (!newestEntry || cached.lastUpdatedAt > newestEntry) {
        newestEntry = cached.lastUpdatedAt
      }
    } catch {
      // Skip malformed files
    }
  }

  // Add list file sizes
  for (const file of listFiles.filter(f => f.endsWith('.json'))) {
    try {
      const stat = await fs.stat(path.join(LISTS_DIR, file))
      totalSize += stat.size
    } catch {
      // Skip
    }
  }

  return {
    totalActivities: activityFiles.filter(f => f.endsWith('.json')).length,
    withDetails,
    withLaps,
    withComments,
    totalLaps,
    totalComments,
    oldestEntry,
    newestEntry,
    cacheSize: formatBytes(totalSize),
    listSnapshots: listFiles.filter(f => f.endsWith('.json')).length
  }
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<{ activitiesDeleted: number; listsDeleted: number }> {
  let activitiesDeleted = 0
  let listsDeleted = 0

  try {
    const activityFiles = await fs.readdir(ACTIVITIES_DIR)
    for (const file of activityFiles.filter(f => f.endsWith('.json'))) {
      await fs.unlink(path.join(ACTIVITIES_DIR, file))
      activitiesDeleted++
    }
  } catch {
    // Directory might not exist
  }

  try {
    const listFiles = await fs.readdir(LISTS_DIR)
    for (const file of listFiles.filter(f => f.endsWith('.json'))) {
      await fs.unlink(path.join(LISTS_DIR, file))
      listsDeleted++
    }
  } catch {
    // Directory might not exist
  }

  return { activitiesDeleted, listsDeleted }
}

/**
 * Clear cache entries older than specified days
 */
export async function clearOldCache(olderThanDays: number): Promise<{ deleted: number }> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)
  const cutoffStr = cutoff.toISOString()

  let deleted = 0

  try {
    const files = await fs.readdir(ACTIVITIES_DIR)
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const filePath = path.join(ACTIVITIES_DIR, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const cached = JSON.parse(content) as CachedActivity

        if (cached.lastUpdatedAt < cutoffStr) {
          await fs.unlink(filePath)
          deleted++
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Directory might not exist
  }

  return { deleted }
}

/**
 * Delete cache for a specific activity
 */
export async function deleteCachedActivity(activityId: string): Promise<boolean> {
  try {
    await fs.unlink(getActivityCachePath(activityId))
    return true
  } catch {
    return false
  }
}

/**
 * Check what data is cached for an activity
 */
export async function getCacheStatus(activityId: string): Promise<{
  exists: boolean
  hasDetails: boolean
  hasLaps: boolean
  hasComments: boolean
  hasPhotos: boolean
  lapCount: number
  commentCount: number
  photoCount: number
  lastUpdated: string | null
}> {
  const cached = await getCachedActivity(activityId)

  if (!cached) {
    return {
      exists: false,
      hasDetails: false,
      hasLaps: false,
      hasComments: false,
      hasPhotos: false,
      lapCount: 0,
      commentCount: 0,
      photoCount: 0,
      lastUpdated: null
    }
  }

  return {
    exists: true,
    hasDetails: cached.activity !== null,
    hasLaps: cached.lapsFetchedAt !== null,
    hasComments: cached.commentsFetchedAt !== null,
    hasPhotos: cached.photosFetchedAt !== null,
    lapCount: cached.laps.length,
    commentCount: cached.comments.length,
    photoCount: cached.photos?.length || 0,
    lastUpdated: cached.lastUpdatedAt
  }
}

// ============================================
// Utility Functions
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
