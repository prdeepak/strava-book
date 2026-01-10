import { StravaActivity } from './strava'

/**
 * Generates an emotionally-resonant name for a training period based on
 * the date range and activities within it.
 */
export function generatePeriodName(
    startDate: Date,
    endDate: Date,
    activities: StravaActivity[]
): string {
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const durationMonths = Math.round(durationDays / 30)

    // Find races in the period
    const races = activities.filter(a => a.workout_type === 1)
    const sortedRaces = [...races].sort((a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )

    // Get the most significant race (longest distance or most recent)
    const significantRace = sortedRaces.length > 0
        ? sortedRaces.reduce((best, race) =>
            (race.distance || 0) > (best.distance || 0) ? race : best
        )
        : null

    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()
    const startMonth = startDate.getMonth()
    const endMonth = endDate.getMonth()

    // If there's a significant race, build the name around it
    if (significantRace) {
        const raceName = cleanRaceName(significantRace.name)
        const raceYear = new Date(significantRace.start_date).getFullYear()

        // Check if the period is leading up to the race (buildup)
        const raceDate = new Date(significantRace.start_date)
        const daysBeforeRace = Math.ceil((raceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysBeforeRace > 60 && daysBeforeRace < durationDays * 0.9) {
            // This looks like a race buildup period
            return `Road to ${raceName}`
        }

        // If it's a single major race in a short period
        if (durationDays < 60 && races.length <= 2) {
            return `${raceName} ${raceYear}`
        }

        // Multiple races - focus on the achievement
        if (races.length >= 3) {
            return `${raceYear} Race Season`
        }
    }

    // Calendar year check
    if (startMonth === 0 && endMonth === 11 && startYear === endYear) {
        return `My ${startYear} Journey`
    }

    // Check for seasonal patterns
    const season = getSeason(startMonth, endMonth, durationMonths)
    if (season && durationMonths >= 2 && durationMonths <= 6) {
        return `${season} ${endYear}`
    }

    // Duration-based names
    if (durationDays <= 30) {
        return getShortPeriodName(startDate, endDate)
    }

    if (durationMonths <= 4) {
        return `${durationMonths}-Month Training Block`
    }

    // Multi-year spans
    if (startYear !== endYear) {
        return `${startYear}-${endYear} Running Journey`
    }

    // Default: year-based
    return `My Running Year ${endYear}`
}

function cleanRaceName(name: string): string {
    // Remove common suffixes and clean up
    return name
        .replace(/\s*\d{4}\s*$/i, '') // Remove trailing year
        .replace(/\s*(race|run|marathon)?\s*$/i, '') // Remove generic suffixes
        .replace(/^\d+[kK]\s*/, '') // Remove leading distance like "5K "
        .trim()
}

function getSeason(startMonth: number, endMonth: number, durationMonths: number): string | null {
    // Northern hemisphere seasons
    if (durationMonths < 2 || durationMonths > 6) return null

    const midMonth = Math.floor((startMonth + endMonth) / 2)

    if (midMonth >= 2 && midMonth <= 4) return 'Spring Training'
    if (midMonth >= 5 && midMonth <= 7) return 'Summer of Miles'
    if (midMonth >= 8 && midMonth <= 10) return 'Fall Racing Season'
    if (midMonth >= 11 || midMonth <= 1) return 'Winter Base Building'

    return null
}

function getShortPeriodName(startDate: Date, endDate: Date): string {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']

    const startMonth = monthNames[startDate.getMonth()]
    const endMonth = monthNames[endDate.getMonth()]
    const year = endDate.getFullYear()

    if (startDate.getMonth() === endDate.getMonth()) {
        return `${startMonth} ${year}`
    }

    return `${startMonth}-${endMonth} ${year}`
}

/**
 * Get default date range based on activities
 */
export function getDefaultDateRange(activities: StravaActivity[]): { startDate: Date; endDate: Date } {
    if (activities.length === 0) {
        // Default to current year
        const now = new Date()
        return {
            startDate: new Date(now.getFullYear(), 0, 1),
            endDate: new Date(now.getFullYear(), 11, 31)
        }
    }

    const dates = activities.map(a => new Date(a.start_date_local || a.start_date))
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime())

    return {
        startDate: sorted[0],
        endDate: sorted[sorted.length - 1]
    }
}

/**
 * Format a date range for display
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`
}
