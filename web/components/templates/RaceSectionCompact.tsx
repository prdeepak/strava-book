/**
 * RaceSectionCompact - "Compact" race variant
 *
 * Everything on 1-2 pages, inspired by Race_1p.tsx patterns.
 * Photo + stats + key info all on one spread.
 * For secondary races that don't need 4-6 pages.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveActivityLocation, formatDuration, formatPace, formatDistanceValue, formatElevation, processSplits, processBestEfforts, getMapboxSatelliteUrl } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { PdfImage } from '@/components/pdf/PdfImage'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

interface RaceSectionCompactProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const heading = resolveTypography('heading', theme, format)
    const subheading = resolveTypography('subheading', theme, format)
    const body = resolveTypography('body', theme, format)
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
        },
        // Top section: photo + title side by side
        topSection: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        photoContainer: {
            width: '45%',
            height: 200 * format.scaleFactor,
            borderRadius: 4 * format.scaleFactor,
            overflow: 'hidden',
            position: 'relative',
        },
        titleSection: {
            flex: 1,
            justifyContent: 'flex-end',
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
            color: theme.backgroundColor,
            lineHeight: 1.15,
            marginBottom: spacing.xs * 0.5,
        },
        locationText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor + '80',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        // Stats row
        statsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.backgroundColor + '30',
            borderBottomWidth: 1,
            borderBottomColor: theme.backgroundColor + '30',
            marginBottom: spacing.sm,
        },
        statItem: {
            alignItems: 'center',
        },
        statValue: {
            fontSize: stat.fontSize * 0.9,
            fontFamily: stat.fontFamily,
            color: theme.accentColor,
            marginBottom: 2,
        },
        statLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor + '70',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        // Data columns
        dataSection: {
            flex: 1,
            flexDirection: 'row',
            gap: spacing.sm,
        },
        dataColumn: {
            flex: 1,
        },
        sectionTitle: {
            fontSize: caption.fontSize * 0.9,
            fontFamily: subheading.fontFamily,
            textTransform: 'uppercase',
            color: theme.accentColor,
            marginBottom: spacing.xs * 0.5,
            letterSpacing: 1,
            borderBottomWidth: 1,
            borderBottomColor: theme.backgroundColor + '20',
            paddingBottom: 3 * format.scaleFactor,
        },
        dataRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 2 * format.scaleFactor,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.backgroundColor + '15',
        },
        dataLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor + '80',
        },
        dataValue: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor,
        },
        description: {
            fontSize: caption.fontSize,
            fontFamily: body.fontFamily,
            color: theme.backgroundColor + '90',
            fontStyle: 'italic',
            lineHeight: 1.3,
            marginBottom: spacing.sm,
            paddingLeft: spacing.xs,
            borderLeftWidth: 2,
            borderLeftColor: theme.accentColor,
        },
        // Map section at bottom
        mapContainer: {
            width: '100%',
            height: 80 * format.scaleFactor,
            borderRadius: 4 * format.scaleFactor,
            overflow: 'hidden',
            position: 'relative',
            marginTop: 'auto',
        },
    })
}

export const RaceSectionCompactPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionCompactProps) => {
    const styles = createStyles(format, theme)
    const heading = resolveTypography('heading', theme, format)
    const spacing = resolveSpacing(theme, format)
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const titleColumnWidth = contentWidth * 0.55 - spacing.sm

    const location = resolveActivityLocation(activity)
    const distanceKm = formatDistanceValue(activity.distance)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance)
    const elevationM = formatElevation(activity.total_elevation_gain)

    const photos = extractPhotos(activity)
    const firstPhoto = photos[0]
    const stravaPhoto = firstPhoto?.url || null
    const photoW = firstPhoto?.width
    const photoH = firstPhoto?.height

    const satW = Math.min(Math.round(format.dimensions.width * 2), 1280)
    const satH = Math.min(Math.round(160 * 2), 1280)
    const satelliteMapUrl = (mapboxToken && activity.map?.summary_polyline)
        ? resolveImageForPdf(getMapboxSatelliteUrl(
            activity.map.summary_polyline,
            mapboxToken,
            Math.round(format.dimensions.width * 2),
            160,
        )) || undefined
        : undefined

    const displaySplits = processSplits(activity, 5)
    const bestEfforts = processBestEfforts(activity, 5)

    const dateStr = new Date(activity.start_date_local || activity.start_date)
        .toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                {/* Top: photo + title */}
                <View style={styles.topSection}>
                    {stravaPhoto ? (
                        <View style={styles.photoContainer}>
                            <PdfImage src={stravaPhoto} sourceWidth={photoW} sourceHeight={photoH} />
                        </View>
                    ) : satelliteMapUrl ? (
                        <View style={styles.photoContainer}>
                            <PdfImage src={satelliteMapUrl} sourceWidth={satW} sourceHeight={satH} />
                        </View>
                    ) : null}
                    <View style={styles.titleSection}>
                        <Text style={styles.dateText}>{highlightLabel || dateStr}</Text>
                        <AutoResizingPdfText
                            text={activity.name}
                            width={titleColumnWidth}
                            height={heading.fontSize * 2.5}
                            font={heading.fontFamily}
                            min_fontsize={heading.minFontSize}
                            max_fontsize={heading.fontSize}
                            h_align="left"
                            v_align="bottom"
                            textColor={theme.backgroundColor}
                        />
                        {location && <Text style={styles.locationText}>{location}</Text>}
                    </View>
                </View>

                {/* Description (if present) */}
                {activity.description && (
                    <Text style={styles.description}>
                        {activity.description.length > 200
                            ? activity.description.substring(0, 200) + '...'
                            : activity.description}
                    </Text>
                )}

                {/* Stats row */}
                <View style={styles.statsRow}>
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
                            <Text style={styles.statLabel}>elev</Text>
                        </View>
                    )}
                </View>

                {/* Data: splits + best efforts side by side */}
                <View style={styles.dataSection}>
                    {displaySplits.length > 0 && (
                        <View style={styles.dataColumn}>
                            <Text style={styles.sectionTitle}>Splits</Text>
                            {displaySplits.map((split, idx) => (
                                <View key={idx} style={styles.dataRow}>
                                    <Text style={styles.dataLabel}>{split.label}</Text>
                                    <Text style={styles.dataValue}>{split.pace}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {bestEfforts.length > 0 && (
                        <View style={styles.dataColumn}>
                            <Text style={styles.sectionTitle}>Best Efforts</Text>
                            {bestEfforts.map((effort, idx) => (
                                <View key={idx} style={styles.dataRow}>
                                    <Text style={styles.dataLabel}>{effort.name}</Text>
                                    <Text style={styles.dataValue}>
                                        {effort.pace}
                                        {effort.pr_rank && effort.pr_rank <= 3 ? ` PR#${effort.pr_rank}` : ''}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Small map at bottom */}
                {satelliteMapUrl && !stravaPhoto && null}
                {satelliteMapUrl && stravaPhoto && (
                    <View style={styles.mapContainer}>
                        <PdfImage src={satelliteMapUrl} sourceWidth={satW} sourceHeight={satH} />
                    </View>
                )}
            </View>
        </Page>
    )
}
