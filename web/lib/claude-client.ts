/**
 * Claude AI Client via AWS Bedrock
 *
 * Provides a unified interface for calling Claude via AWS Bedrock using bearer token auth.
 * Used for foreword generation, visual judging, and other AI features.
 *
 * Authentication: Uses AWS_BEARER_TOKEN_BEDROCK environment variable.
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html
 */

// Claude Sonnet model ID on Bedrock
const CLAUDE_MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export interface ClaudeContentBlock {
  type: 'text' | 'image'
  text?: string
  // For images
  format?: 'png' | 'jpeg' | 'gif' | 'webp'
  base64?: string
}

export interface ClaudeResponse {
  content: string
  stopReason: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Check if AWS Bedrock is configured
 */
export function isBedrockConfigured(): boolean {
  return !!process.env.AWS_BEARER_TOKEN_BEDROCK
}

/**
 * Call Claude via AWS Bedrock using bearer token authentication
 */
export async function callClaude(
  messages: ClaudeMessage[],
  options: {
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
  } = {}
): Promise<ClaudeResponse> {
  const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options

  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK
  if (!apiKey) {
    throw new Error('AWS_BEARER_TOKEN_BEDROCK not set')
  }

  const region = process.env.AWS_REGION || 'us-east-1'
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${CLAUDE_MODEL_ID}/converse`

  // Convert messages to Bedrock Converse API format
  const bedrockMessages = messages.map((m) => ({
    role: m.role,
    content: convertContentToBedrockFormat(m.content),
  }))

  // Build payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    messages: bedrockMessages,
    inferenceConfig: {
      maxTokens,
      temperature,
    },
  }

  // Add system prompt if provided
  if (systemPrompt) {
    payload.system = [{ text: systemPrompt }]
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Bedrock API error: ${response.status} ${error}`)
  }

  const data = await response.json()

  // Converse API response format
  return {
    content: data.output.message.content[0].text,
    stopReason: data.stopReason || 'end_turn',
    usage: {
      inputTokens: data.usage?.inputTokens || 0,
      outputTokens: data.usage?.outputTokens || 0,
    },
  }
}

/**
 * Convert content to Bedrock Converse API format
 */
function convertContentToBedrockFormat(
  content: string | ClaudeContentBlock[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  if (typeof content === 'string') {
    return [{ text: content }]
  }

  return content.map((block) => {
    if (block.type === 'text') {
      return { text: block.text }
    } else if (block.type === 'image') {
      return {
        image: {
          format: block.format || 'png',
          source: {
            bytes: block.base64,
          },
        },
      }
    }
    return { text: '' }
  })
}

/**
 * Simple wrapper for single-turn text prompts
 */
export async function promptClaude(
  prompt: string,
  options: {
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
  } = {}
): Promise<string> {
  const response = await callClaude([{ role: 'user', content: prompt }], options)
  return response.content
}

/**
 * Call Claude with images (for visual evaluation tasks)
 */
export async function callClaudeWithImages(
  images: Array<{ base64: string; format?: 'png' | 'jpeg' | 'gif' | 'webp' }>,
  prompt: string,
  options: {
    maxTokens?: number
    temperature?: number
  } = {}
): Promise<string> {
  const content: ClaudeContentBlock[] = [
    ...images.map((img) => ({
      type: 'image' as const,
      format: img.format || ('png' as const),
      base64: img.base64,
    })),
    { type: 'text' as const, text: prompt },
  ]

  const response = await callClaude([{ role: 'user', content }], options)
  return response.content
}
