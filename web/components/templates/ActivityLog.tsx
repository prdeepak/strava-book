/**
 * ActivityLog - Grid layout of activity cards for PDF generation
 *
 * Displays multiple activities in a 2-column grid layout (6 per page).
 * Each card shows activity name, date, location, stats, and a satellite map
 * with the route overlay (when GPS data is available).
 *
 * Follows Style Guide patterns:
 * - Content container pattern (padding:0 on Page)
 * - Typography system via resolveTypography()
 * - Spacing system via resolveSpacing()
 * - Theme colors (no hardcoded values)
 */

import { Page, View, Text, StyleSheet, Document, Image } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { formatTime, formatPace, resolveActivityLocation, getMapboxSatelliteUrl } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'

// ============================================================================
// TYPES
// ============================================================================

interface ActivityLogProps {
  activities?: StravaActivity[]
  activity?: StravaActivity  // Support single activity for test harness
  startIndex?: number
  activitiesPerPage?: number
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  title?: string
  mapboxToken?: string
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (format: BookFormat, theme: BookTheme) => {
  const spacing = resolveSpacing(theme, format)
  const heading = resolveTypography('heading', theme, format)
  const subheading = resolveTypography('subheading', theme, format)
  const body = resolveTypography('body', theme, format)
  const caption = resolveTypography('caption', theme, format)

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: 0, // Content container pattern
      position: 'relative',
    },
    contentContainer: {
      position: 'absolute',
      top: format.safeMargin,
      left: format.safeMargin,
      right: format.safeMargin,
      bottom: format.safeMargin,
      flexDirection: 'column',
    },
    pageHeader: {
      marginBottom: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomWidth: 2,
      borderBottomColor: theme.primaryColor,
    },
    pageTitle: {
      fontSize: heading.fontSize,
      fontFamily: heading.fontFamily,
      color: theme.primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    cardsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      flex: 1,
    },
    activityCard: {
      width: '48.5%',
      backgroundColor: theme.backgroundColor,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: theme.primaryColor + '20', // 12% opacity
      overflow: 'hidden',
    },
    // Map container - shows satellite map with route overlay
    mapContainer: {
      width: '100%',
      height: 90 * format.scaleFactor,
      backgroundColor: theme.primaryColor + '10',
      overflow: 'hidden',
      position: 'relative',
    },
    mapImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    noMapPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.primaryColor + '08',
    },
    noMapText: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor + '40',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardContent: {
      padding: spacing.xs,
    },
    cardHeader: {
      marginBottom: spacing.xs / 2,
    },
    activityName: {
      fontSize: subheading.fontSize * 0.7,
      fontFamily: subheading.fontFamily,
      color: theme.primaryColor,
      marginBottom: 2,
    },
    activityMeta: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor + '80',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    description: {
      fontSize: caption.fontSize,
      fontFamily: body.fontFamily,
      color: theme.primaryColor + '90',
      fontStyle: 'italic',
      marginBottom: spacing.xs / 2,
      lineHeight: 1.3,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.xs / 2,
      borderTopWidth: 0.5,
      borderTopColor: theme.primaryColor + '20',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: body.fontSize * 0.9,
      fontFamily: theme.fontPairing.heading,
      color: theme.primaryColor,
    },
    statLabel: {
      fontSize: caption.fontSize * 0.85,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor + '60',
      textTransform: 'uppercase',
      marginTop: 1,
    },
    socialRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.xs / 2,
      paddingTop: spacing.xs / 2,
      borderTopWidth: 0.5,
      borderTopColor: theme.primaryColor + '15',
    },
    kudos: {
      fontSize: caption.fontSize,
      fontFamily: theme.fontPairing.heading,
      color: theme.accentColor,
    },
    comments: {
      fontSize: caption.fontSize * 0.9,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor + '60',
    },
    prBadge: {
      fontSize: caption.fontSize * 0.85,
      fontFamily: theme.fontPairing.heading,
      color: theme.backgroundColor,
      backgroundColor: theme.accentColor,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
  })
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if activity has any best efforts in top 3
 */
function hasTopBestEfforts(activity: StravaActivity): boolean {
  const efforts = activity.best_efforts || []
  return efforts.some(e => e.pr_rank && e.pr_rank <= 3)
}

/**
 * Get satellite map URL for an activity
 */
function getSatelliteMapUrl(
  activity: StravaActivity,
  mapboxToken: string | undefined,
  width: number,
  height: number
): string | null {
  if (!mapboxToken || !activity.map?.summary_polyline) {
    return null
  }
  return getMapboxSatelliteUrl(
    activity.map.summary_polyline,
    mapboxToken,
    Math.round(width),
    Math.round(height)
  )
}

// ============================================================================
// MAIN COMPONENT
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
  mapboxToken
}: ActivityLogProps) => {
  const styles = createStyles(format, theme)
  const spacing = resolveSpacing(theme, format)

  // Handle both single activity and activities array
  const activities = activitiesProp || (activityProp ? [activityProp] : [])

  // Slice activities for this page (default 6 cards per page)
  const pageActivities = activities.slice(startIndex, startIndex + activitiesPerPage)

  // Calculate map dimensions based on card width
  // Card is 48.5% of content width, map is full card width
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)
  const cardWidth = contentWidth * 0.485
  const mapHeight = 90 * format.scaleFactor

  return (
    <Page
      size={[format.dimensions.width, format.dimensions.height]}
      style={styles.page}
    >
      <View style={styles.contentContainer}>
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

            // Get satellite map URL
            const mapUrl = getSatelliteMapUrl(activity, mapboxToken, cardWidth * 2, mapHeight * 2)
            const hasTopEfforts = hasTopBestEfforts(activity)

            return (
              <View key={activity.id || index} style={styles.activityCard}>
                {/* Map Section - Satellite with route overlay */}
                <View style={styles.mapContainer}>
                  {mapUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image
                      src={resolveImageForPdf(mapUrl) || mapUrl}
                      style={styles.mapImage}
                    />
                  ) : (
                    <View style={styles.noMapPlaceholder}>
                      <Text style={styles.noMapText}>
                        {activity.sport_type || activity.type || 'Activity'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                  {/* Header */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    <Text style={styles.activityMeta}>
                      {dateStr} {location ? `\u2022 ${location}` : ''}
                    </Text>
                  </View>

                  {/* Description (truncated) */}
                  {activity.description && (
                    <Text style={styles.description}>
                      {activity.description.length > 80
                        ? activity.description.substring(0, 80) + '...'
                        : activity.description
                      }
                    </Text>
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
                        <Text style={styles.statLabel}>m</Text>
                      </View>
                    )}
                  </View>

                  {/* Social/Engagement Row */}
                  {((activity.kudos_count || 0) > 0 || (activity.comment_count || 0) > 0 || hasTopEfforts) && (
                    <View style={styles.socialRow}>
                      <View style={{ flexDirection: 'row' }}>
                        {(activity.kudos_count || 0) > 0 && (
                          <Text style={[styles.kudos, { marginRight: spacing.xs }]}>
                            {activity.kudos_count} kudos
                          </Text>
                        )}
                        {(activity.comment_count || 0) > 0 && (
                          <Text style={styles.comments}>
                            {activity.comment_count} comments
                          </Text>
                        )}
                      </View>
                      {hasTopEfforts && (
                        <Text style={styles.prBadge}>PR</Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for direct rendering/testing)
export const ActivityLogDocument = (props: ActivityLogProps) => (
  <Document>
    <ActivityLog {...props} />
  </Document>
)
