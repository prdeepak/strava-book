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
    })
}

export interface RaceSectionDescriptionPageProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
}

export const RaceSectionDescriptionPage = ({
    activity,
    format,
    theme = DEFAULT_THEME,
}: RaceSectionDescriptionPageProps) => {
    const styles = createStyles(format, theme)
    const body = resolveTypography('body', theme, format)
    const spacing = resolveSpacing(theme, format)

    const description = activity.description || ''

    // Get splits data for visualization (prefer splits_metric, fall back to laps)
    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0

    // Calculate content dimensions
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)
    const contentHeight = format.dimensions.height - (format.safeMargin * 2)

    // Reserve space for header (~80pt), divider (~30pt), and data viz if present
    const headerSpace = 80 * format.scaleFactor
    const dividerSpace = spacing.sm + spacing.md + 3  // margins + height
    const dataVizSpace = hasSplits ? DATA_VIZ_HEIGHT + spacing.md + spacing.sm : 0
    const descriptionHeight = contentHeight - headerSpace - dividerSpace - dataVizSpace

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
                        font={body.fontFamily}
                        min_fontsize={body.minFontSize}
                        max_fontsize={body.fontSize}
                        h_align="left"
                        v_align="top"
                        textColor={theme.primaryColor}
                    />
                </View>

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
