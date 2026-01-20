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
        // Fetch all comprehensive data with caching
        const { data, fromCache, cachedAt } = await cachedStrava.getComprehensiveActivity(
            session.accessToken,
            activityId,
            athleteId,
            { forceRefresh: skipCache }
        )

        const { activity, photos, comments, streams } = data

        // Debug: Log photo data structure
        console.log('[Comprehensive Data] Photo count:', photos.length, fromCache ? '(from cache)' : '(fresh)')

        return NextResponse.json({
            activity,
            photos,
            comments,
            streams,
            metadata: {
                fetchedAt: cachedAt || new Date().toISOString(),
                photoCount: photos.length,
                commentCount: comments.length,
                hasStreams: Object.keys(streams).length > 0,
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
