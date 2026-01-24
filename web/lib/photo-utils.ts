import { getActivityPhotos, StravaActivity, StravaPhoto } from './strava'

/**
 * Get the best available photo URL, preferring higher resolution.
 * Priority: 5000px > 600px > any available
 */
export function getBestPhotoUrl(photo: StravaPhoto): string | undefined {
    if (!photo.urls) return undefined

    return photo.urls['5000']
        || photo.urls['600']
        || Object.values(photo.urls)[0]
}

/**
 * Fetch an image URL and convert to base64 data URL.
 * This is needed for client-side PDF rendering because Strava URLs have CORS restrictions.
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Strava-Book-PDF-Generator/1.0',
            },
        })

        if (!response.ok) {
            console.error(`[photo-utils] Failed to fetch ${url}: ${response.status}`)
            return null
        }

        const buffer = await response.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        return `data:${contentType};base64,${base64}`
    } catch (error) {
        console.error(`[photo-utils] Error fetching image:`, error)
        return null
    }
}

/**
 * Fetch photos for a single activity and merge into the activity object.
 * Structures the photo data to match the expected format: activity.photos.primary.urls['600']
 */
export async function enrichActivityWithPhotos(
    activity: StravaActivity,
    accessToken: string
): Promise<StravaActivity> {
    try {
        const photos = await getActivityPhotos(accessToken, activity.id.toString())

        if (photos.length > 0) {
            // Find the primary photo (first one) and structure it correctly
            const primaryPhoto = photos[0]
            const photoUrl = getBestPhotoUrl(primaryPhoto)

            return {
                ...activity,
                photos: {
                    primary: {
                        urls: photoUrl ? { '600': photoUrl } : undefined
                    },
                    count: photos.length
                },
                allPhotos: photos
            }
        }
    } catch (error) {
        console.error(`[Photo Utils] Failed to fetch photos for activity ${activity.id}:`, error)
    }

    return activity
}

/**
 * Fetch photos for multiple activities with rate limiting.
 * Uses batched concurrent requests to balance speed vs API limits.
 */
export async function enrichActivitiesWithPhotos(
    activities: StravaActivity[],
    accessToken: string,
    batchSize: number = 5
): Promise<StravaActivity[]> {
    const enrichedActivities: StravaActivity[] = []

    for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize)
        const enrichedBatch = await Promise.all(
            batch.map(activity => enrichActivityWithPhotos(activity, accessToken))
        )
        enrichedActivities.push(...enrichedBatch)

        // Small delay between batches to respect rate limits
        if (i + batchSize < activities.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    return enrichedActivities
}

/**
 * Convert all photo URLs in an activity to base64 data URLs.
 * This is needed for client-side PDF rendering (PDFViewer) because
 * Strava photo URLs have CORS restrictions that block browser requests.
 *
 * Call this on the server before passing activity data to client components.
 */
export async function convertPhotosToBase64(activity: StravaActivity): Promise<StravaActivity> {
    const result = { ...activity }

    // Convert primary photo URL to base64
    const primaryUrls = result.photos?.primary?.urls as Record<string, string> | undefined
    if (primaryUrls) {
        const url = primaryUrls['600'] || primaryUrls['5000'] || Object.values(primaryUrls)[0]
        if (url && !url.startsWith('data:')) {
            console.log('[photo-utils] Converting primary photo to base64...')
            const base64 = await fetchImageAsBase64(url)
            if (base64) {
                result.photos = {
                    primary: {
                        urls: { '600': base64 }
                    },
                    count: result.photos?.count || 1
                }
                console.log('[photo-utils] Primary photo converted successfully')
            }
        }
    }

    // Convert allPhotos URLs to base64
    if (result.allPhotos && result.allPhotos.length > 0) {
        console.log(`[photo-utils] Converting ${result.allPhotos.length} photos to base64...`)
        const convertedPhotos = await Promise.all(
            result.allPhotos.map(async (photo) => {
                const url = getBestPhotoUrl(photo)
                if (url && !url.startsWith('data:')) {
                    const base64 = await fetchImageAsBase64(url)
                    if (base64) {
                        return {
                            ...photo,
                            urls: { ...photo.urls, '600': base64 }
                        }
                    }
                }
                return photo
            })
        )
        result.allPhotos = convertedPhotos
        console.log('[photo-utils] All photos converted')
    }

    return result
}

// ----- Aspect Fill Geometry -----

type Box = { width: number; height: number }

export interface ScaledImageGeometry {
    /** The final scale factor applied to the source dimensions */
    scale: number
    /** The dimensions of the image after scaling (will be >= target box) */
    scaledSize: Box
    /**
     * The amount to shift the image to center it in the box.
     * Values are positive. e.g. if crop.x is 20, shift image left by 20px.
     */
    cropOffset: { x: number; y: number }
    /** The actual rectangle of the source image that is visible */
    sourceVisibleRect: { x: number; y: number; width: number; height: number }
}

/**
 * Calculate geometry for aspect-fill (object-fit: cover) behavior.
 *
 * Given a source image size and a target container size, returns:
 * - scale: the factor to scale the source by
 * - scaledSize: the resulting image dimensions (will be >= target)
 * - cropOffset: how much to shift the image to center it (for CSS positioning)
 * - sourceVisibleRect: the portion of the original image that's visible (for backend cropping)
 *
 * Uses Math.max to ensure the image covers the entire target (aspect fill).
 * Use Math.min instead for aspect fit (entire image visible, letterboxed).
 */
export function calculateAspectFill(
    source: Box,
    target: Box
): ScaledImageGeometry {
    const scaleW = target.width / source.width
    const scaleH = target.height / source.height

    // KEY: Use Math.max to ensure coverage (Aspect Fill / Object-Fit: Cover)
    // Use Math.min if you wanted the image to fit entirely inside (Aspect Fit)
    const scale = Math.max(scaleW, scaleH)

    // 1. Calculate new scaled dimensions
    const scaledWidth = source.width * scale
    const scaledHeight = source.height * scale

    // 2. Calculate centering offset (in target pixels)
    // One of these will be 0, the other will be > 0
    const offsetX = (scaledWidth - target.width) / 2
    const offsetY = (scaledHeight - target.height) / 2

    // 3. Calculate the visible rectangle in original source pixels
    // This is useful for backend cropping (e.g. sharp, canvas)
    const sourceVisibleWidth = target.width / scale
    const sourceVisibleHeight = target.height / scale
    const sourceX = (source.width - sourceVisibleWidth) / 2
    const sourceY = (source.height - sourceVisibleHeight) / 2

    return {
        scale,
        scaledSize: { width: scaledWidth, height: scaledHeight },
        cropOffset: { x: offsetX, y: offsetY },
        sourceVisibleRect: {
            x: sourceX,
            y: sourceY,
            width: sourceVisibleWidth,
            height: sourceVisibleHeight,
        },
    }
}
