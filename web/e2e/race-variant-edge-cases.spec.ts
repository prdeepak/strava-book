import { test, expect } from '@playwright/test'
import { RaceSectionVariant } from '@/lib/book-types'
import {
  applyDataProfile,
  PRESETS,
  getBaseFixture,
} from '@/lib/testing/fixture-factory'
import {
  judgeSectionHeuristic,
  buildSectionManifest,
} from '@/lib/testing/section-judge'

/**
 * Race Variant Edge Case Tests
 *
 * Tests race section variants against various data profiles using the
 * heuristic section judge. No rendering or LLM cost — fast and deterministic.
 */

const ALL_VARIANTS: RaceSectionVariant[] = [
  'default', 'editorial', 'magazine', 'map-hero', 'photo-essay', 'stats-forward', 'compact',
]

// Auto-selected variants (used in production round-robin)
const AUTO_SELECTED_VARIANTS: RaceSectionVariant[] = ['default', 'editorial', 'magazine']

// Single-dimension-missing profiles
const SINGLE_MISSING_PROFILES = [
  'no-photos', 'no-description', 'no-comments', 'no-map', 'no-splits', 'no-best-efforts',
]

const base = getBaseFixture()

test.describe('Race Variant Edge Cases', () => {
  test.describe('All variants pass with full data', () => {
    for (const variant of ALL_VARIANTS) {
      test(`${variant} variant passes heuristic judge with full data`, () => {
        const judgment = judgeSectionHeuristic(base, variant)

        expect(judgment.overallScore).toBeGreaterThanOrEqual(60)
        expect(judgment.completeness.score).toBeGreaterThanOrEqual(40)
        expect(judgment.pageUtilization.score).toBeGreaterThanOrEqual(40)
        expect(judgment.contentFlow.score).toBeGreaterThanOrEqual(40)
        expect(judgment.gracefulDegradation.score).toBeGreaterThanOrEqual(40)
        expect(judgment.pass).toBe(true)
      })
    }
  })

  test.describe('Auto-selected variants handle bare-minimum data', () => {
    for (const variant of AUTO_SELECTED_VARIANTS) {
      test(`${variant} variant scores >= 50 with bare-minimum profile`, () => {
        const activity = applyDataProfile(base, PRESETS['bare-minimum'])
        const judgment = judgeSectionHeuristic(activity, variant)

        expect(judgment.overallScore).toBeGreaterThanOrEqual(50)

        // Log details for debugging
        console.log(
          `[${variant} bare-minimum] overall=${judgment.overallScore} ` +
          `completeness=${judgment.completeness.score} util=${judgment.pageUtilization.score} ` +
          `flow=${judgment.contentFlow.score} degrade=${judgment.gracefulDegradation.score}`
        )
      })
    }
  })

  test.describe('No empty pages with single-missing dimensions', () => {
    for (const profile of SINGLE_MISSING_PROFILES) {
      for (const variant of AUTO_SELECTED_VARIANTS) {
        test(`${variant} x ${profile}: page utilization >= 40`, () => {
          const activity = applyDataProfile(base, PRESETS[profile])
          const judgment = judgeSectionHeuristic(activity, variant)

          expect(judgment.pageUtilization.score).toBeGreaterThanOrEqual(40)

          // Verify no pages have extremely low fill
          const manifest = buildSectionManifest(activity, variant)
          for (const page of manifest.pages) {
            expect(page.estimatedFillRatio).toBeGreaterThan(0.05)
          }
        })
      }
    }
  })
})
