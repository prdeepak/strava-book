import { test, expect } from '@playwright/test'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { RaceSectionVariant, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { RaceSection } from '@/components/templates/RaceSection'
import { buildSectionManifest } from '@/lib/testing/section-manifest'
import {
  applyDataProfile,
  PRESETS,
  getBaseFixture,
} from '@/lib/testing/fixture-factory'
import '@/lib/pdf-fonts'

/**
 * Manifest Integrity Tests
 *
 * Validates that buildSectionManifest() predictions exactly match actual
 * React-PDF rendered page counts. Catches manifest drift in CI.
 */

const ALL_VARIANTS: RaceSectionVariant[] = [
  'default', 'editorial', 'magazine', 'map-hero', 'photo-essay', 'stats-forward', 'compact',
]

// Representative profiles covering the major data dimensions
const TEST_PROFILES = [
  'full-data',
  'bare-minimum',
  'no-photos',
  'no-description',
  'no-comments',
  'no-map',
]

const FORMAT = FORMATS['10x10']
const THEME = DEFAULT_THEME
const MAPBOX_TOKEN = 'pk.test_token_for_manifest_validation'

const base = getBaseFixture()

test.describe('Section Manifest Integrity', () => {
  for (const variant of ALL_VARIANTS) {
    for (const profileName of TEST_PROFILES) {
      test(`${variant} x ${profileName}: manifest predicts correct page count`, async () => {
        const profile = PRESETS[profileName]
        const activity = applyDataProfile(base, profile)

        // Predict page count via manifest
        const manifest = buildSectionManifest(activity, variant, MAPBOX_TOKEN)
        const predicted = manifest.pageCount

        // Render and count actual pages
        const element = React.createElement(RaceSection, {
          activity,
          format: FORMAT,
          theme: THEME,
          mapboxToken: MAPBOX_TOKEN,
          variant,
        }) as Parameters<typeof renderToBuffer>[0]

        const buffer = await renderToBuffer(element)
        const pdfDoc = await PDFDocument.load(buffer)
        const actual = pdfDoc.getPageCount()

        expect(actual).toBe(predicted)
      })
    }
  }
})
