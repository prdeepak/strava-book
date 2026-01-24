import { Page, Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, YearSummary, FORMATS } from '@/lib/book-types'
import { formatPeriodRange } from '@/lib/activity-utils'
import { StravaActivity } from '@/lib/strava'

export interface BackCoverProps {
  activity?: {
    yearSummary?: YearSummary | null
    start_date?: string
    start_date_local?: string
  }
  yearSummary?: YearSummary
  periodName?: string  // Display text for time period
  startDate?: string   // ISO date string for period start
  endDate?: string     // ISO date string for period end
  backgroundPhotoUrl?: string  // Background photo for the back cover
  format?: BookFormat
  theme?: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.primaryColor,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: format.dimensions.width,
    height: format.dimensions.height,
    objectFit: 'cover',
    opacity: 0.4,
  },
  contentContainer: {
    width: '100%',
    height: '100%',
    padding: format.safeMargin,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 50 * format.scaleFactor,
  },
  yearText: {
    fontSize: 56 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    marginBottom: 12 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: 5,
    fontWeight: 'bold',
  },
  periodRangeText: {
    fontSize: 16 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: '#e0e0e0',
    marginBottom: 24 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'column',
    gap: 16 * format.scaleFactor,
    alignItems: 'center',
    marginTop: 30 * format.scaleFactor,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10 * format.scaleFactor,
  },
  statValue: {
    fontSize: 32 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: '#e0e0e0',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  divider: {
    width: 150 * format.scaleFactor,
    height: 3,
    backgroundColor: theme.accentColor,
    opacity: 0.7,
    marginVertical: 24 * format.scaleFactor,
  },
  quoteSection: {
    marginTop: 40 * format.scaleFactor,
    paddingHorizontal: format.safeMargin * 1.5,
    maxWidth: '70%',
    marginBottom: 32 * format.scaleFactor,
  },
  quoteText: {
    fontSize: 16 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.7,
    fontStyle: 'italic',
    opacity: 0.9,
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: 30 * format.scaleFactor,
  },
  brandingText: {
    fontSize: 12 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: '#e0e0e0',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  brandingName: {
    fontSize: 18 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    marginTop: 8 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: 3,
  },
})

const formatDistance = (meters: number): string => {
  const km = meters / 1000
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}K km`
  }
  return `${km.toFixed(0)} km`
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  if (hours >= 1000) {
    return `${(hours / 1000).toFixed(1)}K hrs`
  }
  return `${hours.toFixed(0)} hrs`
}

const formatElevation = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}K m`
  }
  return `${meters.toFixed(0)} m`
}

// Generate mock year summary from activity if not provided
const generateMockYearSummary = (activity?: Partial<StravaActivity>): YearSummary => {
  const year = activity?.start_date_local
    ? new Date(activity.start_date_local).getFullYear()
    : new Date().getFullYear()

  // Generate mock active days based on activity count
  const mockActiveDays = new Set<string>()
  for (let i = 0; i < 150; i++) {
    mockActiveDays.add(`${year}-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`)
  }

  return {
    year,
    totalDistance: activity?.distance ? activity.distance * 10 : 2500000,
    totalTime: activity?.moving_time ? activity.moving_time * 10 : 900000,
    totalElevation: activity?.total_elevation_gain ? activity.total_elevation_gain * 10 : 25000,
    activityCount: 156,
    activeDays: mockActiveDays,
    longestActivity: (activity || {}) as StravaActivity,
    fastestActivity: (activity || {}) as StravaActivity,
    monthlyStats: [],
    races: [],
  }
}

// Page-only version for use in BookDocument (no Document wrapper)
export const BackCoverPage = ({
  activity,
  yearSummary: directYearSummary,
  periodName: propPeriodName,
  startDate: propStartDate,
  endDate: propEndDate,
  backgroundPhotoUrl,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: BackCoverProps) => {
  // Resolve yearSummary from either direct prop or activity
  const yearSummary = directYearSummary
    || activity?.yearSummary
    || generateMockYearSummary(activity)

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

  const styles = createStyles(format, theme)

  // Calculate active days count
  const activeDays = yearSummary.activeDays
    ? (typeof yearSummary.activeDays === 'number' ? yearSummary.activeDays : yearSummary.activeDays.size)
    : 0

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Background photo (if provided) */}
      {backgroundPhotoUrl && (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop
        <Image src={backgroundPhotoUrl} style={styles.backgroundImage} />
      )}
      <View style={styles.contentContainer}>
        {/* Top section with period and stats */}
        <View style={styles.topSection}>
          <Text style={styles.yearText}>{mainPeriodDisplay}</Text>
          {showPeriodRangeBelow && periodRangeDisplay && (
            <Text style={styles.periodRangeText}>{periodRangeDisplay}</Text>
          )}

          <View style={styles.divider} />

          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{formatDistance(yearSummary.totalDistance)}</Text>
              <Text style={styles.statLabel}>traveled</Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statValue}>{formatTime(yearSummary.totalTime)}</Text>
              <Text style={styles.statLabel}>in motion</Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statValue}>{formatElevation(yearSummary.totalElevation)}</Text>
              <Text style={styles.statLabel}>climbed</Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statValue}>{yearSummary.activityCount}</Text>
              <Text style={styles.statLabel}>activities</Text>
            </View>

            {activeDays > 0 && (
              <View style={styles.statRow}>
                <Text style={styles.statValue}>{activeDays}</Text>
                <Text style={styles.statLabel}>active days</Text>
              </View>
            )}
          </View>

          {/* Optional inspirational quote */}
          <View style={styles.quoteSection}>
            <Text style={styles.quoteText}>
              &ldquo;Every mile is a memory, every step a story worth telling.&rdquo;
            </Text>
          </View>
        </View>

        {/* Bottom section with branding */}
        <View style={styles.bottomSection}>
          <Text style={styles.brandingText}>CREATED WITH</Text>
          <Text style={styles.brandingName}>STRAVA BOOK</Text>
        </View>
      </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const BackCover = (props: BackCoverProps) => (
  <Document>
    <BackCoverPage {...props} />
  </Document>
)
