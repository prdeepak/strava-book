import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookEntry } from '@/lib/curator'
import { RacePageContent } from './RacePage'

const styles = StyleSheet.create({
    coverPage: {
        backgroundColor: '#000000',
        color: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 50,
    },
    coverTitle: {
        fontSize: 48,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    coverSubtitle: {
        fontSize: 18,
        fontFamily: 'Helvetica',
        textAlign: 'center',
        opacity: 0.8,
    }
})

interface BookDocumentProps {
    entries: BookEntry[]
    activities: StravaActivity[]
}

export const BookDocument = ({ entries, activities }: BookDocumentProps) => (
    <Document>
        {entries.map((entry, index) => {
            if (entry.type === 'COVER') {
                return (
                    <Page key={index} size="A4" style={styles.coverPage}>
                        <Text style={styles.coverTitle}>{entry.title || 'My Strava Book'}</Text>
                        <Text style={styles.coverSubtitle}>A collection of your greatest efforts</Text>
                    </Page>
                )
            }
            if (entry.type === 'RACE_PAGE' && entry.activityId) {
                const activity = activities.find(a => a.id === entry.activityId)
                if (activity) {
                    return (
                        <RacePageContent
                            key={index}
                            activity={activity}
                            highlightLabel={entry.highlightLabel}
                        />
                    )
                }
            }
            return <Page key={index}><Text>Unknown Page Type</Text></Page>
        })}
    </Document>
)
