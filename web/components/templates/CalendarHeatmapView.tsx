/**
 * CalendarHeatmapView - Test wrapper for HeatmapCalendarMonth component
 * Shows GitHub-style colored squares based on activity intensity
 */

import { Page, View, Text, Document, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { HeatmapCalendarMonth, HeatmapLegend, DayActivity } from '@/lib/calendar-views'

interface CalendarHeatmapViewProps {
  activity?: {
    year?: number
    activities?: DayActivity[]
  }
  format?: BookFormat
  theme?: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    padding: format.safeMargin,
    backgroundColor: theme.backgroundColor,
  },
  header: {
    marginBottom: 16 * format.scaleFactor,
  },
  year: {
    fontSize: Math.max(42, 54 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    fontWeight: 'bold',
    letterSpacing: -2,
    marginBottom: 4 * format.scaleFactor,
  },
  subtitle: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14 * format.scaleFactor,
    columnGap: 10 * format.scaleFactor,
    marginBottom: 14 * format.scaleFactor,
  },
  monthWrapper: {
    width: '23%',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14 * format.scaleFactor,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12 * format.scaleFactor,
    borderTopWidth: 2,
    borderTopColor: theme.primaryColor,
    borderTopStyle: 'solid',
    marginTop: 'auto',
  },
  statItem: {
    flex: 1,
    paddingHorizontal: 12 * format.scaleFactor,
  },
  statValue: {
    fontSize: Math.max(24, 32 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    lineHeight: 1,
    marginBottom: 4 * format.scaleFactor,
  },
  statUnit: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.75,
  },
  statLabel: {
    fontSize: Math.max(8, 9 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
})

export const CalendarHeatmapView = ({
  activity,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: CalendarHeatmapViewProps) => {
  const styles = createStyles(format, theme)

  const year = activity?.year || 2024
  const allActivities = activity?.activities || []

  // Group activities by month
  const activitiesByMonth = new Map<number, DayActivity[]>()
  allActivities.forEach(a => {
    const date = new Date(a.date)
    if (date.getFullYear() === year) {
      const month = date.getMonth()
      const existing = activitiesByMonth.get(month) || []
      existing.push(a)
      activitiesByMonth.set(month, existing)
    }
  })

  // Calculate max value across all months for consistent coloring
  const allDistances = allActivities.map(a => a.distance / 1000)
  const maxDistance = Math.max(...allDistances, 1)

  // Calculate totals
  const totalDistance = allActivities.reduce((sum, a) => sum + a.distance, 0) / 1000
  const totalTime = allActivities.reduce((sum, a) => sum + a.duration, 0) / 3600
  const activeDays = new Set(allActivities.map(a => a.date)).size

  return (
    <Document>
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.year}>{year}</Text>
          <Text style={styles.subtitle}>
            {allActivities.length} Activities • {Math.round(totalDistance)} kilometers
          </Text>
        </View>

        {/* Calendar Grid */}
        <View style={styles.monthsGrid}>
          {Array.from({ length: 12 }, (_, month) => (
            <View key={month} style={styles.monthWrapper}>
              <HeatmapCalendarMonth
                year={year}
                month={month}
                activities={activitiesByMonth.get(month) || []}
                format={format}
                theme={theme}
                cellSize={7 * format.scaleFactor}
                colorBy="distance"
                maxValue={maxDistance}
              />
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <HeatmapLegend format={format} theme={theme} />
        </View>

        {/* Stats Footer */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round(totalDistance)}
              <Text style={styles.statUnit}> km</Text>
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round(totalTime)}
              <Text style={styles.statUnit}> hrs</Text>
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeDays}</Text>
            <Text style={styles.statLabel}>Active Days</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{allActivities.length}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
