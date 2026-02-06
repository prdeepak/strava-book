#!/usr/bin/env npx tsx
/**
 * Import Strava Export CLI
 *
 * Imports a Strava bulk data export (CSV + FIT files + media) into the
 * existing cache format so the book generation pipeline works unchanged.
 *
 * Usage:
 *   npx tsx scripts/import-strava-export.ts \
 *     --export-dir=../../strava-export-deepak/export_112292663 \
 *     --athlete-id=112292663
 */

import path from 'path'
import { promises as fs } from 'fs'
import { parseActivitiesWithMedia } from '../lib/import/csv-parser'
import { parseFitForPolyline } from '../lib/import/fit-parser'
import { mapPhotosToActivities } from '../lib/import/photo-mapper'
import {
  writeCachedActivity,
  writeActivityList,
  mergeActivityList,
  getExistingCachedIds,
} from '../lib/import/cache-writer'
import { StravaActivity } from '../lib/strava'

// Parse CLI arguments
function parseArgs(): { exportDir: string; athleteId: string; skipFit?: boolean; dryRun?: boolean } {
  const args = process.argv.slice(2)
  let exportDir = ''
  let athleteId = ''
  let skipFit = false
  let dryRun = false

  for (const arg of args) {
    if (arg.startsWith('--export-dir=')) {
      exportDir = arg.split('=')[1]
    } else if (arg.startsWith('--athlete-id=')) {
      athleteId = arg.split('=')[1]
    } else if (arg === '--skip-fit') {
      skipFit = true
    } else if (arg === '--dry-run') {
      dryRun = true
    }
  }

  if (!exportDir || !athleteId) {
    console.error('Usage: npx tsx scripts/import-strava-export.ts --export-dir=<path> --athlete-id=<id> [--skip-fit] [--dry-run]')
    process.exit(1)
  }

  // Resolve relative paths from the web/ directory
  exportDir = path.resolve(exportDir)

  return { exportDir, athleteId, skipFit, dryRun }
}

async function main() {
  const { exportDir, athleteId, skipFit, dryRun } = parseArgs()
  const athleteIdNum = parseInt(athleteId, 10)

  console.log('=== Strava Export Import ===')
  console.log(`Export dir: ${exportDir}`)
  console.log(`Athlete ID: ${athleteId}`)
  console.log(`Skip FIT: ${skipFit}`)
  console.log(`Dry run: ${dryRun}`)
  console.log()

  // 1. Parse activities.csv
  console.log('1. Parsing activities.csv...')
  const csvPath = path.join(exportDir, 'activities.csv')
  const { activities, mediaByActivityId, filenameByActivityId } = await parseActivitiesWithMedia(csvPath, athleteIdNum)
  console.log(`   Found ${activities.length} activities`)
  console.log(`   ${mediaByActivityId.size} activities have photos`)
  console.log(`   ${filenameByActivityId.size} activities have FIT files`)
  console.log()

  // 2. Parse FIT files for GPS data
  console.log('2. Parsing FIT files for GPS data...')
  let fitProcessed = 0
  let fitFailed = 0
  let fitSkipped = 0

  if (!skipFit) {
    for (const activity of activities) {
      const activityId = String(activity.id)
      const filename = filenameByActivityId.get(activityId)

      if (!filename) {
        fitSkipped++
        continue
      }

      const fitPath = path.join(exportDir, filename)

      try {
        await fs.access(fitPath)
      } catch {
        fitSkipped++
        continue
      }

      try {
        const fitData = await parseFitForPolyline(fitPath)

        if (fitData.summaryPolyline) {
          activity.map.summary_polyline = fitData.summaryPolyline
        }
        if (fitData.startLatlng) {
          activity.start_latlng = fitData.startLatlng
        }
        if (fitData.endLatlng) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (activity as any).end_latlng = fitData.endLatlng
        }

        fitProcessed++
        if (fitProcessed % 50 === 0) {
          console.log(`   Processed ${fitProcessed} FIT files...`)
        }
      } catch (error) {
        fitFailed++
        if (fitFailed <= 5) {
          console.log(`   Failed to parse FIT: ${filename}: ${error instanceof Error ? error.message : error}`)
        }
      }
    }
  } else {
    fitSkipped = activities.length
  }

  console.log(`   Processed: ${fitProcessed}, Failed: ${fitFailed}, Skipped: ${fitSkipped}`)
  console.log()

  // 3. Map photos to activities
  console.log('3. Mapping photos to activities...')
  const activityNames = new Map<string, string>()
  for (const a of activities) {
    activityNames.set(String(a.id), a.name)
  }

  const photosByActivityId = await mapPhotosToActivities(
    exportDir,
    mediaByActivityId,
    activityNames,
    athleteIdNum
  )

  let totalPhotos = 0
  for (const photos of photosByActivityId.values()) {
    totalPhotos += photos.length
  }
  console.log(`   Mapped ${totalPhotos} photos to ${photosByActivityId.size} activities`)
  console.log()

  if (dryRun) {
    console.log('DRY RUN — not writing to cache')
    printSummary(activities, photosByActivityId)
    return
  }

  // 4. Write to cache
  console.log('4. Writing to cache...')
  const existingIds = await getExistingCachedIds()
  console.log(`   ${existingIds.size} activities already in cache`)

  let written = 0
  let preserved = 0

  for (const activity of activities) {
    const activityId = String(activity.id)
    const photos = photosByActivityId.get(activityId) || []

    if (existingIds.has(activityId)) {
      preserved++
      // Update photos on existing cached activities if we have import photos
      if (photos.length > 0) {
        // Read existing, add photos if it doesn't have them
        try {
          const cachePath = path.join(process.cwd(), '.cache', 'strava', 'activities', `${activityId}.json`)
          const content = await fs.readFile(cachePath, 'utf-8')
          const cached = JSON.parse(content)

          // Only add photos if existing cache has none
          if (!cached.photos || cached.photos.length === 0) {
            cached.photos = photos
            cached.photosFetchedAt = new Date().toISOString()
            cached.lastUpdatedAt = new Date().toISOString()
            await fs.writeFile(cachePath, JSON.stringify(cached, null, 2))
          }
        } catch {
          // Skip if we can't update
        }
      }
      continue
    }

    // Add photo metadata to the activity for book generation
    if (photos.length > 0) {
      activity.total_photo_count = photos.length
      activity.photos = {
        primary: {
          urls: {
            '600': photos[0].urls['5000'] || photos[0].urls['600'] || '',
          },
        },
        count: photos.length,
      }
      activity.comprehensiveData = {
        photos,
        comments: [],
      }
    }

    await writeCachedActivity(activityId, activity, photos, [])
    written++

    if (written % 100 === 0) {
      console.log(`   Written ${written} activities...`)
    }
  }

  console.log(`   Written: ${written}, Preserved existing: ${preserved}`)
  console.log()

  // 5. Write activity list
  console.log('5. Writing activity list...')
  const mergedActivities = await mergeActivityList(athleteId, activities)
  await writeActivityList(athleteId, mergedActivities)
  console.log(`   Wrote list with ${mergedActivities.length} activities`)
  console.log()

  // 6. Print summary
  printSummary(activities, photosByActivityId)

  // 7. Verify against existing cache
  if (existingIds.size > 0) {
    console.log('\n=== Verification Against Existing Cache ===')
    await verifyAgainstCache(activities, existingIds, athleteId)
  }
}

function printSummary(
  activities: StravaActivity[],
  photosByActivityId: Map<string, unknown[]>
) {
  console.log('=== Import Summary ===')
  console.log(`Total activities: ${activities.length}`)

  // Count by type
  const byType = new Map<string, number>()
  for (const a of activities) {
    byType.set(a.type, (byType.get(a.type) || 0) + 1)
  }
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`)
  }

  console.log(`Activities with photos: ${photosByActivityId.size}`)
  console.log(`Activities with GPS: ${activities.filter(a => a.map.summary_polyline).length}`)

  // Date range
  const dates = activities
    .map(a => new Date(a.start_date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length > 0) {
    console.log(`Date range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`)
  }
}

async function verifyAgainstCache(
  importedActivities: StravaActivity[],
  existingIds: Set<string>,
  _athleteId: string
) {
  const importedById = new Map<number, StravaActivity>()
  for (const a of importedActivities) {
    importedById.set(a.id, a)
  }

  let matched = 0
  let mismatched = 0
  const mismatches: string[] = []

  for (const existingId of existingIds) {
    try {
      const cachePath = path.join(process.cwd(), '.cache', 'strava', 'activities', `${existingId}.json`)
      const content = await fs.readFile(cachePath, 'utf-8')
      const cached = JSON.parse(content)
      const cachedActivity = cached.activity

      if (!cachedActivity) continue

      const imported = importedById.get(cachedActivity.id)
      if (!imported) {
        mismatches.push(`${existingId}: Not found in import`)
        mismatched++
        continue
      }

      const issues: string[] = []

      // Compare name
      if (imported.name !== cachedActivity.name) {
        issues.push(`name: "${imported.name}" vs "${cachedActivity.name}"`)
      }

      // Compare distance (within 1%)
      if (cachedActivity.distance > 0) {
        const distDiff = Math.abs(imported.distance - cachedActivity.distance) / cachedActivity.distance
        if (distDiff > 0.01) {
          issues.push(`distance: ${imported.distance.toFixed(1)} vs ${cachedActivity.distance.toFixed(1)} (${(distDiff * 100).toFixed(1)}% diff)`)
        }
      }

      // Compare moving_time
      if (cachedActivity.moving_time > 0) {
        const timeDiff = Math.abs(imported.moving_time - cachedActivity.moving_time)
        if (timeDiff > 5) {
          issues.push(`moving_time: ${imported.moving_time} vs ${cachedActivity.moving_time} (${timeDiff}s diff)`)
        }
      }

      // Compare type
      if (imported.type !== cachedActivity.type) {
        issues.push(`type: "${imported.type}" vs "${cachedActivity.type}"`)
      }

      if (issues.length > 0) {
        mismatches.push(`${existingId} (${cachedActivity.name}): ${issues.join(', ')}`)
        mismatched++
      } else {
        matched++
      }
    } catch {
      // Skip files we can't read
    }
  }

  console.log(`Matched: ${matched}/${existingIds.size}`)
  console.log(`Mismatched: ${mismatched}/${existingIds.size}`)

  if (mismatches.length > 0) {
    console.log('\nMismatches:')
    for (const m of mismatches) {
      console.log(`  - ${m}`)
    }
  }
}

main().catch(error => {
  console.error('Import failed:', error)
  process.exit(1)
})
