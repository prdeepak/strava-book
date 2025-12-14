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

    // Strip emojis from title for PDF rendering (Helvetica doesn't support emojis)
    const stripEmojis = (text: string) => {
        return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}-\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}-\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26A7}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}-\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]/gu, '')
            .trim()
    }
    const cleanTitle = stripEmojis(activity.name)

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

                    <Text style={styles.title}>{cleanTitle}</Text>

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
