import { Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImageCollection, CollectionPhoto } from '@/components/pdf/PdfImageCollection'

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
    page: {
        width: format.dimensions.width,
        height: format.dimensions.height,
        backgroundColor: theme.backgroundColor,
        padding: format.safeMargin,
        flexDirection: 'column',
    },
    header: {
        marginBottom: 16 * format.scaleFactor,
    },
    sectionLabel: {
        color: theme.accentColor,
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    title: {
        fontSize: Math.max(18, 24 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: theme.primaryColor,
        marginTop: 4 * format.scaleFactor,
    },
    photosContainer: {
        flex: 1,
        position: 'relative',
    },
    pageNumber: {
        position: 'absolute',
        bottom: format.safeMargin,
        right: format.safeMargin,
        fontSize: Math.max(8, 10 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#999999',
    },
})

// Get all photos from activity with dimensions
const getPhotos = (activity: StravaActivity): CollectionPhoto[] => {
    const photos: CollectionPhoto[] = []

    // Check comprehensiveData photos first
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

    // Fall back to primary photo if no comprehensiveData
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

export interface RaceSectionPhotosPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    pageIndex?: number // Which page of photos this is (0-indexed)
    photosPerPage?: number
}

export const RaceSectionPhotosPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
    pageIndex = 0,
    photosPerPage = 4,
}: RaceSectionPhotosPageProps) => {
    const styles = createStyles(format, theme)
    const scale = format.scaleFactor

    const allPhotos = getPhotos(activity)
    const startIdx = pageIndex * photosPerPage
    const pagePhotos = allPhotos.slice(startIdx, startIdx + photosPerPage)

    if (pagePhotos.length === 0) {
        return null
    }

    // Calculate container dimensions
    // Header: sectionLabel (~14) + title (~28) + marginTop (4) + marginBottom (16) ≈ 62
    const headerHeight = 62 * scale
    const containerWidth = format.dimensions.width - (format.safeMargin * 2)
    const containerHeight = format.dimensions.height - (format.safeMargin * 2) - headerHeight

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.sectionLabel}>Race Photos</Text>
                <Text style={styles.title}>{activity.name}</Text>
            </View>

            <View style={[styles.photosContainer, { height: containerHeight }]}>
                <PdfImageCollection
                    photos={pagePhotos}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
                    gap={8 * scale}
                />
            </View>

            {allPhotos.length > photosPerPage && (
                <Text style={styles.pageNumber}>
                    {pageIndex + 1} / {Math.ceil(allPhotos.length / photosPerPage)}
                </Text>
            )}
        </Page>
    )
}

// Helper to calculate how many photo pages needed
export const getPhotoPageCount = (activity: StravaActivity, photosPerPage = 4): number => {
    const photos = getPhotos(activity)
    return Math.ceil(photos.length / photosPerPage)
}
