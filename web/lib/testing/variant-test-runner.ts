/**
 * Variant Test Runner — Iterates all 7 variants x all data profiles
 *
 * Modes:
 *   - Heuristic only (default): fast, no rendering, no LLM cost
 *   - LLM judge: renders PDF → PNG → sends to LLM for visual evaluation
 *
 * CLI usage:
 *   npx tsx web/lib/testing/variant-test-runner.ts --verbose
 *   npx tsx web/lib/testing/variant-test-runner.ts --llm-judge --verbose
 */

import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { RaceSectionVariant, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import {
  applyDataProfile,
  getBaseFixture,
  PRESETS,
  PRESET_NAMES,
} from './fixture-factory'
import {
  buildSectionManifest,
  judgeSectionHeuristic,
  judgeSectionVisual,
  SectionJudgment,
  SectionManifest,
} from './section-judge'
import { pdfToImages } from './test-harness'

// ============================================================================
// Types
// ============================================================================

export const ALL_VARIANTS: RaceSectionVariant[] = [
  'default', 'editorial', 'magazine', 'map-hero', 'photo-essay', 'stats-forward', 'compact',
]

export interface VariantTestConfig {
  variants?: RaceSectionVariant[]
  profiles?: string[]
  baseFixture?: string
  llmJudge?: boolean
  outputDir?: string
  verbose?: boolean
}

export interface VariantTestResult {
  variant: RaceSectionVariant
  profile: string
  manifest: SectionManifest
  judgment: SectionJudgment
  duration: number  // ms
}

export interface VariantTestReport {
  results: VariantTestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    averageScore: number
    worstCases: Array<{
      variant: RaceSectionVariant
      profile: string
      score: number
    }>
  }
  matrix: Record<string, Record<string, { score: number; pass: boolean }>>
  markdown: string
}

// ============================================================================
// PDF Rendering Pipeline
// ============================================================================

let fontsRegistered = false

async function ensureFontsRegistered() {
  if (fontsRegistered) return
  await import('@/lib/pdf-fonts')
  fontsRegistered = true
}

async function renderVariantToImages(
  activity: StravaActivity,
  variant: RaceSectionVariant,
  outputDir: string,
  profileName: string,
  verbose: boolean
): Promise<string[]> {
  await ensureFontsRegistered()

  const { RaceSection } = await import('@/components/templates/RaceSection')

  const renderDir = path.join(outputDir, 'renders')
  if (!fs.existsSync(renderDir)) {
    fs.mkdirSync(renderDir, { recursive: true })
  }

  try {
    const pdfBuffer = await renderToBuffer(
      // RaceSection returns a <Document> which is the correct top-level element
       
      React.createElement(RaceSection, {
        activity,
        format: FORMATS['10x10'],
        theme: DEFAULT_THEME,
        variant,
        mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '',
      }) as any
    )

    const pdfPath = path.join(renderDir, `${variant}-${profileName}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)

    if (verbose) {
      console.log(`    [render] PDF saved: ${pdfPath}`)
    }

    // Clean stale PNGs from previous runs for this variant+profile
    const basename = `${variant}-${profileName}`
    const existingFiles = fs.readdirSync(renderDir)
    for (const f of existingFiles) {
      if (f.startsWith(basename) && f.endsWith('.png')) {
        fs.unlinkSync(path.join(renderDir, f))
      }
    }

    const imagePaths = pdfToImages(pdfPath, renderDir, verbose)
    return imagePaths.filter(p => p.endsWith('.png'))
  } catch (error) {
    if (verbose) {
      console.log(`    [render] Failed to render ${variant} x ${profileName}: ${error}`)
    }
    return []
  }
}

// ============================================================================
// Runner
// ============================================================================

export async function runVariantTests(
  config: VariantTestConfig = {}
): Promise<VariantTestReport> {
  const {
    variants = ALL_VARIANTS,
    profiles = PRESET_NAMES,
    baseFixture = 'race_ultramarathon',
    llmJudge = false,
    outputDir,
    verbose = false,
  } = config

  // Load base fixture (currently only supports race_ultramarathon)
  if (baseFixture !== 'race_ultramarathon') {
    throw new Error(`Unsupported fixture: ${baseFixture}. Currently only 'race_ultramarathon' is supported.`)
  }
  const base = getBaseFixture()

  if (verbose) {
    console.log(`\n=== Variant Test Runner ===`)
    console.log(`Variants: ${variants.join(', ')}`)
    console.log(`Profiles: ${profiles.length} profiles`)
    console.log(`Base fixture: ${baseFixture}`)
    console.log(`LLM judge: ${llmJudge}`)
    console.log(`Total combinations: ${variants.length * profiles.length}\n`)
  }

  const results: VariantTestResult[] = []
  const matrix: VariantTestReport['matrix'] = {}

  for (const variant of variants) {
    matrix[variant] = {}

    for (const profileName of profiles) {
      const profile = PRESETS[profileName]
      if (!profile) {
        throw new Error(`Unknown profile: ${profileName}`)
      }

      const start = Date.now()
      const activity = applyDataProfile(base, profile)
      const manifest = buildSectionManifest(activity, variant)

      let judgment: SectionJudgment
      if (llmJudge) {
        const imagePaths = await renderVariantToImages(activity, variant, outputDir || path.join(process.cwd(), 'test-output', 'variant-tests'), profileName, verbose)
        judgment = await judgeSectionVisual(imagePaths, activity, variant, { verbose })
      } else {
        judgment = judgeSectionHeuristic(activity, variant)
      }

      const duration = Date.now() - start

      const result: VariantTestResult = {
        variant,
        profile: profileName,
        manifest,
        judgment,
        duration,
      }
      results.push(result)

      matrix[variant][profileName] = {
        score: judgment.overallScore,
        pass: judgment.pass,
      }

      if (verbose) {
        const status = judgment.pass ? 'PASS' : 'FAIL'
        const icon = judgment.pass ? '+' : '-'
        console.log(
          `  [${icon}] ${variant.padEnd(14)} x ${profileName.padEnd(16)} → ${status} (${judgment.overallScore}/100, ${manifest.pageCount}p, ${duration}ms)`
        )
        if (!judgment.pass && judgment.suggestions.length > 0) {
          console.log(`      ${judgment.suggestions[0]}`)
        }
      }
    }

    if (verbose) console.log()
  }

  // Build summary
  const passed = results.filter(r => r.judgment.pass).length
  const totalScore = results.reduce((sum, r) => sum + r.judgment.overallScore, 0)
  const averageScore = results.length > 0 ? Math.round(totalScore / results.length) : 0

  // Worst cases
  const sorted = [...results].sort((a, b) => a.judgment.overallScore - b.judgment.overallScore)
  const worstCases = sorted.slice(0, 5).map(r => ({
    variant: r.variant,
    profile: r.profile,
    score: r.judgment.overallScore,
  }))

  const markdown = generateMarkdownReport(results, matrix, variants, profiles)

  // Write report if outputDir specified
  if (outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(
      path.join(outputDir, 'variant-test-report.md'),
      markdown
    )
    fs.writeFileSync(
      path.join(outputDir, 'variant-test-results.json'),
      JSON.stringify({ results, summary: { total: results.length, passed, failed: results.length - passed, averageScore, worstCases } }, null, 2)
    )
  }

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      averageScore,
      worstCases,
    },
    matrix,
    markdown,
  }
}

// ============================================================================
// Report Generation
// ============================================================================

function generateMarkdownReport(
  results: VariantTestResult[],
  matrix: VariantTestReport['matrix'],
  variants: RaceSectionVariant[],
  profiles: string[]
): string {
  const passed = results.filter(r => r.judgment.pass).length
  const failed = results.length - passed
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.judgment.overallScore, 0) / results.length)
    : 0

  let md = `# Variant Test Report\n\n`
  md += `**Date:** ${new Date().toISOString()}\n`
  md += `**Total:** ${results.length} | **Passed:** ${passed} | **Failed:** ${failed} | **Avg Score:** ${avgScore}/100\n\n`

  // Pass/fail matrix
  md += `## Pass/Fail Matrix\n\n`
  md += `| Profile | ${variants.map(v => v).join(' | ')} |\n`
  md += `|---------|${variants.map(() => '---').join('|')}|\n`

  for (const profile of profiles) {
    const cells = variants.map(v => {
      const cell = matrix[v]?.[profile]
      if (!cell) return '-'
      return cell.pass ? `${cell.score}` : `**${cell.score}**`
    })
    md += `| ${profile} | ${cells.join(' | ')} |\n`
  }

  md += `\n*Bold = failing (< 60 overall or criterion < 40)*\n\n`

  // Per-variant summary
  md += `## Per-Variant Summary\n\n`
  for (const variant of variants) {
    const varResults = results.filter(r => r.variant === variant)
    const varPassed = varResults.filter(r => r.judgment.pass).length
    const varAvg = varResults.length > 0
      ? Math.round(varResults.reduce((s, r) => s + r.judgment.overallScore, 0) / varResults.length)
      : 0
    md += `### ${variant}\n`
    md += `- Passed: ${varPassed}/${varResults.length}\n`
    md += `- Average score: ${varAvg}/100\n`

    const worst = varResults.sort((a, b) => a.judgment.overallScore - b.judgment.overallScore)[0]
    if (worst) {
      md += `- Worst case: ${worst.profile} (${worst.judgment.overallScore}/100)\n`
      if (worst.judgment.suggestions.length > 0) {
        md += `  - ${worst.judgment.suggestions[0]}\n`
      }
    }
    md += `\n`
  }

  // Worst 10 cases
  md += `## Worst Cases\n\n`
  const sorted = [...results].sort((a, b) => a.judgment.overallScore - b.judgment.overallScore)
  for (const r of sorted.slice(0, 10)) {
    md += `- **${r.variant}** x **${r.profile}**: ${r.judgment.overallScore}/100`
    md += ` (completeness=${r.judgment.completeness.score}, util=${r.judgment.pageUtilization.score}, flow=${r.judgment.contentFlow.score}, degrade=${r.judgment.gracefulDegradation.score})\n`
  }

  return md
}

// ============================================================================
// CLI Interface
// ============================================================================

if (require.main === module) {
  // Load .env.local for API keys when running as CLI
  const dotenv = require('dotenv')
  dotenv.config({ path: path.join(__dirname, '../../.env.local') })

  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose') || args.includes('-v')
  const llmJudge = args.includes('--llm-judge')

  // Parse --variants default,editorial,magazine
  const variantsIdx = args.indexOf('--variants')
  const variants = variantsIdx >= 0
    ? args[variantsIdx + 1].split(',') as RaceSectionVariant[]
    : undefined

  // Parse --profiles full-data,bare-minimum
  const profilesIdx = args.indexOf('--profiles')
  const profiles = profilesIdx >= 0
    ? args[profilesIdx + 1].split(',')
    : undefined

  const config: VariantTestConfig = {
    verbose,
    llmJudge,
    variants,
    profiles,
    outputDir: path.join(process.cwd(), 'test-output', 'variant-tests'),
  }

  runVariantTests(config)
    .then(report => {
      console.log('\n' + report.markdown)
      console.log(`\n=== Summary ===`)
      console.log(`Total: ${report.summary.total}`)
      console.log(`Passed: ${report.summary.passed}`)
      console.log(`Failed: ${report.summary.failed}`)
      console.log(`Average: ${report.summary.averageScore}/100`)

      if (report.summary.failed > 0) {
        console.log(`\nWorst cases:`)
        for (const w of report.summary.worstCases) {
          console.log(`  ${w.variant} x ${w.profile}: ${w.score}/100`)
        }
      }

      process.exit(report.summary.failed > 0 ? 1 : 0)
    })
    .catch(error => {
      console.error('Error:', error)
      process.exit(1)
    })
}
