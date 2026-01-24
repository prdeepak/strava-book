import { Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImage } from '@/components/pdf/PdfImage'

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
    photosGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8 * format.scaleFactor,
    },
    // Photo containers - PdfImage handles positioning inside
    photoLarge: {
        width: '100%',
        height: '48%',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    photoMedium: {
        width: '48%',
        height: '45%',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    photoSmall: {
        width: '31%',
        height: '30%',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    photoCaption: {
        fontSize: Math.max(8, 10 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#666',
        marginTop: 4 * format.scaleFactor,
        textAlign: 'center',
    },
    pageNumber: {
        position: 'absolute',
        bottom: format.safeMargin,
        right: format.safeMargin,
        fontSize: Math.max(8, 10 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#999',
    },
})

// Get all photos from activity
const getPhotos = (activity: StravaActivity): string[] => {
    const photos: string[] = []

    // Check comprehensiveData photos first
    if (activity.comprehensiveData?.photos?.length) {
        activity.comprehensiveData.photos.forEach((photo) => {
            const photoUrls = photo.urls as Record<string, string> | undefined
            if (photoUrls) {
                const url = photoUrls['5000'] || photoUrls['600'] || Object.values(photoUrls)[0]
                if (url) {
                    const resolved = resolveImageForPdf(url)
                    if (resolved) {
                        photos.push(resolved)
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
                    photos.push(resolved)
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

    const allPhotos = getPhotos(activity)
    const startIdx = pageIndex * photosPerPage
    const pagePhotos = allPhotos.slice(startIdx, startIdx + photosPerPage)

    if (pagePhotos.length === 0) {
        return null
    }

    // Determine layout based on number of photos
    const getPhotoStyle = (photoCount: number, index: number) => {
        if (photoCount === 1) {
            return styles.photoLarge
        } else if (photoCount === 2) {
            return styles.photoMedium
        } else if (photoCount === 3) {
            return index === 0 ? styles.photoLarge : styles.photoMedium
        } else {
            return styles.photoMedium
        }
    }

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.sectionLabel}>Race Photos</Text>
                <Text style={styles.title}>{activity.name}</Text>
            </View>

            <View style={styles.photosGrid}>
                {pagePhotos.map((photoUrl, index) => (
                    <View key={index} style={getPhotoStyle(pagePhotos.length, index)}>
                        <PdfImage src={photoUrl} />
                    </View>
                ))}
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
