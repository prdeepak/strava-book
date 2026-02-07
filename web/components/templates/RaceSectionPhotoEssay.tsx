/**
 * RaceSectionPhotoEssay - "Photo Essay" race variant
 *
 * Leads with a 2-up or 3-up photo spread as the hero (no dark overlay).
 * Compact stats card below photos.
 * For races with 4+ great photos.
 * 1-2 pages total.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveActivityLocation, formatDuration, formatPace, formatDistanceValue, formatElevation } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImageCollection, CollectionPhoto } from '@/components/pdf/PdfImageCollection'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

interface RaceSectionPhotoEssayProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
}

// Get all photos from activity with dimensions
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
                        photos.push({
                            url: resolved,
                            width: size?.[0],
                            height: size?.[1],
                        })
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
                if (resolved) {
                    photos.push({ url: resolved })
                }
            }
        }
    }

    return photos
}

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const heading = resolveTypography('heading', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const stat = resolveTypography('stat', theme, format)
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        page: {
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
        header: {
            marginBottom: spacing.sm,
        },
        dateText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: spacing.xs * 0.25,
        },
        raceName: {
            fontSize: heading.fontSize,
            fontFamily: heading.fontFamily,
            color: theme.primaryColor,
            marginBottom: spacing.xs * 0.25,
        },
        locationText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '80',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        photoArea: {
            flex: 1,
            position: 'relative',
            marginBottom: spacing.sm,
            borderRadius: 4 * format.scaleFactor,
            overflow: 'hidden',
        },
        statsCard: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingVertical: spacing.sm,
            borderTopWidth: 2,
            borderTopColor: theme.primaryColor,
        },
        statItem: {
            alignItems: 'center',
        },
        statValue: {
            fontSize: stat.fontSize * 0.8,
            fontFamily: stat.fontFamily,
            color: theme.primaryColor,
            marginBottom: spacing.xs * 0.25,
        },
        statLabel: {
            fontSize: caption.fontSize * 0.85,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor + '60',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
    })
}

export const RaceSectionPhotoEssayPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    highlightLabel,
}: RaceSectionPhotoEssayProps) => {
    const styles = createStyles(format, theme)
    const heading = resolveTypography('heading', theme, format)
    const spacing = resolveSpacing(theme, format)

    const location = resolveActivityLocation(activity)
    const distanceKm = formatDistanceValue(activity.distance)
    const timeFormatted = formatDuration(activity.moving_time)
    const avgPace = formatPace(activity.moving_time, activity.distance)
    const elevationM = formatElevation(activity.total_elevation_gain)

    const photos = getPhotos(activity)
    // Show up to 3 photos on the hero spread
    const heroPhotos = photos.slice(0, 3)

    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    // Header approx height: dateText + raceName + locationText + margins
    const headerHeight = 60 * format.scaleFactor
    // Stats card height
    const statsHeight = 60 * format.scaleFactor
    const photoAreaHeight = format.dimensions.height - (format.safeMargin * 2) - headerHeight - statsHeight - spacing.sm

    const dateStr = new Date(activity.start_date_local || activity.start_date)
        .toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })

    return (
        <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
            <View style={styles.contentContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.dateText}>{highlightLabel || dateStr}</Text>
                    <AutoResizingPdfText
                        text={activity.name}
                        width={contentWidth}
                        height={heading.fontSize * 2}
                        font={heading.fontFamily}
                        min_fontsize={heading.minFontSize}
                        max_fontsize={heading.fontSize}
                        h_align="left"
                        v_align="top"
                        textColor={theme.primaryColor}
                    />
                    {location && <Text style={styles.locationText}>{location}</Text>}
                </View>

                {/* Photo spread - 2-up or 3-up */}
                <View style={[styles.photoArea, { height: photoAreaHeight }]}>
                    {heroPhotos.length > 0 && (
                        <PdfImageCollection
                            photos={heroPhotos}
                            containerWidth={contentWidth}
                            containerHeight={photoAreaHeight}
                            gap={6 * format.scaleFactor}
                            borderRadius={4 * format.scaleFactor}
                        />
                    )}
                </View>

                {/* Compact stats card */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{distanceKm}</Text>
                        <Text style={styles.statLabel}>km</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{timeFormatted}</Text>
                        <Text style={styles.statLabel}>time</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{avgPace}</Text>
                        <Text style={styles.statLabel}>pace</Text>
                    </View>
                    {activity.total_elevation_gain > 0 && (
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{elevationM}</Text>
                            <Text style={styles.statLabel}>elev</Text>
                        </View>
                    )}
                </View>
            </View>
        </Page>
    )
}
