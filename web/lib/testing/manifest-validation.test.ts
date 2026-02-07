/**
 * Manifest Validation Test
 *
 * Validates that buildSectionManifest() predictions exactly match actual
 * React-PDF rendered page counts for all 7 variants x 7 data profiles = 49 combos.
 *
 * Usage:
 *   npx tsx lib/testing/manifest-validation.test.ts
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { buildSectionManifest } from './section-manifest'
import raceUltramarathonJson from './fixtures/race_ultramarathon.json'
import { RaceSection } from '@/components/templates/RaceSection'
import { FORMATS, DEFAULT_THEME, RaceSectionVariant } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import * as path from 'path'

// Register fonts before rendering
import '@/lib/pdf-fonts'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

function resolveFixturePhotos<T>(fixture: T): T {
  const json = JSON.stringify(fixture)
  const resolved = json.replace(/"(photos\/[^"]+)"/g, (_match, relativePath) => {
    const absolutePath = path.join(FIXTURES_DIR, relativePath)
    return `"${absolutePath}"`
  })
  return JSON.parse(resolved)
}

// ============================================================================
// Configuration
// ============================================================================

const VARIANTS: RaceSectionVariant[] = [
  'default',
  'editorial',
  'magazine',
  'map-hero',
  'photo-essay',
  'stats-forward',
  'compact',
]

// A dummy mapbox token — the editorial variant checks for its presence
// to decide whether to render the map page. The actual URL won't be fetched
// during page count validation since react-pdf handles Image lazily.
const MAPBOX_TOKEN = 'pk.test_token_for_manifest_validation'

const FORMAT = FORMATS['10x10']
const THEME = DEFAULT_THEME

// ============================================================================
// Data profile generators
// ============================================================================

type DataProfile = {
  name: string
  transform: (activity: StravaActivity) => StravaActivity
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

const DATA_PROFILES: DataProfile[] = [
  {
    name: 'full-data',
    transform: (a) => deepClone(a),
  },
  {
    name: 'no-photos',
    transform: (a) => {
      const clone = deepClone(a)
      if (clone.comprehensiveData) {
        clone.comprehensiveData.photos = []
      }
      delete clone.photos
      delete clone.total_photo_count
      delete clone.allPhotos
      return clone
    },
  },
  {
    name: 'no-description',
    transform: (a) => {
      const clone = deepClone(a)
      delete clone.description
      return clone
    },
  },
  {
    name: 'no-comments',
    transform: (a) => {
      const clone = deepClone(a)
      if (clone.comprehensiveData) {
        clone.comprehensiveData.comments = []
      }
      delete clone.comments
      clone.comment_count = 0
      return clone
    },
  },
  {
    name: 'no-map',
    transform: (a) => {
      const clone = deepClone(a)
      clone.map = { summary_polyline: '' }
      delete clone.start_latlng
      return clone
    },
  },
  {
    name: 'no-splits-efforts',
    transform: (a) => {
      const clone = deepClone(a)
      delete clone.splits_metric
      delete clone.best_efforts
      delete clone.laps
      return clone
    },
  },
  {
    name: 'bare-minimum',
    transform: (a) => {
      const clone = deepClone(a)
      // Strip all optional content
      if (clone.comprehensiveData) {
        clone.comprehensiveData.photos = []
        clone.comprehensiveData.comments = []
      }
      delete clone.photos
      delete clone.total_photo_count
      delete clone.allPhotos
      delete clone.description
      delete clone.comments
      clone.comment_count = 0
      clone.map = { summary_polyline: '' }
      delete clone.start_latlng
      delete clone.splits_metric
      delete clone.best_efforts
      delete clone.laps
      return clone
    },
  },
]

// ============================================================================
// PDF page counter
// ============================================================================

async function countRenderedPages(
  activity: StravaActivity,
  variant: RaceSectionVariant
): Promise<number> {
  const element = React.createElement(RaceSection, {
    activity,
    format: FORMAT,
    theme: THEME,
    mapboxToken: MAPBOX_TOKEN,
    variant,
  })

  const buffer = await renderToBuffer(element)
  const pdfDoc = await PDFDocument.load(buffer)
  return pdfDoc.getPageCount()
}

// ============================================================================
// Main validation
// ============================================================================

interface TestResult {
  variant: string
  profile: string
  predicted: number
  actual: number
  match: boolean
}

async function runValidation(): Promise<void> {
  console.log('='.repeat(70))
  console.log('Section Manifest Validation')
  console.log(`${VARIANTS.length} variants x ${DATA_PROFILES.length} profiles = ${VARIANTS.length * DATA_PROFILES.length} combinations`)
  console.log('='.repeat(70))
  console.log()

  // Use race_ultramarathon as base fixture (rich data: photos, comments, description, map, splits, efforts)
  const baseActivity = resolveFixturePhotos(raceUltramarathonJson) as unknown as StravaActivity

  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  for (const variant of VARIANTS) {
    console.log(`--- ${variant} ---`)

    for (const profile of DATA_PROFILES) {
      const activity = profile.transform(baseActivity)

      // Predict
      const manifest = buildSectionManifest(activity, variant, MAPBOX_TOKEN)
      const predicted = manifest.pageCount

      // Render and count actual pages
      let actual: number
      try {
        actual = await countRenderedPages(activity, variant)
      } catch (err) {
        console.error(`  RENDER ERROR [${variant}/${profile.name}]:`, err)
        failed++
        results.push({ variant, profile: profile.name, predicted, actual: -1, match: false })
        continue
      }

      const match = predicted === actual
      if (match) {
        passed++
        console.log(`  ✓ ${profile.name}: ${predicted} pages`)
      } else {
        failed++
        console.log(`  ✗ ${profile.name}: predicted ${predicted}, actual ${actual}`)
      }

      results.push({ variant, profile: profile.name, predicted, actual, match })
    }

    console.log()
  }

  // Summary
  console.log('='.repeat(70))
  console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} combinations`)
  console.log('='.repeat(70))

  if (failed > 0) {
    console.log('\nFailed combinations:')
    for (const r of results.filter((r) => !r.match)) {
      console.log(`  ${r.variant}/${r.profile}: predicted=${r.predicted}, actual=${r.actual}`)
    }
    console.log()
    process.exit(1)
  } else {
    console.log('\nAll combinations match! Manifest predictions are accurate.')
  }
}

runValidation().catch((err) => {
  console.error('Validation failed with error:', err)
  process.exit(1)
})
