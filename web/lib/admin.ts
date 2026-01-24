/**
 * Admin utilities for Strava Book
 *
 * Provides admin user identification and cache management.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { CachedActivity } from './cache/strava-cache'

// Admin athlete IDs from environment variable (comma-separated)
// Example: ADMIN_ATHLETE_IDS=12345678,87654321
const ADMIN_ATHLETE_IDS = (process.env.ADMIN_ATHLETE_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(id => id.length > 0)

// Cache directory (same as strava-cache.ts)
const ACTIVITIES_DIR = path.join(process.cwd(), '.cache', 'strava', 'activities')

/**
 * Extract athlete ID from a cached activity.
 * Uses activity.athlete.id as the authoritative source.
 */
function getAthleteIdFromCache(cached: CachedActivity): string | null {
  const id = cached.activity?.athlete?.id
  return id ? String(id) : null
}

/**
 * Check if an athlete ID belongs to an admin user
 */
export function isAdminUser(athleteId: string | number | null | undefined): boolean {
  if (!athleteId) return false
  return ADMIN_ATHLETE_IDS.includes(String(athleteId))
}

/**
 * Get list of admin athlete IDs
 */
export function getAdminAthleteIds(): string[] {
  return ADMIN_ATHLETE_IDS
}

/**
 * Information about an athlete found in the cache
 */
export interface CachedAthleteInfo {
  athleteId: string
  activityCount: number
  oldestActivity: string | null // date string
  newestActivity: string | null // date string
  lastCacheUpdate: string | null // date string
}

/**
 * Scan the cache directory to find all athletes with cached data
 */
export async function getAvailableAthletes(): Promise<CachedAthleteInfo[]> {
  const athleteMap = new Map<string, CachedAthleteInfo>()

  try {
    await fs.mkdir(ACTIVITIES_DIR, { recursive: true })
    const files = await fs.readdir(ACTIVITIES_DIR)

    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await fs.readFile(path.join(ACTIVITIES_DIR, file), 'utf-8')
        const cached = JSON.parse(content) as CachedActivity

        const athleteId = getAthleteIdFromCache(cached)
        if (!athleteId) continue

        let info = athleteMap.get(athleteId)

        if (!info) {
          info = {
            athleteId,
            activityCount: 0,
            oldestActivity: null,
            newestActivity: null,
            lastCacheUpdate: null
          }
          athleteMap.set(athleteId, info)
        }

        info.activityCount++

        // Track activity date range
        const activityDate = cached.activity?.start_date_local || cached.activity?.start_date
        if (activityDate) {
          if (!info.oldestActivity || activityDate < info.oldestActivity) {
            info.oldestActivity = activityDate
          }
          if (!info.newestActivity || activityDate > info.newestActivity) {
            info.newestActivity = activityDate
          }
        }

        // Track last cache update
        if (cached.lastUpdatedAt) {
          if (!info.lastCacheUpdate || cached.lastUpdatedAt > info.lastCacheUpdate) {
            info.lastCacheUpdate = cached.lastUpdatedAt
          }
        }
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by activity count (descending)
  return Array.from(athleteMap.values()).sort((a, b) => b.activityCount - a.activityCount)
}

/**
 * Get all cached activities for a specific athlete
 */
export async function getCachedActivitiesForAthlete(athleteId: string): Promise<CachedActivity[]> {
  const activities: CachedActivity[] = []

  try {
    await fs.mkdir(ACTIVITIES_DIR, { recursive: true })
    const files = await fs.readdir(ACTIVITIES_DIR)

    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await fs.readFile(path.join(ACTIVITIES_DIR, file), 'utf-8')
        const cached = JSON.parse(content) as CachedActivity

        if (getAthleteIdFromCache(cached) === athleteId) {
          activities.push(cached)
        }
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by activity date (newest first)
  return activities.sort((a, b) => {
    const dateA = a.activity?.start_date_local || a.activity?.start_date || ''
    const dateB = b.activity?.start_date_local || b.activity?.start_date || ''
    return dateB.localeCompare(dateA)
  })
}
