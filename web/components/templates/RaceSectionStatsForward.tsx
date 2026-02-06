/**
 * RaceSectionStatsForward - "Stats Forward" race variant
 *
 * Large typography stats (distance, time, pace) as the hero visual.
 * Small map and photo accent in corner.
 * For races with impressive numbers but few photos.
 * 1 page.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveActivityLocation, formatDuration, formatPace, getMapboxSatelliteUrl } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImage } from '@/components/pdf/PdfImage'

interface RaceSectionStatsForwardProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const displayLarge = resolveTypography('displayLarge', theme, format)
    const heading = resolveTypography('heading', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: 0,
            position: 'relative',
        },
        contentContainer: {
            position: 'absolute',
            top: format.safeMargin,
            left: format.safeMargin,
            right: format.safeMargin,
            bottom: format.safeMargin,
            flexDirection: 'column',
        },
        header: {
            marginBottom: spacing.md,
        },
        dateText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.5,
        },
        raceName: {
            fontSize: heading.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
            marginBottom: spacing.xs * 0.25,
        },
        locationText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '80',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        giantStatsGrid: {
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignContent: 'center',
            paddingVertical: spacing.lg,
        },
        giantStat: {
            width: '48%',
            marginBottom: spacing.lg,
            alignItems: 'center',
        },
        giantStatValue: {
            fontSize: displayLarge.fontSize,
            fontFamily: displayLarge.fontFamily,
            color: theme.accentColor,
            lineHeight: 1.1,
            textAlign: 'center',
        },
        giantStatLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '60',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginTop: spacing.xs * 0.5,
        },
        bottomRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: spacing.sm,
            borderTopWidth: 2,
            borderTopColor: theme.accentColor,
        },
        accentContainer: {
            width: 120 * format.scaleFactor,
            height: 80 * format.scaleFactor,
            borderRadius: 4 * format.scaleFactor,
            overflow: 'hidden',
            position: 'relative',
        },
        highlightBadge: {
            backgroundColor: theme.accentColor,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs * 0.5,
            borderRadius: 2,
            alignSelf: 'flex-start',
        },
        highlightText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        prBadge: {
            backgroundColor: theme.accentColor,
            paddingHorizontal: spacing.xs,
            paddingVertical: 2,
            borderRadius: 2,
            marginTop: spacing.xs * 0.5,
        },
        prText: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor,
            letterSpacing: 0.5,
        },
    })
}

export const RaceSectionStatsForwardPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionStatsForwardProps) => {
    const styles = createStyles(format, theme)

    const location = resolveActivityLocation(activity)
    const distanceKm = (activity.distance / 1000).toFixed(1)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance, 'metric')
    const elevationM = Math.round(activity.total_elevation_gain)

    // Get small accent image (photo or map)
    const stravaPhoto = resolveImageForPdf(activity.photos?.primary?.urls?.['600'])
    const satelliteMapUrl = (mapboxToken && activity.map?.summary_polyline)
        ? resolveImageForPdf(getMapboxSatelliteUrl(
            activity.map.summary_polyline,
            mapboxToken,
            240,
            160,
        )) || undefined
        : undefined
    const accentImage = stravaPhoto || satelliteMapUrl

    // Check for PRs
    const topPRs = (activity.best_efforts || [])
        .filter(e => e.pr_rank && e.pr_rank <= 3)
        .slice(0, 2)

    const dateStr = new Date(activity.start_date_local || activity.start_date)
        .toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.dateText}>{dateStr}</Text>
                    <Text style={styles.raceName}>{activity.name}</Text>
                    {location && <Text style={styles.locationText}>{location}</Text>}
                </View>

                {/* Giant stats as hero visual */}
                <View style={styles.giantStatsGrid}>
                    <View style={styles.giantStat}>
                        <Text style={styles.giantStatValue}>{distanceKm}</Text>
                        <Text style={styles.giantStatLabel}>kilometers</Text>
                    </View>
                    <View style={styles.giantStat}>
                        <Text style={styles.giantStatValue}>{timeFormatted}</Text>
                        <Text style={styles.giantStatLabel}>time</Text>
                    </View>
                    <View style={styles.giantStat}>
                        <Text style={styles.giantStatValue}>{avgPace}</Text>
                        <Text style={styles.giantStatLabel}>pace /km</Text>
                    </View>
                    {elevationM > 0 && (
                        <View style={styles.giantStat}>
                            <Text style={styles.giantStatValue}>{elevationM}m</Text>
                            <Text style={styles.giantStatLabel}>elevation</Text>
                        </View>
                    )}
                </View>

                {/* Bottom row: accent image + PR badges */}
                <View style={styles.bottomRow}>
                    <View>
                        {highlightLabel && (
                            <View style={styles.highlightBadge}>
                                <Text style={styles.highlightText}>{highlightLabel}</Text>
                            </View>
                        )}
                        {topPRs.map((pr, idx) => (
                            <View key={idx} style={styles.prBadge}>
                                <Text style={styles.prText}>
                                    PR #{pr.pr_rank} — {pr.name}
                                </Text>
                            </View>
                        ))}
                    </View>
                    {accentImage && (
                        <View style={styles.accentContainer}>
                            <PdfImage src={accentImage} />
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}
