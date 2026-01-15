/**
 * Persistent Photo Cache
 *
 * Stores Strava photo URLs persistently to avoid hitting API rate limits.
 * Uses file-based storage: one JSON file per activity.
 *
 * Key insight: Strava rate-limits API calls (100/15min, 1000/day),
 * but NOT image downloads. Cache the URLs, download images anytime.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { StravaPhoto } from '../strava'

// Cache directory - stored in project root, gitignored
const CACHE_DIR = path.join(process.cwd(), '.cache', 'photos')

export interface CachedActivityPhotos {
  activityId: string
  athleteId: string
  photos: StravaPhoto[]
  fetchedAt: string
  photoCount: number
  // Track if activity had no photos (vs not yet fetched)
  isEmpty: boolean
}

export interface CacheMetadata {
  totalActivities: number
  totalPhotos: number
  activitiesWithPhotos: number
  emptyActivities: number
  oldestEntry: string | null
  newestEntry: string | null
  cacheSize: string
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

/**
 * Get cache file path for an activity
 */
function getCacheFilePath(activityId: string): string {
  return path.join(CACHE_DIR, `${activityId}.json`)
}

/**
 * Check if photos for an activity are cached
 */
export async function isActivityCached(activityId: string): Promise<boolean> {
  try {
    await fs.access(getCacheFilePath(activityId))
    return true
  } catch {
    return false
  }
}

/**
 * Get cached photos for an activity
 * Returns null if not cached
 */
export async function getCachedPhotos(activityId: string): Promise<CachedActivityPhotos | null> {
  try {
    const filePath = getCacheFilePath(activityId)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as CachedActivityPhotos
  } catch {
    return null
  }
}

/**
 * Cache photos for an activity
 */
export async function cachePhotos(
  activityId: string,
  athleteId: string,
  photos: StravaPhoto[]
): Promise<void> {
  await ensureCacheDir()

  const cached: CachedActivityPhotos = {
    activityId,
    athleteId,
    photos,
    fetchedAt: new Date().toISOString(),
    photoCount: photos.length,
    isEmpty: photos.length === 0
  }

  const filePath = getCacheFilePath(activityId)
  await fs.writeFile(filePath, JSON.stringify(cached, null, 2))
}

/**
 * Get multiple cached activities at once
 * Returns map of activityId -> cached data (null if not cached)
 */
export async function getCachedPhotosMultiple(
  activityIds: string[]
): Promise<Map<string, CachedActivityPhotos | null>> {
  const results = new Map<string, CachedActivityPhotos | null>()

  await Promise.all(
    activityIds.map(async (id) => {
      results.set(id, await getCachedPhotos(id))
    })
  )

  return results
}

/**
 * Get cache statistics and metadata
 */
export async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    await ensureCacheDir()
    const files = await fs.readdir(CACHE_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    let totalPhotos = 0
    let activitiesWithPhotos = 0
    let emptyActivities = 0
    let oldestEntry: string | null = null
    let newestEntry: string | null = null
    let totalSize = 0

    for (const file of jsonFiles) {
      const filePath = path.join(CACHE_DIR, file)
      const stat = await fs.stat(filePath)
      totalSize += stat.size

      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const cached = JSON.parse(content) as CachedActivityPhotos

        totalPhotos += cached.photoCount
        if (cached.isEmpty) {
          emptyActivities++
        } else {
          activitiesWithPhotos++
        }

        if (!oldestEntry || cached.fetchedAt < oldestEntry) {
          oldestEntry = cached.fetchedAt
        }
        if (!newestEntry || cached.fetchedAt > newestEntry) {
          newestEntry = cached.fetchedAt
        }
      } catch {
        // Skip malformed files
      }
    }

    return {
      totalActivities: jsonFiles.length,
      totalPhotos,
      activitiesWithPhotos,
      emptyActivities,
      oldestEntry,
      newestEntry,
      cacheSize: formatBytes(totalSize)
    }
  } catch {
    return {
      totalActivities: 0,
      totalPhotos: 0,
      activitiesWithPhotos: 0,
      emptyActivities: 0,
      oldestEntry: null,
      newestEntry: null,
      cacheSize: '0 B'
    }
  }
}

/**
 * List all cached activity IDs
 */
export async function listCachedActivityIds(): Promise<string[]> {
  try {
    await ensureCacheDir()
    const files = await fs.readdir(CACHE_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  } catch {
    return []
  }
}

/**
 * Clear entire cache
 */
export async function clearCache(): Promise<{ deleted: number }> {
  try {
    const files = await fs.readdir(CACHE_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    await Promise.all(
      jsonFiles.map(f => fs.unlink(path.join(CACHE_DIR, f)))
    )

    return { deleted: jsonFiles.length }
  } catch {
    return { deleted: 0 }
  }
}

/**
 * Clear cache entries older than specified days
 */
export async function clearOldCache(olderThanDays: number): Promise<{ deleted: number }> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)
    const cutoffStr = cutoff.toISOString()

    const files = await fs.readdir(CACHE_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    let deleted = 0

    for (const file of jsonFiles) {
      const filePath = path.join(CACHE_DIR, file)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const cached = JSON.parse(content) as CachedActivityPhotos

        if (cached.fetchedAt < cutoffStr) {
          await fs.unlink(filePath)
          deleted++
        }
      } catch {
        // Skip files we can't read
      }
    }

    return { deleted }
  } catch {
    return { deleted: 0 }
  }
}

/**
 * Delete cache for specific activity
 */
export async function deleteCachedPhotos(activityId: string): Promise<boolean> {
  try {
    await fs.unlink(getCacheFilePath(activityId))
    return true
  } catch {
    return false
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
