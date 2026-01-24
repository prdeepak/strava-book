import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { getMonthName, formatDistance, formatTime } from '@/lib/activity-utils'
import { StravaActivity } from '@/lib/strava'

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

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
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
    fontSize: 14 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.backgroundColor,
    opacity: 0.6,
    letterSpacing: 3,
    marginBottom: 8 * format.scaleFactor,
    textTransform: 'uppercase',
  },
  monthName: {
    fontSize: 96 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.backgroundColor,
    lineHeight: 1,
    letterSpacing: -2,
    marginBottom: 8 * format.scaleFactor,
  },
  yearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8 * format.scaleFactor,
  },
  year: {
    fontSize: 32 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    letterSpacing: 4,
  },
  decorativeBar: {
    width: 80 * format.scaleFactor,
    height: 4 * format.scaleFactor,
    backgroundColor: theme.accentColor,
    marginLeft: 20 * format.scaleFactor,
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
    marginBottom: 30 * format.scaleFactor,
  },
  statBox: {
    width: '33.33%',
    paddingRight: 10 * format.scaleFactor,
    marginBottom: 24 * format.scaleFactor,
  },
  statValue: {
    fontSize: 42 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    lineHeight: 1,
    marginBottom: 6 * format.scaleFactor,
  },
  statLabel: {
    fontSize: 10 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statValueSmall: {
    fontSize: 32 * format.scaleFactor,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.primaryColor,
    opacity: 0.12,
    marginTop: 10 * format.scaleFactor,
    marginBottom: 24 * format.scaleFactor,
  },
  highlightsSection: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 10 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.4,
    letterSpacing: 2,
    marginBottom: 16 * format.scaleFactor,
    textTransform: 'uppercase',
  },
  quote: {
    fontSize: 15 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    fontStyle: 'italic',
    lineHeight: 1.6,
    marginBottom: 8 * format.scaleFactor,
  },
  quoteAuthor: {
    fontSize: 11 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
    marginBottom: 20 * format.scaleFactor,
  },
})

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
