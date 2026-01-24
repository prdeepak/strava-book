/**
 * API endpoint for accessing cached Strava activities
 *
 * GET /api/cached-activities - Returns cached activities
 *   Query params:
 *     - athleteId: Filter by specific athlete (required for non-admins)
 *     - includeUsers: If 'true', also return list of available athletes
 *
 * This endpoint reads directly from the file-based cache and does NOT
 * require Strava authentication. It's intended for admin use and for
 * pre-loading cached data on the builder page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  getAvailableAthletes,
  getCachedActivitiesForAthlete,
  isAdminUser,
  CachedAthleteInfo
} from '@/lib/admin'
import { StravaActivity } from '@/lib/strava'

export interface CachedActivitiesResponse {
  activities: StravaActivity[]
  athleteId: string | null
  fromCache: true
  totalCached: number
  availableAthletes?: CachedAthleteInfo[]
  isAdmin: boolean
}

export async function GET(request: NextRequest): Promise<NextResponse<CachedActivitiesResponse | { error: string }>> {
  const session = await getServerSession(authOptions)

  // Get athleteId from session or query param
  const sessionAthleteId = (session as { athleteId?: string })?.athleteId
  const isAdmin = isAdminUser(sessionAthleteId)

  const { searchParams } = new URL(request.url)
  const requestedAthleteId = searchParams.get('athleteId')
  const includeUsers = searchParams.get('includeUsers') === 'true'

  // Determine which athlete's data to load
  let targetAthleteId: string | null = null

  if (requestedAthleteId) {
    // Admin can view any athlete's data
    if (isAdmin || requestedAthleteId === sessionAthleteId) {
      targetAthleteId = requestedAthleteId
    } else {
      return NextResponse.json(
        { error: 'Not authorized to view this athlete\'s data' },
        { status: 403 }
      )
    }
  } else if (sessionAthleteId) {
    // Default to session user's data
    targetAthleteId = sessionAthleteId
  }

  // Load cached activities
  let activities: StravaActivity[] = []
  if (targetAthleteId) {
    const cachedActivities = await getCachedActivitiesForAthlete(targetAthleteId)
    // Extract the activity data from cached entries
    activities = cachedActivities
      .filter(ca => ca.activity !== null)
      .map(ca => ca.activity as StravaActivity)
  }

  // Build response
  const response: CachedActivitiesResponse = {
    activities,
    athleteId: targetAthleteId,
    fromCache: true,
    totalCached: activities.length,
    isAdmin
  }

  // Include available athletes if requested (admin only)
  if (includeUsers && isAdmin) {
    response.availableAthletes = await getAvailableAthletes()
  }

  return NextResponse.json(response)
}
