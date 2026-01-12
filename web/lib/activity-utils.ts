import { StravaActivity } from './strava'
import { BookFormat } from './book-types'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SplitData {
    label: string
    time: string
    pace: string
    distance: number
    moving_time: number
    elevation_difference?: number
    split_index: number
}

export interface BestEffortData {
    name: string
    time: string
    pace: string
    pr_rank?: number | null
}

// ============================================================================
// TIME / DURATION FORMATTING
// ============================================================================

/**
 * Format time as HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Alias for backward compatibility
export const formatDuration = formatTime

// ============================================================================
// PACE FORMATTING
// ============================================================================

/**
 * Format pace as min:sec/unit (e.g., "5:23/km" or "8:42/mi")
 */
export function formatPace(
    movingTime: number,  // in seconds
    distance: number,    // in meters
    units: 'metric' | 'imperial' = 'metric'
): string {
    if (!distance || distance === 0) return '--'

    // Convert distance to km or miles
    const distanceInUnits = units === 'metric'
        ? distance / 1000
        : distance / 1609.34

    // Calculate pace in seconds per unit
    const paceSeconds = movingTime / distanceInUnits

    // Convert to min:sec format
    const paceMin = Math.floor(paceSeconds / 60)
    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

    const unitLabel = units === 'metric' ? 'km' : 'mi'
    return `${paceMin}:${paceSec}/${unitLabel}`
}

// ============================================================================
// DISTANCE FORMATTING
// ============================================================================

/**
 * Format distance in km or miles
 */
export function formatDistance(
    distance: number,  // in meters
    units: 'metric' | 'imperial'
): string {
    if (units === 'metric') {
        return `${(distance / 1000).toFixed(2)} km`
    } else {
        return `${(distance / 1609.34).toFixed(2)} mi`
    }
}

// ============================================================================
// DATE / MONTH UTILITIES
// ============================================================================

/**
 * Get month name from month index (0-11)
 */
export function getMonthName(month: number): string {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month] || 'Unknown'
}

/**
 * Format a date range for display with smart formatting rules:
 * - Same year, Jan 1 to Dec 31 → "2025"
 * - < 90 days apart → "March 1-15, 2025" or "April 15 to June 30, 2025"
 * - Same year, partial → "March to October 2025"
 * - Different years → "July 2024 to June 2025"
 */
export function formatPeriodRange(startDate: Date, endDate: Date): string {
    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()
    const startMonth = startDate.getMonth()
    const endMonth = endDate.getMonth()
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()

    // Calculate days apart
    const msPerDay = 24 * 60 * 60 * 1000
    const daysApart = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay)

    // Check if full year (Jan 1 to Dec 31, same year)
    const isFullYear = startYear === endYear &&
        startMonth === 0 && startDay === 1 &&
        endMonth === 11 && endDay === 31

    if (isFullYear) {
        return String(startYear)
    }

    // If < 90 days apart, show full dates
    if (daysApart < 90) {
        if (startMonth === endMonth && startYear === endYear) {
            // Same month: "March 1-15, 2025"
            return `${getMonthName(startMonth)} ${startDay}-${endDay}, ${startYear}`
        } else if (startYear === endYear) {
            // Different months, same year: "April 15 to June 30, 2025"
            return `${getMonthName(startMonth)} ${startDay} to ${getMonthName(endMonth)} ${endDay}, ${endYear}`
        } else {
            // Different years: "December 15, 2024 to February 28, 2025"
            return `${getMonthName(startMonth)} ${startDay}, ${startYear} to ${getMonthName(endMonth)} ${endDay}, ${endYear}`
        }
    }

    // Same year, partial: "March to October 2025"
    if (startYear === endYear) {
        return `${getMonthName(startMonth)} to ${getMonthName(endMonth)} ${endYear}`
    }

    // Different years: "July 2024 to June 2025"
    return `${getMonthName(startMonth)} ${startYear} to ${getMonthName(endMonth)} ${endYear}`
}

// ============================================================================
// ACTIVITY LOG UTILITIES
// ============================================================================

/**
 * Calculate how many activities can fit on one page based on format size
 */
export function calculateActivitiesPerPage(format: BookFormat): number {
    // Base calculation: 10x10 format has ~20 activities per page
    const baseActivitiesPerPage = 20

    // Scale based on format
    const scaledCount = Math.floor(baseActivitiesPerPage * format.scaleFactor)

    // Ensure reasonable bounds
    return Math.max(10, Math.min(30, scaledCount))
}

// ============================================================================
// LOCATION UTILITIES
// ============================================================================

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

// ============================================================================
// RACE DATA UTILITIES
// ============================================================================

/**
 * Process activity laps or splits into formatted split data
 */
export function processSplits(activity: StravaActivity, limit: number = 6): SplitData[] {
    const rawLaps = activity.laps || []
    const rawSplits = activity.splits_metric || []

    if (rawLaps.length > 0) {
        // Use laps if available (race laps)
        return rawLaps.slice(0, limit).map((lap, idx) => ({
            label: lap.name || `Lap ${idx + 1}`,
            time: formatTime(lap.moving_time),
            pace: formatPace(lap.moving_time, lap.distance, 'metric'),
            distance: lap.distance,
            moving_time: lap.moving_time,
            elevation_difference: lap.total_elevation_gain,
            split_index: lap.lap_index || idx + 1
        }))
    } else if (rawSplits.length > 0) {
        // Fall back to splits
        return rawSplits.slice(0, limit).map((s, idx) => ({
            label: `${idx + 1} km`,
            time: formatTime(s.moving_time),
            pace: formatPace(s.moving_time, s.distance, 'metric'),
            distance: s.distance,
            moving_time: s.moving_time,
            split_index: s.split || idx + 1,
            elevation_difference: s.elevation_difference
        }))
    }
    return []
}

/**
 * Process best effort segments, filtered by PR rank
 */
export function processBestEfforts(activity: StravaActivity, limit: number = 6): BestEffortData[] {
    return (activity.best_efforts || [])
        .filter(e => e.pr_rank && e.pr_rank <= 10)
        .sort((a, b) => (a.pr_rank || 999) - (b.pr_rank || 999))
        .slice(0, limit)
        .map(effort => ({
            name: effort.name,
            time: formatTime(effort.elapsed_time),
            pace: formatPace(effort.elapsed_time, effort.distance, 'metric'),
            pr_rank: effort.pr_rank
        }))
}

/**
 * Get top best efforts without strict PR rank filtering
 */
export function getFormattedBestEfforts(activity: StravaActivity, limit: number = 6): BestEffortData[] {
    return (activity.best_efforts || [])
        .slice(0, limit)
        .map(effort => ({
            name: effort.name,
            time: formatTime(effort.elapsed_time),
            pace: formatPace(effort.elapsed_time, effort.distance, 'metric'),
            pr_rank: effort.pr_rank
        }))
}

/**
 * Generate a Mapbox static satellite map URL for an activity route
 */
export function getMapboxSatelliteUrl(
    polyline: string,
    mapboxToken: string,
    width: number = 800,
    height: number = 400
): string {
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/path-4+ff4500-0.8(${encodeURIComponent(polyline)})/auto/${width}x${height}@2x?access_token=${mapboxToken}&logo=false`
}
