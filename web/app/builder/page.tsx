import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getAthleteActivities, StravaActivity } from "@/lib/strava"
import { authOptions } from "../api/auth/[...nextauth]/route"
import BuilderClient from "@/components/BuilderClient"

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

export default async function BuilderPage() {
    const session = await getServerSession(authOptions)

    // In mock auth mode, auto-login without requiring actual authentication
    if (!session && !isMockAuth) {
        redirect("/api/auth/signin")
    }

    const accessToken = session?.accessToken || 'mock-access-token-for-e2e'

    let activities: StravaActivity[] = []
    let error = ""

    try {
        if (isMockAuth) {
            // Use mock activities for e2e testing
            activities = getMockActivities()
        } else {
            activities = await getAthleteActivities(accessToken, { perPage: 200 })
        }
    } catch (e) {
        console.error("Builder fetch error:", e)
        error = "Failed to load activities. Please try logging in again."
    }

    if (error) {
        return (
            <main className="min-h-screen bg-stone-50 text-stone-900 p-8">
                <div className="max-w-6xl mx-auto p-4 bg-red-50 text-red-600 rounded mb-8 border border-red-200">
                    {error}
                </div>
            </main>
        )
    }

    const athleteName = session?.user?.name || 'Athlete'

    return <BuilderClient initialActivities={activities} accessToken={accessToken} athleteName={athleteName} />
}
