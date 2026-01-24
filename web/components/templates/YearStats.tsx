import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, YearSummary, DEFAULT_THEME, FORMATS, MonthlyStats } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { formatPeriodRange } from '@/lib/activity-utils'
import { MONTH_NAMES_SHORT } from '@/lib/heatmap-utils'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import { PageHeader } from '@/components/pdf/PageHeader'

// Helper to format numbers with thousands separators
const formatWithCommas = (num: number): string => {
  return num.toLocaleString('en-US')
}

export interface YearStatsProps {
  // Primary input: array of activities for the period
  activities?: StravaActivity[]
  // Legacy: single activity wrapper
  activity?: {
    yearSummary?: YearSummary | null
  }
  yearSummary?: YearSummary
  periodName?: string  // Display text for time period
  startDate?: string   // ISO date string for period start
  endDate?: string     // ISO date string for period end
  backgroundPhotoUrl?: string
  format?: BookFormat
  theme?: BookTheme
}

// Helper to format time
const formatTime = (seconds: number): { value: number; unit: string } => {
  const hours = seconds / 3600
  if (hours >= 1) {
    return { value: Math.round(hours), unit: 'hours' }
  }
  const minutes = seconds / 60
  return { value: Math.round(minutes), unit: 'minutes' }
}

// Helper to format distance
const formatDistance = (meters: number): { value: number; unit: string } => {
  const km = meters / 1000
  return { value: Math.round(km), unit: 'km' }
}

// Helper to format elevation
const formatElevation = (meters: number): { value: number; unit: string } => {
  return { value: Math.round(meters), unit: 'm' }
}

// Helper to generate synthetic year summary for testing/single activities
const generateSyntheticYearSummary = (activity?: Partial<StravaActivity>): YearSummary => {
  const year = activity?.start_date_local
    ? new Date(activity.start_date_local).getFullYear()
    : new Date().getFullYear()

  const syntheticBestEfforts = [
    { name: '400m', elapsed_time: 75, moving_time: 75, distance: 400, start_index: 0, end_index: 100, pr_rank: 1 },
    { name: '1/2 mile', elapsed_time: 156, moving_time: 156, distance: 805, start_index: 0, end_index: 200, pr_rank: null },
    { name: '1k', elapsed_time: 210, moving_time: 210, distance: 1000, start_index: 0, end_index: 300, pr_rank: 2 },
    { name: '1 mile', elapsed_time: 342, moving_time: 342, distance: 1609, start_index: 0, end_index: 400, pr_rank: null },
  ]

  const activityWithEfforts = (activity?.best_efforts?.length ?? 0) > 0
    ? activity
    : { ...activity, best_efforts: syntheticBestEfforts }

  return {
    year,
    totalDistance: activity?.distance || 5000000,
    totalTime: activity?.moving_time || 900000,
    totalElevation: activity?.total_elevation_gain || 50000,
    activityCount: activity ? 1 : 250,
    longestActivity: (activity || {}) as StravaActivity,
    fastestActivity: (activityWithEfforts || {}) as StravaActivity,
    activeDays: new Set(['2024-01-01']),
    monthlyStats: generateMonthlyStats(year),
    races: activity?.workout_type === 1 ? [activity as StravaActivity] : [],
  }
}

// Helper to generate monthly stats for visualization
const generateMonthlyStats = (year: number): MonthlyStats[] => {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    year,
    activityCount: Math.floor(Math.random() * 25) + 10,
    totalDistance: Math.floor(Math.random() * 500000) + 200000,
    totalTime: Math.floor(Math.random() * 80000) + 40000,
    totalElevation: Math.floor(Math.random() * 5000) + 2000,
    activeDays: Math.floor(Math.random() * 20) + 10,
    activities: [],
  }))
}

// Derive YearSummary from activities array
const deriveYearSummaryFromActivities = (activities: StravaActivity[]): YearSummary => {
  if (activities.length === 0) {
    return generateSyntheticYearSummary()
  }

  const years = activities.map(a => new Date(a.start_date_local || a.start_date).getFullYear())
  const year = Math.max(...years)

  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0)
  const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0)
  const totalElevation = activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0)

  const activeDaysSet = new Set<string>()
  activities.forEach(a => {
    const date = new Date(a.start_date_local || a.start_date)
    activeDaysSet.add(date.toISOString().split('T')[0])
  })

  const longestActivity = activities.reduce((longest, a) =>
    (a.distance || 0) > (longest?.distance || 0) ? a : longest, activities[0])

  const fastestActivity = activities.find(a => a.best_efforts && a.best_efforts.length > 0) || activities[0]
  const races = activities.filter(a => a.workout_type === 1)

  const byMonth = new Map<number, StravaActivity[]>()
  activities.forEach(a => {
    const date = new Date(a.start_date_local || a.start_date)
    const month = date.getMonth()
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month)!.push(a)
  })

  const monthlyStats: MonthlyStats[] = Array.from({ length: 12 }, (_, month) => {
    const monthActivities = byMonth.get(month) || []
    const monthDays = new Set<string>()
    monthActivities.forEach(a => {
      const date = new Date(a.start_date_local || a.start_date)
      monthDays.add(date.toISOString().split('T')[0])
    })
    return {
      month,
      year,
      activityCount: monthActivities.length,
      totalDistance: monthActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalTime: monthActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
      totalElevation: monthActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
      activeDays: monthDays.size,
      activities: monthActivities,
    }
  })

  return {
    year,
    totalDistance,
    totalTime,
    totalElevation,
    activityCount: activities.length,
    longestActivity,
    fastestActivity,
    activeDays: activeDaysSet,
    monthlyStats,
    races,
  }
}

/**
 * Inline MonthlyBarChart component for YearStats
 */
interface MonthlyBarChartProps {
  monthlyStats: MonthlyStats[]
  theme: BookTheme
  format: BookFormat
  startMonth?: number
  endMonth?: number
}

// MonthlyBarChart is available for variants that need it
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MonthlyBarChart = ({ monthlyStats, theme, format, startMonth, endMonth }: MonthlyBarChartProps) => {
  const spacing = resolveSpacing(theme, format)
  const caption = resolveTypography('caption', theme, format)
  const effects = resolveEffects(theme)

  let monthsToShow: { stats: MonthlyStats; monthIndex: number }[] = []

  if (startMonth !== undefined && endMonth !== undefined) {
    if (startMonth <= endMonth) {
      for (let m = startMonth; m <= endMonth; m++) {
        monthsToShow.push({ stats: monthlyStats[m] || { totalDistance: 0 }, monthIndex: m })
      }
    } else {
      for (let m = startMonth; m < 12; m++) {
        monthsToShow.push({ stats: monthlyStats[m] || { totalDistance: 0 }, monthIndex: m })
      }
      for (let m = 0; m <= endMonth; m++) {
        monthsToShow.push({ stats: monthlyStats[m] || { totalDistance: 0 }, monthIndex: m })
      }
    }
  } else {
    let firstMonth = -1
    let lastMonth = -1
    monthlyStats.forEach((stats, idx) => {
      if (stats.totalDistance > 0 || stats.activityCount > 0) {
        if (firstMonth === -1) firstMonth = idx
        lastMonth = idx
      }
    })

    if (firstMonth === -1) {
      monthsToShow = monthlyStats.map((stats, idx) => ({ stats, monthIndex: idx }))
    } else {
      for (let m = firstMonth; m <= lastMonth; m++) {
        monthsToShow.push({ stats: monthlyStats[m], monthIndex: m })
      }
    }
  }

  const maxDistance = Math.max(...monthsToShow.map(m => m.stats.totalDistance), 1)
  const chartHeight = spacing.xl * 3
  const numMonths = monthsToShow.length

  return (
    <View style={{ flexDirection: 'column' }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: chartHeight,
        borderBottomWidth: 1,
        borderBottomColor: theme.primaryColor,
        borderBottomStyle: 'solid',
        paddingBottom: 2,
        marginBottom: spacing.xs,
      }}>
        {monthsToShow.map((month, index) => {
          const barHeight = Math.max((month.stats.totalDistance / maxDistance) * (chartHeight - 4), 4)
          return (
            <View
              key={index}
              style={{
                width: `${100 / numMonths - 1}%`,
                height: barHeight,
                backgroundColor: theme.accentColor,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          )
        })}
      </View>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}>
        {monthsToShow.map((month, index) => (
          <Text
            key={index}
            style={{
              width: `${100 / numMonths}%`,
              fontSize: caption.fontSize,
              fontFamily: caption.fontFamily,
              color: theme.primaryColor,
              opacity: effects.textOverlayOpacity,
              textAlign: 'center',
            }}
          >
            {MONTH_NAMES_SHORT[month.monthIndex]}
          </Text>
        ))}
      </View>
    </View>
  )
}

// Page-only version for use in BookDocument (no Document wrapper)
export const YearStatsPage = ({
  activities,
  activity,
  yearSummary: propYearSummary,
  // periodName not used - PageHeader uses "In Review" as title
  startDate: propStartDate,
  endDate: propEndDate,
  backgroundPhotoUrl,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME
}: YearStatsProps) => {
  // Resolve design tokens
  const displayLarge = resolveTypography('displayLarge', theme, format)
  const subheading = resolveTypography('subheading', theme, format)
  const body = resolveTypography('body', theme, format)
  const caption = resolveTypography('caption', theme, format)
  const spacing = resolveSpacing(theme, format)
  const effects = resolveEffects(theme)

  // Get year summary
  let yearSummary: YearSummary
  if (activities && activities.length > 0) {
    yearSummary = deriveYearSummaryFromActivities(activities)
  } else if (propYearSummary) {
    yearSummary = propYearSummary
  } else if (activity?.yearSummary) {
    yearSummary = activity.yearSummary
  } else {
    yearSummary = generateSyntheticYearSummary()
  }

  // Calculate period range display
  let periodRangeDisplay: string | null = null
  if (propStartDate && propEndDate) {
    const start = new Date(propStartDate)
    const end = new Date(propEndDate)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      periodRangeDisplay = formatPeriodRange(start, end)
    }
  }

  const distance = formatDistance(yearSummary.totalDistance)
  const time = formatTime(yearSummary.totalTime)
  const elevation = formatElevation(yearSummary.totalElevation)

  const avgDistancePerActivity = yearSummary.activityCount > 0
    ? Math.round(yearSummary.totalDistance / 1000 / yearSummary.activityCount)
    : 0

  const avgTimePerActivity = yearSummary.activityCount > 0
    ? (yearSummary.totalTime / 3600 / yearSummary.activityCount).toFixed(1)
    : '0.0'

  const activeDays = yearSummary.activeDays
    ? (typeof yearSummary.activeDays === 'number' ? yearSummary.activeDays : yearSummary.activeDays.size)
    : 0

  const totalKudos = yearSummary.races?.reduce((sum, race) => sum + (race.kudos_count || 0), 0) || 0

  // Aggregate best efforts across all activities - find best time for each distance
  const aggregateBestEfforts = () => {
    const effortsByDistance = new Map<string, { name: string; elapsed_time: number; distance: number; pr_rank: number | null }>()

    // Collect efforts from all activities
    const allActivities = activities || []
    for (const act of allActivities) {
      for (const effort of act.best_efforts || []) {
        const existing = effortsByDistance.get(effort.name)
        // Keep the fastest time for each distance, preserving pr_rank if it's a PR
        if (!existing || effort.elapsed_time < existing.elapsed_time) {
          effortsByDistance.set(effort.name, {
            name: effort.name,
            elapsed_time: effort.elapsed_time,
            distance: effort.distance,
            pr_rank: effort.pr_rank ?? null,
          })
        }
      }
    }

    // Convert to array and sort by distance (shorter first)
    const efforts = Array.from(effortsByDistance.values())
    efforts.sort((a, b) => a.distance - b.distance)

    // Prioritize PRs first, then by distance
    const prs = efforts.filter(e => e.pr_rank && e.pr_rank <= 3)
    const others = efforts.filter(e => !e.pr_rank || e.pr_rank > 3)

    return [...prs, ...others].slice(0, 4)
  }

  const bestEfforts = aggregateBestEfforts()

  const styles = StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      padding: 0,  // Use contentContainer for padding to avoid react-pdf layout bug
      backgroundColor: theme.backgroundColor,
      position: 'relative',
    },
    // Content container with safe margins (avoids react-pdf bug with page padding + absolute elements)
    contentContainer: {
      position: 'absolute',
      top: format.safeMargin,
      left: format.safeMargin,
      right: format.safeMargin,
      bottom: format.safeMargin,
      flexDirection: 'column',
    },
    // Hero stats - Big Three
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: theme.primaryColor,
      borderBottomStyle: 'solid',
    },
    heroStat: {
      alignItems: 'center',
      flex: 1,
    },
    heroValue: {
      fontSize: subheading.fontSize * 2.5,  // One size smaller than displayLarge
      fontFamily: displayLarge.fontFamily,
      color: theme.accentColor,
      lineHeight: 1,
      letterSpacing: -1,
    },
    heroUnit: {
      fontSize: subheading.fontSize,
      fontFamily: subheading.fontFamily,
      color: theme.accentColor,
      opacity: effects.textOverlayOpacity + 0.2,
      marginTop: spacing.xs,
    },
    heroLabel: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      textTransform: 'uppercase',
      letterSpacing: caption.letterSpacing ?? 1.5,
      marginTop: spacing.xs,
      opacity: effects.textOverlayOpacity,
    },
    // Secondary stats grid
    secondarySection: {
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: subheading.fontSize,
      fontFamily: subheading.fontFamily,
      color: theme.primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: spacing.sm,
      opacity: effects.textOverlayOpacity + 0.2,
    },
    secondaryStatsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    secondaryStat: {
      alignItems: 'center',
      width: '22%',
      marginBottom: spacing.xs,
    },
    secondaryValue: {
      fontSize: body.fontSize * 1.8,
      fontFamily: body.fontFamily,
      color: theme.primaryColor,
      lineHeight: 1.1,
    },
    secondaryLabel: {
      fontSize: caption.fontSize * 0.85,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      marginTop: 2,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // Best efforts section with gold/silver/bronze styling
    bestEffortsSection: {
      marginTop: spacing.sm,
    },
    bestEffortRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs / 2,
      paddingHorizontal: spacing.xs / 2,
      marginBottom: 2,
    },
    // Medal colors are semantic constants (gold/silver/bronze - not theme-dependent)
    bestEffortRowGold: {
      backgroundColor: '#FFD700',
    },
    bestEffortRowSilver: {
      backgroundColor: '#C0C0C0',
    },
    bestEffortRowBronze: {
      backgroundColor: '#CD7F32',
    },
    bestEffortName: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      flex: 1,
    },
    // PR text needs contrast on medal backgrounds
    bestEffortNamePR: {
      fontFamily: subheading.fontFamily,
      fontWeight: 'bold',
    },
    bestEffortTime: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.accentColor,
      textAlign: 'right',
    },
    bestEffortTimePR: {
      fontFamily: subheading.fontFamily,
      fontWeight: 'bold',
      color: '#000',
    },
    // Monthly graph section
    graphSection: {
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    graphTitle: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
      opacity: effects.textOverlayOpacity + 0.2,
    },
  })

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Background: faded photo or solid color */}
      <FullBleedBackground
        image={backgroundPhotoUrl}
        fallbackColor={theme.backgroundColor}
        role="background"
        imageOpacity={effects.backgroundImageOpacity * 0.2}
        overlayOpacity={0}
        width={format.dimensions.width}
        height={format.dimensions.height}
      />

      {/* Content container with safe margins */}
      <View style={styles.contentContainer}>
        {/* Header */}
        <PageHeader
          title="In Review"
          subtitle={periodRangeDisplay || undefined}
          size="large"
          alignment="left"
          showBorder={true}
          format={format}
          theme={theme}
        />

        {/* Hero Stats - Big Three in a row */}
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{formatWithCommas(distance.value)}</Text>
            <Text style={styles.heroUnit}>{distance.unit}</Text>
            <Text style={styles.heroLabel}>Distance</Text>
          </View>

          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{formatWithCommas(time.value)}</Text>
            <Text style={styles.heroUnit}>{time.unit}</Text>
            <Text style={styles.heroLabel}>Time</Text>
          </View>

          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{formatWithCommas(elevation.value)}</Text>
            <Text style={styles.heroUnit}>{elevation.unit}</Text>
            <Text style={styles.heroLabel}>Elevation</Text>
          </View>
        </View>

        {/* Secondary Stats Grid */}
        <View style={styles.secondarySection}>
          <View style={styles.secondaryStatsGrid}>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{yearSummary.activityCount}</Text>
              <Text style={styles.secondaryLabel}>Activities</Text>
            </View>

            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{activeDays}</Text>
              <Text style={styles.secondaryLabel}>Active Days</Text>
            </View>

            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{avgDistancePerActivity}</Text>
              <Text style={styles.secondaryLabel}>Avg Distance (km)</Text>
            </View>

            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryValue}>{avgTimePerActivity}</Text>
              <Text style={styles.secondaryLabel}>Avg Time (hrs)</Text>
            </View>

            {yearSummary.races && yearSummary.races.length > 0 && (
              <View style={styles.secondaryStat}>
                <Text style={styles.secondaryValue}>{yearSummary.races.length}</Text>
                <Text style={styles.secondaryLabel}>Races</Text>
              </View>
            )}

            {totalKudos > 0 && (
              <View style={styles.secondaryStat}>
                <Text style={styles.secondaryValue}>{totalKudos}</Text>
                <Text style={styles.secondaryLabel}>Total Kudos</Text>
              </View>
            )}
          </View>
        </View>

        {/* Best Efforts Section with gold/silver/bronze for PRs */}
        {bestEfforts.length > 0 && (
          <View style={styles.bestEffortsSection}>
            <Text style={styles.sectionTitle}>Best Efforts</Text>
            {bestEfforts.slice(0, 4).map((effort, i) => {
              const minutes = Math.floor(effort.elapsed_time / 60)
              const seconds = Math.round(effort.elapsed_time % 60)
              const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`

              // Determine medal styling based on pr_rank
              const prRank = effort.pr_rank || 0
              const rowStyle = [
                styles.bestEffortRow,
                prRank === 1 && styles.bestEffortRowGold,
                prRank === 2 && styles.bestEffortRowSilver,
                prRank === 3 && styles.bestEffortRowBronze,
              ].filter(Boolean)

              const isPR = prRank >= 1 && prRank <= 3

              return (
                <View key={i} style={rowStyle}>
                  <Text style={[styles.bestEffortName, isPR && styles.bestEffortNamePR]}>
                    {effort.name}
                  </Text>
                  <Text style={[styles.bestEffortTime, isPR && styles.bestEffortTimePR]}>
                    {timeStr}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const YearStats = (props: YearStatsProps) => (
  <Document>
    <YearStatsPage {...props} />
  </Document>
)
