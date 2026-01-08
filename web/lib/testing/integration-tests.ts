/**
 * Integration Tests for BookDocument
 *
 * Tests full book generation end-to-end using year fixtures.
 * Verifies that:
 * 1. BookDocument renders without errors
 * 2. PDF generates successfully
 * 3. Page count is reasonable
 * 4. Optionally runs visual judge on sample pages
 */

import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { BookDocument } from '../../components/templates/BookDocument'
import { generateSmartDraft } from '../curator'
import { yearFixtures, YearFixture } from './fixtures/yearFixtures'
import { FORMATS, DEFAULT_THEME } from '../book-types'
import { pdfToImages, TestResult } from './test-harness'
import { judgePageVisual, JudgeContext } from './visual-judge'

// ============================================================================
// Types
// ============================================================================

export interface IntegrationTestResult {
  fixtureName: string
  success: boolean
  pdfPath?: string
  pageCount?: number
  fileSizeKB?: number
  duration: number  // ms
  error?: string
  warnings: string[]
  visualJudgments?: Array<{
    pageNumber: number
    score: number
    pass: boolean
    summary: string
  }>
}

export interface IntegrationTestConfig {
  outputDir?: string
  skipVisualJudge?: boolean
  maxPagesToJudge?: number  // Limit visual judge to first N pages
  verbose?: boolean
}

// ============================================================================
// Core Test Functions
// ============================================================================

/**
 * Test book generation with a year fixture
 */
export async function testBookGeneration(
  fixtureName: string,
  fixture: YearFixture,
  config: IntegrationTestConfig = {}
): Promise<IntegrationTestResult> {
  const startTime = Date.now()
  const {
    outputDir = path.join(__dirname, '../../..', 'test-output'),
    skipVisualJudge = false,
    maxPagesToJudge = 3,
    verbose = false
  } = config

  const result: IntegrationTestResult = {
    fixtureName,
    success: false,
    duration: 0,
    warnings: []
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true })

  try {
    if (verbose) {
      console.log(`\n=== Testing ${fixtureName} ===`)
      console.log(`Activities: ${fixture.activities.length}`)
      console.log(`Year: ${fixture.year}`)
      console.log(`Description: ${fixture.description}`)
    }

    // Step 1: Generate book entries using smart draft
    if (verbose) {
      console.log('\n[1/4] Generating book structure...')
    }

    const entries = generateSmartDraft(fixture.activities)

    if (verbose) {
      console.log(`Generated ${entries.length} book entries`)
      const entryCounts: Record<string, number> = {}
      entries.forEach(e => {
        entryCounts[e.type] = (entryCounts[e.type] || 0) + 1
      })
      console.log('Entry types:', entryCounts)
    }

    // Validate entries
    if (entries.length < 3) {
      result.warnings.push(`Low entry count: ${entries.length} (expected at least 3)`)
    }

    // Step 2: Render BookDocument to PDF
    if (verbose) {
      console.log('\n[2/4] Rendering PDF...')
    }

    const format = FORMATS['10x10']
    const theme = DEFAULT_THEME

    const pdfBuffer = await renderToBuffer(
      React.createElement(BookDocument, {
        entries,
        activities: fixture.activities,
        format,
        theme,
        athleteName: fixture.athleteName,
        year: fixture.year,
        yearSummary: fixture.yearSummary
      })
    )

    // Save PDF
    const pdfPath = path.join(outputDir, `integration-${fixtureName}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)
    result.pdfPath = pdfPath
    result.fileSizeKB = Math.round(pdfBuffer.length / 1024)

    if (verbose) {
      console.log(`PDF saved: ${pdfPath}`)
      console.log(`File size: ${result.fileSizeKB} KB`)
    }

    // Step 3: Convert to images and count pages
    if (verbose) {
      console.log('\n[3/4] Converting to images...')
    }

    const imagePaths = pdfToImages(pdfPath, outputDir, verbose)
    result.pageCount = imagePaths.filter(p => p.endsWith('.png')).length

    if (verbose) {
      console.log(`Page count: ${result.pageCount}`)
    }

    // Validate page count
    if (result.pageCount === 0) {
      result.warnings.push('No pages generated (PDF to image conversion may have failed)')
    } else if (result.pageCount < 5) {
      result.warnings.push(`Low page count: ${result.pageCount} (expected at least 5 for a year book)`)
    } else if (result.pageCount > 200) {
      result.warnings.push(`High page count: ${result.pageCount} (may be too large for print)`)
    }

    // Step 4: Run visual judge on sample pages (optional)
    if (!skipVisualJudge && imagePaths.length > 0 && imagePaths[0].endsWith('.png')) {
      if (verbose) {
        console.log('\n[4/4] Running visual judge on sample pages...')
      }

      result.visualJudgments = []
      const pagesToJudge = imagePaths.slice(0, maxPagesToJudge)

      for (let i = 0; i < pagesToJudge.length; i++) {
        const imagePath = pagesToJudge[i]
        const pageNumber = i + 1

        try {
          const context: JudgeContext = {
            templateName: 'BookDocument',
            pageType: entries[i]?.type || 'UNKNOWN',
            pageNumber
          }

          const judgment = await judgePageVisual(imagePath, context, { verbose: false })

          result.visualJudgments.push({
            pageNumber,
            score: judgment.overallScore,
            pass: judgment.pass,
            summary: judgment.summary
          })

          if (verbose) {
            const status = judgment.pass ? 'PASS' : 'FAIL'
            console.log(`  Page ${pageNumber}: ${status} (score: ${judgment.overallScore})`)
          }
        } catch (error) {
          if (verbose) {
            console.log(`  Page ${pageNumber}: ERROR - ${error}`)
          }
        }
      }
    } else if (verbose) {
      console.log('\n[4/4] Skipping visual judge')
    }

    // Mark as successful if we got here without throwing
    result.success = true

  } catch (error) {
    result.error = String(error)
    if (verbose) {
      console.error(`\nERROR: ${error}`)
    }
  }

  result.duration = Date.now() - startTime
  return result
}

/**
 * Run all integration tests
 */
export async function runAllIntegrationTests(
  config: IntegrationTestConfig = {}
): Promise<IntegrationTestResult[]> {
  const results: IntegrationTestResult[] = []
  const { verbose = false } = config

  const fixtures: Array<[string, YearFixture]> = [
    ['activeYear', yearFixtures.activeYear],
    ['casualYear', yearFixtures.casualYear],
    ['marathonFocus', yearFixtures.marathonFocus],
    ['ultraFocus', yearFixtures.ultraFocus],
  ]

  for (const [name, fixture] of fixtures) {
    if (verbose) {
      console.log(`\n${'='.repeat(60)}`)
    }

    const result = await testBookGeneration(name, fixture, config)
    results.push(result)
  }

  return results
}

// ============================================================================
// Report Generation
// ============================================================================

export function generateIntegrationReport(results: IntegrationTestResult[]): string {
  const lines: string[] = [
    '# Integration Test Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- **Total Tests:** ${results.length}`,
    `- **Passed:** ${results.filter(r => r.success).length}`,
    `- **Failed:** ${results.filter(r => !r.success).length}`,
    '',
    '## Results',
    ''
  ]

  for (const result of results) {
    const status = result.success ? 'PASS' : 'FAIL'
    const statusEmoji = result.success ? 'v' : 'x'

    lines.push(`### ${result.fixtureName}`)
    lines.push(`- **Status:** [${statusEmoji}] ${status}`)
    lines.push(`- **Duration:** ${result.duration}ms`)

    if (result.pageCount !== undefined) {
      lines.push(`- **Page Count:** ${result.pageCount}`)
    }

    if (result.fileSizeKB !== undefined) {
      lines.push(`- **File Size:** ${result.fileSizeKB} KB`)
    }

    if (result.pdfPath) {
      lines.push(`- **PDF:** ${result.pdfPath}`)
    }

    if (result.error) {
      lines.push(`- **Error:** ${result.error}`)
    }

    if (result.warnings.length > 0) {
      lines.push('')
      lines.push('**Warnings:**')
      for (const warning of result.warnings) {
        lines.push(`- ${warning}`)
      }
    }

    if (result.visualJudgments && result.visualJudgments.length > 0) {
      lines.push('')
      lines.push('**Visual Judgments (sample pages):**')
      for (const judgment of result.visualJudgments) {
        const status = judgment.pass ? 'PASS' : 'FAIL'
        lines.push(`- Page ${judgment.pageNumber}: ${status} (score: ${judgment.score}) - ${judgment.summary}`)
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
Integration Test Runner

Usage:
  npx tsx integration-tests.ts [options]

Options:
  --fixture <name>    Test specific fixture (activeYear, casualYear, marathonFocus, ultraFocus)
  --all               Run all integration tests
  --skip-judge        Skip visual judge evaluation
  --verbose           Show detailed output
  --help              Show this help

Examples:
  npx tsx integration-tests.ts --fixture activeYear --verbose
  npx tsx integration-tests.ts --all --verbose
  npx tsx integration-tests.ts --all --skip-judge
    `)
    process.exit(0)
  }

  const verbose = args.includes('--verbose')
  const skipVisualJudge = args.includes('--skip-judge')

  const fixtureIdx = args.indexOf('--fixture')

  const config: IntegrationTestConfig = {
    verbose,
    skipVisualJudge,
    maxPagesToJudge: 3
  }

  if (args.includes('--all')) {
    console.log('Running all integration tests...')

    runAllIntegrationTests(config)
      .then(results => {
        const report = generateIntegrationReport(results)
        console.log('\n' + report)

        // Save report
        const reportPath = path.join(__dirname, '../../..', 'test-output', 'integration-report.md')
        fs.mkdirSync(path.dirname(reportPath), { recursive: true })
        fs.writeFileSync(reportPath, report)
        console.log(`\nReport saved to: ${reportPath}`)

        const allPassed = results.every(r => r.success)
        console.log(`\n${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
        process.exit(allPassed ? 0 : 1)
      })
      .catch(err => {
        console.error('Error:', err)
        process.exit(1)
      })

  } else if (fixtureIdx >= 0) {
    const fixtureName = args[fixtureIdx + 1] as keyof typeof yearFixtures

    if (!yearFixtures[fixtureName]) {
      console.error(`Unknown fixture: ${fixtureName}`)
      console.error(`Available fixtures: ${Object.keys(yearFixtures).join(', ')}`)
      process.exit(1)
    }

    testBookGeneration(fixtureName, yearFixtures[fixtureName], config)
      .then(result => {
        console.log('\n=== Result ===')
        console.log(JSON.stringify(result, null, 2))
        process.exit(result.success ? 0 : 1)
      })
      .catch(err => {
        console.error('Error:', err)
        process.exit(1)
      })

  } else {
    console.log('Specify --fixture <name> or --all. See --help for usage.')
    process.exit(1)
  }
}
