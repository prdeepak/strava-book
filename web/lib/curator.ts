import { StravaActivity } from "./strava"

export type BookPageType =
    | 'COVER'
    | 'TABLE_OF_CONTENTS'
    | 'FOREWORD'
    | 'YEAR_AT_A_GLANCE'
    | 'YEAR_STATS'
    | 'MONTHLY_DIVIDER'
    | 'RACE_PAGE'
    | 'ACTIVITY_LOG'
    | 'BEST_EFFORTS'
    | 'ROUTE_HEATMAP'
    | 'STATS_SUMMARY'
    | 'BACK_COVER'
    | 'BLANK_PAGE'

export interface BookEntry {
    type: BookPageType
    title?: string
    activityId?: number
    highlightLabel?: string
    category?: string      // For TABLE_OF_CONTENTS grouping
    // Data for specific page types
    month?: number          // For MONTHLY_DIVIDER (0-11)
    year?: number           // For MONTHLY_DIVIDER, YEAR_STATS, YEAR_AT_A_GLANCE
    activityIds?: number[]  // For ACTIVITY_LOG (multiple activities per page)
    forewordText?: string   // For FOREWORD
    pageNumber?: number     // For TABLE_OF_CONTENTS, ACTIVITY_LOG (pagination)
}

/**
 * Detect races (workout_type === 1) from activities
 * @param activities - Array of Strava activities
 * @returns Array of activities that are marked as races
 */
export function detectRaces(activities: StravaActivity[]): StravaActivity[] {
    return activities.filter(activity => activity.workout_type === 1)
}

/**
 * Find the primary "A-Race" from a list of activities
 * Selection logic:
 * 1. Longest race distance
 * 2. If tied, most recent
 * 3. If no races, return undefined
 * @param activities - Array of Strava activities
 * @returns The A-Race activity or undefined
 */
export function findARace(activities: StravaActivity[]): StravaActivity | undefined {
    const races = detectRaces(activities)

    if (races.length === 0) return undefined

    // Sort by distance (descending), then by date (descending)
    return races.sort((a, b) => {
        const distDiff = b.distance - a.distance
        if (distDiff !== 0) return distDiff
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    })[0]
}

/**
 * Check if an activity has PRs (best efforts)
 * @param activity - Strava activity
 * @returns true if activity has best_efforts array with elements
 */
function hasPersonalRecords(activity: StravaActivity): boolean {
    return !!(activity.best_efforts && Array.isArray(activity.best_efforts) && activity.best_efforts.length > 0)
}

/**
 * Generate a complete, multi-section book structure from activities
 * Structure:
 * 1. COVER
 * 2. TABLE_OF_CONTENTS
 * 3. YEAR_AT_A_GLANCE
 * 4. For each month: MONTHLY_DIVIDER + race activities for that month
 * 5. ACTIVITY_LOG pages (remaining non-race activities)
 * 6. BEST_EFFORTS (if any activity has PRs)
 * 7. BACK_COVER
 * @param activities - Array of Strava activities
 * @returns Array of BookEntry objects representing the full book
 */
export function generateSmartDraft(activities: StravaActivity[]): BookEntry[] {
    const draft: BookEntry[] = []
    const entryTitles: Array<{ title: string; type: BookPageType; category: string }> = []

    // 1. Cover Page
    draft.push({ type: 'COVER', title: 'My Year in Review' })
    entryTitles.push({ title: 'Cover', type: 'COVER', category: 'Front Matter' })

    if (activities.length === 0) {
        draft.push({ type: 'BACK_COVER' })
        return draft
    }

    // Determine year from activities
    const year = activities.length > 0
        ? new Date(activities[0].start_date).getFullYear()
        : new Date().getFullYear()

    // 2. Year at a Glance
    draft.push({
        type: 'YEAR_AT_A_GLANCE',
        year,
        title: `${year} at a Glance`
    })
    entryTitles.push({ title: `${year} at a Glance`, type: 'YEAR_AT_A_GLANCE', category: 'Overview' })

    // 3. Year Stats Summary
    draft.push({
        type: 'YEAR_STATS',
        year,
        title: 'Year Summary'
    })
    entryTitles.push({ title: 'Year Summary', type: 'YEAR_STATS', category: 'Overview' })

    // Group activities by month
    const activitiesByMonth: Map<number, StravaActivity[]> = new Map()
    for (let month = 0; month < 12; month++) {
        activitiesByMonth.set(month, [])
    }

    activities.forEach(activity => {
        const date = new Date(activity.start_date)
        const month = date.getMonth()
        const monthActivities = activitiesByMonth.get(month) || []
        monthActivities.push(activity)
        activitiesByMonth.set(month, monthActivities)
    })

    // 4. For each month: add MONTHLY_DIVIDER + race activities
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December']
    const racesAdded = new Set<number>()
    const nonRacesForLog: StravaActivity[] = []

    for (let month = 0; month < 12; month++) {
        const monthActivities = activitiesByMonth.get(month) || []

        // Only add month section if there are activities
        if (monthActivities.length > 0) {
            // Add month divider
            draft.push({
                type: 'MONTHLY_DIVIDER',
                month,
                year,
                title: monthNames[month],
                highlightLabel: `${monthActivities.length} activities`
            })
            entryTitles.push({
                title: monthNames[month],
                type: 'MONTHLY_DIVIDER',
                category: 'Training Log'
            })

            // Add race activities for this month (up to 3 per month)
            const races = monthActivities
                .filter(a => a.workout_type === 1)
                .slice(0, 3)

            races.forEach(race => {
                draft.push({
                    type: 'RACE_PAGE',
                    activityId: race.id,
                    title: race.name,
                    highlightLabel: race.name
                })
                entryTitles.push({
                    title: race.name,
                    type: 'RACE_PAGE',
                    category: 'Races'
                })
                racesAdded.add(race.id)
            })

            // Collect non-races for activity log
            monthActivities
                .filter(a => a.workout_type !== 1)
                .forEach(activity => {
                    nonRacesForLog.push(activity)
                })
        }
    }

    // 5. Activity Log - paginate non-race activities
    if (nonRacesForLog.length > 0) {
        const activitiesPerPage = 10
        for (let i = 0; i < nonRacesForLog.length; i += activitiesPerPage) {
            const pageActivities = nonRacesForLog.slice(i, i + activitiesPerPage)
            const pageNum = Math.floor(i / activitiesPerPage) + 1

            draft.push({
                type: 'ACTIVITY_LOG',
                activityIds: pageActivities.map(a => a.id),
                pageNumber: pageNum,
                title: `Activity Log - Page ${pageNum}`
            })
            entryTitles.push({
                title: `Activity Log - Page ${pageNum}`,
                type: 'ACTIVITY_LOG',
                category: 'Journal'
            })
        }
    }

    // 6. Best Efforts page if any activity has PRs
    const activitiesWithPRs = activities.filter(hasPersonalRecords)
    if (activitiesWithPRs.length > 0) {
        draft.push({
            type: 'BEST_EFFORTS',
            title: 'Personal Records'
        })
        entryTitles.push({
            title: 'Personal Records',
            type: 'BEST_EFFORTS',
            category: 'Highlights'
        })
    }

    // 7. Insert Table of Contents as second page (before other content)
    // Calculate final page numbers for all entries
    let currentPage = 1
    const finalEntries = []
    const tocEntries = []

    // Cover is page 1
    currentPage += 1

    // Build TOC with calculated page numbers
    for (const entry of draft) {
        if (entry.type === 'COVER') continue // Skip cover, already at page 1

        entry.pageNumber = currentPage
        const titleIndex = entryTitles.findIndex(
            t => t.type === entry.type && t.title === (entry.title || t.title)
        )

        if (titleIndex >= 0) {
            const titleEntry = entryTitles[titleIndex]
            tocEntries.push({
                title: titleEntry.title,
                pageNumber: currentPage,
                type: entry.type,
                category: titleEntry.category
            })
        }

        currentPage += 1
    }

    // Insert TOC as second page
    draft.splice(1, 0, {
        type: 'TABLE_OF_CONTENTS',
        title: 'Contents',
        pageNumber: 2
    })

    // 8. Back Cover
    draft.push({ type: 'BACK_COVER', title: 'Back Cover' })

    return draft
}
