import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { resolveActivityLocation } from '@/lib/activity-utils'

const styles = StyleSheet.create({
    heroHeader: {
        marginBottom: 12,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        textTransform: 'uppercase',
        marginBottom: 6,
        lineHeight: 1.1,
    },
    meta: {
        color: '#666666',
        fontSize: 10,
        fontFamily: 'Helvetica',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 2,
    },
    description: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#333',
        marginTop: 6,
        fontStyle: 'italic',
        lineHeight: 1.3,
    },
})

interface HeaderProps {
    activity: StravaActivity
    showLocation?: boolean
}

export const Header = ({ activity, showLocation = true }: HeaderProps) => {
    const location = resolveActivityLocation(activity)

    return (
        <View style={styles.heroHeader}>
            <Text style={styles.meta}>
                {new Date(activity.start_date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                })}
            </Text>
            {showLocation && location && <Text style={styles.meta}>{location}</Text>}
            <Text style={styles.title}>{activity.name}</Text>
            {activity.description && (
                <Text style={styles.description}>{activity.description}</Text>
            )}
        </View>
    )
}
