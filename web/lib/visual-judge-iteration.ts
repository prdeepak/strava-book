/**
 * Visual Judge Iteration Helper
 *
 * Provides utilities for iteratively improving template designs
 * using visual-judge feedback until a target score is reached.
 */

import { renderToBuffer, DocumentProps } from '@react-pdf/renderer'
import { ReactElement } from 'react'
import { judgePageVisual, VisualJudgment, JudgeContext } from './testing/visual-judge'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ============================================================================
// Types
// ============================================================================

export interface IterationResult {
  finalScore: number
  iterations: number
  allScores: number[]
  allJudgments: VisualJudgment[]
  passed: boolean
  finalParams: Record<string, unknown>
}

export interface IterationOptions {
  maxIterations?: number
  targetScore?: number
  verbose?: boolean
  tempDir?: string
}

export interface ParameterAdjustment {
  param: string
  direction: 'increase' | 'decrease'
  magnitude: number
}

// ============================================================================
// PDF to Image Conversion
// ============================================================================

/**
 * Convert a PDF buffer to PNG images
 * Uses poppler-utils (pdftoppm) for conversion
 *
 * Note: This is a server-side only function that requires poppler-utils to be installed
 */
async function pdfBufferToImage(pdfBuffer: Buffer, tempDir: string): Promise<string> {
  const pdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`)
  const pngBasePath = path.join(tempDir, `temp-${Date.now()}`)
  const pngPath = `${pngBasePath}-1.png`

  // Write PDF to temp file
  fs.writeFileSync(pdfPath, pdfBuffer)

  try {
    // Use poppler-utils pdftoppm for PDF to image conversion
    const { execSync } = await import('child_process')

    execSync(`pdftoppm -png -f 1 -l 1 -r 150 "${pdfPath}" "${pngBasePath}"`, {
      stdio: 'pipe',
    })

    // Cleanup PDF
    fs.unlinkSync(pdfPath)

    // Check if image was created
    if (!fs.existsSync(pngPath)) {
      throw new Error('PDF to image conversion failed - no output image')
    }

    return pngPath
  } catch (error) {
    // Cleanup
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath)
    }

    console.warn('[VisualJudgeIteration] pdftoppm not available:', error)
    throw new Error('PDF to image conversion not available - install poppler-utils')
  }
}

// ============================================================================
// Parameter Adjustment Strategies
// ============================================================================

/**
 * Analyze visual judge feedback and suggest parameter adjustments
 */
export function analyzeJudgmentForAdjustments(
  judgment: VisualJudgment,
  templateType: 'foreword' | 'monthly_divider' | 'generic'
): ParameterAdjustment[] {
  const adjustments: ParameterAdjustment[] = []
  const { criteria, suggestions } = judgment

  // Check print readability issues
  if (criteria.printReadability.score < 70) {
    const issues = criteria.printReadability.issues.join(' ').toLowerCase()

    if (issues.includes('small') || issues.includes('font') || issues.includes('text size')) {
      adjustments.push({
        param: 'fontSize',
        direction: 'increase',
        magnitude: 2,
      })
    }

    if (issues.includes('contrast') || issues.includes('background')) {
      if (templateType === 'foreword' || templateType === 'monthly_divider') {
        adjustments.push({
          param: 'backgroundOpacity',
          direction: 'decrease',
          magnitude: 0.05,
        })
      }
    }

    if (issues.includes('margin') || issues.includes('edge')) {
      adjustments.push({
        param: 'margins',
        direction: 'increase',
        magnitude: 0.1, // 10% increase
      })
    }
  }

  // Check layout balance issues
  if (criteria.layoutBalance.score < 70) {
    const issues = criteria.layoutBalance.issues.join(' ').toLowerCase()

    if (issues.includes('cramped') || issues.includes('crowded')) {
      adjustments.push({
        param: 'spacing',
        direction: 'increase',
        magnitude: 1.2,
      })
    }

    if (issues.includes('empty') || issues.includes('sparse')) {
      adjustments.push({
        param: 'spacing',
        direction: 'decrease',
        magnitude: 0.8,
      })
    }

    if (issues.includes('photo') || issues.includes('image')) {
      if (templateType === 'monthly_divider') {
        adjustments.push({
          param: 'photoSize',
          direction: issues.includes('small') ? 'increase' : 'decrease',
          magnitude: 0.1,
        })
      }
    }
  }

  return adjustments
}

/**
 * Apply parameter adjustments to create new params
 */
export function applyAdjustments(
  currentParams: Record<string, unknown>,
  adjustments: ParameterAdjustment[]
): Record<string, unknown> {
  const newParams = { ...currentParams }

  for (const adj of adjustments) {
    const currentValue = currentParams[adj.param]

    if (typeof currentValue === 'number') {
      if (adj.direction === 'increase') {
        newParams[adj.param] = currentValue + adj.magnitude
      } else {
        newParams[adj.param] = currentValue - adj.magnitude
      }
    }
  }

  return newParams
}

// ============================================================================
// Main Iteration Function
// ============================================================================

/**
 * Iteratively improve a template design using visual-judge feedback
 *
 * @param renderTemplate - Function that renders a React PDF Document element given parameters
 * @param initialParams - Starting parameter values
 * @param judgeContext - Context for the visual judge
 * @param options - Iteration options
 * @returns Iteration result with final score and parameters
 */
export async function iterateWithVisualJudge(
  renderTemplate: (params: Record<string, unknown>) => ReactElement<DocumentProps>,
  initialParams: Record<string, unknown>,
  judgeContext: JudgeContext,
  options: IterationOptions = {}
): Promise<IterationResult> {
  const {
    maxIterations = 5,
    targetScore = 80,
    verbose = false,
    tempDir = os.tmpdir(),
  } = options

  let currentParams = { ...initialParams }
  const allScores: number[] = []
  const allJudgments: VisualJudgment[] = []

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (verbose) {
      console.log(`[VisualJudgeIteration] Iteration ${iteration}/${maxIterations}`)
    }

    try {
      // Render template to PDF buffer
      const pdfBuffer = await renderToBuffer(renderTemplate(currentParams))

      // Convert PDF to image
      const imagePath = await pdfBufferToImage(Buffer.from(pdfBuffer), tempDir)

      // Judge the image
      const judgment = await judgePageVisual(imagePath, judgeContext, { verbose })

      allScores.push(judgment.overallScore)
      allJudgments.push(judgment)

      // Cleanup temp image
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }

      if (verbose) {
        console.log(`[VisualJudgeIteration] Score: ${judgment.overallScore}`)
      }

      // Check if we've reached the target
      if (judgment.overallScore >= targetScore) {
        return {
          finalScore: judgment.overallScore,
          iterations: iteration,
          allScores,
          allJudgments,
          passed: true,
          finalParams: currentParams,
        }
      }

      // If not the last iteration, analyze and adjust
      if (iteration < maxIterations) {
        const templateType = judgeContext.pageType.toLowerCase().includes('foreword')
          ? 'foreword'
          : judgeContext.pageType.toLowerCase().includes('divider')
          ? 'monthly_divider'
          : 'generic'

        const adjustments = analyzeJudgmentForAdjustments(judgment, templateType)
        currentParams = applyAdjustments(currentParams, adjustments)

        if (verbose && adjustments.length > 0) {
          console.log(`[VisualJudgeIteration] Applying ${adjustments.length} adjustments`)
        }
      }
    } catch (error) {
      if (verbose) {
        console.error(`[VisualJudgeIteration] Iteration ${iteration} failed:`, error)
      }

      // On error, record a score of 0 and continue
      allScores.push(0)
      allJudgments.push({
        pass: false,
        overallScore: 0,
        criteria: {
          printReadability: { score: 0, issues: ['Iteration failed'] },
          layoutBalance: { score: 0, issues: ['Iteration failed'] },
          brandCohesion: { score: 0, issues: ['Iteration failed'] },
        },
        summary: `Iteration failed: ${error}`,
        suggestions: [],
      })
    }
  }

  // Return best result after all iterations
  const bestScore = Math.max(...allScores)
  const bestIndex = allScores.indexOf(bestScore)

  return {
    finalScore: bestScore,
    iterations: maxIterations,
    allScores,
    allJudgments,
    passed: bestScore >= targetScore,
    finalParams: currentParams,
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a simple iteration result for templates that don't need iteration
 * (e.g., when visual judge is disabled or not available)
 */
export function createSkippedIterationResult(): IterationResult {
  return {
    finalScore: 0,
    iterations: 0,
    allScores: [],
    allJudgments: [],
    passed: true, // Consider skipped as passed
    finalParams: {},
  }
}
