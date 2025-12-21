import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'

const styles = StyleSheet.create({
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 2,
        marginBottom: 6,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#333',
    },
    kudosCount: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: '#fc4c02',
    },
    commentsSection: {
        marginTop: 8,
    },
    comment: {
        marginBottom: 4,
        fontSize: 7,
        lineHeight: 1.3,
    },
    commentAuthor: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 7,
        color: '#000',
    },
    commentText: {
        fontFamily: 'Helvetica',
        fontSize: 7,
        color: '#333',
    },
})

interface CommentsSectionProps {
    activity: StravaActivity
}

export const CommentsSection = ({ activity }: CommentsSectionProps) => {
    // Get all comments (sorted by recency)
    const allComments = activity.comments || []
    const comments = allComments.length > 0
        ? [...allComments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : []

    // Don't render if no comments and no kudos
    if (comments.length === 0 && !activity.kudos_count) {
        return null
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    {comments.length > 0 ? 'Comments' : 'Kudos'}
                </Text>
                {activity.kudos_count > 0 && (
                    <Text style={styles.kudosCount}>👍 {activity.kudos_count}</Text>
                )}
            </View>
            {comments.length > 0 && (
                <View style={styles.commentsSection}>
                    {comments.map((comment, i) => (
                        <View key={i} style={styles.comment}>
                            <Text style={styles.commentAuthor}>
                                {comment.athlete.firstname} {comment.athlete.lastname}:
                            </Text>
                            <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    )
}
