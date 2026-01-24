import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveActivityLocation } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

const createStyles = (format: BookFormat, theme: BookTheme) => {
    // Resolve design tokens
    const displayTypo = resolveTypography('displaySmall', theme, format)
    const headingTypo = resolveTypography('heading', theme, format)
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
        eventLabel: {
            color: theme.accentColor,
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: headingTypo.fontFamily,
            textTransform: 'uppercase',
            letterSpacing: captionTypo.letterSpacing ?? 2,
            marginBottom: spacing.xs,
        },
        title: {
            fontSize: headingTypo.fontSize * 1.5,
            fontFamily: headingTypo.fontFamily,
            color: theme.primaryColor,
            marginBottom: spacing.xs,
            lineHeight: headingTypo.lineHeight ?? 1.2,
        },
        meta: {
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity + 0.15,
            fontSize: captionTypo.fontSize * 1.2,
            fontFamily: bodyTypo.fontFamily,
            marginBottom: spacing.xs / 2,
        },
        divider: {
            height: 3,
            backgroundColor: theme.accentColor,
            marginTop: spacing.sm,
            marginBottom: spacing.md,
            width: spacing.xl * 0.8,
        },
        descriptionContainer: {
            flex: 1,
        },
        description: {
            fontSize: bodyTypo.fontSize * 1.15,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            lineHeight: bodyTypo.lineHeight ?? 1.6,
            textAlign: 'left',
        },
        quoteDecoration: {
            fontSize: displayTypo.fontSize * 1.5,
            fontFamily: headingTypo.fontFamily,
            color: theme.accentColor,
            opacity: effects.textOverlayOpacity * 0.65,
            position: 'absolute',
            top: -spacing.md,
            left: -spacing.sm * 0.6,
        },
        statsFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: `${theme.primaryColor}20`,
            paddingTop: spacing.sm,
            marginTop: spacing.md,
        },
        footerStat: {
            alignItems: 'center',
        },
        footerStatValue: {
            fontSize: headingTypo.fontSize,
            fontFamily: headingTypo.fontFamily,
            color: theme.primaryColor,
        },
        footerStatLabel: {
            fontSize: captionTypo.fontSize,
            fontFamily: bodyTypo.fontFamily,
            color: theme.primaryColor,
            opacity: effects.backgroundImageOpacity,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: spacing.xs / 2,
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

    const location = resolveActivityLocation(activity)

    // Format date
    const dateStr = new Date(activity.start_date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })

    // Format stats
    const distance = activity.distance ? (activity.distance / 1000).toFixed(1) : '0.0'
    const time = activity.moving_time
        ? new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
        : '00:00:00'

    // Only show description page if there's a description
    const description = activity.description || ''

    return (
        <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.eventLabel}>Race Story</Text>
                <Text style={styles.title}>{activity.name}</Text>
                <Text style={styles.meta}>{dateStr}</Text>
                {location && <Text style={styles.meta}>{location}</Text>}
                <View style={styles.divider} />
            </View>

            <View style={styles.descriptionContainer}>
                <Text style={styles.quoteDecoration}>&ldquo;</Text>
                <Text style={styles.description}>{description}</Text>
            </View>

            <View style={styles.statsFooter}>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{distance}</Text>
                    <Text style={styles.footerStatLabel}>Kilometers</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{time}</Text>
                    <Text style={styles.footerStatLabel}>Time</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{activity.kudos_count || 0}</Text>
                    <Text style={styles.footerStatLabel}>Kudos</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{activity.comment_count || 0}</Text>
                    <Text style={styles.footerStatLabel}>Comments</Text>
                </View>
            </View>
        </Page>
    )
}
