import { Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#1a1a1a',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 0,
    },
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0.6,
        objectFit: 'cover',
    },
    contentOverlay: {
        padding: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        width: '100%',
    },
    title: {
        fontSize: 38, // Slightly reduced to ensure wrapping works
        fontFamily: 'Helvetica-Bold',
        color: '#ffffff',
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 10,
        lineHeight: 1.1,
        maxWidth: '100%',
    },
    meta: {
        color: '#e0e0e0',
        fontSize: 14,
        fontFamily: 'Helvetica',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 5,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#ffffff',
        paddingTop: 15,
    },
    stat: {
        marginRight: 40,
    },
    statValue: {
        color: '#ffffff',
        fontSize: 24,
        fontFamily: 'Helvetica-Bold',
    },
    statLabel: {
        color: '#aaaaaa',
        fontSize: 10,
        marginTop: 2,
        textTransform: 'uppercase',
    }
})

export interface RacePageLeftProps {
    activity: StravaActivity
    highlightLabel?: string
    mapboxToken?: string
}

export const RacePageLeft = ({ activity, highlightLabel, mapboxToken }: RacePageLeftProps) => {
    // Check for high-res photo, typically Strava doesn't give full res via API without more scope/logic
    // but we added type support. For now, if no photo, we keep the dark background.
    // Use proxy to avoid CORS
    const bgImage = activity.photos?.primary?.urls?.['600']
        ? `/api/proxy-image?url=${encodeURIComponent(activity.photos.primary.urls['600'])}`
        : null

    // Location Resolution Logic
    // Priority: 1) Strava location_city, 2) Reverse geocode from coordinates, 3) Timezone fallback, 4) Unknown
    let location = activity.location_city

    // If no location_city and we have coordinates + mapbox token, use reverse geocoding
    // Note: This would need to be done server-side or via an API route for security
    // For now, we'll use the existing fallback but document the improvement
    if (!location && activity.timezone) {
        // Parse timezone like "(GMT-05:00) America/New_York"
        const parts = activity.timezone.split('/')
        if (parts.length > 1) {
            location = parts[parts.length - 1].replace(/_/g, ' ')
        }
    }
    if (!location) {
        location = 'Unknown Location'
    }

    return (
        <Page size="LETTER" style={styles.page}>
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                {bgImage && (
                    <Image
                        src={bgImage}
                        style={styles.backgroundImage}
                    />
                )}

                {/* Content Overlay - Position Absolute Bottom to ensure it sits on top */}
                <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    padding: 40,
                    backgroundColor: 'rgba(0,0,0,0.4)'
                }}>
                    {highlightLabel && (
                        <Text style={{
                            color: 'orange',
                            fontSize: 12,
                            marginBottom: 8,
                            fontFamily: 'Helvetica-Bold',
                            textTransform: 'uppercase'
                        }}>
                            {highlightLabel}
                        </Text>
                    )}
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

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{(activity.distance / 1000).toFixed(2)}</Text>
                            <Text style={styles.statLabel}>Kilometers</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{
                                new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
                            }</Text>
                            <Text style={styles.statLabel}>Time</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{
                                Math.floor((activity.moving_time / 60) / (activity.distance / 1000))
                            }:{
                                    Math.round(((activity.moving_time / 60) / (activity.distance / 1000) % 1) * 60).toString().padStart(2, '0')
                                }</Text>
                            <Text style={styles.statLabel}>Avg Pace</Text>
                        </View>
                    </View>
                </View>
            </View>
        </Page>
    )
}
