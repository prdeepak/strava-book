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

import { Document, Page, View, Text, Image, StyleSheet, Svg, Polyline } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { formatTime, formatPace, formatDistance, resolveActivityLocation } from '@/lib/activity-utils'
import { getMapboxLightUrl } from '@/lib/activity-utils'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { SplitsChartSVG, SplitData } from '@/lib/generateSplitsChart'
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
    const scale = format.scaleFactor

    return StyleSheet.create({
        // Page 1 - Hero
        heroPage: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            position: 'relative',
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
            paddingTop: 60 * scale,
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
            padding: 24 * scale,
            paddingTop: 20 * scale,
        },
        heroLabel: {
            color: theme.accentColor,
            fontSize: Math.max(12, 14 * scale),
            fontFamily: theme.fontPairing.heading,
            textTransform: 'uppercase',
            letterSpacing: 3,
            marginBottom: 12 * scale,
        },
        heroTitle: {
            color: '#ffffff',
            fontSize: Math.max(32, 42 * scale),
            fontFamily: theme.fontPairing.heading,
            marginBottom: 12 * scale,
            lineHeight: 1.15,
        },
        heroMeta: {
            color: 'rgba(255,255,255,0.9)',
            fontSize: Math.max(14, 16 * scale),
            fontFamily: theme.fontPairing.body,
            marginBottom: 20 * scale,
            letterSpacing: 0.5,
        },
        heroStatsRow: {
            flexDirection: 'row',
            gap: 32 * scale,
            paddingTop: 16 * scale,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.3)',
        },
        heroStat: {
            alignItems: 'flex-start',
        },
        heroStatValue: {
            color: '#ffffff',
            fontSize: Math.max(28, 36 * scale),
            fontFamily: 'Helvetica-Bold',
        },
        heroStatLabel: {
            color: 'rgba(255,255,255,0.75)',
            fontSize: Math.max(10, 12 * scale),
            fontFamily: theme.fontPairing.body,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: 4 * scale,
        },

        // Page 2 - Stats
        statsPage: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: '#ffffff',
            padding: format.safeMargin,
        },
        statsHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 16 * scale,
            paddingBottom: 12 * scale,
            borderBottomWidth: 3,
            borderBottomColor: theme.accentColor,
        },
        statsTitle: {
            fontSize: Math.max(20, 26 * scale),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
        },
        statsSubtitle: {
            fontSize: Math.max(10, 12 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#666',
        },
        sectionTitle: {
            fontSize: Math.max(11, 13 * scale),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 10 * scale,
            marginTop: 16 * scale,
            paddingBottom: 4 * scale,
            borderBottomWidth: 1,
            borderBottomColor: '#e0e0e0',
        },
        mapContainer: {
            height: 200 * scale,
            backgroundColor: '#f5f5f5',
            marginBottom: 16 * scale,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#e0e0e0',
            position: 'relative',
        },
        chartContainer: {
            height: 160 * scale,
            backgroundColor: '#fafafa',
            marginBottom: 16 * scale,
            padding: 12 * scale,
            borderWidth: 1,
            borderColor: '#e0e0e0',
        },
        quickStatsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            backgroundColor: theme.primaryColor,
            padding: 16 * scale,
            marginBottom: 16 * scale,
        },
        quickStat: {
            alignItems: 'center',
        },
        quickStatValue: {
            color: '#ffffff',
            fontSize: Math.max(20, 24 * scale),
            fontFamily: 'Helvetica-Bold',
        },
        quickStatLabel: {
            color: 'rgba(255,255,255,0.8)',
            fontSize: Math.max(8, 9 * scale),
            fontFamily: theme.fontPairing.body,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 4 * scale,
        },
        socialSection: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginTop: 'auto',
            paddingTop: 16 * scale,
            borderTopWidth: 2,
            borderTopColor: '#e0e0e0',
        },
        kudosContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8 * scale,
        },
        kudosCount: {
            fontSize: Math.max(18, 22 * scale),
            fontFamily: 'Helvetica-Bold',
            color: theme.accentColor,
        },
        kudosLabel: {
            fontSize: Math.max(9, 10 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#666',
            textTransform: 'uppercase',
        },
        commentsContainer: {
            flex: 1,
            marginLeft: 24 * scale,
        },
        comment: {
            marginBottom: 6 * scale,
        },
        commentAuthor: {
            fontSize: Math.max(8, 9 * scale),
            fontFamily: 'Helvetica-Bold',
            color: '#333',
        },
        commentText: {
            fontSize: Math.max(8, 9 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#555',
            fontStyle: 'italic',
        },
        thumbnailStrip: {
            flexDirection: 'row',
            gap: 8 * scale,
            marginTop: 12 * scale,
        },
        thumbnailContainer: {
            width: 60 * scale,
            height: 60 * scale,
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
            color: '#ffffff',
            fontSize: Math.max(24, 32 * scale),
            fontFamily: theme.fontPairing.heading,
            textAlign: 'center',
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
                <Text style={styles.heroMeta}>{date} | {location}</Text>

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

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.statsPage}>
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
                    <Text style={{ color: '#999', textAlign: 'center', marginTop: 80 * scale }}>No map data</Text>
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
                            width={mapWidth - 24 * scale}
                            height={130 * scale}
                            backgroundColor="#fafafa"
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
