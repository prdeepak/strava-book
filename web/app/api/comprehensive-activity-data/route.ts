import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { getActivity, getActivityComments, getActivityPhotos, getActivityStreams, StravaPhoto } from '@/lib/strava'
import { getActivityPhotosWithCache } from '@/lib/cache/cached-strava'

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

    try {
        // Fetch photos with cache support
        const photosPromise = skipCache
            ? getActivityPhotos(session.accessToken, activityId).then(photos => ({ photos, fromCache: false }))
            : getActivityPhotosWithCache(
                session.accessToken,
                activityId,
                session.user?.id || 'unknown'
              )

        // Fetch all comprehensive data in parallel for efficiency
        const [activity, photosResult, comments, streams] = await Promise.all([
            getActivity(session.accessToken, activityId),
            photosPromise,
            getActivityComments(session.accessToken, activityId),
            getActivityStreams(session.accessToken, activityId),
        ])

        const photos: StravaPhoto[] = photosResult.photos
        const photosFromCache = photosResult.fromCache

        // Debug: Log photo data structure
        console.log('[Comprehensive Data] Photo count:', photos.length)
        if (photos.length > 0) {
            console.log('[Comprehensive Data] First photo sample:', JSON.stringify(photos[0], null, 2))
        }

        return NextResponse.json({
            activity,
            photos,
            comments,
            streams,
            metadata: {
                fetchedAt: new Date().toISOString(),
                photoCount: photos.length,
                photosFromCache: photosFromCache,
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
