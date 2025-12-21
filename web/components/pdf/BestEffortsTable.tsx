import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 8,
        color: '#333',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 2,
    },
    dataGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    dataRow: {
        width: '48%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
        fontSize: 7,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ddd',
        paddingBottom: 1,
    },
    dataLabel: {
        fontFamily: 'Helvetica',
        color: '#666',
        fontSize: 7,
        flex: 1,
    },
    dataValue: {
        fontFamily: 'Helvetica-Bold',
        color: '#000',
        fontSize: 7,
        textAlign: 'right',
    },
})

interface BestEffortsTableProps {
    activity: StravaActivity
    maxEfforts?: number  // Maximum number of efforts to display (default: 10)
}

export const BestEffortsTable = ({ activity, maxEfforts = 10 }: BestEffortsTableProps) => {
    // Prepare best efforts with smart prioritization
    // Algorithm: 
    // 1. Prioritize any efforts in top-3 (pr_rank 1-3)
    // 2. Then prioritize longest distances
    // 3. Limit to maxEfforts for space
    const allEfforts = activity.best_efforts || []
    let bestEfforts: typeof allEfforts = []

    if (allEfforts.length > 0) {
        // Separate top-3 PRs from others
        const top3PRs = allEfforts.filter(e => e.pr_rank && e.pr_rank <= 3)
        const otherEfforts = allEfforts.filter(e => !e.pr_rank || e.pr_rank > 3)

        // Sort others by distance (longest first)
        const sortedOthers = otherEfforts.sort((a, b) => b.distance - a.distance)

        // Combine: top-3 PRs first, then longest distances
        const combined = [...top3PRs, ...sortedOthers]

        // Take up to maxEfforts
        bestEfforts = combined.slice(0, maxEfforts)
    }

    if (bestEfforts.length === 0) {
        return null
    }

    return (
        <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Best Efforts</Text>
            <View style={styles.dataGrid}>
                {bestEfforts.map((effort, i) => {
                    const paceSeconds = effort.elapsed_time / (effort.distance / 1000)
                    const paceMin = Math.floor(paceSeconds / 60)
                    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

                    // Color-code top-3 PRs
                    const prRank = effort.pr_rank || 0
                    let backgroundColor = 'transparent'
                    let textColor = '#555'
                    let fontFamily = 'Helvetica'

                    if (prRank === 1) {
                        backgroundColor = '#FFD700' // Gold
                        textColor = '#000'
                        fontFamily = 'Helvetica-Bold'
                    } else if (prRank === 2) {
                        backgroundColor = '#C0C0C0' // Silver
                        textColor = '#000'
                        fontFamily = 'Helvetica-Bold'
                    } else if (prRank === 3) {
                        backgroundColor = '#CD7F32' // Bronze
                        textColor = '#000'
                        fontFamily = 'Helvetica-Bold'
                    } else if (prRank > 0 && prRank <= 5) {
                        fontFamily = 'Helvetica-Bold' // Top 5 but not podium
                    }

                    return (
                        <View key={i} style={[styles.dataRow, { backgroundColor, paddingVertical: prRank <= 3 ? 1 : 0 }]}>
                            <Text style={[styles.dataLabel, { fontFamily, color: prRank <= 3 ? textColor : '#666' }]}>
                                {effort.name}
                            </Text>
                            <Text style={[styles.dataValue, { fontFamily, color: prRank <= 3 ? textColor : '#000' }]}>
                                {paceMin}:{paceSec}
                            </Text>
                        </View>
                    )
                })}
            </View>
        </View>
    )
}
