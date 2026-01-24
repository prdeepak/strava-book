import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveActivityLocation } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { PageHeader, getPageHeaderHeight } from '@/components/pdf/PageHeader'
import { RaceDataViz } from '@/components/pdf/RaceDataViz'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

// Height allocated for the data visualization section
const DATA_VIZ_HEIGHT = 180

const createStyles = (format: BookFormat, theme: BookTheme) => {
    const body = resolveTypography('body', theme, format)
    const caption = resolveTypography('caption', theme, format)
    const spacing = resolveSpacing(theme, format)

    return StyleSheet.create({
        page: {
            width: format.dimensions.width,
            height: format.dimensions.height,
            backgroundColor: theme.backgroundColor,
            padding: format.safeMargin,
            flexDirection: 'column',
        },
        metaContainer: {
            marginBottom: spacing.sm,
        },
        meta: {
            color: theme.primaryColor,
            opacity: 0.6,
            fontSize: caption.fontSize,
            fontFamily: caption.fontFamily,
            marginBottom: spacing.xs / 2,
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
            fontSize: Math.max(48, 72 * format.scaleFactor),
            fontFamily: theme.fontPairing.heading,
            color: theme.accentColor,
            opacity: 0.15,
            position: 'absolute',
            top: -spacing.md,
            left: -spacing.xs,
        },
        description: {
            fontSize: body.fontSize,
            fontFamily: body.fontFamily,
            color: theme.primaryColor,
            lineHeight: body.lineHeight || 1.6,
            textAlign: 'left',
        },
        dataVizContainer: {
            marginTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.primaryColor,
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
    const spacing = resolveSpacing(theme, format)

    const location = resolveActivityLocation(activity)

    // Format date
    const dateStr = new Date(activity.start_date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })

    const description = activity.description || ''

    // Get splits data for visualization (prefer splits_metric, fall back to laps)
    const splits = activity.splits_metric || activity.laps || []
    const hasSplits = splits.length > 0

    // Calculate content width for visualizations
    const contentWidth = format.dimensions.width - (format.safeMargin * 2)

    // Calculate header height to properly layout content
    const headerHeight = getPageHeaderHeight('large', format, theme, {
        showBorder: false,
        hasSubtitle: true
    })

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            {/* Header using standard PageHeader component */}
            <PageHeader
                title={activity.name}
                subtitle="Race Story"
                size="large"
                format={format}
                theme={theme}
            />

            {/* Date and location meta */}
            <View style={styles.metaContainer}>
                <Text style={styles.meta}>{dateStr}</Text>
                {location && <Text style={styles.meta}>{location}</Text>}
            </View>

            <View style={styles.divider} />

            {/* Description text */}
            <View style={styles.descriptionContainer}>
                <Text style={styles.quoteDecoration}>&ldquo;</Text>
                <Text style={styles.description}>{description}</Text>
            </View>

            {/* Data visualization: splits chart + elevation profile */}
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
        </Page>
    )
}
