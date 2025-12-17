import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { getActivity, getActivityComments, getActivityPhotos, getActivityStreams } from '@/lib/strava'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const activityId = searchParams.get('activityId')

    if (!activityId) {
        return NextResponse.json({ error: 'activityId is required' }, { status: 400 })
    }

    try {
        // Fetch all comprehensive data in parallel for efficiency
        const [activity, photos, comments, streams] = await Promise.all([
            getActivity(session.accessToken, activityId),
            getActivityPhotos(session.accessToken, activityId),
            getActivityComments(session.accessToken, activityId),
            getActivityStreams(session.accessToken, activityId),
        ])

        return NextResponse.json({
            activity,
            photos,
            comments,
            streams,
            metadata: {
                fetchedAt: new Date().toISOString(),
                photoCount: photos.length,
                commentCount: comments.length,
                hasStreams: Object.keys(streams).length > 0,
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
