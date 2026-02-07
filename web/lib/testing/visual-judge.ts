/**
 * Visual Judge - LLM-as-judge for PDF template evaluation
 *
 * Evaluates PDF page screenshots against print quality criteria.
 * Supports AWS Bedrock (Sonnet) and Gemini with automatic fallback via llm-provider.
 */

import * as fs from 'fs'
import { callLlmWithImages, stripJsonFences } from '@/lib/llm-provider'

// ============================================================================
// Types
// ============================================================================

export interface VisualJudgment {
    pass: boolean
    overallScore: number  // 0-100
    criteria: {
        printReadability: CriterionScore
        layoutBalance: CriterionScore
        brandCohesion: CriterionScore
    }
    summary: string
    suggestions: string[]
    rawResponse?: string  // For debugging
    provider?: string
    model?: string
}

export interface CriterionScore {
    score: number  // 0-100
    issues: string[]
}

export interface JudgeContext {
    templateName: string
    pageType: string
    pageNumber?: number
    theme?: {
        primaryColor: string
        accentColor: string
        backgroundColor: string
    }
    customPrompt?: string  // Override default prompt (for graphic tests)
}

export interface JudgeOptions {
    verbose?: boolean
}

// ============================================================================
// Prompt
// ============================================================================

const JUDGE_PROMPT = `You are evaluating a PDF page screenshot for print quality. This page will be printed in a coffee-table book.

Template: {templateName}
Page Type: {pageType}
{themeInfo}

Evaluate on these criteria (score 0-100 each):

1. PRINT READABILITY (33%)
- Is body text large enough to read in print (>= 10pt equivalent)?
- Is there sufficient contrast between text and background?
- Is critical content within safe margins (not too close to edges)?
- Is text clearly separated from images?

2. LAYOUT BALANCE (33%)
- Is visual weight distributed across the page?
- Is there appropriate whitespace (not cramped or empty)?
- Are elements aligned consistently?
- Are images properly sized and positioned?

3. BRAND COHESION (33%)
- Do colors match the provided theme palette?
- Are fonts used consistently (headings vs body)?
- Is spacing rhythm consistent?
- Does the overall style match a professional print publication?

IMPORTANT: Be constructive but critical. This feedback will be used by an AI agent to iterate and improve the template. Specific, actionable feedback is most valuable.

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "printReadability": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "layoutBalance": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "brandCohesion": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "overallScore": <0-100>,
  "pass": <true if overall >= 70 and no criterion below 50>,
  "summary": "Brief 1-2 sentence assessment",
  "suggestions": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"]
}`

function buildPrompt(context: JudgeContext): string {
    // Use custom prompt if provided (for graphic tests)
    if (context.customPrompt) {
        return context.customPrompt
    }

    let themeInfo = ''
    if (context.theme) {
        themeInfo = `Theme: Primary=${context.theme.primaryColor}, Accent=${context.theme.accentColor}, Background=${context.theme.backgroundColor}`
    }

    return JUDGE_PROMPT
        .replace('{templateName}', context.templateName)
        .replace('{pageType}', context.pageType)
        .replace('{themeInfo}', themeInfo)
}

// ============================================================================
// Main Judge Function
// ============================================================================

export async function judgePageVisual(
    imagePath: string,
    context: JudgeContext,
    options: JudgeOptions = {}
): Promise<VisualJudgment> {
    const { verbose = false } = options

    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath)
    const imageBase64 = imageBuffer.toString('base64')

    const prompt = buildPrompt(context)

    if (verbose) {
        console.log(`[Visual Judge] Evaluating ${imagePath}`)
        console.log(`[Visual Judge] Template: ${context.templateName}, Page: ${context.pageType}`)
    }

    let result
    try {
        result = await callLlmWithImages(
            [{ base64: imageBase64, format: 'png' }],
            prompt,
            { maxTokens: 2000, temperature: 0.1, logPrefix: '[Visual Judge]', verbose }
        )
    } catch (error) {
        throw new Error(`All providers failed. Last error: ${error}`)
    }

    try {
        const cleanJson = stripJsonFences(result.text)
        const parsed = JSON.parse(cleanJson)
        return {
            pass: parsed.pass,
            overallScore: parsed.overallScore,
            criteria: {
                printReadability: parsed.printReadability,
                layoutBalance: parsed.layoutBalance,
                brandCohesion: parsed.brandCohesion
            },
            summary: parsed.summary,
            suggestions: parsed.suggestions || [],
            rawResponse: verbose ? result.text : undefined,
            provider: result.provider,
            model: result.model
        }
    } catch (parseError) {
        // Return a failure judgment if we can't parse
        return {
            pass: false,
            overallScore: 0,
            criteria: {
                printReadability: { score: 0, issues: ['Failed to parse LLM response'] },
                layoutBalance: { score: 0, issues: ['Failed to parse LLM response'] },
                brandCohesion: { score: 0, issues: ['Failed to parse LLM response'] }
            },
            summary: `Failed to parse judge response: ${parseError}`,
            suggestions: ['Check LLM output format'],
            rawResponse: result.text
        }
    }
}

// ============================================================================
// Batch Evaluation
// ============================================================================

export interface BatchResult {
    results: Array<{
        imagePath: string
        context: JudgeContext
        judgment: VisualJudgment
    }>
    summary: {
        total: number
        passed: number
        failed: number
        averageScore: number
    }
}

export async function judgeMultiplePages(
    pages: Array<{ imagePath: string; context: JudgeContext }>,
    options: JudgeOptions = {}
): Promise<BatchResult> {
    const results: BatchResult['results'] = []

    for (const page of pages) {
        const judgment = await judgePageVisual(page.imagePath, page.context, options)
        results.push({
            imagePath: page.imagePath,
            context: page.context,
            judgment
        })
    }

    const passed = results.filter(r => r.judgment.pass).length
    const totalScore = results.reduce((sum, r) => sum + r.judgment.overallScore, 0)

    return {
        results,
        summary: {
            total: results.length,
            passed,
            failed: results.length - passed,
            averageScore: results.length > 0 ? Math.round(totalScore / results.length) : 0
        }
    }
}

// ============================================================================
// Book-Level Visual Judgment
// ============================================================================

export interface BookJudgment {
    coherence: CriterionScore    // Consistent theme across pages
    flow: CriterionScore         // Logical page ordering
    coverage: CriterionScore     // All sections present & balanced
    overallScore: number
    suggestions: string[]
    pass: boolean
    summary: string
    rawResponse?: string
    provider?: string
    model?: string
}

export interface BookContext {
    bookTitle: string
    year: number
    pageCount: number
    theme?: {
        primaryColor: string
        accentColor: string
        backgroundColor: string
    }
}

const BOOK_JUDGE_PROMPT = `You are evaluating a complete coffee-table book PDF. You will see multiple pages from the book to assess overall quality and coherence.

Book Title: {bookTitle}
Year: {year}
Page Count: {pageCount}
{themeInfo}

You are looking at pages from the beginning, middle, and end of the book. Evaluate the BOOK AS A WHOLE on these criteria (score 0-100 each):

1. COHERENCE (33%)
- Is there a consistent visual theme across all pages?
- Are colors, fonts, and spacing consistent throughout?
- Does it feel like one unified publication, not a collection of random pages?
- Are design elements (headers, stats boxes, photo treatments) consistent?

2. FLOW (33%)
- Does the book have a logical progression (cover → intro → content → conclusion)?
- Are pages in sensible order (chronological, by event importance, etc.)?
- Are there smooth transitions between sections?
- Does the pacing feel right (not too rushed, not too slow)?

3. COVERAGE (33%)
- Is there good variety in content types (races, stats, monthly summaries, photos)?
- Are all major sections present (cover, year stats, monthly dividers, activities, back cover)?
- Is the content balanced (not too heavy on any one section)?
- Are key activities and achievements properly highlighted?

IMPORTANT: This feedback will be used by an AI agent to iterate and improve the book design. Be specific about what works and what needs improvement.

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "coherence": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "flow": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "coverage": { "score": <0-100>, "issues": ["issue1", "issue2"] },
  "overallScore": <0-100>,
  "pass": <true if overall >= 70 and no criterion below 50>,
  "summary": "Brief 2-3 sentence assessment of the book as a whole",
  "suggestions": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"]
}`

function buildBookPrompt(context: BookContext): string {
    let themeInfo = ''
    if (context.theme) {
        themeInfo = `Theme: Primary=${context.theme.primaryColor}, Accent=${context.theme.accentColor}, Background=${context.theme.backgroundColor}`
    }

    return BOOK_JUDGE_PROMPT
        .replace('{bookTitle}', context.bookTitle)
        .replace('{year}', String(context.year))
        .replace('{pageCount}', String(context.pageCount))
        .replace('{themeInfo}', themeInfo)
}

/**
 * Judge a complete book by evaluating multiple sample pages
 *
 * @param imagePaths Array of paths to page images (should include cover, middle pages, back cover)
 * @param context Book metadata for evaluation
 * @param options Judge options
 */
export async function judgeBook(
    imagePaths: string[],
    context: BookContext,
    options: JudgeOptions = {}
): Promise<BookJudgment> {
    const { verbose = false } = options

    if (imagePaths.length === 0) {
        return {
            coherence: { score: 0, issues: ['No pages provided for evaluation'] },
            flow: { score: 0, issues: ['No pages provided for evaluation'] },
            coverage: { score: 0, issues: ['No pages provided for evaluation'] },
            overallScore: 0,
            pass: false,
            summary: 'Cannot evaluate book: no pages provided',
            suggestions: ['Provide page images for evaluation']
        }
    }

    // Select representative pages: first, some from middle, and last
    const selectedPages = selectRepresentativePages(imagePaths)

    if (verbose) {
        console.log(`[Visual Judge] Evaluating book with ${selectedPages.length} sample pages`)
    }

    // Read all selected images and convert to base64
    const imageData: Array<{ base64: string; pageNum: number }> = []
    for (const { path: imgPath, pageNum } of selectedPages) {
        const imageBuffer = fs.readFileSync(imgPath)
        imageData.push({
            base64: imageBuffer.toString('base64'),
            pageNum
        })
    }

    const prompt = buildBookPrompt(context)

    const imagesForLlm = imageData.map(img => ({ base64: img.base64, format: 'png' as const }))

    let result
    try {
        result = await callLlmWithImages(
            imagesForLlm,
            prompt,
            { maxTokens: 2000, temperature: 0.1, logPrefix: '[Visual Judge]', verbose }
        )
    } catch (error) {
        throw new Error(`All providers failed. Last error: ${error}`)
    }

    try {
        const cleanJson = stripJsonFences(result.text)
        const parsed = JSON.parse(cleanJson)
        return {
            coherence: parsed.coherence,
            flow: parsed.flow,
            coverage: parsed.coverage,
            overallScore: parsed.overallScore,
            pass: parsed.pass,
            summary: parsed.summary,
            suggestions: parsed.suggestions || [],
            rawResponse: verbose ? result.text : undefined,
            provider: result.provider,
            model: result.model
        }
    } catch (parseError) {
        return {
            coherence: { score: 0, issues: ['Failed to parse LLM response'] },
            flow: { score: 0, issues: ['Failed to parse LLM response'] },
            coverage: { score: 0, issues: ['Failed to parse LLM response'] },
            overallScore: 0,
            pass: false,
            summary: `Failed to parse judge response: ${parseError}`,
            suggestions: ['Check LLM output format'],
            rawResponse: result.text
        }
    }
}

/**
 * Select representative pages from a book for evaluation
 * Returns pages from beginning, middle, and end
 */
function selectRepresentativePages(
    imagePaths: string[],
    maxPages: number = 5
): Array<{ path: string; pageNum: number }> {
    const total = imagePaths.length
    const selected: Array<{ path: string; pageNum: number }> = []

    if (total <= maxPages) {
        // Return all pages if we have fewer than max
        return imagePaths.map((p, i) => ({ path: p, pageNum: i + 1 }))
    }

    // Always include first page (cover)
    selected.push({ path: imagePaths[0], pageNum: 1 })

    // Always include last page (back cover)
    selected.push({ path: imagePaths[total - 1], pageNum: total })

    // Add evenly distributed pages from the middle
    const middleCount = maxPages - 2
    for (let i = 1; i <= middleCount; i++) {
        const idx = Math.floor((i * total) / (middleCount + 1))
        if (idx > 0 && idx < total - 1) {
            selected.push({ path: imagePaths[idx], pageNum: idx + 1 })
        }
    }

    // Sort by page number
    selected.sort((a, b) => a.pageNum - b.pageNum)

    return selected
}


// ============================================================================
// CLI Interface (for testing)
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2)

    if (args.length < 1) {
        console.log('Usage: npx ts-node visual-judge.ts <image-path> [template-name] [page-type]')
        process.exit(1)
    }

    const imagePath = args[0]
    const templateName = args[1] || 'Unknown'
    const pageType = args[2] || 'Unknown'

    judgePageVisual(imagePath, { templateName, pageType }, { verbose: true })
        .then(result => {
            console.log('\n=== Judgment Result ===')
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.pass ? 0 : 1)
        })
        .catch(error => {
            console.error('Error:', error)
            process.exit(1)
        })
}
