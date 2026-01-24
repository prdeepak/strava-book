import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveActivityLocation } from '@/lib/activity-utils'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImage } from '@/components/pdf/PdfImage'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
    page: {
        width: format.dimensions.width,
        height: format.dimensions.height,
        backgroundColor: theme.primaryColor,
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 0,
        position: 'relative',
    },
    // Background image container - PdfImage handles positioning
    backgroundImageContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    // Full-height gradient overlay for better text readability
    gradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    contentOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        padding: format.safeMargin * 1.2,
        paddingTop: format.safeMargin * 2,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    highlightLabel: {
        color: theme.accentColor,
        fontSize: Math.max(14, 16 * format.scaleFactor),
        marginBottom: 10 * format.scaleFactor,
        fontFamily: theme.fontPairing.heading,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    meta: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: Math.max(14, 16 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8 * format.scaleFactor,
    },
    title: {
        fontSize: Math.max(36, 48 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: '#ffffff',
        textTransform: 'uppercase',
        marginBottom: 16 * format.scaleFactor,
        marginTop: 14 * format.scaleFactor,
        lineHeight: 1.1,
        maxWidth: '100%',
        letterSpacing: 2,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 24 * format.scaleFactor,
        borderTopWidth: 3,
        borderTopColor: theme.accentColor,
        paddingTop: 20 * format.scaleFactor,
        gap: format.safeMargin * 0.8,
    },
    stat: {
        flex: 1,
        maxWidth: '30%',
    },
    statValue: {
        color: '#ffffff',
        fontSize: Math.max(28, 38 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        lineHeight: 1.1,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: Math.max(12, 14 * format.scaleFactor),
        marginTop: 6 * format.scaleFactor,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontFamily: theme.fontPairing.body,
    }
})

export interface RaceSectionHeroPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    highlightLabel?: string
}

export const RaceSectionHeroPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
    highlightLabel
}: RaceSectionHeroPageProps) => {
    const styles = createStyles(format, theme)

    // Check for high-res photo - prefer higher resolution if available
    let bgImage: string | null = null
    const primaryUrls = activity.photos?.primary?.urls as Record<string, string> | undefined

    if (primaryUrls) {
        // Try to get the best available URL
        const rawUrl = primaryUrls['600'] ||
            primaryUrls['5000'] ||
            primaryUrls['100'] ||
            Object.values(primaryUrls)[0]

        if (rawUrl) {
            // Use resolveImageForPdf to handle the URL correctly for server-side PDF generation
            // This handles both external URLs (returned as-is) and proxy-image URLs
            // For PDF generation we want the direct external URL
            bgImage = resolveImageForPdf(rawUrl)
        }
    }

    // Use utility function for location resolution
    const location = resolveActivityLocation(activity)

    // Format stats with safe fallbacks
    const distance = activity.distance ? (activity.distance / 1000).toFixed(1) : '0.0'
    const time = activity.moving_time
        ? new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
        : '00:00:00'

    // Calculate pace safely
    const paceMinPerKm = activity.distance > 0 && activity.moving_time > 0
        ? (activity.moving_time / 60) / (activity.distance / 1000)
        : 0
    const paceMin = Math.floor(paceMinPerKm)
    const paceSec = Math.round((paceMinPerKm - paceMin) * 60)
    const pace = paceMinPerKm > 0 ? `${paceMin}:${paceSec.toString().padStart(2, '0')}` : 'N/A'

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            {/* Background Image Layer */}
            {bgImage && (
                <View style={styles.backgroundImageContainer}>
                    <PdfImage src={bgImage} opacity={0.65} />
                </View>
            )}

            {/* Full-height gradient overlay for better overall text readability */}
            <View style={styles.gradientOverlay} />

            {/* Content Overlay at Bottom */}
            <View style={styles.contentOverlay}>
                {highlightLabel && (
                    <Text style={styles.highlightLabel}>
                        {highlightLabel}
                    </Text>
                )}

                <Text style={styles.meta}>
                    {new Date(activity.start_date).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </Text>

                {location && <Text style={styles.meta}>{location}</Text>}

                <Text style={styles.title}>{activity.name}</Text>

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{distance}</Text>
                        <Text style={styles.statLabel}>Kilometers</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{time}</Text>
                        <Text style={styles.statLabel}>Time</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{pace}</Text>
                        <Text style={styles.statLabel}>Avg Pace</Text>
                    </View>
                    {activity.total_elevation_gain > 0 && (
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{Math.round(activity.total_elevation_gain)}</Text>
                            <Text style={styles.statLabel}>Meters Climb</Text>
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}

// Legacy export for backwards compatibility
export const Race_2pLeft = RaceSectionHeroPage
