/**
 * Activity Scoring & Highlight Selection
 *
 * Provides functions to score and rank activities for highlight selection.
 * Uses only SummaryActivity fields (available from getAthleteActivities).
 */

import { StravaActivity } from './strava'

/**
 * Calculate an effort score from SummaryActivity fields.
 * This approximates Strava's "Relative Effort" without needing heart rate data.
 *
 * Formula: Weighted combination of distance, elevation, and time
 * - Distance contributes based on raw km
 * - Elevation contributes more heavily (climbing is hard)
 * - Moving time contributes (longer = more effort)
 * - Elapsed vs moving time ratio penalizes rest stops
 *
 * @param activity - SummaryActivity from getAthleteActivities
 * @returns Effort score (higher = more effort)
 */
export function calculateEffortScore(activity: StravaActivity): number {
  const distanceKm = activity.distance / 1000
  const elevationM = activity.total_elevation_gain
  const movingTimeHours = activity.moving_time / 3600
  const elapsedTimeHours = activity.elapsed_time / 3600

  // Efficiency ratio: penalize if lots of stopped time
  const efficiency = elapsedTimeHours > 0 ? movingTimeHours / elapsedTimeHours : 1

  // Weighted effort score
  // - Distance: 1 point per km
  // - Elevation: 10 points per 100m (climbing is hard)
  // - Time: 10 points per hour of moving time
  // - Efficiency bonus: multiply by efficiency ratio
  const score = (
    distanceKm +
    (elevationM / 10) +
    (movingTimeHours * 10)
  ) * efficiency

  return Math.round(score * 10) / 10 // Round to 1 decimal
}

/**
 * Rank activities by a specific field (higher values get rank 1)
 *
 * @param activities - Array of activities to rank
 * @param getValue - Function to extract the ranking value
 * @returns Map of activity ID to rank (1 = highest)
 */
export function rankActivities(
  activities: StravaActivity[],
  getValue: (a: StravaActivity) => number
): Map<number, number> {
  // Sort by value descending
  const sorted = [...activities].sort((a, b) => getValue(b) - getValue(a))

  const ranks = new Map<number, number>()
  sorted.forEach((activity, index) => {
    ranks.set(activity.id, index + 1) // 1-indexed rank
  })

  return ranks
}

/**
 * Activity ranking result for highlight selection
 */
export interface ActivityRanking {
  activity: StravaActivity
  distanceRank: number
  effortRank: number
  kudosRank: number
  commentsRank: number
  sumRank: number
  effortScore: number
}

/**
 * Rank activities for highlight selection using sum-rank method.
 *
 * Criteria (lowest sum wins):
 * - Distance rank (highest distance = rank 1)
 * - Effort score rank (highest effort = rank 1)
 * - Kudos rank (most kudos = rank 1)
 * - Comments rank (most comments = rank 1)
 *
 * @param activities - Array of activities to rank
 * @returns Array of rankings sorted by sumRank (best first)
 */
export function rankForHighlight(activities: StravaActivity[]): ActivityRanking[] {
  if (activities.length === 0) return []

  // Calculate effort scores for all activities
  const effortScores = new Map<number, number>()
  activities.forEach(a => {
    effortScores.set(a.id, calculateEffortScore(a))
  })

  // Get ranks for each criterion
  const distanceRanks = rankActivities(activities, a => a.distance)
  const effortRanks = rankActivities(activities, a => effortScores.get(a.id) || 0)
  const kudosRanks = rankActivities(activities, a => a.kudos_count)
  const commentsRanks = rankActivities(activities, a => a.comment_count || 0)

  // Build ranking results
  const rankings: ActivityRanking[] = activities.map(activity => {
    const distanceRank = distanceRanks.get(activity.id) || activities.length
    const effortRank = effortRanks.get(activity.id) || activities.length
    const kudosRank = kudosRanks.get(activity.id) || activities.length
    const commentsRank = commentsRanks.get(activity.id) || activities.length

    return {
      activity,
      distanceRank,
      effortRank,
      kudosRank,
      commentsRank,
      sumRank: distanceRank + effortRank + kudosRank + commentsRank,
      effortScore: effortScores.get(activity.id) || 0
    }
  })

  // Sort by sum rank (lowest = best)
  return rankings.sort((a, b) => a.sumRank - b.sumRank)
}

/**
 * Select the highlight activity for a month.
 *
 * Criteria:
 * 1. Must NOT be a race (workout_type !== 1)
 * 2. Lowest sum-rank across distance, effort, kudos, comments
 *
 * @param activities - All activities in the month
 * @returns The highlight activity, or null if no eligible activities
 */
export function selectMonthlyHighlight(activities: StravaActivity[]): StravaActivity | null {
  // Filter out races (workout_type === 1)
  const nonRaces = activities.filter(a => a.workout_type !== 1)

  if (nonRaces.length === 0) return null

  // Rank and return the best one
  const rankings = rankForHighlight(nonRaces)
  return rankings[0]?.activity || null
}

/**
 * Group activities by month
 *
 * @param activities - Array of activities
 * @returns Map of "YYYY-MM" to activities in that month
 */
export function groupByMonth(activities: StravaActivity[]): Map<string, StravaActivity[]> {
  const groups = new Map<string, StravaActivity[]>()

  for (const activity of activities) {
    const date = new Date(activity.start_date_local)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const existing = groups.get(monthKey) || []
    existing.push(activity)
    groups.set(monthKey, existing)
  }

  return groups
}

/**
 * Get highlight activity for each month in a date range
 *
 * @param activities - All activities in range
 * @returns Map of "YYYY-MM" to highlight activity for that month
 */
export function getMonthlyHighlights(
  activities: StravaActivity[]
): Map<string, StravaActivity | null> {
  const byMonth = groupByMonth(activities)
  const highlights = new Map<string, StravaActivity | null>()

  for (const [monthKey, monthActivities] of byMonth) {
    highlights.set(monthKey, selectMonthlyHighlight(monthActivities))
  }

  return highlights
}

/**
 * Get all races (workout_type === 1) from activities
 */
export function getRaces(activities: StravaActivity[]): StravaActivity[] {
  return activities.filter(a => a.workout_type === 1)
}

/**
 * Check if an activity is a race
 */
export function isRace(activity: StravaActivity): boolean {
  return activity.workout_type === 1
}
