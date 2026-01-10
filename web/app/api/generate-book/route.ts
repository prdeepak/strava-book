import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { FullBookDocument } from '@/components/templates/BookDocument'
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { normalizeFontName } from '@/lib/ai-validation'
// Register fonts for PDF generation
import '@/lib/pdf-fonts'

/**
 * Normalize fonts in a BookTheme to ensure they are registered
 * Replaces unknown fonts with safe defaults to prevent "Unknown font format" errors
 */
function normalizeThemeFonts(theme: BookTheme): BookTheme {
    const headingFont = normalizeFontName(theme.fontPairing.heading, false)
    const bodyFont = normalizeFontName(theme.fontPairing.body, true)

    if (headingFont !== theme.fontPairing.heading || bodyFont !== theme.fontPairing.body) {
        console.log('[Book Generation] Font normalization applied:')
        if (headingFont !== theme.fontPairing.heading) {
            console.log(`  Heading: "${theme.fontPairing.heading}" -> "${headingFont}"`)
        }
        if (bodyFont !== theme.fontPairing.body) {
            console.log(`  Body: "${theme.fontPairing.body}" -> "${bodyFont}"`)
        }
    }

    return {
        ...theme,
        fontPairing: {
            heading: headingFont,
            body: bodyFont,
        },
    }
}

interface BookGenerationRequest {
    activities: StravaActivity[]
    config: {
        title?: string
        athleteName: string
        year: number
        forewordText?: string
        format: BookFormat
        theme: BookTheme
    }
}

export async function POST(request: NextRequest) {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body: BookGenerationRequest = await request.json()
        const { activities, config } = body

        if (!activities || activities.length === 0) {
            return NextResponse.json(
                { error: 'No activities provided' },
                { status: 400 }
            )
        }

        console.log('[Book Generation] Starting book generation')
        console.log('[Book Generation] Activities:', activities.length)
        console.log('[Book Generation] Year:', config.year)
        console.log('[Book Generation] Format:', config.format?.size || '10x10')

        // Use athlete name from session if not provided
        const athleteName = config.athleteName || session.user?.name || 'Athlete'

        // Ensure format is valid
        const format = config.format || FORMATS['10x10']
        const rawTheme = config.theme || DEFAULT_THEME

        // Normalize fonts to prevent "Unknown font format" errors
        // This replaces any unregistered fonts with safe defaults
        const theme = normalizeThemeFonts(rawTheme)
        console.log('[Book Generation] Theme fonts:', theme.fontPairing.heading, '/', theme.fontPairing.body)

        // Render PDF using FullBookDocument
        console.log('[Book Generation] Rendering PDF...')
        const startTime = Date.now()

        // Fetch detailed data for race activities (workout_type === 1)
        // Race pages need photos, splits, best efforts, and comments which are not in the summary
        const enrichedActivities = await Promise.all(activities.map(async (activity) => {
            // Only fetch details for Races (workout_type === 1)
            // AND ensure we have an access token to make the call
            if (activity.workout_type === 1 && session.accessToken) {
                try {
                    console.log(`[Book Generation] Fetching details for race: ${activity.name} (${activity.id})`)
                    // Fetch details in parallel
                    // import { getActivity, getActivityPhotos, getActivityComments } from '@/lib/strava'
                    const [details, photos, comments] = await Promise.all([
                        import('@/lib/strava').then(m => m.getActivity(session.accessToken as string, activity.id.toString())),
                        import('@/lib/strava').then(m => m.getActivityPhotos(session.accessToken as string, activity.id.toString())),
                        import('@/lib/strava').then(m => m.getActivityComments(session.accessToken as string, activity.id.toString()))
                    ])

                    // Merge details into activity
                    // We prioritize the detailed fields
                    return {
                        ...activity,
                        ...details,
                        photos: {
                            primary: details.photos?.primary ||
                                activity.photos?.primary ||
                                (photos.length > 0 ? { urls: photos[0].urls } : { urls: {} }),
                            count: photos.length,
                        },
                        allPhotos: photos, // Store all photos for access if needed
                        comments: comments,
                        // Ensure map is preserved/updated
                        map: details.map || activity.map,
                    }
                } catch (err) {
                    console.error(`[Book Generation] Failed to enrich race ${activity.id}:`, err)
                    return activity // Fallback to summary if fetch fails
                }
            }
            return activity
        }))

        const pdfBuffer = await renderToBuffer(
            FullBookDocument({
                activities: enrichedActivities,
                title: config.title,
                athleteName,
                year: config.year,
                forewordText: config.forewordText,
                format,
                theme,
                mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
            })
        )

        const renderTime = Date.now() - startTime
        console.log('[Book Generation] PDF rendered in', renderTime, 'ms')
        console.log('[Book Generation] PDF size:', pdfBuffer.length, 'bytes')

        // Return PDF
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
        const filename = config.title
            ? `${config.title.replace(/\s+/g, '-').toLowerCase()}.pdf`
            : `strava-book-${config.year}-${timestamp}.pdf`

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache',
            },
        })
    } catch (error) {
        console.error('[Book Generation] Error:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate book',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
