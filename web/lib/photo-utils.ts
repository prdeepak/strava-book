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
