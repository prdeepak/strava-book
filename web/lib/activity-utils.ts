import { StravaActivity, getActivity, getActivityComments } from './strava'

/**
 * Resolves the location string for an activity.
 * Priority: 1) location_city, 2) timezone parsing, 3) "Unknown Location"
 */
export function resolveActivityLocation(activity: StravaActivity): string {
    let location = activity.location_city

    if (!location && activity.timezone) {
        // Parse timezone like "(GMT-05:00) America/New_York"
        const parts = activity.timezone.split('/')
        if (parts.length > 1) {
            location = parts[parts.length - 1].replace(/_/g, ' ')
        }
    }

    return location || 'Unknown Location'
}

/**
 * Enriches an activity with geocoded location if coordinates are available.
 * Mutates the activity object by setting location_city if geocoding succeeds.
 */
export async function enrichActivityWithGeocoding(
    activity: StravaActivity,
    mapboxToken?: string
): Promise<StravaActivity> {
    // Only geocode if we don't have a location but have coordinates
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

    return activity
}

/**
 * Fetches an activity with all required data for preview rendering.
 * Includes comments for race_1p template.
 */
export async function fetchActivityForPreview(
    accessToken: string,
    activityId: string,
    template: 'race_1p' | 'race_2p'
): Promise<StravaActivity | null> {
    try {
        const activity = await getActivity(accessToken, activityId)

        if (!activity) {
            return null
        }

        console.log('Activity Fetched:', activity.id, activity.name)
        console.log('Photos Object:', JSON.stringify(activity.photos, null, 2))

        // Fetch comments only for race_1p template
        if (template === 'race_1p') {
            const comments = await getActivityComments(accessToken, activityId)
            activity.comments = comments
            console.log('Comments Fetched:', comments.length)
        }

        return activity
    } catch (error) {
        console.error('Error fetching activity:', error)
        return null
    }
}
