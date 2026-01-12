import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, YearSummary, DEFAULT_THEME, FORMATS, MonthlyStats } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { formatPeriodRange } from '@/lib/activity-utils'

interface YearStatsProps {
  activity?: {
    yearSummary?: YearSummary | null
  }
  yearSummary?: YearSummary
  periodName?: string  // Display text for time period
  startDate?: string   // ISO date string for period start
  endDate?: string     // ISO date string for period end
  format?: BookFormat
  theme?: BookTheme
}

// Create styles with format scaling
const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    padding: format.safeMargin,
    backgroundColor: theme.backgroundColor,
    flexDirection: 'column',
  },

  // Header section
  header: {
    marginBottom: 16 * format.scaleFactor,
  },
  yearTitle: {
    fontSize: Math.max(60, 84 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    textAlign: 'center',
    marginBottom: 2 * format.scaleFactor,
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: Math.max(9, 11 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    textAlign: 'center',
    marginBottom: 2 * format.scaleFactor,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  periodRangeText: {
    fontSize: Math.max(11, 14 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    textAlign: 'center',
    marginBottom: 8 * format.scaleFactor,
    opacity: 0.5,
    letterSpacing: 1,
  },

  // Hero stats - Big Three
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20 * format.scaleFactor,
    paddingBottom: 16 * format.scaleFactor,
    borderBottomWidth: 2,
    borderBottomColor: theme.primaryColor,
    borderBottomStyle: 'solid',
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroValue: {
    fontSize: Math.max(52, 86 * format.scaleFactor),
    fontFamily: 'Courier-Bold', // Monospace for tabular figures
    color: theme.accentColor,
    lineHeight: 1,
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: Math.max(13, 16 * format.scaleFactor),
    fontFamily: 'Courier-Bold',
    color: theme.accentColor,
    opacity: 0.7,
    marginTop: 2 * format.scaleFactor,
  },
  heroLabel: {
    fontSize: Math.max(7, 9 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 6 * format.scaleFactor,
    opacity: 0.6,
  },

  // Secondary stats grid
  secondarySection: {
    marginBottom: 14 * format.scaleFactor,
  },
  sectionTitle: {
    fontSize: Math.max(11, 14 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16 * format.scaleFactor,
    opacity: 0.7,
  },
  secondaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6 * format.scaleFactor,
  },
  secondaryStat: {
    alignItems: 'center',
    width: '22%',
    marginBottom: 6 * format.scaleFactor,
  },
  secondaryValue: {
    fontSize: Math.max(20, 26 * format.scaleFactor),
    fontFamily: 'Courier-Bold', // Monospace for alignment
    color: theme.primaryColor,
    lineHeight: 1.1,
  },
  secondaryLabel: {
    fontSize: Math.max(6, 7 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
    marginTop: 2 * format.scaleFactor,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Best efforts section
  bestEffortsSection: {
    marginTop: 12 * format.scaleFactor,
  },
  bestEffortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3 * format.scaleFactor,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.primaryColor,
    borderBottomStyle: 'solid',
    opacity: 0.8,
  },
  bestEffortName: {
    fontSize: Math.max(6, 8 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    flex: 1,
  },
  bestEffortTime: {
    fontSize: Math.max(6, 8 * format.scaleFactor),
    fontFamily: 'Courier',
    color: theme.accentColor,
    textAlign: 'right',
  },

  // Monthly graph section
  graphSection: {
    marginTop: 10 * format.scaleFactor,
    marginBottom: 0,
  },
  graphTitle: {
    fontSize: Math.max(7, 9 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 5 * format.scaleFactor,
    opacity: 0.6,
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

// Helper to generate synthetic year summary for testing/single activities
const generateSyntheticYearSummary = (activity?: Partial<StravaActivity>): YearSummary => {
  const year = activity?.start_date_local
    ? new Date(activity.start_date_local).getFullYear()
    : new Date().getFullYear()

  // Create synthetic best efforts if activity doesn't have them
  const syntheticBestEfforts = [
    { name: '400m', elapsed_time: 75, moving_time: 75, distance: 400, start_index: 0, end_index: 100, pr_rank: 1 },
    { name: '1/2 mile', elapsed_time: 156, moving_time: 156, distance: 805, start_index: 0, end_index: 200, pr_rank: null },
    { name: '1k', elapsed_time: 210, moving_time: 210, distance: 1000, start_index: 0, end_index: 300, pr_rank: 2 },
    { name: '1 mile', elapsed_time: 342, moving_time: 342, distance: 1609, start_index: 0, end_index: 400, pr_rank: null },
    { name: '5k', elapsed_time: 1080, moving_time: 1080, distance: 5000, start_index: 0, end_index: 1000, pr_rank: 3 },
    { name: '10k', elapsed_time: 2280, moving_time: 2280, distance: 10000, start_index: 0, end_index: 2000, pr_rank: null },
  ]

  const activityWithEfforts = (activity?.best_efforts?.length ?? 0) > 0
    ? activity
    : { ...activity, best_efforts: syntheticBestEfforts }

  return {
    year,
    totalDistance: activity?.distance || 5000000, // 5000 km for testing
    totalTime: activity?.moving_time || 900000, // 250 hours for testing
    totalElevation: activity?.total_elevation_gain || 50000, // 50000m for testing
    activityCount: activity ? 1 : 250,
    longestActivity: (activity || {}) as StravaActivity,
    fastestActivity: (activityWithEfforts || {}) as StravaActivity,
    activeDays: new Set(['2024-01-01']), // Placeholder
    monthlyStats: generateMonthlyStats(year),
    races: activity?.workout_type === 1 ? [activity as StravaActivity] : [],
  }
}

// Helper to generate monthly stats for visualization
const generateMonthlyStats = (year: number): MonthlyStats[] => {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    year,
    activityCount: Math.floor(Math.random() * 25) + 10,
    totalDistance: Math.floor(Math.random() * 500000) + 200000,
    totalTime: Math.floor(Math.random() * 80000) + 40000,
    totalElevation: Math.floor(Math.random() * 5000) + 2000,
    activeDays: Math.floor(Math.random() * 20) + 10,
    activities: [],
  }))
}

export const YearStats = ({
  activity,
  yearSummary: propYearSummary,
  periodName: propPeriodName,
  startDate: propStartDate,
  endDate: propEndDate,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME
}: YearStatsProps) => {
  const styles = createStyles(format, theme)

  // Get year summary from props or activity or generate synthetic
  const yearSummary = propYearSummary || activity?.yearSummary || generateSyntheticYearSummary()

  // Calculate period range display
  let periodRangeDisplay: string | null = null
  if (propStartDate && propEndDate) {
    const start = new Date(propStartDate)
    const end = new Date(propEndDate)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      periodRangeDisplay = formatPeriodRange(start, end)
    }
  }

  // Determine what to display as main period text
  let mainPeriodDisplay: string
  let showPeriodRangeBelow: boolean

  if (propPeriodName) {
    mainPeriodDisplay = propPeriodName
    showPeriodRangeBelow = periodRangeDisplay !== null && periodRangeDisplay !== propPeriodName
  } else if (periodRangeDisplay) {
    mainPeriodDisplay = periodRangeDisplay
    showPeriodRangeBelow = false
  } else {
    mainPeriodDisplay = String(yearSummary.year)
    showPeriodRangeBelow = false
  }

  const distance = formatDistance(yearSummary.totalDistance)
  const time = formatTime(yearSummary.totalTime)
  const elevation = formatElevation(yearSummary.totalElevation)

  // Calculate secondary stats
  const avgDistancePerActivity = yearSummary.activityCount > 0
    ? Math.round(yearSummary.totalDistance / 1000 / yearSummary.activityCount)
    : 0

  const avgTimePerActivity = yearSummary.activityCount > 0
    ? (yearSummary.totalTime / 3600 / yearSummary.activityCount).toFixed(1)
    : '0.0'

  const activeDays = yearSummary.activeDays
    ? (typeof yearSummary.activeDays === 'number' ? yearSummary.activeDays : yearSummary.activeDays.size)
    : 0

  // Calculate total kudos and comments from races/activities
  const totalKudos = yearSummary.races?.reduce((sum, race) => sum + (race.kudos_count || 0), 0) || 0

  // Get best efforts from fastest activity (limit to 4 for space)
  const bestEfforts = yearSummary.fastestActivity?.best_efforts?.slice(0, 4) || []

  return (
    <Document>
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
        {/* Period Title */}
        <View style={styles.header}>
          <Text style={styles.yearTitle}>{mainPeriodDisplay}</Text>
          {showPeriodRangeBelow && periodRangeDisplay && (
            <Text style={styles.periodRangeText}>{periodRangeDisplay}</Text>
          )}
          <Text style={styles.subtitle}>In Review</Text>
        </View>

        {/* Hero Stats - Big Three in a row */}
        <View style={styles.heroStatsRow}>
          {/* Total Distance */}
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{distance.value}</Text>
            <Text style={styles.heroUnit}>{distance.unit}</Text>
            <Text style={styles.heroLabel}>Distance</Text>
          </View>

          {/* Total Time */}
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{time.value}</Text>
            <Text style={styles.heroUnit}>{time.unit}</Text>
            <Text style={styles.heroLabel}>Time</Text>
          </View>

          {/* Total Elevation */}
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{elevation.value}</Text>
            <Text style={styles.heroUnit}>{elevation.unit}</Text>
            <Text style={styles.heroLabel}>Elevation</Text>
          </View>
        </View>

        {/* Secondary Stats Grid */}
        <View style={styles.secondarySection}>
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
              <Text style={styles.secondaryValue}>{avgDistancePerActivity}</Text>
              <Text style={styles.secondaryLabel}>Avg Distance (km)</Text>
            </View>

            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{avgTimePerActivity}</Text>
              <Text style={styles.secondaryLabel}>Avg Time (hrs)</Text>
            </View>

            {yearSummary.races && yearSummary.races.length > 0 && (
              <View style={styles.secondaryStat}>
                <Text style={styles.secondaryValue}>{yearSummary.races.length}</Text>
                <Text style={styles.secondaryLabel}>Races</Text>
              </View>
            )}

            {totalKudos > 0 && (
              <View style={styles.secondaryStat}>
                <Text style={styles.secondaryValue}>{totalKudos}</Text>
                <Text style={styles.secondaryLabel}>Total Kudos</Text>
              </View>
            )}
          </View>
        </View>

        {/* Best Efforts Section */}
        {bestEfforts.length > 0 && (
          <View style={styles.bestEffortsSection}>
            <Text style={styles.sectionTitle}>Best Efforts</Text>
            {bestEfforts.slice(0, 6).map((effort, i) => {
              const minutes = Math.floor(effort.elapsed_time / 60)
              const seconds = effort.elapsed_time % 60
              const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`

              return (
                <View key={i} style={styles.bestEffortRow}>
                  <Text style={styles.bestEffortName}>{effort.name}</Text>
                  <Text style={styles.bestEffortTime}>{timeStr}</Text>
                </View>
              )
            })}
          </View>
        )}
      </Page>
    </Document>
  )
}
