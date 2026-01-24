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

export async function getActivityPhotos(accessToken: string, id: string): Promise<StravaPhoto[]> {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}/photos?size=5000`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!res.ok) {
        // Return empty array if photos fetch fails
        return []
    }

    return res.json()
}

export async function getActivityStreams(
    accessToken: string,
    id: string,
    keys: string[] = ['latlng', 'altitude', 'time', 'distance']
): Promise<StravaStreams> {
    const keysParam = keys.join(',')
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}/streams?keys=${keysParam}&key_by_type=true`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!res.ok) {
        // Return empty object if streams fetch fails
        return {}
    }

    return res.json()
}

export async function getActivityLaps(accessToken: string, id: string): Promise<StravaLap[]> {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}/laps`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!res.ok) {
        // Return empty array if laps fetch fails
        return []
    }

    return res.json()
}

/**
 * Lap data from GET /activities/{id}/laps
 */
export type StravaLap = {
    id: number
    name: string
    activity: { id: number }
    athlete: { id: number }
    elapsed_time: number
    moving_time: number
    start_date: string
    start_date_local: string
    distance: number
    start_index: number
    end_index: number
    total_elevation_gain: number
    average_speed: number
    max_speed: number
    average_cadence?: number
    average_watts?: number
    average_heartrate?: number
    max_heartrate?: number
    lap_index: number
    split?: number
    pace_zone?: number
}

export type StravaPhoto = {
    unique_id: string
    urls: {
        [key: string]: string // e.g., "5000": "https://..."
    }
    source: number
    uploaded_at: string
    created_at: string
    caption?: string
    activity_id: number
}

export type StravaStreams = {
    latlng?: {
        data: [number, number][] // Array of [lat, lng] pairs
        series_type: string
        original_size: number
        resolution: string
    }
    altitude?: {
        data: number[]
        series_type: string
        original_size: number
        resolution: string
    }
    time?: {
        data: number[]
        series_type: string
        original_size: number
        resolution: string
    }
    distance?: {
        data: number[]
        series_type: string
        original_size: number
        resolution: string
    }
}

export type StravaComment = {
    id: number
    activity_id: number
    text: string
    athlete: {
        id?: number
        firstname: string
        lastname: string
    }
    created_at: string
    reaction_count?: number
    has_reacted?: boolean
}

export type StravaActivity = {
    id: number
    athlete?: {
        id: number
        resource_state?: number
    }
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
    comment_count?: number
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
    laps?: Array<{
        id: number
        name: string
        distance: number
        elapsed_time: number
        moving_time: number
        start_index: number
        end_index: number
        total_elevation_gain: number
        average_speed: number
        lap_index: number
    }>
    photos?: {
        primary: {
            urls?: {
                "600"?: string
            }
        }
        count: number
    }
    total_photo_count?: number // Total photos including Instagram
    location_city?: string
    location_state?: string
    location_country?: string
    workout_type?: number | null
    suffer_score?: number // Strava's relative effort score
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
    allPhotos?: StravaPhoto[] // All photos from getActivityPhotos API
    comprehensiveData?: {
        photos?: StravaPhoto[]
        comments?: StravaComment[]
        streams?: StravaStreams
    }
}
