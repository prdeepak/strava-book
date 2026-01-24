import { Page, Text, View, StyleSheet, Svg, Polyline, Image } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import mapboxPolyline from '@mapbox/polyline'
import { BestEffortsTable } from '@/components/pdf/BestEffortsTable'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

const createStyles = (format: BookFormat, theme: BookTheme) => {
    // Resolve design tokens
    const headingTypo = resolveTypography('heading', theme, format)
    const bodyTypo = resolveTypography('body', theme, format)
    const captionTypo = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)
    const effects = resolveEffects(theme)

    const mapHeight = Math.min(
        format.dimensions.height * 0.35,
        280 * format.scaleFactor
    )

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: format.safeMargin,
            flexDirection: 'column',
        },
        mapContainer: {
            height: mapHeight,
            backgroundColor: `${theme.primaryColor}08`,
            marginBottom: spacing.sm * 0.75,
            border: `1px solid ${theme.primaryColor}`,
            borderWidth: 0.5,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
        },
        sectionTitle: {
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: headingTypo.fontFamily,
            textTransform: 'uppercase',
            marginBottom: spacing.xs,
            marginTop: spacing.xs,
            color: theme.primaryColor,
            borderBottomWidth: 1.5,
            borderBottomColor: theme.accentColor,
            paddingBottom: spacing.xs / 2,
            letterSpacing: captionTypo.letterSpacing ?? 1.5,
        },
        splitsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: spacing.xs,
        },
        splitRow: {
            width: '48%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs / 2,
            borderBottomWidth: 0.5,
            borderBottomColor: `${theme.primaryColor}20`,
            paddingBottom: spacing.xs / 3,
            paddingHorizontal: spacing.xs / 2,
            marginRight: '2%'
        },
        splitLabel: {
            fontSize: captionTypo.fontSize,
            fontFamily: headingTypo.fontFamily,
            color: theme.primaryColor,
            width: '25%',
        },
        splitPace: {
            fontSize: captionTypo.fontSize,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity + 0.3,
            width: '45%',
            textAlign: 'center',
        },
        splitElev: {
            fontSize: captionTypo.fontSize * 0.9,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity + 0.2,
            width: '30%',
            textAlign: 'right',
        },
        splitHeader: {
            width: '48%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs * 0.75,
            paddingHorizontal: spacing.xs / 2,
            marginRight: '2%',
        },
        splitHeaderText: {
            fontSize: captionTypo.fontSize * 0.8,
            fontFamily: headingTypo.fontFamily,
            textTransform: 'uppercase',
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity,
            letterSpacing: 0.5,
        }
    })
}

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

export interface RaceSectionStatsPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken?: string
}

export const RaceSectionStatsPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
    mapboxToken
}: RaceSectionStatsPageProps) => {
    const styles = createStyles(format, theme)

    // Calculate map dimensions based on format
    const mapWidth = format.dimensions.width - (format.safeMargin * 2)
    const mapHeight = Math.min(
        format.dimensions.height * 0.35,
        280 * format.scaleFactor
    )

    const mapPoints = normalizePoints(activity.map.summary_polyline, mapWidth, mapHeight)

    // Fallback if no splits fetched (default api call might not have them without effort detail)
    const rawSplits = activity.splits_metric || []

    // Aggregate splits if there are too many
    // Limit to max 10 displayed splits to ensure everything fits on one page with best efforts
    const MAX_DISPLAY_SPLITS = 10
    let displaySplits = []

    if (rawSplits.length > 20) {
        // Group by 5km for very long races
        const chunkSize = 5
        for (let i = 0; i < rawSplits.length; i += chunkSize) {
            const chunk = rawSplits.slice(i, i + chunkSize)
            const last = chunk[chunk.length - 1]

            // Sum moving time
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
        // Limit to max splits
        displaySplits = displaySplits.slice(0, MAX_DISPLAY_SPLITS)
    } else {
        displaySplits = rawSplits.map(s => ({ ...s, label: `${s.split}km` }))
    }

    // Map Rendering Logic
    // If we have a Mapbox Token, use the Static Images API for satellite view
    console.log("[Race_2pRight] Mapbox Token Prop:", !!mapboxToken)
    let satelliteUrl: string | null = null
    if (mapboxToken && activity.map.summary_polyline) {
        // Construct detailed Mapbox Static URL
        // Style: Satellite V9
        // Path: Stroke Width 5, Color Orange (#fc4c02), Opacity 0.8
        const pathParam = `path-5+fc4c02-0.8(${encodeURIComponent(activity.map.summary_polyline)})`
        const rawUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pathParam}/auto/600x400?access_token=${mapboxToken}&logo=false&attrib=false`

        // Use resolveImageForPdf for server-side PDF rendering (returns the URL directly)
        satelliteUrl = resolveImageForPdf(rawUrl)
        console.log("[Race_2pRight] Resolved Satellite URL:", satelliteUrl ? 'OK' : 'null')
    }

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.mapContainer}>
                {satelliteUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={satelliteUrl} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <>
                        {/* Blueprint Grid Background */}
                        <Svg height={mapHeight} width={mapWidth} viewBox={`0 0 ${mapWidth} ${mapHeight}`} style={{ position: 'absolute', top: 0, left: 0, backgroundColor: `${theme.primaryColor}08` }}>
                            {/* Horizontal Grid Lines */}
                            {Array.from({ length: 5 }).map((_, i) => {
                                const y = (mapHeight / 5) * (i + 1)
                                return <Polyline key={`h${i}`} points={`0,${y} ${mapWidth},${y}`} stroke={`${theme.primaryColor}20`} strokeWidth={0.5} />
                            })}

                            {/* Vertical Grid Lines */}
                            {Array.from({ length: 5 }).map((_, i) => {
                                const x = (mapWidth / 5) * (i + 1)
                                return <Polyline key={`v${i}`} points={`${x},0 ${x},${mapHeight}`} stroke={`${theme.primaryColor}20`} strokeWidth={0.5} />
                            })}
                        </Svg>

                        {/* Vector Map */}
                        <Svg height={mapHeight} width={mapWidth} viewBox={`0 0 ${mapWidth} ${mapHeight}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                            <Polyline
                                points={mapPoints}
                                stroke={theme.accentColor}
                                strokeWidth={3 * format.scaleFactor}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </Svg>

                        <Text style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            fontSize: resolveTypography('caption', theme, format).fontSize * 0.8,
                            color: theme.primaryColor,
                            opacity: resolveEffects(theme).backgroundImageOpacity,
                            fontFamily: theme.fontPairing.body
                        }}>
                            VECTOR MAP
                        </Text>
                    </>
                )}
            </View>

            {/* Splits Section - only show if data exists */}
            {displaySplits.length > 0 && (
                <View>
                    <Text style={styles.sectionTitle}>Splits {rawSplits.length > 20 ? '(5km Summary)' : '(Metric)'}</Text>

                    <View style={styles.splitsContainer}>
                        {/* Headers for columns */}
                        <View style={styles.splitHeader}>
                            <Text style={[styles.splitHeaderText, { width: '25%' }]}>Dist</Text>
                            <Text style={[styles.splitHeaderText, { width: '45%', textAlign: 'center' }]}>Pace</Text>
                            <Text style={[styles.splitHeaderText, { width: '30%', textAlign: 'right' }]}>Elev</Text>
                        </View>
                        <View style={styles.splitHeader}>
                            <Text style={[styles.splitHeaderText, { width: '25%' }]}>Dist</Text>
                            <Text style={[styles.splitHeaderText, { width: '45%', textAlign: 'center' }]}>Pace</Text>
                            <Text style={[styles.splitHeaderText, { width: '30%', textAlign: 'right' }]}>Elev</Text>
                        </View>

                        {displaySplits.map((split, i) => {
                            // Calculate pace from moving_time/distance
                            const paceSeconds = split.moving_time / (split.distance / 1000)
                            const paceMin = Math.floor(paceSeconds / 60)
                            const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')
                            const elev = Math.round(split.elevation_difference)

                            return (
                                <View key={i} style={styles.splitRow}>
                                    <Text style={styles.splitLabel}>{split.label}</Text>
                                    <Text style={styles.splitPace}>{paceMin}:{paceSec}/km</Text>
                                    <Text style={styles.splitElev}>{elev > 0 ? '+' : ''}{elev}m</Text>
                                </View>
                            )
                        })}
                    </View>
                </View>
            )}

            {/* Best Efforts Section */}
            {/* Limit best efforts based on splits count to ensure everything fits */}
            <BestEffortsTable
                activity={activity}
                format={format}
                theme={theme}
                maxEfforts={displaySplits.length > 0 ? 6 : 14}
            />
        </Page>
    )
}

// Legacy export for backwards compatibility
export const Race_2pRight = RaceSectionStatsPage
