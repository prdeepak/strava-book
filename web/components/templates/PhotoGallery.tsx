/**
 * PhotoGallery - Multi-Photo Artistic Layouts Template
 *
 * Features:
 * - Multiple layout variants: single-hero, side-by-side, triptych, quad-grid, masonry, collage
 * - B&W treatment options
 * - Decorative stripe accents
 * - Photo captions
 * - Activity context (date, location, stats)
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveActivityLocation, formatDistance, formatTime } from '@/lib/activity-utils'
import {
    extractPhotos,
    selectGalleryLayout,
    getLayoutConfig,
    calculateSlotDimensions,
    GalleryLayout,
    PhotoData
} from '@/lib/photo-gallery-utils'
import { PdfImage } from '@/components/pdf/PdfImage'

// ============================================================================
// TYPES
// ============================================================================

export type PhotoGalleryVariant = 'clean' | 'artistic' | 'minimal' | 'framed'

export interface PhotoGalleryProps {
    activity?: StravaActivity
    photos?: PhotoData[]  // Allow direct photo array for flexibility
    format?: BookFormat
    theme?: BookTheme
    variant?: PhotoGalleryVariant
    layout?: GalleryLayout  // Override auto layout selection
    title?: string
    showCaptions?: boolean
    showDecorations?: boolean
    bwStyle?: 'all-color' | 'all-bw' | 'alternating' | 'accent-only'
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (format: BookFormat, theme: BookTheme, variant: PhotoGalleryVariant) => {
    const scale = format.scaleFactor
    const isArtistic = variant === 'artistic' || variant === 'framed'

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: variant === 'minimal' ? '#ffffff' : '#fafafa',
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
            color: '#666',
        },
        galleryContainer: {
            flex: 1,
            position: 'relative',
        },
        // Photo slot container - PdfImage handles positioning inside
        photoSlot: {
            position: 'absolute',
            overflow: 'hidden',
            backgroundColor: '#f0f0f0',
        },
        photoFrame: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: isArtistic ? 4 * scale : 0,
            borderColor: '#ffffff',
        },
        photoShadow: {
            position: 'absolute',
            backgroundColor: 'rgba(0,0,0,0.1)',
        },
        caption: {
            position: 'absolute',
            bottom: 8 * scale,
            left: 8 * scale,
            right: 8 * scale,
            fontSize: Math.max(7, 8 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 4 * scale,
            textAlign: 'center',
        },
        decorativeStripe: {
            position: 'absolute',
            backgroundColor: theme.accentColor,
        },
        cornerDecoration: {
            position: 'absolute',
            width: 20 * scale,
            height: 20 * scale,
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
            color: '#999',
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emptyText: {
            fontSize: Math.max(14, 16 * scale),
            fontFamily: theme.fontPairing.body,
            color: '#ccc',
        },
    })
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const DecorativeStripes = ({
    format,
    theme,
    position
}: {
    format: BookFormat
    theme: BookTheme
    position: 'top' | 'bottom' | 'left' | 'right'
}) => {
    const scale = format.scaleFactor
    const stripeWidth = 4 * scale
    const gap = 3 * scale

    const isHorizontal = position === 'top' || position === 'bottom'

    if (isHorizontal) {
        return (
            <View style={{
                position: 'absolute',
                [position]: 0,
                left: 0,
                right: 0,
                height: 15 * scale,
                flexDirection: 'row',
                gap,
            }}>
                {[0, 1, 2].map(i => (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            height: stripeWidth,
                            backgroundColor: i === 1 ? theme.accentColor : theme.primaryColor,
                            opacity: i === 1 ? 1 : 0.3,
                        }}
                    />
                ))}
            </View>
        )
    }

    return null
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PhotoGallery = ({
    activity,
    photos: photosProp,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    variant = 'clean',
    layout: layoutProp,
    title,
    showCaptions = false,
    showDecorations = false
}: PhotoGalleryProps) => {
    const styles = createStyles(format, theme, variant)
    const scale = format.scaleFactor

    // Get photos from props or activity
    const photos = photosProp || (activity ? extractPhotos(activity) : [])

    // Determine layout
    const preferArtistic = variant === 'artistic'
    const selectedLayout = layoutProp || selectGalleryLayout(photos, preferArtistic)
    const layoutConfig = getLayoutConfig(selectedLayout, photos.length)

    // Calculate gallery dimensions (accounting for margins)
    const galleryWidth = format.dimensions.width - (format.safeMargin * 2)
    // Header: ~60 content + 16 marginBottom = 76
    const headerHeight = title || activity ? 76 * scale : 0
    // Footer: 12 marginTop + 8 paddingTop + ~20 content = 40
    const footerHeight = activity ? 40 * scale : 0
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
                {(title || activity) && (
                    <View style={styles.header}>
                        <Text style={styles.sectionLabel}>Photo Gallery</Text>
                        <Text style={styles.title}>{title || activity?.name || 'Untitled'}</Text>
                        {activity && (
                            <Text style={styles.subtitle}>{date} | {location}</Text>
                        )}
                    </View>
                )}

                {/* Decorative stripes */}
                {showDecorations && variant === 'artistic' && (
                    <DecorativeStripes format={format} theme={theme} position="top" />
                )}

                {/* Gallery container */}
                <View style={[styles.galleryContainer, { height: galleryHeight }]}>
                    {photos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No photos available</Text>
                        </View>
                    ) : (
                        <>
                            {layoutConfig.slots.slice(0, photos.length).map((slot, idx) => {
                                const photo = photos[idx]
                                const dims = calculateSlotDimensions(slot, galleryWidth, galleryHeight)

                                return (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.photoSlot,
                                            {
                                                left: dims.x,
                                                top: dims.y,
                                                width: dims.width,
                                                height: dims.height,
                                                transform: dims.rotation ? `rotate(${dims.rotation}deg)` : undefined,
                                                zIndex: slot.zIndex || 0,
                                            }
                                        ]}
                                    >
                                        {/* Shadow for artistic variant */}
                                        {variant === 'artistic' && (
                                            <View style={[styles.photoShadow, {
                                                top: 4 * scale,
                                                left: 4 * scale,
                                                width: dims.width,
                                                height: dims.height,
                                            }]} />
                                        )}

                                        {/* Photo */}
                                        <PdfImage src={photo.url} />

                                        {/* Frame overlay for framed variant */}
                                        {variant === 'framed' && <View style={styles.photoFrame} />}

                                        {/* Caption */}
                                        {showCaptions && photo.caption && (
                                            <Text style={styles.caption}>{photo.caption}</Text>
                                        )}
                                    </View>
                                )
                            })}
                        </>
                    )}
                </View>

                {/* Footer with activity stats */}
                {activity && (
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            {formatDistance(activity.distance, 'metric')} | {formatTime(activity.moving_time)}
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

// Export pages version for embedding
export const PhotoGalleryPage = ({
    activity,
    photos: photosProp,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    variant = 'clean',
    layout: layoutProp,
    title,
    showCaptions = false,
    showDecorations = false
}: PhotoGalleryProps) => {
    const styles = createStyles(format, theme, variant)
    const scale = format.scaleFactor

    const photos = photosProp || (activity ? extractPhotos(activity) : [])
    const preferArtistic = variant === 'artistic'
    const selectedLayout = layoutProp || selectGalleryLayout(photos, preferArtistic)
    const layoutConfig = getLayoutConfig(selectedLayout, photos.length)

    // Calculate gallery dimensions (accounting for margins)
    const galleryWidth = format.dimensions.width - (format.safeMargin * 2)
    // Header: ~60 content + 16 marginBottom = 76
    const headerHeight = title || activity ? 76 * scale : 0
    // Footer: 12 marginTop + 8 paddingTop + ~20 content = 40
    const footerHeight = activity ? 40 * scale : 0
    const galleryHeight = format.dimensions.height - (format.safeMargin * 2) - headerHeight - footerHeight

    const date = activity ? new Date(activity.start_date_local).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }) : ''
    const location = activity ? resolveActivityLocation(activity) : ''

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page} wrap={false}>
            {(title || activity) && (
                <View style={styles.header}>
                    <Text style={styles.sectionLabel}>Photo Gallery</Text>
                    <Text style={styles.title}>{title || activity?.name || 'Untitled'}</Text>
                    {activity && (
                        <Text style={styles.subtitle}>{date} | {location}</Text>
                    )}
                </View>
            )}

            {showDecorations && variant === 'artistic' && (
                <DecorativeStripes format={format} theme={theme} position="top" />
            )}

            <View style={[styles.galleryContainer, { height: galleryHeight }]}>
                {photos.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No photos available</Text>
                    </View>
                ) : (
                    <>
                        {layoutConfig.slots.slice(0, photos.length).map((slot, idx) => {
                            const photo = photos[idx]
                            const dims = calculateSlotDimensions(slot, galleryWidth, galleryHeight)

                            return (
                                <View
                                    key={idx}
                                    style={[
                                        styles.photoSlot,
                                        {
                                            left: dims.x,
                                            top: dims.y,
                                            width: dims.width,
                                            height: dims.height,
                                            transform: dims.rotation ? `rotate(${dims.rotation}deg)` : undefined,
                                            zIndex: slot.zIndex || 0,
                                        }
                                    ]}
                                >
                                    {variant === 'artistic' && (
                                        <View style={[styles.photoShadow, {
                                            top: 4 * scale,
                                            left: 4 * scale,
                                            width: dims.width,
                                            height: dims.height,
                                        }]} />
                                    )}
                                    <PdfImage src={photo.url} />
                                    {variant === 'framed' && <View style={styles.photoFrame} />}
                                    {showCaptions && photo.caption && (
                                        <Text style={styles.caption}>{photo.caption}</Text>
                                    )}
                                </View>
                            )
                        })}
                    </>
                )}
            </View>

            {activity && (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {formatDistance(activity.distance, 'metric')} | {formatTime(activity.moving_time)}
                    </Text>
                    <Text style={styles.footerText}>
                        {photos.length} photo{photos.length !== 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </Page>
    )
}
