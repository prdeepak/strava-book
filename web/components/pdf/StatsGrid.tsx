import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'

const styles = StyleSheet.create({
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
    },
    statBox: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontFamily: 'Helvetica-Bold',
        color: '#000',
    },
    statLabel: {
        fontSize: 8,
        color: '#666',
        textTransform: 'uppercase',
        marginTop: 2,
    },
})

interface StatsGridProps {
    activity: StravaActivity
}

export const StatsGrid = ({ activity }: StatsGridProps) => {
    // Calculate key stats
    const distanceKm = (activity.distance / 1000).toFixed(2)
    const movingTime = new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
    const paceSeconds = activity.moving_time / (activity.distance / 1000)
    const paceMin = Math.floor(paceSeconds / 60)
    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')
    const avgPace = `${paceMin}:${paceSec}/km`

    return (
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
    )
}
