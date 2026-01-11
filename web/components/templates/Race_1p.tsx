import { Page, Text, View, Document, StyleSheet, Image, Svg, Polyline, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import {
    resolveActivityLocation,
    formatDuration,
    formatPace,
    processSplits,
    processBestEfforts,
    getMapboxSatelliteUrl
} from '@/lib/activity-utils'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import mapboxPolyline from '@mapbox/polyline'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

// Create styles with format and theme
const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
    page: {
        width: format.dimensions.width,
        height: format.dimensions.height,
        backgroundColor: '#1a1a1a', // Dark background for dramatic race pages
    },
    // Full-page wrapper to ensure page dimensions are respected
    pageWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },

    // Hero photo section - full bleed at top (compact for single-page layout)
    heroPhotoContainer: {
        width: '100%',
        height: 200 * format.scaleFactor,
        position: 'relative',
        overflow: 'hidden',
    },
    heroPhoto: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    photoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: 'linear-gradient(to top, rgba(26,26,26,1), rgba(26,26,26,0))',
    },

    // Content area
    contentArea: {
        padding: format.safeMargin,
        paddingTop: 16 * format.scaleFactor,
    },

    // Title section (more compact)
    titleSection: {
        marginBottom: 12 * format.scaleFactor,
    },
    raceDate: {
        fontSize: Math.max(8, 10 * format.scaleFactor),
        fontFamily: 'Helvetica-Bold',
        color: theme.accentColor,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 4 * format.scaleFactor,
    },
    raceTitle: {
        fontSize: Math.max(20, 26 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: '#ffffff',
        fontWeight: 'bold',
        lineHeight: 1.1,
        marginBottom: 6 * format.scaleFactor,
    },
    raceLocation: {
        fontSize: Math.max(8, 10 * format.scaleFactor),
        fontFamily: 'Helvetica',
        color: '#999999',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Hero stats - oversized but more compact
    heroStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16 * format.scaleFactor,
        paddingBottom: 12 * format.scaleFactor,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
    },
    heroStat: {
        alignItems: 'center',
    },
    heroStatValue: {
        fontSize: Math.max(28, 36 * format.scaleFactor),
        fontFamily: 'Courier-Bold', // Monospace for stats
        color: theme.accentColor,
        lineHeight: 1,
    },
    heroStatLabel: {
        fontSize: Math.max(7, 8 * format.scaleFactor),
        fontFamily: 'Helvetica',
        color: '#888888',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: 4 * format.scaleFactor,
    },

    // Giant stats for stats-focus variant - 2x2 grid
    giantStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16 * format.scaleFactor,
        paddingVertical: 16 * format.scaleFactor,
        borderBottomWidth: 2,
        borderBottomColor: theme.accentColor,
        borderTopWidth: 2,
        borderTopColor: theme.accentColor,
    },
    giantStat: {
        width: '48%',
        alignItems: 'center',
        marginBottom: 12 * format.scaleFactor,
    },
    giantStatValue: {
        fontSize: Math.max(36, 48 * format.scaleFactor),
        fontFamily: 'Courier-Bold',
        color: theme.accentColor,
        lineHeight: 1,
        textAlign: 'center',
    },

    // Thumbnail styles for secondary images
    thumbnailRow: {
        flexDirection: 'row',
        gap: 8 * format.scaleFactor,
        marginBottom: 12 * format.scaleFactor,
    },
    thumbnailContainer: {
        width: 80 * format.scaleFactor,
        height: 60 * format.scaleFactor,
        borderRadius: 4,
        overflow: 'hidden',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },

    // Dual image layout
    dualImageRow: {
        flexDirection: 'row',
        width: '100%',
        height: 200 * format.scaleFactor,
    },
    dualImageHalf: {
        width: '50%',
        height: '100%',
        overflow: 'hidden',
    },

    // Polyline hero container
    polylineHeroContainer: {
        width: '100%',
        backgroundColor: '#0a0a0a',
        padding: format.safeMargin,
        marginBottom: 8 * format.scaleFactor,
    },

    // Data sections layout (more compact)
    dataSections: {
        flexDirection: 'row',
        gap: 12 * format.scaleFactor,
        marginBottom: 12 * format.scaleFactor,
    },
    dataColumn: {
        flex: 1,
    },

    // Section headers
    sectionTitle: {
        fontSize: Math.max(8, 9 * format.scaleFactor),
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: theme.accentColor,
        marginBottom: 6 * format.scaleFactor,
        letterSpacing: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
        paddingBottom: 3 * format.scaleFactor,
    },

    // Splits table (more compact)
    splitsTable: {
        marginTop: 4 * format.scaleFactor,
    },
    splitRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2 * format.scaleFactor,
        borderBottomWidth: 0.5,
        borderBottomColor: '#2a2a2a',
    },
    splitLabel: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Helvetica',
        color: '#999999',
    },
    splitValue: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Courier', // Monospace for alignment
        color: '#ffffff',
    },

    // Best efforts (more compact)
    effortRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2 * format.scaleFactor,
        borderBottomWidth: 0.5,
        borderBottomColor: '#2a2a2a',
    },
    effortLabel: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Helvetica',
        color: '#999999',
        flex: 1,
    },
    effortValue: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Courier-Bold',
        color: '#ffffff',
    },
    prBadge: {
        backgroundColor: theme.accentColor,
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
        marginLeft: 4,
    },
    prBadgeText: {
        fontSize: Math.max(5, 6 * format.scaleFactor),
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
    },

    // Comments (more compact)
    commentsList: {
        marginTop: 4 * format.scaleFactor,
    },
    comment: {
        marginBottom: 6 * format.scaleFactor,
        paddingBottom: 4 * format.scaleFactor,
        borderBottomWidth: 0.5,
        borderBottomColor: '#2a2a2a',
    },
    commentAuthor: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Helvetica-Bold',
        color: theme.accentColor,
        marginBottom: 1 * format.scaleFactor,
    },
    commentText: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Helvetica',
        color: '#cccccc',
        lineHeight: 1.3,
    },
    kudosCount: {
        fontSize: Math.max(6, 7 * format.scaleFactor),
        fontFamily: 'Helvetica-Bold',
        color: theme.accentColor,
        marginTop: 4 * format.scaleFactor,
    },

    // Map/polyline section (smaller for single-page)
    mapSection: {
        width: '100%',
        height: 100 * format.scaleFactor,
        backgroundColor: '#0a0a0a',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12 * format.scaleFactor,
    },

    // Description (more compact)
    description: {
        fontSize: Math.max(7, 8 * format.scaleFactor),
        fontFamily: 'Helvetica',
        color: '#cccccc',
        fontStyle: 'italic',
        lineHeight: 1.3,
        marginBottom: 12 * format.scaleFactor,
        paddingLeft: 10 * format.scaleFactor,
        borderLeftWidth: 2,
        borderLeftColor: theme.accentColor,
    },
})

// Helper to scale coordinates to SVG viewbox
const normalizePoints = (encodedPolyline: string, width: number, height: number) => {
    if (!encodedPolyline) return ""

    try {
        const decoded = mapboxPolyline.decode(encodedPolyline)
        if (!decoded || decoded.length === 0) return ""

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

        decoded.forEach(([lat, lon]) => {
            if (lon < minX) minX = lon
            if (lon > maxX) maxX = lon
            if (lat < minY) minY = lat
            if (lat > maxY) maxY = lat
        })

        const rangeX = maxX - minX
        const rangeY = maxY - minY

        const points = decoded.map(([lat, lon]) => {
            const x = ((lon - minX) / rangeX) * width
            const y = height - ((lat - minY) / rangeY) * height
            return `${x},${y}`
        }).join(' ')

        return points
    } catch (e) {
        console.error("Polyline decode error", e)
        return ""
    }
}

// Layout variants - all show ALL data, just with different visual emphasis
export type Race1pVariant = 'photo-hero' | 'map-hero' | 'dual-image' | 'stats-focus' | 'polyline-minimal'

interface Race_1pProps {
    activity: StravaActivity
    mapboxToken?: string
    format?: BookFormat
    theme?: BookTheme
    layoutVariant?: Race1pVariant  // Defaults to auto-detect based on available data
}

export const Race_1p = ({
    activity,
    mapboxToken,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    layoutVariant
}: Race_1pProps) => {
    const styles = createStyles(format, theme)
    const location = resolveActivityLocation(activity)

    // Get Strava photo if available
    const stravaPhoto = resolveImageForPdf(activity.photos?.primary?.urls?.['600'])

    // Get satellite map URL if token and polyline available
    // Use direct URL for @react-pdf/renderer (proxy URLs don't work server-side)
    const satelliteMapUrl = (mapboxToken && activity.map?.summary_polyline)
        ? getMapboxSatelliteUrl(activity.map.summary_polyline, mapboxToken)
        : null

    // Determine variant: use provided or auto-detect
    const variant: Race1pVariant = layoutVariant || (() => {
        if (stravaPhoto && satelliteMapUrl) return 'dual-image'
        if (stravaPhoto) return 'photo-hero'
        if (satelliteMapUrl) return 'map-hero'
        if (activity.map?.summary_polyline) return 'polyline-minimal'
        return 'stats-focus'
    })()

    // Prepare splits data
    const displaySplits = processSplits(activity, 6)

    // Prepare best efforts (limit to 6 for single page)
    const bestEfforts = processBestEfforts(activity, 6)

    // Prepare comments (limit to 3 for single page)
    const comments = (activity.comments || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)

    // Calculate hero stats
    const distanceKm = (activity.distance / 1000).toFixed(1)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance, 'metric')
    const elevationM = Math.round(activity.total_elevation_gain)





    // =========================================================================
    // Shared Components (used across all variants)
    // =========================================================================

    const TitleSection = () => (
        <View style={styles.titleSection}>
            <Text style={styles.raceDate}>
                {new Date(activity.start_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }).toUpperCase()}
            </Text>
            <Text style={styles.raceTitle}>{activity.name}</Text>
            <Text style={styles.raceLocation}>{location}</Text>
        </View>
    )

    const Description = () => activity.description ? (
        <Text style={styles.description}>&quot;{activity.description}&quot;</Text>
    ) : null

    const HeroStats = ({ giant = false }: { giant?: boolean }) => (
        <View style={giant ? styles.giantStatsGrid : styles.heroStatsRow}>
            <View style={giant ? styles.giantStat : styles.heroStat}>
                <Text style={giant ? styles.giantStatValue : styles.heroStatValue}>{distanceKm}</Text>
                <Text style={styles.heroStatLabel}>KM</Text>
            </View>
            <View style={giant ? styles.giantStat : styles.heroStat}>
                <Text style={giant ? styles.giantStatValue : styles.heroStatValue}>{timeFormatted}</Text>
                <Text style={styles.heroStatLabel}>TIME</Text>
            </View>
            <View style={giant ? styles.giantStat : styles.heroStat}>
                <Text style={giant ? styles.giantStatValue : styles.heroStatValue}>{avgPace}</Text>
                <Text style={styles.heroStatLabel}>PACE/KM</Text>
            </View>
            {elevationM > 0 && (
                <View style={giant ? styles.giantStat : styles.heroStat}>
                    <Text style={giant ? styles.giantStatValue : styles.heroStatValue}>{elevationM}</Text>
                    <Text style={styles.heroStatLabel}>ELEV (M)</Text>
                </View>
            )}
        </View>
    )

    const HeroPhoto = ({ height = 200 }: { height?: number }) => stravaPhoto ? (
        <View style={[styles.heroPhotoContainer, { height: height * format.scaleFactor }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={stravaPhoto} style={styles.heroPhoto} />
        </View>
    ) : null

    const HeroMap = ({ height = 200 }: { height?: number }) => satelliteMapUrl ? (
        <View style={[styles.heroPhotoContainer, { height: height * format.scaleFactor }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={satelliteMapUrl} style={styles.heroPhoto} />
        </View>
    ) : null

    const SmallPhoto = () => stravaPhoto ? (
        <View style={styles.thumbnailContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={stravaPhoto} style={styles.thumbnail} />
        </View>
    ) : null

    const SmallMap = () => satelliteMapUrl ? (
        <View style={styles.thumbnailContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={satelliteMapUrl} style={styles.thumbnail} />
        </View>
    ) : null

    const PolylineHero = ({ height = 180 }: { height?: number }) => activity.map?.summary_polyline ? (
        <View style={[styles.polylineHeroContainer, { height: height * format.scaleFactor }]}>
            <Svg
                width="100%"
                height={height * format.scaleFactor}
                viewBox={`0 0 ${format.dimensions.width - (format.safeMargin * 2)} ${height * format.scaleFactor}`}
            >
                <Polyline
                    points={normalizePoints(
                        activity.map.summary_polyline,
                        format.dimensions.width - (format.safeMargin * 2),
                        height * format.scaleFactor
                    )}
                    stroke={theme.accentColor}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </Svg>
        </View>
    ) : null

    const DataSections = () => (
        <View style={styles.dataSections}>
            {displaySplits.length > 0 && (
                <View style={styles.dataColumn}>
                    <Text style={styles.sectionTitle}>Splits</Text>
                    <View style={styles.splitsTable}>
                        {displaySplits.map((split, idx) => (
                            <View key={idx} style={styles.splitRow}>
                                <Text style={styles.splitLabel}>{split.label}</Text>
                                <Text style={styles.splitValue}>{split.pace}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            {bestEfforts.length > 0 && (
                <View style={styles.dataColumn}>
                    <Text style={styles.sectionTitle}>Best Efforts</Text>
                    <View style={styles.splitsTable}>
                        {bestEfforts.map((effort, idx) => {
                            const isPR = effort.pr_rank && effort.pr_rank <= 3
                            return (
                                <View key={idx} style={styles.effortRow}>
                                    <Text style={styles.effortLabel}>{effort.name}</Text>
                                    <Text style={styles.effortValue}>{effort.pace}</Text>
                                    {isPR && (
                                        <View style={styles.prBadge}>
                                            <Text style={styles.prBadgeText}>PR{effort.pr_rank}</Text>
                                        </View>
                                    )}
                                </View>
                            )
                        })}
                    </View>
                </View>
            )}
            {(comments.length > 0 || activity.kudos_count > 0) && (
                <View style={styles.dataColumn}>
                    <Text style={styles.sectionTitle}>
                        {comments.length > 0 ? 'Comments' : 'Kudos'}
                    </Text>
                    {activity.kudos_count > 0 && (
                        <Text style={styles.kudosCount}>👍 {activity.kudos_count} kudos</Text>
                    )}
                    {comments.length > 0 && (
                        <View style={styles.commentsList}>
                            {comments.map((comment, idx) => (
                                <View key={idx} style={styles.comment}>
                                    <Text style={styles.commentAuthor}>
                                        {comment.athlete.firstname} {comment.athlete.lastname}
                                    </Text>
                                    <Text style={styles.commentText}>{comment.text}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    )

    // =========================================================================
    // Variant-Specific Layouts
    // =========================================================================

    const renderPhotoHero = () => (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page} wrap={false}>
            <View style={styles.pageWrapper}>
                <HeroPhoto height={280} />
                <View style={styles.contentArea}>
                    <TitleSection />
                    <Description />
                    <View style={styles.thumbnailRow}>
                        <SmallMap />
                    </View>
                    <HeroStats />
                    <DataSections />
                </View>
            </View>
        </Page>
    )

    const renderMapHero = () => (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page} wrap={false}>
            <View style={styles.pageWrapper}>
                <HeroMap height={280} />
                <View style={styles.contentArea}>
                    <TitleSection />
                    <Description />
                    <View style={styles.thumbnailRow}>
                        <SmallPhoto />
                    </View>
                    <HeroStats />
                    <DataSections />
                </View>
            </View>
        </Page>
    )

    const renderDualImage = () => (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page} wrap={false}>
            <View style={styles.pageWrapper}>
                <View style={styles.dualImageRow}>
                    {satelliteMapUrl && (
                        <View style={styles.dualImageHalf}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image src={satelliteMapUrl} style={styles.heroPhoto} />
                        </View>
                    )}
                    {stravaPhoto && (
                        <View style={styles.dualImageHalf}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image src={stravaPhoto} style={styles.heroPhoto} />
                        </View>
                    )}
                </View>
                <View style={styles.contentArea}>
                    <TitleSection />
                    <Description />
                    <HeroStats />
                    <DataSections />
                </View>
            </View>
        </Page>
    )

    const renderStatsFocus = () => (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page} wrap={false}>
            <View style={styles.pageWrapper}>
                <View style={styles.contentArea}>
                    <TitleSection />
                    <HeroStats giant={true} />
                    <View style={styles.thumbnailRow}>
                        <SmallPhoto />
                        <SmallMap />
                    </View>
                    <Description />
                    <DataSections />
                </View>
            </View>
        </Page>
    )

    const renderPolylineMinimal = () => (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page} wrap={false}>
            <View style={styles.pageWrapper}>
                <PolylineHero height={220} />
                <View style={styles.contentArea}>
                    <TitleSection />
                    <View style={styles.thumbnailRow}>
                        <SmallPhoto />
                    </View>
                    <Description />
                    <HeroStats />
                    <DataSections />
                </View>
            </View>
        </Page>
    )

    // =========================================================================
    // Render based on variant
    // =========================================================================

    return (
        <Document>
            {variant === 'photo-hero' && renderPhotoHero()}
            {variant === 'map-hero' && renderMapHero()}
            {variant === 'dual-image' && renderDualImage()}
            {variant === 'stats-focus' && renderStatsFocus()}
            {variant === 'polyline-minimal' && renderPolylineMinimal()}
        </Document>
    )
}
