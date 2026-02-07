/**
 * Fixture Factory — Parameterized Test Activity Generator
 *
 * Creates test activities by stripping/reducing data from rich base fixtures.
 * Used to test how race section variants handle different data profiles
 * (e.g., no photos, sparse descriptions, missing maps).
 */

import { StravaActivity } from '@/lib/strava'
import raceUltramarathonJson from './fixtures/race_ultramarathon.json'

// ============================================================================
// Types
// ============================================================================

export type DataLevel = 'full' | 'sparse' | 'missing'

export interface DataProfile {
  photos?: DataLevel
  description?: DataLevel
  comments?: DataLevel
  map?: DataLevel
  splits?: DataLevel
  bestEfforts?: DataLevel
  kudos?: DataLevel
}

export interface TestCase {
  profileName: string
  profile: DataProfile
  activity: StravaActivity
}

// ============================================================================
// Named Presets (14 total)
// ============================================================================

export const PRESETS: Record<string, DataProfile> = {
  // Full data — everything unchanged
  'full-data': {},

  // Bare minimum — all dimensions missing
  'bare-minimum': {
    photos: 'missing',
    description: 'missing',
    comments: 'missing',
    map: 'missing',
    splits: 'missing',
    bestEfforts: 'missing',
    kudos: 'missing',
  },

  // Single-dimension-missing
  'no-photos': { photos: 'missing' },
  'no-description': { description: 'missing' },
  'no-comments': { comments: 'missing' },
  'no-map': { map: 'missing' },
  'no-splits': { splits: 'missing' },
  'no-best-efforts': { bestEfforts: 'missing' },

  // Sparse
  'sparse-photos': { photos: 'sparse' },
  'sparse-all': {
    photos: 'sparse',
    description: 'sparse',
    comments: 'sparse',
    map: 'sparse',
    splits: 'sparse',
    bestEfforts: 'sparse',
    kudos: 'sparse',
  },

  // Compound
  'photo-only': {
    description: 'missing',
    comments: 'missing',
    map: 'missing',
    splits: 'missing',
    bestEfforts: 'missing',
    kudos: 'missing',
  },
  'stats-only': {
    photos: 'missing',
    description: 'missing',
    comments: 'missing',
  },
  'text-only': {
    photos: 'missing',
    map: 'missing',
    splits: 'missing',
    bestEfforts: 'missing',
  },

  // Minimal data — everything sparse
  'minimal-data': {
    photos: 'sparse',
    description: 'sparse',
    comments: 'sparse',
    map: 'sparse',
    splits: 'sparse',
    bestEfforts: 'sparse',
    kudos: 'sparse',
  },
}

export const PRESET_NAMES = Object.keys(PRESETS)

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Deep clone a base activity and strip/reduce fields per the data profile.
 * Never mutates the original.
 */
export function applyDataProfile(
  base: StravaActivity,
  profile: DataProfile
): StravaActivity {
  // Deep clone via JSON round-trip
  const activity: StravaActivity = JSON.parse(JSON.stringify(base))

  // --- Photos ---
  if (profile.photos === 'missing') {
    activity.photos = undefined
    activity.total_photo_count = 0
    activity.allPhotos = undefined
    if (activity.comprehensiveData) {
      activity.comprehensiveData.photos = []
    }
  } else if (profile.photos === 'sparse') {
    activity.total_photo_count = 1
    if (activity.photos) {
      activity.photos.count = 1
    }
    if (activity.allPhotos && activity.allPhotos.length > 1) {
      activity.allPhotos = [activity.allPhotos[0]]
    }
    if (activity.comprehensiveData?.photos && activity.comprehensiveData.photos.length > 1) {
      activity.comprehensiveData.photos = [activity.comprehensiveData.photos[0]]
    }
  }

  // --- Description ---
  if (profile.description === 'missing') {
    activity.description = undefined
  } else if (profile.description === 'sparse') {
    if (activity.description) {
      activity.description = activity.description.slice(0, 30)
    }
  }

  // --- Comments ---
  if (profile.comments === 'missing') {
    activity.comments = undefined
    activity.comment_count = 0
    if (activity.comprehensiveData) {
      activity.comprehensiveData.comments = []
    }
  } else if (profile.comments === 'sparse') {
    activity.comment_count = 1
    if (activity.comments && activity.comments.length > 1) {
      activity.comments = [activity.comments[0]]
    }
    if (activity.comprehensiveData?.comments && activity.comprehensiveData.comments.length > 1) {
      activity.comprehensiveData.comments = [activity.comprehensiveData.comments[0]]
    }
  }

  // --- Map ---
  if (profile.map === 'missing') {
    if (activity.map) {
      activity.map.summary_polyline = ''
    }
    activity.start_latlng = undefined
  } else if (profile.map === 'sparse') {
    if (activity.map?.summary_polyline) {
      // Truncate polyline to ~20% of original
      const len = activity.map.summary_polyline.length
      activity.map.summary_polyline = activity.map.summary_polyline.slice(0, Math.max(20, Math.floor(len * 0.2)))
    }
  }

  // --- Splits ---
  if (profile.splits === 'missing') {
    activity.splits_metric = undefined
    activity.laps = undefined
  } else if (profile.splits === 'sparse') {
    if (activity.splits_metric && activity.splits_metric.length > 2) {
      activity.splits_metric = activity.splits_metric.slice(0, 2)
    }
    if (activity.laps && activity.laps.length > 2) {
      activity.laps = activity.laps.slice(0, 2)
    }
  }

  // --- Best Efforts ---
  if (profile.bestEfforts === 'missing') {
    activity.best_efforts = undefined
  } else if (profile.bestEfforts === 'sparse') {
    if (activity.best_efforts && activity.best_efforts.length > 2) {
      activity.best_efforts = activity.best_efforts.slice(0, 2)
    }
  }

  // --- Kudos ---
  if (profile.kudos === 'missing') {
    activity.kudos_count = 0
  } else if (profile.kudos === 'sparse') {
    activity.kudos_count = 3
  }

  return activity
}

/**
 * Generate test cases by applying named presets to a base activity.
 *
 * @param base - The rich base activity to derive from
 * @param profileNames - Subset of preset names (default: all 14)
 * @returns Array of test cases with profile name, profile definition, and modified activity
 */
export function generateTestCases(
  base: StravaActivity,
  profileNames?: string[]
): TestCase[] {
  const names = profileNames || PRESET_NAMES
  return names.map(name => {
    const profile = PRESETS[name]
    if (!profile) {
      throw new Error(`Unknown preset: ${name}`)
    }
    return {
      profileName: name,
      profile,
      activity: applyDataProfile(base, profile),
    }
  })
}

/**
 * Get the default base fixture (race_ultramarathon — richest real data).
 */
export function getBaseFixture(): StravaActivity {
  return raceUltramarathonJson as unknown as StravaActivity
}
