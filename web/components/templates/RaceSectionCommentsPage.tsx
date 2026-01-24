import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
    page: {
        width: format.dimensions.width,
        height: format.dimensions.height,
        backgroundColor: theme.backgroundColor,
        padding: format.safeMargin,
        flexDirection: 'column',
    },
    header: {
        marginBottom: 20 * format.scaleFactor,
    },
    sectionLabel: {
        color: theme.accentColor,
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    title: {
        fontSize: Math.max(18, 24 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: theme.primaryColor,
        marginTop: 4 * format.scaleFactor,
    },
    kudosBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.accentColor,
        padding: 12 * format.scaleFactor,
        borderRadius: 8,
        marginBottom: 20 * format.scaleFactor,
    },
    kudosEmoji: {
        fontSize: Math.max(24, 36 * format.scaleFactor),
        marginRight: 12 * format.scaleFactor,
    },
    kudosCount: {
        fontSize: Math.max(20, 28 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: '#ffffff',
    },
    kudosLabel: {
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: 'rgba(255, 255, 255, 0.8)',
        marginLeft: 8 * format.scaleFactor,
    },
    commentsContainer: {
        flex: 1,
        flexDirection: 'row',
        gap: 16 * format.scaleFactor,
    },
    commentsColumn: {
        flex: 1,
    },
    comment: {
        marginBottom: 16 * format.scaleFactor,
        paddingBottom: 16 * format.scaleFactor,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e0e0e0',
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6 * format.scaleFactor,
    },
    commentAuthor: {
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.heading,
        color: theme.primaryColor,
    },
    commentDate: {
        fontSize: Math.max(8, 9 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#999',
    },
    commentText: {
        fontSize: Math.max(10, 12 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#444',
        lineHeight: 1.5,
    },
    commentReaction: {
        fontSize: Math.max(8, 9 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: theme.accentColor,
        marginTop: 4 * format.scaleFactor,
    },
    noComments: {
        fontSize: Math.max(12, 14 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: '#999',
        textAlign: 'center',
        marginTop: 40 * format.scaleFactor,
    },
})

export interface RaceSectionCommentsPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
}

export const RaceSectionCommentsPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
}: RaceSectionCommentsPageProps) => {
    const styles = createStyles(format, theme)

    // Get comments - from comprehensiveData or activity directly
    const comments = activity.comprehensiveData?.comments || activity.comments || []

    // Sort comments by date (newest first)
    const sortedComments = [...comments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Limit to fit on one page (roughly 8-10 comments)
    const displayComments = sortedComments.slice(0, 10)

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.sectionLabel}>Community</Text>
                <Text style={styles.title}>Support & Comments</Text>
            </View>

            {/* Kudos Banner */}
            {activity.kudos_count > 0 && (
                <View style={styles.kudosBanner}>
                    <Text style={styles.kudosEmoji}>👍</Text>
                    <Text style={styles.kudosCount}>{activity.kudos_count}</Text>
                    <Text style={styles.kudosLabel}>people gave you kudos</Text>
                </View>
            )}

            {/* Comments - Two Column Layout */}
            <View style={styles.commentsContainer}>
                {displayComments.length > 0 ? (
                    <>
                        {/* Left Column */}
                        <View style={styles.commentsColumn}>
                            {displayComments.slice(0, Math.ceil(displayComments.length / 2)).map((comment, index) => (
                                <View key={index} style={styles.comment}>
                                    <View style={styles.commentHeader}>
                                        <Text style={styles.commentAuthor}>
                                            {comment.athlete.firstname} {comment.athlete.lastname}
                                        </Text>
                                        <Text style={styles.commentDate}>
                                            {formatDate(comment.created_at)}
                                        </Text>
                                    </View>
                                    <Text style={styles.commentText}>{comment.text}</Text>
                                    {(comment.reaction_count ?? 0) > 0 && (
                                        <Text style={styles.commentReaction}>
                                            ❤️ {comment.reaction_count}
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>
                        {/* Right Column */}
                        <View style={styles.commentsColumn}>
                            {displayComments.slice(Math.ceil(displayComments.length / 2)).map((comment, index) => (
                                <View key={index} style={styles.comment}>
                                    <View style={styles.commentHeader}>
                                        <Text style={styles.commentAuthor}>
                                            {comment.athlete.firstname} {comment.athlete.lastname}
                                        </Text>
                                        <Text style={styles.commentDate}>
                                            {formatDate(comment.created_at)}
                                        </Text>
                                    </View>
                                    <Text style={styles.commentText}>{comment.text}</Text>
                                    {(comment.reaction_count ?? 0) > 0 && (
                                        <Text style={styles.commentReaction}>
                                            ❤️ {comment.reaction_count}
                                        </Text>
                                    )}
                                </View>
                            ))}
                            {sortedComments.length > displayComments.length && (
                                <Text style={[styles.noComments, { color: '#666', textAlign: 'left' }]}>
                                    +{sortedComments.length - displayComments.length} more comments
                                </Text>
                            )}
                        </View>
                    </>
                ) : (
                    <Text style={styles.noComments}>
                        No comments on this activity yet.
                    </Text>
                )}
            </View>
        </Page>
    )
}
