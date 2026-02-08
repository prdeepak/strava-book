/**
 * RaceSectionMapHero - "Map Hero" race variant
 *
 * Full-bleed Mapbox satellite map as hero with route overlay.
 * Semi-transparent stats panel at bottom.
 * For races with interesting routes but no/mediocre photos.
 * 1-2 pages total.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveActivityLocation, formatDuration, formatPace, formatDistanceValue, formatElevation, getMapboxSatelliteUrl } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

interface RaceSectionMapHeroProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const caption = resolveTypography('caption', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.primaryColor,
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
            justifyContent: 'flex-end',
        },
        titleArea: {
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
        locationText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor,
            opacity: 0.8,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: spacing.xs * 0.5,
        },
        statsPanel: {
            backgroundColor: theme.primaryColor,
            opacity: 0.9,
            borderRadius: 4 * format.scaleFactor,
            padding: spacing.md,
        },
        statsPanelInner: {
            flexDirection: 'row',
            justifyContent: 'space-around',
        },
        statItem: {
            alignItems: 'center',
        },
        statValue: {
            fontSize: stat.fontSize,
            fontFamily: stat.fontFamily,
            color: theme.accentColor,
            marginBottom: spacing.xs * 0.25,
        },
        statLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor,
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        highlightBadge: {
            position: 'absolute',
            top: format.safeMargin + spacing.xs,
            right: format.safeMargin + spacing.xs,
            backgroundColor: theme.accentColor,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs * 0.5,
            borderRadius: 2,
        },
        highlightText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
    })
}

export const RaceSectionMapHeroPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionMapHeroProps) => {
    const styles = createStyles(format, theme)
    const displayLarge = resolveTypography('displayLarge', theme, format)

    const location = resolveActivityLocation(activity)
    const distanceKm = formatDistanceValue(activity.distance)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance)
    const elevationM = formatElevation(activity.total_elevation_gain)

    // Get satellite map URL for full-bleed background
    const satW = Math.min(Math.round(format.dimensions.width * 2), 1280)
    const satH = Math.min(Math.round(format.dimensions.height * 2), 1280)
    const satelliteMapUrl = (mapboxToken && activity.map?.summary_polyline)
        ? resolveImageForPdf(getMapboxSatelliteUrl(
            activity.map.summary_polyline,
            mapboxToken,
            satW,
            satH
        )) || undefined
        : undefined

    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const titleHeight = 80 * format.scaleFactor

    const dateStr = new Date(activity.start_date_local || activity.start_date)
        .toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            {/* Full-bleed satellite map as hero */}
            <FullBleedBackground
                image={satelliteMapUrl}
                fallbackColor={theme.primaryColor}
                role="background"
                overlayOpacity={0.4}
                width={format.dimensions.width}
                height={format.dimensions.height}
                sourceWidth={satW}
                sourceHeight={satH}
            />

            {/* Highlight badge */}
            {highlightLabel && (
                <View style={styles.highlightBadge}>
                    <Text style={styles.highlightText}>{highlightLabel}</Text>
                </View>
            )}

            {/* Content overlaid at bottom */}
            <View style={styles.contentContainer}>
                <View style={styles.titleArea}>
                    <Text style={styles.dateText}>{dateStr}</Text>
                    <AutoResizingPdfText
                        text={activity.name}
                        width={contentWidth}
                        height={titleHeight}
                        font={displayLarge.fontFamily}
                        min_fontsize={displayLarge.minFontSize}
                        max_fontsize={displayLarge.fontSize}
                        h_align="left"
                        v_align="bottom"
                        textColor={theme.backgroundColor}
                    />
                    {location && <Text style={styles.locationText}>{location}</Text>}
                </View>

                {/* Semi-transparent stats panel */}
                <View style={styles.statsPanel}>
                    <View style={styles.statsPanelInner}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{distanceKm}</Text>
                            <Text style={styles.statLabel}>km</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{timeFormatted}</Text>
                            <Text style={styles.statLabel}>time</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{avgPace}</Text>
                            <Text style={styles.statLabel}>pace</Text>
                        </View>
                        {activity.total_elevation_gain > 0 && (
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{elevationM}</Text>
                                <Text style={styles.statLabel}>elevation</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Page>
    )
}
