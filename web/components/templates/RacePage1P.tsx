import { Page, Text, View, Document, StyleSheet, Image, Svg, Polyline, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import mapboxPolyline from '@mapbox/polyline'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        padding: 25,
        flexDirection: 'column',
    },
    heroHeader: {
        marginBottom: 12,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        textTransform: 'uppercase',
        marginBottom: 6,
        lineHeight: 1.1,
    },
    meta: {
        color: '#666666',
        fontSize: 10,
        fontFamily: 'Helvetica',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 2,
    },
    description: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#333',
        marginTop: 6,
        fontStyle: 'italic',
        lineHeight: 1.3,
    },
    imagesSection: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        height: 220,
    },
    imageContainer: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    fullWidthImage: {
        width: '100%',
        height: 220,
        backgroundColor: '#f0f0f0',
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
    },
    statBox: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontFamily: 'Helvetica-Bold',
        color: '#000',
    },
    statLabel: {
        fontSize: 8,
        color: '#666',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 8,
        color: '#333',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 2,
    },
    dataGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    dataRow: {
        width: '48%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
        fontSize: 7,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ddd',
        paddingBottom: 1,
    },
    dataLabel: {
        fontFamily: 'Helvetica',
        color: '#666',
        fontSize: 7,
        flex: 1,
    },
    dataValue: {
        fontFamily: 'Helvetica-Bold',
        color: '#000',
        fontSize: 7,
        textAlign: 'right',
    },
    commentsSection: {
        marginTop: 8,
    },
    comment: {
        marginBottom: 4,
        fontSize: 7,
        lineHeight: 1.3,
    },
    commentAuthor: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 7,
        color: '#000',
    },
    commentText: {
        fontFamily: 'Helvetica',
        fontSize: 7,
        color: '#333',
    },
    footer: {
        position: 'absolute',
        bottom: 12,
        left: 25,
        right: 25,
        textAlign: 'center',
        fontSize: 7,
        color: '#999',
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

interface RacePage1PProps {
    activity: StravaActivity
    mapboxToken?: string
}

export const RacePage1P = ({ activity, mapboxToken }: RacePage1PProps) => {
    // Get Strava photo if available
    const stravaPhoto = activity.photos?.primary?.urls?.['600']
        ? `/api/proxy-image?url=${encodeURIComponent(activity.photos.primary.urls['600'])}`
        : null

    // Get satellite map if token available
    let satelliteMap = null
    if (mapboxToken && activity.map.summary_polyline) {
        const pathParam = `path-5+fc4c02-0.8(${encodeURIComponent(activity.map.summary_polyline)})`
        const rawUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pathParam}/auto/800x400?access_token=${mapboxToken}&logo=false&attrib=false`
        satelliteMap = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`
    }

    // Determine what to show
    const hasBothImages = stravaPhoto && satelliteMap
    const hasOnlyPhoto = stravaPhoto && !satelliteMap
    const hasOnlyMap = !stravaPhoto && satelliteMap
    const hasNoImages = !stravaPhoto && !satelliteMap

    // Location resolution
    let location = activity.location_city
    if (!location && activity.timezone) {
        const parts = activity.timezone.split('/')
        if (parts.length > 1) {
            location = parts[parts.length - 1].replace(/_/g, ' ')
        }
    }
    if (!location) {
        location = 'Unknown Location'
    }

    // Prepare splits data - limit to 12 for space
    const rawSplits = activity.splits_metric || []
    let displaySplits = []

    if (rawSplits.length > 12) {
        // Aggregate to 5km chunks for very long runs
        const chunkSize = 5
        for (let i = 0; i < rawSplits.length && displaySplits.length < 12; i += chunkSize) {
            const chunk = rawSplits.slice(i, i + chunkSize)
            const last = chunk[chunk.length - 1]
            const totalMovingTime = chunk.reduce((acc, curr) => acc + curr.moving_time, 0)
            const totalDist = chunk.reduce((acc, curr) => acc + curr.distance, 0)
            const totalElev = chunk.reduce((acc, curr) => acc + curr.elevation_difference, 0)

            displaySplits.push({
                split: last.split,
                moving_time: totalMovingTime,
                distance: totalDist,
                elevation_difference: totalElev,
                label: `${chunk[0].split}-${last.split}km`
            })
        }
    } else {
        displaySplits = rawSplits.slice(0, 12).map(s => ({ ...s, label: s.split.toString() }))
    }

    // Prepare best efforts with smart prioritization
    // Algorithm: 
    // 1. Prioritize any efforts in top-3 (pr_rank 1-3)
    // 2. Then prioritize longest distances
    // 3. Limit to 10 efforts for space
    const allEfforts = activity.best_efforts || []
    let bestEfforts: typeof allEfforts = []

    if (allEfforts.length > 0) {
        // Separate top-3 PRs from others
        const top3PRs = allEfforts.filter(e => e.pr_rank && e.pr_rank <= 3)
        const otherEfforts = allEfforts.filter(e => !e.pr_rank || e.pr_rank > 3)

        // Sort others by distance (longest first)
        const sortedOthers = otherEfforts.sort((a, b) => b.distance - a.distance)

        // Combine: top-3 PRs first, then longest distances
        const combined = [...top3PRs, ...sortedOthers]

        // Take up to 10 efforts
        bestEfforts = combined.slice(0, 10)
    }

    // Prepare comments with smart prioritization
    // Algorithm: Sort by recency (most recent first), then take top 3
    // This ensures we show the most relevant/recent conversation
    const allComments = activity.comments || []
    const comments = allComments.length > 0
        ? [...allComments]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 3)
        : []

    // Calculate key stats
    const distanceKm = (activity.distance / 1000).toFixed(2)
    const movingTime = new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
    const paceSeconds = activity.moving_time / (activity.distance / 1000)
    const paceMin = Math.floor(paceSeconds / 60)
    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')
    const avgPace = `${paceMin}:${paceSec}/km`

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Hero Header - Title and Meta at Top */}
                <View style={styles.heroHeader}>
                    <Text style={styles.meta}>
                        {new Date(activity.start_date).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                    <Text style={styles.meta}>{location}</Text>
                    <Text style={styles.title}>{activity.name}</Text>
                    {activity.description && (
                        <Text style={styles.description}>{activity.description}</Text>
                    )}
                </View>

                {/* Images Section - Photo and/or Map */}
                {hasBothImages && (
                    <View style={styles.imagesSection}>
                        <View style={styles.imageContainer}>
                            <Image src={stravaPhoto!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </View>
                        <View style={styles.imageContainer}>
                            <Image src={satelliteMap!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </View>
                    </View>
                )}

                {hasOnlyPhoto && (
                    <View style={styles.fullWidthImage}>
                        <Image src={stravaPhoto!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </View>
                )}

                {hasOnlyMap && (
                    <View style={styles.fullWidthImage}>
                        <Image src={satelliteMap!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </View>
                )}

                {hasNoImages && (
                    <View style={styles.fullWidthImage}>
                        <Svg height="220" width="562" viewBox="0 0 562 220" style={{ backgroundColor: '#2a2a2a' }}>
                            <Polyline
                                points={normalizePoints(activity.map.summary_polyline, 562, 220)}
                                stroke="#fc4c02"
                                strokeWidth={4}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </Svg>
                    </View>
                )}

                {/* Key Stats */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{distanceKm}</Text>
                        <Text style={styles.statLabel}>Kilometers</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{movingTime}</Text>
                        <Text style={styles.statLabel}>Time</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{avgPace}</Text>
                        <Text style={styles.statLabel}>Avg Pace</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{activity.total_elevation_gain}m</Text>
                        <Text style={styles.statLabel}>Elevation</Text>
                    </View>
                </View>

                {/* Three-column layout for splits, best efforts, and comments */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {/* Splits Column with Visual Bars */}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>
                            Splits {rawSplits.length > 12 ? '(5km)' : ''}
                        </Text>
                        {displaySplits.length > 0 && (() => {
                            // Calculate pace range for bar scaling
                            const paces = displaySplits.map(s => s.moving_time / (s.distance / 1000))
                            const minPace = Math.min(...paces)
                            const maxPace = Math.max(...paces)
                            const paceRange = maxPace - minPace || 1

                            return (
                                <View style={{ marginTop: 4 }}>
                                    {displaySplits.map((split, i) => {
                                        const paceSeconds = split.moving_time / (split.distance / 1000)
                                        const paceMin = Math.floor(paceSeconds / 60)
                                        const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

                                        // Calculate bar width (normalized pace)
                                        const paceNorm = (paceSeconds - minPace) / paceRange
                                        const barWidth = paceNorm * 70 + 25 // 25-95% width

                                        return (
                                            <View key={i} style={{ marginBottom: 3 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                                                    <Text style={{ fontSize: 6, fontFamily: 'Helvetica', color: '#666' }}>
                                                        {split.label}
                                                    </Text>
                                                    <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#000' }}>
                                                        {paceMin}:{paceSec}
                                                    </Text>
                                                </View>
                                                <View style={{ width: '100%', height: 4, backgroundColor: '#f0f0f0' }}>
                                                    <View style={{ width: `${barWidth}%`, height: 4, backgroundColor: '#0a7ea4' }} />
                                                </View>
                                            </View>
                                        )
                                    })}
                                </View>
                            )
                        })()}
                    </View>

                    {/* Best Efforts Column */}
                    {bestEfforts.length > 0 && (
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>Best Efforts</Text>
                            <View style={styles.dataGrid}>
                                {bestEfforts.map((effort, i) => {
                                    const paceSeconds = effort.elapsed_time / (effort.distance / 1000)
                                    const paceMin = Math.floor(paceSeconds / 60)
                                    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

                                    // Color-code top-3 PRs (same as race_2p)
                                    const prRank = effort.pr_rank || 0
                                    let backgroundColor = 'transparent'
                                    let textColor = '#555'
                                    let fontFamily = 'Helvetica'

                                    if (prRank === 1) {
                                        backgroundColor = '#FFD700' // Gold
                                        textColor = '#000'
                                        fontFamily = 'Helvetica-Bold'
                                    } else if (prRank === 2) {
                                        backgroundColor = '#C0C0C0' // Silver
                                        textColor = '#000'
                                        fontFamily = 'Helvetica-Bold'
                                    } else if (prRank === 3) {
                                        backgroundColor = '#CD7F32' // Bronze
                                        textColor = '#000'
                                        fontFamily = 'Helvetica-Bold'
                                    } else if (prRank > 0 && prRank <= 5) {
                                        fontFamily = 'Helvetica-Bold' // Top 5 but not podium
                                    }

                                    return (
                                        <View key={i} style={[styles.dataRow, { backgroundColor, paddingVertical: prRank <= 3 ? 1 : 0 }]}>
                                            <Text style={[styles.dataLabel, { fontFamily, color: prRank <= 3 ? textColor : '#666' }]}>
                                                {effort.name}
                                            </Text>
                                            <Text style={[styles.dataValue, { fontFamily, color: prRank <= 3 ? textColor : '#000' }]}>
                                                {paceMin}:{paceSec}
                                            </Text>
                                        </View>
                                    )
                                })}
                            </View>
                        </View>
                    )}

                    {/* Comments/Kudos Column */}
                    {(comments.length > 0 || activity.kudos_count > 0) && (
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 2, marginBottom: 6, marginTop: 8 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333' }}>
                                    {comments.length > 0 ? 'Comments' : 'Kudos'}
                                </Text>
                                {activity.kudos_count > 0 && (
                                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fc4c02' }}>👍 {activity.kudos_count}</Text>
                                )}
                            </View>
                            {comments.length > 0 && (
                                <View style={styles.commentsSection}>
                                    {comments.map((comment, i) => (
                                        <View key={i} style={styles.comment}>
                                            <Text style={styles.commentAuthor}>
                                                {comment.athlete.firstname} {comment.athlete.lastname}:
                                            </Text>
                                            <Text style={styles.commentText}>{comment.text}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text>Generated by Strava Book • {activity.type}</Text>
                </View>
            </Page>
        </Document>
    )
}
