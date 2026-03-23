/**
 * ActivityLog - Grid layout of activity cards for PDF generation
 *
 * Three card variants based on available data:
 * 1. Photo Card - activity has photos: photo hero + name/date + stats + small map
 * 2. Route Card - has GPS route but no photos: light-style map + clean layout
 * 3. Indoor Card - indoor/virtual or no route: no map, larger name, sport label, accent band
 *
 * Feature cards span both columns for standout activities (highest kudos or PRs).
 *
 * Follows Style Guide patterns:
 * - Content container pattern (padding:0 on Page)
 * - Typography system via resolveTypography()
 * - Spacing system via resolveSpacing()
 * - Theme colors (no hardcoded values)
 */

import { Page, View, Text, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, ActivityLogVariant, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { resolveActivityLocation, getMapboxLightUrl, hasRouteData, isIndoorActivity, getRelevantStats } from '@/lib/activity-utils'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { PdfImage } from '@/components/pdf/PdfImage'
import { extractPhotos, PhotoData } from '@/lib/photo-gallery-utils'
import { formatTime, formatPace, formatDistanceValue, formatElevation } from '@/lib/activity-utils'

// ============================================================================
// TYPES
// ============================================================================

type CardVariant = 'photo' | 'route' | 'indoor'

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
  variant?: ActivityLogVariant
}

interface ClassifiedActivity {
  activity: StravaActivity
  cardVariant: CardVariant
  photos: PhotoData[]
  isFeature: boolean
}

// ============================================================================
// CLASSIFICATION
// ============================================================================

/**
 * Determine card variant and feature status for each activity
 */
function classifyActivities(
  activities: StravaActivity[],
): ClassifiedActivity[] {
  // Find the activity with the highest kudos for potential feature card
  let maxKudos = 0
  let maxKudosId: number | null = null
  for (const a of activities) {
    if ((a.kudos_count || 0) > maxKudos) {
      maxKudos = a.kudos_count || 0
      maxKudosId = a.id
    }
  }

  return activities.map(activity => {
    const photos = extractPhotos(activity)
    const hasPR = (activity.best_efforts || []).some(e => e.pr_rank && e.pr_rank <= 3)
    const isFeature = (activity.id === maxKudosId && maxKudos >= 5) || hasPR

    let cardVariant: CardVariant
    if (photos.length > 0) {
      cardVariant = 'photo'
    } else if (hasRouteData(activity)) {
      cardVariant = 'route'
    } else {
      cardVariant = 'indoor'
    }

    return { activity, cardVariant, photos, isFeature }
  })
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
      padding: 0,
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

    // --- Half-width card (2-column) ---
    cardHalf: {
      width: '48.5%',
      backgroundColor: theme.backgroundColor,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: theme.primaryColor + '20',
      overflow: 'hidden',
    },

    // --- Full-width feature card ---
    cardFull: {
      width: '100%',
      backgroundColor: theme.backgroundColor,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: theme.primaryColor + '20',
      overflow: 'hidden',
      flexDirection: 'row',
    },

    // --- Photo card ---
    photoHero: {
      width: '100%',
      height: 110 * format.scaleFactor,
      overflow: 'hidden',
      position: 'relative',
    },
    photoHeroFeature: {
      width: '50%',
      height: 130 * format.scaleFactor,
      overflow: 'hidden',
      position: 'relative',
    },
    featureContent: {
      width: '50%',
      flexDirection: 'column',
    },
    smallMap: {
      width: '100%',
      height: 40 * format.scaleFactor,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.primaryColor + '08',
    },

    // --- Route card ---
    routeMap: {
      width: '100%',
      height: 100 * format.scaleFactor,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.primaryColor + '08',
    },
    routeMapFeature: {
      width: '50%',
      height: 130 * format.scaleFactor,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.primaryColor + '08',
    },

    // --- Indoor card ---
    indoorAccentBand: {
      width: '100%',
      height: 4 * format.scaleFactor,
      backgroundColor: theme.accentColor,
    },
    indoorSportLabel: {
      fontSize: caption.fontSize * 0.85,
      fontFamily: caption.fontFamily,
      color: theme.accentColor,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 2,
    },
    indoorNameLarge: {
      fontSize: subheading.fontSize * 0.85,
      fontFamily: subheading.fontFamily,
      color: theme.primaryColor,
      marginBottom: 4,
    },

    // --- Shared card content ---
    cardContent: {
      padding: spacing.xs,
      flex: 1,
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
  })
}

// ============================================================================
// CARD COMPONENTS
// ============================================================================

/**
 * Shared stats + social row used by all card variants
 */
function CardStats({
  activity,
  units,
  styles,
  spacing,
}: {
  activity: StravaActivity
  units: 'metric' | 'imperial'
  styles: ReturnType<typeof createStyles>
  spacing: ReturnType<typeof resolveSpacing>
}) {
  const stats = getRelevantStats(activity, units)
  const hasPR = (activity.best_efforts || []).some(e => e.pr_rank && e.pr_rank <= 3)

  return (
    <>
      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.slice(0, 4).map((stat, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Social Row */}
      {((activity.kudos_count || 0) > 0 || (activity.comment_count || 0) > 0 || hasPR) && (
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
          {hasPR && (
            <Text style={styles.prBadge}>PR</Text>
          )}
        </View>
      )}
    </>
  )
}

/**
 * Photo Card: photo hero + name/date + stats + optional small map
 */
function PhotoCard({
  classified,
  styles,
  spacing,
  units,
  mapboxToken,
  format,
}: {
  classified: ClassifiedActivity
  styles: ReturnType<typeof createStyles>
  spacing: ReturnType<typeof resolveSpacing>
  units: 'metric' | 'imperial'
  mapboxToken?: string
  format: BookFormat
}) {
  const { activity, photos, isFeature } = classified
  const date = new Date(activity.start_date_local)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const location = resolveActivityLocation(activity)
  const photo = photos[0]
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)

  // Small map for route overlay
  const smallMapUrl = hasRouteData(activity) && mapboxToken
    ? getMapboxLightUrl(activity.map.summary_polyline, mapboxToken, 400, 120)
    : null

  if (isFeature) {
    const heroWidth = contentWidth * 0.5
    const heroHeight = 130 * format.scaleFactor
    return (
      <View style={styles.cardFull}>
        <View style={styles.photoHeroFeature}>
          <PdfImage
            src={resolveImageForPdf(photo.url) || photo.url}
            containerWidth={heroWidth}
            containerHeight={heroHeight}
            sourceWidth={photo.width}
            sourceHeight={photo.height}
          />
        </View>
        <View style={[styles.cardContent, styles.featureContent]}>
          <View style={styles.cardHeader}>
            <Text style={styles.activityName}>{activity.name}</Text>
            <Text style={styles.activityMeta}>
              {dateStr} {location ? `\u2022 ${location}` : ''}
            </Text>
          </View>
          {activity.description && (
            <Text style={styles.description}>
              {activity.description.length > 120
                ? activity.description.substring(0, 120) + '...'
                : activity.description}
            </Text>
          )}
          <CardStats activity={activity} units={units} styles={styles} spacing={spacing} />
        </View>
      </View>
    )
  }

  const cardWidth = contentWidth * 0.485
  const heroHeight = 110 * format.scaleFactor
  return (
    <View style={styles.cardHalf}>
      <View style={styles.photoHero}>
        <PdfImage
          src={resolveImageForPdf(photo.url) || photo.url}
          containerWidth={cardWidth}
          containerHeight={heroHeight}
          sourceWidth={photo.width}
          sourceHeight={photo.height}
        />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.activityName}>{activity.name}</Text>
          <Text style={styles.activityMeta}>
            {dateStr} {location ? `\u2022 ${location}` : ''}
          </Text>
        </View>
        <CardStats activity={activity} units={units} styles={styles} spacing={spacing} />
      </View>
      {smallMapUrl && (
        <View style={styles.smallMap}>
          <PdfImage
            src={resolveImageForPdf(smallMapUrl) || smallMapUrl}
            containerWidth={cardWidth}
            containerHeight={40 * format.scaleFactor}
          />
        </View>
      )}
    </View>
  )
}

/**
 * Route Card: light-style map hero + clean stats layout
 */
function RouteCard({
  classified,
  styles,
  spacing,
  units,
  mapboxToken,
  format,
}: {
  classified: ClassifiedActivity
  styles: ReturnType<typeof createStyles>
  spacing: ReturnType<typeof resolveSpacing>
  units: 'metric' | 'imperial'
  mapboxToken?: string
  format: BookFormat
}) {
  const { activity, isFeature } = classified
  const date = new Date(activity.start_date_local)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const location = resolveActivityLocation(activity)
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)

  const mapUrl = mapboxToken && activity.map?.summary_polyline
    ? getMapboxLightUrl(activity.map.summary_polyline, mapboxToken, 800, 400)
    : null

  if (isFeature) {
    const mapWidth = contentWidth * 0.5
    const mapHeight = 130 * format.scaleFactor
    return (
      <View style={styles.cardFull}>
        <View style={styles.routeMapFeature}>
          {mapUrl ? (
            <PdfImage
              src={resolveImageForPdf(mapUrl) || mapUrl}
              containerWidth={mapWidth}
              containerHeight={mapHeight}
            />
          ) : (
            <View style={styles.noMapPlaceholder}>
              <Text style={styles.noMapText}>{activity.sport_type || activity.type || 'Activity'}</Text>
            </View>
          )}
        </View>
        <View style={[styles.cardContent, styles.featureContent]}>
          <View style={styles.cardHeader}>
            <Text style={styles.activityName}>{activity.name}</Text>
            <Text style={styles.activityMeta}>
              {dateStr} {location ? `\u2022 ${location}` : ''}
            </Text>
          </View>
          {activity.description && (
            <Text style={styles.description}>
              {activity.description.length > 120
                ? activity.description.substring(0, 120) + '...'
                : activity.description}
            </Text>
          )}
          <CardStats activity={activity} units={units} styles={styles} spacing={spacing} />
        </View>
      </View>
    )
  }

  const cardWidth = contentWidth * 0.485
  const mapHeight = 100 * format.scaleFactor
  return (
    <View style={styles.cardHalf}>
      <View style={styles.routeMap}>
        {mapUrl ? (
          <PdfImage
            src={resolveImageForPdf(mapUrl) || mapUrl}
            containerWidth={cardWidth}
            containerHeight={mapHeight}
          />
        ) : (
          <View style={styles.noMapPlaceholder}>
            <Text style={styles.noMapText}>{activity.sport_type || activity.type || 'Activity'}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.activityName}>{activity.name}</Text>
          <Text style={styles.activityMeta}>
            {dateStr} {location ? `\u2022 ${location}` : ''}
          </Text>
        </View>
        <CardStats activity={activity} units={units} styles={styles} spacing={spacing} />
      </View>
    </View>
  )
}

/**
 * Indoor Card: accent band, sport label, larger activity name, no map
 */
function IndoorCard({
  classified,
  styles,
  spacing,
  units,
}: {
  classified: ClassifiedActivity
  styles: ReturnType<typeof createStyles>
  spacing: ReturnType<typeof resolveSpacing>
  units: 'metric' | 'imperial'
}) {
  const { activity } = classified
  const date = new Date(activity.start_date_local)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const location = resolveActivityLocation(activity)

  return (
    <View style={styles.cardHalf}>
      <View style={styles.indoorAccentBand} />
      <View style={styles.cardContent}>
        <Text style={styles.indoorSportLabel}>
          {activity.sport_type || activity.type || 'Activity'}
        </Text>
        <Text style={styles.indoorNameLarge}>{activity.name}</Text>
        <Text style={styles.activityMeta}>
          {dateStr} {location ? `\u2022 ${location}` : ''}
        </Text>
        <CardStats activity={activity} units={units} styles={styles} spacing={spacing} />
      </View>
    </View>
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
  mapboxToken,
  variant = 'grid',
}: ActivityLogProps) => {
  // Route to dense-list variant if requested
  if (variant === 'dense-list') {
    return (
      <ActivityLogDenseList
        activities={activitiesProp}
        activity={activityProp}
        startIndex={startIndex}
        activitiesPerPage={activitiesPerPage}
        format={format}
        theme={theme}
        units={units}
        title={title}
      />
    )
  }
  const styles = createStyles(format, theme)
  const spacing = resolveSpacing(theme, format)

  // Handle both single activity and activities array
  const activities = activitiesProp || (activityProp ? [activityProp] : [])

  // Classify activities into card variants
  const classified = classifyActivities(activities)

  // Reduce to 4 activities/page when photos are present (cards are taller)
  const hasPhotos = classified.some(c => c.cardVariant === 'photo')
  const effectivePerPage = hasPhotos
    ? Math.min(activitiesPerPage, 4)
    : activitiesPerPage

  // Slice activities for this page
  const pageItems = classified.slice(startIndex, startIndex + effectivePerPage)

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
          {pageItems.map((item, index) => {
            const key = item.activity.id || index

            switch (item.cardVariant) {
              case 'photo':
                return (
                  <PhotoCard
                    key={key}
                    classified={item}
                    styles={styles}
                    spacing={spacing}
                    units={units}
                    mapboxToken={mapboxToken}
                    format={format}
                  />
                )
              case 'route':
                return (
                  <RouteCard
                    key={key}
                    classified={item}
                    styles={styles}
                    spacing={spacing}
                    units={units}
                    mapboxToken={mapboxToken}
                    format={format}
                  />
                )
              case 'indoor':
                return (
                  <IndoorCard
                    key={key}
                    classified={item}
                    styles={styles}
                    spacing={spacing}
                    units={units}
                  />
                )
            }
          })}
        </View>
      </View>
    </Page>
  )
}

// ============================================================================
// DENSE LIST VARIANT
// ============================================================================

const createDenseListStyles = (format: BookFormat, theme: BookTheme) => {
  const spacing = resolveSpacing(theme, format)
  const heading = resolveTypography('heading', theme, format)
  const body = resolveTypography('body', theme, format)
  const caption = resolveTypography('caption', theme, format)

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: 0,
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
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: spacing.xs * 0.5,
      borderBottomWidth: 1,
      borderBottomColor: theme.primaryColor + '40',
      marginBottom: 2,
    },
    colDate: {
      width: '12%',
    },
    colActivity: {
      width: '32%',
    },
    colDistance: {
      width: '14%',
      alignItems: 'flex-end',
    },
    colTime: {
      width: '16%',
      alignItems: 'flex-end',
    },
    colPace: {
      width: '14%',
      alignItems: 'flex-end',
    },
    colElev: {
      width: '12%',
      alignItems: 'flex-end',
    },
    headerText: {
      fontSize: caption.fontSize * 0.85,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor + '80',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 3 * format.scaleFactor,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.primaryColor + '15',
      alignItems: 'center',
    },
    tableRowAlt: {
      backgroundColor: theme.primaryColor + '05',
    },
    dateText: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor + '80',
    },
    activityName: {
      fontSize: caption.fontSize,
      fontFamily: body.fontFamily,
      color: theme.primaryColor,
    },
    activityType: {
      fontSize: caption.fontSize * 0.8,
      fontFamily: caption.fontFamily,
      color: theme.accentColor,
      marginTop: 1,
    },
    valueText: {
      fontSize: caption.fontSize,
      fontFamily: body.fontFamily,
      color: theme.primaryColor,
    },
    prIndicator: {
      fontSize: caption.fontSize * 0.75,
      fontFamily: caption.fontFamily,
      color: theme.accentColor,
    },
  })
}

const ActivityLogDenseList = ({
  activities: activitiesProp,
  activity: activityProp,
  startIndex = 0,
  activitiesPerPage = 15,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  units = 'metric',
  title = 'Activity Log',
}: Omit<ActivityLogProps, 'mapboxToken' | 'variant'>) => {
  const styles = createDenseListStyles(format, theme)

  const activities = activitiesProp || (activityProp ? [activityProp] : [])
  const pageActivities = activities.slice(startIndex, startIndex + activitiesPerPage)

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

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <View style={styles.colDate}>
            <Text style={styles.headerText}>Date</Text>
          </View>
          <View style={styles.colActivity}>
            <Text style={styles.headerText}>Activity</Text>
          </View>
          <View style={styles.colDistance}>
            <Text style={styles.headerText}>{units === 'metric' ? 'km' : 'mi'}</Text>
          </View>
          <View style={styles.colTime}>
            <Text style={styles.headerText}>Time</Text>
          </View>
          <View style={styles.colPace}>
            <Text style={styles.headerText}>Pace</Text>
          </View>
          <View style={styles.colElev}>
            <Text style={styles.headerText}>Elev</Text>
          </View>
        </View>

        {/* Table Rows */}
        {pageActivities.map((activity, index) => {
          const date = new Date(activity.start_date_local)
          const dateStr = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
          const time = formatTime(activity.moving_time)
          const pace = formatPace(activity.moving_time, activity.distance, units)
          const distance = formatDistanceValue(activity.distance, units)
          const elev = activity.total_elevation_gain > 0
            ? formatElevation(activity.total_elevation_gain)
            : '-'
          const hasPR = (activity.best_efforts || []).some(e => e.pr_rank && e.pr_rank <= 3)

          return (
            <View
              key={activity.id || index}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <View style={styles.colDate}>
                <Text style={styles.dateText}>{dateStr}</Text>
              </View>
              <View style={styles.colActivity}>
                <Text style={styles.activityName}>
                  {activity.name.length > 28
                    ? activity.name.substring(0, 28) + '...'
                    : activity.name}
                </Text>
                <Text style={styles.activityType}>
                  {activity.sport_type || activity.type}
                  {hasPR ? ' \u2605' : ''}
                </Text>
              </View>
              <View style={styles.colDistance}>
                <Text style={styles.valueText}>{distance}</Text>
              </View>
              <View style={styles.colTime}>
                <Text style={styles.valueText}>{time}</Text>
              </View>
              <View style={styles.colPace}>
                <Text style={styles.valueText}>{pace}</Text>
              </View>
              <View style={styles.colElev}>
                <Text style={styles.valueText}>{elev}</Text>
              </View>
            </View>
          )
        })}
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
