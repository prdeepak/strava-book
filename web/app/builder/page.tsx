import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { StravaActivity } from "@/lib/strava"
import { cachedStrava } from "@/lib/cache"
import { authOptions } from "../api/auth/[...nextauth]/route"
import BuilderClient from "@/components/BuilderClient"
import { getCachedActivitiesForAthlete, getAvailableAthletes, isAdminUser, CachedAthleteInfo } from "@/lib/admin"

const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'

export const metadata: Metadata = {
    title: "Strava Book - Create",
}

// Mock activities for e2e testing (minimal set for UI testing)
function getMockActivities(): StravaActivity[] {
    return [
        {
            id: 1001,
            name: "Morning Run",
            type: "Run",
            sport_type: "Run",
            distance: 10000,
            moving_time: 3600,
            elapsed_time: 3700,
            total_elevation_gain: 150,
            start_date: "2025-01-01T08:00:00Z",
            start_date_local: "2025-01-01T08:00:00Z",
            timezone: "America/New_York",
            start_latlng: [40.7128, -74.006],
            map: { summary_polyline: "" },
            kudos_count: 5,
            workout_type: 0,
        },
        {
            id: 1002,
            name: "City Marathon",
            type: "Run",
            sport_type: "Run",
            distance: 42195,
            moving_time: 14400,
            elapsed_time: 14500,
            total_elevation_gain: 200,
            start_date: "2025-01-15T07:00:00Z",
            start_date_local: "2025-01-15T07:00:00Z",
            timezone: "America/New_York",
            start_latlng: [40.7128, -74.006],
            map: { summary_polyline: "" },
            kudos_count: 50,
            workout_type: 1, // Race
        },
        {
            id: 1003,
            name: "Trail Hike",
            type: "Hike",
            sport_type: "Hike",
            distance: 15000,
            moving_time: 7200,
            elapsed_time: 8000,
            total_elevation_gain: 500,
            start_date: "2025-01-20T10:00:00Z",
            start_date_local: "2025-01-20T10:00:00Z",
            timezone: "America/New_York",
            start_latlng: [41.0, -74.5],
            map: { summary_polyline: "" },
            kudos_count: 8,
            workout_type: null,
        },
    ]
}

/**
 * Merge fresh and cached activities, with fresh taking precedence
 * Activities are deduplicated by ID
 */
function mergeActivities(fresh: StravaActivity[], cached: StravaActivity[]): StravaActivity[] {
    const activityMap = new Map<number, StravaActivity>()

    // Add cached activities first
    for (const activity of cached) {
        activityMap.set(activity.id, activity)
    }

    // Override with fresh activities (fresh takes precedence)
    for (const activity of fresh) {
        activityMap.set(activity.id, activity)
    }

    // Sort by date (newest first)
    return Array.from(activityMap.values()).sort((a, b) => {
        const dateA = a.start_date_local || a.start_date || ''
        const dateB = b.start_date_local || b.start_date || ''
        return dateB.localeCompare(dateA)
    })
}

export default async function BuilderPage() {
    const session = await getServerSession(authOptions)

    // In mock auth mode, auto-login without requiring actual authentication
    if (!session && !isMockAuth) {
        redirect("/signin")
    }

    const accessToken = session?.accessToken || 'mock-access-token-for-e2e'
    const athleteId = (session as { athleteId?: string })?.athleteId || 'mock-athlete-123'
    const isAdmin = isAdminUser(athleteId)
    const athleteName = session?.user?.name || 'Athlete'

    let activities: StravaActivity[] = []
    let cachedActivities: StravaActivity[] = []
    let availableAthletes: CachedAthleteInfo[] = []
    let stravaError = false

    // Load cached activities first (fast, always works)
    if (!isMockAuth && athleteId) {
        try {
            const cached = await getCachedActivitiesForAthlete(athleteId)
            cachedActivities = cached
                .filter(ca => ca.activity !== null)
                .map(ca => ca.activity as StravaActivity)
        } catch (e) {
            console.error("Failed to load cached activities:", e)
        }
    }

    // Load available athletes for admin mode
    if (isAdmin) {
        try {
            availableAthletes = await getAvailableAthletes()
        } catch (e) {
            console.error("Failed to load available athletes:", e)
        }
    }

    // Try to fetch fresh activities from Strava
    try {
        if (isMockAuth) {
            // Use mock activities for e2e testing
            activities = getMockActivities()
        } else {
            const { data: freshActivities } = await cachedStrava.getAthleteActivities(accessToken, athleteId, { perPage: 200 })
            // Merge fresh with cached
            activities = mergeActivities(freshActivities, cachedActivities)
        }
    } catch (e) {
        console.error("Strava API error:", e)
        stravaError = true

        // Check if this looks like a token expiration error
        const errorMessage = e instanceof Error ? e.message : String(e)
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Failed to fetch')) {
            // If we have cached activities, use those and show a warning
            // Otherwise redirect to login
            if (cachedActivities.length > 0) {
                activities = cachedActivities
            } else {
                // No cached data and Strava failed - redirect to re-authenticate
                redirect("/signin?callbackUrl=/builder")
            }
        } else {
            // Other error - use cached activities if available
            activities = cachedActivities
        }
    }

    // If we have no activities at all, show an error
    if (activities.length === 0 && !isMockAuth) {
        return (
            <main className="min-h-screen bg-stone-50 text-stone-900 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="p-4 bg-red-50 text-red-600 rounded mb-8 border border-red-200">
                        No activities found. Please make sure you have activities on Strava and try logging in again.
                    </div>
                    <a
                        href="/signin"
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                        Sign in with Strava
                    </a>
                </div>
            </main>
        )
    }

    return (
        <BuilderClient
            initialActivities={activities}
            accessToken={accessToken}
            athleteName={athleteName}
            athleteId={athleteId}
            isAdmin={isAdmin}
            availableAthletes={availableAthletes}
            stravaError={stravaError}
            cachedCount={cachedActivities.length}
        />
    )
}
