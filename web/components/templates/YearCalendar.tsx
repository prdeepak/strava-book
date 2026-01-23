import { Page, Text, View, Document, StyleSheet, Svg, Rect } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'

// Support both direct props and test harness interface
interface YearCalendarProps {
  // Test harness interface
  activity?: StravaActivity

  // Direct props interface
  year?: number
  activities?: StravaActivity[]
  colorBy?: 'distance' | 'time' | 'count' | 'elevation'
  format?: BookFormat
  theme?: BookTheme
  // Date range support
  startDate?: string
  endDate?: string
  backgroundPhotoUrl?: string  // Background image at 10% opacity
}

// Create styles with format scaling using typography utilities
const createStyles = (format: BookFormat, theme: BookTheme) => {
  // Resolve design tokens from theme
  const displayTypo = resolveTypography('displaySmall', theme, format)
  const headingTypo = resolveTypography('heading', theme, format)
  const bodyTypo = resolveTypography('body', theme, format)
  const captionTypo = resolveTypography('caption', theme, format)
  const statTypo = resolveTypography('stat', theme, format)
  const spacing = resolveSpacing(theme, format)
  const effects = resolveEffects(theme)

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      padding: 0,  // Use contentContainer for padding to avoid react-pdf layout bug
      backgroundColor: theme.backgroundColor,
      position: 'relative',
    },
    // Content container with safe margins (avoids react-pdf bug with page padding + absolute elements)
    contentContainer: {
      position: 'absolute',
      top: format.safeMargin,
      left: format.safeMargin,
      right: format.safeMargin,
      bottom: format.safeMargin,
      flexDirection: 'column',
    },
    header: {
      marginBottom: spacing.sm,
    },
    year: {
      fontSize: displayTypo.fontSize,
      fontFamily: displayTypo.fontFamily,
      color: theme.primaryColor,
      marginBottom: spacing.xs / 2,
      letterSpacing: displayTypo.letterSpacing ?? -2,
      fontWeight: 'bold',
    },
    subtitle: {
      fontSize: captionTypo.fontSize,
      fontFamily: captionTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      letterSpacing: captionTypo.letterSpacing ?? 0.8,
      textTransform: 'uppercase',
    },
    calendarSection: {
      marginBottom: spacing.sm * 0.75,
    },
    monthsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: spacing.sm * 0.75,
      columnGap: spacing.sm * 0.75,
      marginBottom: spacing.sm * 0.75,
    },
    monthBlock: {
      width: '23%',
      alignItems: 'flex-start',
    },
    monthLabel: {
      fontSize: captionTypo.fontSize * 0.9,
      fontFamily: headingTypo.fontFamily,
      color: theme.primaryColor,
      marginBottom: spacing.xs / 2,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      fontWeight: 'bold',
    },
    weekLabels: {
      flexDirection: 'row',
      marginBottom: spacing.xs / 2,
      gap: 1,
    },
    weekLabel: {
      fontSize: captionTypo.fontSize * 0.7,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.textOverlayOpacity + 0.1,
      width: 12,
      textAlign: 'center',
    },
    legendContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm * 0.6,
      gap: spacing.xs,
    },
    legendText: {
      fontSize: captionTypo.fontSize * 0.9,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity + 0.15,
      letterSpacing: 0.5,
    },
    legendBoxes: {
      flexDirection: 'row',
      gap: 4,
      marginHorizontal: 8,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.sm * 0.75,
      borderTopWidth: 2,
      borderTopColor: theme.primaryColor,
      borderTopStyle: 'solid',
    },
    statItem: {
      flex: 1,
      paddingHorizontal: spacing.sm * 0.75,
    },
    statValue: {
      fontSize: statTypo.fontSize,
      fontFamily: headingTypo.fontFamily,
      color: theme.accentColor,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: spacing.xs / 2,
    },
    statLabel: {
      fontSize: captionTypo.fontSize * 0.9,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity + 0.1,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    statUnit: {
      fontSize: captionTypo.fontSize,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity + 0.25,
    },
    // Monthly bar chart styles
    chartSection: {
      marginBottom: spacing.sm * 0.75,
    },
    chartTitle: {
      fontSize: captionTypo.fontSize * 0.9,
      fontFamily: headingTypo.fontFamily,
      color: theme.primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: spacing.xs * 0.75,
      opacity: effects.backgroundImageOpacity + 0.2,
    },
    chartContainer: {
      height: spacing.xl * 0.8,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs / 2,
    },
    barWrapper: {
      flex: 1,
      alignItems: 'center',
    },
    bar: {
      width: '80%',
      backgroundColor: theme.accentColor,
      borderRadius: 2,
    },
    barLabel: {
      fontSize: captionTypo.fontSize * 0.7,
      fontFamily: bodyTypo.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      marginTop: spacing.xs / 4,
    },
  })
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Helper to format numbers with thousands separators
const formatWithCommas = (num: number): string => {
  return Math.round(num).toLocaleString('en-US')
}

// Helper to get days in month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate()
}

// Helper to get first day of month (0 = Sunday, 6 = Saturday)
const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay()
}

// Helper to aggregate activities by date
const aggregateActivitiesByDate = (
  activities: StravaActivity[],
  colorBy: 'distance' | 'time' | 'count' | 'elevation'
): Map<string, number> => {
  const dateMap = new Map<string, number>()

  activities.forEach(activity => {
    const date = new Date(activity.start_date_local).toISOString().split('T')[0]
    const currentValue = dateMap.get(date) || 0

    let value = 0
    switch (colorBy) {
      case 'distance':
        value = activity.distance / 1000 // Convert to km
        break
      case 'time':
        value = activity.moving_time / 3600 // Convert to hours
        break
      case 'count':
        value = 1
        break
      case 'elevation':
        value = activity.total_elevation_gain || 0
        break
    }

    dateMap.set(date, currentValue + value)
  })

  return dateMap
}

// Helper to get color intensity (0-4 scale like GitHub)
const getColorIntensity = (value: number, maxValue: number): number => {
  if (value === 0) return 0
  const ratio = value / maxValue
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

// Helper to get color based on intensity with better contrast
// Uses theme colors instead of hardcoded values
const getColor = (intensity: number, accentColor: string, primaryColor: string): string => {
  // For zero intensity, use a subtle shade derived from primary color
  // This creates a light gray on white backgrounds or dark gray on dark backgrounds
  if (intensity === 0) {
    // Use primaryColor with very low opacity for empty cells
    return `${primaryColor}15`
  }

  // Create proper opacity-based shades for better visual hierarchy
  const shades = [
    `${primaryColor}15`,  // 0 - no activity (subtle background)
    `${accentColor}40`,   // 1 - lightest (25% opacity)
    `${accentColor}70`,   // 2 - light (44% opacity)
    `${accentColor}A0`,   // 3 - medium (63% opacity)
    `${accentColor}`,     // 4 - full intensity
  ]

  return shades[intensity]
}

// Helper to generate mock year data from a single activity (for testing)
const generateMockYearData = (activity: StravaActivity) => {
  const activityDate = new Date(activity.start_date_local)
  const year = activityDate.getFullYear()

  // Generate activities for the year with some patterns
  const mockActivities: StravaActivity[] = []

  for (let month = 0; month < 12; month++) {
    const daysInMonth = getDaysInMonth(year, month)

    for (let day = 1; day <= daysInMonth; day++) {
      // Create activity on ~40% of days with some patterns
      const shouldHaveActivity =
        (day % 2 === 0 && month >= 3 && month <= 9) || // More in summer
        (day % 3 === 0) || // Regular pattern
        (day === 1 || day === 15) // Twice a month

      if (shouldHaveActivity) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        mockActivities.push({
          ...activity,
          start_date_local: `${dateStr}T07:00:00Z`,
          distance: activity.distance * (0.5 + Math.random()),
          moving_time: activity.moving_time * (0.5 + Math.random()),
        })
      }
    }
  }

  return { year, activities: mockActivities }
}

// Extended activity type that may include year_calendar fixture data
interface YearCalendarActivity {
  activityDates?: Record<string, { distance: number; time: number; count: number; elevation: number }>
  summary?: { totalActivities: number; totalDistance: number; totalTime: number; totalElevation: number }
  year?: number
  // StravaActivity fields we use
  start_date_local?: string
  start_date?: string
  distance?: number
  moving_time?: number
  total_elevation_gain?: number
}

// Page-only version for use in BookDocument (no Document wrapper)
export const YearCalendarPage = (props: YearCalendarProps) => {
  // Handle both test harness interface and direct props
  const format = props.format || FORMATS['10x10']
  const theme = props.theme || DEFAULT_THEME

  let year: number
  let activities: StravaActivity[]
  let dateMap: Map<string, number>
  let totalDistance: number
  let totalTime: number
  let totalElevation: number
  const colorBy = props.colorBy || 'distance'

  // Check if this is a year_calendar fixture with activityDates
  const fixture = props.activity as YearCalendarActivity | undefined
  if (fixture?.activityDates) {
    // Year calendar fixture format
    year = fixture.year || new Date().getFullYear()
    activities = []
    dateMap = new Map<string, number>()

    // Convert activityDates to dateMap
    Object.entries(fixture.activityDates).forEach(([date, data]) => {
      const value = colorBy === 'distance' ? data.distance / 1000 :
                    colorBy === 'time' ? data.time / 3600 :
                    colorBy === 'elevation' ? data.elevation :
                    data.count
      dateMap.set(date, value)
    })

    // Use summary stats from fixture
    totalDistance = (fixture.summary?.totalDistance || 0) / 1000
    totalTime = (fixture.summary?.totalTime || 0) / 3600
    totalElevation = fixture.summary?.totalElevation || 0
  } else if (props.activity) {
    // Standard activity - generate mock year data
    const mockData = generateMockYearData(props.activity)
    year = mockData.year
    activities = mockData.activities
    dateMap = aggregateActivitiesByDate(activities, colorBy)
    totalDistance = activities.reduce((sum, a) => sum + a.distance / 1000, 0)
    totalTime = activities.reduce((sum, a) => sum + a.moving_time / 3600, 0)
    totalElevation = activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0)
  } else {
    // Direct props mode
    year = props.year || new Date().getFullYear()
    activities = props.activities || []
    dateMap = aggregateActivitiesByDate(activities, colorBy)
    totalDistance = activities.reduce((sum, a) => sum + a.distance / 1000, 0)
    totalTime = activities.reduce((sum, a) => sum + a.moving_time / 3600, 0)
    totalElevation = activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0)
  }

  const styles = createStyles(format, theme)
  const maxValue = Math.max(...Array.from(dateMap.values()), 1)
  const totalActivities = fixture?.summary?.totalActivities || activities.length || dateMap.size

  // Cell size based on format - compact for single page fit
  const cellSize = 7 * format.scaleFactor
  const cellGap = 1.2 * format.scaleFactor

  // Calculate months to display based on date range
  const startDate = props.startDate ? new Date(props.startDate) : null
  const endDate = props.endDate ? new Date(props.endDate) : null

  // Generate list of months in the date range
  interface MonthInfo {
    year: number
    month: number  // 0-11
  }
  const monthsToDisplay: MonthInfo[] = []

  if (startDate && endDate) {
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    while (current <= end) {
      monthsToDisplay.push({ year: current.getFullYear(), month: current.getMonth() })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }
  } else {
    // Fallback: show all 12 months of the year
    for (let m = 0; m < 12; m++) {
      monthsToDisplay.push({ year, month: m })
    }
  }

  // Format date range for header display
  const dateRangeDisplay = (startDate && endDate)
    ? `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : String(year)

  return (
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
        {/* Background: solid color or faded photo */}
        <FullBleedBackground
          image={props.backgroundPhotoUrl}
          fallbackColor={theme.backgroundColor}
          role="background"
          imageOpacity={resolveEffects(theme).backgroundImageOpacity * 0.2}
          overlayOpacity={0}
          width={format.dimensions.width}
          height={format.dimensions.height}
        />

        {/* Content container with safe margins */}
        <View style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.year}>{dateRangeDisplay}</Text>
          <Text style={styles.subtitle}>
            {formatWithCommas(totalActivities)} Activities • {formatWithCommas(totalDistance)} kilometers
          </Text>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarSection}>
          <View style={styles.monthsGrid}>
            {monthsToDisplay.map(({ year: monthYear, month: monthIndex }) => {
              const daysInMonth = getDaysInMonth(monthYear, monthIndex)
              const firstDay = getFirstDayOfMonth(monthYear, monthIndex)

              return (
                <View key={`${monthYear}-${monthIndex}`} style={styles.monthBlock}>
                  <Text style={styles.monthLabel}>{MONTH_NAMES[monthIndex]}</Text>

                  <Svg
                    width={(cellSize + cellGap) * 7}
                    height={(cellSize + cellGap) * 6}
                    viewBox={`0 0 ${(cellSize + cellGap) * 7} ${(cellSize + cellGap) * 6}`}
                  >
                    {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                      const day = dayIndex + 1
                      const dateStr = `${monthYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const value = dateMap.get(dateStr) || 0
                      const intensity = getColorIntensity(value, maxValue)
                      const color = getColor(intensity, theme.accentColor, theme.primaryColor)

                      // Calculate position
                      const dayOfWeek = (firstDay + dayIndex) % 7
                      const weekRow = Math.floor((firstDay + dayIndex) / 7)

                      const x = dayOfWeek * (cellSize + cellGap)
                      const y = weekRow * (cellSize + cellGap)

                      return (
                        <Rect
                          key={day}
                          x={x}
                          y={y}
                          width={cellSize}
                          height={cellSize}
                          fill={color}
                          rx={1.5}
                          ry={1.5}
                        />
                      )
                    })}
                  </Svg>
                </View>
              )
            })}
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <Text style={styles.legendText}>Less</Text>
            <View style={styles.legendBoxes}>
              {[0, 1, 2, 3, 4].map(intensity => (
                <Svg key={intensity} width={16} height={16}>
                  <Rect
                    x={0}
                    y={0}
                    width={16}
                    height={16}
                    fill={getColor(intensity, theme.accentColor, theme.primaryColor)}
                    rx={2}
                    ry={2}
                  />
                </Svg>
              ))}
            </View>
            <Text style={styles.legendText}>More</Text>
          </View>
        </View>

        {/* Monthly Distance Bar Chart */}
        {monthsToDisplay.length > 1 && (
          <View style={styles.chartSection}>
            <Text style={styles.chartTitle}>Monthly Distance</Text>
            <View style={styles.chartContainer}>
              {(() => {
                // Calculate monthly distances
                const monthlyDistances = monthsToDisplay.map(({ year: monthYear, month: monthIndex }) => {
                  const monthPrefix = `${monthYear}-${String(monthIndex + 1).padStart(2, '0')}`
                  let distance = 0
                  dateMap.forEach((value, date) => {
                    if (date.startsWith(monthPrefix)) {
                      distance += value
                    }
                  })
                  return { month: MONTH_NAMES[monthIndex], distance }
                })
                const maxDistance = Math.max(...monthlyDistances.map(m => m.distance), 1)

                return monthlyDistances.map(({ month, distance }) => (
                  <View key={month} style={styles.barWrapper}>
                    <View style={[styles.bar, { height: `${Math.max(2, (distance / maxDistance) * 100)}%` }]} />
                    <Text style={styles.barLabel}>{month}</Text>
                  </View>
                ))
              })()}
            </View>
          </View>
        )}

        {/* Summary Stats */}
        <View style={styles.statsGrid} wrap={false}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatWithCommas(totalDistance)}
              <Text style={styles.statUnit}> km</Text>
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatWithCommas(totalTime)}
              <Text style={styles.statUnit}> hrs</Text>
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatWithCommas(totalElevation)}
              <Text style={styles.statUnit}> m</Text>
            </Text>
            <Text style={styles.statLabel}>Elevation</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatWithCommas(activities.length)}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>
        </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const YearCalendar = (props: YearCalendarProps) => (
  <Document>
    <YearCalendarPage {...props} />
  </Document>
)
