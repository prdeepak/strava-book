/**
 * PhotoGallery - Photo Gallery Template using PdfImageCollection
 *
 * Features:
 * - Automatic grid-based layout via PdfImageCollection
 * - Header with activity info
 * - Footer with stats
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveActivityLocation, formatDistance, formatTime } from '@/lib/activity-utils'
import { extractPhotos, PhotoData } from '@/lib/photo-gallery-utils'
import { PdfImageCollection, CollectionPhoto } from '@/components/pdf/PdfImageCollection'

// ============================================================================
// TYPES
// ============================================================================

export interface PhotoGalleryProps {
    activity?: StravaActivity
    photos?: PhotoData[]  // Allow direct photo array for flexibility
    format?: BookFormat
    theme?: BookTheme
    title?: string
    gap?: number
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const scale = format.scaleFactor

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: '#ffffff',
            padding: format.safeMargin,
        },
        header: {
            marginBottom: 16 * scale,
        },
        sectionLabel: {
            color: theme.accentColor,
            fontSize: Math.max(9, 10 * scale),
            fontFamily: theme.fontPairing.heading,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 4 * scale,
        },
        title: {
            fontSize: Math.max(18, 24 * scale),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor,
            marginBottom: 4 * scale,
        },
        subtitle: {
            fontSize: Math.max(10, 12 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#666666',
        },
        galleryContainer: {
            flex: 1,
            position: 'relative',
        },
        footer: {
            marginTop: 12 * scale,
            paddingTop: 8 * scale,
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        footerText: {
            fontSize: Math.max(8, 9 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#999999',
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emptyText: {
            fontSize: Math.max(14, 16 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#cccccc',
        },
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert PhotoData to CollectionPhoto format
 */
function toCollectionPhotos(photos: PhotoData[]): CollectionPhoto[] {
    return photos.map(p => ({
        url: p.url,
        width: p.width,
        height: p.height,
    }))
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PhotoGallery = ({
    activity,
    photos: photosProp,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    title,
    gap = 4,
}: PhotoGalleryProps) => {
    const styles = createStyles(format, theme)
    const scale = format.scaleFactor

    // Get photos from props or activity
    const photos = photosProp || (activity ? extractPhotos(activity) : [])
    const collectionPhotos = toCollectionPhotos(photos)

    // Calculate gallery dimensions (accounting for margins)
    const galleryWidth = format.dimensions.width - (format.safeMargin * 2)

    // Header height: sectionLabel (~12) + title (~28) + subtitle (~14) + marginBottom (16) ≈ 70
    const hasHeader = !!(title || activity)
    const headerHeight = hasHeader ? 70 * scale : 0

    // Footer height: marginTop (12) + paddingTop (8) + text (~12) ≈ 32
    const hasFooter = !!activity
    const footerHeight = hasFooter ? 32 * scale : 0

    const galleryHeight = format.dimensions.height - (format.safeMargin * 2) - headerHeight - footerHeight

    // Format activity metadata
    const date = activity ? new Date(activity.start_date_local).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }) : ''
    const location = activity ? resolveActivityLocation(activity) : ''

    return (
        <Document>
            <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page} wrap={false}>
                {/* Header */}
                {hasHeader && (
                    <View style={styles.header}>
                        <Text style={styles.sectionLabel}>Photo Gallery</Text>
                        <Text style={styles.title}>{title || activity?.name || 'Untitled'}</Text>
                        {activity && (
                            <Text style={styles.subtitle}>{date}{location ? ` | ${location}` : ''}</Text>
                        )}
                    </View>
                )}

                {/* Gallery container */}
                <View style={[styles.galleryContainer, { height: galleryHeight }]}>
                    {photos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No photos available</Text>
                        </View>
                    ) : (
                        <PdfImageCollection
                            photos={collectionPhotos}
                            containerWidth={galleryWidth}
                            containerHeight={galleryHeight}
                            gap={gap * scale}
                        />
                    )}
                </View>

                {/* Footer with activity stats */}
                {hasFooter && (
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            {formatDistance(activity!.distance, 'metric')} | {formatTime(activity!.moving_time)}
                        </Text>
                        <Text style={styles.footerText}>
                            {photos.length} photo{photos.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                )}
            </Page>
        </Document>
    )
}

// Export pages version for embedding in larger documents
export const PhotoGalleryPage = ({
    activity,
    photos: photosProp,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    title,
    gap = 4,
}: PhotoGalleryProps) => {
    const styles = createStyles(format, theme)
    const scale = format.scaleFactor

    const photos = photosProp || (activity ? extractPhotos(activity) : [])
    const collectionPhotos = toCollectionPhotos(photos)

    const galleryWidth = format.dimensions.width - (format.safeMargin * 2)

    const hasHeader = !!(title || activity)
    const headerHeight = hasHeader ? 70 * scale : 0

    const hasFooter = !!activity
    const footerHeight = hasFooter ? 32 * scale : 0

    const galleryHeight = format.dimensions.height - (format.safeMargin * 2) - headerHeight - footerHeight

    const date = activity ? new Date(activity.start_date_local).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }) : ''
    const location = activity ? resolveActivityLocation(activity) : ''

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page} wrap={false}>
            {hasHeader && (
                <View style={styles.header}>
                    <Text style={styles.sectionLabel}>Photo Gallery</Text>
                    <Text style={styles.title}>{title || activity?.name || 'Untitled'}</Text>
                    {activity && (
                        <Text style={styles.subtitle}>{date}{location ? ` | ${location}` : ''}</Text>
                    )}
                </View>
            )}

            <View style={[styles.galleryContainer, { height: galleryHeight }]}>
                {photos.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No photos available</Text>
                    </View>
                ) : (
                    <PdfImageCollection
                        photos={collectionPhotos}
                        containerWidth={galleryWidth}
                        containerHeight={galleryHeight}
                        gap={gap * scale}
                    />
                )}
            </View>

            {hasFooter && (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {formatDistance(activity!.distance, 'metric')} | {formatTime(activity!.moving_time)}
                    </Text>
                    <Text style={styles.footerText}>
                        {photos.length} photo{photos.length !== 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </Page>
    )
}
