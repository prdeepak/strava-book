import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { StravaActivity } from "@/lib/strava"
import { cachedStrava } from "@/lib/cache"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import BookWizard from "@/components/BookWizard"
import { getCachedActivitiesForAthlete } from "@/lib/admin"

const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'

export const metadata: Metadata = {
    title: "Create Your Book - Strava Book",
}

// Mock activities for e2e testing
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
            workout_type: 1,
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

function mergeActivities(fresh: StravaActivity[], cached: StravaActivity[]): StravaActivity[] {
    const activityMap = new Map<number, StravaActivity>()
    for (const activity of cached) {
        activityMap.set(activity.id, activity)
    }
    for (const activity of fresh) {
        activityMap.set(activity.id, activity)
    }
    return Array.from(activityMap.values()).sort((a, b) => {
        const dateA = a.start_date_local || a.start_date || ''
        const dateB = b.start_date_local || b.start_date || ''
        return dateB.localeCompare(dateA)
    })
}

export default async function CreateBookPage() {
    const session = await getServerSession(authOptions)

    if (!session && !isMockAuth) {
        redirect("/signin")
    }

    const accessToken = session?.accessToken || 'mock-access-token-for-e2e'
    const athleteId = (session as { athleteId?: string })?.athleteId || 'mock-athlete-123'
    const athleteName = session?.user?.name || 'Athlete'

    let activities: StravaActivity[] = []
    let cachedActivities: StravaActivity[] = []
    let stravaConnected = true

    // Load cached activities
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

    // Try to fetch fresh activities from Strava
    try {
        if (isMockAuth) {
            activities = getMockActivities()
        } else {
            const { data: freshActivities } = await cachedStrava.getAthleteActivities(accessToken, athleteId, { perPage: 200 })
            activities = mergeActivities(freshActivities, cachedActivities)
        }
    } catch (e) {
        console.error("Strava API error:", e)
        stravaConnected = false

        const errorMessage = e instanceof Error ? e.message : String(e)
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Failed to fetch')) {
            if (cachedActivities.length > 0) {
                activities = cachedActivities
            } else {
                redirect("/signin?callbackUrl=/builder/create")
            }
        } else {
            activities = cachedActivities
        }
    }

    return (
        <BookWizard
            activities={activities}
            athleteName={athleteName}
            stravaConnected={stravaConnected}
            activityCount={activities.length}
        />
    )
}
