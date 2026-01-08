import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { generateStyleGuide, StyleGuideRequest } from '@/lib/style-guide-generator'
import { StravaActivity } from '@/lib/strava'

interface StyleGuideRequestBody {
    activities: StravaActivity[]
    preference?: 'minimal' | 'bold' | 'classic'
}

export async function POST(request: NextRequest) {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body: StyleGuideRequestBody = await request.json()
        const { activities, preference } = body

        if (!activities || activities.length === 0) {
            return NextResponse.json(
                { error: 'No activities provided' },
                { status: 400 }
            )
        }

        console.log('[Style Guide] Generating style guide for', activities.length, 'activities')

        // Find races (workout_type === 1)
        const races = activities.filter(a => a.workout_type === 1)

        // Find A-Race (longest race)
        const aRace = races.length > 0
            ? races.sort((a, b) => (b.distance || 0) - (a.distance || 0))[0]
            : undefined

        // Collect activity types
        const activityTypes = activities.map(a => a.type)

        // Build style guide request
        const styleGuideRequest: StyleGuideRequest = {
            aRace,
            topPhotos: [], // Photos not available from activity list
            activityTypes,
            userPreference: preference,
            yearRange: {
                start: Math.min(...activities.map(a => new Date(a.start_date).getFullYear())),
                end: Math.max(...activities.map(a => new Date(a.start_date).getFullYear())),
            },
        }

        // Determine if we should use real AI or mock
        const useMock = process.env.USE_REAL_AI !== 'true'

        console.log('[Style Guide] Using', useMock ? 'mock' : 'AI', 'generation')

        const result = await generateStyleGuide(styleGuideRequest, {
            useMock,
            verbose: true,
        })

        console.log('[Style Guide] Generated theme:', result.theme.primaryColor, result.theme.accentColor)

        return NextResponse.json(result)
    } catch (error) {
        console.error('[Style Guide] Error:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate style guide',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
