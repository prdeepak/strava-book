import { Page, Text, View, Document, StyleSheet, Svg, Rect } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'

interface YearCalendarProps {
  year: number
  activities: StravaActivity[]
  colorBy: 'distance' | 'time' | 'count'
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
  title: {
    fontSize: 36 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    marginBottom: 12 * format.scaleFactor,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    marginBottom: 24 * format.scaleFactor,
    textAlign: 'center',
    opacity: 0.7,
  },
  calendarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16 * format.scaleFactor,
  },
  monthContainer: {
    width: '30%',
    marginBottom: 12 * format.scaleFactor,
  },
  monthName: {
    fontSize: Math.max(8, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    marginBottom: 4 * format.scaleFactor,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20 * format.scaleFactor,
    gap: 4 * format.scaleFactor,
  },
  legendLabel: {
    fontSize: Math.max(8, 9 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.7,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16 * format.scaleFactor,
    paddingTop: 12 * format.scaleFactor,
    borderTopWidth: 1,
    borderTopColor: theme.primaryColor,
    borderTopStyle: 'solid',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Math.max(14, 18 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
  },
  statLabel: {
    fontSize: Math.max(8, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.7,
    marginTop: 2 * format.scaleFactor,
  },
})

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

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
  colorBy: 'distance' | 'time' | 'count'
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

// Helper to get color based on intensity
const getColor = (intensity: number, accentColor: string): string => {
  if (intensity === 0) return '#ebedf0'

  // Parse accent color and create shades
  const shades = [
    '#ebedf0',  // 0 - no activity
    `${accentColor}33`,  // 1 - lightest (20% opacity)
    `${accentColor}66`,  // 2 - light (40% opacity)
    `${accentColor}99`,  // 3 - medium (60% opacity)
    `${accentColor}`,    // 4 - full intensity
  ]

  return shades[intensity]
}

export const YearCalendar = ({
  year,
  activities,
  colorBy,
  format,
  theme = DEFAULT_THEME
}: YearCalendarProps) => {
  const styles = createStyles(format, theme)

  // Aggregate activities by date
  const dateMap = aggregateActivitiesByDate(activities, colorBy)
  const maxValue = Math.max(...Array.from(dateMap.values()), 1)

  // Calculate summary stats
  const totalDistance = activities.reduce((sum, a) => sum + a.distance / 1000, 0)
  const totalTime = activities.reduce((sum, a) => sum + a.moving_time / 3600, 0)
  const totalElevation = activities.reduce((sum, a) => sum + a.total_elevation_gain, 0)

  // Cell size based on format
  const cellSize = 3 * format.scaleFactor
  const cellGap = 1

  return (
    <Document>
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
        <Text style={styles.title}>{year} Activity Heatmap</Text>
        <Text style={styles.subtitle}>
          {activities.length} activities • Color by {colorBy}
        </Text>

        <View style={styles.calendarContainer}>
          <View style={styles.monthGrid}>
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const daysInMonth = getDaysInMonth(year, monthIndex)
              const firstDay = getFirstDayOfMonth(year, monthIndex)

              return (
                <View key={monthIndex} style={styles.monthContainer}>
                  <Text style={styles.monthName}>{MONTH_NAMES[monthIndex]}</Text>

                  <Svg
                    width={(cellSize + cellGap) * 7}
                    height={(cellSize + cellGap) * 6}
                    viewBox={`0 0 ${(cellSize + cellGap) * 7} ${(cellSize + cellGap) * 6}`}
                  >
                    {/* Render days of the month */}
                    {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                      const day = dayIndex + 1
                      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const value = dateMap.get(dateStr) || 0
                      const intensity = getColorIntensity(value, maxValue)
                      const color = getColor(intensity, theme.accentColor)

                      // Calculate position (week row and day column)
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
                          stroke="#ccc"
                          strokeWidth={0.2}
                        />
                      )
                    })}
                  </Svg>
                </View>
              )
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Less</Text>
            {[0, 1, 2, 3, 4].map(intensity => (
              <View key={intensity} style={{ width: 12, height: 12, marginHorizontal: 2 }}>
                <Svg width={12} height={12}>
                  <Rect
                    x={0}
                    y={0}
                    width={12}
                    height={12}
                    fill={getColor(intensity, theme.accentColor)}
                    stroke="#ccc"
                    strokeWidth={0.5}
                  />
                </Svg>
              </View>
            ))}
            <Text style={styles.legendLabel}>More</Text>
          </View>

          {/* Summary Stats */}
          <View style={styles.summaryStats}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalDistance.toFixed(0)} km</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalTime.toFixed(0)} hrs</Text>
              <Text style={styles.statLabel}>Total Time</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalElevation.toFixed(0)} m</Text>
              <Text style={styles.statLabel}>Total Elevation</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
