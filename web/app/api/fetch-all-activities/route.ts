import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { getAthleteActivities, StravaActivity, StravaPhoto, StravaComment, StravaStreams } from '@/lib/strava'
import { cachedStrava, enrichActivitiesFromCache, getRateLimitInfo } from '@/lib/cache'

export const maxDuration = 300 // 5 minutes max for Vercel

interface ComprehensiveActivity extends Omit<StravaActivity, 'comprehensiveData'> {
    comprehensiveData: {
        photos: StravaPhoto[]
        comments: StravaComment[]
        streams: StravaStreams | Record<string, unknown>
        fetchedAt: string
    }
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const afterDate = searchParams.get('after') // ISO date string
    const beforeDate = searchParams.get('before') // ISO date string
    const skipDetails = searchParams.get('skipDetails') === 'true' // For faster initial fetch
    const useCache = searchParams.get('useCache') !== 'false' // Default true

    // Convert dates to Unix timestamps
    const after = afterDate ? Math.floor(new Date(afterDate).getTime() / 1000) : undefined
    const before = beforeDate ? Math.floor(new Date(beforeDate).getTime() / 1000) : undefined

    const athleteId = session.user?.id || 'unknown'

    try {
        console.log(`[Fetch All] Starting fetch: after=${afterDate}, before=${beforeDate}, useCache=${useCache}`)

        // Step 1: Fetch all activity summaries (paginated)
        const allActivities: StravaActivity[] = []
        let page = 1
        const perPage = 100 // Max allowed by Strava

        while (true) {
            console.log(`[Fetch All] Fetching page ${page}...`)
            const activities = await getAthleteActivities(session.accessToken, {
                after,
                before,
                perPage,
                page,
            })

            if (activities.length === 0) break

            allActivities.push(...activities)
            console.log(`[Fetch All] Got ${activities.length} activities, total: ${allActivities.length}`)

            if (activities.length < perPage) break // Last page

            page++
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        console.log(`[Fetch All] Total activities found: ${allActivities.length}`)

        // If skipDetails, return just summaries for quick overview
        if (skipDetails) {
            // Still try to enrich from cache if available
            if (useCache) {
                const { enriched, uncachedCount } = await enrichActivitiesFromCache(allActivities)
                return NextResponse.json({
                    activities: enriched,
                    metadata: {
                        totalCount: enriched.length,
                        dateRange: { after: afterDate, before: beforeDate },
                        fetchedAt: new Date().toISOString(),
                        detailsIncluded: false,
                        enrichedFromCache: enriched.length - uncachedCount,
                        uncached: uncachedCount
                    }
                })
            }

            return NextResponse.json({
                activities: allActivities,
                metadata: {
                    totalCount: allActivities.length,
                    dateRange: { after: afterDate, before: beforeDate },
                    fetchedAt: new Date().toISOString(),
                    detailsIncluded: false,
                }
            })
        }

        // Step 2: Fetch comprehensive data using cached client
        const activityIds = allActivities.map(a => String(a.id))

        const result = await cachedStrava.batchFetchComprehensive(
            session.accessToken,
            activityIds,
            athleteId,
            {
                onProgress: (progress) => {
                    console.log(`[Fetch All] Progress: ${progress.phase} - cached=${progress.cached}, fetched=${progress.fetched}`)
                },
                maxConcurrent: 3,
                respectRateLimits: true,
                includeStreams: true
            }
        )

        // Build comprehensive activities from results
        const comprehensiveActivities: ComprehensiveActivity[] = allActivities.map(activity => {
            const cached = result.activities.get(String(activity.id))
            if (cached) {
                return {
                    ...(cached.activity || activity),
                    comprehensiveData: {
                        photos: cached.photos,
                        comments: cached.comments,
                        streams: cached.streams || {},
                        fetchedAt: cached.lastUpdatedAt
                    }
                }
            }
            return {
                ...activity,
                comprehensiveData: {
                    photos: [],
                    comments: [],
                    streams: {},
                    fetchedAt: new Date().toISOString()
                }
            }
        })

        return NextResponse.json({
            activities: comprehensiveActivities,
            metadata: {
                totalCount: comprehensiveActivities.length,
                dateRange: { after: afterDate, before: beforeDate },
                fetchedAt: new Date().toISOString(),
                detailsIncluded: true,
                fromCache: result.fromCache,
                freshlyFetched: result.fetched,
                failed: result.failed,
                skippedRateLimit: result.skippedRateLimit,
                withPhotos: comprehensiveActivities.filter(a => a.comprehensiveData.photos.length > 0).length,
                withComments: comprehensiveActivities.filter(a => a.comprehensiveData.comments.length > 0).length,
                races: comprehensiveActivities.filter(a => a.workout_type === 1).length,
                rateLimits: getRateLimitInfo()
            }
        })

    } catch (error) {
        console.error('[Fetch All] Failed:', error)
        return NextResponse.json(
            { error: 'Failed to fetch activities', details: String(error) },
            { status: 500 }
        )
    }
}
