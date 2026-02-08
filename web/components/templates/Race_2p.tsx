/**
 * Race_2p - Enhanced Two-Page Race Template
 *
 * Page 1: Hero photo with race name, date, location, key stats overlay
 * Page 2: Splits chart, elevation profile, map, kudos/comments summary
 *
 * Features:
 * - Multi-photo gallery support (hero + thumbnails)
 * - Splits visualization with pace bars
 * - Elevation profile
 * - Kudos count and top comments
 * - Light Mapbox map style for print quality
 */

import { Document, Page, View, Text, StyleSheet, Svg, Polyline } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { formatTime, formatPace, formatDistance, resolveActivityLocation } from '@/lib/activity-utils'
import { getMapboxLightUrl } from '@/lib/activity-utils'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { SplitsChartSVG, SplitData } from '@/lib/generateSplitsChart'
import { resolveSpacing } from '@/lib/typography'
import mapboxPolyline from '@mapbox/polyline'
import { PdfImage } from '@/components/pdf/PdfImage'

// ============================================================================
// TYPES
// ============================================================================

export type Race2pVariant = 'hero-stats' | 'gallery-splits' | 'minimal'

export interface Race2pProps {
    activity: StravaActivity
    format?: BookFormat
    theme?: BookTheme
    mapboxToken?: string
    variant?: Race2pVariant
    units?: 'metric' | 'imperial'
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        // Page 1 - Hero
        heroPage: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            position: 'relative',
            padding: 0,
        },
        // Hero image container - PdfImage handles positioning
        heroImageContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
        },
        heroOverlay: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: format.safeMargin,
            paddingTop: spacing.xl,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        },
        heroGradient: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            backgroundColor: 'rgba(0,0,0,0.7)',
        },
        heroContent: {
            position: 'absolute',
            bottom: format.safeMargin,
            left: format.safeMargin,
            right: format.safeMargin,
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: spacing.md,
            paddingTop: spacing.sm + spacing.xs * 0.5,
        },
        heroLabel: {
            color: theme.accentColor,
            fontSize: Math.max(12, 14 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            textTransform: 'uppercase',
            letterSpacing: 3,
            marginBottom: spacing.sm * 0.75,
        },
        heroTitle: {
            color: theme.backgroundColor,
            fontSize: Math.max(32, 42 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            marginBottom: spacing.sm * 0.75,
            lineHeight: 1.15,
        },
        heroMeta: {
            color: theme.backgroundColor + 'E6',
            fontSize: Math.max(14, 16 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            marginBottom: spacing.sm + spacing.xs * 0.5,
            letterSpacing: 0.5,
        },
        heroStatsRow: {
            flexDirection: 'row',
            gap: spacing.lg * 0.67,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.backgroundColor + '4D',
        },
        heroStat: {
            alignItems: 'flex-start',
        },
        heroStatValue: {
            color: theme.backgroundColor,
            fontSize: Math.max(28, 36 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
        },
        heroStatLabel: {
            color: theme.backgroundColor + 'BF',
            fontSize: Math.max(10, 12 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: spacing.xs * 0.5,
        },

        // Page 2 - Stats
        statsPage: {
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
        statsHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: spacing.sm,
            paddingBottom: spacing.sm * 0.75,
            borderBottomWidth: 3,
            borderBottomColor: theme.accentColor,
        },
        statsTitle: {
            fontSize: Math.max(20, 26 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
        },
        statsSubtitle: {
            fontSize: Math.max(10, 12 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor + '99',
        },
        sectionTitle: {
            fontSize: Math.max(11, 13 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs + 2,
            marginTop: spacing.sm,
            paddingBottom: spacing.xs * 0.5,
            borderBottomWidth: 1,
            borderBottomColor: theme.borderColor ?? (theme.primaryColor + '20'),
        },
        mapContainer: {
            height: 200 * format.scaleFactor,
            backgroundColor: theme.surfaceColor ?? theme.primaryColor + '08',
            marginBottom: spacing.sm,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.borderColor ?? (theme.primaryColor + '20'),
            position: 'relative',
        },
        chartContainer: {
            height: 160 * format.scaleFactor,
            backgroundColor: theme.surfaceColor ?? theme.primaryColor + '08',
            marginBottom: spacing.sm,
            padding: spacing.sm * 0.75,
            borderWidth: 1,
            borderColor: theme.borderColor ?? (theme.primaryColor + '20'),
        },
        quickStatsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            backgroundColor: theme.primaryColor,
            padding: spacing.sm,
            marginBottom: spacing.sm,
        },
        quickStat: {
            alignItems: 'center',
        },
        quickStatValue: {
            color: theme.backgroundColor,
            fontSize: Math.max(20, 24 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
        },
        quickStatLabel: {
            color: theme.backgroundColor + 'CC',
            fontSize: Math.max(8, 9 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: spacing.xs * 0.5,
        },
        socialSection: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginTop: 'auto',
            paddingTop: spacing.sm,
            borderTopWidth: 2,
            borderTopColor: theme.borderColor ?? (theme.primaryColor + '20'),
        },
        kudosContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        kudosCount: {
            fontSize: Math.max(18, 22 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.accentColor,
        },
        kudosLabel: {
            fontSize: Math.max(9, 10 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor + '99',
            textTransform: 'uppercase',
        },
        commentsContainer: {
            flex: 1,
            marginLeft: spacing.md,
        },
        comment: {
            marginBottom: spacing.xs * 0.75,
        },
        commentAuthor: {
            fontSize: Math.max(8, 9 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor + 'CC',
        },
        commentText: {
            fontSize: Math.max(8, 9 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor + '99',
            fontStyle: 'italic',
        },
        thumbnailStrip: {
            flexDirection: 'row',
            gap: spacing.xs,
            marginTop: spacing.sm * 0.75,
        },
        thumbnailContainer: {
            width: 60 * format.scaleFactor,
            height: 60 * format.scaleFactor,
            overflow: 'hidden',
            position: 'relative',
        },
        noPhotoPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: theme.primaryColor,
            justifyContent: 'center',
            alignItems: 'center',
        },
        placeholderText: {
            color: theme.backgroundColor,
            fontSize: Math.max(24, 32 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            textAlign: 'center',
        },
        noMapText: {
            color: theme.primaryColor + '60',
            textAlign: 'center',
            marginTop: 80 * format.scaleFactor,
        },
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })
}

function normalizePolylineToSvg(encodedPolyline: string, width: number, height: number): string {
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

        const rangeX = maxX - minX || 0.001
        const rangeY = maxY - minY || 0.001

        const padding = 10
        const plotWidth = width - padding * 2
        const plotHeight = height - padding * 2

        const points = decoded.map(([lat, lon]) => {
            const x = padding + ((lon - minX) / rangeX) * plotWidth
            const y = padding + plotHeight - ((lat - minY) / rangeY) * plotHeight
            return `${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')

        return points
    } catch {
        return ''
    }
}

// ============================================================================
// COMPONENTS
// ============================================================================

const HeroPage = ({
    activity,
    format,
    styles,
    heroPhoto
}: {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    styles: ReturnType<typeof createStyles>
    heroPhoto: string | null
}) => {
    const date = formatDate(activity.start_date_local)
    const location = resolveActivityLocation(activity)
    const distance = formatDistance(activity.distance, 'metric')
    const time = formatTime(activity.moving_time)
    const pace = formatPace(activity.moving_time, activity.distance, 'metric')

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.heroPage}>
            {heroPhoto ? (
                <View style={styles.heroImageContainer}>
                    <PdfImage src={heroPhoto} />
                </View>
            ) : (
                <View style={styles.noPhotoPlaceholder}>
                    <Text style={styles.placeholderText}>{activity.name.charAt(0)}</Text>
                </View>
            )}

            {/* Gradient overlay */}
            <View style={styles.heroGradient} />

            {/* Content overlay */}
            <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>Race Day</Text>
                <Text style={styles.heroTitle}>{activity.name}</Text>
                <Text style={styles.heroMeta}>{date}{location ? ` | ${location}` : ''}</Text>

                <View style={styles.heroStatsRow}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{distance.split(' ')[0]}</Text>
                        <Text style={styles.heroStatLabel}>{distance.split(' ')[1]}</Text>
                    </View>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{time}</Text>
                        <Text style={styles.heroStatLabel}>Time</Text>
                    </View>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{pace.split('/')[0]}</Text>
                        <Text style={styles.heroStatLabel}>/{pace.split('/')[1]}</Text>
                    </View>
                    {activity.total_elevation_gain > 50 && (
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{Math.round(activity.total_elevation_gain)}</Text>
                            <Text style={styles.heroStatLabel}>m elev</Text>
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}

const StatsPage = ({
    activity,
    format,
    theme,
    styles,
    mapboxToken,
    thumbnails
}: {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    styles: ReturnType<typeof createStyles>
    mapboxToken?: string
    thumbnails: string[]
}) => {
    const scale = format.scaleFactor
    const spacing = resolveSpacing(theme, format)

    // Get map URL or fallback to SVG
    const mapWidth = format.dimensions.width - (format.safeMargin * 2)
    const mapHeight = 180 * scale
    const polyline = activity.map?.summary_polyline

    let mapUrl: string | null = null
    if (mapboxToken && polyline) {
        mapUrl = getMapboxLightUrl(polyline, mapboxToken, Math.round(mapWidth), Math.round(mapHeight))
    }

    // Process splits for chart
    const rawSplits = activity.splits_metric || []
    const chartSplits: SplitData[] = rawSplits.slice(0, 20).map((s, idx) => ({
        split: s.split || idx + 1,
        label: `${s.split || idx + 1}km`,
        moving_time: s.moving_time,
        distance: s.distance,
        elevation_difference: s.elevation_difference || 0
    }))

    // Get comments
    const comments = activity.comprehensiveData?.comments || []
    const topComments = comments.slice(0, 2)

    // Format stats
    const distance = formatDistance(activity.distance, 'metric')
    const time = formatTime(activity.moving_time)
    const pace = formatPace(activity.moving_time, activity.distance, 'metric')

    const chartBgColor = theme.surfaceColor ?? theme.primaryColor + '08'

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.statsPage}>
            <View style={styles.contentContainer}>
                {/* Header */}
                <View style={styles.statsHeader}>
                    <Text style={styles.statsTitle}>Race Analysis</Text>
                    <Text style={styles.statsSubtitle}>{activity.name}</Text>
                </View>

                {/* Quick Stats Bar */}
                <View style={styles.quickStatsRow}>
                    <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{distance.split(' ')[0]}</Text>
                        <Text style={styles.quickStatLabel}>{distance.split(' ')[1]}</Text>
                    </View>
                    <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{time}</Text>
                        <Text style={styles.quickStatLabel}>Time</Text>
                    </View>
                    <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{pace.split('/')[0]}</Text>
                        <Text style={styles.quickStatLabel}>/{pace.split('/')[1]}</Text>
                    </View>
                    <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{Math.round(activity.total_elevation_gain)}</Text>
                        <Text style={styles.quickStatLabel}>m elevation</Text>
                    </View>
                </View>

                {/* Map */}
                <Text style={styles.sectionTitle}>Route</Text>
                <View style={styles.mapContainer}>
                    {mapUrl ? (
                        <PdfImage src={resolveImageForPdf(mapUrl) || mapUrl} />
                    ) : polyline ? (
                        <Svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
                            <Polyline
                                points={normalizePolylineToSvg(polyline, mapWidth, mapHeight)}
                                stroke={theme.accentColor}
                                strokeWidth={3 * scale}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </Svg>
                    ) : (
                        <Text style={styles.noMapText}>No map data</Text>
                    )}
                </View>

                {/* Splits Chart */}
                {chartSplits.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Performance Splits</Text>
                        <View style={styles.chartContainer}>
                            <SplitsChartSVG
                                splits={chartSplits}
                                totalTime={activity.moving_time}
                                width={mapWidth - spacing.md}
                                height={130 * scale}
                                backgroundColor={chartBgColor}
                                theme={theme}
                            />
                        </View>
                    </>
                )}

                {/* Photo thumbnails */}
                {thumbnails.length > 0 && (
                    <View style={styles.thumbnailStrip}>
                        {thumbnails.slice(0, 4).map((url, idx) => (
                            <View key={idx} style={styles.thumbnailContainer}>
                                <PdfImage src={url} />
                            </View>
                        ))}
                    </View>
                )}

                {/* Social Section */}
                <View style={styles.socialSection}>
                    <View style={styles.kudosContainer}>
                        <Text style={styles.kudosCount}>{activity.kudos_count || 0}</Text>
                        <Text style={styles.kudosLabel}>Kudos</Text>
                    </View>

                    {topComments.length > 0 && (
                        <View style={styles.commentsContainer}>
                            {topComments.map((comment, idx) => (
                                <View key={idx} style={styles.comment}>
                                    <Text style={styles.commentAuthor}>
                                        {comment.athlete?.firstname} {comment.athlete?.lastname?.charAt(0)}.
                                    </Text>
                                    <Text style={styles.commentText}>
                                        {comment.text?.substring(0, 80)}{comment.text?.length > 80 ? '...' : ''}
                                    </Text>
                                </View>
                            ))}
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

export const Race_2p = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken
}: Race2pProps) => {
    const styles = createStyles(format, theme)

    // Extract photos
    const photos = extractPhotos(activity)
    const heroPhoto = photos.length > 0 ? photos[0].url : null
    const thumbnails = photos.slice(1).map(p => p.url)

    return (
        <Document>
            <HeroPage
                activity={activity}
                format={format}
                theme={theme}
                styles={styles}
                heroPhoto={heroPhoto}
            />
            <StatsPage
                activity={activity}
                format={format}
                theme={theme}
                styles={styles}
                mapboxToken={mapboxToken}
                thumbnails={thumbnails}
            />
        </Document>
    )
}

// Export for use as pages within a larger document
export const Race_2pPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken
}: Race2pProps) => {
    const styles = createStyles(format, theme)

    const photos = extractPhotos(activity)
    const heroPhoto = photos.length > 0 ? photos[0].url : null
    const thumbnails = photos.slice(1).map(p => p.url)

    return (
        <>
            <HeroPage
                activity={activity}
                format={format}
                theme={theme}
                styles={styles}
                heroPhoto={heroPhoto}
            />
            <StatsPage
                activity={activity}
                format={format}
                theme={theme}
                styles={styles}
                mapboxToken={mapboxToken}
                thumbnails={thumbnails}
            />
        </>
    )
}

// Alias for backward compatibility with ConcatAllPDF
export const Race_2pSpreadPages = Race_2pPages
