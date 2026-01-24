import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const createStyles = (format: BookFormat, theme: BookTheme) => {
    // Resolve design tokens
    const headingTypo = resolveTypography('heading', theme, format)
    const subheadingTypo = resolveTypography('subheading', theme, format)
    const bodyTypo = resolveTypography('body', theme, format)
    const captionTypo = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)
    const effects = resolveEffects(theme)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: format.safeMargin,
            flexDirection: 'column',
        },
        header: {
            marginBottom: spacing.md,
        },
        sectionLabel: {
            color: theme.accentColor,
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: headingTypo.fontFamily,
            textTransform: 'uppercase',
            letterSpacing: captionTypo.letterSpacing ?? 2,
        },
        title: {
            fontSize: headingTypo.fontSize,
            fontFamily: headingTypo.fontFamily,
            color: theme.primaryColor,
            marginTop: spacing.xs / 2,
        },
        kudosBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.accentColor,
            padding: spacing.sm * 0.75,
            borderRadius: 8,
            marginBottom: spacing.md,
        },
        kudosEmoji: {
            fontSize: subheadingTypo.fontSize * 2,
            marginRight: spacing.sm * 0.75,
        },
        kudosCount: {
            fontSize: subheadingTypo.fontSize * 1.5,
            fontFamily: headingTypo.fontFamily,
            color: theme.backgroundColor,
        },
        kudosLabel: {
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: bodyTypo.fontFamily,
            color: theme.backgroundColor,
            opacity: effects.textOverlayOpacity * 2.5,
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
            borderBottomColor: `${theme.primaryColor}20`,
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs * 0.75,
        },
        commentAuthor: {
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: headingTypo.fontFamily,
            color: theme.primaryColor,
        },
        commentDate: {
            fontSize: captionTypo.fontSize * 0.9,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity,
        },
        commentText: {
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity + 0.4,
            lineHeight: 1.5,
        },
        commentReaction: {
            fontSize: captionTypo.fontSize * 0.9,
            fontFamily: bodyTypo.fontFamily,
            color: theme.accentColor,
            marginTop: spacing.xs / 2,
        },
        noComments: {
            fontSize: bodyTypo.fontSize,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity,
            textAlign: 'center',
            marginTop: spacing.lg,
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
                                <Text style={[styles.noComments, { textAlign: 'left' }]}>
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
