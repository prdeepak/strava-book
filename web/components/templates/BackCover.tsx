import { Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, YearSummary } from '@/lib/book-types'

export interface BackCoverProps {
  yearSummary: YearSummary
  format: BookFormat
  theme: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.primaryColor,
    padding: format.safeMargin,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearText: {
    fontSize: Math.max(48, 60 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    marginBottom: 30 * format.scaleFactor,
  },
  statsGrid: {
    flexDirection: 'column',
    gap: 15 * format.scaleFactor,
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10 * format.scaleFactor,
  },
  statValue: {
    fontSize: Math.max(24, 32 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#e0e0e0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: 20 * format.scaleFactor,
  },
  brandingText: {
    fontSize: Math.max(9, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#aaaaaa',
    textAlign: 'center',
  },
  brandingName: {
    fontSize: Math.max(11, 13 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    marginTop: 5 * format.scaleFactor,
    textAlign: 'center',
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

export const BackCover = ({
  yearSummary,
  format,
  theme = DEFAULT_THEME,
}: BackCoverProps) => {
  const styles = createStyles(format, theme)

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <View style={styles.topSection}>
        <Text style={styles.yearText}>{yearSummary.year}</Text>

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

          <View style={styles.statRow}>
            <Text style={styles.statValue}>{yearSummary.activeDays}</Text>
            <Text style={styles.statLabel}>active days</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.brandingText}>Created with</Text>
        <Text style={styles.brandingName}>Strava Book</Text>
      </View>
    </Page>
  )
}
