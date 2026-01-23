/**
 * MonthlyDividerSpread - 2-page monthly divider
 *
 * Left page: Hero photos from the month (selected by activity hierarchy)
 * Right page: Calendar (strava-streaks style) + top comments
 */

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { getMonthName, formatDistance, formatTime } from '@/lib/activity-utils'
import { StravaActivity } from '@/lib/strava'
import { IconCalendarMonth, BubbleCalendarMonth, DayActivity, stravaActivitiesToDayActivities } from '@/lib/calendar-views'

interface MonthlyDividerSpreadProps {
  activities?: StravaActivity[]
  month?: number  // 0-11
  year?: number
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  // For test harness compatibility
  activity?: StravaActivity
}

// Activity scoring for hierarchy (higher = more important)
function scoreActivity(activity: StravaActivity): number {
  let score = 0

  // PR scoring (gold = 3pts, silver = 2pts, bronze = 1pt)
  const prCount = activity.best_efforts?.filter(e => e.pr_rank && e.pr_rank <= 3).length || 0
  score += prCount * 2

  // Kudos scoring
  const kudos = activity.kudos_count || 0
  if (kudos > 50) score += 5
  else if (kudos > 20) score += 3
  else if (kudos > 10) score += 2
  else if (kudos > 5) score += 1

  // Comments scoring
  const commentCount = activity.comment_count || activity.comprehensiveData?.comments?.length || 0
  if (commentCount > 10) score += 4
  else if (commentCount > 5) score += 2
  else if (commentCount > 0) score += 1

  // Relative effort / suffer score
  const sufferScore = activity.suffer_score || 0
  if (sufferScore > 200) score += 3
  else if (sufferScore > 100) score += 2
  else if (sufferScore > 50) score += 1

  // Distance bonus (for longer activities)
  const distanceKm = (activity.distance || 0) / 1000
  if (distanceKm > 50) score += 3
  else if (distanceKm > 20) score += 2
  else if (distanceKm > 10) score += 1

  // Elevation bonus
  const elevation = activity.total_elevation_gain || 0
  if (elevation > 1000) score += 3
  else if (elevation > 500) score += 2
  else if (elevation > 200) score += 1

  // Has photos bonus
  const photoCount = activity.comprehensiveData?.photos?.length || activity.photos?.count || activity.total_photo_count || 0
  if (photoCount > 0) score += 2

  // Has description bonus
  if (activity.description && activity.description.length > 50) score += 1

  // Race bonus
  if (activity.workout_type === 1) score += 3

  return score
}

// Extract best photos from activities (sorted by hierarchy score)
function getTopPhotos(activities: StravaActivity[], maxPhotos: number = 4): Array<{ url: string; caption?: string; activityName: string }> {
  const photos: Array<{ url: string; caption?: string; activityName: string; score: number }> = []

  const scoredActivities = activities
    .map(a => ({ activity: a, score: scoreActivity(a) }))
    .sort((a, b) => b.score - a.score)

  for (const { activity } of scoredActivities) {
    // Get photos from comprehensive data first
    const activityPhotos = activity.comprehensiveData?.photos || []
    for (const photo of activityPhotos) {
      const sizes = Object.keys(photo.urls || {}).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a)
      if (sizes.length > 0) {
        photos.push({
          url: photo.urls[String(sizes[0])],
          caption: photo.caption,
          activityName: activity.name || 'Activity',
          score: scoreActivity(activity)
        })
      }
    }

    // Check primary photo if no comprehensive photos
    if (activityPhotos.length === 0 && activity.photos?.primary?.urls) {
      const sizes = Object.keys(activity.photos.primary.urls).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a)
      if (sizes.length > 0) {
        const urls = activity.photos.primary.urls as Record<string, string>
        photos.push({
          url: urls[String(sizes[0])],
          caption: undefined,
          activityName: activity.name || 'Activity',
          score: scoreActivity(activity)
        })
      }
    }

    if (photos.length >= maxPhotos) break
  }

  return photos.slice(0, maxPhotos)
}

// Extract top comments (sorted by reaction count, then by hierarchy score)
interface ExtractedComment {
  text: string
  authorName: string
  reactionCount: number
  activityName: string
}

function getTopComments(activities: StravaActivity[], maxComments: number = 5): ExtractedComment[] {
  const allComments: Array<ExtractedComment & { activityScore: number }> = []

  for (const activity of activities) {
    const comments = activity.comprehensiveData?.comments || []
    for (const comment of comments) {
      allComments.push({
        text: comment.text,
        authorName: `${comment.athlete?.firstname || ''} ${comment.athlete?.lastname || ''}`.trim() || 'Someone',
        reactionCount: comment.reaction_count || 0,
        activityName: activity.name || 'Activity',
        activityScore: scoreActivity(activity)
      })
    }
  }

  // Sort by reaction count first, then by activity score
  allComments.sort((a, b) => {
    if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount
    return b.activityScore - a.activityScore
  })

  return allComments.slice(0, maxComments)
}

// Convert activities to calendar data format
function activitiesToCalendarData(activities: StravaActivity[]): DayActivity[] {
  return stravaActivitiesToDayActivities(activities)
}

// Check if activities are predominantly one sport type
function getPredominantSportType(activities: StravaActivity[]): { isPredominant: boolean; sportType: string } {
  if (activities.length === 0) return { isPredominant: false, sportType: 'Run' }

  const sportCounts = new Map<string, number>()
  activities.forEach(a => {
    const sport = a.sport_type || a.type || 'Run'
    sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1)
  })

  let maxSport = 'Run'
  let maxCount = 0
  sportCounts.forEach((count, sport) => {
    if (count > maxCount) {
      maxCount = count
      maxSport = sport
    }
  })

  // Predominant if > 80% are the same type
  const isPredominant = maxCount / activities.length > 0.8
  return { isPredominant, sportType: maxSport }
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
  },

  // Left page (photos) styles
  leftPage: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
  },
  leftPageHeader: {
    marginBottom: 16 * format.scaleFactor,
    borderBottomWidth: 2,
    borderBottomColor: theme.primaryColor,
    borderBottomStyle: 'solid',
    paddingBottom: 12 * format.scaleFactor,
  },
  leftPageTitle: {
    fontSize: 48 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    letterSpacing: -1,
    marginBottom: 2 * format.scaleFactor,
  },
  leftPageYear: {
    fontSize: 20 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  photoGrid: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10 * format.scaleFactor,
    overflow: 'hidden',
  },
  photoRow: {
    height: 245 * format.scaleFactor,
    flexDirection: 'row',
    gap: 10 * format.scaleFactor,
  },
  photoCell: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    borderRadius: 4 * format.scaleFactor,
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  // Legacy styles for backward compatibility
  heroPhotoContainer: {
    height: 320 * format.scaleFactor,
    overflow: 'hidden',
    borderRadius: 4 * format.scaleFactor,
    marginBottom: 12 * format.scaleFactor,
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  smallPhotosRow: {
    height: 195 * format.scaleFactor,
    flexDirection: 'row',
    gap: 10 * format.scaleFactor,
  },
  smallPhotoContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 4 * format.scaleFactor,
  },
  smallPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoCaption: {
    position: 'absolute',
    bottom: format.safeMargin,
    left: format.safeMargin,
    right: format.safeMargin,
    color: '#ffffff',
    fontSize: 10 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
  },
  noPhotosPage: {
    flex: 1,
    backgroundColor: theme.primaryColor,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4 * format.scaleFactor,
  },
  noPhotosText: {
    color: theme.backgroundColor,
    fontSize: 48 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    opacity: 0.3,
  },

  // Right page styles
  rightPageHeader: {
    marginBottom: 24 * format.scaleFactor,
    borderBottomWidth: 2,
    borderBottomColor: theme.primaryColor,
    borderBottomStyle: 'solid',
    paddingBottom: 16 * format.scaleFactor,
  },
  monthTitle: {
    fontSize: 48 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    letterSpacing: -1,
    marginBottom: 4 * format.scaleFactor,
  },
  yearSubtitle: {
    fontSize: 18 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
    letterSpacing: 2,
  },

  // Calendar section
  calendarSection: {
    marginBottom: 24 * format.scaleFactor,
  },
  calendarLabel: {
    fontSize: 10 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12 * format.scaleFactor,
  },

  // Stats section
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24 * format.scaleFactor,
    paddingTop: 16 * format.scaleFactor,
    borderTopWidth: 1,
    borderTopColor: theme.primaryColor,
    borderTopStyle: 'solid',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    marginBottom: 4 * format.scaleFactor,
  },
  statLabel: {
    fontSize: 8 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Comments section
  commentsSection: {
    flex: 1,
  },
  commentsLabel: {
    fontSize: 10 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12 * format.scaleFactor,
  },
  commentItem: {
    marginBottom: 16 * format.scaleFactor,
    paddingLeft: 12 * format.scaleFactor,
    borderLeftWidth: 3,
    borderLeftColor: theme.accentColor,
    borderLeftStyle: 'solid',
  },
  commentText: {
    fontSize: 11 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    fontStyle: 'italic',
    lineHeight: 1.5,
    marginBottom: 4 * format.scaleFactor,
  },
  commentAuthor: {
    fontSize: 9 * format.scaleFactor,
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
  },
})

export const MonthlyDividerSpread = ({
  activities,
  month: propMonth,
  year: propYear,
  format: propFormat,
  theme = DEFAULT_THEME,
  units = 'metric',
  activity
}: MonthlyDividerSpreadProps) => {
  const format = propFormat || FORMATS['10x10']
  const styles = createStyles(format, theme)

  // Derive month/year from activities
  let month = propMonth
  let year = propYear
  let allActivities = activities || []

  if (activities && activities.length > 0) {
    const firstDate = new Date(activities[0].start_date_local || activities[0].start_date)
    month = month ?? firstDate.getMonth()
    year = year ?? firstDate.getFullYear()
  } else if (activity) {
    const activityDate = new Date(activity.start_date_local || activity.start_date || new Date())
    month = month ?? activityDate.getMonth()
    year = year ?? activityDate.getFullYear()
    allActivities = [activity]
  }

  month = month ?? new Date().getMonth()
  year = year ?? new Date().getFullYear()

  const monthName = getMonthName(month)

  // Get top photos and comments
  const topPhotos = getTopPhotos(allActivities, 4)
  const topComments = getTopComments(allActivities, 4)

  // Calculate stats
  const stats = {
    activityCount: allActivities.length,
    totalDistance: allActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
    totalTime: allActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
    activeDays: new Set(allActivities.map(a => (a.start_date_local || a.start_date).split('T')[0])).size,
  }

  // Get calendar data
  const calendarData = activitiesToCalendarData(allActivities)
  const { isPredominant } = getPredominantSportType(allActivities)

  // Format numbers with commas
  const formatWithCommas = (num: number) => Math.round(num).toLocaleString('en-US')

  return (
    <Document>
      {/* LEFT PAGE - Photos */}
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.leftPage}>
        {/* Header with month/year for brand cohesion */}
        <View style={styles.leftPageHeader}>
          <Text style={styles.leftPageTitle}>{monthName}</Text>
          <Text style={styles.leftPageYear}>{year}</Text>
        </View>

        {topPhotos.length > 0 ? (
          <View style={styles.photoGrid}>
            {/* 2x2 photo grid for balanced layout */}
            <View style={styles.photoRow}>
              {topPhotos[0] && (
                <View style={styles.photoCell}>
                  <Image src={topPhotos[0].url} style={styles.photo} />
                </View>
              )}
              {topPhotos[1] && (
                <View style={styles.photoCell}>
                  <Image src={topPhotos[1].url} style={styles.photo} />
                </View>
              )}
            </View>
            <View style={styles.photoRow}>
              {topPhotos[2] && (
                <View style={styles.photoCell}>
                  <Image src={topPhotos[2].url} style={styles.photo} />
                </View>
              )}
              {topPhotos[3] && (
                <View style={styles.photoCell}>
                  <Image src={topPhotos[3].url} style={styles.photo} />
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.noPhotosPage}>
            <Text style={styles.noPhotosText}>{monthName}</Text>
          </View>
        )}
      </Page>

      {/* RIGHT PAGE - Calendar and Comments */}
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
        {/* Header */}
        <View style={styles.rightPageHeader}>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <Text style={styles.yearSubtitle}>{year}</Text>
        </View>

        {/* Calendar */}
        <View style={styles.calendarSection}>
          <Text style={styles.calendarLabel}>Activity Calendar</Text>
          {isPredominant ? (
            // Use bubble calendar for predominantly single-sport months
            <BubbleCalendarMonth
              year={year}
              month={month}
              activities={calendarData}
              format={format}
              theme={theme}
              showMonthLabel={false}
              showWeekdayLabels={true}
              cellSize={22 * format.scaleFactor}
            />
          ) : (
            // Use icon calendar for mixed-sport months
            <IconCalendarMonth
              year={year}
              month={month}
              activities={calendarData}
              format={format}
              theme={theme}
              showMonthLabel={false}
              showWeekdayLabels={true}
              cellSize={22 * format.scaleFactor}
            />
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.activityCount}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.activeDays}</Text>
            <Text style={styles.statLabel}>Active Days</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(stats.totalDistance, units)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(stats.totalTime)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>

        {/* Comments Section */}
        {topComments.length > 0 && (
          <View style={styles.commentsSection}>
            <Text style={styles.commentsLabel}>Month Highlights</Text>
            {topComments.slice(0, 2).map((comment, idx) => (
              <View key={idx} style={styles.commentItem}>
                <Text style={styles.commentText}>&ldquo;{comment.text.substring(0, 120)}{comment.text.length > 120 ? '...' : ''}&rdquo;</Text>
                <Text style={styles.commentAuthor}>— {comment.authorName} on {comment.activityName}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}

// Export individual pages for use in BookDocument
export const MonthlyDividerLeftPage = (props: MonthlyDividerSpreadProps) => {
  const format = props.format || FORMATS['10x10']
  const theme = props.theme || DEFAULT_THEME
  const styles = createStyles(format, theme)

  let allActivities = props.activities || []
  if (props.activity) {
    allActivities = [props.activity]
  }

  const month = props.month ?? (allActivities[0]
    ? new Date(allActivities[0].start_date_local || allActivities[0].start_date).getMonth()
    : new Date().getMonth())

  const monthName = getMonthName(month)
  const topPhotos = getTopPhotos(allActivities, 4)

  return (
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.leftPage}>
      {topPhotos.length > 0 ? (
        <View style={styles.photoGrid}>
          {topPhotos[0] && (
            <Image src={topPhotos[0].url} style={styles.heroPhoto} />
          )}
          {topPhotos.slice(1, 4).map((photo, idx) => (
            <View key={idx} style={styles.smallPhotoContainer}>
              <Image src={photo.url} style={styles.smallPhoto} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noPhotosPage}>
          <Text style={styles.noPhotosText}>{monthName}</Text>
        </View>
      )}
    </Page>
  )
}

export const MonthlyDividerRightPage = (props: MonthlyDividerSpreadProps) => {
  const format = props.format || FORMATS['10x10']
  const theme = props.theme || DEFAULT_THEME
  const styles = createStyles(format, theme)
  const units = props.units || 'metric'

  let allActivities = props.activities || []
  if (props.activity) {
    allActivities = [props.activity]
  }

  let month = props.month
  let year = props.year

  if (allActivities.length > 0) {
    const firstDate = new Date(allActivities[0].start_date_local || allActivities[0].start_date)
    month = month ?? firstDate.getMonth()
    year = year ?? firstDate.getFullYear()
  }

  month = month ?? new Date().getMonth()
  year = year ?? new Date().getFullYear()

  const monthName = getMonthName(month)
  const topComments = getTopComments(allActivities, 4)
  const calendarData = activitiesToCalendarData(allActivities)
  const { isPredominant } = getPredominantSportType(allActivities)

  const stats = {
    activityCount: allActivities.length,
    totalDistance: allActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
    totalTime: allActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
    activeDays: new Set(allActivities.map(a => (a.start_date_local || a.start_date).split('T')[0])).size,
  }

  return (
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.page}>
      <View style={styles.rightPageHeader}>
        <Text style={styles.monthTitle}>{monthName}</Text>
        <Text style={styles.yearSubtitle}>{year}</Text>
      </View>

      <View style={styles.calendarSection}>
        <Text style={styles.calendarLabel}>Activity Calendar</Text>
        {isPredominant ? (
          <BubbleCalendarMonth
            year={year}
            month={month}
            activities={calendarData}
            format={format}
            theme={theme}
            showMonthLabel={false}
            showWeekdayLabels={true}
          />
        ) : (
          <IconCalendarMonth
            year={year}
            month={month}
            activities={calendarData}
            format={format}
            theme={theme}
            showMonthLabel={false}
            showWeekdayLabels={true}
          />
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.activityCount}</Text>
          <Text style={styles.statLabel}>Activities</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.activeDays}</Text>
          <Text style={styles.statLabel}>Active Days</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(stats.totalDistance, units)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatTime(stats.totalTime)}</Text>
          <Text style={styles.statLabel}>Time</Text>
        </View>
      </View>

      {topComments.length > 0 && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsLabel}>Month Highlights</Text>
          {topComments.slice(0, 4).map((comment, idx) => (
            <View key={idx} style={styles.commentItem}>
              <Text style={styles.commentText}>&ldquo;{comment.text.substring(0, 120)}{comment.text.length > 120 ? '...' : ''}&rdquo;</Text>
              <Text style={styles.commentAuthor}>— {comment.authorName} on {comment.activityName}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  )
}

// Pages-only version for use in BookDocument (no Document wrapper)
// Returns a Fragment with both left and right pages
export const MonthlyDividerSpreadPages = (props: MonthlyDividerSpreadProps) => (
  <>
    <MonthlyDividerLeftPage {...props} />
    <MonthlyDividerRightPage {...props} />
  </>
)
