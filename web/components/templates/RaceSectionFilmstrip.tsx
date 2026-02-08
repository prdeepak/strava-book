/**
 * RaceSectionFilmstrip - "Filmstrip" race variant (3-4 pages, adaptive)
 *
 * A cinematic, spread-oriented layout featuring a filmstrip photo strip:
 *   Pages 1+2 (Spread A - Journey): Satellite map hero + title overlay + two-column description + filmstrip
 *   Page 3 (optional): Hero photo (top 2/3) + BestEffortsTable (bottom 1/3)
 *   Page 4: Splits chart + comments
 *
 * Conditional rendering:
 *   - Pages 1-2: Always rendered (map optional, falls back to SVG polyline)
 *   - Page 3: Skip if no photos AND no best_efforts
 *   - Page 4: Always rendered
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
    getMapboxSatelliteUrl,
} from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { PdfImage } from '@/components/pdf/PdfImage'
import { PdfFilmstrip, FilmstripPhoto } from '@/components/pdf/PdfFilmstrip'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'
import { RaceDataViz } from '@/components/pdf/RaceDataViz'
import { BestEffortsTable } from '@/components/pdf/BestEffortsTable'
import { CollectionPhoto } from '@/components/pdf/PdfImageCollection'
import mapboxPolyline from '@mapbox/polyline'

Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

// ============================================================================
// SHARED TYPES & HELPERS
// ============================================================================

function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return `rgba(0,0,0,${opacity})`
    return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${opacity})`
}

interface RaceSectionFilmstripProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

const getPhotos = (activity: StravaActivity): CollectionPhoto[] => {
    return extractPhotos(activity).map(p => ({
        url: p.url,
        width: p.width,
        height: p.height,
    }))
}

const normalizePoints = (encodedPolyline: string, width: number, height: number): string => {
    if (!encodedPolyline) return ''
    try {
        const decoded = mapboxPolyline.decode(encodedPolyline)
        if (!decoded || decoded.length === 0) return ''
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        decoded.forEach(([lat, lon]) => {
            if (lon < minX) minX = lon; if (lon > maxX) maxX = lon
            if (lat < minY) minY = lat; if (lat > maxY) maxY = lat
        })
        const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1
        const padX = rangeX * 0.1, padY = rangeY * 0.1
        return decoded.map(([lat, lon]) => {
            const x = ((lon - minX + padX) / (rangeX + padX * 2)) * width
            const y = height - ((lat - minY + padY) / (rangeY + padY * 2)) * height
            return `${x},${y}`
        }).join(' ')
    } catch { return '' }
}

// ============================================================================
// PAGE 1: JOURNEY LEFT — Map + Title + Description (left half of spread)
// ============================================================================

const P1JourneyLeft = ({
    activity,
    format,
    theme,
    mapboxToken,
    description,
}: RaceSectionFilmstripProps & { description: string }) => {
    const displaySmall = resolveTypography('displaySmall', theme, format)
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const spacing = resolveSpacing(theme, format)
    const effects = resolveEffects(theme)

    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const mapHeight = format.dimensions.height * 0.48

    const polyline = activity.map?.summary_polyline || ''
    const hasSatellite = !!(mapboxToken && polyline)
    const satW = Math.min(Math.round(format.dimensions.width * 2), 1280)
    const satH = Math.min(Math.round(mapHeight * 2), 1280)
    const satelliteMapUrl = hasSatellite
        ? resolveImageForPdf(getMapboxSatelliteUrl(polyline, mapboxToken, satW, satH)) || undefined
        : undefined

    const surfaceColor = theme.surfaceColor ?? hexToRgba(theme.primaryColor, 0.04)
    const borderColor = theme.borderColor ?? hexToRgba(theme.primaryColor, 0.12)

    const distanceKm = formatDistanceValue(activity.distance)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance)
    const elevationM = formatElevation(activity.total_elevation_gain)
    const location = resolveActivityLocation(activity)

    // Split description for two columns — only show first portion on page 1
    const words = description.split(/\s+/)
    const midPoint = Math.ceil(words.length * 0.45)
    const col1Text = words.slice(0, midPoint).join(' ')

    const mapPoints = polyline ? normalizePoints(polyline, contentWidth, mapHeight - format.safeMargin) : ''

    const styles = StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: 0,
            position: 'relative',
        },
        mapContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: format.dimensions.width,
            height: mapHeight,
            overflow: 'hidden',
            backgroundColor: hasSatellite ? theme.primaryColor : surfaceColor,
        },
        titleOverlay: {
            position: 'absolute',
            left: format.safeMargin,
            bottom: spacing.md,
            padding: spacing.sm,
            backgroundColor: hexToRgba(theme.primaryColor, effects.textOverlayOpacity),
            maxWidth: contentWidth * 0.7,
        },
        titleText: {
            color: theme.backgroundColor,
            marginBottom: spacing.xs * 0.5,
        },
        locationText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.5,
        },
        statsRow: {
            flexDirection: 'row',
            gap: spacing.md,
        },
        statItem: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 3,
        },
        statValue: {
            fontSize: stat.fontSize * 0.55,
            fontFamily: stat.fontFamily,
            color: theme.backgroundColor,
        },
        statLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor + '80',
            textTransform: 'uppercase',
        },
        contentContainer: {
            position: 'absolute',
            top: mapHeight + spacing.sm,
            left: format.safeMargin,
            right: format.safeMargin,
            bottom: format.safeMargin,
        },
        sectionLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs,
        },
        divider: {
            height: 3,
            backgroundColor: theme.accentColor,
            width: 50 * format.scaleFactor,
            marginBottom: spacing.sm,
        },
        descriptionText: {
            fontSize: body.fontSize,
            fontFamily: body.fontFamily,
            color: theme.primaryColor,
            lineHeight: body.lineHeight ?? 1.5,
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            {/* Map area */}
            <View style={styles.mapContainer}>
                {satelliteMapUrl ? (
                    <PdfImage
                        src={satelliteMapUrl}
                        containerWidth={format.dimensions.width}
                        containerHeight={mapHeight}
                        sourceWidth={satW}
                        sourceHeight={satH}
                    />
                ) : polyline ? (
                    <View style={{ position: 'absolute', top: format.safeMargin * 0.5, left: format.safeMargin, width: contentWidth, height: mapHeight - format.safeMargin }}>
                        <Svg width={contentWidth} height={mapHeight - format.safeMargin} viewBox={`0 0 ${contentWidth} ${mapHeight - format.safeMargin}`}>
                            {Array.from({ length: 6 }).map((_, i) => {
                                const y = ((mapHeight - format.safeMargin) / 6) * (i + 1)
                                return <Polyline key={`h${i}`} points={`0,${y} ${contentWidth},${y}`} stroke={borderColor} strokeWidth={0.5} />
                            })}
                            {mapPoints && (
                                <Polyline
                                    points={mapPoints}
                                    stroke={theme.accentColor}
                                    strokeWidth={3 * format.scaleFactor}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            )}
                        </Svg>
                    </View>
                ) : null}

                {/* Title overlay on map */}
                <View style={styles.titleOverlay}>
                    {location && <Text style={styles.locationText}>{location}</Text>}
                    <AutoResizingPdfText
                        text={activity.name}
                        width={contentWidth * 0.65}
                        height={displaySmall.fontSize * 2}
                        font={displaySmall.fontFamily}
                        min_fontsize={displaySmall.minFontSize}
                        max_fontsize={displaySmall.fontSize}
                        h_align="left"
                        v_align="top"
                        textColor={theme.backgroundColor}
                    />
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
                </View>
            </View>

            {/* Description below map */}
            <View style={styles.contentContainer}>
                <Text style={styles.sectionLabel}>Race Report</Text>
                <View style={styles.divider} />
                {col1Text ? (
                    <Text style={styles.descriptionText}>{col1Text}</Text>
                ) : (
                    <Text style={[styles.descriptionText, { color: theme.primaryColor + '40', fontStyle: 'italic' }]}>
                        A race to remember.
                    </Text>
                )}
            </View>
        </Page>
    )
}

// ============================================================================
// PAGE 2: JOURNEY RIGHT — Map + Description continuation + Filmstrip
// ============================================================================

const P2JourneyRight = ({
    activity,
    format,
    theme,
    mapboxToken,
    description,
    photos,
}: RaceSectionFilmstripProps & { description: string; photos: CollectionPhoto[] }) => {
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)

    const filmstripWidth = 70 * format.scaleFactor
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const textWidth = contentWidth - filmstripWidth - spacing.sm
    const mapHeight = format.dimensions.height * 0.48

    const polyline = activity.map?.summary_polyline || ''
    const hasSatellite = !!(mapboxToken && polyline)
    const satW = Math.min(Math.round(format.dimensions.width * 2), 1280)
    const satH = Math.min(Math.round(mapHeight * 2), 1280)
    const satelliteMapUrl = hasSatellite
        ? resolveImageForPdf(getMapboxSatelliteUrl(polyline, mapboxToken, satW, satH)) || undefined
        : undefined

    const surfaceColor = theme.surfaceColor ?? hexToRgba(theme.primaryColor, 0.04)
    const borderColor = theme.borderColor ?? hexToRgba(theme.primaryColor, 0.12)

    // Second portion of description
    const words = description.split(/\s+/)
    const midPoint = Math.ceil(words.length * 0.45)
    const col2Text = words.slice(midPoint).join(' ')

    const mapPoints = polyline ? normalizePoints(polyline, contentWidth, mapHeight - format.safeMargin) : ''

    const dateStr = new Date(activity.start_date_local || activity.start_date)
        .toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })

    const filmstripPhotos: FilmstripPhoto[] = photos.map(p => ({
        url: p.url,
        width: p.width,
        height: p.height,
    }))

    const filmstripHeight = format.dimensions.height - (format.safeMargin * 2)

    const styles = StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: 0,
            position: 'relative',
        },
        mapContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: format.dimensions.width,
            height: mapHeight,
            overflow: 'hidden',
            backgroundColor: hasSatellite ? theme.primaryColor : surfaceColor,
        },
        contentContainer: {
            position: 'absolute',
            top: mapHeight + spacing.sm,
            left: format.safeMargin,
            right: format.safeMargin,
            bottom: format.safeMargin,
            flexDirection: 'row',
            gap: spacing.sm,
        },
        textColumn: {
            width: textWidth,
        },
        descriptionText: {
            fontSize: body.fontSize,
            fontFamily: body.fontFamily,
            color: theme.primaryColor,
            lineHeight: body.lineHeight ?? 1.5,
        },
        dateText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '60',
            marginTop: spacing.sm,
        },
        filmstripContainer: {
            position: 'absolute',
            top: format.safeMargin,
            right: format.safeMargin,
            width: filmstripWidth,
            height: filmstripHeight,
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            {/* Map area */}
            <View style={styles.mapContainer}>
                {satelliteMapUrl ? (
                    <PdfImage
                        src={satelliteMapUrl}
                        containerWidth={format.dimensions.width}
                        containerHeight={mapHeight}
                        sourceWidth={satW}
                        sourceHeight={satH}
                    />
                ) : polyline ? (
                    <View style={{ position: 'absolute', top: format.safeMargin * 0.5, left: format.safeMargin, width: contentWidth, height: mapHeight - format.safeMargin }}>
                        <Svg width={contentWidth} height={mapHeight - format.safeMargin} viewBox={`0 0 ${contentWidth} ${mapHeight - format.safeMargin}`}>
                            {Array.from({ length: 6 }).map((_, i) => {
                                const y = ((mapHeight - format.safeMargin) / 6) * (i + 1)
                                return <Polyline key={`h${i}`} points={`0,${y} ${contentWidth},${y}`} stroke={borderColor} strokeWidth={0.5} />
                            })}
                            {mapPoints && (
                                <Polyline
                                    points={mapPoints}
                                    stroke={theme.accentColor}
                                    strokeWidth={3 * format.scaleFactor}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            )}
                        </Svg>
                    </View>
                ) : null}
            </View>

            {/* Description text below map */}
            <View style={styles.contentContainer}>
                <View style={styles.textColumn}>
                    {col2Text && (
                        <Text style={styles.descriptionText}>{col2Text}</Text>
                    )}
                    <Text style={styles.dateText}>{dateStr}</Text>
                </View>
            </View>

            {/* Filmstrip on right edge */}
            {filmstripPhotos.length > 0 && (
                <View style={styles.filmstripContainer}>
                    <PdfFilmstrip
                        photos={filmstripPhotos}
                        width={filmstripWidth}
                        height={filmstripHeight}
                        orientation="vertical"
                        format={format}
                        theme={theme}
                    />
                </View>
            )}
        </Page>
    )
}

// ============================================================================
// PAGE 3: HERO PHOTO + BEST EFFORTS
// ============================================================================

const P3HeroBestEfforts = ({
    activity,
    format,
    theme,
    photos,
}: RaceSectionFilmstripProps & { photos: CollectionPhoto[] }) => {
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)

    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const contentHeight = format.dimensions.height - (format.safeMargin * 2)
    const heroHeight = contentHeight * 0.65
    const bestEffortsHeight = contentHeight * 0.35 - spacing.sm

    const heroPhoto = photos.length > 0 ? photos[0] : null
    const hasHero = !!heroPhoto
    const hasBestEfforts = (activity.best_efforts?.length ?? 0) > 0

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
        heroContainer: {
            width: contentWidth,
            height: hasHero ? heroHeight : 0,
            overflow: 'hidden',
            position: 'relative',
            borderRadius: 4 * format.scaleFactor,
            marginBottom: hasHero ? spacing.sm : 0,
        },
        photoLabel: {
            position: 'absolute',
            bottom: spacing.xs,
            left: spacing.xs,
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.backgroundColor + '90',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
        },
        bestEffortsContainer: {
            flex: 1,
            minHeight: bestEffortsHeight,
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                {hasHero && (
                    <View style={styles.heroContainer}>
                        <PdfImage
                            src={heroPhoto.url}
                            containerWidth={contentWidth}
                            containerHeight={heroHeight}
                            sourceWidth={heroPhoto.width}
                            sourceHeight={heroPhoto.height}
                            borderRadius={4 * format.scaleFactor}
                        />
                        <Text style={styles.photoLabel}>Race Day</Text>
                    </View>
                )}

                {hasBestEfforts && (
                    <View style={styles.bestEffortsContainer}>
                        <BestEffortsTable
                            activity={activity}
                            format={format}
                            theme={theme}
                            maxEfforts={12}
                        />
                    </View>
                )}
            </View>
        </Page>
    )
}

// ============================================================================
// PAGE 4: SPLITS + COMMENTS
// ============================================================================

const P4DataCommunity = ({
    activity,
    format,
    theme,
}: RaceSectionFilmstripProps) => {
    const heading = resolveTypography('heading', theme, format)
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const subheading = resolveTypography('subheading', theme, format)
    const spacing = resolveSpacing(theme, format)

    const contentWidth = format.dimensions.width - (format.safeMargin * 2)

    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0
    const chartHeight = 160 * format.scaleFactor

    const comments = activity.comprehensiveData?.comments || activity.comments || []
    const sortedComments = [...comments]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const displayComments = sortedComments.slice(0, 8)
    const kudos = activity.kudos_count || 0

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
        splitsSection: {
            marginBottom: spacing.md,
        },
        sectionTitle: {
            fontSize: subheading.fontSize * 0.85,
            fontFamily: subheading.fontFamily,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.sm,
        },
        communitySection: {
            flex: 1,
        },
        communityHeader: {
            fontSize: heading.fontSize * 0.8,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
            marginBottom: spacing.xs,
        },
        kudosBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.accentColor,
            padding: spacing.xs,
            borderRadius: 6 * format.scaleFactor,
            marginBottom: spacing.sm,
        },
        kudosEmoji: {
            fontSize: caption.fontSize * 1.5,
            marginRight: spacing.xs * 0.5,
        },
        kudosCountText: {
            fontSize: subheading.fontSize * 0.9,
            fontFamily: heading.fontFamily,
            color: theme.textOverAccent ?? theme.backgroundColor,
        },
        kudosLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: body.fontFamily,
            color: hexToRgba(theme.textOverAccent ?? theme.backgroundColor, 0.8),
            marginLeft: spacing.xs * 0.5,
        },
        commentsContainer: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        commentsColumn: {
            flex: 1,
        },
        comment: {
            marginBottom: spacing.xs,
            paddingBottom: spacing.xs,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.borderColor ?? theme.primaryColor + '20',
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 3 * format.scaleFactor,
        },
        commentAuthor: {
            fontSize: caption.fontSize * 0.9,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
        },
        commentDate: {
            fontSize: caption.fontSize * 0.75,
            fontFamily: body.fontFamily,
            color: theme.primaryColor + '99',
        },
        commentText: {
            fontSize: caption.fontSize * 0.9,
            fontFamily: body.fontFamily,
            color: theme.primaryColor + 'CC',
            lineHeight: 1.4,
        },
    })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                {/* Splits chart */}
                {hasSplits && (
                    <View style={styles.splitsSection}>
                        <Text style={styles.sectionTitle}>Kilometer Split</Text>
                        <RaceDataViz
                            splits={splits.map((sp, i) => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const spl = sp as any
                                return {
                                    split: spl.split ?? i + 1,
                                    moving_time: sp.moving_time,
                                    distance: sp.distance,
                                    elevation_difference: spl.elevation_difference ?? spl.total_elevation_gain ?? 0,
                                }
                            })}
                            totalTime={activity.moving_time}
                            width={contentWidth}
                            height={chartHeight}
                            showSplits={true}
                            showElevation={true}
                            theme={theme}
                        />
                    </View>
                )}

                {/* Community section */}
                <View style={styles.communitySection}>
                    <Text style={styles.sectionTitle}>Community</Text>
                    <Text style={styles.communityHeader}>Support & Comments</Text>

                    {kudos > 0 && (
                        <View style={styles.kudosBanner}>
                            <Text style={styles.kudosEmoji}>{'👍'}</Text>
                            <Text style={styles.kudosCountText}>{kudos}</Text>
                            <Text style={styles.kudosLabel}>people gave you kudos</Text>
                        </View>
                    )}

                    {displayComments.length > 0 && (
                        <View style={styles.commentsContainer}>
                            <View style={styles.commentsColumn}>
                                {displayComments.slice(0, Math.ceil(displayComments.length / 2)).map((c, i) => (
                                    <View key={i} style={styles.comment}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentAuthor}>{c.athlete.firstname} {c.athlete.lastname}</Text>
                                            <Text style={styles.commentDate}>{formatDate(c.created_at)}</Text>
                                        </View>
                                        <Text style={styles.commentText}>
                                            {c.text.length > 150 ? c.text.substring(0, 150) + '...' : c.text}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.commentsColumn}>
                                {displayComments.slice(Math.ceil(displayComments.length / 2)).map((c, i) => (
                                    <View key={i} style={styles.comment}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentAuthor}>{c.athlete.firstname} {c.athlete.lastname}</Text>
                                            <Text style={styles.commentDate}>{formatDate(c.created_at)}</Text>
                                        </View>
                                        <Text style={styles.commentText}>
                                            {c.text.length > 150 ? c.text.substring(0, 150) + '...' : c.text}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export const RaceSectionFilmstripPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionFilmstripProps) => {
    const props = { activity, format, theme, mapboxToken, highlightLabel }

    const photos = getPhotos(activity)
    const description = activity.description || ''
    const hasPhotos = photos.length > 0
    const hasBestEfforts = (activity.best_efforts?.length ?? 0) > 0
    const showPage3 = hasPhotos || hasBestEfforts

    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0
    const comments = activity.comprehensiveData?.comments || activity.comments || []
    const hasComments = comments.length > 0
    const kudos = activity.kudos_count || 0
    const showPage4 = hasSplits || hasComments || kudos > 0

    return (
        <>
            {/* Pages 1+2: Journey spread (always) */}
            <P1JourneyLeft {...props} description={description} />
            <P2JourneyRight {...props} description={description} photos={photos} />

            {/* Page 3: Hero photo + Best Efforts (skip if no photos AND no best_efforts) */}
            {showPage3 && <P3HeroBestEfforts {...props} photos={photos} />}

            {/* Page 4: Data & Community (skip if no splits, no comments, no kudos) */}
            {showPage4 && <P4DataCommunity {...props} />}
        </>
    )
}
