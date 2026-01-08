import { Page, View, Text, Svg, Path, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { formatDistance, formatTime, formatPace } from '@/lib/activity-log-utils'
import polyline from '@mapbox/polyline'

interface ActivityLogProps {
  activities: StravaActivity[]
  startIndex?: number
  activitiesPerPage?: number
  showMiniMaps?: boolean
  format: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  title?: string
}

const createStyles = (format: BookFormat, theme: BookTheme, showMiniMaps: boolean) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
  },
  header: {
    marginBottom: 20 * format.scaleFactor,
    paddingBottom: 10 * format.scaleFactor,
    borderBottomWidth: 2,
    borderBottomColor: theme.primaryColor,
  },
  title: {
    fontSize: Math.max(16, 20 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8 * format.scaleFactor,
    borderBottomWidth: 1,
    borderBottomColor: theme.primaryColor,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6 * format.scaleFactor,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.primaryColor,
    borderBottomStyle: 'solid',
    opacity: 0.3,
    alignItems: 'center',
  },
  headerText: {
    fontSize: Math.max(8, 9 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellText: {
    fontSize: Math.max(8, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
  },
  // Column widths
  dateCol: {
    width: showMiniMaps ? '12%' : '15%',
  },
  nameCol: {
    width: showMiniMaps ? '30%' : '40%',
  },
  distanceCol: {
    width: '15%',
  },
  timeCol: {
    width: '13%',
  },
  paceCol: {
    width: '15%',
  },
  mapCol: {
    width: '15%',
    alignItems: 'center',
  },
  miniMapContainer: {
    width: 50 * format.scaleFactor,
    height: 30 * format.scaleFactor,
  },
})

// Helper to decode polyline and create SVG path
function createMiniMapPath(summaryPolyline: string | undefined): string | null {
  if (!summaryPolyline) return null

  try {
    const coordinates = polyline.decode(summaryPolyline)
    if (coordinates.length === 0) return null

    // Find bounds
    const lats = coordinates.map(c => c[0])
    const lngs = coordinates.map(c => c[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    // Normalize to 0-100 coordinate space
    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001

    const points = coordinates.map(([lat, lng]) => {
      const x = ((lng - minLng) / lngRange) * 100
      const y = 100 - ((lat - minLat) / latRange) * 100  // Flip Y axis
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })

    return `M ${points.join(' L ')}`
  } catch (e) {
    return null
  }
}

export const ActivityLog = ({
  activities,
  startIndex = 0,
  activitiesPerPage = 20,
  showMiniMaps = false,
  format,
  theme = DEFAULT_THEME,
  units = 'metric',
  title = 'Activity Log'
}: ActivityLogProps) => {
  const styles = createStyles(format, theme, showMiniMaps)

  // Slice activities for this page
  const pageActivities = activities.slice(startIndex, startIndex + activitiesPerPage)

  return (
    <Document>
      <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={styles.dateCol}>
          <Text style={styles.headerText}>Date</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.headerText}>Activity</Text>
        </View>
        <View style={styles.distanceCol}>
          <Text style={styles.headerText}>Distance</Text>
        </View>
        <View style={styles.timeCol}>
          <Text style={styles.headerText}>Time</Text>
        </View>
        <View style={styles.paceCol}>
          <Text style={styles.headerText}>Pace</Text>
        </View>
        {showMiniMaps && (
          <View style={styles.mapCol}>
            <Text style={styles.headerText}>Route</Text>
          </View>
        )}
      </View>

      {/* Table Rows */}
      {pageActivities.map((activity, index) => {
        const date = new Date(activity.start_date_local)
        const dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`

        const distance = units === 'metric'
          ? `${(activity.distance / 1000).toFixed(1)} km`
          : `${(activity.distance / 1609.34).toFixed(1)} mi`

        const time = formatTime(activity.moving_time)
        const pace = formatPace(activity.moving_time, activity.distance, units)

        const pathData = showMiniMaps ? createMiniMapPath(activity.map?.summary_polyline) : null

        return (
          <View key={activity.id || index} style={styles.tableRow}>
            <View style={styles.dateCol}>
              <Text style={styles.cellText}>{dateStr}</Text>
            </View>
            <View style={styles.nameCol}>
              <Text style={styles.cellText}>
                {activity.name}
              </Text>
            </View>
            <View style={styles.distanceCol}>
              <Text style={styles.cellText}>{distance}</Text>
            </View>
            <View style={styles.timeCol}>
              <Text style={styles.cellText}>{time}</Text>
            </View>
            <View style={styles.paceCol}>
              <Text style={styles.cellText}>{pace}</Text>
            </View>
            {showMiniMaps && (
              <View style={styles.mapCol}>
                {pathData && (
                  <Svg
                    width={50 * format.scaleFactor}
                    height={30 * format.scaleFactor}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <Path
                      d={pathData}
                      stroke={theme.accentColor}
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
            )}
          </View>
        )
      })}
      </Page>
    </Document>
  )
}
