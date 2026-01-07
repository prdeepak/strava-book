import { StravaActivity } from './strava'
import { KNOWN_RACES, KnownRace } from './known-races'

/**
 * Race information with classification and significance scoring
 */
export interface RaceInfo {
  activity: StravaActivity
  isRace: boolean          // workout_type === 1
  raceType: 'marathon' | 'half' | '10k' | '5k' | 'ultra' | 'trail' | 'other'
  significance: number     // Score 0-100 based on distance, photos, kudos
  matchedEvent?: KnownRace // If matched to database
}

/**
 * Detect all races from a list of activities
 */
export function detectRaces(activities: StravaActivity[]): RaceInfo[] {
  const races: RaceInfo[] = []

  for (const activity of activities) {
    // Only consider running activities marked as races
    if (activity.workout_type !== 1) {
      continue
    }

    // Running sports: Run, TrailRun, VirtualRun
    const isRunning = ['Run', 'TrailRun', 'VirtualRun'].includes(activity.sport_type)
    if (!isRunning) {
      continue
    }

    const distanceKm = activity.distance / 1000
    const raceType = classifyRaceType(distanceKm)
    const significance = calculateSignificance(activity, raceType)
    const matchedEvent = matchActivityToKnownRace(activity)

    races.push({
      activity,
      isRace: true,
      raceType,
      significance,
      matchedEvent,
    })
  }

  // Sort by significance (highest first)
  races.sort((a, b) => b.significance - a.significance)

  return races
}

/**
 * Classify race type based on distance
 */
export function classifyRaceType(distanceKm: number): RaceInfo['raceType'] {
  if (distanceKm >= 42) return 'marathon'
  if (distanceKm >= 40) return 'ultra'  // 40km+ but not marathon
  if (distanceKm >= 20 && distanceKm < 22) return 'half'
  if (distanceKm >= 9 && distanceKm < 11) return '10k'
  if (distanceKm >= 4.5 && distanceKm < 5.5) return '5k'
  if (distanceKm > 42) return 'ultra'

  // Check for trail races by distance patterns
  if (distanceKm >= 50) return 'trail'

  return 'other'
}

/**
 * Calculate significance score for a race (0-100)
 * Higher score = more important race
 */
function calculateSignificance(activity: StravaActivity, raceType: RaceInfo['raceType']): number {
  let score = 0

  // Distance points (0-40)
  const distancePoints: Record<RaceInfo['raceType'], number> = {
    'marathon': 40,
    'ultra': 40,
    'trail': 35,
    'half': 30,
    '10k': 20,
    '5k': 15,
    'other': 10,
  }
  score += distancePoints[raceType] || 10

  // Photo count (0-25)
  const photoCount = activity.photos?.count || activity.allPhotos?.length || 0
  score += Math.min(25, photoCount * 5)

  // Kudos count (0-20)
  const kudosScore = Math.min(20, activity.kudos_count / 5)
  score += kudosScore

  // Has description (0-10)
  if (activity.description && activity.description.length > 20) {
    score += 10
  }

  // Known race match (0-15 bonus)
  const matchedRace = matchActivityToKnownRace(activity)
  if (matchedRace) {
    score += 15
  }

  return Math.min(100, Math.round(score))
}

/**
 * Select the primary "A Race" from a list of races
 * Returns null if no races found
 */
export function selectARace(races: RaceInfo[]): RaceInfo | null {
  if (races.length === 0) return null

  // Already sorted by significance, so return the first one
  return races[0]
}

/**
 * Match an activity to a known race event
 */
function matchActivityToKnownRace(activity: StravaActivity): KnownRace | null {
  const activityName = activity.name.toLowerCase()
  const location = activity.location_city?.toLowerCase() || ''

  for (const race of KNOWN_RACES) {
    // Check if activity name matches race name or aliases
    const nameMatch = race.aliases.some(alias => activityName.includes(alias.toLowerCase()))

    // Check if location matches (if available)
    const locationMatch = location && race.location.city.toLowerCase().includes(location)

    if (nameMatch || locationMatch) {
      return race
    }
  }

  return null
}

/**
 * Get race statistics from a list of activities
 */
export function getRaceStatistics(activities: StravaActivity[]) {
  const races = detectRaces(activities)
  const aRace = selectARace(races)

  return {
    totalRaces: races.length,
    marathons: races.filter(r => r.raceType === 'marathon').length,
    halfMarathons: races.filter(r => r.raceType === 'half').length,
    ultras: races.filter(r => r.raceType === 'ultra').length,
    aRace,
    knownRaces: races.filter(r => r.matchedEvent !== undefined).length,
  }
}
