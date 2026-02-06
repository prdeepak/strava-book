import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { PageHeader } from '@/components/pdf/PageHeader'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'
import { RaceDataViz } from '@/components/pdf/RaceDataViz'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

// Height allocated for the data visualization section
const DATA_VIZ_HEIGHT = 180

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const displayLarge = resolveTypography('displayLarge', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const body = resolveTypography('body', theme, format)
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: 0,  // Use content container pattern per StyleGuide
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
        divider: {
            height: 3,
            backgroundColor: theme.accentColor,
            marginTop: spacing.sm,
            marginBottom: spacing.md,
            width: 60,
        },
        descriptionContainer: {
            flex: 1,
            position: 'relative',
        },
        quoteDecoration: {
            fontSize: displayLarge.fontSize,  // Use typography system
            fontFamily: displayLarge.fontFamily,
            color: theme.accentColor,
            opacity: 0.15,
            position: 'absolute',
            top: -spacing.md,
            left: -spacing.xs,
        },
        dataVizContainer: {
            marginTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.primaryColor,
            borderTopStyle: 'solid',
            paddingTop: spacing.sm,
        },
        // Inline comments section (when < 3 comments, shown on description page)
        inlineCommentsSection: {
            marginTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.primaryColor,
            borderTopStyle: 'solid',
            paddingTop: spacing.sm,
        },
        inlineCommentsLabel: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.primaryColor,
            opacity: 0.5,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: spacing.sm * 0.75,
        },
        inlineComment: {
            marginBottom: spacing.sm,
            paddingLeft: spacing.sm * 0.75,
            borderLeftWidth: 3,
            borderLeftColor: theme.accentColor,
            borderLeftStyle: 'solid',
        },
        inlineCommentText: {
            fontSize: body.fontSize * 0.85,
            fontFamily: body.fontFamily,
            color: theme.primaryColor,
            fontStyle: 'italic',
            lineHeight: body.lineHeight ?? 1.5,
            marginBottom: spacing.xs * 0.5,
        },
        inlineCommentAuthor: {
            fontSize: caption.fontSize * 0.9,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
        },
        kudosBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.sm,
        },
        kudosText: {
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            color: theme.accentColor,
            letterSpacing: 1,
        },
    })
}

export interface RaceSectionDescriptionPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    /** When true, show inline comments on this page (for < 3 comments) */
    inlineComments?: boolean
}

export const RaceSectionDescriptionPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
    inlineComments = false,
}: RaceSectionDescriptionPageProps) => {
    const styles = createStyles(format, theme)
    const body = resolveTypography('body', theme, format)
    const heading = resolveTypography('heading', theme, format)
    const spacing = resolveSpacing(theme, format)

    const description = activity.description || ''
    const isShortDescription = description.length < 100

    // Get inline comments if needed
    const comments = inlineComments
        ? (activity.comprehensiveData?.comments || activity.comments || []).slice(0, 2)
        : []
    const kudosCount = inlineComments ? (activity.kudos_count || 0) : 0
    const hasInlineContent = comments.length > 0 || kudosCount > 0

    // Get splits data for visualization (prefer splits_metric, fall back to laps)
    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0

    // Calculate content dimensions
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const contentHeight = format.dimensions.height - (format.safeMargin * 2)

    // Reserve space for header (~80pt), divider (~30pt), data viz, and inline comments
    const headerSpace = 80 * format.scaleFactor
    const dividerSpace = spacing.sm + spacing.md + 3  // margins + height
    const dataVizSpace = hasSplits ? DATA_VIZ_HEIGHT + spacing.md + spacing.sm : 0
    const inlineCommentsSpace = hasInlineContent ? (comments.length * 60 + 40) * format.scaleFactor : 0
    const descriptionHeight = contentHeight - headerSpace - dividerSpace - dataVizSpace - inlineCommentsSpace

    // For short descriptions, use larger typography to fill space better
    const descMaxFontSize = isShortDescription ? heading.fontSize : body.fontSize
    const descMinFontSize = isShortDescription ? body.fontSize : body.minFontSize

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.contentContainer}>
                {/* Header using standard PageHeader component */}
                <PageHeader
                    title={activity.name}
                    subtitle="Race Story"
                    size="large"
                    format={format}
                    theme={theme}
                />

                <View style={styles.divider} />

                {/* Description text with auto-resizing */}
                <View style={styles.descriptionContainer}>
                    <Text style={styles.quoteDecoration}>&ldquo;</Text>
                    <AutoResizingPdfText
                        text={description}
                        width={contentWidth - spacing.sm}  // Account for quote decoration
                        height={descriptionHeight}
                        font={isShortDescription ? heading.fontFamily : body.fontFamily}
                        min_fontsize={descMinFontSize}
                        max_fontsize={descMaxFontSize}
                        h_align="left"
                        v_align="top"
                        textColor={theme.primaryColor}
                    />
                </View>

                {/* Inline comments section (when < 3 comments, shown here instead of separate page) */}
                {hasInlineContent && (
                    <View style={styles.inlineCommentsSection}>
                        {kudosCount > 0 && (
                            <View style={styles.kudosBadge}>
                                <Text style={styles.kudosText}>
                                    {kudosCount} kudos
                                </Text>
                            </View>
                        )}
                        {comments.length > 0 && (
                            <>
                                <Text style={styles.inlineCommentsLabel}>Comments</Text>
                                {comments.map((comment, idx) => (
                                    <View key={idx} style={styles.inlineComment}>
                                        <Text style={styles.inlineCommentText}>
                                            &ldquo;{comment.text.substring(0, 150)}{comment.text.length > 150 ? '...' : ''}&rdquo;
                                        </Text>
                                        <Text style={styles.inlineCommentAuthor}>
                                            — {comment.athlete.firstname} {comment.athlete.lastname}
                                        </Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}

                {/* Data visualization: splits chart */}
                {hasSplits && (
                    <View style={styles.dataVizContainer}>
                        <RaceDataViz
                            splits={splits.map((s, i) => {
                                // Handle both splits (elevation_difference) and laps (total_elevation_gain)
                                const split = s as { split?: number; elevation_difference?: number; total_elevation_gain?: number }
                                return {
                                    split: split.split ?? i + 1,
                                    moving_time: s.moving_time,
                                    distance: s.distance,
                                    elevation_difference: split.elevation_difference ?? split.total_elevation_gain ?? 0
                                }
                            })}
                            totalTime={activity.moving_time}
                            width={contentWidth}
                            height={DATA_VIZ_HEIGHT}
                            showSplits={true}
                            showElevation={false}
                            theme={theme}
                        />
                    </View>
                )}
            </View>
        </Page>
    )
}
