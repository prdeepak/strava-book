/**
 * Book Reviewer Agent — Holistic Design Feedback Loop
 *
 * Evaluates the entire book — not just individual pages — and provides
 * actionable improvement suggestions. Uses the LLM provider chain
 * (Bedrock → Gemini → Anthropic) from visual-judge.ts.
 *
 * Input:  Book manifest + contact sheet images
 * Output: Scored review with prioritized suggestions
 */

import * as fs from 'fs'
import { callClaudeWithImages, isBedrockConfigured } from '@/lib/claude-client'
import { BookManifest } from './book-manifest'
import {
  buildReviewPrompt,
  BookReview,
  ReviewScore,
  ReviewSuggestion,
} from './book-reviewer-rubric'

// ============================================================================
// Types
// ============================================================================

export type { BookReview, ReviewScore, ReviewSuggestion }

export interface ReviewOptions {
  provider?: 'bedrock' | 'gemini' | 'anthropic' | 'auto'
  verbose?: boolean
}

// ============================================================================
// Provider Implementations
// ============================================================================

async function reviewWithBedrock(
  imagesBase64: string[],
  prompt: string,
  verbose: boolean
): Promise<string> {
  const images = imagesBase64.map(b64 => ({ base64: b64, format: 'png' as const }))
  const result = await callClaudeWithImages(images, prompt, {
    maxTokens: 4000,
    temperature: 0.1,
  })
  if (verbose) {
    console.log('[Book Reviewer] Bedrock response received')
  }
  return result
}

async function reviewWithGemini(
  imagesBase64: string[],
  prompt: string,
  verbose: boolean
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = imagesBase64.map(b64 => ({
    inline_data: {
      mime_type: 'image/png',
      data: b64,
    },
  }))
  parts.push({ text: prompt })

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4000,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  if (verbose) {
    console.log('[Book Reviewer] Gemini response received')
  }
  return data.candidates[0].content.parts[0].text
}

async function reviewWithAnthropic(
  imagesBase64: string[],
  prompt: string,
  verbose: boolean
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = imagesBase64.map(b64 => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: b64,
    },
  }))
  content.push({ type: 'text', text: prompt })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  if (verbose) {
    console.log('[Book Reviewer] Anthropic response received')
  }
  return data.content[0].text
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseReviewResponse(responseText: string): BookReview {
  let cleanJson = responseText.trim()

  // Strip markdown code fences if present
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

  // Validate and clamp scores to 1-10 range
  const scores: ReviewScore = {
    pacing: clampScore(parsed.scores?.pacing),
    variety: clampScore(parsed.scores?.variety),
    density: clampScore(parsed.scores?.density),
    rhythm: clampScore(parsed.scores?.rhythm),
    narrative: clampScore(parsed.scores?.narrative),
    engagement: clampScore(parsed.scores?.engagement),
  }

  // Compute overall as mean
  const scoreValues = Object.values(scores) as number[]
  const overallScore = Number(
    (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
  )

  // Validate suggestions
  const suggestions: ReviewSuggestion[] = (parsed.suggestions || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any): ReviewSuggestion => ({
      type: validateSuggestionType(s.type),
      page: s.page,
      pages: s.pages,
      from: s.from,
      to: s.to,
      reason: String(s.reason || ''),
      priority: validatePriority(s.priority),
    })
  )

  return {
    scores,
    overallScore,
    suggestions,
    summary: String(parsed.summary || ''),
  }
}

function clampScore(value: unknown): number {
  const num = Number(value)
  if (isNaN(num)) return 1
  return Math.max(1, Math.min(10, Math.round(num)))
}

function validateSuggestionType(
  type: unknown
): ReviewSuggestion['type'] {
  const valid: ReviewSuggestion['type'][] = [
    'swap_variant', 'remove_page', 'merge_pages', 'reorder', 'add_content', 'change_layout',
  ]
  if (typeof type === 'string' && valid.includes(type as ReviewSuggestion['type'])) {
    return type as ReviewSuggestion['type']
  }
  return 'change_layout'
}

function validatePriority(priority: unknown): ReviewSuggestion['priority'] {
  const valid: ReviewSuggestion['priority'][] = ['high', 'medium', 'low']
  if (typeof priority === 'string' && valid.includes(priority as ReviewSuggestion['priority'])) {
    return priority as ReviewSuggestion['priority']
  }
  return 'medium'
}

// ============================================================================
// Heuristic-based Review (No LLM Required)
// ============================================================================

/**
 * Generate a review using heuristic analysis of the manifest.
 * Used as a fallback when no LLM provider is configured, or for fast local testing.
 */
export function reviewBookHeuristic(manifest: BookManifest): BookReview {
  const pages = manifest.pages
  const suggestions: ReviewSuggestion[] = []

  // --- PACING ---
  let pacingScore = 7
  const racePages = pages.filter(p => p.type === 'RACE_PAGE')
  // Check for consecutive race pages
  for (let i = 0; i < pages.length - 1; i++) {
    if (pages[i].type === 'RACE_PAGE' && pages[i + 1].type === 'RACE_PAGE') {
      pacingScore -= 1
      suggestions.push({
        type: 'reorder',
        pages: [pages[i].pageNumber, pages[i + 1].pageNumber],
        reason: `Consecutive race pages (${pages[i].title}, ${pages[i + 1].title}) — add breathing room between them`,
        priority: 'high',
      })
    }
  }
  if (racePages.length === 0) pacingScore = Math.min(pacingScore, 5)

  // --- VARIETY ---
  let varietyScore = 7
  // Check for runs of same page type
  let maxRun = 1
  let currentRun = 1
  for (let i = 1; i < pages.length; i++) {
    if (pages[i].type === pages[i - 1].type) {
      currentRun++
      maxRun = Math.max(maxRun, currentRun)
    } else {
      currentRun = 1
    }
  }
  if (maxRun >= 4) {
    varietyScore -= 2
    suggestions.push({
      type: 'change_layout',
      reason: `${maxRun} consecutive pages of the same type — break up the monotony with a different layout or page type`,
      priority: 'high',
    })
  } else if (maxRun >= 3) {
    varietyScore -= 1
  }

  // Check ratio of unique types
  const uniqueTypes = new Set(pages.map(p => p.type))
  if (uniqueTypes.size < 4) varietyScore -= 1

  // --- DENSITY ---
  let densityScore = 7
  const sparsePages = pages.filter(p => {
    const noPhotos = (p.photoCount ?? 0) === 0
    const noWords = (p.wordCount ?? 0) < 5
    const isContentType = !['COVER', 'BACK_COVER', 'BLANK_PAGE', 'TABLE_OF_CONTENTS'].includes(p.type)
    return isContentType && noPhotos && noWords && !p.hasMap
  })
  if (sparsePages.length > 0) {
    densityScore -= Math.min(3, sparsePages.length)
    for (const sp of sparsePages.slice(0, 3)) {
      suggestions.push({
        type: 'remove_page',
        page: sp.pageNumber,
        reason: `Page ${sp.pageNumber} (${sp.type}) appears sparse — no photos, minimal text, no map`,
        priority: 'medium',
      })
    }
  }

  // --- RHYTHM ---
  let rhythmScore = 7
  // Approximate: pages with photos are "dark", pages without are "light"
  let consecutiveSameWeight = 1
  for (let i = 1; i < pages.length; i++) {
    const prevHasPhotos = (pages[i - 1].photoCount ?? 0) > 0
    const currHasPhotos = (pages[i].photoCount ?? 0) > 0
    if (prevHasPhotos === currHasPhotos) {
      consecutiveSameWeight++
      if (consecutiveSameWeight >= 5) {
        rhythmScore -= 1
      }
    } else {
      consecutiveSameWeight = 1
    }
  }

  // --- NARRATIVE ---
  let narrativeScore = 7
  // Check if there's a clear A-race
  if (!manifest.aRace) {
    narrativeScore -= 2
    suggestions.push({
      type: 'add_content',
      reason: 'No A-Race detected — consider highlighting the most important race as the book\'s climax',
      priority: 'medium',
    })
  } else {
    // Check if the A-race is positioned in the latter half of the book (building up to it)
    const aRacePage = pages.find(p => p.type === 'RACE_PAGE' && p.title?.includes(manifest.aRace!))
    if (aRacePage) {
      const positionRatio = aRacePage.pageNumber / manifest.totalPages
      if (positionRatio < 0.3) {
        narrativeScore -= 1
        suggestions.push({
          type: 'reorder',
          page: aRacePage.pageNumber,
          reason: `A-Race "${manifest.aRace}" appears too early (page ${aRacePage.pageNumber}/${manifest.totalPages}). Consider building up to it as a climax.`,
          priority: 'medium',
        })
      }
    }
  }

  // Check chronological ordering
  const monthPages = pages.filter(p => p.type === 'MONTHLY_DIVIDER')
  let isChronological = true
  for (let i = 1; i < monthPages.length; i++) {
    if ((monthPages[i].pageNumber) < (monthPages[i - 1].pageNumber)) {
      isChronological = false
      break
    }
  }
  if (!isChronological) narrativeScore -= 2

  // --- ENGAGEMENT ---
  let engagementScore = 6
  const totalPhotos = pages.reduce((sum, p) => sum + (p.photoCount ?? 0), 0)
  const pagesWithPhotos = pages.filter(p => (p.photoCount ?? 0) > 0).length
  const photoRatio = manifest.totalPages > 0 ? pagesWithPhotos / manifest.totalPages : 0

  if (photoRatio > 0.4) engagementScore += 1
  if (photoRatio > 0.6) engagementScore += 1
  if (photoRatio < 0.2) {
    engagementScore -= 2
    suggestions.push({
      type: 'add_content',
      reason: `Only ${Math.round(photoRatio * 100)}% of pages have photos — add more visual content for engagement`,
      priority: 'high',
    })
  }
  if (totalPhotos === 0) engagementScore = Math.max(1, engagementScore - 2)

  // Ensure minimum suggestion count
  if (suggestions.length < 5) {
    // Add generic improvement suggestions
    if (!suggestions.find(s => s.type === 'swap_variant')) {
      const firstRace = racePages[0]
      if (firstRace) {
        suggestions.push({
          type: 'swap_variant',
          page: firstRace.pageNumber,
          from: 'default',
          to: 'editorial',
          reason: `Consider using an editorial variant for "${firstRace.title}" for a magazine-style treatment`,
          priority: 'low',
        })
      }
    }
    if (!suggestions.find(s => s.type === 'change_layout') && pages.length > 10) {
      suggestions.push({
        type: 'change_layout',
        reason: 'Consider varying the layout styles more across the book to maintain visual interest',
        priority: 'low',
      })
    }
    // Pad with low-priority suggestions if still under 5
    while (suggestions.length < 5) {
      suggestions.push({
        type: 'change_layout',
        reason: 'Review overall visual weight distribution and consider rebalancing photo-heavy and text-heavy pages',
        priority: 'low',
      })
    }
  }

  // Clamp all scores
  const scores: ReviewScore = {
    pacing: Math.max(1, Math.min(10, pacingScore)),
    variety: Math.max(1, Math.min(10, varietyScore)),
    density: Math.max(1, Math.min(10, densityScore)),
    rhythm: Math.max(1, Math.min(10, rhythmScore)),
    narrative: Math.max(1, Math.min(10, narrativeScore)),
    engagement: Math.max(1, Math.min(10, engagementScore)),
  }

  const scoreValues = Object.values(scores) as number[]
  const overallScore = Number(
    (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
  )

  return {
    scores,
    overallScore,
    suggestions,
    summary: `Book has ${manifest.totalPages} pages with ${manifest.raceCount} races across ${manifest.monthCount} months. ${manifest.aRace ? `A-Race: "${manifest.aRace}".` : 'No A-Race detected.'} Photo coverage: ${Math.round(photoRatio * 100)}% of pages.`,
  }
}

// ============================================================================
// Main Review Function (LLM-powered)
// ============================================================================

/**
 * Review a book using LLM analysis of contact sheets + manifest.
 *
 * Falls back to heuristic review if no LLM provider is configured.
 *
 * @param manifest - Book manifest describing all pages
 * @param contactSheetPaths - Paths to contact sheet PNG files
 * @param options - Review options (provider, verbose)
 */
export async function reviewBook(
  manifest: BookManifest,
  contactSheetPaths: string[],
  options: ReviewOptions = {}
): Promise<BookReview> {
  const { provider = 'auto', verbose = false } = options

  if (verbose) {
    console.log(`[Book Reviewer] Reviewing book: ${manifest.totalPages} pages, ${manifest.raceCount} races`)
    console.log(`[Book Reviewer] Contact sheets: ${contactSheetPaths.length}`)
  }

  // If no contact sheets or no provider, fall back to heuristic review
  if (contactSheetPaths.length === 0) {
    if (verbose) {
      console.log('[Book Reviewer] No contact sheets provided, using heuristic review')
    }
    return reviewBookHeuristic(manifest)
  }

  // Build available providers list
  const availableProviders: Array<'bedrock' | 'gemini' | 'anthropic'> = []
  if (provider === 'auto') {
    if (isBedrockConfigured()) availableProviders.push('bedrock')
    if (process.env.GEMINI_API_KEY) availableProviders.push('gemini')
    if (process.env.ANTHROPIC_API_KEY) availableProviders.push('anthropic')
  } else {
    availableProviders.push(provider)
  }

  // Fall back to heuristic if no LLM is configured
  if (availableProviders.length === 0) {
    if (verbose) {
      console.log('[Book Reviewer] No LLM providers configured, using heuristic review')
    }
    return reviewBookHeuristic(manifest)
  }

  // Read contact sheet images
  const imagesBase64: string[] = []
  for (const sheetPath of contactSheetPaths) {
    const buffer = fs.readFileSync(sheetPath)
    imagesBase64.push(buffer.toString('base64'))
  }

  const prompt = buildReviewPrompt(manifest)

  // Try providers in order
  let responseText = ''
  for (const p of availableProviders) {
    try {
      if (p === 'bedrock') {
        responseText = await reviewWithBedrock(imagesBase64, prompt, verbose)
      } else if (p === 'gemini') {
        responseText = await reviewWithGemini(imagesBase64, prompt, verbose)
      } else {
        responseText = await reviewWithAnthropic(imagesBase64, prompt, verbose)
      }
      if (verbose) {
        console.log(`[Book Reviewer] Used provider: ${p}`)
      }
      break
    } catch (error) {
      if (verbose) {
        console.log(`[Book Reviewer] ${p} failed, trying next...`, error)
      }
      if (p === availableProviders[availableProviders.length - 1]) {
        // All providers failed — fall back to heuristic
        if (verbose) {
          console.log('[Book Reviewer] All LLM providers failed, using heuristic review')
        }
        return reviewBookHeuristic(manifest)
      }
    }
  }

  // Parse LLM response
  try {
    return parseReviewResponse(responseText)
  } catch {
    if (verbose) {
      console.log('[Book Reviewer] Failed to parse LLM response, falling back to heuristic')
      console.log('[Book Reviewer] Raw response:', responseText.slice(0, 500))
    }
    return reviewBookHeuristic(manifest)
  }
}
