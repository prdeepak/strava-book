/**
 * Cache Writer for Strava Import
 *
 * Writes imported Strava export data into the existing cache format
 * so the book generation pipeline works unchanged.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { StravaActivity, StravaPhoto } from '../strava'
import { CachedActivity, CachedActivityList, StravaLap } from '../cache/strava-cache'

const CACHE_BASE = path.join(process.cwd(), '.cache', 'strava')
const ACTIVITIES_DIR = path.join(CACHE_BASE, 'activities')
const LISTS_DIR = path.join(CACHE_BASE, 'lists')

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Write a single activity to the cache
 * If the activity already exists in cache, preserve API data
 * (which is richer than import data)
 */
export async function writeCachedActivity(
  activityId: string,
  activity: StravaActivity,
  photos: StravaPhoto[],
  laps: StravaLap[],
  options?: { preserveExisting?: boolean }
): Promise<void> {
  await ensureDir(ACTIVITIES_DIR)

  const cachePath = path.join(ACTIVITIES_DIR, `${activityId}.json`)

  // Check if activity already exists in cache
  if (options?.preserveExisting) {
    try {
      await fs.access(cachePath)
      // File exists — preserve the API data
      return
    } catch {
      // File doesn't exist — proceed with writing
    }
  }

  const now = new Date().toISOString()

  const cached: CachedActivity = {
    activityId,
    activity,
    activityFetchedAt: now,
    laps,
    lapsFetchedAt: now,
    comments: [],
    commentsFetchedAt: now,
    photos,
    photosFetchedAt: now,
    createdAt: now,
    lastUpdatedAt: now,
  }

  await fs.writeFile(cachePath, JSON.stringify(cached, null, 2))
}

/**
 * Write the activity list cache
 */
export async function writeActivityList(
  athleteId: string,
  activities: StravaActivity[],
  options?: { after?: number; before?: number }
): Promise<void> {
  await ensureDir(LISTS_DIR)

  const parts = [athleteId]
  if (options?.after) parts.push(`after-${options.after}`)
  if (options?.before) parts.push(`before-${options.before}`)
  const key = parts.join('_')

  const cached: CachedActivityList = {
    athleteId,
    query: {
      after: options?.after,
      before: options?.before,
    },
    activities,
    fetchedAt: new Date().toISOString(),
    totalCount: activities.length,
  }

  await fs.writeFile(
    path.join(LISTS_DIR, `${key}.json`),
    JSON.stringify(cached, null, 2)
  )
}

/**
 * Merge imported activities with existing cached activity list
 * Preserves workout_type and other API-only fields from the existing list
 */
export async function mergeActivityList(
  athleteId: string,
  importedActivities: StravaActivity[]
): Promise<StravaActivity[]> {
  // Read existing list
  const listPath = path.join(LISTS_DIR, `${athleteId}.json`)
  let existingActivities: StravaActivity[] = []

  try {
    const content = await fs.readFile(listPath, 'utf-8')
    const cached = JSON.parse(content) as CachedActivityList
    existingActivities = cached.activities
  } catch {
    // No existing list
  }

  // Build lookup of existing activities by ID
  const existingById = new Map<number, StravaActivity>()
  for (const activity of existingActivities) {
    existingById.set(activity.id, activity)
  }

  // Merge: for each imported activity, preserve API fields from existing
  const merged: StravaActivity[] = []
  const seenIds = new Set<number>()

  for (const imported of importedActivities) {
    const existing = existingById.get(imported.id)
    if (existing) {
      // Merge: API data takes priority, import fills gaps
      const mergedActivity: StravaActivity = {
        ...imported,
        ...existing,
        // But use import data to fill any gaps
        description: existing.description || imported.description,
      }
      merged.push(mergedActivity)
    } else {
      merged.push(imported)
    }
    seenIds.add(imported.id)
  }

  // Add any existing activities not in the import (shouldn't happen, but be safe)
  for (const existing of existingActivities) {
    if (!seenIds.has(existing.id)) {
      merged.push(existing)
    }
  }

  // Sort by start_date descending (most recent first)
  merged.sort((a, b) => {
    const dateA = new Date(a.start_date).getTime()
    const dateB = new Date(b.start_date).getTime()
    return dateB - dateA
  })

  return merged
}

/**
 * Get existing cached activity IDs
 */
export async function getExistingCachedIds(): Promise<Set<string>> {
  try {
    await ensureDir(ACTIVITIES_DIR)
    const files = await fs.readdir(ACTIVITIES_DIR)
    return new Set(
      files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
    )
  } catch {
    return new Set()
  }
}
