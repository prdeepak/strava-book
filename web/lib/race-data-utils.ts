import { StravaActivity } from './strava'

// Helper to format time as HH:MM:SS or MM:SS
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Helper to format pace as MM:SS/km
export function formatPace(distanceMeters: number, timeSeconds: number): string {
    if (distanceMeters === 0) return '--:--'
    const paceSecondsPerKm = timeSeconds / (distanceMeters / 1000)
    const minutes = Math.floor(paceSecondsPerKm / 60)
    const seconds = Math.floor(paceSecondsPerKm % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

export interface SplitData {
    label: string
    time: string
    pace: string
    distance: number
    moving_time: number
    elevation_difference?: number
    split_index: number
}

export function processSplits(activity: StravaActivity, limit: number = 6): SplitData[] {
    const rawLaps = activity.laps || []
    const rawSplits = activity.splits_metric || []

    if (rawLaps.length > 0) {
        // Use laps if available (race laps)
        return rawLaps.slice(0, limit).map((lap, idx) => ({
            label: lap.name || `Lap ${idx + 1}`,
            time: formatDuration(lap.moving_time),
            pace: formatPace(lap.distance, lap.moving_time),
            distance: lap.distance,
            moving_time: lap.moving_time,
            elevation_difference: lap.total_elevation_gain,
            split_index: lap.lap_index || idx + 1
        }))
    } else if (rawSplits.length > 0) {
        // Fall back to splits
        return rawSplits.slice(0, limit).map((s, idx) => ({
            label: `${idx + 1} km`,
            time: formatDuration(s.moving_time),
            pace: formatPace(s.distance, s.moving_time),
            distance: s.distance,
            moving_time: s.moving_time,
            split_index: s.split || idx + 1,
            elevation_difference: s.elevation_difference
        }))
    }
    return []
}

export interface BestEffortData {
    name: string
    time: string
    pace: string
    pr_rank?: number | null
}

export function processBestEfforts(activity: StravaActivity, limit: number = 6): BestEffortData[] {
    return (activity.best_efforts || [])
        .filter(e => e.pr_rank && e.pr_rank <= 10) // Filter for PRs first if using Race_1p logic, but Scrapbook uses all. Let's make it optional? 
        // Actually Race_1p filters strictly, Scrapbook takes first 6. 
        // Let's stick to a generic sort/slice and let caller filter if needed? 
        // Or provide a "filterForPRs" flag.
        // For now, let's just return the processed data and let the component filter if it wants specific PR ranks,
        // BUT sorting by rank is useful.
        .sort((a, b) => (a.pr_rank || 999) - (b.pr_rank || 999))
        .slice(0, limit)
        .map(effort => ({
            name: effort.name,
            time: formatDuration(effort.elapsed_time),
            pace: formatPace(effort.distance, effort.elapsed_time),
            pr_rank: effort.pr_rank
        }))
}

// Allow getting just the top raw efforts for cases where we don't want to filter by PR rank strictly
export function getFormattedBestEfforts(activity: StravaActivity, limit: number = 6): BestEffortData[] {
     return (activity.best_efforts || [])
        .slice(0, limit)
        .map(effort => ({
            name: effort.name,
            time: formatDuration(effort.elapsed_time),
            pace: formatPace(effort.distance, effort.elapsed_time),
            pr_rank: effort.pr_rank
        }))
}

export function getMapboxSatelliteUrl(polyline: string, mapboxToken: string, width: number = 800, height: number = 400): string {
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/path-4+ff4500-0.8(${encodeURIComponent(polyline)})/auto/${width}x${height}@2x?access_token=${mapboxToken}&logo=false`
}
