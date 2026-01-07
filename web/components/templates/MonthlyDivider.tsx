import { Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { getMonthName, formatDistance, formatTime } from '@/lib/activity-log-utils'

interface MonthlyDividerProps {
  month: number  // 0-11
  year: number
  stats: {
    activityCount: number
    totalDistance: number  // in meters
    totalTime: number      // in seconds
  }
  heroImage?: string
  format: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  content: {
    zIndex: 1,
    alignItems: 'center',
    width: '100%',
  },
  monthName: {
    fontSize: 72 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    marginBottom: 20 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: 2,
  },
  year: {
    fontSize: 24 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.7,
    marginBottom: 40 * format.scaleFactor,
    textAlign: 'center',
  },
  divider: {
    width: 120 * format.scaleFactor,
    height: 3,
    backgroundColor: theme.accentColor,
    marginBottom: 40 * format.scaleFactor,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
    marginTop: 20 * format.scaleFactor,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: Math.max(18, 24 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Math.max(9, 11 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})

export const MonthlyDivider = ({
  month,
  year,
  stats,
  heroImage,
  format,
  theme = DEFAULT_THEME,
  units = 'metric'
}: MonthlyDividerProps) => {
  const styles = createStyles(format, theme)
  const monthName = getMonthName(month)

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Hero image background (if provided) */}
      {heroImage && (
        <View style={styles.heroImageContainer}>
          <Image
            src={`/api/proxy-image?url=${encodeURIComponent(heroImage)}`}
            style={styles.heroImage}
          />
        </View>
      )}

      {/* Main content */}
      <View style={styles.content}>
        <Text style={styles.monthName}>{monthName.toUpperCase()}</Text>
        <Text style={styles.year}>{year}</Text>

        <View style={styles.divider} />

        {/* Month statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.activityCount}</Text>
            <Text style={styles.statLabel}>
              {stats.activityCount === 1 ? 'Activity' : 'Activities'}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {formatDistance(stats.totalDistance, units)}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {formatTime(stats.totalTime)}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}
