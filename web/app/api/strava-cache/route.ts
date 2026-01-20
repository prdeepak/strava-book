/**
 * Strava Cache API
 *
 * GET - Get cache status and statistics
 * POST - Start harvesting Strava data (activity details, laps, comments)
 * DELETE - Clear cache (with options)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { getAthleteActivities } from '@/lib/strava'
import {
  getCacheStats,
  listCachedActivityIds,
  clearAllCache,
  clearOldCache
} from '@/lib/cache/strava-cache'
import {
  cachedStrava,
  getRateLimitInfo,
  isNearRateLimit,
  BatchProgress
} from '@/lib/cache/cached-strava'

export const maxDuration = 300 // 5 minutes max

/**
 * GET /api/strava-cache
 * Returns cache statistics and status
 */
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getCacheStats()
    const cachedIds = await listCachedActivityIds()
    const rateLimits = getRateLimitInfo()
    const rateLimitStatus = isNearRateLimit()

    return NextResponse.json({
      cache: stats,
      cachedActivityIds: cachedIds.slice(0, 100), // First 100 for preview
      totalCached: cachedIds.length,
      rateLimits: {
        ...rateLimits,
        ...rateLimitStatus
      }
    })
  } catch (error) {
    console.error('[Strava Cache] Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get cache status', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/strava-cache
 * Start harvesting Strava data for activities
 *
 * Body options:
 * - mode: 'full' | 'recent' | 'year' (default: 'recent')
 * - year: number (for 'year' mode)
 * - limit: number (max activities to process, default: 100)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const {
      mode = 'recent',
      year,
      limit = 100
    } = body as {
      mode?: 'full' | 'recent' | 'year'
      year?: number
      limit?: number
    }

    const athleteId = session.user?.id || 'unknown'

    console.log(`[Strava Cache] Starting harvest: mode=${mode}, year=${year}, limit=${limit}`)

    // Build date filters based on mode
    let after: number | undefined
    let before: number | undefined

    if (mode === 'year' && year) {
      after = Math.floor(new Date(`${year}-01-01`).getTime() / 1000)
      before = Math.floor(new Date(`${year + 1}-01-01`).getTime() / 1000)
    } else if (mode === 'recent') {
      // Last 6 months
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      after = Math.floor(sixMonthsAgo.getTime() / 1000)
    }
    // 'full' mode: no date filters

    // Step 1: Fetch activity list
    console.log('[Strava Cache] Fetching activity list...')
    const allActivities = await fetchActivityList(session.accessToken, { after, before, limit })

    console.log(`[Strava Cache] Found ${allActivities.length} activities to process`)

    // Check rate limits before proceeding
    const rateLimitStatus = isNearRateLimit()
    if (!rateLimitStatus.canMakeRequest) {
      return NextResponse.json({
        status: 'rate_limited',
        message: 'Rate limit reached. Try again later.',
        rateLimits: getRateLimitInfo(),
        activitiesFound: allActivities.length
      }, { status: 429 })
    }

    // Step 2: Batch fetch data for PDF generation (activity + laps + comments)
    const activityIds = allActivities.map(a => String(a.id))
    const progressUpdates: BatchProgress[] = []

    const result = await cachedStrava.batchFetchForPdf(
      session.accessToken,
      activityIds,
      athleteId,
      {
        onProgress: (progress) => {
          progressUpdates.push(progress)
          console.log(`[Strava Cache] Progress: ${progress.phase} - cached=${progress.cached}, fetched=${progress.fetched}, remaining=${progress.remaining}`)
        },
        maxConcurrent: 3,
        respectRateLimits: true
      }
    )

    // Build summary
    const summary = {
      status: result.skippedRateLimit > 0 ? 'partial' : 'complete',
      processed: {
        total: result.total,
        fromCache: result.fromCache,
        fetched: result.fetched,
        failed: result.failed,
        skippedRateLimit: result.skippedRateLimit
      },
      dataCollected: {
        activities: result.activities.size,
        withLaps: Array.from(result.activities.values()).filter(a => a.laps.length > 0).length,
        withComments: Array.from(result.activities.values()).filter(a => a.comments.length > 0).length,
        totalLaps: Array.from(result.activities.values()).reduce((sum, a) => sum + a.laps.length, 0),
        totalComments: Array.from(result.activities.values()).reduce((sum, a) => sum + a.comments.length, 0)
      },
      rateLimits: getRateLimitInfo(),
      message: result.skippedRateLimit > 0
        ? `Partially complete. ${result.skippedRateLimit} activities skipped due to rate limits. Run again later to continue.`
        : `Successfully cached data for ${result.fetched + result.fromCache} activities.`
    }

    console.log('[Strava Cache] Harvest complete:', summary)

    return NextResponse.json(summary)

  } catch (error) {
    console.error('[Strava Cache] Harvest error:', error)
    return NextResponse.json(
      { error: 'Harvest failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/strava-cache
 * Clear cache (all or old entries)
 *
 * Query params:
 * - all: clear entire cache
 * - olderThan: clear entries older than N days
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const clearAll = searchParams.get('all') === 'true'
  const olderThanDays = searchParams.get('olderThan')

  try {
    if (clearAll) {
      const result = await clearAllCache()
      return NextResponse.json({
        status: 'cleared',
        ...result,
        message: `Cleared ${result.activitiesDeleted} activities and ${result.listsDeleted} list snapshots`
      })
    }

    if (olderThanDays) {
      const days = parseInt(olderThanDays, 10)
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { error: 'Invalid olderThan value' },
          { status: 400 }
        )
      }
      const result = await clearOldCache(days)
      return NextResponse.json({
        status: 'partial_clear',
        deleted: result.deleted,
        message: `Cleared ${result.deleted} entries older than ${days} days`
      })
    }

    return NextResponse.json(
      { error: 'Specify ?all=true or ?olderThan=<days>' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Strava Cache] Clear error:', error)
    return NextResponse.json(
      { error: 'Clear failed', details: String(error) },
      { status: 500 }
    )
  }
}

// Helper to fetch activity list with pagination
async function fetchActivityList(
  accessToken: string,
  options: { after?: number; before?: number; limit: number }
): Promise<{ id: number }[]> {
  const allActivities: { id: number }[] = []
  let page = 1
  const perPage = 100

  while (allActivities.length < options.limit) {
    const activities = await getAthleteActivities(accessToken, {
      after: options.after,
      before: options.before,
      perPage: Math.min(perPage, options.limit - allActivities.length),
      page
    })

    if (activities.length === 0) break
    allActivities.push(...activities)
    if (activities.length < perPage) break
    page++

    // Small delay between pagination
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allActivities
}
