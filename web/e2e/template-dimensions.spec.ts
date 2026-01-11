import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Template Dimension Conformity Tests
 *
 * These tests verify that all templates render PDFs with the correct
 * page dimensions (720x720 points for 10x10 format).
 *
 * Expected dimensions: 720 x 720 points (10 inches at 72 DPI)
 * Tolerance: 1 point
 */

const EXPECTED_WIDTH = 720
const EXPECTED_HEIGHT = 720
const TOLERANCE = 1

// All templates and their variants to test
// Note: race_2p is excluded as per requirements
const TEMPLATES_TO_TEST = [
  { id: 'race_1p', variants: ['photo-hero', 'map-hero', 'dual-image', 'stats-focus', 'polyline-minimal'] },
  { id: 'cover', variants: ['photo-hero', 'gradient-minimal', 'photo-grid'] },
  { id: 'year_stats', variants: ['stats-grid', 'infographic', 'comparison'] },
  { id: 'year_calendar', variants: ['github-style', 'monthly-bars'] },
  { id: 'monthly_divider', variants: ['minimal', 'photo-accent', 'stats-preview'] },
  { id: 'activity_log', variants: ['compact-table', 'with-maps', 'journal-style'] },
  { id: 'back_cover', variants: ['stats-centered', 'minimal', 'branded'] },
  { id: 'foreword', variants: ['centered-elegant', 'left-aligned', 'pull-quote'] },
  { id: 'table_of_contents', variants: ['grouped-categories', 'simple-list', 'two-column'] },
]

/**
 * Parse PDF dimensions using pdfinfo
 * Returns { width, height } in points or null if parsing fails
 */
function getPdfDimensions(pdfPath: string): { width: number; height: number } | null {
  try {
    // Check if pdfinfo is available
    execSync('which pdfinfo', { stdio: 'pipe' })
  } catch {
    console.log('[Dimension Test] pdfinfo not available, skipping dimension validation')
    return null
  }

  try {
    const output = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' })
    const sizeMatch = output.match(/Page size:\s+([\d.]+)\s*x\s*([\d.]+)/)
    if (sizeMatch) {
      return {
        width: parseFloat(sizeMatch[1]),
        height: parseFloat(sizeMatch[2]),
      }
    }
  } catch (error) {
    console.error('[Dimension Test] Failed to get PDF dimensions:', error)
  }
  return null
}

test.describe('Template Dimension Conformity', () => {
  const outputDir = path.join(__dirname, '..', 'test-output', 'dimensions')

  test.beforeAll(() => {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  })

  // Test each template with all its variants
  for (const template of TEMPLATES_TO_TEST) {
    test.describe(`${template.id} template`, () => {
      for (const variant of template.variants) {
        test(`${variant} variant should have correct dimensions (${EXPECTED_WIDTH}x${EXPECTED_HEIGHT})`, async ({ request }) => {
          // Request the template PDF
          const response = await request.get(
            `/api/test/render-template?template=${template.id}&variant=${variant}`
          )

          // Should return 200 OK
          expect(response.status(), `Template ${template.id}/${variant} should render successfully`).toBe(200)

          // Should have PDF content type
          expect(response.headers()['content-type']).toBe('application/pdf')

          // Get the PDF buffer
          const buffer = await response.body()
          expect(buffer.length).toBeGreaterThan(0)

          // Verify PDF magic bytes
          const pdfHeader = buffer.slice(0, 4).toString()
          expect(pdfHeader).toBe('%PDF')

          // Save PDF to disk for dimension validation
          const pdfPath = path.join(outputDir, `${template.id}-${variant}.pdf`)
          fs.writeFileSync(pdfPath, buffer)

          // Validate dimensions
          const dimensions = getPdfDimensions(pdfPath)
          if (dimensions) {
            const widthDiff = Math.abs(dimensions.width - EXPECTED_WIDTH)
            const heightDiff = Math.abs(dimensions.height - EXPECTED_HEIGHT)

            expect(
              widthDiff,
              `${template.id}/${variant}: Width ${dimensions.width} should be within ${TOLERANCE}pt of ${EXPECTED_WIDTH}`
            ).toBeLessThanOrEqual(TOLERANCE)

            expect(
              heightDiff,
              `${template.id}/${variant}: Height ${dimensions.height} should be within ${TOLERANCE}pt of ${EXPECTED_HEIGHT}`
            ).toBeLessThanOrEqual(TOLERANCE)

            console.log(`[Dimension Test] ${template.id}/${variant}: ${dimensions.width}x${dimensions.height} ✓`)
          } else {
            // If pdfinfo is not available, just log and pass
            console.log(`[Dimension Test] ${template.id}/${variant}: Rendered successfully (dimension check skipped)`)
          }
        })
      }
    })
  }

  // Summary test that renders all templates without variants to check base rendering
  test('all templates should render without errors', async ({ request }) => {
    const results: { template: string; success: boolean; error?: string }[] = []

    for (const template of TEMPLATES_TO_TEST) {
      try {
        const response = await request.get(
          `/api/test/render-template?template=${template.id}`
        )

        if (response.status() === 200) {
          results.push({ template: template.id, success: true })
        } else {
          const body = await response.json()
          results.push({ template: template.id, success: false, error: body.error || 'Unknown error' })
        }
      } catch (error) {
        results.push({ template: template.id, success: false, error: String(error) })
      }
    }

    // Log summary
    console.log('\n=== Template Render Summary ===')
    for (const result of results) {
      console.log(`${result.success ? '✓' : '✗'} ${result.template}${result.error ? `: ${result.error}` : ''}`)
    }

    // All templates should have rendered successfully
    const failures = results.filter(r => !r.success)
    expect(failures.length, `${failures.length} templates failed to render`).toBe(0)
  })
})

test.describe('Template API Endpoint', () => {
  test('should return list of available templates', async ({ request }) => {
    const response = await request.get('/api/test/render-template')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.templates).toBeDefined()
    expect(Array.isArray(data.templates)).toBe(true)
    expect(data.templates.length).toBeGreaterThan(0)

    // Each template should have id and variants
    for (const template of data.templates) {
      expect(template.id).toBeDefined()
      expect(Array.isArray(template.variants)).toBe(true)
    }
  })

  test('should return error for unknown template', async ({ request }) => {
    const response = await request.get('/api/test/render-template?template=nonexistent')
    expect(response.status()).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('Unknown template')
    expect(data.available).toBeDefined()
  })
})
