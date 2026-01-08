#!/usr/bin/env npx ts-node

/**
 * Curate Fixtures Script
 *
 * Usage:
 *   npx ts-node scripts/curate-fixtures.ts <path-to-downloaded-json>
 *
 * This script processes the raw Strava data downloaded from /fetch-fixtures
 * and creates a curated set of fixture files for testing.
 */

import * as fs from 'fs'
import * as path from 'path'

// Types matching our Strava types
interface StravaPhoto {
    unique_id: string
    urls: Record<string, string>
    source: number
    uploaded_at: string
    created_at: string
    caption?: string
    activity_id: number
}

interface StravaComment {
    id: number
    activity_id: number
    text: string
    athlete: {
        id: number
        firstname: string
        lastname: string
    }
    created_at: string
}

interface StravaStreams {
    latlng?: { data: [number, number][] }
    altitude?: { data: number[] }
    time?: { data: number[] }
    distance?: { data: number[] }
}

interface ComprehensiveActivity {
    id: number
    name: string
    distance: number
    moving_time: number
    elapsed_time: number
    total_elevation_gain: number
    type: string
    sport_type: string
    start_date: string
    start_date_local: string
    timezone: string
    description?: string
    kudos_count: number
    map: { summary_polyline: string }
    splits_metric?: Array<{
        distance: number
        elapsed_time: number
        elevation_difference: number
        moving_time: number
        split: number
        average_speed: number
        pace_zone: number
    }>
    laps?: Array<{
        id: number
        name: string
        distance: number
        elapsed_time: number
        moving_time: number
        start_index: number
        end_index: number
        total_elevation_gain: number
        average_speed: number
        lap_index: number
    }>
    photos?: {
        primary: { urls?: { "600"?: string } }
        count: number
    }
    location_city?: string
    workout_type?: number | null
    start_latlng?: [number, number]
    best_efforts?: Array<{
        name: string
        elapsed_time: number
        moving_time: number
        distance: number
        start_index: number
        end_index: number
        pr_rank?: number | null
    }>
    comprehensiveData: {
        photos: StravaPhoto[]
        comments: StravaComment[]
        streams: StravaStreams
        fetchedAt: string
    }
}

interface FetchResult {
    activities: ComprehensiveActivity[]
    metadata: {
        totalCount: number
        dateRange: { after: string; before: string }
        fetchedAt: string
    }
}

interface FixtureCategories {
    // Races by distance
    races: {
        marathon: ComprehensiveActivity[]
        ultraMarathon: ComprehensiveActivity[]
        halfMarathon: ComprehensiveActivity[]
        tenK: ComprehensiveActivity[]
        fiveK: ComprehensiveActivity[]
        other: ComprehensiveActivity[]
    }
    // Training runs
    training: {
        longRun: ComprehensiveActivity[]      // > 20km
        tempoRun: ComprehensiveActivity[]     // workout_type = 3
        intervalRun: ComprehensiveActivity[]  // workout_type = 5
        easyRun: ComprehensiveActivity[]
    }
    // Other activities
    other: {
        workout: ComprehensiveActivity[]      // Strength, etc.
        swim: ComprehensiveActivity[]
        ride: ComprehensiveActivity[]
        walk: ComprehensiveActivity[]
        hike: ComprehensiveActivity[]
        other: ComprehensiveActivity[]
    }
    // Special characteristics
    special: {
        withPhotos: ComprehensiveActivity[]
        withManyPhotos: ComprehensiveActivity[]  // 3+ photos
        withComments: ComprehensiveActivity[]
        withDescription: ComprehensiveActivity[]
        withBestEfforts: ComprehensiveActivity[]
        withPRs: ComprehensiveActivity[]         // best_efforts with pr_rank = 1
        highElevation: ComprehensiveActivity[]   // > 500m gain
        noGPS: ComprehensiveActivity[]           // No polyline
        veryLong: ComprehensiveActivity[]        // > 4 hours
        veryShort: ComprehensiveActivity[]       // < 20 minutes
    }
}

function categorizeActivities(activities: ComprehensiveActivity[]): FixtureCategories {
    const categories: FixtureCategories = {
        races: { marathon: [], ultraMarathon: [], halfMarathon: [], tenK: [], fiveK: [], other: [] },
        training: { longRun: [], tempoRun: [], intervalRun: [], easyRun: [] },
        other: { workout: [], swim: [], ride: [], walk: [], hike: [], other: [] },
        special: {
            withPhotos: [], withManyPhotos: [], withComments: [], withDescription: [],
            withBestEfforts: [], withPRs: [], highElevation: [], noGPS: [], veryLong: [], veryShort: []
        }
    }

    for (const activity of activities) {
        const distanceKm = activity.distance / 1000
        const durationMin = activity.moving_time / 60
        const isRace = activity.workout_type === 1
        const isRun = activity.type === 'Run'

        // Categorize races
        if (isRace && isRun) {
            if (distanceKm >= 42) {
                if (distanceKm >= 50) {
                    categories.races.ultraMarathon.push(activity)
                } else {
                    categories.races.marathon.push(activity)
                }
            } else if (distanceKm >= 20) {
                categories.races.halfMarathon.push(activity)
            } else if (distanceKm >= 9 && distanceKm <= 11) {
                categories.races.tenK.push(activity)
            } else if (distanceKm >= 4 && distanceKm <= 6) {
                categories.races.fiveK.push(activity)
            } else {
                categories.races.other.push(activity)
            }
        }
        // Categorize training runs
        else if (isRun && !isRace) {
            if (distanceKm >= 20) {
                categories.training.longRun.push(activity)
            } else if (activity.workout_type === 3) {
                categories.training.tempoRun.push(activity)
            } else if (activity.workout_type === 5) {
                categories.training.intervalRun.push(activity)
            } else {
                categories.training.easyRun.push(activity)
            }
        }
        // Other activity types
        else {
            const type = activity.type.toLowerCase()
            if (type.includes('workout') || type.includes('weight') || type.includes('crossfit')) {
                categories.other.workout.push(activity)
            } else if (type.includes('swim')) {
                categories.other.swim.push(activity)
            } else if (type.includes('ride') || type.includes('cycling')) {
                categories.other.ride.push(activity)
            } else if (type.includes('walk')) {
                categories.other.walk.push(activity)
            } else if (type.includes('hike')) {
                categories.other.hike.push(activity)
            } else {
                categories.other.other.push(activity)
            }
        }

        // Special characteristics (can overlap)
        const photoCount = activity.comprehensiveData.photos.length
        if (photoCount > 0) {
            categories.special.withPhotos.push(activity)
            if (photoCount >= 3) {
                categories.special.withManyPhotos.push(activity)
            }
        }
        if (activity.comprehensiveData.comments.length > 0) {
            categories.special.withComments.push(activity)
        }
        if (activity.description && activity.description.trim().length > 20) {
            categories.special.withDescription.push(activity)
        }
        if (activity.best_efforts && activity.best_efforts.length > 0) {
            categories.special.withBestEfforts.push(activity)
            if (activity.best_efforts.some(e => e.pr_rank === 1)) {
                categories.special.withPRs.push(activity)
            }
        }
        if (activity.total_elevation_gain >= 500) {
            categories.special.highElevation.push(activity)
        }
        if (!activity.map?.summary_polyline) {
            categories.special.noGPS.push(activity)
        }
        if (durationMin >= 240) {
            categories.special.veryLong.push(activity)
        }
        if (durationMin < 20) {
            categories.special.veryShort.push(activity)
        }
    }

    return categories
}

function selectDiverseFixtures(categories: FixtureCategories): Record<string, ComprehensiveActivity> {
    const fixtures: Record<string, ComprehensiveActivity> = {}

    // Helper to pick best example (prefer ones with photos, comments, description)
    const pickBest = (arr: ComprehensiveActivity[]): ComprehensiveActivity | null => {
        if (arr.length === 0) return null
        return arr.sort((a, b) => {
            const scoreA = (a.comprehensiveData.photos.length * 3) +
                           (a.comprehensiveData.comments.length * 2) +
                           (a.description ? 1 : 0) +
                           (a.best_efforts?.length || 0)
            const scoreB = (b.comprehensiveData.photos.length * 3) +
                           (b.comprehensiveData.comments.length * 2) +
                           (b.description ? 1 : 0) +
                           (b.best_efforts?.length || 0)
            return scoreB - scoreA
        })[0]
    }

    // Races
    if (categories.races.ultraMarathon.length > 0) {
        fixtures['race_ultramarathon'] = pickBest(categories.races.ultraMarathon)!
    }
    if (categories.races.marathon.length > 0) {
        fixtures['race_marathon'] = pickBest(categories.races.marathon)!
    }
    if (categories.races.halfMarathon.length > 0) {
        fixtures['race_half_marathon'] = pickBest(categories.races.halfMarathon)!
    }
    if (categories.races.tenK.length > 0) {
        fixtures['race_10k'] = pickBest(categories.races.tenK)!
    }
    if (categories.races.fiveK.length > 0) {
        fixtures['race_5k'] = pickBest(categories.races.fiveK)!
    }

    // Training
    if (categories.training.longRun.length > 0) {
        fixtures['training_long_run'] = pickBest(categories.training.longRun)!
    }
    if (categories.training.tempoRun.length > 0) {
        fixtures['training_tempo'] = pickBest(categories.training.tempoRun)!
    }
    if (categories.training.intervalRun.length > 0) {
        fixtures['training_intervals'] = pickBest(categories.training.intervalRun)!
    }
    if (categories.training.easyRun.length > 0) {
        fixtures['training_easy'] = pickBest(categories.training.easyRun)!
    }

    // Other activities
    if (categories.other.workout.length > 0) {
        fixtures['other_workout'] = pickBest(categories.other.workout)!
    }
    if (categories.other.swim.length > 0) {
        fixtures['other_swim'] = pickBest(categories.other.swim)!
    }
    if (categories.other.ride.length > 0) {
        fixtures['other_ride'] = pickBest(categories.other.ride)!
    }
    if (categories.other.walk.length > 0) {
        fixtures['other_walk'] = pickBest(categories.other.walk)!
    }
    if (categories.other.hike.length > 0) {
        fixtures['other_hike'] = pickBest(categories.other.hike)!
    }

    // Edge cases
    const noGpsRun = categories.special.noGPS.find(a => a.type === 'Run')
    if (noGpsRun) {
        fixtures['edge_no_gps'] = noGpsRun
    }
    if (categories.special.veryLong.length > 0) {
        fixtures['edge_very_long'] = pickBest(categories.special.veryLong)!
    }
    if (categories.special.veryShort.length > 0) {
        fixtures['edge_very_short'] = categories.special.veryShort[0]
    }
    if (categories.special.highElevation.length > 0) {
        fixtures['edge_high_elevation'] = pickBest(categories.special.highElevation)!
    }

    // Rich content examples
    const richActivity = categories.special.withManyPhotos.find(a =>
        categories.special.withComments.includes(a) &&
        categories.special.withDescription.includes(a)
    )
    if (richActivity) {
        fixtures['rich_full_content'] = richActivity
    }

    const prActivity = pickBest(categories.special.withPRs)
    if (prActivity) {
        fixtures['rich_with_prs'] = prActivity
    }

    return fixtures
}

function generateSummary(categories: FixtureCategories, fixtures: Record<string, ComprehensiveActivity>): string {
    const lines: string[] = []

    lines.push('# Fixture Curation Summary')
    lines.push('')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push('')

    lines.push('## Category Counts')
    lines.push('')
    lines.push('### Races')
    lines.push(`- Ultra Marathon (50km+): ${categories.races.ultraMarathon.length}`)
    lines.push(`- Marathon: ${categories.races.marathon.length}`)
    lines.push(`- Half Marathon: ${categories.races.halfMarathon.length}`)
    lines.push(`- 10K: ${categories.races.tenK.length}`)
    lines.push(`- 5K: ${categories.races.fiveK.length}`)
    lines.push(`- Other races: ${categories.races.other.length}`)
    lines.push('')

    lines.push('### Training Runs')
    lines.push(`- Long runs (20km+): ${categories.training.longRun.length}`)
    lines.push(`- Tempo runs: ${categories.training.tempoRun.length}`)
    lines.push(`- Interval runs: ${categories.training.intervalRun.length}`)
    lines.push(`- Easy runs: ${categories.training.easyRun.length}`)
    lines.push('')

    lines.push('### Other Activities')
    lines.push(`- Workouts: ${categories.other.workout.length}`)
    lines.push(`- Swims: ${categories.other.swim.length}`)
    lines.push(`- Rides: ${categories.other.ride.length}`)
    lines.push(`- Walks: ${categories.other.walk.length}`)
    lines.push(`- Hikes: ${categories.other.hike.length}`)
    lines.push(`- Other: ${categories.other.other.length}`)
    lines.push('')

    lines.push('### Special Characteristics')
    lines.push(`- With photos: ${categories.special.withPhotos.length}`)
    lines.push(`- With 3+ photos: ${categories.special.withManyPhotos.length}`)
    lines.push(`- With comments: ${categories.special.withComments.length}`)
    lines.push(`- With description: ${categories.special.withDescription.length}`)
    lines.push(`- With best efforts: ${categories.special.withBestEfforts.length}`)
    lines.push(`- With PRs: ${categories.special.withPRs.length}`)
    lines.push(`- High elevation (500m+): ${categories.special.highElevation.length}`)
    lines.push(`- No GPS: ${categories.special.noGPS.length}`)
    lines.push(`- Very long (4h+): ${categories.special.veryLong.length}`)
    lines.push(`- Very short (<20m): ${categories.special.veryShort.length}`)
    lines.push('')

    lines.push('## Selected Fixtures')
    lines.push('')
    for (const [key, activity] of Object.entries(fixtures)) {
        const distKm = (activity.distance / 1000).toFixed(1)
        const photos = activity.comprehensiveData.photos.length
        const comments = activity.comprehensiveData.comments.length
        lines.push(`### ${key}`)
        lines.push(`- **Name:** ${activity.name}`)
        lines.push(`- **Date:** ${activity.start_date_local.split('T')[0]}`)
        lines.push(`- **Type:** ${activity.type} (workout_type: ${activity.workout_type ?? 'null'})`)
        lines.push(`- **Distance:** ${distKm} km`)
        lines.push(`- **Duration:** ${Math.floor(activity.moving_time / 60)} min`)
        lines.push(`- **Elevation:** ${activity.total_elevation_gain} m`)
        lines.push(`- **Photos:** ${photos}, Comments: ${comments}, Kudos: ${activity.kudos_count}`)
        lines.push(`- **Description:** ${activity.description ? 'Yes' : 'No'}`)
        lines.push(`- **Best efforts:** ${activity.best_efforts?.length || 0}`)
        lines.push('')
    }

    return lines.join('\n')
}

async function main() {
    const inputPath = process.argv[2]

    if (!inputPath) {
        console.error('Usage: npx ts-node scripts/curate-fixtures.ts <path-to-json>')
        console.error('')
        console.error('Example:')
        console.error('  npx ts-node scripts/curate-fixtures.ts ~/Downloads/strava-fixtures-2024-07-01-to-2025-06-15.json')
        process.exit(1)
    }

    const absolutePath = path.resolve(inputPath)
    console.log(`Reading: ${absolutePath}`)

    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`)
        process.exit(1)
    }

    const raw = fs.readFileSync(absolutePath, 'utf-8')
    const data: FetchResult = JSON.parse(raw)

    console.log(`Loaded ${data.activities.length} activities`)

    // Categorize
    const categories = categorizeActivities(data.activities)

    // Select fixtures
    const fixtures = selectDiverseFixtures(categories)

    console.log(`Selected ${Object.keys(fixtures).length} diverse fixtures`)

    // Output directory
    const outputDir = path.join(__dirname, '../web/lib/testing/fixtures')
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write individual fixture files
    for (const [key, activity] of Object.entries(fixtures)) {
        const filePath = path.join(outputDir, `${key}.json`)
        fs.writeFileSync(filePath, JSON.stringify(activity, null, 2))
        console.log(`  Written: ${key}.json`)
    }

    // Write combined fixtures file
    const allFixturesPath = path.join(outputDir, 'all-fixtures.json')
    fs.writeFileSync(allFixturesPath, JSON.stringify(fixtures, null, 2))
    console.log(`  Written: all-fixtures.json`)

    // Write full raw data (for year-level tests)
    const rawDataPath = path.join(outputDir, 'raw-activities.json')
    fs.writeFileSync(rawDataPath, JSON.stringify(data, null, 2))
    console.log(`  Written: raw-activities.json`)

    // Write summary
    const summary = generateSummary(categories, fixtures)
    const summaryPath = path.join(outputDir, 'SUMMARY.md')
    fs.writeFileSync(summaryPath, summary)
    console.log(`  Written: SUMMARY.md`)

    // Write TypeScript loader
    const loaderPath = path.join(outputDir, 'index.ts')
    const fixtureKeys = Object.keys(fixtures)
    const loaderContent = `// Auto-generated fixture loader
// Generated: ${new Date().toISOString()}

import { StravaActivity } from '@/lib/strava'

// Individual fixtures
${fixtureKeys.map(key => `import ${key.replace(/[^a-zA-Z0-9]/g, '_')} from './${key}.json'`).join('\n')}

// All fixtures combined
import allFixturesJson from './all-fixtures.json'

// Raw activities (full year data)
import rawActivitiesJson from './raw-activities.json'

export const fixtures = {
${fixtureKeys.map(key => `  ${key.replace(/[^a-zA-Z0-9]/g, '_')}: ${key.replace(/[^a-zA-Z0-9]/g, '_')} as unknown as StravaActivity,`).join('\n')}
}

export const allFixtures = allFixturesJson as unknown as Record<string, StravaActivity>

export const rawActivities = rawActivitiesJson as unknown as {
  activities: StravaActivity[]
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
  tenK: fixtures.race_10k,
  fiveK: fixtures.race_5k,
}

export const trainingFixtures = {
  longRun: fixtures.training_long_run,
  tempo: fixtures.training_tempo,
  intervals: fixtures.training_intervals,
  easy: fixtures.training_easy,
}

export const edgeCaseFixtures = {
  noGps: fixtures.edge_no_gps,
  veryLong: fixtures.edge_very_long,
  veryShort: fixtures.edge_very_short,
  highElevation: fixtures.edge_high_elevation,
}
`
    fs.writeFileSync(loaderPath, loaderContent)
    console.log(`  Written: index.ts`)

    console.log('')
    console.log('Done! Fixtures written to:')
    console.log(`  ${outputDir}`)
    console.log('')
    console.log('Summary:')
    console.log(summary.split('\n').slice(0, 30).join('\n'))
    console.log('...')
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
