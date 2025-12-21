import { Page, Text, View, StyleSheet, Svg, Polyline, Image } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import mapboxPolyline from '@mapbox/polyline'
import { BestEffortsTable } from '@/components/pdf/BestEffortsTable'

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        padding: 40,
        flexDirection: 'column',
    },
    mapContainer: {
        height: 280, // Reduced from 400 to fit splits + best efforts on one page
        backgroundColor: '#f8f8f8',
        marginBottom: 20,
        border: '1px solid #eeeeee',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        marginBottom: 10,
        color: '#333',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 4,
    },
    splitsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    splitRow: {
        width: '48%', // Two columns
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 2,
        marginRight: '2%'
    },
    splitText: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#555',
    },
    splitHeader: {
        width: '48%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        marginRight: '2%',
    },
    splitHeaderText: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        uppercase: true,
        color: '#999',
    }
})

// Helper to scale coordinates to SVG viewbox
const normalizePoints = (encodedPolyline: string, width: number, height: number) => {
    if (!encodedPolyline) return ""

    try {
        const decoded = mapboxPolyline.decode(encodedPolyline)
        if (!decoded || decoded.length === 0) return ""

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

        // Lat = Y, Lon = X
        // decoded is [lat, lon] -> [y, x]

        decoded.forEach(([lat, lon]) => {
            if (lon < minX) minX = lon
            if (lon > maxX) maxX = lon
            if (lat < minY) minY = lat
            if (lat > maxY) maxY = lat
        })

        const rangeX = maxX - minX
        const rangeY = maxY - minY

        // Add padding


        // Scale to fit width/height
        // We revert Y because SVG Y grows downwards, but Lat grows upwards.

        const points = decoded.map(([lat, lon]) => {
            const x = ((lon - minX) / rangeX) * width
            const y = height - ((lat - minY) / rangeY) * height // Flip Y
            return `${x},${y}`
        }).join(' ')

        return points
    } catch (e) {
        console.error("Polyline decode error", e)
        return ""
    }
}

interface Race_2pRightProps {
    activity: StravaActivity
    mapboxToken?: string
}

export const Race_2pRight = ({ activity, mapboxToken }: Race_2pRightProps) => {
    const mapPoints = normalizePoints(activity.map.summary_polyline, 500, 300)

    // Fallback if no splits fetched (default api call might not have them without effort detail)
    const rawSplits = activity.splits_metric || []

    // Aggregate splits if there are too many (e.g. > 20)
    let displaySplits = []
    if (rawSplits.length > 20) {
        // Group by 5km
        const chunkSize = 5
        for (let i = 0; i < rawSplits.length; i += chunkSize) {
            const chunk = rawSplits.slice(i, i + chunkSize)
            const last = chunk[chunk.length - 1]

            // Sum moving time
            const totalMovingTime = chunk.reduce((acc, curr) => acc + curr.moving_time, 0)
            const totalDist = chunk.reduce((acc, curr) => acc + curr.distance, 0)
            const totalElev = chunk.reduce((acc, curr) => acc + curr.elevation_difference, 0)

            displaySplits.push({
                split: last.split, // The marker (e.g. 5, 10, 15)
                moving_time: totalMovingTime,
                distance: totalDist,
                elevation_difference: totalElev,
                label: `${chunk[0].split}-${last.split}km`
            })
        }
    } else {
        displaySplits = rawSplits.map(s => ({ ...s, label: s.split.toString() }))
    }

    // Map Rendering Logic
    // If we have a Mapbox Token, use the Static Images API for satellite view
    // Use prop token
    // const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN // Moved to parent
    console.log("[Race_2pRight] Mapbox Token Prop:", !!mapboxToken)
    let satelliteUrl = null
    if (mapboxToken && activity.map.summary_polyline) {
        // Construct detailed Mapbox Static URL
        // Style: Satellite V9
        // Path: Stroke Width 5, Color Orange (#fc4c02), Opacity 0.8
        const pathParam = `path-5+fc4c02-0.8(${encodeURIComponent(activity.map.summary_polyline)})`
        const rawUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pathParam}/auto/600x400?access_token=${mapboxToken}&logo=false&attrib=false`

        // Use local proxy to ensure PDF renderer can fetch it without CORS/Browser issues
        satelliteUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`
        console.log("[Race_2pRight] Generated Satellite URL:", satelliteUrl)
        console.log("[Race_2pRight] Raw Mapbox URL:", rawUrl)
    }

    return (
        <Page size="LETTER" style={styles.page}>
            <View style={styles.mapContainer}>
                {satelliteUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={satelliteUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <>
                        {/* Blueprint Grid Background - Made Darker and Technical */}
                        <Svg height="300" width="500" viewBox="0 0 500 300" style={{ position: 'absolute', top: 0, left: 0, backgroundColor: '#f0f0f0' }}>
                            {/* Horizontal Grid Lines */}
                            <Polyline points="0,60 500,60" stroke="#ddd" strokeWidth={1} />
                            <Polyline points="0,120 500,120" stroke="#ddd" strokeWidth={1} />
                            <Polyline points="0,180 500,180" stroke="#ddd" strokeWidth={1} />
                            <Polyline points="0,240 500,240" stroke="#ddd" strokeWidth={1} />

                            {/* Vertical Grid Lines */}
                            <Polyline points="100,0 100,300" stroke="#ddd" strokeWidth={1} />
                            <Polyline points="200,0 200,300" stroke="#ddd" strokeWidth={1} />
                            <Polyline points="300,0 300,300" stroke="#ddd" strokeWidth={1} />
                            <Polyline points="400,0 400,300" stroke="#ddd" strokeWidth={1} />
                        </Svg>

                        {/* Technical Markers (Overlay) */}
                        <Text style={{ position: 'absolute', top: 10, left: 5, fontSize: 6, color: '#888', fontFamily: 'Helvetica' }}>LAT 40.7128° N</Text>
                        <Text style={{ position: 'absolute', bottom: 10, left: 5, fontSize: 6, color: '#888', fontFamily: 'Helvetica' }}>SCALE 1:50000</Text>

                        {/* Vector Map */}
                        <Svg height="300" width="500" viewBox="0 0 500 300" style={{ position: 'absolute', top: 0, left: 0 }}>
                            <Polyline
                                points={mapPoints}
                                stroke="#FF4500" // Strava Orange
                                strokeWidth={3} // Thicker line
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </Svg>

                        <Text style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 8, color: '#aaa', fontFamily: 'Helvetica' }}>
                            VECTOR BLUEPRINT • SATELLITE DATA UNAVAILABLE
                        </Text>
                    </>
                )}
            </View>

            <View>
                <Text style={styles.sectionTitle}>Splits {rawSplits.length > 20 ? '(5km Summary)' : '(Metric)'}</Text>

                <View style={styles.splitsContainer}>
                    {/* Headers for columns */}
                    <View style={styles.splitHeader}>
                        <Text style={styles.splitHeaderText}>Dist</Text>
                        <Text style={styles.splitHeaderText}>Pace</Text>
                        <Text style={styles.splitHeaderText}>Elev</Text>
                    </View>
                    <View style={styles.splitHeader}>
                        <Text style={styles.splitHeaderText}>Dist</Text>
                        <Text style={styles.splitHeaderText}>Pace</Text>
                        <Text style={styles.splitHeaderText}>Elev</Text>
                    </View>

                    {displaySplits.map((split, i) => {
                        // Calculate pace from moving_time/distance
                        // split.distance is usually ~1000m or ~5000m
                        const paceSeconds = split.moving_time / (split.distance / 1000)
                        const paceMin = Math.floor(paceSeconds / 60)
                        const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

                        return (
                            <View key={i} style={styles.splitRow}>
                                <Text style={[styles.splitText, { width: 30 }]}>{split.label}</Text>
                                <Text style={styles.splitText}>{paceMin}:{paceSec}/km</Text>
                                <Text style={styles.splitText}>{split.elevation_difference > 0 ? '+' : ''}{Math.round(split.elevation_difference)}m</Text>
                            </View>
                        )
                    })}

                    {rawSplits.length === 0 && (
                        <Text style={{ fontSize: 10, color: '#999', padding: 10 }}>
                            No split data available. (Requires full activity detail fetch)
                        </Text>
                    )}
                </View>
            </View>

            {/* Best Efforts Section */}
            <BestEffortsTable activity={activity} maxEfforts={20} />
        </Page>
    )
}
