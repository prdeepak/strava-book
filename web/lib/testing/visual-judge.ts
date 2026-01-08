/**
 * Visual Judge - LLM-as-judge for PDF template evaluation
 *
 * Evaluates PDF page screenshots against print quality criteria.
 * Supports AWS Bedrock (Sonnet), Gemini, and Anthropic API with automatic fallback.
 */

import * as fs from 'fs'
import * as path from 'path'

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
}

export interface JudgeOptions {
    provider?: 'bedrock' | 'gemini' | 'anthropic' | 'auto'
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
// Provider Implementations
// ============================================================================

async function judgeWithBedrock(
    imageBase64: string,
    prompt: string,
    verbose: boolean
): Promise<string> {
    // AWS Bedrock using API key (bearer token) authentication
    // See: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html

    const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK
    if (!apiKey) {
        throw new Error('AWS_BEARER_TOKEN_BEDROCK not set')
    }

    const region = process.env.AWS_REGION || 'us-east-1'
    const modelId = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`

    const payload = {
        messages: [
            {
                role: "user",
                content: [
                    {
                        image: {
                            format: "png",
                            source: {
                                bytes: imageBase64
                            }
                        }
                    },
                    {
                        text: prompt
                    }
                ]
            }
        ],
        inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.1
        }
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Bedrock API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    if (verbose) {
        console.log('[Visual Judge] Bedrock response received')
    }

    // Converse API returns different structure
    return data.output.message.content[0].text
}

async function judgeWithGemini(
    imageBase64: string,
    prompt: string,
    verbose: boolean
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not set')
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const payload = {
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: "image/png",
                        data: imageBase64
                    }
                },
                {
                    text: prompt
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000
        }
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    if (verbose) {
        console.log('[Visual Judge] Gemini response received')
    }

    return data.candidates[0].content.parts[0].text
}

async function judgeWithAnthropic(
    imageBase64: string,
    prompt: string,
    verbose: boolean
): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/png',
                            data: imageBase64
                        }
                    },
                    {
                        type: 'text',
                        text: prompt
                    }
                ]
            }]
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Anthropic API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    if (verbose) {
        console.log('[Visual Judge] Anthropic response received')
    }

    return data.content[0].text
}

// ============================================================================
// Main Judge Function
// ============================================================================

export async function judgePageVisual(
    imagePath: string,
    context: JudgeContext,
    options: JudgeOptions = {}
): Promise<VisualJudgment> {
    const { provider = 'auto', verbose = false } = options

    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath)
    const imageBase64 = imageBuffer.toString('base64')

    const prompt = buildPrompt(context)

    if (verbose) {
        console.log(`[Visual Judge] Evaluating ${imagePath}`)
        console.log(`[Visual Judge] Template: ${context.templateName}, Page: ${context.pageType}`)
    }

    let responseText: string = ''
    let usedProvider: string = ''

    // Try providers in order: Bedrock → Gemini → Anthropic
    // Skip providers that aren't configured
    const availableProviders: Array<'bedrock' | 'gemini' | 'anthropic'> = []
    if (provider === 'auto') {
        // Only include Bedrock if API key is configured
        if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
            availableProviders.push('bedrock')
        }
        if (process.env.GEMINI_API_KEY) {
            availableProviders.push('gemini')
        }
        if (process.env.ANTHROPIC_API_KEY) {
            availableProviders.push('anthropic')
        }
        if (availableProviders.length === 0) {
            throw new Error('No LLM providers configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or AWS credentials.')
        }
    } else {
        availableProviders.push(provider)
    }

    const providers = availableProviders

    for (const p of providers) {
        try {
            if (p === 'bedrock') {
                responseText = await judgeWithBedrock(imageBase64, prompt, verbose)
            } else if (p === 'gemini') {
                responseText = await judgeWithGemini(imageBase64, prompt, verbose)
            } else {
                responseText = await judgeWithAnthropic(imageBase64, prompt, verbose)
            }
            usedProvider = p
            break
        } catch (error) {
            if (verbose) {
                console.log(`[Visual Judge] ${p} failed, trying next...`)
            }
            if (p === providers[providers.length - 1]) {
                throw new Error(`All providers failed. Last error: ${error}`)
            }
        }
    }

    if (verbose) {
        console.log(`[Visual Judge] Used provider: ${usedProvider!}`)
    }

    // Parse JSON response
    try {
        // Clean up response - remove markdown code blocks if present
        let cleanJson = responseText!.trim()
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.slice(7)
        }
        if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.slice(3)
        }
        if (cleanJson.endsWith('```')) {
            cleanJson = cleanJson.slice(0, -3)
        }
        cleanJson = cleanJson.trim()

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
            rawResponse: verbose ? responseText : undefined
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
            rawResponse: responseText
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
