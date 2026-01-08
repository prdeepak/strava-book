import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import {
    getAthleteActivities,
    getActivity,
    getActivityComments,
    getActivityPhotos,
    getActivityStreams,
    StravaActivity
} from '@/lib/strava'

export const maxDuration = 300 // 5 minutes max for Vercel

interface ComprehensiveActivity extends StravaActivity {
    comprehensiveData: {
        photos: Awaited<ReturnType<typeof getActivityPhotos>>
        comments: Awaited<ReturnType<typeof getActivityComments>>
        streams: Awaited<ReturnType<typeof getActivityStreams>>
        fetchedAt: string
    }
}

// Helper to add delay between API calls to respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const afterDate = searchParams.get('after') // ISO date string
    const beforeDate = searchParams.get('before') // ISO date string
    const skipDetails = searchParams.get('skipDetails') === 'true' // For faster initial fetch

    // Convert dates to Unix timestamps
    const after = afterDate ? Math.floor(new Date(afterDate).getTime() / 1000) : undefined
    const before = beforeDate ? Math.floor(new Date(beforeDate).getTime() / 1000) : undefined

    try {
        console.log(`[Fetch All] Starting fetch: after=${afterDate}, before=${beforeDate}`)

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
            await delay(100) // Small delay between pagination calls
        }

        console.log(`[Fetch All] Total activities found: ${allActivities.length}`)

        // If skipDetails, return just summaries for quick overview
        if (skipDetails) {
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

        // Step 2: Fetch comprehensive data for each activity
        const comprehensiveActivities: ComprehensiveActivity[] = []

        for (let i = 0; i < allActivities.length; i++) {
            const activity = allActivities[i]
            console.log(`[Fetch All] Fetching details for activity ${i + 1}/${allActivities.length}: ${activity.name}`)

            try {
                // Fetch all details in parallel
                const [detailedActivity, photos, comments, streams] = await Promise.all([
                    getActivity(session.accessToken, activity.id.toString()),
                    getActivityPhotos(session.accessToken, activity.id.toString()),
                    getActivityComments(session.accessToken, activity.id.toString()),
                    getActivityStreams(session.accessToken, activity.id.toString()),
                ])

                comprehensiveActivities.push({
                    ...detailedActivity,
                    comprehensiveData: {
                        photos,
                        comments,
                        streams,
                        fetchedAt: new Date().toISOString(),
                    }
                })

                // Rate limiting: ~15 requests per 15 seconds = 1 per second
                // We make 4 requests per activity, so wait 300ms between activities
                await delay(300)

            } catch (error) {
                console.error(`[Fetch All] Error fetching activity ${activity.id}:`, error)
                // Continue with basic data if detail fetch fails
                comprehensiveActivities.push({
                    ...activity,
                    comprehensiveData: {
                        photos: [],
                        comments: [],
                        streams: {},
                        fetchedAt: new Date().toISOString(),
                    }
                })
            }
        }

        return NextResponse.json({
            activities: comprehensiveActivities,
            metadata: {
                totalCount: comprehensiveActivities.length,
                dateRange: { after: afterDate, before: beforeDate },
                fetchedAt: new Date().toISOString(),
                detailsIncluded: true,
                withPhotos: comprehensiveActivities.filter(a => a.comprehensiveData.photos.length > 0).length,
                withComments: comprehensiveActivities.filter(a => a.comprehensiveData.comments.length > 0).length,
                races: comprehensiveActivities.filter(a => a.workout_type === 1).length,
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
