/**
 * Shared LLM Provider Module
 *
 * Unified interface for calling LLMs with images.
 * Fallback chain: Bedrock (Sonnet 4) → Gemini 3 Flash.
 */

import { callClaudeWithImages, isBedrockConfigured } from '@/lib/claude-client'

// ============================================================================
// Types
// ============================================================================

export type LlmProvider = 'bedrock' | 'gemini'

export interface LlmResult {
  text: string
  provider: LlmProvider
  model: string
}

export interface LlmOptions {
  maxTokens?: number
  temperature?: number
  logPrefix?: string
  verbose?: boolean
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Call an LLM with images using the Bedrock → Gemini fallback chain.
 * Throws if all providers fail (callers handle heuristic fallback).
 */
export async function callLlmWithImages(
  images: Array<{ base64: string; format?: 'png' | 'jpeg' | 'gif' | 'webp' }>,
  prompt: string,
  options: LlmOptions = {}
): Promise<LlmResult> {
  const {
    maxTokens = 2000,
    temperature = 0.1,
    logPrefix = '[LLM]',
    verbose = false,
  } = options

  const providers = getAvailableProviders()
  if (providers.length === 0) {
    throw new Error('No LLM providers configured. Set AWS_BEARER_TOKEN_BEDROCK or GEMINI_API_KEY.')
  }

  let lastError: unknown
  for (const provider of providers) {
    try {
      const text = provider === 'bedrock'
        ? await callBedrock(images, prompt, maxTokens, temperature)
        : await callGemini(images, prompt, maxTokens, temperature)

      const model = provider === 'bedrock'
        ? 'us.anthropic.claude-sonnet-4-20250514-v1:0'
        : 'gemini-3-flash-preview'

      if (verbose) {
        console.log(`${logPrefix} Used provider: ${provider} (${model})`)
      }

      return { text, provider, model }
    } catch (error) {
      lastError = error
      if (verbose) {
        console.log(`${logPrefix} ${provider} failed, trying next...`)
      }
    }
  }

  throw new Error(`All LLM providers failed. Last error: ${lastError}`)
}

/**
 * Return the list of configured providers in fallback order.
 */
export function getAvailableProviders(): LlmProvider[] {
  const providers: LlmProvider[] = []
  if (isBedrockConfigured()) providers.push('bedrock')
  if (process.env.GEMINI_API_KEY) providers.push('gemini')
  return providers
}

/**
 * Strip ```json fences from LLM responses.
 */
export function stripJsonFences(text: string): string {
  let clean = text.trim()
  if (clean.startsWith('```json')) clean = clean.slice(7)
  if (clean.startsWith('```')) clean = clean.slice(3)
  if (clean.endsWith('```')) clean = clean.slice(0, -3)
  return clean.trim()
}

// ============================================================================
// Provider Implementations
// ============================================================================

async function callBedrock(
  images: Array<{ base64: string; format?: 'png' | 'jpeg' | 'gif' | 'webp' }>,
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  return callClaudeWithImages(
    images.map(img => ({ base64: img.base64, format: img.format || 'png' })),
    prompt,
    { maxTokens, temperature }
  )
}

async function callGemini(
  images: Array<{ base64: string; format?: 'png' | 'jpeg' | 'gif' | 'webp' }>,
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const formatToMime: Record<string, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = images.map(img => ({
    inline_data: {
      mime_type: formatToMime[img.format || 'png'] || 'image/png',
      data: img.base64,
    },
  }))
  parts.push({ text: prompt })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}
