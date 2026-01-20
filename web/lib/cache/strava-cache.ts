/**
 * Unified Strava Data Cache
 *
 * Stores ALL Strava data persistently to avoid API rate limits.
 * File-based storage: one JSON file per activity with complete data.
 *
 * Cached data types:
 * - Activity details (from getActivity)
 * - Photos (from getActivityPhotos)
 * - Comments (from getActivityComments)
 * - Streams (from getActivityStreams)
 * - Activity list snapshots (from getAthleteActivities)
 */

import { promises as fs } from 'fs'
import path from 'path'
import {
  StravaActivity,
  StravaPhoto,
  StravaComment,
  StravaStreams
} from '../strava'

// Cache directories
const CACHE_BASE = path.join(process.cwd(), '.cache', 'strava')
const ACTIVITIES_DIR = path.join(CACHE_BASE, 'activities')
const LISTS_DIR = path.join(CACHE_BASE, 'lists')

/**
 * Complete cached data for a single activity
 */
export interface CachedActivity {
  // Identifiers
  activityId: string
  athleteId: string

  // Core activity data
  activity: StravaActivity | null
  activityFetchedAt: string | null

  // Related data
  photos: StravaPhoto[]
  photosFetchedAt: string | null

  comments: StravaComment[]
  commentsFetchedAt: string | null

  streams: StravaStreams | null
  streamsFetchedAt: string | null

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
  withPhotos: number
  withComments: number
  withStreams: number
  totalPhotos: number
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
    photos: [],
    photosFetchedAt: null,
    comments: [],
    commentsFetchedAt: null,
    streams: null,
    streamsFetchedAt: null,
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
 * Cache activity details
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
 * Cache activity photos
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
 * Cache activity comments
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
 * Cache activity streams
 */
export async function cacheActivityStreams(
  activityId: string,
  athleteId: string,
  streams: StravaStreams
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  cached.streams = streams
  cached.streamsFetchedAt = new Date().toISOString()
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
    photos?: StravaPhoto[]
    comments?: StravaComment[]
    streams?: StravaStreams
  }
): Promise<void> {
  const cached = await getOrCreateCacheEntry(activityId, athleteId)
  const now = new Date().toISOString()

  if (data.activity !== undefined) {
    cached.activity = data.activity
    cached.activityFetchedAt = now
  }
  if (data.photos !== undefined) {
    cached.photos = data.photos
    cached.photosFetchedAt = now
  }
  if (data.comments !== undefined) {
    cached.comments = data.comments
    cached.commentsFetchedAt = now
  }
  if (data.streams !== undefined) {
    cached.streams = data.streams
    cached.streamsFetchedAt = now
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
  let withPhotos = 0
  let withComments = 0
  let withStreams = 0
  let totalPhotos = 0
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
      if (cached.photos.length > 0) withPhotos++
      if (cached.comments.length > 0) withComments++
      if (cached.streams) withStreams++

      totalPhotos += cached.photos.length
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
    withPhotos,
    withComments,
    withStreams,
    totalPhotos,
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
  hasPhotos: boolean
  hasComments: boolean
  hasStreams: boolean
  photoCount: number
  commentCount: number
  lastUpdated: string | null
}> {
  const cached = await getCachedActivity(activityId)

  if (!cached) {
    return {
      exists: false,
      hasDetails: false,
      hasPhotos: false,
      hasComments: false,
      hasStreams: false,
      photoCount: 0,
      commentCount: 0,
      lastUpdated: null
    }
  }

  return {
    exists: true,
    hasDetails: cached.activity !== null,
    hasPhotos: cached.photos.length > 0 || cached.photosFetchedAt !== null,
    hasComments: cached.comments.length > 0 || cached.commentsFetchedAt !== null,
    hasStreams: cached.streams !== null,
    photoCount: cached.photos.length,
    commentCount: cached.comments.length,
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

// ============================================
// Migration: Import from old photo cache
// ============================================

/**
 * Migrate data from old photo-only cache to unified cache
 * Run once if upgrading from previous version
 */
export async function migrateFromPhotoCache(): Promise<{ migrated: number }> {
  const OLD_CACHE_DIR = path.join(process.cwd(), '.cache', 'photos')

  let migrated = 0

  try {
    const files = await fs.readdir(OLD_CACHE_DIR)

    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await fs.readFile(path.join(OLD_CACHE_DIR, file), 'utf-8')
        const old = JSON.parse(content)

        // Old format had: activityId, athleteId, photos, fetchedAt
        if (old.activityId && old.photos) {
          await cacheActivityPhotos(old.activityId, old.athleteId || 'unknown', old.photos)
          migrated++
        }
      } catch {
        // Skip files we can't parse
      }
    }
  } catch {
    // Old cache directory doesn't exist
  }

  return { migrated }
}
