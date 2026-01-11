import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getAthleteActivities } from '@/lib/strava'
import { generateSmartDraft } from '@/lib/curator'
import { BookDocument } from '@/components/templates/BookDocument'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { enrichActivitiesWithPhotos } from '@/lib/photo-utils'

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
