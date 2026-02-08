/**
 * Design Iteration Helper — CLI tool for the template design process
 *
 * Wraps the variant test runner with manifest validation and reference
 * image comparison. Used by the design agent during Stages 2-4.
 *
 * CLI usage:
 *   npx tsx web/lib/testing/design-iteration.ts --variant editorial --profile full-data --verbose
 *   npx tsx web/lib/testing/design-iteration.ts --variant editorial --all-profiles --verbose
 *   npx tsx web/lib/testing/design-iteration.ts --variant editorial --profile full-data --validate-manifest
 *   npx tsx web/lib/testing/design-iteration.ts --variant editorial --profile full-data --reference reference-design.png
 */

import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { RaceSectionVariant, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import {
  applyDataProfile,
  getBaseFixture,
  PRESETS,
  PRESET_NAMES,
} from './fixture-factory'
import { buildSectionManifest } from './section-manifest'
import {
  judgeSectionHeuristic,
  judgeSectionVisual,
  SectionJudgment,
} from './section-judge'
import { pdfToImages } from './test-harness'
import { callLlmWithImages, stripJsonFences } from '@/lib/llm-provider'

// ============================================================================
// Types
// ============================================================================

export interface DesignIterationResult {
  variant: RaceSectionVariant
  profile: string
  judgment: SectionJudgment
  pageCount: number
  pdfPath?: string
  imagePaths: string[]
  duration: number
}

export interface ManifestValidationResult {
  variant: RaceSectionVariant
  profile: string
  predicted: number
  actual: number
  match: boolean
}

export interface ReferenceFidelityScore {
  score: number // 0-100
  issues: string[]
  suggestions: string[]
}

export interface DesignIterationReport {
  results: DesignIterationResult[]
  manifestValidation?: ManifestValidationResult[]
  referenceFidelity?: ReferenceFidelityScore
  iterationNumber: number
  outputDir: string
  allPassing: boolean
  summary: string
}

export interface DesignIterationConfig {
  variant: RaceSectionVariant
  profiles: string[]
  verbose: boolean
  validateManifest: boolean
  referencePath?: string
  outputBaseDir: string
  llmJudge: boolean
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT = FORMATS['10x10']
const THEME = DEFAULT_THEME
const MAPBOX_TOKEN = 'pk.test_token_for_manifest_validation'

// ============================================================================
// Font Registration
// ============================================================================

let fontsRegistered = false

async function ensureFontsRegistered() {
  if (fontsRegistered) return
  await import('@/lib/pdf-fonts')
  fontsRegistered = true
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Render a single variant x profile to PDF, convert to PNGs, and judge.
 */
async function renderAndJudge(
  variant: RaceSectionVariant,
  profile: string,
  options: {
    verbose: boolean
    outputDir: string
    llmJudge: boolean
  }
): Promise<DesignIterationResult> {
  const { verbose, outputDir, llmJudge } = options
  const start = Date.now()

  await ensureFontsRegistered()

  const base = getBaseFixture()
  const presetProfile = PRESETS[profile]
  if (!presetProfile) {
    throw new Error(`Unknown profile: ${profile}`)
  }
  const activity = applyDataProfile(base, presetProfile)

  // Render to PDF
  const { RaceSection } = await import('@/components/templates/RaceSection')

  const renderDir = path.join(outputDir, 'renders')
  if (!fs.existsSync(renderDir)) {
    fs.mkdirSync(renderDir, { recursive: true })
  }

  let pdfPath: string | undefined
  let imagePaths: string[] = []
  let pageCount = 0

  try {
    const pdfBuffer = await renderToBuffer(
      React.createElement(RaceSection, {
        activity,
        format: FORMAT,
        theme: THEME,
        variant,
        mapboxToken: MAPBOX_TOKEN,
      }) as Parameters<typeof renderToBuffer>[0]
    )

    pdfPath = path.join(renderDir, `${variant}-${profile}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)

    // Count pages
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    pageCount = pdfDoc.getPageCount()

    if (verbose) {
      console.log(`  [render] PDF saved: ${pdfPath} (${pageCount} pages)`)
    }

    // Clean stale PNGs
    const basename = `${variant}-${profile}`
    const existingFiles = fs.readdirSync(renderDir)
    for (const f of existingFiles) {
      if (f.startsWith(basename) && f.endsWith('.png')) {
        fs.unlinkSync(path.join(renderDir, f))
      }
    }

    // Convert to PNGs
    imagePaths = pdfToImages(pdfPath, renderDir, verbose).filter(p => p.endsWith('.png'))
  } catch (error) {
    if (verbose) {
      console.log(`  [render] Failed: ${error}`)
    }
  }

  // Judge
  let judgment: SectionJudgment
  if (llmJudge && imagePaths.length > 0) {
    judgment = await judgeSectionVisual(imagePaths, activity, variant, { verbose })
  } else {
    judgment = judgeSectionHeuristic(activity, variant)
  }

  const duration = Date.now() - start

  return {
    variant,
    profile,
    judgment,
    pageCount,
    pdfPath,
    imagePaths,
    duration,
  }
}

/**
 * Validate manifest accuracy for one variant across specified profiles.
 * Renders to PDF via renderToBuffer, counts pages with pdf-lib,
 * compares against buildSectionManifest prediction.
 */
async function validateManifest(
  variant: RaceSectionVariant,
  profiles: string[],
  verbose: boolean
): Promise<ManifestValidationResult[]> {
  await ensureFontsRegistered()

  const { RaceSection } = await import('@/components/templates/RaceSection')
  const base = getBaseFixture()
  const results: ManifestValidationResult[] = []

  for (const profileName of profiles) {
    const presetProfile = PRESETS[profileName]
    if (!presetProfile) {
      throw new Error(`Unknown profile: ${profileName}`)
    }
    const activity = applyDataProfile(base, presetProfile)

    // Predict
    const manifest = buildSectionManifest(activity, variant, MAPBOX_TOKEN)
    const predicted = manifest.pageCount

    // Render and count actual pages
    let actual: number
    try {
      const element = React.createElement(RaceSection, {
        activity,
        format: FORMAT,
        theme: THEME,
        mapboxToken: MAPBOX_TOKEN,
        variant,
      }) as Parameters<typeof renderToBuffer>[0]
      const buffer = await renderToBuffer(element)
      const pdfDoc = await PDFDocument.load(buffer)
      actual = pdfDoc.getPageCount()
    } catch (err) {
      if (verbose) {
        console.error(`  [manifest] RENDER ERROR [${variant}/${profileName}]:`, err)
      }
      results.push({ variant, profile: profileName, predicted, actual: -1, match: false })
      continue
    }

    const match = predicted === actual
    if (verbose) {
      const icon = match ? '+' : '-'
      console.log(
        `  [${icon}] manifest ${variant} x ${profileName}: predicted=${predicted}, actual=${actual}${match ? '' : ' MISMATCH'}`
      )
    }

    results.push({ variant, profile: profileName, predicted, actual, match })
  }

  return results
}

/**
 * Compare rendered images against a reference design image using the LLM judge.
 * Returns a fidelity score (0-100) measuring structural similarity.
 */
async function compareToReference(
  imagePaths: string[],
  referencePath: string,
  verbose: boolean
): Promise<ReferenceFidelityScore> {
  if (!fs.existsSync(referencePath)) {
    return {
      score: 0,
      issues: [`Reference image not found: ${referencePath}`],
      suggestions: [],
    }
  }

  const referenceBase64 = fs.readFileSync(referencePath).toString('base64')
  const renderedBase64 = imagePaths
    .filter(p => fs.existsSync(p))
    .map(p => fs.readFileSync(p).toString('base64'))

  if (renderedBase64.length === 0) {
    return {
      score: 0,
      issues: ['No rendered images available for comparison'],
      suggestions: [],
    }
  }

  const images = [
    { base64: referenceBase64, format: 'png' as const },
    ...renderedBase64.map(b64 => ({ base64: b64, format: 'png' as const })),
  ]

  const prompt = `You are comparing a reference design (first image) against rendered PDF pages (subsequent images).

Evaluate STRUCTURAL SIMILARITY — how well does the rendered output match the reference design:
- Page count: Do the rendered pages match the expected number from the reference?
- Content placement: Are major elements (photos, text blocks, stats) in similar positions?
- Visual hierarchy: Is the emphasis on the right elements?
- Layout proportions: Are content areas roughly the right size relative to each other?
- Typography scale: Are heading/body text sizes proportionally correct?

Score from 0-100:
- 90-100: Excellent match — minor spacing differences only
- 70-89: Good match — correct structure with some layout adjustments needed
- 50-69: Partial match — right elements but wrong arrangement
- 30-49: Poor match — missing or misplaced major elements
- 0-29: No resemblance to reference

Return ONLY valid JSON:
{
  "score": <0-100>,
  "issues": ["specific issue 1", "specific issue 2"],
  "suggestions": ["actionable fix 1", "actionable fix 2"]
}`

  try {
    const result = await callLlmWithImages(images, prompt, {
      maxTokens: 1500,
      temperature: 0.1,
      logPrefix: '[Reference Fidelity]',
      verbose,
    })

    const parsed = JSON.parse(stripJsonFences(result.text))
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
    }
  } catch (error) {
    if (verbose) {
      console.log(`  [reference] LLM comparison failed: ${error}`)
    }
    return {
      score: 0,
      issues: ['LLM comparison failed — no providers available or API error'],
      suggestions: ['Configure GEMINI_API_KEY or AWS_BEARER_TOKEN_BEDROCK for reference comparison'],
    }
  }
}

// ============================================================================
// Main Design Iteration
// ============================================================================

/**
 * Run a full design iteration: render + judge + manifest check + optional reference.
 */
export async function designIteration(
  config: DesignIterationConfig
): Promise<DesignIterationReport> {
  const {
    variant,
    profiles,
    verbose,
    validateManifest: doValidateManifest,
    referencePath,
    outputBaseDir,
    llmJudge,
  } = config

  // Determine iteration number from existing directories
  const iterationsDir = path.join(outputBaseDir, 'design-iterations')
  if (!fs.existsSync(iterationsDir)) {
    fs.mkdirSync(iterationsDir, { recursive: true })
  }

  const existingDirs = fs.readdirSync(iterationsDir)
    .filter(d => d.startsWith('iteration-'))
    .map(d => parseInt(d.replace('iteration-', ''), 10))
    .filter(n => !isNaN(n))
  const iterationNumber = existingDirs.length > 0 ? Math.max(...existingDirs) + 1 : 1

  const outputDir = path.join(iterationsDir, `iteration-${iterationNumber}`)
  fs.mkdirSync(outputDir, { recursive: true })

  if (verbose) {
    console.log(`\n=== Design Iteration ${iterationNumber} ===`)
    console.log(`Variant: ${variant}`)
    console.log(`Profiles: ${profiles.join(', ')}`)
    console.log(`Output: ${outputDir}`)
    console.log(`Manifest validation: ${doValidateManifest}`)
    console.log(`Reference: ${referencePath || 'none'}`)
    console.log()
  }

  // Render and judge each profile
  const results: DesignIterationResult[] = []
  for (const profile of profiles) {
    if (verbose) {
      console.log(`--- ${variant} x ${profile} ---`)
    }

    const result = await renderAndJudge(variant, profile, {
      verbose,
      outputDir,
      llmJudge,
    })
    results.push(result)

    if (verbose) {
      const status = result.judgment.pass ? 'PASS' : 'FAIL'
      console.log(
        `  [judge] ${status} — overall=${result.judgment.overallScore} ` +
        `completeness=${result.judgment.completeness.score} ` +
        `util=${result.judgment.pageUtilization.score} ` +
        `flow=${result.judgment.contentFlow.score} ` +
        `degrade=${result.judgment.gracefulDegradation.score} ` +
        `(${result.pageCount}p, ${result.duration}ms)`
      )
      if (!result.judgment.pass && result.judgment.suggestions.length > 0) {
        console.log(`  [judge] ${result.judgment.suggestions[0]}`)
      }
    }
  }

  // Manifest validation
  let manifestValidation: ManifestValidationResult[] | undefined
  if (doValidateManifest) {
    if (verbose) {
      console.log(`\n--- Manifest Validation ---`)
    }
    manifestValidation = await validateManifest(variant, profiles, verbose)

    const mismatches = manifestValidation.filter(r => !r.match)
    if (mismatches.length > 0) {
      console.log(`\n  MANIFEST MISMATCH: ${mismatches.length} profile(s) failed`)
      for (const m of mismatches) {
        console.log(`    ${m.profile}: predicted=${m.predicted}, actual=${m.actual}`)
      }
    } else if (verbose) {
      console.log(`  All ${manifestValidation.length} manifest predictions match`)
    }
  }

  // Reference comparison
  let referenceFidelity: ReferenceFidelityScore | undefined
  if (referencePath) {
    if (verbose) {
      console.log(`\n--- Reference Comparison ---`)
    }
    // Use the full-data result images if available
    const fullDataResult = results.find(r => r.profile === 'full-data')
    const imagesToCompare = fullDataResult?.imagePaths || results[0]?.imagePaths || []

    if (imagesToCompare.length > 0) {
      referenceFidelity = await compareToReference(imagesToCompare, referencePath, verbose)
      if (verbose) {
        console.log(`  Fidelity score: ${referenceFidelity.score}/100`)
        if (referenceFidelity.issues.length > 0) {
          console.log(`  Issues: ${referenceFidelity.issues.join('; ')}`)
        }
      }
    }
  }

  // Determine pass/fail
  const allResultsPassing = results.every(r => r.judgment.pass)
  const manifestPassing = !manifestValidation || manifestValidation.every(r => r.match)
  const allPassing = allResultsPassing && manifestPassing

  // Build summary
  const passCount = results.filter(r => r.judgment.pass).length
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.judgment.overallScore, 0) / results.length)
    : 0

  let summary = `Iteration ${iterationNumber}: ${passCount}/${results.length} profiles passing, avg score ${avgScore}/100`
  if (manifestValidation) {
    const mMismatches = manifestValidation.filter(r => !r.match).length
    summary += `, manifest ${mMismatches === 0 ? 'OK' : `${mMismatches} mismatch(es)`}`
  }
  if (referenceFidelity) {
    summary += `, reference fidelity ${referenceFidelity.score}/100`
  }

  const report: DesignIterationReport = {
    results,
    manifestValidation,
    referenceFidelity,
    iterationNumber,
    outputDir,
    allPassing,
    summary,
  }

  // Save report
  const reportPath = path.join(outputDir, 'iteration-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  if (verbose) {
    console.log(`\n=== ${summary} ===\n`)
  } else {
    console.log(summary)
  }

  return report
}

// ============================================================================
// CLI Interface
// ============================================================================

if (require.main === module) {
  // Load .env.local for API keys
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv')
  dotenv.config({ path: path.join(__dirname, '../../.env.local') })

  const args = process.argv.slice(2)

  // Parse flags
  const verbose = args.includes('--verbose') || args.includes('-v')
  const doValidateManifest = args.includes('--validate-manifest')
  const allProfiles = args.includes('--all-profiles')
  const llmJudge = args.includes('--llm-judge')

  // Parse --variant name
  const variantIdx = args.indexOf('--variant')
  if (variantIdx < 0 || !args[variantIdx + 1]) {
    console.error('Usage: npx tsx web/lib/testing/design-iteration.ts --variant <name> [options]')
    console.error('Options:')
    console.error('  --profile <name>      Test a single profile')
    console.error('  --all-profiles        Test all 14 profiles')
    console.error('  --validate-manifest   Validate manifest accuracy')
    console.error('  --reference <path>    Compare against reference image')
    console.error('  --llm-judge           Use LLM visual judge (requires API key)')
    console.error('  --verbose             Detailed output')
    process.exit(1)
  }
  const variant = args[variantIdx + 1] as RaceSectionVariant

  // Parse --profile name
  const profileIdx = args.indexOf('--profile')
  let profiles: string[]
  if (allProfiles) {
    profiles = PRESET_NAMES
  } else if (profileIdx >= 0 && args[profileIdx + 1]) {
    profiles = [args[profileIdx + 1]]
  } else {
    profiles = PRESET_NAMES
  }

  // Parse --reference path
  const referenceIdx = args.indexOf('--reference')
  const referencePath = referenceIdx >= 0 ? args[referenceIdx + 1] : undefined

  const config: DesignIterationConfig = {
    variant,
    profiles,
    verbose,
    validateManifest: doValidateManifest,
    referencePath,
    outputBaseDir: path.join(process.cwd(), 'test-output'),
    llmJudge,
  }

  designIteration(config)
    .then(report => {
      if (!report.allPassing) {
        // Show failing results
        const failing = report.results.filter(r => !r.judgment.pass)
        if (failing.length > 0) {
          console.log('\nFailing profiles:')
          for (const r of failing) {
            console.log(`  ${r.profile}: ${r.judgment.overallScore}/100 — ${r.judgment.suggestions[0] || ''}`)
          }
        }

        const manifestMismatches = report.manifestValidation?.filter(r => !r.match) || []
        if (manifestMismatches.length > 0) {
          console.log('\nManifest mismatches:')
          for (const m of manifestMismatches) {
            console.log(`  ${m.profile}: predicted=${m.predicted}, actual=${m.actual}`)
          }
        }

        process.exit(1)
      }
    })
    .catch(error => {
      console.error('Design iteration failed:', error)
      process.exit(1)
    })
}
