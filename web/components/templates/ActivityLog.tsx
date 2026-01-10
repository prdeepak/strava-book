import { Page, View, Text, Svg, Path, StyleSheet, Document, Image } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { formatDistance, formatTime, formatPace } from '@/lib/activity-log-utils'
import { resolveActivityLocation } from '@/lib/activity-utils'
import polyline from '@mapbox/polyline'

interface ActivityLogProps {
  activities?: StravaActivity[]
  activity?: StravaActivity  // Support single activity for test harness
  startIndex?: number
  activitiesPerPage?: number
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  title?: string
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: '#f8f9fa',
    padding: format.safeMargin,
  },
  pageHeader: {
    marginBottom: 16 * format.scaleFactor,
    paddingBottom: 8 * format.scaleFactor,
    borderBottomWidth: 2,
    borderBottomColor: theme.primaryColor,
  },
  pageTitle: {
    fontSize: Math.max(18, 24 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  activityCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 12 * format.scaleFactor,
    marginBottom: 12 * format.scaleFactor,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardHeader: {
    marginBottom: 8 * format.scaleFactor,
    paddingBottom: 6 * format.scaleFactor,
    borderBottomWidth: 1,
    borderBottomColor: theme.accentColor,
  },
  activityName: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    marginBottom: 3,
  },
  activityMeta: {
    fontSize: Math.max(7, 8 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: Math.max(7, 8 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#444',
    fontStyle: 'italic',
    marginBottom: 8 * format.scaleFactor,
    lineHeight: 1.3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8 * format.scaleFactor,
    paddingTop: 8 * format.scaleFactor,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: 'Helvetica-Bold',
    color: theme.primaryColor,
  },
  statLabel: {
    fontSize: Math.max(6, 7 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  mapContainer: {
    width: '100%',
    height: 80 * format.scaleFactor,
    backgroundColor: '#2a2a2a',
    marginBottom: 8 * format.scaleFactor,
  },
  photoContainer: {
    width: '100%',
    height: 100 * format.scaleFactor,
    backgroundColor: '#f0f0f0',
    marginBottom: 8 * format.scaleFactor,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6 * format.scaleFactor,
    paddingTop: 6 * format.scaleFactor,
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
  },
  kudos: {
    fontSize: Math.max(7, 8 * format.scaleFactor),
    fontFamily: 'Helvetica-Bold',
    color: theme.accentColor,
  },
  comments: {
    fontSize: Math.max(6, 7 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#666',
  },
  bestEffortBadge: {
    fontSize: Math.max(6, 7 * format.scaleFactor),
    fontFamily: 'Helvetica-Bold',
    color: '#FFD700',
    backgroundColor: '#000',
    paddingHorizontal: 4,
    paddingVertical: 2,
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

// Helper to resolve image URLs
function resolveImageUrl(url: string | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/') && !url.startsWith('/api/')) {
    return url
  }
  if (url.startsWith('http')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`
  }
  return url
}

// Check if activity has any best efforts in top 3
function hasTopBestEfforts(activity: StravaActivity): boolean {
  const efforts = activity.best_efforts || []
  return efforts.some(e => e.pr_rank && e.pr_rank <= 3)
}

export const ActivityLog = ({
  activities: activitiesProp,
  activity: activityProp,
  startIndex = 0,
  activitiesPerPage = 6,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  units = 'metric',
  title = 'Activity Log'
}: ActivityLogProps) => {
  const styles = createStyles(format, theme)

  // Handle both single activity and activities array
  const activities = activitiesProp || (activityProp ? [activityProp] : [])

  // Slice activities for this page (default 6 cards per page)
  const pageActivities = activities.slice(startIndex, startIndex + activitiesPerPage)

  return (
    <Document>
      <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{title}</Text>
        </View>

        {/* Activity Cards Grid */}
        <View style={styles.cardsContainer}>
          {pageActivities.map((activity, index) => {
            const date = new Date(activity.start_date_local)
            const dateStr = date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
            const location = resolveActivityLocation(activity)

            const time = formatTime(activity.moving_time)
            const pace = formatPace(activity.moving_time, activity.distance, units)

            const pathData = createMiniMapPath(activity.map?.summary_polyline)
            const photoUrl = activity.photos?.primary?.urls?.['600']
              ? resolveImageUrl(activity.photos.primary.urls['600'])
              : null
            const hasTopEfforts = hasTopBestEfforts(activity)

            return (
              <View key={activity.id || index} style={styles.activityCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.activityName}>{activity.name}</Text>
                  <Text style={styles.activityMeta}>
                    {dateStr} • {location}
                  </Text>
                </View>

                {/* Description */}
                {activity.description && (
                  <Text style={styles.description}>
                    {activity.description.length > 120
                      ? activity.description.substring(0, 120) + '...'
                      : activity.description
                    }
                  </Text>
                )}

                {/* Photo or Map */}
                {photoUrl && (
                  <View style={styles.photoContainer}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image
                      src={photoUrl}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </View>
                )}
                {!photoUrl && pathData && (
                  <View style={styles.mapContainer}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                      <Path
                        d={pathData}
                        stroke={theme.accentColor}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                )}

                {/* Key Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {units === 'metric'
                        ? (activity.distance / 1000).toFixed(1)
                        : (activity.distance / 1609.34).toFixed(1)
                      }
                    </Text>
                    <Text style={styles.statLabel}>{units === 'metric' ? 'km' : 'mi'}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{time}</Text>
                    <Text style={styles.statLabel}>time</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{pace}</Text>
                    <Text style={styles.statLabel}>pace</Text>
                  </View>
                  {activity.total_elevation_gain > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{Math.round(activity.total_elevation_gain)}</Text>
                      <Text style={styles.statLabel}>elev</Text>
                    </View>
                  )}
                </View>

                {/* Social/Engagement Row */}
                <View style={styles.socialRow}>
                  <View style={{ flexDirection: 'row' }}>
                    {activity.kudos_count > 0 && (
                      <Text style={[styles.kudos, { marginRight: 8 }]}>
                        👍 {activity.kudos_count}
                      </Text>
                    )}
                    {activity.comment_count > 0 && (
                      <Text style={styles.comments}>
                        💬 {activity.comment_count}
                      </Text>
                    )}
                  </View>
                  {hasTopEfforts && (
                    <Text style={styles.bestEffortBadge}>PR</Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
