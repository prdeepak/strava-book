/**
 * RaceSectionMagazine - "Magazine" race variant
 *
 * A 4-page magazine-style editorial layout:
 * Page 1: Full-bleed hero photo with race name overlaid at top-left
 * Page 2: "Race Report" with two-column text layout and small route map
 * Page 3: Full-page photo collage/mosaic
 * Page 4: "The Brief" stats page with distance/time/pace, splits chart, and community
 */

import { Page, View, Text, StyleSheet, Font, Svg, Polyline } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { formatDuration, formatPace, formatDistanceValue, getMapboxLightUrl } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImage } from '@/components/pdf/PdfImage'
import { PdfImageCollection, CollectionPhoto } from '@/components/pdf/PdfImageCollection'
import { RaceDataViz } from '@/components/pdf/RaceDataViz'
import mapboxPolyline from '@mapbox/polyline'

Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

interface RaceSectionMagazineProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return `rgba(0,0,0,${opacity})`
    return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${opacity})`
}

const getPhotos = (activity: StravaActivity): CollectionPhoto[] => {
    const photos: CollectionPhoto[] = []
    if (activity.comprehensiveData?.photos?.length) {
        activity.comprehensiveData.photos.forEach((photo) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const photoAny = photo as any
            const photoUrls = photoAny.urls as Record<string, string> | undefined
            const photoSizes = photoAny.sizes as Record<string, [number, number]> | undefined
            if (photoUrls) {
                const url = photoUrls['5000'] || photoUrls['600'] || Object.values(photoUrls)[0]
                if (url) {
                    const resolved = resolveImageForPdf(url)
                    if (resolved) {
                        const size = photoSizes?.['5000'] || photoSizes?.['600']
                        photos.push({ url: resolved, width: size?.[0], height: size?.[1] })
                    }
                }
            }
        })
    }
    if (photos.length === 0) {
        const primaryUrls = activity.photos?.primary?.urls as Record<string, string> | undefined
        if (primaryUrls) {
            const url = primaryUrls['600'] || primaryUrls['5000'] || Object.values(primaryUrls)[0]
            if (url) {
                const resolved = resolveImageForPdf(url)
                if (resolved) photos.push({ url: resolved })
            }
        }
    }
    return photos
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

// PAGE 1: Full-bleed Hero
const HeroPage = ({ activity, format, theme, mapboxToken }: { activity: StravaActivity; format: BookFormat; theme: BookTheme; mapboxToken: string }) => {
    const displaySmall = resolveTypography('displaySmall', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)
    const effects = resolveEffects(theme)
    let bgImage: string | null = null
    const primaryUrls = activity.photos?.primary?.urls as Record<string, string> | undefined
    if (primaryUrls) {
        const rawUrl = primaryUrls['600'] || primaryUrls['5000'] || primaryUrls['100'] || Object.values(primaryUrls)[0]
        if (rawUrl) bgImage = resolveImageForPdf(rawUrl)
    }
    if (!bgImage && mapboxToken && activity.map?.summary_polyline) {
        const pathParam = `path-5+fc4c02-0.8(${encodeURIComponent(activity.map.summary_polyline)})`
        bgImage = resolveImageForPdf(`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pathParam}/auto/600x600?access_token=${mapboxToken}&logo=false&attrib=false`)
    }
    const overlayColor = hexToRgba(theme.primaryColor, effects.textOverlayOpacity)
    const dateStr = new Date(activity.start_date_local || activity.start_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
    const styles = StyleSheet.create({
        page: { width: format.dimensions.width, height: format.dimensions.height, backgroundColor: theme.primaryColor, padding: 0, position: 'relative' },
        bgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' },
        overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: bgImage ? overlayColor : 'transparent' },
        content: { position: 'absolute', top: format.safeMargin, left: format.safeMargin, right: format.safeMargin, bottom: format.safeMargin, flexDirection: 'column', justifyContent: 'flex-start' },
        label: { fontSize: caption.fontSize, fontFamily: caption.fontFamily, color: theme.accentColor, textTransform: 'uppercase', letterSpacing: 3, marginBottom: spacing.sm },
        raceName: { fontSize: displaySmall.fontSize, fontFamily: displaySmall.fontFamily, color: theme.backgroundColor, textTransform: 'uppercase', lineHeight: 1.15, letterSpacing: displaySmall.letterSpacing || 1, marginBottom: spacing.sm },
        dateText: { fontSize: caption.fontSize, fontFamily: caption.fontFamily, color: hexToRgba(theme.backgroundColor, 0.85), textTransform: 'uppercase', letterSpacing: 2 },
    })
    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            {bgImage && <View style={styles.bgContainer}><PdfImage src={bgImage} opacity={0.7} containerWidth={format.dimensions.width} containerHeight={format.dimensions.height} /></View>}
            <View style={styles.overlay} />
            <View style={styles.content}>
                <Text style={styles.label}>RACE NAME</Text>
                <Text style={styles.raceName}>{activity.name}</Text>
                <Text style={styles.dateText}>DATE: {dateStr}</Text>
            </View>
        </Page>
    )
}

// PAGE 2: Race Report
const RaceReportPage = ({ activity, format, theme, mapboxToken }: { activity: StravaActivity; format: BookFormat; theme: BookTheme; mapboxToken: string }) => {
    const heading = resolveTypography('heading', theme, format)
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)
    const description = activity.description || 'No race report available for this activity.'
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const mapW = 160 * format.scaleFactor, mapH = 120 * format.scaleFactor
    const hasPolyline = !!activity.map?.summary_polyline
    const mapPoints = hasPolyline ? normalizePoints(activity.map!.summary_polyline, mapW, mapH) : ''
    let mapUrl: string | null = null
    if (mapboxToken && hasPolyline) mapUrl = resolveImageForPdf(getMapboxLightUrl(activity.map!.summary_polyline, mapboxToken, Math.round(mapW * 2), Math.round(mapH * 2)))
    const words = description.split(/\s+/)
    const mid = Math.ceil(words.length / 2)
    const col1 = words.slice(0, mid).join(' '), col2 = words.slice(mid).join(' ')
    const gap = spacing.md, colW = (contentWidth - gap) / 2
    const styles = StyleSheet.create({
        page: { width: format.dimensions.width, height: format.dimensions.height, backgroundColor: theme.backgroundColor, padding: 0, position: 'relative' },
        content: { position: 'absolute', top: format.safeMargin, left: format.safeMargin, right: format.safeMargin, bottom: format.safeMargin, flexDirection: 'column' },
        headerText: { fontSize: heading.fontSize, fontFamily: heading.fontFamily, color: theme.primaryColor, textTransform: 'uppercase', letterSpacing: heading.letterSpacing || 2, marginBottom: spacing.xs },
        divider: { height: 3, backgroundColor: theme.accentColor, width: 50 * format.scaleFactor, marginBottom: spacing.md },
        columns: { flex: 1, flexDirection: 'row', gap },
        column: { width: colW, flexDirection: 'column' },
        bodyText: { fontSize: body.fontSize, fontFamily: body.fontFamily, color: theme.primaryColor, lineHeight: body.lineHeight || 1.5 },
        mapSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
        mapContainer: { width: mapW, height: mapH, backgroundColor: theme.surfaceColor ?? theme.backgroundColor, borderWidth: 0.5, borderColor: theme.primaryColor + '30', overflow: 'hidden', position: 'relative' },
        pageNumber: { position: 'absolute', bottom: 0, right: 0, fontSize: caption.fontSize * 0.85, fontFamily: caption.fontFamily, color: theme.primaryColor + '40' },
    })
    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.content}>
                <Text style={styles.headerText}>Race Report</Text>
                <View style={styles.divider} />
                <View style={styles.columns}>
                    <View style={styles.column}><Text style={styles.bodyText}>{col1}</Text></View>
                    <View style={styles.column}><Text style={styles.bodyText}>{col2}</Text></View>
                </View>
                {hasPolyline && (
                    <View style={styles.mapSection}><View style={styles.mapContainer}>
                        {mapUrl ? (
                            <PdfImage src={mapUrl} containerWidth={mapW} containerHeight={mapH} />
                        ) : mapPoints ? (
                            <Svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                                <Polyline points={mapPoints} stroke={theme.accentColor} strokeWidth={2 * format.scaleFactor} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </Svg>
                        ) : null}
                    </View></View>
                )}
                <Text style={styles.pageNumber}>2</Text>
            </View>
        </Page>
    )
}

// PAGE 3: Photo Collage
const PhotoCollagePage = ({ activity, format, theme }: { activity: StravaActivity; format: BookFormat; theme: BookTheme }) => {
    const photos = getPhotos(activity).slice(0, 6)
    const margin = format.safeMargin * 0.5
    const cW = format.dimensions.width - (margin * 2), cH = format.dimensions.height - (margin * 2)
    const styles = StyleSheet.create({
        page: { width: format.dimensions.width, height: format.dimensions.height, backgroundColor: theme.primaryColor, padding: 0, position: 'relative' },
        container: { position: 'absolute', top: margin, left: margin, width: cW, height: cH },
    })
    if (photos.length === 0) return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.container}><Text style={{ fontSize: 14 * format.scaleFactor, fontFamily: theme.fontPairing.body, color: theme.backgroundColor + '60', textAlign: 'center', marginTop: cH / 2 - 10 }}>No photos available</Text></View>
        </Page>
    )
    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.container}><PdfImageCollection photos={photos} containerWidth={cW} containerHeight={cH} gap={4 * format.scaleFactor} /></View>
        </Page>
    )
}

// PAGE 4: The Brief Stats
const TheBriefPage = ({ activity, format, theme }: { activity: StravaActivity; format: BookFormat; theme: BookTheme }) => {
    const displaySmall = resolveTypography('displaySmall', theme, format)
    const heading = resolveTypography('heading', theme, format)
    const subheading = resolveTypography('subheading', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const distKm = formatDistanceValue(activity.distance)
    const timeFmt = formatDuration(activity.moving_time)
    const pace = formatPace(activity.moving_time, activity.distance)
    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0
    const comments = activity.comprehensiveData?.comments || activity.comments || []
    const dispComments = [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)
    const kudos = activity.kudos_count || 0
    const chartH = 130 * format.scaleFactor
    const fDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const styles = StyleSheet.create({
        page: { width: format.dimensions.width, height: format.dimensions.height, backgroundColor: theme.backgroundColor, padding: 0, position: 'relative' },
        content: { position: 'absolute', top: format.safeMargin, left: format.safeMargin, right: format.safeMargin, bottom: format.safeMargin, flexDirection: 'column' },
        headerText: { fontSize: displaySmall.fontSize, fontFamily: displaySmall.fontFamily, color: theme.primaryColor, marginBottom: spacing.sm },
        headerDivider: { height: 3, backgroundColor: theme.accentColor, width: 50 * format.scaleFactor, marginBottom: spacing.md },
        statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.primaryColor + '20' },
        statItem: { flex: 1, alignItems: 'center' },
        statValue: { fontSize: stat.fontSize, fontFamily: stat.fontFamily, color: theme.primaryColor, marginBottom: spacing.xs * 0.5 },
        statLabel: { fontSize: caption.fontSize, fontFamily: caption.fontFamily, color: theme.primaryColor + '60', textTransform: 'uppercase', letterSpacing: 1.5 },
        splitsSection: { marginBottom: spacing.md },
        sectionTitle: { fontSize: subheading.fontSize * 0.85, fontFamily: subheading.fontFamily, color: theme.primaryColor, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.sm },
        communitySection: { flex: 1 },
        communityHeader: { fontSize: caption.fontSize, fontFamily: heading.fontFamily, color: theme.primaryColor, marginBottom: spacing.xs },
        kudosBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accentColor, padding: spacing.xs, borderRadius: 6 * format.scaleFactor, marginBottom: spacing.sm },
        kudosEmoji: { fontSize: caption.fontSize * 1.5, marginRight: spacing.xs * 0.5 },
        kudosCountText: { fontSize: subheading.fontSize * 0.9, fontFamily: heading.fontFamily, color: theme.textOverAccent ?? theme.backgroundColor },
        kudosLabel: { fontSize: caption.fontSize * 0.85, fontFamily: body.fontFamily, color: hexToRgba(theme.textOverAccent ?? theme.backgroundColor, 0.8), marginLeft: spacing.xs * 0.5 },
        commentsContainer: { flexDirection: 'row', gap: spacing.sm },
        commentsColumn: { flex: 1 },
        comment: { marginBottom: spacing.xs, paddingBottom: spacing.xs, borderBottomWidth: 0.5, borderBottomColor: theme.borderColor ?? theme.primaryColor + '20' },
        commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 * format.scaleFactor },
        commentAuthor: { fontSize: caption.fontSize * 0.9, fontFamily: heading.fontFamily, color: theme.primaryColor },
        commentDate: { fontSize: caption.fontSize * 0.75, fontFamily: body.fontFamily, color: theme.primaryColor + '99' },
        commentText: { fontSize: caption.fontSize * 0.9, fontFamily: body.fontFamily, color: theme.primaryColor + 'CC', lineHeight: 1.4 },
    })
    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.content}>
                <Text style={styles.headerText}>The Brief</Text>
                <View style={styles.headerDivider} />
                <View style={styles.statsRow}>
                    <View style={styles.statItem}><Text style={styles.statValue}>{distKm}</Text><Text style={styles.statLabel}>KM</Text></View>
                    <View style={styles.statItem}><Text style={styles.statValue}>{timeFmt}</Text><Text style={styles.statLabel}>Time</Text></View>
                    <View style={styles.statItem}><Text style={styles.statValue}>{pace}</Text><Text style={styles.statLabel}>Pace</Text></View>
                </View>
                {hasSplits && (
                    <View style={styles.splitsSection}>
                        <Text style={styles.sectionTitle}>Kilometer Split</Text>
                        <RaceDataViz
                            splits={splits.map((sp, i) => {
                                const spl = sp as { split?: number; elevation_difference?: number; total_elevation_gain?: number }
                                return { split: spl.split ?? i + 1, moving_time: sp.moving_time, distance: sp.distance, elevation_difference: spl.elevation_difference ?? spl.total_elevation_gain ?? 0 }
                            })}
                            totalTime={activity.moving_time}
                            width={contentWidth}
                            height={chartH}
                            showSplits={true}
                            showElevation={false}
                            theme={theme}
                        />
                    </View>
                )}
                <View style={styles.communitySection}>
                    <Text style={styles.sectionTitle}>Community</Text>
                    <Text style={styles.communityHeader}>Support & Comments</Text>
                    {kudos > 0 && (
                        <View style={styles.kudosBanner}>
                            <Text style={styles.kudosEmoji}>&#128077;</Text>
                            <Text style={styles.kudosCountText}>{kudos}</Text>
                            <Text style={styles.kudosLabel}>people gave you kudos</Text>
                        </View>
                    )}
                    {dispComments.length > 0 && (
                        <View style={styles.commentsContainer}>
                            <View style={styles.commentsColumn}>
                                {dispComments.slice(0, Math.ceil(dispComments.length / 2)).map((c, i) => (
                                    <View key={i} style={styles.comment}>
                                        <View style={styles.commentHeader}><Text style={styles.commentAuthor}>{c.athlete.firstname} {c.athlete.lastname}</Text><Text style={styles.commentDate}>{fDate(c.created_at)}</Text></View>
                                        <Text style={styles.commentText}>{c.text.length > 100 ? c.text.substring(0, 100) + '...' : c.text}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.commentsColumn}>
                                {dispComments.slice(Math.ceil(dispComments.length / 2)).map((c, i) => (
                                    <View key={i} style={styles.comment}>
                                        <View style={styles.commentHeader}><Text style={styles.commentAuthor}>{c.athlete.firstname} {c.athlete.lastname}</Text><Text style={styles.commentDate}>{fDate(c.created_at)}</Text></View>
                                        <Text style={styles.commentText}>{c.text.length > 100 ? c.text.substring(0, 100) + '...' : c.text}</Text>
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

export const RaceSectionMagazinePages = ({ activity, format = FORMATS['10x10'], theme = DEFAULT_THEME, mapboxToken }: RaceSectionMagazineProps) => (
    <>
        <HeroPage activity={activity} format={format} theme={theme} mapboxToken={mapboxToken} />
        <RaceReportPage activity={activity} format={format} theme={theme} mapboxToken={mapboxToken} />
        <PhotoCollagePage activity={activity} format={format} theme={theme} />
        <TheBriefPage activity={activity} format={format} theme={theme} />
    </>
)
