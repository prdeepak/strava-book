/**
 * Test Harness - Generate PDFs from templates and evaluate them
 *
 * This module provides the infrastructure for autonomous template iteration:
 * 1. Load fixture data
 * 2. Render template to PDF
 * 3. Convert PDF to images
 * 4. Run visual judge
 * 5. Output structured feedback
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { judgePageVisual, VisualJudgment, JudgeContext } from './visual-judge'
import { StravaActivity } from '../strava'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a unique run ID based on timestamp
 */
export function generateRunId(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const mins = String(now.getMinutes()).padStart(2, '0')
    const secs = String(now.getSeconds()).padStart(2, '0')
    return `${year}${month}${day}-${hours}${mins}${secs}`
}

/**
 * Get output directory for a test run
 */
export function getRunOutputDir(baseDir: string, runId: string): string {
    const outputDir = path.join(baseDir, runId)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }
    return outputDir
}

// ============================================================================
// Types
// ============================================================================

export interface PageDimension {
    page: number
    width: number
    height: number
    matchesFormat: boolean
}

export interface TestResult {
    templateName: string
    fixtureName: string
    pdfPath: string
    imagePaths: string[]
    judgments: VisualJudgment[]
    overallPass: boolean
    averageScore: number
    minScore: number  // Lowest page score - use this for multi-page documents
    duration: number  // ms
    error?: string
    // Page dimension validation
    pageDimensions?: PageDimension[]
    expectedDimensions?: { width: number; height: number }
    dimensionErrors?: string[]
}

export interface TestConfig {
    outputDir?: string
    keepArtifacts?: boolean
    verbose?: boolean
    skipJudge?: boolean  // Just generate PDF, don't evaluate
    variant?: string     // Force specific layout variant (e.g., 'photo-hero', 'map-hero')
}

// ============================================================================
// PDF to Image Conversion
// ============================================================================

/**
 * Convert PDF to PNG images using pdftoppm (poppler-utils)
 * Falls back to placeholder if pdftoppm not available
 */
export function pdfToImages(pdfPath: string, outputDir: string, verbose = false): string[] {
    const basename = path.basename(pdfPath, '.pdf')
    const outputPrefix = path.join(outputDir, basename)

    // Check if pdftoppm is available
    try {
        execSync('which pdftoppm', { stdio: 'pipe' })
    } catch {
        if (verbose) {
            console.log('[Test Harness] pdftoppm not found. Install with: brew install poppler')
            console.log('[Test Harness] Creating placeholder image instead')
        }
        // Create a placeholder text file indicating conversion not available
        const placeholderPath = `${outputPrefix}-placeholder.txt`
        fs.writeFileSync(placeholderPath, `PDF conversion requires pdftoppm.\nInstall with: brew install poppler\n\nPDF file: ${pdfPath}`)
        return [placeholderPath]
    }

    // Convert PDF to PNG images
    try {
        execSync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`, {
            stdio: verbose ? 'inherit' : 'pipe'
        })

        // Find generated images
        const files = fs.readdirSync(outputDir)
        const images = files
            .filter(f => f.startsWith(basename) && f.endsWith('.png'))
            .map(f => path.join(outputDir, f))
            .sort()

        if (verbose) {
            console.log(`[Test Harness] Generated ${images.length} page images`)
        }

        return images
    } catch (error) {
        if (verbose) {
            console.log('[Test Harness] PDF conversion failed:', error)
        }
        return []
    }
}

/**
 * Validate PDF page dimensions match expected format
 * Uses pdfinfo to extract per-page dimensions
 */
export function validatePageDimensions(
    pdfPath: string,
    expectedWidth: number,
    expectedHeight: number,
    verbose = false
): { dimensions: PageDimension[]; errors: string[] } {
    const dimensions: PageDimension[] = []
    const errors: string[] = []

    // Tolerance for dimension comparison (in points, ~0.5pt)
    const TOLERANCE = 1

    try {
        // Check if pdfinfo is available
        execSync('which pdfinfo', { stdio: 'pipe' })
    } catch {
        if (verbose) {
            console.log('[Test Harness] pdfinfo not found, skipping dimension validation')
        }
        return { dimensions, errors: ['pdfinfo not available'] }
    }

    try {
        // Get detailed page info using pdfinfo -f -l to get all pages
        const output = execSync(`pdfinfo -f 1 -l 100 "${pdfPath}"`, { encoding: 'utf-8' })

        // Parse page count
        const pageCountMatch = output.match(/Pages:\s+(\d+)/)
        const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0

        // Parse overall page size (default for all pages)
        const defaultSizeMatch = output.match(/Page size:\s+([\d.]+)\s*x\s*([\d.]+)/)
        const defaultWidth = defaultSizeMatch ? parseFloat(defaultSizeMatch[1]) : 0
        const defaultHeight = defaultSizeMatch ? parseFloat(defaultSizeMatch[2]) : 0

        // For each page, check if there's a specific size or use default
        for (let i = 1; i <= pageCount; i++) {
            const pageSizeMatch = output.match(new RegExp(`Page\\s+${i}\\s+size:\\s+([\\d.]+)\\s*x\\s*([\\d.]+)`))
            const pageWidth = pageSizeMatch ? parseFloat(pageSizeMatch[1]) : defaultWidth
            const pageHeight = pageSizeMatch ? parseFloat(pageSizeMatch[2]) : defaultHeight

            const widthMatches = Math.abs(pageWidth - expectedWidth) <= TOLERANCE
            const heightMatches = Math.abs(pageHeight - expectedHeight) <= TOLERANCE
            const matchesFormat = widthMatches && heightMatches

            dimensions.push({
                page: i,
                width: pageWidth,
                height: pageHeight,
                matchesFormat
            })

            if (!matchesFormat) {
                errors.push(
                    `Page ${i}: ${pageWidth}x${pageHeight} (expected ${expectedWidth}x${expectedHeight})`
                )
            }
        }

        if (verbose && errors.length > 0) {
            console.log(`[Test Harness] Dimension errors found:`)
            errors.forEach(e => console.log(`  - ${e}`))
        } else if (verbose && dimensions.length > 0) {
            console.log(`[Test Harness] All ${dimensions.length} pages match expected dimensions`)
        }

    } catch (error) {
        if (verbose) {
            console.log('[Test Harness] Dimension validation failed:', error)
        }
        errors.push(`Validation failed: ${error}`)
    }

    return { dimensions, errors }
}

// ============================================================================
// Template Registry
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateComponent = React.ComponentType<any>

const templateRegistry: Record<string, () => Promise<TemplateComponent>> = {
    // Race templates
    'Race_1p': async () => {
        const mod = await import('../../components/templates/Race_1p')
        return mod.Race_1p
    },
    'Race_2p': async () => {
        const mod = await import('../../components/templates/Race_2p')
        return mod.Race_2p
    },
    'RaceSection': async () => {
        const mod = await import('../../components/templates/RaceSection')
        return mod.RaceSection
    },
    'PhotoGallery': async () => {
        const mod = await import('../../components/templates/PhotoGallery')
        return mod.PhotoGallery
    },
    // Other templates - add as needed
    'Cover': async () => {
        const mod = await import('../../components/templates/Cover')
        return mod.Cover
    },
    'Foreword': async () => {
        const mod = await import('../../components/templates/Foreword')
        return mod.Foreword
    },
    'YearStats': async () => {
        const mod = await import('../../components/templates/YearStats')
        return mod.YearStats
    },
    'YearCalendar': async () => {
        const mod = await import('../../components/templates/YearCalendar')
        return mod.YearCalendar
    },
    'MonthlyDivider': async () => {
        // Use MonthlyDividerSpread (2-page spread) which is what BookDocument uses in production
        const mod = await import('../../components/templates/MonthlyDividerSpread')
        return mod.MonthlyDividerSpread
    },
    'ActivityLog': async () => {
        const mod = await import('../../components/templates/ActivityLog')
        return mod.ActivityLog
    },
    'BackCover': async () => {
        const mod = await import('../../components/templates/BackCover')
        return mod.BackCover
    },
    'AllMonthlyDividers': async () => {
        const mod = await import('../../components/templates/AllMonthlyDividers')
        return mod.AllMonthlyDividers
    },
    'TableOfContents': async () => {
        const mod = await import('../../components/templates/TableOfContents')
        return mod.TableOfContents
    },

    // Calendar view templates
    'CalendarIconView': async () => {
        const mod = await import('../../components/templates/CalendarIconView')
        return mod.CalendarIconView
    },
    'CalendarHeatmapView': async () => {
        const mod = await import('../../components/templates/CalendarHeatmapView')
        return mod.CalendarHeatmapView
    },
    'CalendarBubbleView': async () => {
        const mod = await import('../../components/templates/CalendarBubbleView')
        return mod.CalendarBubbleView
    },
}

export function getAvailableTemplates(): string[] {
    return Object.keys(templateRegistry)
}

// ============================================================================
// Fixture Loading
// ============================================================================

export function loadFixture(fixtureName: string): unknown {
    const fixturePath = path.join(__dirname, 'fixtures', `${fixtureName}.json`)
    const fixturesDir = path.join(__dirname, 'fixtures')

    if (!fs.existsSync(fixturePath)) {
        throw new Error(`Fixture not found: ${fixturePath}`)
    }

    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))

    // Merge comprehensiveData into main activity object for template access
    if (fixture.comprehensiveData) {
        // Merge comments
        if (fixture.comprehensiveData.comments && fixture.comprehensiveData.comments.length > 0) {
            fixture.comments = fixture.comprehensiveData.comments
        }
        // Only merge comprehensiveData photos if fixture.photos.primary doesn't already have local photo paths
        // (Local paths start with "photos/" and are preferred over cloudfront URLs for testing)
        const hasLocalPhotos = fixture.photos?.primary?.urls?.['600']?.startsWith('photos/')
        if (!hasLocalPhotos && fixture.comprehensiveData.photos && fixture.comprehensiveData.photos.length > 0) {
            const primaryPhoto = fixture.comprehensiveData.photos[0]
            fixture.photos = fixture.photos || {}
            fixture.photos.primary = fixture.photos.primary || {
                urls: primaryPhoto.urls || {}
            }
            // Use the largest available size for primary photo
            const sizes = Object.keys(primaryPhoto.urls || {}).map(Number).sort((a, b) => b - a)
            if (sizes.length > 0) {
                fixture.photos.primary.urls = fixture.photos.primary.urls || {}
                fixture.photos.primary.urls['600'] = primaryPhoto.urls[sizes[0]]
            }
        }
    }

    // Resolve photo URLs to local files when available
    let json = JSON.stringify(fixture)

    // First: resolve relative paths (photos/...) to absolute paths
    json = json.replace(/"(photos\/[^"]+)"/g, (_match, relativePath) => {
        const absolutePath = path.join(fixturesDir, relativePath)
        return `"${absolutePath}"`
    })

    // Second: map cloudfront URLs to local fixture photos if available
    // Extract the image signature from cloudfront URL and check if local file exists
    json = json.replace(/"https:\/\/dgtzuqphqg23d\.cloudfront\.net\/([^"]+)"/g, (_match, cloudPath) => {
        // cloudPath is like: "onC_jOkSVGvnxNfZpsNrjkrzO25b5gAY6uaQY2uV7UQ-1536x2048.jpg"
        // Extract the signature (before the dimensions)
        const sigMatch = cloudPath.match(/^([A-Za-z0-9_-]+)-\d+x\d+\.jpg$/)
        if (sigMatch) {
            const signature = sigMatch[1]
            // Look for local file with this signature
            const photosDir = path.join(fixturesDir, 'photos')
            if (fs.existsSync(photosDir)) {
                const files = fs.readdirSync(photosDir)
                const localFile = files.find(f => f.startsWith(signature))
                if (localFile) {
                    const localPath = path.join(photosDir, localFile)
                    return `"${localPath}"`
                }
            }
        }
        // Return original URL if no local file found
        return `"https://dgtzuqphqg23d.cloudfront.net/${cloudPath}"`
    })

    return JSON.parse(json)
}

export function getAvailableFixtures(): string[] {
    const fixturesDir = path.join(__dirname, 'fixtures')

    if (!fs.existsSync(fixturesDir)) {
        return []
    }

    return fs.readdirSync(fixturesDir)
        .filter(f => f.endsWith('.json') && !f.includes('raw-activities') && !f.includes('all-fixtures'))
        .map(f => f.replace('.json', ''))
}

// ============================================================================
// Test Runner
// ============================================================================

export async function testTemplate(
    templateName: string,
    fixtureName: string,
    config: TestConfig = {}
): Promise<TestResult> {
    const startTime = Date.now()
    const {
        outputDir = path.join(__dirname, '../../..', 'test-output'),
        keepArtifacts = true,
        verbose = false,
        skipJudge = false,
        variant
    } = config

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true })

    const result: TestResult = {
        templateName,
        fixtureName,
        pdfPath: '',
        imagePaths: [],
        judgments: [],
        overallPass: false,
        averageScore: 0,
        minScore: 0,
        duration: 0
    }

    try {
        // Load template
        if (verbose) {
            console.log(`[Test Harness] Loading template: ${templateName}`)
        }

        const templateLoader = templateRegistry[templateName]
        if (!templateLoader) {
            throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(templateRegistry).join(', ')}`)
        }

        const Template = await templateLoader()

        // Load fixture
        if (verbose) {
            console.log(`[Test Harness] Loading fixture: ${fixtureName}`)
        }

        const fixture = loadFixture(fixtureName)

        // Render PDF
        if (verbose) {
            console.log(`[Test Harness] Rendering PDF...`)
        }

        // Import book types for default format and theme
        const { FORMATS, DEFAULT_THEME } = await import('../book-types')

        // Get mapbox token from environment for satellite maps
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN
        if (verbose) {
            console.log(`[Test Harness] Mapbox token: ${mapboxToken ? 'present' : 'missing'}`)
        }

        // Build template props - some templates need special handling
        const templateProps: Record<string, unknown> = {
            format: FORMATS['10x10'],
            theme: DEFAULT_THEME,
            mapboxToken
        }

        // Check if this is a year/period fixture (has activities array)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixtureObj = fixture as any
        const isYearFixture = fixtureObj?.fixtureType === 'year' || Array.isArray(fixtureObj?.activities)
        const activities = isYearFixture ? fixtureObj.activities : null

        // Templates that work with activities arrays
        const periodTemplates = ['MonthlyDivider', 'YearStats', 'YearCalendar', 'ActivityLog', 'AllMonthlyDividers']

        if (periodTemplates.includes(templateName) && activities) {
            templateProps.activities = activities

            // MonthlyDivider needs a specific month - pick one with good activity count
            if (templateName === 'MonthlyDivider') {
                // Group by year-month and pick one with multiple activities
                const byMonth = new Map<string, typeof activities>()
                for (const a of activities) {
                    const date = new Date(a.start_date_local || a.start_date)
                    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
                    if (!byMonth.has(key)) byMonth.set(key, [])
                    byMonth.get(key)!.push(a)
                }
                // Pick month with most activities
                let bestMonth = ''
                let bestCount = 0
                for (const [key, monthActivities] of byMonth) {
                    if (monthActivities.length > bestCount) {
                        bestCount = monthActivities.length
                        bestMonth = key
                    }
                }
                if (bestMonth && byMonth.has(bestMonth)) {
                    const monthActivities = byMonth.get(bestMonth)!
                    templateProps.activities = monthActivities

                    // Find a highlight activity (prefer one with photos)
                    const activityWithPhotos = monthActivities.find((a: StravaActivity) => {
                        const hasComprehensivePhotos = (a.comprehensiveData?.photos?.length ?? 0) > 0
                        const hasPrimaryPhoto = a.photos?.primary?.urls && Object.keys(a.photos.primary.urls).length > 0
                        return hasComprehensivePhotos || hasPrimaryPhoto
                    })
                    // Fall back to first activity if none have photos
                    templateProps.highlightActivity = activityWithPhotos || monthActivities[0]

                    if (verbose) {
                        console.log(`[Test Harness] MonthlyDivider using ${bestMonth} with ${bestCount} activities`)
                        console.log(`[Test Harness] Highlight activity: ${(templateProps as { highlightActivity?: StravaActivity }).highlightActivity?.name || 'none'}`)
                    }
                }
            }
        } else if (periodTemplates.includes(templateName) && !activities) {
            // Single activity fixture - wrap in array for period templates
            templateProps.activities = [fixture]
        } else {
            // Single activity templates (Race_1p, Cover, etc.)
            templateProps.activity = fixture
        }

        // Add variant if specified
        if (variant) {
            templateProps.layoutVariant = variant
            if (verbose) {
                console.log(`[Test Harness] Using variant: ${variant}`)
            }
        }

        const pdfBuffer = await renderToBuffer(
            React.createElement(Template, templateProps)
        )

        // Save PDF
        const pdfPath = path.join(outputDir, `${templateName}-${fixtureName}.pdf`)
        fs.writeFileSync(pdfPath, pdfBuffer)
        result.pdfPath = pdfPath

        if (verbose) {
            console.log(`[Test Harness] PDF saved: ${pdfPath}`)
        }

        // Validate page dimensions
        const format = FORMATS['10x10']
        result.expectedDimensions = {
            width: format.dimensions.width,
            height: format.dimensions.height
        }
        const { dimensions, errors } = validatePageDimensions(
            pdfPath,
            format.dimensions.width,
            format.dimensions.height,
            verbose
        )
        result.pageDimensions = dimensions
        result.dimensionErrors = errors

        // Convert to images
        if (verbose) {
            console.log(`[Test Harness] Converting to images...`)
        }

        const imagePaths = pdfToImages(pdfPath, outputDir, verbose)
        result.imagePaths = imagePaths

        // Run visual judge on each page
        if (!skipJudge && imagePaths.length > 0 && imagePaths[0].endsWith('.png')) {
            if (verbose) {
                console.log(`[Test Harness] Running visual judge on ${imagePaths.length} pages...`)
            }

            for (let i = 0; i < imagePaths.length; i++) {
                const context: JudgeContext = {
                    templateName,
                    pageType: templateName,
                    pageNumber: i + 1
                }

                const judgment = await judgePageVisual(imagePaths[i], context, { verbose })
                result.judgments.push(judgment)
            }

            // Calculate overall results
            const scores = result.judgments.map(j => j.overallScore)
            result.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            result.minScore = scores.length > 0 ? Math.min(...scores) : 0
            result.overallPass = result.judgments.every(j => j.pass)
        }

        // Cleanup if not keeping artifacts
        if (!keepArtifacts) {
            fs.unlinkSync(pdfPath)
            imagePaths.forEach(p => {
                if (fs.existsSync(p)) fs.unlinkSync(p)
            })
        }

    } catch (error) {
        result.error = String(error)
        if (verbose) {
            console.error(`[Test Harness] Error:`, error)
        }
    }

    result.duration = Date.now() - startTime
    return result
}

// ============================================================================
// Batch Testing
// ============================================================================

export interface BatchTestConfig extends TestConfig {
    templates?: string[]  // Default: all
    fixtures?: string[]   // Default: all applicable
}

export async function runAllTests(config: BatchTestConfig = {}): Promise<TestResult[]> {
    const {
        templates = getAvailableTemplates(),
        fixtures = getAvailableFixtures(),
        verbose = false,
        ...testConfig
    } = config

    const results: TestResult[] = []

    // Map templates to appropriate fixtures
    // Period templates prefer year fixtures; single-activity templates use individual fixtures
    const yearFixtures = fixtures.filter(f => f.startsWith('year_'))
    const templateFixtureMap: Record<string, string[]> = {
        'Race_1p': fixtures.filter(f => f.startsWith('race_') || f.includes('training_long')),
        'Race_2p': fixtures.filter(f => f.startsWith('race_') || f.includes('training_long')),
        'Cover': ['race_ultramarathon', 'race_marathon'].filter(f => fixtures.includes(f)),
        'Foreword': ['race_marathon', 'rich_full_content'].filter(f => fixtures.includes(f)),
        'YearStats': yearFixtures.length > 0 ? yearFixtures : ['race_ultramarathon'].filter(f => fixtures.includes(f)),
        'YearCalendar': yearFixtures.length > 0 ? yearFixtures : ['race_ultramarathon'].filter(f => fixtures.includes(f)),
        'MonthlyDivider': yearFixtures.length > 0 ? yearFixtures : fixtures.filter(f => f.startsWith('race_')),
        'ActivityLog': yearFixtures.length > 0 ? yearFixtures : fixtures.filter(f => f.startsWith('training_')),
        'ActivityLog_concise': fixtures.filter(f => f.startsWith('race_') || f === 'rich_full_content'),
        'ActivityLog_full': fixtures.filter(f => f === 'rich_full_content' || f.startsWith('race_')),
        'PhotoGallery': fixtures.filter(f => f === 'rich_full_content' || f.startsWith('race_')),
        'BackCover': yearFixtures.length > 0 ? yearFixtures : ['race_ultramarathon'].filter(f => fixtures.includes(f)),
        'TableOfContents': ['toc_sections'].filter(f => fixtures.includes(f)),
        'CalendarIconView': ['calendar_views'].filter(f => fixtures.includes(f)),
        'CalendarHeatmapView': ['calendar_views'].filter(f => fixtures.includes(f)),
        'CalendarBubbleView': ['calendar_views'].filter(f => fixtures.includes(f)),
    }

    for (const template of templates) {
        const applicableFixtures = templateFixtureMap[template] || fixtures.slice(0, 3)

        for (const fixture of applicableFixtures) {
            if (verbose) {
                console.log(`\n=== Testing ${template} with ${fixture} ===`)
            }

            const result = await testTemplate(template, fixture, { verbose, ...testConfig })
            results.push(result)

            if (verbose) {
                console.log(`Result: ${result.overallPass ? 'PASS' : 'FAIL'} (avg: ${result.averageScore}, min: ${result.minScore})`)
                if (result.error) {
                    console.log(`Error: ${result.error}`)
                }
            }
        }
    }

    return results
}

// ============================================================================
// Report Generation
// ============================================================================

export function generateReport(results: TestResult[]): string {
    const lines: string[] = [
        '# Template Test Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        '',
        `- **Total Tests:** ${results.length}`,
        `- **Passed:** ${results.filter(r => r.overallPass).length}`,
        `- **Failed:** ${results.filter(r => !r.overallPass && !r.error).length}`,
        `- **Errors:** ${results.filter(r => r.error).length}`,
        `- **Average Score:** ${Math.round(results.reduce((a, r) => a + r.averageScore, 0) / results.length)}`,
        `- **Min Score:** ${Math.min(...results.map(r => r.minScore || r.averageScore))}`,
        '',
        '## Results',
        ''
    ]

    for (const result of results) {
        const status = result.error ? '❌ ERROR' : result.overallPass ? '✅ PASS' : '⚠️ FAIL'

        lines.push(`### ${result.templateName} + ${result.fixtureName}`)
        lines.push(`- **Status:** ${status}`)
        lines.push(`- **Score:** avg ${result.averageScore}/100, min ${result.minScore}/100`)
        lines.push(`- **Duration:** ${result.duration}ms`)

        if (result.error) {
            lines.push(`- **Error:** ${result.error}`)
        }

        if (result.judgments.length > 0) {
            lines.push('')
            lines.push('**Feedback:**')
            for (const j of result.judgments) {
                lines.push(`- ${j.summary}`)
                for (const s of j.suggestions.slice(0, 3)) {
                    lines.push(`  - ${s}`)
                }
            }
        }

        lines.push('')
    }

    return lines.join('\n')
}

// ============================================================================
// CLI Interface
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2)

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Template Test Harness

Usage:
  npx ts-node test-harness.ts [options]

Options:
  --template <name>    Test specific template
  --fixture <name>     Use specific fixture
  --variant <name>     Force specific layout variant (e.g., photo-hero, map-hero)
  --list               List available templates and fixtures
  --verbose            Show detailed output
  --skip-judge         Generate PDF only, skip visual evaluation
  --all                Run all template/fixture combinations

Examples:
  npx ts-node test-harness.ts --template Race_1p --fixture race_marathon --verbose
  npx ts-node test-harness.ts --template Race_1p --fixture race_ultramarathon --variant map-hero --verbose
  npx ts-node test-harness.ts --all --verbose
  npx ts-node test-harness.ts --list
        `)
        process.exit(0)
    }

    if (args.includes('--list')) {
        console.log('Available Templates:', getAvailableTemplates().join(', '))
        console.log('Available Fixtures:', getAvailableFixtures().join(', '))
        process.exit(0)
    }

    const verbose = args.includes('--verbose')
    const skipJudge = args.includes('--skip-judge')

    const templateIdx = args.indexOf('--template')
    const fixtureIdx = args.indexOf('--fixture')
    const variantIdx = args.indexOf('--variant')
    const variant = variantIdx >= 0 ? args[variantIdx + 1] : undefined

    if (args.includes('--all')) {
        runAllTests({ verbose, skipJudge })
            .then(results => {
                const report = generateReport(results)
                console.log('\n' + report)

                // Save report
                const reportPath = path.join(__dirname, '../../..', 'test-output', 'report.md')
                fs.writeFileSync(reportPath, report)
                console.log(`Report saved to: ${reportPath}`)

                const allPassed = results.every(r => r.overallPass || r.error)
                process.exit(allPassed ? 0 : 1)
            })
            .catch(err => {
                console.error('Error:', err)
                process.exit(1)
            })
    } else if (templateIdx >= 0 && fixtureIdx >= 0) {
        const template = args[templateIdx + 1]
        const fixture = args[fixtureIdx + 1]

        testTemplate(template, fixture, { verbose, skipJudge, variant })
            .then(result => {
                console.log('\n=== Result ===')
                console.log(JSON.stringify(result, null, 2))
                process.exit(result.overallPass ? 0 : 1)
            })
            .catch(err => {
                console.error('Error:', err)
                process.exit(1)
            })
    } else {
        console.log('Specify --template and --fixture, or use --all. See --help for usage.')
        process.exit(1)
    }
}
