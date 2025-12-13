import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getAthleteActivities, StravaActivity } from "@/lib/strava"
import { authOptions } from "../api/auth/[...nextauth]/route"

export default async function BuilderPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    const accessToken = session.accessToken

    let activities: StravaActivity[] = []
    let error = ""

    try {
        activities = await getAthleteActivities(accessToken)
    } catch (e) {
        error = "Failed to load activities. Please try logging in again."
    }

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 p-8">
            <header className="max-w-6xl mx-auto mb-12 flex justify-between items-center">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-stone-800">Your Activities</h1>
                        <p className="text-stone-500">Select activities to include in your book</p>
                    </div>
                    <Link
                        href="/preview/book"
                        className="px-6 py-3 bg-orange-600 text-white font-bold rounded shadow hover:bg-orange-700 transition"
                    >
                        Generate Smart Book
                    </Link>
                </div>
                <div className="text-sm font-mono bg-stone-200 px-3 py-1 rounded">
                    Found {activities.length} activities
                </div>
            </header>

            {error && (
                <div className="max-w-6xl mx-auto p-4 bg-red-50 text-red-600 rounded mb-8 border border-red-200">
                    {error}
                </div>
            )}

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
                    <div key={activity.id} className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                {activity.type}
                            </span>
                            <span className="text-xs text-stone-400 font-mono">
                                {new Date(activity.start_date).toLocaleDateString()}
                            </span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2 truncate" title={activity.name}>{activity.name}</h3>

                        <div className="grid grid-cols-3 gap-2 mt-4 text-sm text-stone-600">
                            <div>
                                <span className="block text-xs text-stone-400">Dist</span>
                                {(activity.distance / 1000).toFixed(2)} km
                            </div>
                            <div>
                                <span className="block text-xs text-stone-400">Time</span>
                                {(activity.moving_time / 60).toFixed(0)} min
                            </div>
                            <div>
                                <span className="block text-xs text-stone-400">Elev</span>
                                {activity.total_elevation_gain} m
                            </div>
                        </div>

                        <Link
                            href={`/preview/race/${activity.id}`}
                            className="mt-4 block w-full text-center py-2 rounded border border-orange-200 text-orange-600 text-sm hover:bg-orange-50 transition-colors"
                        >
                            Preview PDF
                        </Link>
                    </div>
                ))}
            </div>
        </main>
    )
}
