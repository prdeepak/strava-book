import { Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

const createStyles = (format: BookFormat, theme: BookTheme) => {
    // Resolve design tokens
    const headingTypo = resolveTypography('heading', theme, format)
    const bodyTypo = resolveTypography('body', theme, format)
    const captionTypo = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)
    const effects = resolveEffects(theme)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: format.safeMargin,
            flexDirection: 'column',
        },
        header: {
            marginBottom: spacing.sm,
        },
        sectionLabel: {
            color: theme.accentColor,
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: headingTypo.fontFamily,
            textTransform: 'uppercase',
            letterSpacing: captionTypo.letterSpacing ?? 2,
        },
        title: {
            fontSize: headingTypo.fontSize,
            fontFamily: headingTypo.fontFamily,
            color: theme.primaryColor,
            marginTop: spacing.xs / 2,
        },
        photosGrid: {
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
        },
        photoLarge: {
            width: '100%',
            height: '48%',
            borderRadius: 4,
        },
        photoMedium: {
            width: '48%',
            height: '45%',
            borderRadius: 4,
        },
        photoSmall: {
            width: '31%',
            height: '30%',
            borderRadius: 4,
        },
        photoCaption: {
            fontSize: captionTypo.fontSize,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity + 0.15,
            marginTop: spacing.xs / 2,
            textAlign: 'center',
        },
        pageNumber: {
            position: 'absolute',
            bottom: format.safeMargin,
            right: format.safeMargin,
            fontSize: captionTypo.fontSize,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity,
        },
    })
}

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
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image
                        key={index}
                        src={photoUrl}
                        style={getPhotoStyle(pagePhotos.length, index)}
                    />
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
