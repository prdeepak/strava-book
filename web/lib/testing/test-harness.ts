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
    keepArtifacts?: boolean
    verbose?: boolean
    skipJudge?: boolean  // Just generate PDF, don't evaluate
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
// Template Registry
// ============================================================================

type TemplateComponent = React.ComponentType<{ activity: unknown; format?: unknown; theme?: unknown }>

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
        outputDir = path.join(__dirname, '../../..', 'test-output'),
        keepArtifacts = true,
        verbose = false,
        skipJudge = false
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

        const pdfBuffer = await renderToBuffer(
            React.createElement(Template, {
                activity: fixture,
                format: FORMATS['10x10'],
                theme: DEFAULT_THEME
            })
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

export async function runAllTests(config: BatchTestConfig = {}): Promise<TestResult[]> {
    const {
        templates = getAvailableTemplates(),
        fixtures = getAvailableFixtures(),
        verbose = false,
        ...testConfig
    } = config

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

            const result = await testTemplate(template, fixture, { verbose, ...testConfig })
            results.push(result)

            if (verbose) {
                console.log(`Result: ${result.overallPass ? 'PASS' : 'FAIL'} (score: ${result.averageScore})`)
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
