export async function getAthleteActivities(
    accessToken: string,
    options?: { after?: number; before?: number; perPage?: number; page?: number }
): Promise<StravaActivity[]> {
    const params = new URLSearchParams()
    params.set('per_page', (options?.perPage || 30).toString())
    if (options?.after) params.set('after', options.after.toString())
    if (options?.before) params.set('before', options.before.toString())
    if (options?.page) params.set('page', options.page.toString())

    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params}`, {
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

export async function getActivityComments(accessToken: string, id: string): Promise<StravaComment[]> {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}/comments`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!res.ok) {
        // Return empty array if comments fetch fails (e.g., permission issues)
        return []
    }

    return res.json()
}

export type StravaComment = {
    id: number
    activity_id: number
    text: string
    athlete: {
        id: number
        firstname: string
        lastname: string
    }
    created_at: string
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
    description?: string
    kudos_count: number
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
    workout_type?: number | null
    start_latlng?: [number, number] // [latitude, longitude]
    best_efforts?: Array<{
        name: string
        elapsed_time: number
        moving_time: number
        distance: number
        start_index: number
        end_index: number
        pr_rank?: number | null // 1 = PR, 2 = 2nd best, 3 = 3rd best, etc.
    }>
    comments?: StravaComment[] // Added for convenience when fetched
}
