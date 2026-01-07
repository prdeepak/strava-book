import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, YearSummary, DEFAULT_THEME } from '@/lib/book-types'

interface YearStatsProps {
  yearSummary: YearSummary
  format: BookFormat
  theme: BookTheme
}

// Create styles with format scaling
const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    padding: format.safeMargin,
    backgroundColor: theme.backgroundColor,
  },
  yearTitle: {
    fontSize: 64 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textAlign: 'center',
    marginBottom: 8 * format.scaleFactor,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: Math.max(12, 16 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    textAlign: 'center',
    marginBottom: 40 * format.scaleFactor,
    opacity: 0.7,
  },
  heroStatsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32 * format.scaleFactor,
  },
  heroStat: {
    alignItems: 'center',
    marginBottom: 24 * format.scaleFactor,
  },
  heroValue: {
    fontSize: Math.max(56, 72 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    lineHeight: 1,
  },
  heroUnit: {
    fontSize: Math.max(18, 24 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
    opacity: 0.8,
    marginTop: 4 * format.scaleFactor,
  },
  heroLabel: {
    fontSize: Math.max(12, 16 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 8 * format.scaleFactor,
    opacity: 0.7,
  },
  secondaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 32 * format.scaleFactor,
    paddingTop: 24 * format.scaleFactor,
    borderTopWidth: 2,
    borderTopColor: theme.primaryColor,
    borderTopStyle: 'solid',
    gap: 16 * format.scaleFactor,
  },
  secondaryStat: {
    alignItems: 'center',
    width: '30%',
  },
  secondaryValue: {
    fontSize: Math.max(20, 28 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
  },
  secondaryLabel: {
    fontSize: Math.max(9, 11 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    marginTop: 4 * format.scaleFactor,
    textAlign: 'center',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: theme.primaryColor,
    opacity: 0.2,
    marginVertical: 16 * format.scaleFactor,
    alignSelf: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16 * format.scaleFactor,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Math.max(8, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
  },
})

// Helper to format time
const formatTime = (seconds: number): { value: number; unit: string } => {
  const hours = seconds / 3600
  if (hours >= 1) {
    return { value: Math.round(hours), unit: 'hours' }
  }
  const minutes = seconds / 60
  return { value: Math.round(minutes), unit: 'minutes' }
}

// Helper to format distance
const formatDistance = (meters: number): { value: number; unit: string } => {
  const km = meters / 1000
  return { value: Math.round(km), unit: 'km' }
}

// Helper to format elevation
const formatElevation = (meters: number): { value: number; unit: string } => {
  return { value: Math.round(meters), unit: 'm' }
}

// Helper to calculate average pace (min/km)
const calculateAveragePace = (totalDistance: number, totalTime: number): string => {
  if (totalDistance === 0) return 'N/A'
  const paceMinPerKm = (totalTime / 60) / (totalDistance / 1000)
  const minutes = Math.floor(paceMinPerKm)
  const seconds = Math.round((paceMinPerKm - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const YearStats = ({
  yearSummary,
  format,
  theme = DEFAULT_THEME
}: YearStatsProps) => {
  const styles = createStyles(format, theme)

  const distance = formatDistance(yearSummary.totalDistance)
  const time = formatTime(yearSummary.totalTime)
  const elevation = formatElevation(yearSummary.totalElevation)
  const averagePace = calculateAveragePace(yearSummary.totalDistance, yearSummary.totalTime)

  // Calculate some interesting secondary stats
  const avgDistancePerActivity = yearSummary.activityCount > 0
    ? (yearSummary.totalDistance / 1000 / yearSummary.activityCount).toFixed(1)
    : '0'

  const avgTimePerActivity = yearSummary.activityCount > 0
    ? (yearSummary.totalTime / 3600 / yearSummary.activityCount).toFixed(1)
    : '0'

  // Extract year from yearSummary or longestActivity
  const year = yearSummary.year
    || (yearSummary.longestActivity && new Date(yearSummary.longestActivity.start_date_local).getFullYear())
    || new Date().getFullYear()

  // Active days calculation
  const activeDays = yearSummary.activeDays
    ? (typeof yearSummary.activeDays === 'number' ? yearSummary.activeDays : yearSummary.activeDays.size)
    : 0

  return (
    <Document>
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
        {/* Year Title */}
        <Text style={styles.yearTitle}>{year}</Text>
        <Text style={styles.subtitle}>Year in Review</Text>

        {/* Hero Stats - Top 3 most important */}
        <View style={styles.heroStatsContainer}>
          {/* Total Distance */}
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{distance.value.toLocaleString()}</Text>
            <Text style={styles.heroUnit}>{distance.unit}</Text>
            <Text style={styles.heroLabel}>Total Distance</Text>
          </View>

          {/* Total Time */}
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{time.value.toLocaleString()}</Text>
            <Text style={styles.heroUnit}>{time.unit}</Text>
            <Text style={styles.heroLabel}>Total Time</Text>
          </View>

          {/* Total Elevation */}
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{elevation.value.toLocaleString()}</Text>
            <Text style={styles.heroUnit}>{elevation.unit}</Text>
            <Text style={styles.heroLabel}>Total Elevation Gain</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Secondary Stats Grid */}
        <View style={styles.secondaryStatsGrid}>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryValue}>{yearSummary.activityCount}</Text>
            <Text style={styles.secondaryLabel}>Activities</Text>
          </View>

          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryValue}>{activeDays}</Text>
            <Text style={styles.secondaryLabel}>Active Days</Text>
          </View>

          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryValue}>{avgDistancePerActivity} km</Text>
            <Text style={styles.secondaryLabel}>Avg Distance</Text>
          </View>

          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryValue}>{avgTimePerActivity} hrs</Text>
            <Text style={styles.secondaryLabel}>Avg Duration</Text>
          </View>

          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryValue}>{averagePace}</Text>
            <Text style={styles.secondaryLabel}>Avg Pace (min/km)</Text>
          </View>

          {yearSummary.races && yearSummary.races.length > 0 && (
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{yearSummary.races.length}</Text>
              <Text style={styles.secondaryLabel}>Races</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Strava Book</Text>
        </View>
      </Page>
    </Document>
  )
}
