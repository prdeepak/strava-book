import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveSpacing } from '@/lib/typography'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: 0,
            position: 'relative',
        },
        contentContainer: {
            position: 'absolute',
            top: format.safeMargin,
            left: format.safeMargin,
            right: format.safeMargin,
            bottom: format.safeMargin,
            flexDirection: 'column',
        },
        header: {
            marginBottom: spacing.sm + spacing.xs * 0.5,
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
            marginTop: spacing.xs * 0.5,
        },
        kudosBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.accentColor,
            padding: spacing.sm * 0.75,
            borderRadius: 8,
            marginBottom: spacing.sm + spacing.xs * 0.5,
        },
        kudosEmoji: {
            fontSize: Math.max(24, 36 * format.scaleFactor),
            marginRight: spacing.sm * 0.75,
        },
        kudosCount: {
            fontSize: Math.max(20, 28 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.textOverAccent ?? theme.backgroundColor,
        },
        kudosLabel: {
            fontSize: Math.max(10, 12 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: (theme.textOverAccent ?? theme.backgroundColor) + 'CC',
            marginLeft: spacing.xs,
        },
        commentsContainer: {
            flex: 1,
            flexDirection: 'row',
            gap: spacing.sm,
        },
        commentsColumn: {
            flex: 1,
        },
        comment: {
            marginBottom: spacing.sm,
            paddingBottom: spacing.sm,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.borderColor ?? (theme.primaryColor + '20'),
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs * 0.75,
        },
        commentAuthor: {
            fontSize: Math.max(10, 12 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.primaryColor,
        },
        commentDate: {
            fontSize: Math.max(8, 9 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor + '99',
        },
        commentText: {
            fontSize: Math.max(10, 12 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor + 'CC',
            lineHeight: 1.5,
        },
        commentReaction: {
            fontSize: Math.max(8, 9 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.accentColor,
            marginTop: spacing.xs * 0.5,
        },
        noComments: {
            fontSize: Math.max(12, 14 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor + '99',
            textAlign: 'center',
            marginTop: spacing.lg + spacing.xs,
        },
    })
}

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

    // Limit to fit on one page — 8 comments max to avoid overflow with kudos banner + "more" text
    const displayComments = sortedComments.slice(0, 8)

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.contentContainer}>
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
                                    <Text style={[styles.noComments, { color: theme.primaryColor + '99', textAlign: 'left' as const }]}>
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
            </View>
        </Page>
    )
}
