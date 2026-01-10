import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getAthleteActivities, getActivityPhotos, StravaActivity } from '@/lib/strava'
import { generateSmartDraft } from '@/lib/curator'
import { BookDocument } from '@/components/templates/BookDocument'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'

/**
 * Fetch photos for a single activity and merge into the activity object.
 * Structures the photo data to match the expected format: activity.photos.primary.urls['600']
 */
async function enrichActivityWithPhotos(
    activity: StravaActivity,
    accessToken: string
): Promise<StravaActivity> {
    try {
        const photos = await getActivityPhotos(accessToken, activity.id.toString())

        if (photos.length > 0) {
            // Find the primary photo (first one) and structure it correctly
            const primaryPhoto = photos[0]

            // Get the best available URL - prefer 5000, fallback to other sizes
            const photoUrl = primaryPhoto.urls?.['5000']
                || primaryPhoto.urls?.['600']
                || Object.values(primaryPhoto.urls || {})[0]

            return {
                ...activity,
                photos: {
                    primary: {
                        urls: photoUrl ? { '600': photoUrl } : undefined
                    },
                    count: photos.length
                },
                allPhotos: photos
            }
        }
    } catch (error) {
        console.error(`[Book PDF] Failed to fetch photos for activity ${activity.id}:`, error)
    }

    return activity
}

/**
 * Fetch photos for multiple activities with rate limiting.
 * Uses batched concurrent requests to balance speed vs API limits.
 */
async function enrichActivitiesWithPhotos(
    activities: StravaActivity[],
    accessToken: string,
    batchSize: number = 5
): Promise<StravaActivity[]> {
    const enrichedActivities: StravaActivity[] = []

    for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize)
        const enrichedBatch = await Promise.all(
            batch.map(activity => enrichActivityWithPhotos(activity, accessToken))
        )
        enrichedActivities.push(...enrichedBatch)

        // Small delay between batches to respect rate limits
        if (i + batchSize < activities.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    return enrichedActivities
}

export async function GET() {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const accessToken = session.accessToken

        // Fetch activities
        console.log('[Book PDF] Fetching activities...')
        const activities = await getAthleteActivities(accessToken)
        console.log('[Book PDF] Found', activities.length, 'activities')

        // Identify race activities (workout_type === 1) that need photo enrichment
        const raceActivities = activities.filter(a => a.workout_type === 1)
        console.log('[Book PDF] Found', raceActivities.length, 'race activities to enrich with photos')

        // Fetch photos for race activities only (to minimize API calls)
        const enrichedRaceActivities = await enrichActivitiesWithPhotos(raceActivities, accessToken)
        console.log('[Book PDF] Enriched race activities with photos')

        // Merge enriched race activities back into the activities array
        const enrichedActivities = activities.map(activity => {
            const enrichedRace = enrichedRaceActivities.find(r => r.id === activity.id)
            return enrichedRace || activity
        })

        // Generate book entries
        const entries = generateSmartDraft(enrichedActivities)
        console.log('[Book PDF] Generated', entries.length, 'book entries')

        // Determine year from activities
        const year = activities.length > 0
            ? new Date(activities[0].start_date).getFullYear()
            : new Date().getFullYear()

        // Get athlete name from session
        const athleteName = session.user?.name || 'Athlete'

        // Get mapbox token for satellite maps
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

        // Render PDF
        console.log('[Book PDF] Rendering PDF...')
        const pdfBuffer = await renderToBuffer(
            BookDocument({
                entries,
                activities: enrichedActivities,
                format: FORMATS['10x10'],
                theme: DEFAULT_THEME,
                athleteName,
                year,
                mapboxToken,
            })
        )

        console.log('[Book PDF] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

        // Return PDF
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="strava-book-${timestamp}.pdf"`,
                'Cache-Control': 'no-cache'
            }
        })
    } catch (error) {
        console.error('[Book PDF] Error:', error)
        return new NextResponse(
            JSON.stringify({
                error: 'Failed to generate book PDF',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}
