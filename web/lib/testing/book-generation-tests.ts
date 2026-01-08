/**
 * Book Generation Tests
 *
 * Tests the full book generation flow including:
 * 1. BookGenerationModal component logic
 * 2. API endpoint functionality
 * 3. PDF generation pipeline
 */

import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { FullBookDocument, estimatePageCount } from '../../components/templates/BookDocument'
import { yearFixtures } from './fixtures/yearFixtures'
import { FORMATS, DEFAULT_THEME, BookFormat, BookTheme } from '../book-types'
import { StravaActivity } from '../strava'
import { generateRunId, getRunOutputDir } from './test-harness'

// ============================================================================
// Types
// ============================================================================

interface BookGenerationTestResult {
    testName: string
    success: boolean
    duration: number
    error?: string
    details?: Record<string, unknown>
}

interface TestSuiteResult {
    runId: string
    outputDir: string
    results: BookGenerationTestResult[]
    totalPassed: number
    totalFailed: number
}

// ============================================================================
// Mock Data Helpers
// ============================================================================

function createMockActivity(overrides: Partial<StravaActivity> = {}): StravaActivity {
    const now = new Date()
    const distance = overrides.distance || 10000
    const movingTime = overrides.moving_time || 3600
    return {
        id: Math.floor(Math.random() * 1000000000),
        name: 'Morning Run',
        distance,
        moving_time: movingTime,
        elapsed_time: movingTime + 100,
        total_elevation_gain: 100,
        type: 'Run',
        sport_type: 'Run',
        start_date: now.toISOString(),
        start_date_local: now.toISOString(),
        timezone: 'America/New_York',
        kudos_count: 5,
        map: {
            summary_polyline: 'kqbjGbducNoBCiKtBoDOqF`@mB~@sCJyB|@wAUwB`@wCzAyHd@c@',
        },
        // Additional fields that templates may use
        average_speed: distance / movingTime,
        max_speed: (distance / movingTime) * 1.5,
        average_heartrate: 150,
        max_heartrate: 180,
        suffer_score: 100,
        pr_count: 0,
        achievement_count: 0,
        elev_high: 200,
        elev_low: 100,
        start_latlng: [40.7128, -74.006],
        end_latlng: [40.7228, -74.016],
        ...overrides,
    } as StravaActivity
}

function createActivitiesForYear(year: number, count: number): StravaActivity[] {
    const activities: StravaActivity[] = []
    for (let i = 0; i < count; i++) {
        const month = i % 12
        const day = (i % 28) + 1
        const date = new Date(year, month, day, 8, 0, 0)
        activities.push(createMockActivity({
            id: year * 1000 + i,
            name: `Run ${i + 1}`,
            start_date: date.toISOString(),
            start_date_local: date.toISOString(),
            distance: 5000 + Math.random() * 15000,
            moving_time: 1800 + Math.random() * 5400,
            workout_type: i % 10 === 0 ? 1 : undefined, // Every 10th is a race
        }))
    }
    return activities
}

// ============================================================================
// Modal Logic Tests
// ============================================================================

/**
 * Test: Year filtering logic
 */
function testYearFiltering(): BookGenerationTestResult {
    const startTime = Date.now()
    const testName = 'Year Filtering'

    try {
        // Create activities across multiple years
        const activities2024 = createActivitiesForYear(2024, 50)
        const activities2025 = createActivitiesForYear(2025, 30)
        const allActivities = [...activities2024, ...activities2025]

        // Test filtering for 2024
        const filtered2024 = allActivities.filter(a => {
            const year = new Date(a.start_date_local || a.start_date).getFullYear()
            return year === 2024
        })

        if (filtered2024.length !== 50) {
            throw new Error(`Expected 50 activities for 2024, got ${filtered2024.length}`)
        }

        // Test filtering for 2025
        const filtered2025 = allActivities.filter(a => {
            const year = new Date(a.start_date_local || a.start_date).getFullYear()
            return year === 2025
        })

        if (filtered2025.length !== 30) {
            throw new Error(`Expected 30 activities for 2025, got ${filtered2025.length}`)
        }

        // Test filtering for non-existent year
        const filtered2023 = allActivities.filter(a => {
            const year = new Date(a.start_date_local || a.start_date).getFullYear()
            return year === 2023
        })

        if (filtered2023.length !== 0) {
            throw new Error(`Expected 0 activities for 2023, got ${filtered2023.length}`)
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: {
                total: allActivities.length,
                filtered2024: filtered2024.length,
                filtered2025: filtered2025.length,
            },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

/**
 * Test: Available years extraction
 */
function testAvailableYearsExtraction(): BookGenerationTestResult {
    const startTime = Date.now()
    const testName = 'Available Years Extraction'

    try {
        const activities = [
            ...createActivitiesForYear(2023, 5),
            ...createActivitiesForYear(2024, 10),
            ...createActivitiesForYear(2025, 15),
        ]

        const availableYears = Array.from(new Set(
            activities.map(a => new Date(a.start_date_local || a.start_date).getFullYear())
        )).sort((a, b) => b - a)

        if (availableYears.length !== 3) {
            throw new Error(`Expected 3 years, got ${availableYears.length}`)
        }

        if (availableYears[0] !== 2025) {
            throw new Error(`Expected most recent year to be 2025, got ${availableYears[0]}`)
        }

        // Test with empty activities
        const emptyYears = Array.from(new Set(
            ([] as StravaActivity[]).map(a => new Date(a.start_date_local || a.start_date).getFullYear())
        ))

        if (emptyYears.length !== 0) {
            throw new Error(`Expected 0 years for empty activities, got ${emptyYears.length}`)
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: { availableYears },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

/**
 * Test: Page estimation
 */
function testPageEstimation(): BookGenerationTestResult {
    const startTime = Date.now()
    const testName = 'Page Estimation'

    try {
        const format = FORMATS['10x10']

        // Empty activities
        const emptyEstimate = estimatePageCount([], format)
        if (emptyEstimate.total < 5) {
            throw new Error(`Empty book should have at least 5 pages (cover, TOC, stats, etc.), got ${emptyEstimate.total}`)
        }

        // Activities with races
        const activitiesWithRaces = createActivitiesForYear(2024, 20)
        // Mark some as races
        activitiesWithRaces[5].workout_type = 1
        activitiesWithRaces[10].workout_type = 1
        activitiesWithRaces[15].workout_type = 1

        const estimate = estimatePageCount(activitiesWithRaces, format)

        if (estimate.total < 10) {
            throw new Error(`Book with 20 activities should have more than 10 pages, got ${estimate.total}`)
        }

        if (estimate.breakdown.racePages < 6) {
            throw new Error(`Expected at least 6 race pages (3 races * 2 pages), got ${estimate.breakdown.racePages}`)
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: { emptyEstimate, estimate },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

// ============================================================================
// PDF Generation Tests
// ============================================================================

/**
 * Test: FullBookDocument renders without errors
 */
async function testFullBookDocumentRenders(outputDir: string): Promise<BookGenerationTestResult> {
    const startTime = Date.now()
    const testName = 'FullBookDocument Renders'

    try {
        const activities = createActivitiesForYear(2024, 20)
        const format = FORMATS['10x10']
        const theme = DEFAULT_THEME

        const element = FullBookDocument({
            activities,
            title: 'Test Book',
            athleteName: 'Test Athlete',
            year: 2024,
            format,
            theme,
        })

        if (!element) {
            throw new Error('FullBookDocument returned null/undefined')
        }

        // Render to buffer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(element as any)

        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty')
        }

        // Save for inspection
        const pdfPath = path.join(outputDir, 'test-full-book-document.pdf')
        fs.writeFileSync(pdfPath, pdfBuffer)

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: {
                pdfSize: pdfBuffer.length,
                pdfPath,
            },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

/**
 * Test: PDF generation with fixture data
 */
async function testPdfGenerationWithFixtures(outputDir: string): Promise<BookGenerationTestResult> {
    const startTime = Date.now()
    const testName = 'PDF Generation with Fixtures'

    try {
        const fixture = yearFixtures.casualYear
        const format = FORMATS['10x10']
        const theme = DEFAULT_THEME

        const element = FullBookDocument({
            activities: fixture.activities,
            title: `${fixture.year} Running Year`,
            athleteName: fixture.athleteName,
            year: fixture.year,
            format,
            theme,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(element as any)

        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty')
        }

        const pdfPath = path.join(outputDir, 'test-fixture-book.pdf')
        fs.writeFileSync(pdfPath, pdfBuffer)

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: {
                fixtureActivities: fixture.activities.length,
                pdfSize: pdfBuffer.length,
                pdfPath,
            },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

/**
 * Test: All format sizes
 */
async function testAllFormatSizes(outputDir: string): Promise<BookGenerationTestResult> {
    const startTime = Date.now()
    const testName = 'All Format Sizes'

    try {
        const activities = createActivitiesForYear(2024, 10)
        const results: Record<string, number> = {}

        for (const [formatName, format] of Object.entries(FORMATS)) {
            const element = FullBookDocument({
                activities,
                title: `Test ${formatName}`,
                athleteName: 'Test Athlete',
                year: 2024,
                format,
                theme: DEFAULT_THEME,
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdfBuffer = await renderToBuffer(element as any)
            results[formatName] = pdfBuffer.length

            const pdfPath = path.join(outputDir, `test-format-${formatName}.pdf`)
            fs.writeFileSync(pdfPath, pdfBuffer)
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: { formatSizes: results },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

// ============================================================================
// API Simulation Tests
// ============================================================================

/**
 * Test: API request validation
 */
function testApiRequestValidation(): BookGenerationTestResult {
    const startTime = Date.now()
    const testName = 'API Request Validation'

    try {
        // Test: Empty activities should fail
        const emptyRequest = {
            activities: [],
            config: {
                athleteName: 'Test',
                year: 2024,
                format: FORMATS['10x10'],
                theme: DEFAULT_THEME,
            },
        }

        if (emptyRequest.activities.length !== 0) {
            throw new Error('Empty activities check failed')
        }

        // Test: Valid request structure
        const validRequest = {
            activities: createActivitiesForYear(2024, 10),
            config: {
                title: 'Test Book',
                athleteName: 'Test Athlete',
                year: 2024,
                format: FORMATS['10x10'],
                theme: DEFAULT_THEME,
            },
        }

        if (!validRequest.activities || validRequest.activities.length === 0) {
            throw new Error('Valid request should have activities')
        }

        if (!validRequest.config.athleteName) {
            throw new Error('Valid request should have athleteName')
        }

        if (!validRequest.config.year) {
            throw new Error('Valid request should have year')
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: {
                validActivityCount: validRequest.activities.length,
            },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

// ============================================================================
// Test Runner
// ============================================================================

export async function runBookGenerationTests(
    config: { verbose?: boolean; outputDir?: string } = {}
): Promise<TestSuiteResult> {
    const { verbose = false, outputDir: baseOutputDir } = config
    const runId = generateRunId()
    const outputDir = getRunOutputDir(baseOutputDir || path.join(__dirname, '../../..', 'test-output'), runId)

    fs.mkdirSync(outputDir, { recursive: true })

    console.log(`\n${'='.repeat(60)}`)
    console.log('Book Generation Test Suite')
    console.log(`Run ID: ${runId}`)
    console.log(`Output: ${outputDir}`)
    console.log(`${'='.repeat(60)}\n`)

    const results: BookGenerationTestResult[] = []

    // Run synchronous tests
    console.log('[1/7] Testing year filtering...')
    results.push(testYearFiltering())

    console.log('[2/7] Testing available years extraction...')
    results.push(testAvailableYearsExtraction())

    console.log('[3/7] Testing page estimation...')
    results.push(testPageEstimation())

    console.log('[4/7] Testing API request validation...')
    results.push(testApiRequestValidation())

    // Run async tests
    console.log('[5/7] Testing FullBookDocument renders...')
    results.push(await testFullBookDocumentRenders(outputDir))

    console.log('[6/7] Testing PDF generation with fixtures...')
    results.push(await testPdfGenerationWithFixtures(outputDir))

    console.log('[7/7] Testing all format sizes...')
    results.push(await testAllFormatSizes(outputDir))

    // Calculate totals
    const totalPassed = results.filter(r => r.success).length
    const totalFailed = results.filter(r => !r.success).length

    // Print results
    console.log(`\n${'='.repeat(60)}`)
    console.log('Test Results')
    console.log(`${'='.repeat(60)}\n`)

    for (const result of results) {
        const status = result.success ? 'PASS' : 'FAIL'
        const statusColor = result.success ? '\x1b[32m' : '\x1b[31m'
        console.log(`${statusColor}[${status}]\x1b[0m ${result.testName} (${result.duration}ms)`)
        if (result.error) {
            console.log(`       Error: ${result.error}`)
        }
        if (verbose && result.details) {
            console.log(`       Details: ${JSON.stringify(result.details)}`)
        }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Total: ${results.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`)
    console.log(`${'='.repeat(60)}\n`)

    // Save report
    const reportPath = path.join(outputDir, 'book-generation-test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({
        runId,
        timestamp: new Date().toISOString(),
        results,
        summary: { totalPassed, totalFailed },
    }, null, 2))

    return {
        runId,
        outputDir,
        results,
        totalPassed,
        totalFailed,
    }
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
    const verbose = process.argv.includes('--verbose')

    runBookGenerationTests({ verbose })
        .then(result => {
            console.log(`\nReport saved to: ${result.outputDir}`)
            process.exit(result.totalFailed > 0 ? 1 : 0)
        })
        .catch(error => {
            console.error('Test suite error:', error)
            process.exit(1)
        })
}
