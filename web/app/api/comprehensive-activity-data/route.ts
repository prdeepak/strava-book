import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { cachedStrava } from '@/lib/cache'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const activityId = searchParams.get('activityId')
    const skipCache = searchParams.get('skipCache') === 'true'

    if (!activityId) {
        return NextResponse.json({ error: 'activityId is required' }, { status: 400 })
    }

    const athleteId = session.user?.id || 'unknown'

    try {
        // Fetch all data needed for PDF generation with caching
        const { data, fromCache, cachedAt } = await cachedStrava.getActivityForPdf(
            session.accessToken,
            activityId,
            athleteId,
            { forceRefresh: skipCache }
        )

        const { activity, laps, comments, photos } = data

        console.log('[Comprehensive Data] Activity:', activity.name, fromCache ? '(from cache)' : '(fresh)', `(${photos.length} photos)`)

        return NextResponse.json({
            activity,
            laps,
            comments,
            photos,
            metadata: {
                fetchedAt: cachedAt || new Date().toISOString(),
                lapCount: laps.length,
                commentCount: comments.length,
                photoCount: photos.length,
                fromCache,
                cachedAt
            }
        })
    } catch (error) {
        console.error('Failed to fetch comprehensive activity data:', error)
        return NextResponse.json(
            { error: 'Failed to fetch comprehensive activity data' },
            { status: 500 }
        )
    }
}
