import { Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'

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
        fontSize: 42, // Reduced from 54 to prevent overflow
        fontFamily: 'Helvetica-Bold',
        color: '#ffffff',
        textTransform: 'uppercase',
        marginBottom: 10,
        lineHeight: 0.9,
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

interface RacePageLeftProps {
    activity: StravaActivity
    highlightLabel?: string
}

export const RacePageLeft = ({ activity, highlightLabel }: RacePageLeftProps) => {
    // Check for high-res photo, typically Strava doesn't give full res via API without more scope/logic
    // but we added type support. For now, if no photo, we keep the dark background.
    // Use proxy to avoid CORS
    const bgImage = activity.photos?.primary?.urls?.['600']
        ? `/api/proxy-image?url=${encodeURIComponent(activity.photos.primary.urls['600'])}`
        : null

    // Location Resolution Logic
    let location = activity.location_city
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
        <Page size="A4" style={styles.page}>
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
                        })} • {location}
                    </Text>

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
