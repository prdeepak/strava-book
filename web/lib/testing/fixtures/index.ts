// Auto-generated fixture loader
// Generated: 2026-01-07T23:01:57.607251

import { StravaActivity } from '@/lib/strava'

// Individual fixtures
import race_ultramarathonJson from './race_ultramarathon.json'
import race_marathonJson from './race_marathon.json'
import race_half_marathonJson from './race_half_marathon.json'
import training_long_runJson from './training_long_run.json'
import training_tempoJson from './training_tempo.json'
import training_easyJson from './training_easy.json'
import other_workoutJson from './other_workout.json'
import other_swimJson from './other_swim.json'
import other_rideJson from './other_ride.json'
import other_walkJson from './other_walk.json'
import other_hikeJson from './other_hike.json'
import edge_no_gpsJson from './edge_no_gps.json'
import edge_very_longJson from './edge_very_long.json'
import edge_very_shortJson from './edge_very_short.json'
import edge_high_elevationJson from './edge_high_elevation.json'
import rich_full_contentJson from './rich_full_content.json'

// All fixtures combined
import allFixturesJson from './all-fixtures.json'

// Raw activities (full year data)
import rawActivitiesJson from './raw-activities.json'

// Type the imports
type ComprehensiveActivity = StravaActivity & {
  comprehensiveData: {
    photos: Array<{ unique_id: string; urls: Record<string, string> }>
    comments: Array<{ id: number; text: string; athlete: { firstname: string; lastname: string } }>
    streams: Record<string, { data: number[] | [number, number][] }>
    fetchedAt: string
  }
}

export const fixtures = {
  race_ultramarathon: race_ultramarathonJson as unknown as ComprehensiveActivity,
  race_marathon: race_marathonJson as unknown as ComprehensiveActivity,
  race_half_marathon: race_half_marathonJson as unknown as ComprehensiveActivity,
  training_long_run: training_long_runJson as unknown as ComprehensiveActivity,
  training_tempo: training_tempoJson as unknown as ComprehensiveActivity,
  training_easy: training_easyJson as unknown as ComprehensiveActivity,
  other_workout: other_workoutJson as unknown as ComprehensiveActivity,
  other_swim: other_swimJson as unknown as ComprehensiveActivity,
  other_ride: other_rideJson as unknown as ComprehensiveActivity,
  other_walk: other_walkJson as unknown as ComprehensiveActivity,
  other_hike: other_hikeJson as unknown as ComprehensiveActivity,
  edge_no_gps: edge_no_gpsJson as unknown as ComprehensiveActivity,
  edge_very_long: edge_very_longJson as unknown as ComprehensiveActivity,
  edge_very_short: edge_very_shortJson as unknown as ComprehensiveActivity,
  edge_high_elevation: edge_high_elevationJson as unknown as ComprehensiveActivity,
  rich_full_content: rich_full_contentJson as unknown as ComprehensiveActivity,
}

export const allFixtures = allFixturesJson as unknown as Record<string, ComprehensiveActivity>

export const rawActivities = rawActivitiesJson as unknown as {
  activities: ComprehensiveActivity[]
  metadata: {
    totalCount: number
    dateRange: { after: string; before: string }
    fetchedAt: string
  }
}

// Convenience groupings
export const raceFixtures = {
  ultramarathon: fixtures.race_ultramarathon,
  marathon: fixtures.race_marathon,
  halfMarathon: fixtures.race_half_marathon,
  thirtyK: fixtures.race_other,
}

export const trainingFixtures = {
  longRun: fixtures.training_long_run,
  easy: fixtures.training_easy,
}

export const edgeCaseFixtures = {
  noGps: fixtures.edge_no_gps,
  veryLong: fixtures.edge_very_long,
  veryShort: fixtures.edge_very_short,
  highElevation: fixtures.edge_high_elevation,
}
