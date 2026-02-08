/**
 * RaceSectionEditorial - "Editorial" race variant (2-5 pages, adaptive)
 *
 * A rich, magazine-style multi-page treatment for races.
 * Pages are conditionally rendered based on data availability:
 *   1. Photo gallery / collage opening      (skip if no photos)
 *   2. Wide panoramic route map (satellite)  (skip if no map data)
 *   3. Race name + description + splits + optional inline comments (always)
 *   4. Best Efforts + Stats                  (always)
 *   5. Community / Comments                  (skip if inlined or no comments)
 */

import { Page, View, Text, StyleSheet, Font, Svg, Polyline } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import {
    resolveActivityLocation,
    formatDuration,
    formatPace,
    formatDistanceValue,
    formatElevation,
    processSplits,
    getMapboxSatelliteUrl,
} from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { PdfImage } from '@/components/pdf/PdfImage'
import { PdfImageCollection, CollectionPhoto } from '@/components/pdf/PdfImageCollection'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'
import { RaceDataViz } from '@/components/pdf/RaceDataViz'
import { BestEffortsTable } from '@/components/pdf/BestEffortsTable'
import mapboxPolyline from '@mapbox/polyline'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

// ============================================================================
// SHARED TYPES & HELPERS
// ============================================================================

/** Convert hex color to rgba string */
function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return `rgba(0,0,0,${opacity})`
    return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${opacity})`
}

interface RaceSectionEditorialProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

/** Extract all photos from activity data - uses shared extractPhotos utility */
const getPhotos = (activity: StravaActivity): CollectionPhoto[] => {
    return extractPhotos(activity).map(p => ({
        url: p.url,
        width: p.width,
        height: p.height,
    }))
}

/** Normalize polyline coordinates to SVG viewbox */
const normalizePoints = (encodedPolyline: string, width: number, height: number): string => {
    if (!encodedPolyline) return ''
    try {
        const decoded = mapboxPolyline.decode(encodedPolyline)
        if (!decoded || decoded.length === 0) return ''

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        decoded.forEach(([lat, lon]) => {
            if (lon < minX) minX = lon
            if (lon > maxX) maxX = lon
            if (lat < minY) minY = lat
            if (lat > maxY) maxY = lat
        })

        const rangeX = maxX - minX || 1
        const rangeY = maxY - minY || 1

        return decoded.map(([lat, lon]) => {
            const x = ((lon - minX) / rangeX) * width
            const y = height - ((lat - minY) / rangeY) * height
            return `${x},${y}`
        }).join(' ')
    } catch {
        return ''
    }
}

// ============================================================================
// PAGE 1: PHOTO GALLERY / COLLAGE OPENING
// ============================================================================

const P1PhotoGallery = ({
    activity,
    format,
    theme,
    highlightLabel,
}: RaceSectionEditorialProps) => {
    const caption = resolveTypography('caption', theme, format)
    const displaySmall = resolveTypography('displaySmall', theme, format)
    const spacing = resolveSpacing(theme, format)

    const photos = getPhotos(activity)
    const heroPhotos = photos.slice(0, 5)
    const location = resolveActivityLocation(activity)

    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const headerHeight = 70 * format.scaleFactor
    const photoAreaHeight = format.dimensions.height - (format.safeMargin * 2) - headerHeight - spacing.sm

    const dateStr = new Date(activity.start_date_local || activity.start_date)
        .toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })

    const styles = StyleSheet.create({
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
            height: headerHeight,
            marginBottom: spacing.sm,
        },
        labelText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.25,
        },
        raceName: {
            fontSize: displaySmall.fontSize,
            fontFamily: displaySmall.fontFamily,
            color: theme.primaryColor,
            lineHeight: 1.1,
            marginBottom: spacing.xs * 0.25,
        },
        locationText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '70',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        photoArea: {
            flex: 1,
            position: 'relative',
            borderRadius: 4 * format.scaleFactor,
            overflow: 'hidden',
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                <View style={styles.header}>
                    <Text style={styles.labelText}>{highlightLabel || dateStr}</Text>
                    <AutoResizingPdfText
                        text={activity.name}
                        width={contentWidth}
                        height={displaySmall.fontSize * 2}
                        font={displaySmall.fontFamily}
                        min_fontsize={displaySmall.minFontSize}
                        max_fontsize={displaySmall.fontSize}
                        h_align="left"
                        v_align="top"
                        textColor={theme.primaryColor}
                    />
                    {location && <Text style={styles.locationText}>{location}</Text>}
                </View>

                <View style={[styles.photoArea, { height: photoAreaHeight }]}>
                    {heroPhotos.length > 0 ? (
                        <PdfImageCollection
                            photos={heroPhotos}
                            containerWidth={contentWidth}
                            containerHeight={photoAreaHeight}
                            gap={6 * format.scaleFactor}
                            borderRadius={4 * format.scaleFactor}
                            placeholderColor={theme.surfaceColor}
                        />
                    ) : (
                        <View style={{ width: contentWidth, height: photoAreaHeight, backgroundColor: theme.primaryColor + '10' }} />
                    )}
                </View>
            </View>
        </Page>
    )
}

// ============================================================================
// PAGE 2: WIDE PANORAMIC ROUTE MAP (Mapbox satellite)
// ============================================================================

const P2PanoramicMap = ({
    activity,
    format,
    theme,
    mapboxToken,
}: RaceSectionEditorialProps) => {
    const caption = resolveTypography('caption', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const spacing = resolveSpacing(theme, format)

    const distanceKm = formatDistanceValue(activity.distance)
    const elevationM = formatElevation(activity.total_elevation_gain)

    const satW = Math.min(Math.round(format.dimensions.width * 2), 1280)
    const satH = Math.min(Math.round(format.dimensions.height * 2), 1280)
    const satelliteMapUrl = (mapboxToken && activity.map?.summary_polyline)
        ? resolveImageForPdf(getMapboxSatelliteUrl(
            activity.map.summary_polyline,
            mapboxToken,
            satW,
            satH,
        )) || undefined
        : undefined

    const hasSatellite = !!satelliteMapUrl
    const surfaceColor = theme.surfaceColor ?? hexToRgba(theme.primaryColor, 0.04)
    const borderColor = theme.borderColor ?? hexToRgba(theme.primaryColor, 0.12)
    const pageBg = hasSatellite ? theme.primaryColor : surfaceColor
    const textColor = hasSatellite ? theme.backgroundColor : theme.primaryColor
    const labelOpacity = hasSatellite ? '60' : '40'

    const styles = StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: pageBg,
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
        statsStrip: {
            flexDirection: 'row',
            justifyContent: 'flex-start',
            gap: spacing.lg,
            backgroundColor: hasSatellite ? theme.primaryColor : theme.backgroundColor,
            opacity: 0.9,
            borderRadius: 4 * format.scaleFactor,
            padding: spacing.md,
        },
        statItem: {
            alignItems: 'flex-start',
        },
        statValue: {
            fontSize: stat.fontSize,
            fontFamily: stat.fontFamily,
            color: theme.accentColor,
            marginBottom: 2,
        },
        statLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: textColor + '80',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        mapLabel: {
            position: 'absolute',
            top: format.safeMargin + spacing.xs,
            left: format.safeMargin + spacing.xs,
            fontSize: caption.fontSize * 0.8,
            fontFamily: caption.fontFamily,
            color: textColor + labelOpacity,
            textTransform: 'uppercase',
            letterSpacing: 2,
        },
    })

    const polyline = activity.map?.summary_polyline || ''
    const mapWidth = format.dimensions.width - (format.safeMargin * 2)
    const mapHeight = format.dimensions.height - (format.safeMargin * 2) - (80 * format.scaleFactor)
    const mapPoints = normalizePoints(polyline, mapWidth, mapHeight)

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            {satelliteMapUrl ? (
                <FullBleedBackground
                    image={satelliteMapUrl}
                    fallbackColor={theme.primaryColor}
                    role="background"
                    overlayOpacity={0.3}
                    width={format.dimensions.width}
                    height={format.dimensions.height}
                    sourceWidth={satW}
                    sourceHeight={satH}
                />
            ) : (
                /* SVG polyline fallback on light background */
                <View style={{ position: 'absolute', top: format.safeMargin, left: format.safeMargin, width: mapWidth, height: mapHeight }}>
                    <Svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
                        {/* Grid lines */}
                        {Array.from({ length: 8 }).map((_, i) => {
                            const y = (mapHeight / 8) * (i + 1)
                            return <Polyline key={`h${i}`} points={`0,${y} ${mapWidth},${y}`} stroke={borderColor} strokeWidth={0.5} />
                        })}
                        {Array.from({ length: 8 }).map((_, i) => {
                            const x = (mapWidth / 8) * (i + 1)
                            return <Polyline key={`v${i}`} points={`${x},0 ${x},${mapHeight}`} stroke={borderColor} strokeWidth={0.5} />
                        })}
                        {mapPoints && (
                            <Polyline
                                points={mapPoints}
                                stroke={theme.accentColor}
                                strokeWidth={4 * format.scaleFactor}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        )}
                    </Svg>
                </View>
            )}

            <Text style={styles.mapLabel}>Route Overview</Text>

            <View style={styles.contentContainer}>
                <View style={styles.statsStrip}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{distanceKm}</Text>
                        <Text style={styles.statLabel}>km</Text>
                    </View>
                    {activity.total_elevation_gain > 0 && (
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{elevationM}</Text>
                            <Text style={styles.statLabel}>elevation</Text>
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}

// ============================================================================
// PAGE 3: RACE NAME + DESCRIPTION + PHOTO + SPLITS CHART
// ============================================================================

const P3DescriptionSplits = ({
    activity,
    format,
    theme,
    inlineComments,
}: RaceSectionEditorialProps & { inlineComments?: Array<{ athlete: { firstname: string; lastname: string }; text: string; created_at: string }> }) => {
    const heading = resolveTypography('heading', theme, format)
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)

    const description = activity.description || ''
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)

    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0

    const photos = getPhotos(activity)
    const sidePhoto = photos.length > 0 ? photos[Math.min(1, photos.length - 1)] : null

    const dataVizHeight = 160 * format.scaleFactor
    const headerHeight = 60 * format.scaleFactor

    const styles = StyleSheet.create({
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
            height: headerHeight,
            marginBottom: spacing.sm,
        },
        sectionLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.25,
        },
        raceName: {
            fontSize: heading.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
            lineHeight: 1.15,
        },
        divider: {
            height: 3,
            backgroundColor: theme.accentColor,
            width: 60,
            marginBottom: spacing.md,
        },
        bodySection: {
            flex: 1,
            flexDirection: 'row',
            gap: spacing.md,
            marginBottom: spacing.md,
        },
        descriptionColumn: {
            flex: 1,
        },
        descriptionText: {
            fontSize: body.fontSize,
            fontFamily: body.fontFamily,
            color: theme.primaryColor,
            lineHeight: body.lineHeight ?? 1.5,
        },
        photoColumn: {
            width: '35%',
            borderRadius: 4 * format.scaleFactor,
            overflow: 'hidden',
            position: 'relative',
        },
        dataVizContainer: {
            borderTopWidth: 1,
            borderTopColor: theme.primaryColor + '20',
            paddingTop: spacing.sm,
        },
        dataVizLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '60',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: spacing.xs,
        },
    })

    const maxDescLength = sidePhoto ? 500 : 800
    const displayDesc = description.length > maxDescLength
        ? description.substring(0, maxDescLength) + '...'
        : description

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                <View style={styles.header}>
                    <Text style={styles.sectionLabel}>Race Story</Text>
                    <AutoResizingPdfText
                        text={activity.name}
                        width={contentWidth}
                        height={heading.fontSize * 2}
                        font={heading.fontFamily}
                        min_fontsize={heading.minFontSize}
                        max_fontsize={heading.fontSize}
                        h_align="left"
                        v_align="top"
                        textColor={theme.primaryColor}
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.bodySection}>
                    <View style={styles.descriptionColumn}>
                        {displayDesc ? (
                            <Text style={styles.descriptionText}>{displayDesc}</Text>
                        ) : (
                            <Text style={[styles.descriptionText, { color: theme.primaryColor + '40', fontStyle: 'italic' }]}>
                                No description provided for this activity.
                            </Text>
                        )}
                        {inlineComments && inlineComments.length > 0 && (
                            <View style={{ marginTop: spacing.md, borderTopWidth: 0.5, borderTopColor: theme.primaryColor + '15', paddingTop: spacing.sm }}>
                                <Text style={{ fontSize: caption.fontSize * 0.85, fontFamily: caption.fontFamily, color: theme.accentColor, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: spacing.xs }}>Comments</Text>
                                {inlineComments.map((comment, idx) => (
                                    <View key={idx} style={{ marginBottom: spacing.xs }}>
                                        <Text style={{ fontSize: caption.fontSize, fontFamily: heading.fontFamily, color: theme.primaryColor }}>
                                            {comment.athlete.firstname} {comment.athlete.lastname}
                                        </Text>
                                        <Text style={{ fontSize: body.fontSize * 0.9, fontFamily: body.fontFamily, color: theme.primaryColor + 'CC', lineHeight: 1.4 }}>
                                            {comment.text.substring(0, 200)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    {sidePhoto && (
                        <View style={styles.photoColumn}>
                            <PdfImage
                                src={sidePhoto.url}
                                containerWidth={contentWidth * 0.35}
                                containerHeight={200 * format.scaleFactor}
                                sourceWidth={sidePhoto.width}
                                sourceHeight={sidePhoto.height}
                            />
                        </View>
                    )}
                </View>

                {hasSplits && (
                    <View style={styles.dataVizContainer}>
                        <Text style={styles.dataVizLabel}>Split Analysis</Text>
                        <RaceDataViz
                            splits={splits.map((s, i) => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const split = s as any
                                return {
                                    split: split.split ?? i + 1,
                                    moving_time: s.moving_time,
                                    distance: s.distance,
                                    elevation_difference: split.elevation_difference ?? split.total_elevation_gain ?? 0,
                                }
                            })}
                            totalTime={activity.moving_time}
                            width={contentWidth}
                            height={dataVizHeight}
                            showSplits={true}
                            showElevation={true}
                            theme={theme}
                        />
                    </View>
                )}
            </View>
        </Page>
    )
}

// ============================================================================
// PAGE 4: BEST EFFORTS + STATS
// ============================================================================

const P5Stats = ({
    activity,
    format,
    theme,
}: RaceSectionEditorialProps) => {
    const heading = resolveTypography('heading', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)

    const distanceKm = formatDistanceValue(activity.distance)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance)
    const elevationM = formatElevation(activity.total_elevation_gain)
    const displaySplits = processSplits(activity, 6)

    const styles = StyleSheet.create({
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
        sectionLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.25,
        },
        title: {
            fontSize: heading.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
        },
        statsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: spacing.md,
            borderTopWidth: 2,
            borderTopColor: theme.primaryColor,
            borderBottomWidth: 1,
            borderBottomColor: theme.primaryColor + '20',
            marginBottom: spacing.md,
        },
        statItem: {
            alignItems: 'center',
            flex: 1,
        },
        statValue: {
            fontSize: stat.fontSize,
            fontFamily: stat.fontFamily,
            color: theme.accentColor,
            marginBottom: 2,
        },
        statLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '60',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        dataColumns: {
            flex: 1,
            flexDirection: 'row',
            gap: spacing.md,
        },
        dataColumn: {
            flex: 1,
        },
        columnTitle: {
            fontSize: caption.fontSize,
            fontFamily: heading.fontFamily,
            textTransform: 'uppercase',
            color: theme.primaryColor,
            borderBottomWidth: 1.5,
            borderBottomColor: theme.accentColor,
            paddingBottom: 4 * format.scaleFactor,
            letterSpacing: 1.5,
            marginBottom: spacing.sm,
        },
        splitRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 3 * format.scaleFactor,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.primaryColor + '15',
        },
        splitLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '80',
        },
        splitValue: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor,
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                <View style={styles.header}>
                    <Text style={styles.sectionLabel}>Performance</Text>
                    <Text style={styles.title}>Race Statistics</Text>
                </View>

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
                            <Text style={styles.statLabel}>elevation</Text>
                        </View>
                    )}
                </View>

                <View style={styles.dataColumns}>
                    {displaySplits.length > 0 && (
                        <View style={styles.dataColumn}>
                            <Text style={styles.columnTitle}>Fastest Splits</Text>
                            {displaySplits
                                .sort((a, b) => {
                                    // Sort by moving_time (lower = faster) for same-distance splits
                                    return a.moving_time - b.moving_time
                                })
                                .slice(0, 6)
                                .map((split, idx) => (
                                    <View key={idx} style={styles.splitRow}>
                                        <Text style={styles.splitLabel}>{split.label}</Text>
                                        <Text style={styles.splitValue}>{split.pace}</Text>
                                    </View>
                                ))}
                        </View>
                    )}

                    <View style={styles.dataColumn}>
                        <BestEffortsTable
                            activity={activity}
                            format={format}
                            theme={theme}
                            maxEfforts={displaySplits.length > 0 ? 8 : 14}
                        />
                    </View>
                </View>
            </View>
        </Page>
    )
}

// ============================================================================
// PAGE 6: COMMUNITY / COMMENTS
// ============================================================================

const P6Comments = ({
    activity,
    format,
    theme,
}: RaceSectionEditorialProps) => {
    const heading = resolveTypography('heading', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const body = resolveTypography('body', theme, format)
    const spacing = resolveSpacing(theme, format)

    const comments = activity.comprehensiveData?.comments || activity.comments || []
    const sortedComments = [...comments]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const displayComments = sortedComments.slice(0, 8)

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    const styles = StyleSheet.create({
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
        sectionLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.25,
        },
        title: {
            fontSize: heading.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
        },
        kudosBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.accentColor,
            padding: spacing.sm,
            borderRadius: 6 * format.scaleFactor,
            marginBottom: spacing.md,
        },
        kudosEmoji: {
            fontSize: Math.max(24, 32 * format.scaleFactor),
            marginRight: spacing.sm,
        },
        kudosCount: {
            fontSize: Math.max(20, 26 * format.scaleFactor),
            fontFamily: heading.fontFamily,
            color: theme.textOverAccent ?? theme.backgroundColor,
        },
        kudosLabel: {
            fontSize: caption.fontSize,
            fontFamily: body.fontFamily,
            color: hexToRgba(theme.textOverAccent ?? theme.backgroundColor, 0.8),
            marginLeft: spacing.xs,
        },
        commentsContainer: {
            flex: 1,
            flexDirection: 'row',
            gap: spacing.md,
        },
        commentsColumn: {
            flex: 1,
        },
        comment: {
            marginBottom: spacing.sm,
            paddingBottom: spacing.sm,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.primaryColor + '15',
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4 * format.scaleFactor,
        },
        commentAuthor: {
            fontSize: caption.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
        },
        commentDate: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '50',
        },
        commentText: {
            fontSize: body.fontSize * 0.9,
            fontFamily: body.fontFamily,
            color: theme.primaryColor + 'CC',
            lineHeight: 1.4,
        },
        noComments: {
            fontSize: body.fontSize,
            fontFamily: body.fontFamily,
            color: theme.primaryColor + '40',
            textAlign: 'center',
            marginTop: spacing.xl,
            fontStyle: 'italic',
        },
        moreComments: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '50',
            marginTop: spacing.xs,
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                <View style={styles.header}>
                    <Text style={styles.sectionLabel}>Community</Text>
                    <Text style={styles.title}>Support & Comments</Text>
                </View>

                {activity.kudos_count > 0 && (
                    <View style={styles.kudosBanner}>
                        <Text style={styles.kudosEmoji}>{'👍'}</Text>
                        <Text style={styles.kudosCount}>{activity.kudos_count}</Text>
                        <Text style={styles.kudosLabel}>people gave you kudos</Text>
                    </View>
                )}

                <View style={styles.commentsContainer}>
                    {displayComments.length > 0 ? (
                        <>
                            <View style={styles.commentsColumn}>
                                {displayComments.slice(0, Math.ceil(displayComments.length / 2)).map((comment, idx) => (
                                    <View key={idx} style={styles.comment}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentAuthor}>
                                                {comment.athlete.firstname} {comment.athlete.lastname}
                                            </Text>
                                            <Text style={styles.commentDate}>
                                                {formatDate(comment.created_at)}
                                            </Text>
                                        </View>
                                        <Text style={styles.commentText}>
                                            {comment.text.substring(0, 200)}{comment.text.length > 200 ? '...' : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.commentsColumn}>
                                {displayComments.slice(Math.ceil(displayComments.length / 2)).map((comment, idx) => (
                                    <View key={idx} style={styles.comment}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentAuthor}>
                                                {comment.athlete.firstname} {comment.athlete.lastname}
                                            </Text>
                                            <Text style={styles.commentDate}>
                                                {formatDate(comment.created_at)}
                                            </Text>
                                        </View>
                                        <Text style={styles.commentText}>
                                            {comment.text.substring(0, 200)}{comment.text.length > 200 ? '...' : ''}
                                        </Text>
                                    </View>
                                ))}
                                {sortedComments.length > displayComments.length && (
                                    <Text style={styles.moreComments}>
                                        +{sortedComments.length - displayComments.length} more comments
                                    </Text>
                                )}
                            </View>
                        </>
                    ) : (
                        <Text style={styles.noComments}>
                            No comments on this activity yet.
                        </Text>
                    )}
                </View>
            </View>
        </Page>
    )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export const RaceSectionEditorialPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionEditorialProps) => {
    const props = { activity, format, theme, mapboxToken, highlightLabel }

    // Determine what data is available
    const photos = getPhotos(activity)
    const hasPhotos = photos.length > 0
    const hasMap = !!(mapboxToken && activity.map?.summary_polyline)
    const comments = activity.comprehensiveData?.comments || activity.comments || []
    const description = activity.description || ''

    // Inline comments on P3 when few comments and short description
    const shouldInlineComments = comments.length <= 3 && description.length < 300
    const showCommentsPage = comments.length > 0 && !shouldInlineComments

    return (
        <>
            {/* Page 1: Photo Gallery — skip if no photos */}
            {hasPhotos && <P1PhotoGallery {...props} />}

            {/* Page 2: Panoramic Satellite Map — skip if no map data */}
            {hasMap && <P2PanoramicMap {...props} />}

            {/* Page 3: Description + Splits (+ inline comments when short) */}
            <P3DescriptionSplits {...props} inlineComments={shouldInlineComments ? comments : undefined} />

            {/* Page 4: Stats + Best Efforts — always show */}
            <P5Stats {...props} />

            {/* Page 5: Community Comments — skip when inlined or no comments */}
            {showCommentsPage && <P6Comments {...props} />}
        </>
    )
}
