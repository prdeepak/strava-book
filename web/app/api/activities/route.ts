import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { getAthleteActivities } from '@/lib/strava'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const after = searchParams.get('after')
    const before = searchParams.get('before')
    const perPage = searchParams.get('per_page')
    const page = searchParams.get('page')

    try {
        const activities = await getAthleteActivities(session.accessToken, {
            after: after ? parseInt(after) : undefined,
            before: before ? parseInt(before) : undefined,
            perPage: perPage ? parseInt(perPage) : 30,
            page: page ? parseInt(page) : 1
        })

        return NextResponse.json({ activities })
    } catch (error) {
        console.error('Failed to fetch activities:', error)
        return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
    }
}
