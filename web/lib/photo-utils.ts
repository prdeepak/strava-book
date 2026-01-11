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
