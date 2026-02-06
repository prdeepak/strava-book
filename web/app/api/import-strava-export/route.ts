/**
 * API Route: Import Strava Export
 *
 * POST endpoint that imports a Strava bulk data export into the cache.
 * Accepts a path to the export directory on the server filesystem.
 */

import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { parseActivitiesWithMedia } from '@/lib/import/csv-parser'
import { parseFitForPolyline } from '@/lib/import/fit-parser'
import { mapPhotosToActivities } from '@/lib/import/photo-mapper'
import {
  writeCachedActivity,
  writeActivityList,
  mergeActivityList,
  getExistingCachedIds,
} from '@/lib/import/cache-writer'

interface ImportRequest {
  exportDir: string
  athleteId: string
  skipFit?: boolean
}

export async function POST(request: Request) {
  try {
    const body: ImportRequest = await request.json()
    const { exportDir, athleteId, skipFit } = body

    if (!exportDir || !athleteId) {
      return NextResponse.json(
        { error: 'exportDir and athleteId are required' },
        { status: 400 }
      )
    }

    const resolvedDir = path.resolve(exportDir)
    const athleteIdNum = parseInt(athleteId, 10)

    // Verify directory exists
    try {
      await fs.access(resolvedDir)
    } catch {
      return NextResponse.json(
        { error: `Export directory not found: ${resolvedDir}` },
        { status: 404 }
      )
    }

    // 1. Parse CSV
    const csvPath = path.join(resolvedDir, 'activities.csv')
    const { activities, mediaByActivityId, filenameByActivityId } =
      await parseActivitiesWithMedia(csvPath, athleteIdNum)

    // 2. Parse FIT files
    let fitProcessed = 0
    let fitFailed = 0

    if (!skipFit) {
      for (const activity of activities) {
        const activityId = String(activity.id)
        const filename = filenameByActivityId.get(activityId)
        if (!filename) continue

        const fitPath = path.join(resolvedDir, filename)
        try {
          await fs.access(fitPath)
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
        } catch {
          fitFailed++
        }
      }
    }

    // 3. Map photos
    const activityNames = new Map<string, string>()
    for (const a of activities) {
      activityNames.set(String(a.id), a.name)
    }
    const photosByActivityId = await mapPhotosToActivities(
      resolvedDir,
      mediaByActivityId,
      activityNames,
      athleteIdNum
    )

    // 4. Write to cache
    const existingIds = await getExistingCachedIds()
    let written = 0
    let preserved = 0

    for (const activity of activities) {
      const activityId = String(activity.id)
      const photos = photosByActivityId.get(activityId) || []

      if (existingIds.has(activityId)) {
        preserved++
        continue
      }

      if (photos.length > 0) {
        activity.total_photo_count = photos.length
        activity.photos = {
          primary: { urls: { '600': photos[0].urls['5000'] || '' } },
          count: photos.length,
        }
        activity.comprehensiveData = { photos, comments: [] }
      }

      await writeCachedActivity(activityId, activity, photos, [])
      written++
    }

    // 5. Write activity list
    const mergedActivities = await mergeActivityList(athleteId, activities)
    await writeActivityList(athleteId, mergedActivities)

    let totalPhotos = 0
    for (const photos of photosByActivityId.values()) {
      totalPhotos += photos.length
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalActivities: activities.length,
        written,
        preserved,
        fitProcessed,
        fitFailed,
        photosFound: totalPhotos,
        activitiesWithPhotos: photosByActivityId.size,
        listTotal: mergedActivities.length,
      },
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
