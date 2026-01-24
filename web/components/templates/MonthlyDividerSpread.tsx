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
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'

interface MonthlyDividerSpreadProps {
  activities?: StravaActivity[]
  highlightActivity?: StravaActivity  // The featured activity for this month (from highlight selection)
  month?: number  // 0-11
  year?: number
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
  // For test harness compatibility
  activity?: StravaActivity
}

// Check if an activity has photos
function activityHasPhotos(activity: StravaActivity): boolean {
  const comprehensivePhotos = activity.comprehensiveData?.photos || []
  if (comprehensivePhotos.length > 0) return true

  // Check primary photo
  if (activity.photos?.primary?.urls) {
    const sizes = Object.keys(activity.photos.primary.urls)
    if (sizes.length > 0) return true
  }

  return false
}

// Get the best photo URL from an activity
function getActivityHeroPhoto(activity: StravaActivity): string | null {
  // Try comprehensive photos first (highest resolution)
  const comprehensivePhotos = activity.comprehensiveData?.photos || []
  for (const photo of comprehensivePhotos) {
    const sizes = Object.keys(photo.urls || {}).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a)
    if (sizes.length > 0) {
      return photo.urls[String(sizes[0])]
    }
  }

  // Fall back to primary photo
  if (activity.photos?.primary?.urls) {
    const sizes = Object.keys(activity.photos.primary.urls).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a)
    if (sizes.length > 0) {
      const urls = activity.photos.primary.urls as Record<string, string>
      return urls[String(sizes[0])]
    }
  }

  return null
}

// Get comments from an activity
function getActivityComments(activity: StravaActivity, maxComments: number = 2): Array<{ text: string; authorName: string }> {
  const comments = activity.comprehensiveData?.comments || []
  return comments.slice(0, maxComments).map(comment => ({
    text: comment.text,
    authorName: `${comment.athlete?.firstname || ''} ${comment.athlete?.lastname || ''}`.trim() || 'Someone',
  }))
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

const createStyles = (format: BookFormat, theme: BookTheme) => {
  // Resolve design tokens from the style guide
  const displaySmall = resolveTypography('displaySmall', theme, format)
  const heading = resolveTypography('heading', theme, format)
  const subheading = resolveTypography('subheading', theme, format)
  const body = resolveTypography('body', theme, format)
  const caption = resolveTypography('caption', theme, format)
  const stat = resolveTypography('stat', theme, format)
  const spacing = resolveSpacing(theme, format)
  const effects = resolveEffects(theme)

  return StyleSheet.create({
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
      marginBottom: spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: theme.primaryColor,
      borderBottomStyle: 'solid',
      paddingBottom: spacing.sm * 0.75,
    },
    leftPageTitle: {
      fontSize: displaySmall.fontSize,
      fontFamily: displaySmall.fontFamily,
      color: theme.primaryColor,
      letterSpacing: displaySmall.letterSpacing ?? -1,
      marginBottom: spacing.xs * 0.25,
    },
    leftPageYear: {
      fontSize: subheading.fontSize,
      fontFamily: heading.fontFamily,
      color: theme.accentColor,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    // Full-bleed hero photo (single photo fills the content area)
    // Uses clipping pattern: container clips overflow, image is centered
    fullBleedHeroContainer: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 4 * format.scaleFactor,
      position: 'relative',
    },
    // Image uses absolute positioning with transform centering (objectFit doesn't work in react-pdf)
    fullBleedHeroPhoto: {
      position: 'absolute',
      top: '50%',
      left: 0,
      width: '100%',
      minHeight: '100%',
      transform: 'translateY(-50%)',
    },
    photoGrid: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xs + 2,
      overflow: 'hidden',
    },
    photoRow: {
      height: 245 * format.scaleFactor,
      flexDirection: 'row',
      gap: spacing.xs + 2,
    },
    // Photo cell uses clipping pattern
    photoCell: {
      flex: 1,
      height: '100%',
      overflow: 'hidden',
      borderRadius: 4 * format.scaleFactor,
      position: 'relative',
    },
    // Image uses absolute positioning with transform centering
    photo: {
      position: 'absolute',
      top: '50%',
      left: 0,
      width: '100%',
      minHeight: '100%',
      transform: 'translateY(-50%)',
    },
    // Legacy styles for backward compatibility (used in MonthlyDividerLeftPage fallback)
    heroPhotoContainer: {
      height: 320 * format.scaleFactor,
      overflow: 'hidden',
      borderRadius: 4 * format.scaleFactor,
      marginBottom: spacing.sm * 0.75,
      position: 'relative',
    },
    heroPhoto: {
      position: 'absolute',
      top: '50%',
      left: 0,
      width: '100%',
      minHeight: '100%',
      transform: 'translateY(-50%)',
    },
    smallPhotosRow: {
      height: 195 * format.scaleFactor,
      flexDirection: 'row',
      gap: spacing.xs + 2,
    },
    smallPhotoContainer: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 4 * format.scaleFactor,
      position: 'relative',
    },
    smallPhoto: {
      position: 'absolute',
      top: '50%',
      left: 0,
      width: '100%',
      minHeight: '100%',
      transform: 'translateY(-50%)',
    },
    photoCaption: {
      position: 'absolute',
      bottom: format.safeMargin,
      left: format.safeMargin,
      right: format.safeMargin,
      color: theme.backgroundColor,
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
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
      fontSize: displaySmall.fontSize,
      fontFamily: displaySmall.fontFamily,
      opacity: effects.textOverlayOpacity,
    },

    // Right page styles
    rightPageHeader: {
      marginBottom: spacing.md,
      borderBottomWidth: 2,
      borderBottomColor: theme.primaryColor,
      borderBottomStyle: 'solid',
      paddingBottom: spacing.sm,
    },
    monthTitle: {
      fontSize: displaySmall.fontSize,
      fontFamily: displaySmall.fontFamily,
      color: theme.primaryColor,
      letterSpacing: displaySmall.letterSpacing ?? -1,
      marginBottom: spacing.xs * 0.5,
    },
    yearSubtitle: {
      fontSize: subheading.fontSize,
      fontFamily: body.fontFamily,
      color: theme.accentColor,
      letterSpacing: 2,
    },

    // Calendar section
    calendarSection: {
      marginBottom: spacing.md,
    },
    calendarLabel: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: spacing.sm * 0.75,
    },

    // Stats section
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.primaryColor,
      borderTopStyle: 'solid',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: stat.fontSize,
      fontFamily: stat.fontFamily,
      color: theme.accentColor,
      marginBottom: spacing.xs * 0.5,
    },
    statLabel: {
      fontSize: caption.fontSize * 0.8,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity + 0.1,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    // Comments section
    commentsSection: {
      flex: 1,
    },
    commentsLabel: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: spacing.sm * 0.75,
    },
    commentItem: {
      marginBottom: spacing.sm,
      paddingLeft: spacing.sm * 0.75,
      borderLeftWidth: 3,
      borderLeftColor: theme.accentColor,
      borderLeftStyle: 'solid',
    },
    commentText: {
      fontSize: body.fontSize * 0.8,
      fontFamily: body.fontFamily,
      color: theme.primaryColor,
      fontStyle: 'italic',
      lineHeight: body.lineHeight ?? 1.5,
      marginBottom: spacing.xs * 0.5,
    },
    commentAuthor: {
      fontSize: caption.fontSize * 0.9,
      fontFamily: caption.fontFamily,
      color: theme.accentColor,
    },
  })
}

export const MonthlyDividerSpread = ({
  activities,
  highlightActivity,
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

  // Determine the featured activity for this month
  // Priority: highlightActivity (if it has photos) > top-scored activity with photos > any activity with photos
  let featuredActivity: StravaActivity | undefined = highlightActivity

  // If highlight activity doesn't have photos, find the top-scored activity that does
  if (!featuredActivity || !activityHasPhotos(featuredActivity)) {
    const activitiesWithPhotos = allActivities
      .filter(activityHasPhotos)
      .map(a => ({ activity: a, score: scoreActivity(a) }))
      .sort((a, b) => b.score - a.score)

    if (activitiesWithPhotos.length > 0) {
      featuredActivity = activitiesWithPhotos[0].activity
    }
  }

  // Get hero photo from featured activity
  const heroPhotoUrl = featuredActivity ? getActivityHeroPhoto(featuredActivity) : null

  // Get comments from featured activity (1-2 comments as per spec)
  const featuredComments = featuredActivity ? getActivityComments(featuredActivity, 2) : []

  // Legacy: Get top photos for backward compatibility (used if no featured activity)
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

  // formatWithCommas is available for future use via resolveSpacing utilities

  return (
    <Document>
      {/* LEFT PAGE - Photos */}
      <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.leftPage}>
        {/* Header with month/year for brand cohesion */}
        <View style={styles.leftPageHeader}>
          <Text style={styles.leftPageTitle}>{monthName}</Text>
          <Text style={styles.leftPageYear}>{year}</Text>
        </View>

        {heroPhotoUrl ? (
          <View style={styles.fullBleedHeroContainer}>
            {/* Single hero photo from featured activity */}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
            <Image src={heroPhotoUrl} style={styles.fullBleedHeroPhoto} />
          </View>
        ) : topPhotos.length > 0 ? (
          <View style={styles.photoGrid}>
            {/* Fallback: 2x2 photo grid if no featured activity photo */}
            <View style={styles.photoRow}>
              {topPhotos[0] && (
                <View style={styles.photoCell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
                  <Image src={topPhotos[0].url} style={styles.photo} />
                </View>
              )}
              {topPhotos[1] && (
                <View style={styles.photoCell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
                  <Image src={topPhotos[1].url} style={styles.photo} />
                </View>
              )}
            </View>
            <View style={styles.photoRow}>
              {topPhotos[2] && (
                <View style={styles.photoCell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
                  <Image src={topPhotos[2].url} style={styles.photo} />
                </View>
              )}
              {topPhotos[3] && (
                <View style={styles.photoCell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
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

        {/* Comments Section - prefer featured activity comments, fallback to top comments */}
        {(featuredComments.length > 0 || topComments.length > 0) && (
          <View style={styles.commentsSection}>
            <Text style={styles.commentsLabel}>
              {featuredComments.length > 0 && featuredActivity
                ? featuredActivity.name || 'Highlight'
                : 'Month Highlights'}
            </Text>
            {featuredComments.length > 0 ? (
              // Show comments from the featured activity
              featuredComments.map((comment, idx) => (
                <View key={idx} style={styles.commentItem}>
                  <Text style={styles.commentText}>&ldquo;{comment.text.substring(0, 150)}{comment.text.length > 150 ? '...' : ''}&rdquo;</Text>
                  <Text style={styles.commentAuthor}>— {comment.authorName}</Text>
                </View>
              ))
            ) : (
              // Fallback to top comments from all activities
              topComments.slice(0, 2).map((comment, idx) => (
                <View key={idx} style={styles.commentItem}>
                  <Text style={styles.commentText}>&ldquo;{comment.text.substring(0, 120)}{comment.text.length > 120 ? '...' : ''}&rdquo;</Text>
                  <Text style={styles.commentAuthor}>— {comment.authorName} on {comment.activityName}</Text>
                </View>
              ))
            )}
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

  const year = props.year ?? (allActivities[0]
    ? new Date(allActivities[0].start_date_local || allActivities[0].start_date).getFullYear()
    : new Date().getFullYear())

  const monthName = getMonthName(month)

  // Determine the featured activity for this month
  let featuredActivity = props.highlightActivity

  // If highlight activity doesn't have photos, find the top-scored activity that does
  if (!featuredActivity || !activityHasPhotos(featuredActivity)) {
    const activitiesWithPhotos = allActivities
      .filter(activityHasPhotos)
      .map(a => ({ activity: a, score: scoreActivity(a) }))
      .sort((a, b) => b.score - a.score)

    if (activitiesWithPhotos.length > 0) {
      featuredActivity = activitiesWithPhotos[0].activity
    }
  }

  // Get hero photo from featured activity
  const heroPhotoUrl = featuredActivity ? getActivityHeroPhoto(featuredActivity) : null

  // Fallback to legacy top photos
  const topPhotos = getTopPhotos(allActivities, 4)

  return (
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={styles.leftPage}>
      {/* Header with month/year */}
      <View style={styles.leftPageHeader}>
        <Text style={styles.leftPageTitle}>{monthName}</Text>
        <Text style={styles.leftPageYear}>{year}</Text>
      </View>

      {heroPhotoUrl ? (
        <View style={styles.fullBleedHeroContainer}>
          {/* Single hero photo from featured activity */}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
          <Image src={heroPhotoUrl} style={styles.fullBleedHeroPhoto} />
        </View>
      ) : topPhotos.length > 0 ? (
        <View style={styles.photoGrid}>
          {topPhotos[0] && (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop
            <Image src={topPhotos[0].url} style={styles.heroPhoto} />
          )}
          {topPhotos.slice(1, 4).map((photo, idx) => (
            <View key={idx} style={styles.smallPhotoContainer}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
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

  // Determine the featured activity (same logic as left page)
  let featuredActivity = props.highlightActivity

  if (!featuredActivity || !activityHasPhotos(featuredActivity)) {
    const activitiesWithPhotos = allActivities
      .filter(activityHasPhotos)
      .map(a => ({ activity: a, score: scoreActivity(a) }))
      .sort((a, b) => b.score - a.score)

    if (activitiesWithPhotos.length > 0) {
      featuredActivity = activitiesWithPhotos[0].activity
    }
  }

  // Get comments from featured activity (1-2 comments as per spec)
  const featuredComments = featuredActivity ? getActivityComments(featuredActivity, 2) : []

  // Fallback to top comments from all activities
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

      {/* Comments Section - prefer featured activity comments, fallback to top comments */}
      {(featuredComments.length > 0 || topComments.length > 0) && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsLabel}>
            {featuredComments.length > 0 && featuredActivity
              ? featuredActivity.name || 'Highlight'
              : 'Month Highlights'}
          </Text>
          {featuredComments.length > 0 ? (
            // Show comments from the featured activity
            featuredComments.map((comment, idx) => (
              <View key={idx} style={styles.commentItem}>
                <Text style={styles.commentText}>&ldquo;{comment.text.substring(0, 150)}{comment.text.length > 150 ? '...' : ''}&rdquo;</Text>
                <Text style={styles.commentAuthor}>— {comment.authorName}</Text>
              </View>
            ))
          ) : (
            // Fallback to top comments from all activities
            topComments.slice(0, 2).map((comment, idx) => (
              <View key={idx} style={styles.commentItem}>
                <Text style={styles.commentText}>&ldquo;{comment.text.substring(0, 120)}{comment.text.length > 120 ? '...' : ''}&rdquo;</Text>
                <Text style={styles.commentAuthor}>— {comment.authorName} on {comment.activityName}</Text>
              </View>
            ))
          )}
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
