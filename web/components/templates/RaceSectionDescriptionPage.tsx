import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveActivityLocation } from '@/lib/activity-utils'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
    page: {
        width: format.dimensions.width,
        height: format.dimensions.height,
        backgroundColor: theme.backgroundColor,
        padding: format.safeMargin,
        flexDirection: 'column',
    },
    header: {
        marginBottom: 20 * format.scaleFactor,
    },
    eventLabel: {
        color: theme.accentColor,
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8 * format.scaleFactor,
    },
    title: {
        fontSize: Math.max(24, 36 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: theme.primaryColor,
        marginBottom: 8 * format.scaleFactor,
        lineHeight: 1.2,
    },
    meta: {
        color: '#666',
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        marginBottom: 4 * format.scaleFactor,
    },
    divider: {
        height: 3,
        backgroundColor: theme.accentColor,
        marginTop: 16 * format.scaleFactor,
        marginBottom: 24 * format.scaleFactor,
        width: 60,
    },
    descriptionContainer: {
        flex: 1,
    },
    description: {
        fontSize: Math.max(12, 16 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: theme.primaryColor,
        lineHeight: 1.6,
        textAlign: 'left',
    },
    quoteDecoration: {
        fontSize: Math.max(48, 72 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: theme.accentColor,
        opacity: 0.2,
        position: 'absolute',
        top: -20 * format.scaleFactor,
        left: -10 * format.scaleFactor,
    },
    statsFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        paddingTop: 16 * format.scaleFactor,
        marginTop: 24 * format.scaleFactor,
    },
    footerStat: {
        alignItems: 'center',
    },
    footerStatValue: {
        fontSize: Math.max(16, 24 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: theme.primaryColor,
    },
    footerStatLabel: {
        fontSize: Math.max(8, 10 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 4 * format.scaleFactor,
    },
})

export interface RaceSectionDescriptionPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
}

export const RaceSectionDescriptionPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
}: RaceSectionDescriptionPageProps) => {
    const styles = createStyles(format, theme)

    const location = resolveActivityLocation(activity)

    // Format date
    const dateStr = new Date(activity.start_date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })

    // Format stats
    const distance = activity.distance ? (activity.distance / 1000).toFixed(1) : '0.0'
    const time = activity.moving_time
        ? new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
        : '00:00:00'

    // Only show description page if there's a description
    const description = activity.description || ''

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.eventLabel}>Race Story</Text>
                <Text style={styles.title}>{activity.name}</Text>
                <Text style={styles.meta}>{dateStr}</Text>
                {location && <Text style={styles.meta}>{location}</Text>}
                <View style={styles.divider} />
            </View>

            <View style={styles.descriptionContainer}>
                <Text style={styles.quoteDecoration}>"</Text>
                <Text style={styles.description}>{description}</Text>
            </View>

            <View style={styles.statsFooter}>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{distance}</Text>
                    <Text style={styles.footerStatLabel}>Kilometers</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{time}</Text>
                    <Text style={styles.footerStatLabel}>Time</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{activity.kudos_count || 0}</Text>
                    <Text style={styles.footerStatLabel}>Kudos</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{activity.comment_count || 0}</Text>
                    <Text style={styles.footerStatLabel}>Comments</Text>
                </View>
            </View>
        </Page>
    )
}
