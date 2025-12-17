import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { resolveActivityLocation } from '@/lib/activity-utils'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

interface DesignSpec {
    fonts: {
        pageTitle: { family: string, size: number, weight: string, color: string }
        sectionTitle: { family: string, size: number, weight: string, color: string }
        body: { family: string, size: number, weight: string, color: string }
        accent: { family: string, size: number, weight: string, color: string }
    }
    colorScheme: {
        primary: string
        secondary: string
        background: string
        text: string
        accent: string
    }
    theme: string
    narrative: string
    layout?: any  // Will be used in Phase 4C
}

interface ComprehensiveData {
    activity: StravaActivity
    photos: any[]
    comments: any[]
    streams: any
}

interface AIRaceProps {
    designSpec: DesignSpec
    comprehensiveData: ComprehensiveData
    pageCount: number
    mapboxToken?: string
}

export const AIRace = ({ designSpec, comprehensiveData }: AIRaceProps) => {
    const { fonts, colorScheme, narrative } = designSpec
    const { activity, photos, comments } = comprehensiveData

    // Create dynamic styles based on AI design spec
    const styles = StyleSheet.create({
        page: {
            backgroundColor: colorScheme.background,
            padding: 25,
            flexDirection: 'column',
        },
        heroHeader: {
            marginBottom: 12,
            borderBottomWidth: 2,
            borderBottomColor: colorScheme.primary,
            paddingBottom: 10,
        },
        title: {
            fontSize: fonts.pageTitle.size,
            fontFamily: fonts.pageTitle.family,
            color: fonts.pageTitle.color,
            textTransform: 'uppercase',
            marginBottom: 6,
            lineHeight: 1.1,
        },
        meta: {
            color: colorScheme.accent,
            fontSize: fonts.body.size - 2,
            fontFamily: fonts.body.family,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 2,
        },
        description: {
            fontSize: fonts.body.size,
            fontFamily: fonts.accent.family,
            color: colorScheme.text,
            marginTop: 6,
            lineHeight: 1.3,
        },
        imagesSection: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 12,
            height: 220,
        },
        imageContainer: {
            flex: 1,
            backgroundColor: '#f0f0f0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
        },
        statsGrid: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginBottom: 12,
            paddingBottom: 10,
            borderBottomWidth: 2,
            borderBottomColor: colorScheme.primary,
        },
        statBox: {
            alignItems: 'center',
        },
        statValue: {
            fontSize: fonts.sectionTitle.size + 4,
            fontFamily: fonts.sectionTitle.family,
            color: colorScheme.primary,
        },
        statLabel: {
            fontSize: fonts.body.size - 2,
            color: colorScheme.accent,
            textTransform: 'uppercase',
            marginTop: 2,
        },
        sectionTitle: {
            fontSize: fonts.sectionTitle.size,
            fontFamily: fonts.sectionTitle.family,
            textTransform: 'uppercase',
            marginBottom: 6,
            marginTop: 8,
            color: colorScheme.primary,
            borderBottomWidth: 1,
            borderBottomColor: colorScheme.primary,
            paddingBottom: 2,
        },
        narrative: {
            fontSize: fonts.accent.size,
            fontFamily: fonts.accent.family,
            color: colorScheme.text,
            lineHeight: 1.4,
            marginBottom: 12,
            padding: 10,
            backgroundColor: colorScheme.secondary + '20', // 20% opacity
            borderLeftWidth: 3,
            borderLeftColor: colorScheme.primary,
        },
        comment: {
            marginBottom: 4,
            fontSize: fonts.body.size - 2,
            lineHeight: 1.3,
        },
        commentAuthor: {
            fontFamily: fonts.sectionTitle.family,
            fontSize: fonts.body.size - 2,
            color: colorScheme.primary,
        },
        commentText: {
            fontFamily: fonts.body.family,
            fontSize: fonts.body.size - 2,
            color: colorScheme.text,
        },
        footer: {
            position: 'absolute',
            bottom: 12,
            left: 25,
            right: 25,
            textAlign: 'center',
            fontSize: fonts.body.size - 3,
            color: colorScheme.accent,
        },
    })

    // Get location using utility function
    const location = resolveActivityLocation(activity)

    // Calculate key stats
    const distanceKm = (activity.distance / 1000).toFixed(2)
    const movingTime = new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
    const paceSeconds = activity.moving_time / (activity.distance / 1000)
    const paceMin = Math.floor(paceSeconds / 60)
    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')
    const avgPace = `${paceMin}:${paceSec}/km`

    // Get first 3 photos for display
    // IMPORTANT: @react-pdf/renderer requires absolute URLs for images
    // We need to construct full URLs to the proxy endpoint
    const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const displayPhotos: string[] = photos.slice(0, 3).map((photo: any) => {
        const photoUrls = photo.urls || {}
        const rawUrl = photoUrls['5000'] || photoUrls['600'] || photoUrls['100'] || Object.values(photoUrls)[0]
        if (!rawUrl) return null

        // Use absolute URL for PDF rendering
        return `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(rawUrl as string)}`
    }).filter((url): url is string => url !== null)

    // Get first 3 comments
    const displayComments = comments.slice(0, 3)

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Hero Header */}
                <View style={styles.heroHeader}>
                    <Text style={styles.meta}>
                        {new Date(activity.start_date).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                    <Text style={styles.meta}>{location}</Text>
                    <Text style={styles.title}>{activity.name}</Text>
                    {activity.description && (
                        <Text style={styles.description}>{activity.description}</Text>
                    )}
                </View>

                {/* AI Narrative */}
                {narrative && (
                    <View style={styles.narrative}>
                        <Text>{narrative}</Text>
                    </View>
                )}

                {/* Photos Section */}
                {displayPhotos.length > 0 && (
                    <View style={styles.imagesSection}>
                        {displayPhotos.map((proxyUrl: string, index: number) => (
                            <View key={index} style={styles.imageContainer}>
                                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                <Image src={proxyUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </View>
                        ))}
                    </View>
                )}

                {/* Key Stats */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{distanceKm}</Text>
                        <Text style={styles.statLabel}>Kilometers</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{movingTime}</Text>
                        <Text style={styles.statLabel}>Time</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{avgPace}</Text>
                        <Text style={styles.statLabel}>Avg Pace</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{activity.total_elevation_gain}m</Text>
                        <Text style={styles.statLabel}>Elevation</Text>
                    </View>
                </View>

                {/* Comments Section */}
                {displayComments.length > 0 && (
                    <View>
                        <Text style={styles.sectionTitle}>Comments</Text>
                        {displayComments.map((comment: any, i: number) => (
                            <View key={i} style={styles.comment}>
                                <Text style={styles.commentAuthor}>
                                    {comment.athlete.firstname} {comment.athlete.lastname}:
                                </Text>
                                <Text style={styles.commentText}>{comment.text}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.footer}>
                    <Text>Generated by Strava Book • Powered by AI • {activity.type}</Text>
                </View>
            </Page>
        </Document>
    )
}
