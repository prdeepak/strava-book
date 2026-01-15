/**
 * Photo Cache API
 *
 * GET - Get cache status and statistics
 * POST - Start harvesting photos (background job)
 * DELETE - Clear cache (with options)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { getAthleteActivities, StravaActivity } from '@/lib/strava'
import {
  getCacheMetadata,
  listCachedActivityIds,
  clearCache,
  clearOldCache
} from '@/lib/cache/photo-cache'
import {
  batchFetchPhotosWithCache,
  getRateLimitInfo,
  isNearRateLimit,
  BatchProgress
} from '@/lib/cache/cached-strava'

export const maxDuration = 300 // 5 minutes max

/**
 * GET /api/photo-cache
 * Returns cache statistics and status
 */
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const metadata = await getCacheMetadata()
    const cachedIds = await listCachedActivityIds()
    const rateLimits = getRateLimitInfo()
    const rateLimitStatus = isNearRateLimit()

    return NextResponse.json({
      cache: metadata,
      cachedActivityIds: cachedIds.slice(0, 100), // First 100 for preview
      totalCached: cachedIds.length,
      rateLimits: {
        ...rateLimits,
        ...rateLimitStatus
      }
    })
  } catch (error) {
    console.error('[Photo Cache] Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get cache status', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/photo-cache
 * Start harvesting photos for activities
 *
 * Body options:
 * - mode: 'full' | 'recent' | 'year' (default: 'recent')
 * - year: number (for 'year' mode)
 * - limit: number (max activities to process, default: 100)
 * - forceRefresh: boolean (re-fetch even if cached)
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
      limit = 100,
    } = body as {
      mode?: 'full' | 'recent' | 'year'
      year?: number
      limit?: number
    }

    console.log(`[Photo Cache] Starting harvest: mode=${mode}, year=${year}, limit=${limit}`)

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

    // Step 1: Fetch activity list (paginated)
    console.log('[Photo Cache] Fetching activity list...')
    const allActivities: StravaActivity[] = []
    let page = 1
    const perPage = 100

    while (allActivities.length < limit) {
      const activities = await getAthleteActivities(session.accessToken, {
        after,
        before,
        perPage: Math.min(perPage, limit - allActivities.length),
        page
      })

      if (activities.length === 0) break
      allActivities.push(...activities)
      if (activities.length < perPage) break
      page++

      // Small delay between pagination
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`[Photo Cache] Found ${allActivities.length} activities to process`)

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

    // Step 2: Batch fetch photos with caching
    const progressUpdates: BatchProgress[] = []

    const result = await batchFetchPhotosWithCache(
      session.accessToken,
      allActivities,
      session.user?.id || 'unknown',
      {
        onProgress: (progress) => {
          progressUpdates.push(progress)
          console.log(`[Photo Cache] Progress: ${progress.phase} - ${progress.fetched}/${progress.total - progress.cached} fetched`)
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
      photosFound: Array.from(result.photos.values()).reduce((sum, photos) => sum + photos.length, 0),
      activitiesWithPhotos: Array.from(result.photos.values()).filter(photos => photos.length > 0).length,
      rateLimits: getRateLimitInfo(),
      message: result.skippedRateLimit > 0
        ? `Partially complete. ${result.skippedRateLimit} activities skipped due to rate limits. Run again later to continue.`
        : `Successfully cached photos for ${result.fetched} activities.`
    }

    console.log('[Photo Cache] Harvest complete:', summary)

    return NextResponse.json(summary)

  } catch (error) {
    console.error('[Photo Cache] Harvest error:', error)
    return NextResponse.json(
      { error: 'Harvest failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/photo-cache
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
      const result = await clearCache()
      return NextResponse.json({
        status: 'cleared',
        deleted: result.deleted,
        message: `Cleared ${result.deleted} cached entries`
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
    console.error('[Photo Cache] Clear error:', error)
    return NextResponse.json(
      { error: 'Clear failed', details: String(error) },
      { status: 500 }
    )
  }
}
