export async function getAthleteActivities(accessToken: string): Promise<StravaActivity[]> {
    const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=30", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!res.ok) {
        throw new Error("Failed to fetch activities")
    }

    return res.json()
}

export async function getActivity(accessToken: string, id: string): Promise<StravaActivity> {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!res.ok) {
        throw new Error(`Failed to fetch activity ${id}`)
    }

    return res.json()
}

export type StravaActivity = {
    id: number
    name: string
    distance: number
    moving_time: number
    elapsed_time: number
    total_elevation_gain: number
    type: string
    sport_type: string
    start_date: string
    start_date_local: string
    timezone: string
    map: {
        summary_polyline: string
    }
    splits_metric?: Array<{
        distance: number
        elapsed_time: number
        elevation_difference: number
        moving_time: number
        split: number
        average_speed: number
        pace_zone: number
    }>
    photos?: {
        primary: {
            urls?: {
                "600"?: string
            }
        }
        count: number
    }
    location_city?: string
}
