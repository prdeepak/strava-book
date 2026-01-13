/**
 * Claude AI Client via AWS Bedrock
 *
 * Provides a unified interface for calling Claude Sonnet 3.5 via AWS Bedrock.
 * Used for foreword generation, style guide generation, and other AI features.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

// Claude Sonnet 3.5 model ID on Bedrock
const CLAUDE_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0'

// Initialize the Bedrock client
function getBedrockClient(): BedrockRuntimeClient {
  // Use default credential chain (env vars, IAM role, etc.)
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-west-2',
  })
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
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
 * Call Claude Sonnet 3.5 via AWS Bedrock
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

  const client = getBedrockClient()

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    ...(systemPrompt && { system: systemPrompt }),
  }

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const response = await client.send(command)
  const responseBody = JSON.parse(new TextDecoder().decode(response.body))

  return {
    content: responseBody.content[0].text,
    stopReason: responseBody.stop_reason,
    usage: {
      inputTokens: responseBody.usage.input_tokens,
      outputTokens: responseBody.usage.output_tokens,
    },
  }
}

/**
 * Simple wrapper for single-turn prompts
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
