/**
 * Book Manifest Validation Test
 *
 * Validates that buildManifest() totalPages exactly matches the actual
 * rendered PDF page count for complete books across multiple data sets.
 *
 * Test data sets:
 *   1. Full year data (raw-activities.json)
 *   2. Casual year (9 fixtures)
 *   3. Sparse data (3 fixtures, 1 race)
 *   4. No races (training-only fixtures)
 *   5. Empty activities
 *
 * Usage:
 *   npx tsx lib/testing/book-manifest-validation.test.ts
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { buildManifest } from '@/lib/book-manifest'
import { BookDocument, applyVariantSelection } from '@/components/templates/BookDocument'
import { generateBookEntries } from '@/lib/book-entry-generator'
// Import fixtures directly to avoid circular dependency with yearFixtures
import raceUltramarathonJson from './fixtures/race_ultramarathon.json'
import raceMarathonJson from './fixtures/race_marathon.json'
import raceHalfMarathonJson from './fixtures/race_half_marathon.json'
import trainingLongRunJson from './fixtures/training_long_run.json'
import trainingTempoJson from './fixtures/training_tempo.json'
import trainingEasyJson from './fixtures/training_easy.json'
import otherHikeJson from './fixtures/other_hike.json'
import otherWalkJson from './fixtures/other_walk.json'
import otherSwimJson from './fixtures/other_swim.json'
import otherRideJson from './fixtures/other_ride.json'
import otherWorkoutJson from './fixtures/other_workout.json'
import edgeVeryLongJson from './fixtures/edge_very_long.json'
import edgeHighElevationJson from './fixtures/edge_high_elevation.json'
import rawActivitiesJson from './fixtures/raw-activities.json'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { BookEntry } from '@/lib/curator'
import * as path from 'path'

// Register fonts before rendering
import '@/lib/pdf-fonts'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

// A dummy mapbox token — variants check for its presence
const MAPBOX_TOKEN = 'pk.test_token_for_book_manifest_validation'

const FORMAT = FORMATS['10x10']
const THEME = DEFAULT_THEME

// ============================================================================
// Test Data Sets
// ============================================================================

interface TestDataSet {
  name: string
  description: string
  activities: StravaActivity[]
  races: StravaActivity[]
  forewordText?: string
}

function resolveFixturePhotos<T>(fixture: T): T {
  const json = JSON.stringify(fixture)
  const resolved = json.replace(/"(photos\/[^"]+)"/g, (_match, relativePath) => {
    const absolutePath = path.join(FIXTURES_DIR, relativePath)
    return `"${absolutePath}"`
  })
  return JSON.parse(resolved)
}

function resolveAllFixturePhotos(activities: StravaActivity[]): StravaActivity[] {
  return activities.map(a => resolveFixturePhotos(a))
}

function buildTestDataSets(): TestDataSet[] {
  // Full year data from raw-activities.json
  const rawData = rawActivitiesJson as unknown as { activities: StravaActivity[] }
  const rawAll = resolveAllFixturePhotos(rawData.activities)
  const rawRaces = rawAll.filter(a => a.workout_type === 1)
  const rawNonRaces = rawAll.filter(a => a.workout_type !== 1)

  // Casual year — 9 diverse fixtures
  const casualAll = resolveAllFixturePhotos([
    raceMarathonJson as unknown as StravaActivity,
    trainingLongRunJson as unknown as StravaActivity,
    trainingEasyJson as unknown as StravaActivity,
    otherHikeJson as unknown as StravaActivity,
    otherWalkJson as unknown as StravaActivity,
    otherSwimJson as unknown as StravaActivity,
    otherRideJson as unknown as StravaActivity,
    otherWorkoutJson as unknown as StravaActivity,
    trainingTempoJson as unknown as StravaActivity,
  ])
  const casualRaces = casualAll.filter(a => a.workout_type === 1)
  const casualNonRaces = casualAll.filter(a => a.workout_type !== 1)

  // Sparse — 1 race + 2 training activities
  const sparseAll = resolveAllFixturePhotos([
    raceHalfMarathonJson as unknown as StravaActivity,
    trainingEasyJson as unknown as StravaActivity,
    otherWalkJson as unknown as StravaActivity,
  ])
  const sparseRaces = sparseAll.filter(a => a.workout_type === 1)
  const sparseNonRaces = sparseAll.filter(a => a.workout_type !== 1)

  // No races — training only
  const noRaceAll = resolveAllFixturePhotos([
    trainingLongRunJson as unknown as StravaActivity,
    trainingEasyJson as unknown as StravaActivity,
    trainingTempoJson as unknown as StravaActivity,
    otherHikeJson as unknown as StravaActivity,
    otherRideJson as unknown as StravaActivity,
  ])
  const noRaceRaces: StravaActivity[] = []
  const noRaceNonRaces = noRaceAll

  // Ultra-focused — multiple races with rich data
  const ultraAll = resolveAllFixturePhotos([
    raceUltramarathonJson as unknown as StravaActivity,
    raceMarathonJson as unknown as StravaActivity,
    raceHalfMarathonJson as unknown as StravaActivity,
    trainingLongRunJson as unknown as StravaActivity,
    trainingEasyJson as unknown as StravaActivity,
    edgeVeryLongJson as unknown as StravaActivity,
    edgeHighElevationJson as unknown as StravaActivity,
    trainingTempoJson as unknown as StravaActivity,
    otherHikeJson as unknown as StravaActivity,
  ])
  const ultraRaces = ultraAll.filter(a => a.workout_type === 1)
  const ultraNonRaces = ultraAll.filter(a => a.workout_type !== 1)

  return [
    {
      name: 'full-year',
      description: `Full year data (${rawAll.length} activities, ${rawRaces.length} races)`,
      activities: rawNonRaces,
      races: rawRaces,
      forewordText: 'A year of dedication and growth. Every run tells a story.',
    },
    {
      name: 'casual-year',
      description: `Casual year (${casualAll.length} activities, ${casualRaces.length} race)`,
      activities: casualNonRaces,
      races: casualRaces,
    },
    {
      name: 'sparse-data',
      description: `Sparse data (${sparseAll.length} activities, ${sparseRaces.length} race)`,
      activities: sparseNonRaces,
      races: sparseRaces,
    },
    {
      name: 'no-races',
      description: `No races (${noRaceAll.length} training activities)`,
      activities: noRaceNonRaces,
      races: noRaceRaces,
    },
    {
      name: 'ultra-focus',
      description: `Ultra focus (${ultraAll.length} activities, ${ultraRaces.length} races)`,
      activities: ultraNonRaces,
      races: ultraRaces,
      forewordText: 'Comrades — the Ultimate Human Race. This year was about going beyond limits.',
    },
    {
      name: 'empty',
      description: 'Empty (0 activities)',
      activities: [],
      races: [],
    },
  ]
}

// ============================================================================
// Helpers
// ============================================================================

function getDateRange(activities: StravaActivity[]): { startDate: string; endDate: string; year: number } {
  if (activities.length === 0) {
    const now = new Date()
    const year = now.getFullYear()
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      year,
    }
  }
  const dates = activities.map(a => new Date(a.start_date_local || a.start_date))
  const start = new Date(Math.min(...dates.map(d => d.getTime())))
  const end = new Date(Math.max(...dates.map(d => d.getTime())))
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    year: end.getFullYear(),
  }
}

async function renderAndCountPages(
  entries: BookEntry[],
  allActivities: StravaActivity[],
  year: number,
  startDate: string,
  endDate: string,
  mapboxToken?: string,
): Promise<number> {
  const element = BookDocument({
    entries,
    activities: allActivities,
    format: FORMAT,
    theme: THEME,
    athleteName: 'Test Athlete',
    periodName: String(year),
    year,
    startDate,
    endDate,
    mapboxToken,
    printReady: false,
  })

  const buffer = await renderToBuffer(element)
  const pdfDoc = await PDFDocument.load(buffer)
  return pdfDoc.getPageCount()
}

// ============================================================================
// Main validation
// ============================================================================

interface TestResult {
  dataSet: string
  predicted: number
  actual: number
  match: boolean
  entryCount: number
  error?: string
}

async function runValidation(): Promise<void> {
  console.log('='.repeat(70))
  console.log('Book Manifest Validation')
  console.log('='.repeat(70))
  console.log()

  const dataSets = buildTestDataSets()
  console.log(`Testing ${dataSets.length} data sets\n`)

  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  for (const ds of dataSets) {
    console.log(`--- ${ds.name}: ${ds.description} ---`)

    // Step 1: Generate book entries
    const allActivities = [...ds.activities, ...ds.races]
    const { startDate, endDate, year } = getDateRange(allActivities)

    const entries = generateBookEntries(
      { activities: ds.activities, races: ds.races },
      {
        bookName: `Test Book — ${ds.name}`,
        athleteName: 'Test Athlete',
        startDate,
        endDate,
        forewordText: ds.forewordText,
      }
    )

    console.log(`  Entries: ${entries.length}`)

    // Step 2: Build manifest (apply variants same as BookDocument does)
    const manifest = buildManifest(entries, allActivities, { mapboxToken: MAPBOX_TOKEN })
    const predicted = manifest.totalPages
    console.log(`  Manifest predicted: ${predicted} pages`)

    // Step 3: Render PDF and count actual pages
    let actual: number
    try {
      actual = await renderAndCountPages(
        entries,
        allActivities,
        year,
        startDate,
        endDate,
        MAPBOX_TOKEN,
      )
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`  RENDER ERROR: ${errMsg}`)
      failed++
      results.push({
        dataSet: ds.name,
        predicted,
        actual: -1,
        match: false,
        entryCount: entries.length,
        error: errMsg,
      })
      continue
    }

    console.log(`  Actual rendered: ${actual} pages`)

    const match = predicted === actual
    if (match) {
      passed++
      console.log(`  ✓ MATCH: ${predicted} pages`)
    } else {
      failed++
      console.log(`  ✗ MISMATCH: predicted ${predicted}, actual ${actual} (diff: ${predicted - actual})`)

      // Debug: show page breakdown
      const enriched = applyVariantSelection(entries, allActivities)
      console.log(`  Entry breakdown:`)
      for (const entry of enriched) {
        const variant = entry.raceVariant || entry.monthlyDividerVariant || entry.activityLogVariant || ''
        console.log(`    ${entry.type}${variant ? ` (${variant})` : ''}: ${entry.title || ''}`)
      }
    }

    results.push({
      dataSet: ds.name,
      predicted,
      actual,
      match,
      entryCount: entries.length,
    })
    console.log()
  }

  // Summary
  console.log('='.repeat(70))
  console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} data sets`)
  console.log('='.repeat(70))

  // Summary table
  console.log('\n  Data Set         | Entries | Predicted | Actual | Match')
  console.log('  ' + '-'.repeat(60))
  for (const r of results) {
    const status = r.error ? 'ERROR' : r.match ? '✓' : '✗'
    console.log(
      `  ${r.dataSet.padEnd(18)} | ${String(r.entryCount).padStart(7)} | ${String(r.predicted).padStart(9)} | ${String(r.actual).padStart(6)} | ${status}`
    )
  }

  if (failed > 0) {
    console.log('\nFailed data sets:')
    for (const r of results.filter(r => !r.match)) {
      if (r.error) {
        console.log(`  ${r.dataSet}: ERROR - ${r.error}`)
      } else {
        console.log(`  ${r.dataSet}: predicted=${r.predicted}, actual=${r.actual}`)
      }
    }
    console.log()
    process.exit(1)
  } else {
    console.log('\nAll data sets match! Book manifest predictions are accurate.')
  }
}

runValidation().catch((err) => {
  console.error('Validation failed with error:', err)
  process.exit(1)
})
