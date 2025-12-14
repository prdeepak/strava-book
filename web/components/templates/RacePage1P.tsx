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
        padding: 30,
        flexDirection: 'column',
    },
    heroHeader: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
        paddingBottom: 15,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        textTransform: 'uppercase',
        marginBottom: 8,
        lineHeight: 1.1,
    },
    meta: {
        color: '#666666',
        fontSize: 12,
        fontFamily: 'Helvetica',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 3,
    },
    imagesSection: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 20,
        height: 280,
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
        height: 280,
        backgroundColor: '#f0f0f0',
        marginBottom: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
    },
    statBox: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: '#000',
    },
    statLabel: {
        fontSize: 9,
        color: '#666',
        textTransform: 'uppercase',
        marginTop: 3,
    },
    sectionTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 10,
        color: '#333',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 3,
    },
    dataGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dataRow: {
        width: '23%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
        fontSize: 7,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ddd',
        paddingBottom: 2,
    },
    dataLabel: {
        fontFamily: 'Helvetica',
        color: '#666',
        fontSize: 7,
    },
    dataValue: {
        fontFamily: 'Helvetica-Bold',
        color: '#000',
        fontSize: 7,
    },
    footer: {
        position: 'absolute',
        bottom: 15,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 8,
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

    // Prepare splits data
    const rawSplits = activity.splits_metric || []
    let displaySplits = []

    if (rawSplits.length > 16) {
        // Aggregate to 5km chunks for very long runs
        const chunkSize = 5
        for (let i = 0; i < rawSplits.length; i += chunkSize) {
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
        displaySplits = rawSplits.slice(0, 16).map(s => ({ ...s, label: s.split.toString() }))
    }

    // Prepare best efforts (limit to top 8)
    const bestEfforts = (activity.best_efforts || []).slice(0, 8)

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
                        <Svg height="280" width="552" viewBox="0 0 552 280" style={{ backgroundColor: '#2a2a2a' }}>
                            <Polyline
                                points={normalizePoints(activity.map.summary_polyline, 552, 280)}
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

                {/* Two-column layout for splits and best efforts */}
                <View style={{ flexDirection: 'row', gap: 15 }}>
                    {/* Splits Column */}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>
                            Splits {rawSplits.length > 16 ? '(5km)' : '(Metric)'}
                        </Text>
                        <View style={styles.dataGrid}>
                            {displaySplits.map((split, i) => {
                                const paceSeconds = split.moving_time / (split.distance / 1000)
                                const paceMin = Math.floor(paceSeconds / 60)
                                const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

                                return (
                                    <View key={i} style={styles.dataRow}>
                                        <Text style={styles.dataLabel}>{split.label}</Text>
                                        <Text style={styles.dataValue}>{paceMin}:{paceSec}</Text>
                                    </View>
                                )
                            })}
                        </View>
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

                                    // Highlight PRs
                                    const isPR = effort.pr_rank && effort.pr_rank <= 3
                                    const bgColor = effort.pr_rank === 1 ? '#FFD700' : effort.pr_rank === 2 ? '#C0C0C0' : effort.pr_rank === 3 ? '#CD7F32' : 'transparent'

                                    return (
                                        <View key={i} style={[styles.dataRow, { backgroundColor: bgColor, paddingVertical: isPR ? 2 : 0 }]}>
                                            <Text style={[styles.dataLabel, { fontFamily: isPR ? 'Helvetica-Bold' : 'Helvetica' }]}>
                                                {effort.name}
                                            </Text>
                                            <Text style={[styles.dataValue, { fontFamily: isPR ? 'Helvetica-Bold' : 'Helvetica' }]}>
                                                {paceMin}:{paceSec}
                                            </Text>
                                        </View>
                                    )
                                })}
                            </View>
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
