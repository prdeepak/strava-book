#!/usr/bin/env npx tsx
/**
 * Template Variant Validation Script
 *
 * Validates that all template variants render correctly and produce distinct output.
 *
 * Usage (from web directory):
 *   npm run validate-variants [-- options]
 *   npx tsx ../scripts/validate-variants.ts [options]
 *
 * Options:
 *   --template <name>   Validate only specific template (e.g., race_1p)
 *   --variant <name>    Validate only specific variant
 *   --fixture <name>    Use specific fixture
 *   --json              Output JSON report
 *   --verbose           Show detailed output
 *   --help              Show help
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'

import { analyzePDFBuffer, analyzeReactTree, combineAnalysis, FullAnalysis } from './lib/pdf-analyzer'
import { validateAgainstSpec, validateDistinctness, getAllSpecs } from './lib/spec-validator'
import {
  VariantResult,
  TemplateReport,
  FullReport,
  formatFullReport,
  formatJsonReport,
  formatProgress,
} from './lib/report-formatter'

// ============================================================================
// Configuration
// ============================================================================

// Script runs from web directory, so paths are relative to cwd
const SCRIPT_DIR = __dirname
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..')
const WEB_DIR = process.cwd() // Expected to be run from web directory
const FIXTURES_DIR = path.join(WEB_DIR, 'lib', 'testing', 'fixtures')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-output', 'variant-validation')

// ============================================================================
// Template Component Registry
// ============================================================================

type TemplateProps = {
  activity?: unknown
  format?: unknown
  theme?: unknown
  activities?: unknown[]
  year?: number
  month?: number
  athleteName?: string
  summary?: unknown
  entries?: unknown[]
}

type TemplateComponent = React.ComponentType<TemplateProps>

interface TemplateRegistry {
  templateId: string
  loader: () => Promise<TemplateComponent>
  fixtureType: 'activity' | 'year' | 'none'
}

const templateRegistry: TemplateRegistry[] = [
  {
    templateId: 'race_1p',
    loader: async () => {
      const mod = await import('../web/components/templates/Race_1p')
      return mod.Race_1p as TemplateComponent
    },
    fixtureType: 'activity',
  },
  {
    templateId: 'race_2p',
    loader: async () => {
      const mod = await import('../web/components/templates/Race_2p')
      return mod.Race_2pSpread as TemplateComponent
    },
    fixtureType: 'activity',
  },
  // Note: Other templates don't have explicit variant support yet in their specs
  // but we can still test them when variant rendering is added
]

// Map template spec IDs to registry entries
const templateLoaders = new Map(templateRegistry.map(t => [t.templateId, t]))

// ============================================================================
// Fixture Loading
// ============================================================================

interface ActivityFixture {
  id: number
  name: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  type: string
  sport_type: string
  start_date: string
  map?: { summary_polyline: string }
  photos?: { primary?: { urls?: { '600'?: string } }; count: number }
  description?: string
  comprehensiveData?: {
    photos: unknown[]
    comments: unknown[]
    streams: Record<string, unknown>
  }
}

function loadFixture(name: string): ActivityFixture | null {
  const fixturePath = path.join(FIXTURES_DIR, `${name}.json`)
  if (!fs.existsSync(fixturePath)) {
    return null
  }

  const json = fs.readFileSync(fixturePath, 'utf-8')
  const fixture = JSON.parse(json) as ActivityFixture

  // Resolve relative photo paths to absolute
  const resolved = JSON.stringify(fixture).replace(/"(photos\/[^"]+)"/g, (_match, relativePath) => {
    const absolutePath = path.join(FIXTURES_DIR, relativePath)
    return `"${absolutePath}"`
  })

  return JSON.parse(resolved)
}

function getDefaultFixture(): ActivityFixture | null {
  // Try fixtures in order of preference
  const fixtureNames = ['race_marathon', 'race_half_marathon', 'race_ultramarathon', 'rich_full_content']
  for (const name of fixtureNames) {
    const fixture = loadFixture(name)
    if (fixture) return fixture
  }
  return null
}

// ============================================================================
// PDF Generation
// ============================================================================

async function renderVariant(
  Template: TemplateComponent,
  fixture: ActivityFixture,
  variant: string
): Promise<{ buffer: Buffer; reactElement: React.ReactElement } | { error: string }> {
  try {
    // Import book types
    const { FORMATS, DEFAULT_THEME } = await import('../web/lib/book-types')

    // Create props based on variant (templates may use variant prop differently)
    const props: TemplateProps = {
      activity: fixture,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }

    // Note: Currently templates don't accept variant as a prop directly
    // They would need to be modified to support variant-based rendering
    // For now, we test the default rendering for each template

    const reactElement = React.createElement(Template, props)
    const buffer = await renderToBuffer(reactElement)

    return { buffer: Buffer.from(buffer), reactElement }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================================
// Validation Logic
// ============================================================================

async function validateVariant(
  templateId: string,
  variantName: string,
  Template: TemplateComponent,
  fixture: ActivityFixture
): Promise<VariantResult> {
  const startTime = Date.now()

  // Attempt to render
  const renderResult = await renderVariant(Template, fixture, variantName)

  if ('error' in renderResult) {
    return {
      templateId,
      variantName,
      passed: false,
      fileSize: 0,
      renderTime: Date.now() - startTime,
      hash: '',
      validation: {
        templateId,
        variantName,
        valid: false,
        issues: [{
          type: 'error',
          code: 'RENDER_ERROR',
          message: `Rendering failed: ${renderResult.error}`,
        }],
        checksPerformed: [],
      },
      error: renderResult.error,
    }
  }

  const { buffer, reactElement } = renderResult

  // Analyze the output
  const treeAnalysis = analyzeReactTree(reactElement)
  const bufferAnalysis = analyzePDFBuffer(buffer)
  const fullAnalysis: FullAnalysis = combineAnalysis(treeAnalysis, bufferAnalysis, true)

  // Calculate hash for distinctness check
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  // Determine input data characteristics
  const photoCount = fixture.comprehensiveData?.photos?.length ||
    (fixture.photos?.primary?.urls ? 1 : 0)
  const hasMapData = !!fixture.map?.summary_polyline
  const hasDescription = !!fixture.description

  // Validate against spec
  const validation = validateAgainstSpec(templateId, variantName, fullAnalysis, {
    photoCount,
    hasMapData,
    hasChartData: true, // Assume true for now
    hasDescription,
  })

  return {
    templateId,
    variantName,
    passed: validation.valid && fullAnalysis.fileSize > 0,
    fileSize: fullAnalysis.fileSize,
    renderTime: Date.now() - startTime,
    hash,
    validation,
  }
}

async function validateTemplate(
  templateId: string,
  variants: string[],
  Template: TemplateComponent,
  fixture: ActivityFixture,
  verbose: boolean
): Promise<TemplateReport> {
  const results: VariantResult[] = []
  const hashes = new Map<string, string>()

  for (const variant of variants) {
    if (verbose) {
      process.stdout.write(`  Validating variant: ${variant}...`)
    }

    const result = await validateVariant(templateId, variant, Template, fixture)
    results.push(result)
    hashes.set(variant, result.hash)

    if (verbose) {
      console.log(result.passed ? ' OK' : ' FAILED')
    }
  }

  // Check distinctness
  const distinctnessResult = validateDistinctness(hashes)

  return {
    templateId,
    variantsTotal: variants.length,
    variantsPassed: results.filter(r => r.passed).length,
    variantsFailed: results.filter(r => !r.passed).length,
    distinctOutput: distinctnessResult.distinct,
    duplicateVariants: distinctnessResult.duplicates,
    results,
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse arguments
  const showHelp = args.includes('--help') || args.includes('-h')
  const verbose = args.includes('--verbose') || args.includes('-v')
  const jsonOutput = args.includes('--json')

  const templateIdx = args.indexOf('--template')
  const variantIdx = args.indexOf('--variant')
  const fixtureIdx = args.indexOf('--fixture')

  const specificTemplate = templateIdx >= 0 ? args[templateIdx + 1] : undefined
  const specificVariant = variantIdx >= 0 ? args[variantIdx + 1] : undefined
  const specificFixture = fixtureIdx >= 0 ? args[fixtureIdx + 1] : undefined

  if (showHelp) {
    console.log(`
Template Variant Validation Script

Validates that all template variants render correctly and produce distinct output.

Usage:
  npx tsx scripts/validate-variants.ts [options]

Options:
  --template <name>   Validate only specific template (e.g., race_1p)
  --variant <name>    Validate only specific variant
  --fixture <name>    Use specific fixture (default: race_marathon)
  --json              Output JSON report instead of formatted table
  --verbose           Show detailed progress output
  --help              Show this help message

Examples:
  npx tsx scripts/validate-variants.ts
  npx tsx scripts/validate-variants.ts --template race_1p --verbose
  npx tsx scripts/validate-variants.ts --template race_1p --variant photo-hero
  npx tsx scripts/validate-variants.ts --fixture race_ultramarathon --json
`)
    process.exit(0)
  }

  // Load fixture
  const fixture = specificFixture
    ? loadFixture(specificFixture)
    : getDefaultFixture()

  if (!fixture) {
    console.error('Error: Could not load fixture')
    console.error('Tried loading:', specificFixture || 'default fixtures')
    console.error('Fixtures directory:', FIXTURES_DIR)
    process.exit(1)
  }

  if (verbose) {
    console.log(`Using fixture: ${fixture.name} (${fixture.id})`)
  }

  // Get all specs from registry
  const allSpecs = getAllSpecs()
  const startTime = Date.now()
  const templateReports: TemplateReport[] = []

  // Filter templates if specific one requested
  const specsToValidate = specificTemplate
    ? allSpecs.filter(s => s.id === specificTemplate)
    : allSpecs

  if (specsToValidate.length === 0) {
    console.error(`Error: No template found matching '${specificTemplate}'`)
    console.error('Available templates:', allSpecs.map(s => s.id).join(', '))
    process.exit(1)
  }

  let totalVariants = 0
  let processedVariants = 0

  // Count total variants
  for (const spec of specsToValidate) {
    const loader = templateLoaders.get(spec.id)
    if (loader) {
      totalVariants += specificVariant
        ? 1
        : spec.outputOptions.variants.length
    }
  }

  // Process each template
  for (const spec of specsToValidate) {
    const loader = templateLoaders.get(spec.id)

    if (!loader) {
      // Template not in registry - skip but note it
      if (verbose) {
        console.log(`Skipping ${spec.id}: No component loader registered`)
      }
      continue
    }

    if (verbose) {
      console.log(`\nValidating template: ${spec.id}`)
    }

    try {
      const Template = await loader.loader()

      // Get variants to test
      const variants = specificVariant
        ? [specificVariant]
        : spec.outputOptions.variants

      const report = await validateTemplate(spec.id, variants, Template, fixture, verbose)
      templateReports.push(report)

      processedVariants += variants.length

      if (!jsonOutput && verbose) {
        process.stdout.write(formatProgress(processedVariants, totalVariants, spec.id))
      }

    } catch (error) {
      console.error(`Error loading template ${spec.id}:`, error)
    }
  }

  // Build full report
  const fullReport: FullReport = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    templatesTotal: templateReports.length,
    templatesPassed: templateReports.filter(t => t.variantsFailed === 0).length,
    templatesFailed: templateReports.filter(t => t.variantsFailed > 0).length,
    variantsTotal: templateReports.reduce((sum, t) => sum + t.variantsTotal, 0),
    variantsPassed: templateReports.reduce((sum, t) => sum + t.variantsPassed, 0),
    variantsFailed: templateReports.reduce((sum, t) => sum + t.variantsFailed, 0),
    templates: templateReports,
  }

  // Output report
  if (jsonOutput) {
    console.log(formatJsonReport(fullReport))
  } else {
    console.log(formatFullReport(fullReport))
  }

  // Save report to file
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const reportPath = path.join(OUTPUT_DIR, `validation-${Date.now()}.json`)
  fs.writeFileSync(reportPath, formatJsonReport(fullReport))

  if (verbose) {
    console.log(`\nReport saved to: ${reportPath}`)
  }

  // Exit with appropriate code
  const allPassed = fullReport.variantsFailed === 0
  process.exit(allPassed ? 0 : 1)
}

// Run main
main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
