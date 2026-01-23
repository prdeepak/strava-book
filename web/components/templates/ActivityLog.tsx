/**
 * ActivityLog - Activity card layouts for PDF generation
 *
 * Variants:
 * - 'grid' (default): Multiple activities in a 2-column grid layout (6 per page)
 * - 'concise': Single activity with map, stats, and 1 photo - compact summary
 * - 'full': Single activity with description, all comments, kudos, multiple photos
 */

import { Page, View, Text, Svg, Path, StyleSheet, Document, Image, Polyline } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { formatDistance, formatTime, formatPace, resolveActivityLocation, getMapboxSatelliteUrl } from '@/lib/activity-utils'
import { extractPhotos } from '@/lib/photo-gallery-utils'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import polyline from '@mapbox/polyline'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

// ============================================================================
// TYPES
// ============================================================================

export type ActivityLogVariant = 'grid' | 'concise' | 'full'

interface ActivityLogProps {
  activities?: StravaActivity[]
  activity?: StravaActivity  // Support single activity for test harness
  startIndex?: number
  activitiesPerPage?: number
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  title?: string
  variant?: ActivityLogVariant
  mapboxToken?: string
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: `${theme.primaryColor}05`,
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
    backgroundColor: theme.backgroundColor,
    padding: 12 * format.scaleFactor,
    marginBottom: 12 * format.scaleFactor,
    borderWidth: 1,
    borderColor: `${theme.primaryColor}20`,
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
    backgroundColor: theme.primaryColor,
    marginBottom: 8 * format.scaleFactor,
  },
  photoContainer: {
    width: '100%',
    height: 100 * format.scaleFactor,
    backgroundColor: `${theme.primaryColor}10`,
    marginBottom: 8 * format.scaleFactor,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6 * format.scaleFactor,
    paddingTop: 6 * format.scaleFactor,
    borderTopWidth: 0.5,
    borderTopColor: `${theme.primaryColor}20`,
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
  } catch {
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

// ============================================================================
// CONCISE VARIANT STYLES
// ============================================================================

const createConciseStyles = (format: BookFormat, theme: BookTheme) => {
  const scale = format.scaleFactor

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: format.safeMargin,
    },
    header: {
      marginBottom: 16 * scale,
      paddingBottom: 12 * scale,
      borderBottomWidth: 2,
      borderBottomColor: theme.accentColor,
    },
    title: {
      fontSize: Math.max(20, 26 * scale),
      fontFamily: theme.fontPairing.heading,
      color: theme.primaryColor,
      marginBottom: 4 * scale,
    },
    meta: {
      fontSize: Math.max(10, 12 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#666',
    },
    contentRow: {
      flexDirection: 'row',
      gap: 16 * scale,
      marginBottom: 16 * scale,
    },
    mapSection: {
      width: '55%',
      height: 200 * scale,
      backgroundColor: `${theme.primaryColor}08`,
      overflow: 'hidden',
    },
    photoSection: {
      width: '45%',
      height: 200 * scale,
      backgroundColor: `${theme.primaryColor}10`,
      overflow: 'hidden',
    },
    mapImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12 * scale,
    },
    statBox: {
      width: '23%',
      backgroundColor: `${theme.primaryColor}05`,
      padding: 12 * scale,
      alignItems: 'center',
    },
    statValue: {
      fontSize: Math.max(18, 22 * scale),
      fontFamily: 'Helvetica-Bold',
      color: theme.primaryColor,
    },
    statLabel: {
      fontSize: Math.max(8, 9 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#666',
      textTransform: 'uppercase',
      marginTop: 4 * scale,
    },
    socialBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 16 * scale,
      paddingTop: 12 * scale,
      borderTopWidth: 1,
      borderTopColor: `${theme.primaryColor}20`,
      gap: 16 * scale,
    },
    socialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4 * scale,
    },
    socialValue: {
      fontSize: Math.max(12, 14 * scale),
      fontFamily: 'Helvetica-Bold',
      color: theme.accentColor,
    },
    socialLabel: {
      fontSize: Math.max(9, 10 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#666',
    },
  })
}

// ============================================================================
// FULL VARIANT STYLES
// ============================================================================

const createFullStyles = (format: BookFormat, theme: BookTheme) => {
  const scale = format.scaleFactor

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: `${theme.primaryColor}05`,
      padding: format.safeMargin,
    },
    header: {
      marginBottom: 12 * scale,
    },
    sectionLabel: {
      fontSize: Math.max(9, 10 * scale),
      fontFamily: theme.fontPairing.heading,
      color: theme.accentColor,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 4 * scale,
    },
    title: {
      fontSize: Math.max(22, 28 * scale),
      fontFamily: theme.fontPairing.heading,
      color: theme.primaryColor,
      marginBottom: 4 * scale,
    },
    meta: {
      fontSize: Math.max(10, 12 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#666',
      marginBottom: 16 * scale,
    },
    description: {
      fontSize: Math.max(10, 11 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#333',
      lineHeight: 1.5,
      marginBottom: 16 * scale,
      paddingLeft: 12 * scale,
      borderLeftWidth: 3,
      borderLeftColor: theme.accentColor,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16 * scale,
      paddingVertical: 12 * scale,
      paddingHorizontal: 8 * scale,
      backgroundColor: theme.backgroundColor,
      borderWidth: 1,
      borderColor: `${theme.primaryColor}20`,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: Math.max(16, 20 * scale),
      fontFamily: 'Helvetica-Bold',
      color: theme.primaryColor,
    },
    statLabel: {
      fontSize: Math.max(7, 8 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#666',
      textTransform: 'uppercase',
      marginTop: 2 * scale,
    },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8 * scale,
      marginBottom: 16 * scale,
    },
    photoMain: {
      width: '100%',
      height: 180 * scale,
      objectFit: 'cover',
    },
    photoThumb: {
      width: '32%',
      height: 80 * scale,
      objectFit: 'cover',
    },
    commentsSection: {
      marginTop: 12 * scale,
    },
    commentsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8 * scale,
      paddingBottom: 8 * scale,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.primaryColor}20`,
    },
    commentsTitle: {
      fontSize: Math.max(10, 12 * scale),
      fontFamily: theme.fontPairing.heading,
      color: theme.primaryColor,
      textTransform: 'uppercase',
    },
    kudosCount: {
      fontSize: Math.max(14, 16 * scale),
      fontFamily: 'Helvetica-Bold',
      color: theme.accentColor,
    },
    comment: {
      marginBottom: 10 * scale,
      paddingBottom: 8 * scale,
      borderBottomWidth: 0.5,
      borderBottomColor: `${theme.primaryColor}18`,
    },
    commentAuthor: {
      fontSize: Math.max(9, 10 * scale),
      fontFamily: 'Helvetica-Bold',
      color: '#333',
      marginBottom: 2 * scale,
    },
    commentText: {
      fontSize: Math.max(9, 10 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#555',
      lineHeight: 1.4,
    },
    commentTime: {
      fontSize: Math.max(7, 8 * scale),
      fontFamily: theme.fontPairing.body,
      color: '#999',
      marginTop: 2 * scale,
    },
  })
}

// ============================================================================
// CONCISE VARIANT COMPONENT
// ============================================================================

const ActivityLogConcise = ({
  activity,
  format,
  theme,
  units,
  mapboxToken
}: {
  activity: StravaActivity
  format: BookFormat
  theme: BookTheme
  units: 'metric' | 'imperial'
  mapboxToken?: string
}) => {
  const styles = createConciseStyles(format, theme)
  const scale = format.scaleFactor

  const date = new Date(activity.start_date_local).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
  const location = resolveActivityLocation(activity)

  // Get map - use satellite view for better visual appeal
  const mapWidth = (format.dimensions.width - format.safeMargin * 2) * 0.55
  const mapHeight = 200 * scale
  const polylineData = activity.map?.summary_polyline
  let mapUrl: string | null = null
  if (mapboxToken && polylineData) {
    mapUrl = getMapboxSatelliteUrl(polylineData, mapboxToken, Math.round(mapWidth), Math.round(mapHeight))
  }

  // Get photo
  const photos = extractPhotos(activity)
  const primaryPhoto = photos.length > 0 ? photos[0].url : null

  // Stats
  const distance = units === 'metric'
    ? (activity.distance / 1000).toFixed(2)
    : (activity.distance / 1609.34).toFixed(2)
  const distanceUnit = units === 'metric' ? 'km' : 'mi'
  const time = formatTime(activity.moving_time)
  const pace = formatPace(activity.moving_time, activity.distance, units)

  return (
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{activity.name}</Text>
        <Text style={styles.meta}>{date} | {location}</Text>
      </View>

      {/* Map + Photo Row */}
      <View style={styles.contentRow}>
        <View style={styles.mapSection}>
          {mapUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={resolveImageForPdf(mapUrl) || mapUrl} style={styles.mapImage} />
          ) : polylineData ? (
            <Svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
              <Polyline
                points={createMiniMapPoints(polylineData, mapWidth, mapHeight)}
                stroke={theme.accentColor}
                strokeWidth={3 * scale}
                fill="none"
              />
            </Svg>
          ) : (
            <Text style={{ color: '#999', textAlign: 'center', marginTop: 80 * scale }}>No map</Text>
          )}
        </View>

        <View style={styles.photoSection}>
          {primaryPhoto ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={primaryPhoto} style={styles.mapImage} />
          ) : (
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: `${theme.primaryColor}05`,
              borderWidth: 1,
              borderColor: `${theme.primaryColor}20`,
              padding: 16 * scale,
            }}>
              <Text style={{
                color: theme.accentColor,
                fontSize: 48 * scale,
                fontFamily: 'Helvetica-Bold',
                marginBottom: 8 * scale,
              }}>{activity.name.charAt(0)}</Text>
              <Text style={{
                color: '#666',
                fontSize: 9 * scale,
                fontFamily: theme.fontPairing.body,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>{activity.sport_type || activity.type}</Text>
              {activity.total_elevation_gain > 50 && (
                <Text style={{
                  color: '#999',
                  fontSize: 8 * scale,
                  fontFamily: theme.fontPairing.body,
                  marginTop: 8 * scale,
                }}>{Math.round(activity.total_elevation_gain)}m elevation</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{distance}</Text>
          <Text style={styles.statLabel}>{distanceUnit}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{time}</Text>
          <Text style={styles.statLabel}>Time</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{pace.split('/')[0]}</Text>
          <Text style={styles.statLabel}>/{pace.split('/')[1]}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.round(activity.total_elevation_gain)}</Text>
          <Text style={styles.statLabel}>m elev</Text>
        </View>
      </View>

      {/* Social Bar */}
      <View style={styles.socialBar}>
        <View style={styles.socialItem}>
          <Text style={styles.socialValue}>{activity.kudos_count || 0}</Text>
          <Text style={styles.socialLabel}>kudos</Text>
        </View>
        <View style={styles.socialItem}>
          <Text style={styles.socialValue}>{activity.comment_count || 0}</Text>
          <Text style={styles.socialLabel}>comments</Text>
        </View>
      </View>
    </Page>
  )
}

// Helper for concise map
function createMiniMapPoints(summaryPolyline: string, width: number, height: number): string {
  try {
    const coordinates = polyline.decode(summaryPolyline)
    if (coordinates.length === 0) return ''

    const lats = coordinates.map(c => c[0])
    const lngs = coordinates.map(c => c[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001

    const padding = 10
    const plotWidth = width - padding * 2
    const plotHeight = height - padding * 2

    return coordinates.map(([lat, lng]) => {
      const x = padding + ((lng - minLng) / lngRange) * plotWidth
      const y = padding + plotHeight - ((lat - minLat) / latRange) * plotHeight
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  } catch {
    return ''
  }
}

// ============================================================================
// FULL VARIANT COMPONENT
// ============================================================================

const ActivityLogFull = ({
  activity,
  format,
  theme,
  units
}: {
  activity: StravaActivity
  format: BookFormat
  theme: BookTheme
  units: 'metric' | 'imperial'
}) => {
  const styles = createFullStyles(format, theme)
  const scale = format.scaleFactor

  const date = new Date(activity.start_date_local).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
  const location = resolveActivityLocation(activity)

  // Get photos
  const photos = extractPhotos(activity)
  const mainPhoto = photos.length > 0 ? photos[0].url : null
  const thumbPhotos = photos.slice(1, 4)

  // Get comments
  const comments = activity.comprehensiveData?.comments || []

  // Stats
  const distance = formatDistance(activity.distance, units)
  const time = formatTime(activity.moving_time)
  const pace = formatPace(activity.moving_time, activity.distance, units)

  return (
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>Activity</Text>
        <Text style={styles.title}>{activity.name}</Text>
        <Text style={styles.meta}>{date} | {location}</Text>
      </View>

      {/* Description */}
      {activity.description && (
        <Text style={styles.description}>{activity.description}</Text>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{distance.split(' ')[0]}</Text>
          <Text style={styles.statLabel}>{distance.split(' ')[1]}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{time}</Text>
          <Text style={styles.statLabel}>Time</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pace.split('/')[0]}</Text>
          <Text style={styles.statLabel}>/{pace.split('/')[1]}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(activity.total_elevation_gain)}</Text>
          <Text style={styles.statLabel}>m elev</Text>
        </View>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(activity as any).average_heartrate && (
          <View style={styles.statItem}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Text style={styles.statValue}>{Math.round((activity as any).average_heartrate)}</Text>
            <Text style={styles.statLabel}>avg hr</Text>
          </View>
        )}
      </View>

      {/* Photos */}
      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {mainPhoto && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={mainPhoto} style={styles.photoMain} />
          )}
          {thumbPhotos.map((photo, idx) => (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image key={idx} src={photo.url} style={styles.photoThumb} />
          ))}
        </View>
      )}

      {/* Comments Section */}
      {(comments.length > 0 || (activity.kudos_count || 0) > 0) && (
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Community</Text>
            <Text style={styles.kudosCount}>{activity.kudos_count || 0} kudos</Text>
          </View>

          {comments.slice(0, 5).map((comment, idx) => (
            <View key={idx} style={styles.comment}>
              <Text style={styles.commentAuthor}>
                {comment.athlete?.firstname} {comment.athlete?.lastname?.charAt(0)}.
              </Text>
              <Text style={styles.commentText}>{comment.text}</Text>
              {comment.created_at && (
                <Text style={styles.commentTime}>
                  {new Date(comment.created_at).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))}

          {comments.length > 5 && (
            <Text style={{ fontSize: 8 * scale, color: '#999', fontStyle: 'italic' }}>
              +{comments.length - 5} more comments
            </Text>
          )}
        </View>
      )}
    </Page>
  )
}

// ============================================================================
// MAIN EXPORT - GRID VARIANT (Original)
// ============================================================================

export const ActivityLog = ({
  activities: activitiesProp,
  activity: activityProp,
  startIndex = 0,
  activitiesPerPage = 6,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  units = 'metric',
  title = 'Activity Log',
  variant = 'grid',
  mapboxToken
}: ActivityLogProps) => {
  const styles = createStyles(format, theme)

  // Handle variant selection
  if (variant === 'concise' && activityProp) {
    return (
      <Document>
        <ActivityLogConcise
          activity={activityProp}
          format={format}
          theme={theme}
          units={units}
          mapboxToken={mapboxToken}
        />
      </Document>
    )
  }

  if (variant === 'full' && activityProp) {
    return (
      <Document>
        <ActivityLogFull
          activity={activityProp}
          format={format}
          theme={theme}
          units={units}
        />
      </Document>
    )
  }

  // Default: Grid variant
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
                        {activity.kudos_count} kudos
                      </Text>
                    )}
                    {(activity.comment_count ?? 0) > 0 && (
                      <Text style={styles.comments}>
                        {activity.comment_count} comments
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

// Export page versions for embedding
export const ActivityLogConcisePage = ActivityLogConcise
export const ActivityLogFullPage = ActivityLogFull

// Grid variant page-only component for embedding in BookDocument
export const ActivityLogPage = ({
  activities: activitiesProp,
  activity: activityProp,
  startIndex = 0,
  activitiesPerPage = 6,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  units = 'metric',
  title = 'Activity Log',
}: Omit<ActivityLogProps, 'variant' | 'mapboxToken'>) => {
  const styles = createStyles(format, theme)

  const activities = activitiesProp || (activityProp ? [activityProp] : [])
  const pageActivities = activities.slice(startIndex, startIndex + activitiesPerPage)

  return (
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
                      {activity.kudos_count} kudos
                    </Text>
                  )}
                  {(activity.comment_count ?? 0) > 0 && (
                    <Text style={styles.comments}>
                      {activity.comment_count} comments
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
  )
}
