import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookEntry } from '@/lib/curator'
import { Race_2pSpread } from './Race_2p'
import { TableOfContents, TOCEntry } from './TableOfContents'
import { Cover } from './Cover'
import { Foreword } from './Foreword'
import { BackCover } from './BackCover'
import { YearCalendar } from './YearCalendar'
import { YearStats } from './YearStats'
import { MonthlyDivider } from './MonthlyDivider'
import { ActivityLog } from './ActivityLog'
import { BookFormat, BookTheme, YearSummary, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { calculateActivitiesPerPage } from '@/lib/activity-log-utils'

const styles = StyleSheet.create({
    coverPage: {
        backgroundColor: '#000000',
        color: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 50,
    },
    coverTitle: {
        fontSize: 48,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    coverSubtitle: {
        fontSize: 18,
        fontFamily: 'Helvetica',
        textAlign: 'center',
        opacity: 0.8,
    },
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

interface BookDocumentProps {
    entries: BookEntry[]
    activities: StravaActivity[]
    format?: BookFormat
    theme?: BookTheme
    athleteName?: string
    year?: number
    yearSummary?: YearSummary
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
}: BookDocumentProps) => {
    // Calculate year summary from activities if not provided
    const computedYearSummary: YearSummary = yearSummary || {
        totalDistance: activities.reduce((sum, a) => sum + a.distance, 0),
        totalTime: activities.reduce((sum, a) => sum + a.moving_time, 0),
        totalElevation: activities.reduce((sum, a) => sum + a.total_elevation_gain, 0),
        activityCount: activities.length,
        longestActivity: activities.reduce((max, a) => a.distance > (max?.distance || 0) ? a : max, activities[0]),
        fastestActivity: activities[0], // Simplified
        activeDays: new Set(activities.map(a => a.start_date_local.split('T')[0])),
        monthlyStats: [],
        races: activities.filter(a => a.workout_type === 1),
        year,
    }

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
                        <Cover
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
                if (entry.type === 'RACE_PAGE' && entry.activityId) {
                    const activity = activities.find(a => a.id === entry.activityId)
                    if (activity) {
                        return (
                            <Race_2pSpread
                                key={index}
                                activity={activity}
                                highlightLabel={entry.highlightLabel}
                            />
                        )
                    }
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
                    const startIdx = (entry.pageNumber || 1 - 1) * perPage
                    const pageActivities = entry.activityIds
                        ? activities.filter(a => entry.activityIds?.includes(a.id))
                        : activities.slice(startIdx, startIdx + perPage)
                    return (
                        <ActivityLog
                            key={index}
                            activities={pageActivities}
                            startIndex={startIdx}
                            activitiesPerPage={perPage}
                            showMiniMaps={true}
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
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December']
            return entry.month !== undefined ? monthNames[entry.month] : 'Month'
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
