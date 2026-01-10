import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookEntry } from '@/lib/curator'
import { Race_2pSpreadPages } from './Race_2p'
import { TableOfContents, TOCEntry } from './TableOfContents'
import { CoverPage } from './Cover'
import { Foreword } from './Foreword'
import { BackCover } from './BackCover'
import { YearCalendar } from './YearCalendar'
import { YearStats } from './YearStats'
import { MonthlyDivider } from './MonthlyDivider'
import { ActivityLog } from './ActivityLog'
import { BookFormat, BookTheme, YearSummary, MonthlyStats, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { calculateActivitiesPerPage } from '@/lib/activity-log-utils'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

const styles = StyleSheet.create({
    placeholderPage: {
        padding: 40,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderTitle: {
        fontSize: 32,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    placeholderText: {
        fontSize: 12,
        fontFamily: 'Helvetica',
        textAlign: 'center',
        color: '#666',
    }
})

// ============================================================================
// YEAR SUMMARY COMPUTATION
// ============================================================================

/**
 * Compute a complete YearSummary from an array of activities.
 * Includes monthly breakdowns with per-month statistics.
 */
export function computeYearSummary(activities: StravaActivity[], year: number): YearSummary {
    if (activities.length === 0) {
        return {
            year,
            totalDistance: 0,
            totalTime: 0,
            totalElevation: 0,
            activityCount: 0,
            longestActivity: null as unknown as StravaActivity,
            fastestActivity: null as unknown as StravaActivity,
            activeDays: new Set<string>(),
            monthlyStats: [],
            races: [],
        }
    }

    // Group activities by month
    const activitiesByMonth = new Map<number, StravaActivity[]>()
    for (let month = 0; month < 12; month++) {
        activitiesByMonth.set(month, [])
    }

    activities.forEach(activity => {
        const date = new Date(activity.start_date_local || activity.start_date)
        const month = date.getMonth()
        activitiesByMonth.get(month)?.push(activity)
    })

    // Compute monthly stats
    const monthlyStats: MonthlyStats[] = []
    for (let month = 0; month < 12; month++) {
        const monthActivities = activitiesByMonth.get(month) || []
        if (monthActivities.length > 0) {
            const activeDaysSet = new Set(
                monthActivities.map(a => (a.start_date_local || a.start_date).split('T')[0])
            )
            monthlyStats.push({
                month,
                year,
                activityCount: monthActivities.length,
                totalDistance: monthActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
                totalTime: monthActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
                totalElevation: monthActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
                activeDays: activeDaysSet.size,
                activities: monthActivities,
            })
        }
    }

    // Find longest activity (by distance)
    const longestActivity = activities.reduce(
        (max, a) => (a.distance || 0) > (max?.distance || 0) ? a : max,
        activities[0]
    )

    // Find fastest run (shortest moving_time for a 5km+ run)
    // Uses moving_time/distance ratio as a proxy since average_speed isn't always available
    const runs = activities.filter(a => a.type === 'Run' && a.distance >= 5000)
    const fastestActivity = runs.length > 0
        ? runs.reduce((fastest, a) => {
            const currentPace = a.moving_time / a.distance
            const fastestPace = fastest.moving_time / fastest.distance
            return currentPace < fastestPace ? a : fastest
        }, runs[0])
        : activities[0]

    // Collect all active days
    const activeDays = new Set(
        activities.map(a => (a.start_date_local || a.start_date).split('T')[0])
    )

    // Detect races (workout_type === 1)
    const races = activities.filter(a => a.workout_type === 1)

    // Find A-Race (longest race, or most recent if tied)
    const aRace = races.length > 0
        ? races.sort((a, b) => {
            const distDiff = (b.distance || 0) - (a.distance || 0)
            if (distDiff !== 0) return distDiff
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        })[0]
        : undefined

    return {
        year,
        totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0),
        totalTime: activities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
        totalElevation: activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
        activityCount: activities.length,
        longestActivity,
        fastestActivity,
        activeDays,
        monthlyStats,
        races,
        aRace,
    }
}

// ============================================================================
// BOOK ENTRY GENERATION
// ============================================================================

export interface BookGenerationConfig {
    title?: string
    subtitle?: string
    athleteName: string
    year: number
    forewordText?: string
    format: BookFormat
    activitiesPerLogPage?: number
}

/**
 * Generate the complete sequence of BookEntry objects for a full book.
 *
 * Book structure per SPEC.md Section 2:
 * 1. Cover (always)
 * 2. Foreword (if forewordText provided)
 * 3. Table of Contents (always)
 * 4. Year Stats (always)
 * 5. Year Calendar (always, GitHub-style heatmap)
 * 6. For each active month: Monthly Divider + Race pages for that month
 * 7. Activity Log pages (paginated, non-race activities)
 * 8. Back Cover (always)
 */
export function generateBookEntries(
    activities: StravaActivity[],
    config: BookGenerationConfig
): BookEntry[] {
    const entries: BookEntry[] = []
    const { year, forewordText, format } = config
    const activitiesPerPage = config.activitiesPerLogPage || calculateActivitiesPerPage(format)

    // Track page numbers for TOC
    let currentPage = 1

    // 1. COVER (page 1)
    entries.push({
        type: 'COVER',
        title: config.title || `${year} Year in Review`,
        pageNumber: currentPage++,
    })

    // 2. FOREWORD (optional)
    if (forewordText) {
        entries.push({
            type: 'FOREWORD',
            title: 'Foreword',
            forewordText,
            pageNumber: currentPage++,
        })
    }

    // 3. TABLE OF CONTENTS (placeholder, page numbers computed later)
    const tocPageNumber = currentPage++
    entries.push({
        type: 'TABLE_OF_CONTENTS',
        title: 'Contents',
        pageNumber: tocPageNumber,
    })

    // Handle empty activities case
    if (activities.length === 0) {
        entries.push({
            type: 'BACK_COVER',
            pageNumber: currentPage++,
        })
        return entries
    }

    // 4. YEAR STATS
    entries.push({
        type: 'YEAR_STATS',
        year,
        title: `${year} Summary`,
        pageNumber: currentPage++,
    })

    // 5. YEAR CALENDAR (GitHub-style heatmap)
    entries.push({
        type: 'YEAR_AT_A_GLANCE',
        year,
        title: 'Year at a Glance',
        pageNumber: currentPage++,
    })

    // Group activities by month
    const activitiesByMonth = new Map<number, StravaActivity[]>()
    for (let month = 0; month < 12; month++) {
        activitiesByMonth.set(month, [])
    }

    activities.forEach(activity => {
        const date = new Date(activity.start_date_local || activity.start_date)
        const month = date.getMonth()
        activitiesByMonth.get(month)?.push(activity)
    })

    // Track races added and non-race activities for activity log
    const nonRaceActivities: StravaActivity[] = []

    // 6. FOR EACH ACTIVE MONTH: Monthly Divider + Race pages
    for (let month = 0; month < 12; month++) {
        const monthActivities = activitiesByMonth.get(month) || []

        // Skip months with no activities
        if (monthActivities.length === 0) {
            continue
        }

        // 6a. MONTHLY DIVIDER
        entries.push({
            type: 'MONTHLY_DIVIDER',
            month,
            year,
            title: MONTH_NAMES[month],
            highlightLabel: `${monthActivities.length} ${monthActivities.length === 1 ? 'activity' : 'activities'}`,
            pageNumber: currentPage++,
        })

        // 6b. RACE PAGES for this month
        const monthRaces = monthActivities.filter(a => a.workout_type === 1)
        monthRaces.forEach(race => {
            entries.push({
                type: 'RACE_PAGE',
                activityId: race.id,
                title: race.name,
                highlightLabel: race.name,
                pageNumber: currentPage,
            })
            // Race_2p uses 2 pages (spread)
            currentPage += 2
        })

        // Collect non-race activities for activity log
        const monthNonRaces = monthActivities.filter(a => a.workout_type !== 1)
        nonRaceActivities.push(...monthNonRaces)
    }

    // 7. ACTIVITY LOG PAGES (paginated)
    if (nonRaceActivities.length > 0) {
        const totalLogPages = Math.ceil(nonRaceActivities.length / activitiesPerPage)

        for (let pageNum = 0; pageNum < totalLogPages; pageNum++) {
            const startIdx = pageNum * activitiesPerPage
            const pageActivities = nonRaceActivities.slice(startIdx, startIdx + activitiesPerPage)

            entries.push({
                type: 'ACTIVITY_LOG',
                activityIds: pageActivities.map(a => a.id),
                pageNumber: currentPage++,
                title: `Training Journal${totalLogPages > 1 ? ` (${pageNum + 1}/${totalLogPages})` : ''}`,
            })
        }
    }

    // 8. BACK COVER
    entries.push({
        type: 'BACK_COVER',
        title: 'Back Cover',
        pageNumber: currentPage++,
    })

    return entries
}

/**
 * Determine if an activity qualifies for an expanded race spread (4 pages)
 * vs a standard race spread (2 pages).
 *
 * Criteria for 4-page spread:
 * - Has multiple photos (3+)
 * - Has comments (via comments array length)
 * - Has a description
 */
export function shouldUseExpandedRaceSpread(activity: StravaActivity): boolean {
    const hasPhotos = (activity.photos?.count || 0) >= 3
    const hasComments = (activity.comments?.length || 0) > 0
    const hasDescription = !!(activity.description && activity.description.length > 50)

    // Need at least 2 of 3 criteria for expanded spread
    const qualifiers = [hasPhotos, hasComments, hasDescription].filter(Boolean).length
    return qualifiers >= 2
}

// ============================================================================
// BOOK DOCUMENT COMPONENT
// ============================================================================

interface BookDocumentProps {
    entries: BookEntry[]
    activities: StravaActivity[]
    format?: BookFormat
    theme?: BookTheme
    athleteName?: string
    year?: number
    yearSummary?: YearSummary
    mapboxToken?: string
}

/**
 * BookDocument - Main document container for all book pages
 * Routes entries to appropriate template components
 */
export const BookDocument = ({
    entries,
    activities,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    athleteName = 'Athlete',
    year = new Date().getFullYear(),
    yearSummary,
    mapboxToken,
}: BookDocumentProps) => {
    // Calculate year summary from activities if not provided
    // Uses the comprehensive computeYearSummary function for proper monthly stats
    const computedYearSummary: YearSummary = yearSummary || computeYearSummary(activities, year)

    // Build TOC entries from draft entries
    const tocEntries: TOCEntry[] = entries
        .filter(entry => entry.type !== 'COVER' && entry.type !== 'TABLE_OF_CONTENTS')
        .map(entry => ({
            title: entry.title || getDefaultTitle(entry),
            pageNumber: entry.pageNumber || 0,
            type: entry.type,
            category: entry.category || getCategoryForType(entry.type),
        }))

    return (
        <Document>
            {entries.map((entry, index) => {
                // COVER
                if (entry.type === 'COVER') {
                    return (
                        <CoverPage
                            key={index}
                            title={entry.title || 'My Year in Review'}
                            year={year}
                            athleteName={athleteName}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // TABLE_OF_CONTENTS
                if (entry.type === 'TABLE_OF_CONTENTS') {
                    return (
                        <TableOfContents
                            key={index}
                            entries={tocEntries}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // RACE_PAGE
                if (entry.type === 'RACE_PAGE') {
                    if (!entry.activityId) {
                        return null // Skip if no activity ID
                    }
                    const activity = activities.find(a => a.id === entry.activityId)
                    if (!activity) {
                        return null // Skip if activity not found
                    }
                    return (
                        <Race_2pSpreadPages
                            key={index}
                            activity={activity}
                            format={format}
                            theme={theme}
                            highlightLabel={entry.highlightLabel}
                            mapboxToken={mapboxToken}
                        />
                    )
                }

                // MONTHLY_DIVIDER
                if (entry.type === 'MONTHLY_DIVIDER') {
                    const monthActivities = activities.filter(a => {
                        const activityMonth = new Date(a.start_date_local).getMonth()
                        return activityMonth === entry.month
                    })
                    return (
                        <MonthlyDivider
                            key={index}
                            month={entry.month ?? 0}
                            year={entry.year ?? year}
                            stats={{
                                activityCount: monthActivities.length,
                                totalDistance: monthActivities.reduce((sum, a) => sum + a.distance, 0),
                                totalTime: monthActivities.reduce((sum, a) => sum + a.moving_time, 0),
                            }}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // YEAR_AT_A_GLANCE
                if (entry.type === 'YEAR_AT_A_GLANCE') {
                    return (
                        <YearCalendar
                            key={index}
                            year={entry.year ?? year}
                            activities={activities}
                            colorBy="distance"
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // YEAR_STATS
                if (entry.type === 'YEAR_STATS') {
                    return (
                        <YearStats
                            key={index}
                            yearSummary={computedYearSummary}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // ACTIVITY_LOG
                if (entry.type === 'ACTIVITY_LOG') {
                    const perPage = calculateActivitiesPerPage(format)
                    // If activityIds provided, use those specific activities (already filtered)
                    // Otherwise slice from full activities array
                    const pageActivities = entry.activityIds
                        ? activities.filter(a => entry.activityIds?.includes(a.id))
                        : activities.slice(
                            ((entry.pageNumber || 1) - 1) * perPage,
                            (entry.pageNumber || 1) * perPage
                        )
                    return (
                        <ActivityLog
                            key={index}
                            activities={pageActivities}
                            startIndex={0}  // Activities are already filtered for this page
                            activitiesPerPage={perPage}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // FOREWORD
                if (entry.type === 'FOREWORD') {
                    return (
                        <Foreword
                            key={index}
                            title={entry.title || 'Foreword'}
                            body={entry.forewordText || 'Your story here...'}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // BEST_EFFORTS - Placeholder
                if (entry.type === 'BEST_EFFORTS') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Personal Records</Text>
                            <Text style={styles.placeholderText}>Your best efforts this year</Text>
                        </Page>
                    )
                }

                // ROUTE_HEATMAP - Placeholder
                if (entry.type === 'ROUTE_HEATMAP') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Route Heatmap</Text>
                            <Text style={styles.placeholderText}>All your routes overlaid</Text>
                        </Page>
                    )
                }

                // STATS_SUMMARY - Placeholder
                if (entry.type === 'STATS_SUMMARY') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Stats Summary</Text>
                            <Text style={styles.placeholderText}>Overview of your activities</Text>
                        </Page>
                    )
                }

                // BACK_COVER
                if (entry.type === 'BACK_COVER') {
                    return (
                        <BackCover
                            key={index}
                            yearSummary={computedYearSummary}
                            format={format}
                            theme={theme}
                        />
                    )
                }

                // Unknown page type
                return (
                    <Page key={index}>
                        <Text>Unknown Page Type: {entry.type}</Text>
                    </Page>
                )
            })}
        </Document>
    )
}

/**
 * Get category for a page type
 */
function getCategoryForType(type: BookEntry['type']): string {
    switch (type) {
        case 'COVER':
        case 'FOREWORD':
            return 'Front Matter'
        case 'YEAR_AT_A_GLANCE':
        case 'YEAR_STATS':
            return 'Overview'
        case 'MONTHLY_DIVIDER':
        case 'ACTIVITY_LOG':
            return 'Training Log'
        case 'RACE_PAGE':
            return 'Races'
        case 'BEST_EFFORTS':
        case 'ROUTE_HEATMAP':
            return 'Highlights'
        case 'BACK_COVER':
            return 'Back Matter'
        default:
            return 'Other'
    }
}

/**
 * Get default title for a page type
 */
function getDefaultTitle(entry: BookEntry): string {
    switch (entry.type) {
        case 'MONTHLY_DIVIDER':
            return entry.month !== undefined ? MONTH_NAMES[entry.month] : 'Month'
        case 'FOREWORD':
            return 'Foreword'
        case 'YEAR_AT_A_GLANCE':
            return 'Year at a Glance'
        case 'YEAR_STATS':
            return 'Year Summary'
        case 'ACTIVITY_LOG':
            return `Activity Log - Page ${entry.pageNumber || 1}`
        case 'BEST_EFFORTS':
            return 'Personal Records'
        case 'ROUTE_HEATMAP':
            return 'Route Heatmap'
        case 'STATS_SUMMARY':
            return 'Stats Summary'
        case 'BACK_COVER':
            return 'Back Cover'
        default:
            return entry.type
    }
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

interface FullBookDocumentProps {
    activities: StravaActivity[]
    title?: string
    subtitle?: string
    athleteName: string
    year: number
    forewordText?: string
    format?: BookFormat
    theme?: BookTheme
    mapboxToken?: string
}

/**
 * FullBookDocument - Convenience component that auto-generates book entries
 *
 * Use this when you want to generate a complete book from activities without
 * manually creating BookEntry objects. It uses generateBookEntries() internally
 * to create the proper page sequence per SPEC.md Section 2.
 *
 * @example
 * <FullBookDocument
 *   activities={myActivities}
 *   athleteName="John Doe"
 *   year={2024}
 *   format={FORMATS['10x10']}
 *   theme={myTheme}
 * />
 */
export const FullBookDocument = ({
    activities,
    title,
    subtitle,
    athleteName,
    year,
    forewordText,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
}: FullBookDocumentProps) => {
    // Generate book entries from activities
    const entries = generateBookEntries(activities, {
        title,
        subtitle,
        athleteName,
        year,
        forewordText,
        format,
    })

    // Compute year summary
    const yearSummary = computeYearSummary(activities, year)

    return (
        <BookDocument
            entries={entries}
            activities={activities}
            format={format}
            theme={theme}
            athleteName={athleteName}
            year={year}
            yearSummary={yearSummary}
            mapboxToken={mapboxToken}
        />
    )
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Estimate the total page count for a book before rendering.
 * Useful for progress indicators and memory budgeting.
 */
export function estimatePageCount(
    activities: StravaActivity[],
    format: BookFormat
): { total: number; breakdown: Record<string, number> } {
    const activitiesPerPage = calculateActivitiesPerPage(format)

    // Group by month to count active months
    const activeMonths = new Set(
        activities.map(a => new Date(a.start_date_local || a.start_date).getMonth())
    ).size

    // Count races
    const raceCount = activities.filter(a => a.workout_type === 1).length
    const nonRaceCount = activities.length - raceCount

    // Calculate log pages needed
    const logPages = Math.ceil(nonRaceCount / activitiesPerPage)

    const breakdown = {
        cover: 1,
        toc: 1,
        yearStats: 1,
        yearCalendar: 1,
        monthlyDividers: activeMonths,
        racePages: raceCount * 2, // Each race uses 2-page spread
        activityLog: logPages,
        backCover: 1,
    }

    const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0)

    return { total, breakdown }
}
