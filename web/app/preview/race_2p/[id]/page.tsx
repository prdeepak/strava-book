import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { StravaActivity, getActivity } from "@/lib/strava"
import AsyncPDFPreview from "@/components/AsyncPDFPreview"

export default async function PreviewPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    const accessToken = session.accessToken

    let activity: StravaActivity | null = null

    try {
        activity = await getActivity(accessToken, params.id)
        if (activity) {
            console.log("Activity Fetched:", activity.id, activity.name)
            console.log("Photos Object:", JSON.stringify(activity.photos, null, 2))
        }
    } catch (e) {
        console.error("Error fetching activity:", e)
    }

    if (!activity) {
        return <div className="p-8 text-center">Activity not found or failed to load.</div>
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    console.log("[Server] Passing Mapbox Token:", !!mapboxToken)

    // If activity has coordinates but no location_city, try reverse geocoding
    if (!activity.location_city && activity.start_latlng && mapboxToken) {
        try {
            const [lat, lng] = activity.start_latlng
            const geocodeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/geocode?lat=${lat}&lng=${lng}`
            const geocodeRes = await fetch(geocodeUrl)
            if (geocodeRes.ok) {
                const { location } = await geocodeRes.json()
                if (location) {
                    activity.location_city = location
                }
            }
        } catch (error) {
            console.error('Failed to geocode location:', error)
        }
    }

    return <AsyncPDFPreview activity={activity} mapboxToken={mapboxToken} />
}
