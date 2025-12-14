import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { getAthleteActivities, StravaActivity } from "@/lib/strava"
import { authOptions } from "../api/auth/[...nextauth]/route"
import BuilderClient from "@/components/BuilderClient"

export default async function BuilderPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    const accessToken = session.accessToken

    let activities: StravaActivity[] = []
    let error = ""

    try {
        activities = await getAthleteActivities(accessToken, { perPage: 200 })
    } catch (e) {
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

    return <BuilderClient initialActivities={activities} accessToken={accessToken} />
}
