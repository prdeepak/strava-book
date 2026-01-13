/**
 * Foreword Generator
 *
 * Uses Claude Sonnet 3.5 via AWS Bedrock to generate a personalized foreword
 * for a running book based on race comments and activity descriptions.
 */

import { promptClaude } from './claude-client'
import { StravaActivity, StravaComment } from './strava'

export interface ForewordGeneratorInput {
  activities: StravaActivity[]
  athleteName: string
  periodName: string
  startDate: string
  endDate: string
}

export interface ForewordGeneratorOutput {
  foreword: string
  suggestedPeriodName?: string
  reasoning?: string
}

/**
 * Extract race comments and descriptions from activities
 */
function extractWritingContent(activities: StravaActivity[]): {
  raceComments: string[]
  descriptions: string[]
  athleteComments: string[]
} {
  const raceComments: string[] = []
  const descriptions: string[] = []
  const athleteComments: string[] = []

  for (const activity of activities) {
    // Get descriptions from races and notable activities
    if (activity.description && activity.description.trim()) {
      descriptions.push(activity.description.trim())
    }

    // Get race-specific comments
    const isRace = activity.workout_type === 1
    if (isRace && activity.comprehensiveData?.comments) {
      const comments = activity.comprehensiveData.comments as StravaComment[]
      for (const comment of comments) {
        // Include athlete's own comments to capture their voice
        if (comment.text && comment.text.trim()) {
          athleteComments.push(comment.text.trim())
        }
      }
    }
  }

  return { raceComments, descriptions, athleteComments }
}

/**
 * Build context string for the AI prompt
 */
function buildContext(input: ForewordGeneratorInput): string {
  const { activities, athleteName, periodName, startDate, endDate } = input
  const { descriptions, athleteComments } = extractWritingContent(activities)

  // Calculate statistics
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0) / 3600
  const races = activities.filter((a) => a.workout_type === 1)
  const activityCount = activities.length

  // Build context
  const parts: string[] = []

  parts.push(`Athlete: ${athleteName}`)
  parts.push(`Book Period: ${periodName}`)
  parts.push(`Date Range: ${startDate} to ${endDate}`)
  parts.push(`Total Activities: ${activityCount}`)
  parts.push(`Total Distance: ${Math.round(totalDistance)} km`)
  parts.push(`Total Time: ${Math.round(totalTime)} hours`)
  parts.push(`Races: ${races.length}`)

  if (descriptions.length > 0) {
    parts.push('\n--- Athlete\'s Activity Descriptions ---')
    // Take up to 10 most recent/significant descriptions
    const topDescriptions = descriptions.slice(0, 10)
    for (const desc of topDescriptions) {
      parts.push(`- ${desc.substring(0, 500)}${desc.length > 500 ? '...' : ''}`)
    }
  }

  if (athleteComments.length > 0) {
    parts.push('\n--- Athlete\'s Comments ---')
    // Take up to 10 comments
    const topComments = athleteComments.slice(0, 10)
    for (const comment of topComments) {
      parts.push(`- ${comment.substring(0, 300)}${comment.length > 300 ? '...' : ''}`)
    }
  }

  // Add race highlights
  if (races.length > 0) {
    parts.push('\n--- Key Races ---')
    for (const race of races.slice(0, 5)) {
      const distance = race.distance ? `${(race.distance / 1000).toFixed(1)} km` : ''
      const location = race.location_city || ''
      parts.push(`- ${race.name} ${distance} ${location}`)
    }
  }

  return parts.join('\n')
}

const FOREWORD_SYSTEM_PROMPT = `You are a skilled ghostwriter helping create a foreword for a personal running book.
Your goal is to write in first-person, capturing the athlete's voice and personality based on their writing samples.
The foreword should feel authentic, personal, and emotionally resonant - as if the athlete wrote it themselves.
Keep the tone genuine and avoid clichés. Focus on the journey, the emotions, and what made this period special.`

const FOREWORD_PROMPT = `Write a foreword for a running book based on the following context.
Write in first-person, mimicking the athlete's writing style as closely as possible based on their descriptions and comments.

The foreword should:
- Be 150-250 words
- Feel personal and authentic to the athlete's voice
- Capture the emotional journey of the period
- Not use generic running clichés
- Reference specific moments or achievements from the data when appropriate

CONTEXT:
{context}

Also, if you see a better/more meaningful name for this book period based on the content, suggest one.

Return your response in this JSON format:
{
  "foreword": "The foreword text here...",
  "suggestedPeriodName": "Optional better name for the book, or null if current is good",
  "reasoning": "Brief explanation of your writing choices"
}`

/**
 * Generate a foreword using Claude AI
 */
export async function generateForeword(
  input: ForewordGeneratorInput
): Promise<ForewordGeneratorOutput> {
  const context = buildContext(input)
  const prompt = FOREWORD_PROMPT.replace('{context}', context)

  try {
    const responseText = await promptClaude(prompt, {
      systemPrompt: FOREWORD_SYSTEM_PROMPT,
      maxTokens: 1024,
      temperature: 0.8, // Slightly higher for more creative writing
    })

    // Parse JSON response
    let parsed: ForewordGeneratorOutput

    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      // If no JSON, use the whole response as foreword
      parsed = { foreword: responseText.trim() }
    }

    return parsed
  } catch (error) {
    console.error('Error generating foreword:', error)
    throw new Error(
      `Failed to generate foreword: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate a mock foreword for testing (no API call)
 */
export function generateMockForeword(
  input: ForewordGeneratorInput
): ForewordGeneratorOutput {
  const { athleteName, periodName } = input

  return {
    foreword: `This book represents a journey I never expected to take. Looking back at ${periodName}, I'm struck by how much can change in a relatively short time. Every run, every race, every early morning alarm was a step toward becoming someone I'm proud of.

The pages ahead capture moments of triumph and struggle, of pushing through doubt and finding unexpected joy in the process. These weren't just miles – they were lessons, memories, and proof that consistency matters more than perfection.

To everyone who encouraged me along the way: thank you. This book is as much yours as it is mine.

— ${athleteName}`,
    suggestedPeriodName: undefined,
    reasoning: 'Mock foreword generated for testing',
  }
}
