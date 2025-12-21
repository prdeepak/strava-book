import { Page, Text, View, Document, StyleSheet, Image, Svg, Polyline, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import mapboxPolyline from '@mapbox/polyline'
import { SplitsChartSVG } from '@/lib/generateSplitsChart'
import { StatsGrid } from '@/components/pdf/StatsGrid'
import { Header } from '@/components/pdf/Header'
import { CommentsSection } from '@/components/pdf/CommentsSection'
import { BestEffortsTable } from '@/components/pdf/BestEffortsTable'

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

interface Race_1pProps {
    activity: StravaActivity
    mapboxToken?: string
}

export const Race_1p = ({ activity, mapboxToken }: Race_1pProps) => {
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
    // Prepare chart data - prefer laps over splits
    // Laps represent manual lap markers (e.g., race laps), splits are auto-generated per km
    const rawLaps = activity.laps || []
    const rawSplits = activity.splits_metric || []

    let displaySplits = []
    if (rawLaps.length > 0) {
        // Use laps if available
        displaySplits = rawLaps.map(lap => ({
            split: lap.lap_index,
            label: lap.name || `Lap ${lap.lap_index}`,
            moving_time: lap.moving_time,
            distance: lap.distance,
            elevation_difference: lap.total_elevation_gain
        }))
    } else {
        // Fall back to splits
        displaySplits = rawSplits.map(s => ({ ...s, label: s.split.toString() }))
    }








    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Hero Header - Title and Meta at Top */}
                <Header activity={activity} />

                {/* Images Section - Photo and/or Map */}
                {hasBothImages && (
                    <View style={styles.imagesSection}>
                        <View style={styles.imageContainer}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image src={stravaPhoto!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </View>
                        <View style={styles.imageContainer}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image src={satelliteMap!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </View>
                    </View>
                )}

                {hasOnlyPhoto && (
                    <View style={styles.fullWidthImage}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image src={stravaPhoto!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </View>
                )}

                {hasOnlyMap && (
                    <View style={styles.fullWidthImage}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
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
                <StatsGrid activity={activity} />

                {/* Three-column layout for splits chart, best efforts, and comments */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {/* Splits Chart Column */}
                    {displaySplits.length > 0 && (
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>Splits</Text>
                            <SplitsChartSVG
                                splits={displaySplits}
                                totalTime={activity.moving_time}
                                width={180}
                                height={120}
                            />
                        </View>
                    )}

                    {/* Best Efforts Column */}
                    {/* Best Efforts Column */}
                    <BestEffortsTable activity={activity} />

                    {/* Comments/Kudos Column */}
                    {/* Comments Column */}
                    <CommentsSection activity={activity} />
                </View>

                <View style={styles.footer}>
                    <Text>Generated by Strava Book • {activity.type}</Text>
                </View>
            </Page>
        </Document>
    )
}
