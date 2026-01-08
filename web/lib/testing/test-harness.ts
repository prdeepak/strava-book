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

// ============================================================================
// Types
// ============================================================================

export interface TestResult {
    templateName: string
    fixtureName: string
    pdfPath: string
    imagePaths: string[]
    judgments: VisualJudgment[]
    overallPass: boolean
    averageScore: number
    duration: number  // ms
    error?: string
}

export interface TestConfig {
    outputDir?: string
    runId?: string       // Subfolder name for this run (auto-generated if not provided)
    keepArtifacts?: boolean
    verbose?: boolean
    skipJudge?: boolean  // Just generate PDF, don't evaluate
}

/**
 * Generate a run ID for organizing test artifacts
 * Format: YYYYMMDD-HHMMSS (e.g., 20250108-143052)
 */
export function generateRunId(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
    return `${date}-${time}`
}

/**
 * Get the output directory for a test run
 * Creates a subfolder within test-output for each run
 */
export function getRunOutputDir(baseDir: string, runId: string): string {
    return path.join(baseDir, runId)
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

// ============================================================================
// Template Registry & Props Building
// ============================================================================

import { FORMATS, DEFAULT_THEME, YearSummary, MonthlyStats } from '../../lib/book-types'
import { StravaActivity } from '../../lib/strava'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateComponent = React.ComponentType<any>

// Template categories determine what props they need
type TemplateCategory = 'race' | 'cover' | 'yearStats' | 'yearCalendar' | 'monthlyDivider' | 'activityLog' | 'backCover'

const templateCategories: Record<string, TemplateCategory> = {
    'Race_1p': 'race',
    'Race_2p': 'race',
    'Cover': 'cover',
    'YearStats': 'yearStats',
    'YearCalendar': 'yearCalendar',
    'MonthlyDivider': 'monthlyDivider',
    'ActivityLog': 'activityLog',
    'BackCover': 'backCover',
}

/**
 * Build mock YearSummary from a single activity fixture (for testing)
 */
function buildMockYearSummary(activity: StravaActivity): YearSummary {
    const activityDate = new Date(activity.start_date)
    const month = activityDate.getMonth()
    const year = activityDate.getFullYear()

    const monthlyStats: MonthlyStats = {
        month,
        year,
        activityCount: 1,
        totalDistance: activity.distance || 0,
        totalTime: activity.moving_time || 0,
        totalElevation: activity.total_elevation_gain || 0,
        activeDays: 1,
        activities: [activity],
    }

    return {
        year,
        totalDistance: activity.distance || 0,
        totalTime: activity.moving_time || 0,
        totalElevation: activity.total_elevation_gain || 0,
        activityCount: 1,
        longestActivity: activity,
        fastestActivity: activity,
        activeDays: new Set([activity.start_date.split('T')[0]]),
        monthlyStats: [monthlyStats],
        races: activity.workout_type === 1 ? [activity] : [],
        aRace: activity.workout_type === 1 ? activity : undefined,
    }
}

/**
 * Build props appropriate for the template category
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTemplateProps(templateName: string, fixture: any): Record<string, unknown> {
    const category = templateCategories[templateName] || 'race'
    const format = FORMATS['10x10']
    const theme = DEFAULT_THEME

    switch (category) {
        case 'race':
            return { activity: fixture, format, theme }

        case 'cover': {
            const year = new Date(fixture.start_date).getFullYear()
            return {
                title: `${year} Running`,
                subtitle: 'A Year in Motion',
                year,
                athleteName: fixture.athlete?.firstname || 'Athlete',
                backgroundImage: fixture.photos?.primary?.urls?.['600'],
                format,
                theme,
            }
        }

        case 'yearStats':
            return {
                yearSummary: buildMockYearSummary(fixture),
                format,
                theme,
            }

        case 'yearCalendar':
            return {
                yearSummary: buildMockYearSummary(fixture),
                format,
                theme,
            }

        case 'monthlyDivider': {
            const date = new Date(fixture.start_date)
            return {
                month: date.getMonth(),
                year: date.getFullYear(),
                stats: {
                    activityCount: 1,
                    totalDistance: fixture.distance || 0,
                    totalTime: fixture.moving_time || 0,
                    totalElevation: fixture.total_elevation_gain || 0,
                },
                heroImage: fixture.photos?.primary?.urls?.['600'],
                format,
                theme,
            }
        }

        case 'activityLog':
            return {
                activities: [fixture],
                format,
                theme,
            }

        case 'backCover':
            return {
                yearSummary: buildMockYearSummary(fixture),
                format,
                theme,
            }

        default:
            return { activity: fixture, format, theme }
    }
}

const templateRegistry: Record<string, () => Promise<TemplateComponent>> = {
    // Race templates
    'Race_1p': async () => {
        const mod = await import('../../components/templates/Race_1p')
        return mod.Race_1p as TemplateComponent
    },
    'Race_2p': async () => {
        const mod = await import('../../components/templates/Race_2p')
        return mod.Race_2pSpread as TemplateComponent
    },

    // Other templates - add as needed
    'Cover': async () => {
        const mod = await import('../../components/templates/Cover')
        return mod.Cover as TemplateComponent
    },
    'YearStats': async () => {
        const mod = await import('../../components/templates/YearStats')
        return mod.YearStats as TemplateComponent
    },
    'YearCalendar': async () => {
        const mod = await import('../../components/templates/YearCalendar')
        return mod.YearCalendar as TemplateComponent
    },
    'MonthlyDivider': async () => {
        const mod = await import('../../components/templates/MonthlyDivider')
        return mod.MonthlyDivider as TemplateComponent
    },
    'ActivityLog': async () => {
        const mod = await import('../../components/templates/ActivityLog')
        return mod.ActivityLog as TemplateComponent
    },
    'BackCover': async () => {
        const mod = await import('../../components/templates/BackCover')
        return mod.BackCover as TemplateComponent
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

    // Resolve relative photo paths to absolute paths
    const json = JSON.stringify(fixture)
    const resolved = json.replace(/"(photos\/[^"]+)"/g, (_match, relativePath) => {
        const absolutePath = path.join(fixturesDir, relativePath)
        return `"${absolutePath}"`
    })

    return JSON.parse(resolved)
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
        outputDir: baseOutputDir = path.join(__dirname, '../../..', 'test-output'),
        runId = generateRunId(),
        keepArtifacts = true,
        verbose = false,
        skipJudge = false
    } = config

    // Create run-specific output directory
    const outputDir = getRunOutputDir(baseOutputDir, runId)
    fs.mkdirSync(outputDir, { recursive: true })

    if (verbose) {
        console.log(`[Test Harness] Output directory: ${outputDir}`)
    }

    const result: TestResult = {
        templateName,
        fixtureName,
        pdfPath: '',
        imagePaths: [],
        judgments: [],
        overallPass: false,
        averageScore: 0,
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

        const fixture = loadFixture(fixtureName) as StravaActivity

        // Build appropriate props for this template type
        const props = buildTemplateProps(templateName, fixture)

        // Render PDF
        if (verbose) {
            console.log(`[Test Harness] Rendering PDF...`)
        }

        const pdfBuffer = await renderToBuffer(
            React.createElement(Template, props)
        )

        // Save PDF
        const pdfPath = path.join(outputDir, `${templateName}-${fixtureName}.pdf`)
        fs.writeFileSync(pdfPath, pdfBuffer)
        result.pdfPath = pdfPath

        if (verbose) {
            console.log(`[Test Harness] PDF saved: ${pdfPath}`)
        }

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

export async function runAllTests(config: BatchTestConfig = {}): Promise<{ results: TestResult[], runId: string, outputDir: string }> {
    const {
        templates = getAvailableTemplates(),
        fixtures = getAvailableFixtures(),
        verbose = false,
        ...testConfig
    } = config

    // Generate a single runId for the entire batch
    const runId = testConfig.runId || generateRunId()
    const baseOutputDir = testConfig.outputDir || path.join(__dirname, '../../..', 'test-output')
    const outputDir = getRunOutputDir(baseOutputDir, runId)
    fs.mkdirSync(outputDir, { recursive: true })

    if (verbose) {
        console.log(`[Test Harness] Run ID: ${runId}`)
        console.log(`[Test Harness] Output directory: ${outputDir}`)
    }

    const results: TestResult[] = []

    // Map templates to appropriate fixtures
    const templateFixtureMap: Record<string, string[]> = {
        'Race_1p': fixtures.filter(f => f.startsWith('race_') || f.includes('training_long')),
        'Race_2p': fixtures.filter(f => f.startsWith('race_') || f.includes('training_long')),
        'Cover': ['race_ultramarathon', 'race_marathon'].filter(f => fixtures.includes(f)),
        'YearStats': ['race_ultramarathon'].filter(f => fixtures.includes(f)),  // Needs year data
        'YearCalendar': ['race_ultramarathon'].filter(f => fixtures.includes(f)),
        'MonthlyDivider': fixtures.filter(f => f.startsWith('race_') || f.startsWith('training_')),
        'ActivityLog': fixtures.filter(f => f.startsWith('training_') || f.startsWith('other_')),
        'BackCover': ['race_ultramarathon'].filter(f => fixtures.includes(f)),
    }

    for (const template of templates) {
        const applicableFixtures = templateFixtureMap[template] || fixtures.slice(0, 3)

        for (const fixture of applicableFixtures) {
            if (verbose) {
                console.log(`\n=== Testing ${template} with ${fixture} ===`)
            }

            // Pass the same runId so all artifacts go to the same folder
            const result = await testTemplate(template, fixture, {
                verbose,
                ...testConfig,
                runId,
                outputDir: baseOutputDir
            })
            results.push(result)

            if (verbose) {
                console.log(`Result: ${result.overallPass ? 'PASS' : 'FAIL'} (score: ${result.averageScore})`)
                if (result.error) {
                    console.log(`Error: ${result.error}`)
                }
            }
        }
    }

    return { results, runId, outputDir }
}

// ============================================================================
// Book-Level Testing
// ============================================================================

import { judgeBook, BookJudgment, BookContext } from './visual-judge'

export interface BookTestResult {
    bookName: string
    pdfPath: string
    imagePaths: string[]
    pageCount: number
    bookJudgment?: BookJudgment
    pageJudgments: VisualJudgment[]
    overallPass: boolean
    overallScore: number
    duration: number
    error?: string
}

export interface BookTestConfig extends TestConfig {
    bookTitle?: string
    year?: number
    theme?: {
        primaryColor: string
        accentColor: string
        backgroundColor: string
    }
    runBookJudge?: boolean  // Run book-level coherence evaluation
    maxPagesToJudge?: number  // Limit individual page judging
}

/**
 * Test a complete book PDF (not just individual templates)
 * This evaluates both individual pages and book-level coherence
 */
export async function testBook(
    pdfPath: string,
    config: BookTestConfig = {}
): Promise<BookTestResult> {
    const startTime = Date.now()
    const {
        outputDir: baseOutputDir = path.join(__dirname, '../../..', 'test-output'),
        runId = generateRunId(),
        keepArtifacts = true,
        verbose = false,
        skipJudge = false,
        bookTitle = 'Test Book',
        year = new Date().getFullYear(),
        theme,
        runBookJudge = true,
        maxPagesToJudge = 5
    } = config

    const outputDir = getRunOutputDir(baseOutputDir, runId)
    fs.mkdirSync(outputDir, { recursive: true })

    const bookName = path.basename(pdfPath, '.pdf')

    const result: BookTestResult = {
        bookName,
        pdfPath,
        imagePaths: [],
        pageCount: 0,
        pageJudgments: [],
        overallPass: false,
        overallScore: 0,
        duration: 0
    }

    try {
        if (verbose) {
            console.log(`[Book Test] Testing book: ${pdfPath}`)
        }

        // Convert PDF to images
        const imagePaths = pdfToImages(pdfPath, outputDir, verbose)
        result.imagePaths = imagePaths
        result.pageCount = imagePaths.filter(p => p.endsWith('.png')).length

        if (result.pageCount === 0) {
            throw new Error('No page images generated from PDF')
        }

        if (verbose) {
            console.log(`[Book Test] Generated ${result.pageCount} page images`)
        }

        if (!skipJudge && imagePaths.length > 0 && imagePaths[0].endsWith('.png')) {
            // Run book-level judgment if enabled
            if (runBookJudge) {
                if (verbose) {
                    console.log('[Book Test] Running book-level evaluation...')
                }

                const bookContext: BookContext = {
                    bookTitle,
                    year,
                    pageCount: result.pageCount,
                    theme
                }

                result.bookJudgment = await judgeBook(imagePaths, bookContext, { verbose })

                if (verbose) {
                    console.log(`[Book Test] Book score: ${result.bookJudgment.overallScore}`)
                }
            }

            // Run individual page judgments on sample pages
            const pagesToJudge = imagePaths.slice(0, maxPagesToJudge)

            if (verbose) {
                console.log(`[Book Test] Judging ${pagesToJudge.length} sample pages...`)
            }

            for (let i = 0; i < pagesToJudge.length; i++) {
                const context: JudgeContext = {
                    templateName: bookName,
                    pageType: i === 0 ? 'Cover' : i === pagesToJudge.length - 1 ? 'BackCover' : 'Content',
                    pageNumber: i + 1
                }

                const judgment = await judgePageVisual(pagesToJudge[i], context, { verbose: false })
                result.pageJudgments.push(judgment)
            }
        }

        // Calculate overall results
        const scores: number[] = []

        if (result.bookJudgment) {
            scores.push(result.bookJudgment.overallScore)
        }

        if (result.pageJudgments.length > 0) {
            const avgPageScore = result.pageJudgments.reduce((sum, j) => sum + j.overallScore, 0) / result.pageJudgments.length
            scores.push(avgPageScore)
        }

        result.overallScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0

        result.overallPass = result.overallScore >= 70 &&
            (!result.bookJudgment || result.bookJudgment.pass) &&
            result.pageJudgments.every(j => j.pass || j.overallScore >= 50)

        // Cleanup if not keeping artifacts
        if (!keepArtifacts) {
            imagePaths.forEach(p => {
                if (fs.existsSync(p)) fs.unlinkSync(p)
            })
        }

    } catch (error) {
        result.error = String(error)
        if (verbose) {
            console.error(`[Book Test] Error:`, error)
        }
    }

    result.duration = Date.now() - startTime
    return result
}

/**
 * Generate a report for book test results
 */
export function generateBookReport(result: BookTestResult): string {
    const lines: string[] = [
        '# Book Test Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        '',
        `- **Book:** ${result.bookName}`,
        `- **Status:** ${result.overallPass ? 'PASS' : 'FAIL'}`,
        `- **Overall Score:** ${result.overallScore}/100`,
        `- **Page Count:** ${result.pageCount}`,
        `- **Duration:** ${result.duration}ms`,
        ''
    ]

    if (result.error) {
        lines.push(`**Error:** ${result.error}`)
        lines.push('')
    }

    if (result.bookJudgment) {
        lines.push('## Book-Level Evaluation')
        lines.push('')
        lines.push(`- **Coherence:** ${result.bookJudgment.coherence.score}/100`)
        if (result.bookJudgment.coherence.issues.length > 0) {
            result.bookJudgment.coherence.issues.forEach(issue => {
                lines.push(`  - ${issue}`)
            })
        }
        lines.push(`- **Flow:** ${result.bookJudgment.flow.score}/100`)
        if (result.bookJudgment.flow.issues.length > 0) {
            result.bookJudgment.flow.issues.forEach(issue => {
                lines.push(`  - ${issue}`)
            })
        }
        lines.push(`- **Coverage:** ${result.bookJudgment.coverage.score}/100`)
        if (result.bookJudgment.coverage.issues.length > 0) {
            result.bookJudgment.coverage.issues.forEach(issue => {
                lines.push(`  - ${issue}`)
            })
        }
        lines.push('')
        lines.push(`**Summary:** ${result.bookJudgment.summary}`)
        lines.push('')
        if (result.bookJudgment.suggestions.length > 0) {
            lines.push('**Suggestions:**')
            result.bookJudgment.suggestions.forEach(s => {
                lines.push(`- ${s}`)
            })
            lines.push('')
        }
    }

    if (result.pageJudgments.length > 0) {
        lines.push('## Page-Level Evaluation (Sample)')
        lines.push('')
        result.pageJudgments.forEach((j, i) => {
            const status = j.pass ? 'PASS' : 'FAIL'
            lines.push(`### Page ${i + 1}: ${status} (${j.overallScore}/100)`)
            lines.push(j.summary)
            if (j.suggestions.length > 0) {
                lines.push('')
                j.suggestions.slice(0, 2).forEach(s => {
                    lines.push(`- ${s}`)
                })
            }
            lines.push('')
        })
    }

    return lines.join('\n')
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
        '',
        '## Results',
        ''
    ]

    for (const result of results) {
        const status = result.error ? '❌ ERROR' : result.overallPass ? '✅ PASS' : '⚠️ FAIL'

        lines.push(`### ${result.templateName} + ${result.fixtureName}`)
        lines.push(`- **Status:** ${status}`)
        lines.push(`- **Score:** ${result.averageScore}/100`)
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
  --list               List available templates and fixtures
  --verbose            Show detailed output
  --skip-judge         Generate PDF only, skip visual evaluation
  --all                Run all template/fixture combinations

Examples:
  npx ts-node test-harness.ts --template Race_1p --fixture race_marathon --verbose
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

    if (args.includes('--all')) {
        runAllTests({ verbose, skipJudge })
            .then(({ results, runId, outputDir }) => {
                const report = generateReport(results)
                console.log('\n' + report)

                // Save report to run-specific directory
                const reportPath = path.join(outputDir, 'report.md')
                fs.writeFileSync(reportPath, report)
                console.log(`\nRun ID: ${runId}`)
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

        testTemplate(template, fixture, { verbose, skipJudge })
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
