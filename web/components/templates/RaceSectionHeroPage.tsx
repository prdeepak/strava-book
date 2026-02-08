import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveActivityLocation, formatDistanceValue, formatTime, formatPace, formatElevation } from '@/lib/activity-utils'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { PdfImage } from '@/components/pdf/PdfImage'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

/**
 * Convert hex color to rgba with opacity
 */
function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return `rgba(0,0,0,${opacity})`
    const r = parseInt(result[1], 16)
    const g = parseInt(result[2], 16)
    const b = parseInt(result[3], 16)
    return `rgba(${r},${g},${b},${opacity})`
}

const createStyles = (format: BookFormat, theme: BookTheme, hasImage: boolean) => {
    // Resolve typography from theme
    const heading = resolveTypography('heading', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const spacing = resolveSpacing(theme, format)
    const effects = resolveEffects(theme)

    // Use theme colors with opacity for overlays
    // Content overlay is denser (2x) than gradient overlay for text readability
    const overlayColor = hexToRgba(theme.primaryColor, effects.textOverlayOpacity)
    const contentOverlayColor = hexToRgba(theme.primaryColor, effects.textOverlayOpacity * 2)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.primaryColor,
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 0,
            position: 'relative',
        },
        // Background image container - PdfImage handles positioning
        backgroundImageContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
        },
        // Full-height gradient overlay for better text readability
        gradientOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: hasImage ? overlayColor : 'transparent',
        },
        contentOverlay: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            padding: format.safeMargin,
            paddingTop: spacing.md,
            backgroundColor: hasImage ? contentOverlayColor : 'transparent',
        },
        highlightLabel: {
            color: theme.accentColor,
            fontSize: caption.fontSize,
            marginBottom: spacing.xs,
            fontFamily: caption.fontFamily,
            textTransform: 'uppercase',
            letterSpacing: 2,
        },
        meta: {
            color: hexToRgba(theme.backgroundColor, 0.9),
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs / 2,
        },
        title: {
            fontSize: heading.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.backgroundColor,
            textTransform: 'uppercase',
            marginBottom: spacing.sm,
            marginTop: spacing.xs,
            lineHeight: heading.lineHeight || 1.1,
            maxWidth: '100%',
            letterSpacing: heading.letterSpacing || 1,
        },
        statsRow: {
            flexDirection: 'row',
            marginTop: spacing.sm,
            borderTopWidth: 2,
            borderTopColor: theme.accentColor,
            paddingTop: spacing.sm,
            gap: spacing.md,
        },
        stat: {
            flex: 1,
            maxWidth: '30%',
        },
        statValue: {
            color: theme.backgroundColor,
            fontSize: stat.fontSize,
            fontFamily: stat.fontFamily,
            lineHeight: 1.1,
        },
        statLabel: {
            color: hexToRgba(theme.backgroundColor, 0.75),
            fontSize: caption.fontSize,
            marginTop: spacing.xs / 2,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            fontFamily: caption.fontFamily,
        }
    })
}

export interface RaceSectionHeroPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    highlightLabel?: string
    mapboxToken?: string
}

export const RaceSectionHeroPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
    highlightLabel,
    mapboxToken
}: RaceSectionHeroPageProps) => {
    // Get photo with dimensions from comprehensive data (preferred) or primary
    let bgImage: string | null = null
    let bgSourceWidth: number | undefined
    let bgSourceHeight: number | undefined
    const photos = extractPhotos(activity)
    if (photos.length > 0) {
        bgImage = photos[0].url
        bgSourceWidth = photos[0].width
        bgSourceHeight = photos[0].height
    }

    // Fallback: use Mapbox satellite map of the route when no photo is available
    if (!bgImage && mapboxToken && activity.map?.summary_polyline) {
        const pathParam = `path-5+fc4c02-0.8(${encodeURIComponent(activity.map.summary_polyline)})`
        const rawUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pathParam}/auto/600x600?access_token=${mapboxToken}&logo=false&attrib=false`
        bgImage = resolveImageForPdf(rawUrl)
        bgSourceWidth = 1200  // 600@2x
        bgSourceHeight = 1200
    }

    const styles = createStyles(format, theme, !!bgImage)
    const heading = resolveTypography('heading', theme, format)

    // Use utility function for location resolution
    const location = resolveActivityLocation(activity)

    // Format stats using shared formatters
    const distance = formatDistanceValue(activity.distance || 0)
    const time = formatTime(activity.moving_time || 0)
    const pace = formatPace(activity.moving_time, activity.distance)

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            {/* Background Image Layer */}
            {bgImage && (
                <View style={styles.backgroundImageContainer}>
                    <PdfImage
                        src={bgImage}
                        opacity={0.65}
                        containerWidth={format.dimensions.width}
                        containerHeight={format.dimensions.height}
                        sourceWidth={bgSourceWidth}
                        sourceHeight={bgSourceHeight}
                    />
                </View>
            )}

            {/* Full-height gradient overlay for better overall text readability */}
            <View style={styles.gradientOverlay} />

            {/* Content Overlay at Bottom */}
            <View style={styles.contentOverlay}>
                {highlightLabel && (
                    <Text style={styles.highlightLabel}>
                        {highlightLabel}
                    </Text>
                )}

                <Text style={styles.meta}>
                    {new Date(activity.start_date).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </Text>

                {location ? <Text style={styles.meta}>{location}</Text> : null}

                <AutoResizingPdfText
                    text={activity.name}
                    width={format.dimensions.width - (format.safeMargin * 2)}
                    height={heading.fontSize * 2.5}
                    font={heading.fontFamily}
                    min_fontsize={heading.minFontSize}
                    max_fontsize={heading.fontSize}
                    h_align="left"
                    v_align="bottom"
                    textColor={theme.backgroundColor}
                />

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{distance}</Text>
                        <Text style={styles.statLabel}>Kilometers</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{time}</Text>
                        <Text style={styles.statLabel}>Time</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{pace}</Text>
                        <Text style={styles.statLabel}>Avg Pace</Text>
                    </View>
                    {activity.total_elevation_gain > 0 && (
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{formatElevation(activity.total_elevation_gain)}</Text>
                            <Text style={styles.statLabel}>Climbed</Text>
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}

// Legacy export for backwards compatibility
export const Race_2pLeft = RaceSectionHeroPage
