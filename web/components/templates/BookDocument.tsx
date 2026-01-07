import { Document, Page, Text, StyleSheet, View } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookEntry } from '@/lib/curator'
import { Race_2pSpread } from './Race_2p'
import { TableOfContents, TOCEntry } from './TableOfContents'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'

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
}: BookDocumentProps) => {
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
                        <Page key={index} size="LETTER" style={styles.coverPage}>
                            <Text style={styles.coverTitle}>{entry.title || 'My Strava Book'}</Text>
                            <Text style={styles.coverSubtitle}>A collection of your greatest efforts</Text>
                        </Page>
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

                // MONTHLY_DIVIDER - Placeholder
                if (entry.type === 'MONTHLY_DIVIDER') {
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                       'July', 'August', 'September', 'October', 'November', 'December']
                    const monthName = entry.month !== undefined ? monthNames[entry.month] : 'Month'
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>{monthName}</Text>
                            <Text style={styles.placeholderText}>{monthName} {entry.year}</Text>
                        </Page>
                    )
                }

                // YEAR_AT_A_GLANCE - Placeholder
                if (entry.type === 'YEAR_AT_A_GLANCE') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Year at a Glance</Text>
                            <Text style={styles.placeholderText}>{entry.year}</Text>
                        </Page>
                    )
                }

                // YEAR_STATS - Placeholder
                if (entry.type === 'YEAR_STATS') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Year Summary</Text>
                            <Text style={styles.placeholderText}>{entry.year}</Text>
                        </Page>
                    )
                }

                // ACTIVITY_LOG - Placeholder
                if (entry.type === 'ACTIVITY_LOG') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Activity Log</Text>
                            <Text style={styles.placeholderText}>
                                {entry.activityIds?.length || 0} activities
                            </Text>
                        </Page>
                    )
                }

                // FOREWORD - Placeholder
                if (entry.type === 'FOREWORD') {
                    return (
                        <Page key={index} size="LETTER" style={styles.placeholderPage}>
                            <Text style={styles.placeholderTitle}>Foreword</Text>
                            <Text style={styles.placeholderText}>{entry.forewordText || 'Your story here'}</Text>
                        </Page>
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

                // BACK_COVER - Placeholder
                if (entry.type === 'BACK_COVER') {
                    return (
                        <Page key={index} size="LETTER" style={styles.coverPage}>
                            <Text style={styles.coverTitle}>The End</Text>
                            <Text style={styles.coverSubtitle}>Created with Strava Book</Text>
                        </Page>
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
        case 'YEAR_AT_A_GLANCE':
            return 'Year at a Glance'
        case 'YEAR_STATS':
            return 'Year Summary'
        case 'ACTIVITY_LOG':
            return `Activity Log - Page ${entry.pageNumber || 1}`
        case 'BEST_EFFORTS':
            return 'Personal Records'
        case 'BACK_COVER':
            return 'Back Cover'
        default:
            return entry.type
    }
}
