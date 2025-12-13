export async function getAthleteActivities(accessToken: string) {
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

export type StravaActivity = {
    id: number
    name: string
    distance: number
    moving_time: number
    elapsed_time: number
    total_elevation_gain: number
    type: string
    start_date: string
    map: {
        summary_polyline: string
    }
}
