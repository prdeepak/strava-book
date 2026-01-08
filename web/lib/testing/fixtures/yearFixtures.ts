/**
 * Year-level test fixtures for integration testing
 *
 * These fixtures aggregate individual activity fixtures into complete year data
 * suitable for testing BookDocument and full book generation.
 */

import { StravaActivity } from '@/lib/strava'
import { YearSummary, MonthlyStats } from '@/lib/book-types'
import { fixtures, rawActivities } from './index'

// Re-export the ComprehensiveActivity type
export type ComprehensiveActivity = StravaActivity & {
  comprehensiveData: {
    photos: Array<{ unique_id: string; urls: Record<string, string> }>
    comments: Array<{ id: number; text: string; athlete: { firstname: string; lastname: string } }>
    streams: Record<string, { data: number[] | [number, number][] }>
    fetchedAt: string
  }
}

/**
 * Build YearSummary from a list of activities
 */
function buildYearSummary(activities: StravaActivity[], year: number): YearSummary {
  const monthlyStats: MonthlyStats[] = []

  // Group activities by month
  const activitiesByMonth = new Map<number, StravaActivity[]>()
  for (let month = 0; month < 12; month++) {
    activitiesByMonth.set(month, [])
  }

  activities.forEach(activity => {
    const date = new Date(activity.start_date)
    if (date.getFullYear() === year) {
      const month = date.getMonth()
      const monthActivities = activitiesByMonth.get(month) || []
      monthActivities.push(activity)
      activitiesByMonth.set(month, monthActivities)
    }
  })

  // Build monthly stats
  for (let month = 0; month < 12; month++) {
    const monthActivities = activitiesByMonth.get(month) || []
    if (monthActivities.length > 0) {
      const activeDays = new Set(monthActivities.map(a => a.start_date_local?.split('T')[0] || a.start_date.split('T')[0]))

      monthlyStats.push({
        month,
        year,
        activityCount: monthActivities.length,
        totalDistance: monthActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
        totalTime: monthActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
        totalElevation: monthActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
        activeDays: activeDays.size,
        activities: monthActivities,
      })
    }
  }

  // Build year summary
  const allDates = activities.map(a => a.start_date_local?.split('T')[0] || a.start_date.split('T')[0])
  const races = activities.filter(a => a.workout_type === 1)

  // Find longest and fastest activities
  const sortedByDistance = [...activities].sort((a, b) => (b.distance || 0) - (a.distance || 0))
  // Calculate speed from distance/time since average_speed isn't on StravaActivity
  const getSpeed = (a: StravaActivity) => a.moving_time > 0 ? (a.distance || 0) / a.moving_time : 0
  const sortedBySpeed = [...activities].sort((a, b) => getSpeed(b) - getSpeed(a))

  return {
    year,
    totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0),
    totalTime: activities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
    totalElevation: activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
    activityCount: activities.length,
    longestActivity: sortedByDistance[0] || activities[0],
    fastestActivity: sortedBySpeed[0] || activities[0],
    activeDays: new Set(allDates),
    monthlyStats,
    races,
    aRace: races.length > 0 ? races.sort((a, b) => (b.distance || 0) - (a.distance || 0))[0] : undefined,
  }
}

/**
 * Active Year fixture - Multiple races and high activity volume
 * Combines all available fixtures plus activities from raw-activities.json
 */
export interface YearFixture {
  activities: ComprehensiveActivity[]
  yearSummary: YearSummary
  year: number
  athleteName: string
  description: string
}

/**
 * Create activeYear fixture from raw activities (high volume year)
 * Uses the full raw-activities dataset (~300 activities)
 */
function createActiveYear(): YearFixture {
  // Use raw activities data - these are real activities spanning a year
  const activities = rawActivities.activities as ComprehensiveActivity[]

  // Determine the primary year from activities
  const yearCounts = new Map<number, number>()
  activities.forEach(a => {
    const year = new Date(a.start_date).getFullYear()
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1)
  })

  // Find the year with most activities
  let primaryYear = 2025
  let maxCount = 0
  yearCounts.forEach((count, year) => {
    if (count > maxCount) {
      maxCount = count
      primaryYear = year
    }
  })

  // Filter to activities in the primary year
  const yearActivities = activities.filter(a =>
    new Date(a.start_date).getFullYear() === primaryYear
  )

  return {
    activities: yearActivities.length > 0 ? yearActivities : activities,
    yearSummary: buildYearSummary(yearActivities.length > 0 ? yearActivities : activities, primaryYear),
    year: primaryYear,
    athleteName: 'Active Runner',
    description: `Active year with ${yearActivities.length || activities.length} activities including multiple races`,
  }
}

/**
 * Create casualYear fixture with fewer activities
 * Selects a subset of activities for a lighter year
 */
function createCasualYear(): YearFixture {
  // Use a subset of the individual fixtures for a casual year
  const casualActivities: ComprehensiveActivity[] = [
    fixtures.race_marathon,        // 1 marathon
    fixtures.training_long_run,    // 1 long run
    fixtures.training_easy,        // 1 easy run
    fixtures.other_hike,           // 1 hike
    fixtures.other_walk,           // 1 walk
    fixtures.other_swim,           // 1 swim
    fixtures.other_ride,           // 1 ride
    fixtures.other_workout,        // 1 workout
    fixtures.training_tempo,       // 1 tempo run
  ]

  // Determine year from the marathon (most recent activity)
  const year = new Date(fixtures.race_marathon.start_date).getFullYear()

  return {
    activities: casualActivities,
    yearSummary: buildYearSummary(casualActivities, year),
    year,
    athleteName: 'Casual Athlete',
    description: 'Casual year with 9 activities including one marathon',
  }
}

/**
 * Create marathonFocus fixture - Training block leading to a marathon
 * A focused training block with one A-race
 */
function createMarathonFocus(): YearFixture {
  // Marathon-focused training block
  const focusActivities: ComprehensiveActivity[] = [
    fixtures.race_marathon,        // The A-race
    fixtures.training_long_run,    // Long training run
    fixtures.training_long_run,    // Another long run (reused)
    fixtures.training_tempo,       // Tempo work
    fixtures.training_easy,        // Easy recovery runs
  ]

  const year = new Date(fixtures.race_marathon.start_date).getFullYear()

  return {
    activities: focusActivities,
    yearSummary: buildYearSummary(focusActivities, year),
    year,
    athleteName: 'Marathon Runner',
    description: 'Marathon training block with focused preparation',
  }
}

/**
 * Create ultraFocus fixture - Ultramarathon-focused year
 * Higher mileage with an ultra as the A-race
 */
function createUltraFocus(): YearFixture {
  // Ultra-focused training with multiple long efforts
  const ultraActivities: ComprehensiveActivity[] = [
    fixtures.race_ultramarathon,   // The ultra (A-race)
    fixtures.race_marathon,        // Tune-up marathon
    fixtures.race_half_marathon,   // Tune-up half
    fixtures.training_long_run,    // Long training runs
    fixtures.edge_very_long,       // Extra long effort
    fixtures.edge_high_elevation,  // Hill training
    fixtures.training_tempo,       // Speed work
    fixtures.training_easy,        // Recovery
    fixtures.other_hike,           // Cross-training hike
  ]

  const year = new Date(fixtures.race_ultramarathon.start_date).getFullYear()

  return {
    activities: ultraActivities,
    yearSummary: buildYearSummary(ultraActivities, year),
    year,
    athleteName: 'Ultra Runner',
    description: 'Ultramarathon training year with Comrades as the A-race',
  }
}

// Export pre-built year fixtures
export const yearFixtures = {
  activeYear: createActiveYear(),
  casualYear: createCasualYear(),
  marathonFocus: createMarathonFocus(),
  ultraFocus: createUltraFocus(),
}

// Export helper function for custom year fixtures
export { buildYearSummary }
