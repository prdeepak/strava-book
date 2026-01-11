import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { getMonthName, formatDistance, formatTime } from '@/lib/activity-utils'

interface MonthlyDividerProps {
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
  // For test harness compatibility
  activity?: any
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
    flexDirection: 'row',
  },
  // Left side - dramatic month name and year
  leftPanel: {
    width: '35%',
    backgroundColor: theme.primaryColor,
    padding: format.safeMargin,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  monthSection: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.backgroundColor,
    opacity: 0.7,
    letterSpacing: 2,
    marginBottom: 8 * format.scaleFactor,
  },
  monthName: {
    fontSize: 84 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.backgroundColor,
    lineHeight: 0.9,
    letterSpacing: -1,
    marginBottom: 12 * format.scaleFactor,
  },
  year: {
    fontSize: 28 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    letterSpacing: 4,
  },
  decorativeBar: {
    width: 60 * format.scaleFactor,
    height: 4 * format.scaleFactor,
    backgroundColor: theme.accentColor,
    marginTop: 20 * format.scaleFactor,
  },
  bottomAccent: {
    width: '100%',
    height: 2,
    backgroundColor: theme.accentColor,
    opacity: 0.3,
  },
  // Right side - stats and content
  rightPanel: {
    width: '65%',
    padding: format.safeMargin,
    paddingLeft: format.safeMargin * 1.5,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  statsGrid: {
    marginBottom: 40 * format.scaleFactor,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 24 * format.scaleFactor,
  },
  statBox: {
    flex: 1,
    paddingRight: 10 * format.scaleFactor,
  },
  statValue: {
    fontSize: 36 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    lineHeight: 1,
    marginBottom: 6 * format.scaleFactor,
  },
  statLabel: {
    fontSize: 10 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    letterSpacing: 1.2,
  },
  statValueSmall: {
    fontSize: 28 * format.scaleFactor,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.primaryColor,
    opacity: 0.15,
    marginTop: 30 * format.scaleFactor,
    marginBottom: 30 * format.scaleFactor,
  },
  highlightsSection: {
    marginTop: 10 * format.scaleFactor,
  },
  highlightLabel: {
    fontSize: 9 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
    letterSpacing: 1.5,
    marginBottom: 12 * format.scaleFactor,
  },
  quote: {
    fontSize: 14 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    fontStyle: 'italic',
    lineHeight: 1.5,
    marginBottom: 6 * format.scaleFactor,
  },
  quoteAuthor: {
    fontSize: 11 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
    marginBottom: 16 * format.scaleFactor,
  },
})

export const MonthlyDivider = ({
  month: propMonth,
  year: propYear,
  stats: propStats,
  highlights,
  format: propFormat,
  theme = DEFAULT_THEME,
  units = 'metric',
  activity
}: MonthlyDividerProps) => {
  // Handle test harness case: derive props from activity if provided
  let month = propMonth
  let year = propYear
  let stats = propStats
  let format = propFormat || FORMATS['10x10']

  if (activity && !propMonth) {
    // Derive from activity for testing
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
          quote: quoteText.length > 180 ? quoteText.substring(0, 180) + '...' : quoteText,
          author: activity.name.substring(0, 50)
        })
      }
    }
  }

  // Ensure we have required values
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
    <Document>
      <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
        <View style={styles.container}>
          {/* Left Panel - Dramatic Month Display */}
          <View style={styles.leftPanel}>
            <View style={styles.monthSection}>
              <Text style={styles.dateLabel}>{monthStr}.{year}</Text>
              <Text style={styles.monthName}>{monthName}</Text>
              <Text style={styles.year}>{year}</Text>
              <View style={styles.decorativeBar} />
            </View>

            <View style={styles.bottomAccent} />
          </View>

          {/* Right Panel - Statistics and Highlights */}
          <View style={styles.rightPanel}>
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.activityCount}</Text>
                  <Text style={styles.statLabel}>
                    {stats.activityCount === 1 ? 'ACTIVITY' : 'ACTIVITIES'}
                  </Text>
                </View>
                {stats.activeDays !== undefined && (
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{stats.activeDays}</Text>
                    <Text style={styles.statLabel}>ACTIVE DAYS</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statValueSmall]}>
                    {formatDistance(stats.totalDistance, units)}
                  </Text>
                  <Text style={styles.statLabel}>TOTAL DISTANCE</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statValueSmall]}>
                    {formatTime(stats.totalTime)}
                  </Text>
                  <Text style={styles.statLabel}>TOTAL TIME</Text>
                </View>
              </View>

              {stats.totalElevation !== undefined && stats.totalElevation > 0 && (
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, styles.statValueSmall]}>
                      {formatLargeNumber(stats.totalElevation)} m
                    </Text>
                    <Text style={styles.statLabel}>TOTAL ELEVATION</Text>
                  </View>
                </View>
              )}
            </View>

            {highlights && highlights.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.highlightsSection}>
                  <Text style={styles.highlightLabel}>MONTH HIGHLIGHTS</Text>
                  {highlights.slice(0, 2).map((highlight, idx) => (
                    <View key={idx}>
                      {highlight.quote && (
                        <Text style={styles.quote}>"{highlight.quote}"</Text>
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
    </Document>
  )
}
