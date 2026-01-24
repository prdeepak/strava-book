import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { getMonthName, formatDistance, formatTime } from '@/lib/activity-utils'
import { StravaActivity } from '@/lib/strava'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

interface MonthlyDividerProps {
  // Primary input: array of activities for this month
  activities?: StravaActivity[]
  // Explicit props (used if activities not provided)
  month?: number  // 0-11
  year?: number
  stats?: {
    activityCount: number
    totalDistance: number  // in meters
    totalTime: number      // in seconds
    activeDays?: number
    totalElevation?: number
  }
  highlights?: {
    quote?: string
    author?: string
  }[]
  heroImage?: string
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  // For test harness compatibility (single activity)
  activity?: StravaActivity
}

const createStyles = (format: BookFormat, theme: BookTheme) => {
  // Resolve design tokens from theme
  const displayTypo = resolveTypography('displayLarge', theme, format)
  const headingTypo = resolveTypography('heading', theme, format)
  const subheadingTypo = resolveTypography('subheading', theme, format)
  const bodyTypo = resolveTypography('body', theme, format)
  const captionTypo = resolveTypography('caption', theme, format)
  const statTypo = resolveTypography('stat', theme, format)
  const spacing = resolveSpacing(theme, format)
  const effects = resolveEffects(theme)

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: 0,
    },
    container: {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
    },
    // Top header section - dramatic month name with full width
    headerSection: {
      height: '45%',
      backgroundColor: theme.primaryColor,
      padding: format.safeMargin,
      paddingTop: format.safeMargin * 1.5,
      flexDirection: 'column',
      justifyContent: 'flex-end',
    },
    dateLabel: {
      fontSize: bodyTypo.fontSize,
      fontFamily: bodyTypo.fontFamily,
      color: theme.backgroundColor,
      opacity: effects.backgroundImageOpacity + 0.1,
      letterSpacing: 3,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
    },
    monthName: {
      fontSize: displayTypo.fontSize * 1.3,
      fontFamily: displayTypo.fontFamily,
      color: theme.backgroundColor,
      lineHeight: 1,
      letterSpacing: displayTypo.letterSpacing ?? -2,
      marginBottom: spacing.xs,
    },
    yearLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    year: {
      fontSize: statTypo.fontSize,
      fontFamily: headingTypo.fontFamily,
      color: theme.accentColor,
      letterSpacing: 4,
    },
    decorativeBar: {
      width: spacing.xl,
      height: spacing.xs / 2,
      backgroundColor: theme.accentColor,
      marginLeft: spacing.md,
    },
    // Bottom content section - stats and highlights
    contentSection: {
      height: '55%',
      padding: format.safeMargin,
      paddingTop: format.safeMargin * 1.2,
      flexDirection: 'column',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.lg * 0.6,
    },
    statBox: {
      width: '33.33%',
      paddingRight: spacing.sm * 0.6,
      marginBottom: spacing.md,
    },
    statValue: {
      fontSize: statTypo.fontSize * 1.3,
      fontFamily: headingTypo.fontFamily,
      color: theme.primaryColor,
      lineHeight: 1,
      marginBottom: spacing.xs * 0.75,
    },
    statLabel: {
      fontSize: captionTypo.fontSize,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      letterSpacing: captionTypo.letterSpacing ?? 1.5,
      textTransform: 'uppercase',
    },
    statValueSmall: {
      fontSize: statTypo.fontSize,
    },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: theme.primaryColor,
      opacity: effects.textOverlayOpacity * 0.4,
      marginTop: spacing.sm * 0.6,
      marginBottom: spacing.md,
    },
    highlightsSection: {
      flex: 1,
    },
    highlightLabel: {
      fontSize: captionTypo.fontSize,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.textOverlayOpacity + 0.1,
      letterSpacing: 2,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
    },
    quote: {
      fontSize: bodyTypo.fontSize * 1.1,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      fontStyle: 'italic',
      lineHeight: bodyTypo.lineHeight ?? 1.6,
      marginBottom: spacing.xs,
    },
    quoteAuthor: {
      fontSize: captionTypo.fontSize * 1.1,
      fontFamily: bodyTypo.fontFamily,
      color: theme.accentColor,
      marginBottom: spacing.md,
    },
  })
}

export const MonthlyDivider = ({
  activities,
  month: propMonth,
  year: propYear,
  stats: propStats,
  highlights: propHighlights,
  heroImage: propHeroImage,
  format: propFormat,
  theme = DEFAULT_THEME,
  units = 'metric',
  activity
}: MonthlyDividerProps) => {
  const format = propFormat || FORMATS['10x10']

  let month = propMonth
  let year = propYear
  let stats = propStats
  let highlights = propHighlights
  let heroImage = propHeroImage

  // CASE 1: activities array provided (from BookDocument)
  if (activities && activities.length > 0) {
    // Derive month/year from first activity
    const firstActivity = activities[0]
    const firstDate = new Date(firstActivity.start_date_local || firstActivity.start_date)
    month = firstDate.getMonth()
    year = firstDate.getFullYear()

    // Calculate stats from all activities
    const activeDaysSet = new Set<string>()
    activities.forEach(a => {
      const date = new Date(a.start_date_local || a.start_date)
      activeDaysSet.add(date.toISOString().split('T')[0])
    })

    stats = {
      activityCount: activities.length,
      totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalTime: activities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
      activeDays: activeDaysSet.size,
      totalElevation: activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
    }

    // Extract highlights from activities with descriptions
    if (!highlights || highlights.length === 0) {
      highlights = []
      const activitiesWithDesc = activities.filter(a => a.description && a.description.trim().length > 0)
      activitiesWithDesc.slice(0, 2).forEach(a => {
        const quoteText = a.description || ''
        highlights!.push({
          quote: quoteText.length > 150 ? quoteText.substring(0, 150) + '...' : quoteText,
          author: a.name?.substring(0, 40) || 'Activity'
        })
      })
    }

    // Find hero image from activities with photos
    if (!heroImage) {
      for (const a of activities) {
        const photoUrls = a.photos?.primary?.urls as Record<string, string> | undefined
        if (photoUrls) {
          const sizes = Object.keys(photoUrls).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a)
          if (sizes.length > 0) {
            heroImage = photoUrls[String(sizes[0])]
            break
          }
        }
      }
    }
  }
  // CASE 2: single activity provided (test harness)
  else if (activity && propMonth === undefined) {
    const activityDate = new Date(activity.start_date || activity.start_date_local || new Date())
    month = activityDate.getMonth()
    year = activityDate.getFullYear()
    stats = {
      activityCount: 1,
      totalDistance: activity.distance || 42195,
      totalTime: activity.moving_time || 14400,
      activeDays: 1,
      totalElevation: activity.total_elevation_gain || 0
    }

    // Extract a quote from activity description or name
    if (activity.description || activity.name) {
      highlights = highlights || []
      if (highlights.length === 0) {
        const quoteText = activity.description || activity.name
        highlights.push({
          quote: quoteText.length > 150 ? quoteText.substring(0, 150) + '...' : quoteText,
          author: activity.name.substring(0, 40)
        })
      }
    }
  }

  // Ensure we have required values (CASE 3: explicit props or defaults)
  if (month === undefined) month = new Date().getMonth()
  if (year === undefined) year = new Date().getFullYear()
  if (!stats) {
    stats = {
      activityCount: 0,
      totalDistance: 0,
      totalTime: 0
    }
  }

  const styles = createStyles(format, theme)
  const monthName = getMonthName(month)
  const monthStr = String(month + 1).padStart(2, '0')

  // Format large numbers with commas
  const formatLargeNumber = (num: number) => {
    return Math.round(num).toLocaleString('en-US')
  }

  return (
      <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
        <View style={styles.container}>
          {/* Header Section - Full-width Month Display */}
          <View style={styles.headerSection}>
            <Text style={styles.dateLabel}>{monthStr} / {year}</Text>
            <Text style={styles.monthName}>{monthName}</Text>
            <View style={styles.yearLine}>
              <Text style={styles.year}>{year}</Text>
              <View style={styles.decorativeBar} />
            </View>
          </View>

          {/* Content Section - Stats and Highlights */}
          <View style={styles.contentSection}>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.activityCount}</Text>
                <Text style={styles.statLabel}>
                  {stats.activityCount === 1 ? 'Activity' : 'Activities'}
                </Text>
              </View>

              {stats.activeDays !== undefined && (
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.activeDays}</Text>
                  <Text style={styles.statLabel}>Active Days</Text>
                </View>
              )}

              <View style={styles.statBox}>
                <Text style={[styles.statValue, styles.statValueSmall]}>
                  {formatDistance(stats.totalDistance, units)}
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statValue, styles.statValueSmall]}>
                  {formatTime(stats.totalTime)}
                </Text>
                <Text style={styles.statLabel}>Moving Time</Text>
              </View>

              {stats.totalElevation !== undefined && stats.totalElevation > 0 && (
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statValueSmall]}>
                    {formatLargeNumber(stats.totalElevation)} m
                  </Text>
                  <Text style={styles.statLabel}>Elevation</Text>
                </View>
              )}
            </View>

            {highlights && highlights.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.highlightsSection}>
                  <Text style={styles.highlightLabel}>Month Highlights</Text>
                  {highlights.slice(0, 2).map((highlight, idx) => (
                    <View key={idx}>
                      {highlight.quote && (
                        <Text style={styles.quote}>&ldquo;{highlight.quote}&rdquo;</Text>
                      )}
                      {highlight.author && (
                        <Text style={styles.quoteAuthor}>— {highlight.author}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const MonthlyDividerDocument = (props: MonthlyDividerProps) => (
  <Document>
    <MonthlyDivider {...props} />
  </Document>
)
