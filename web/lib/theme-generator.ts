import { BookTheme, YearSummary } from './book-types'
import { StravaActivity, StravaPhoto } from './strava'
import { RaceInfo } from './race-detection'
import { getDefaultTheme } from './theme-defaults'

/**
 * Input for AI theme generation
 */
export interface ThemeGeneratorInput {
  aRace: RaceInfo | null
  topPhotos: StravaPhoto[]
  yearSummary: YearSummary
  userPreferences?: {
    style?: 'bold' | 'minimal' | 'classic'
    colorPreference?: string
  }
}

/**
 * Generate a book theme using AI (Google Gemini)
 */
export async function generateBookTheme(input: ThemeGeneratorInput): Promise<BookTheme> {
  const apiKey = process.env.GEMINI_API_KEY
  const useRealAI = process.env.USE_REAL_AI === 'true'

  // Fallback to default theme if AI is not configured
  if (!apiKey || !useRealAI) {
    console.log('[Theme Generator] Using default theme (AI not configured)')
    return getDefaultThemeFromInput(input)
  }

  try {
    console.log('[Theme Generator] Starting AI theme generation...')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)

    // Use Gemini Flash for fast theme generation
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const prompt = buildThemePrompt(input)
    console.log('[Theme Generator] Sending prompt to Gemini...')

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    console.log('[Theme Generator] Received response')

    // Extract JSON from response
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '')
    }

    const theme = JSON.parse(jsonText) as BookTheme

    // Validate theme has required fields
    if (!theme.primaryColor || !theme.accentColor || !theme.fontPairing) {
      console.warn('[Theme Generator] Invalid theme from AI, using default')
      return getDefaultThemeFromInput(input)
    }

    console.log('[Theme Generator] Successfully generated theme:', {
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      heading: theme.fontPairing.heading,
      body: theme.fontPairing.body,
    })

    return theme
  } catch (error) {
    console.error('[Theme Generator] Error generating theme:', error)
    return getDefaultThemeFromInput(input)
  }
}

/**
 * Build AI prompt for theme generation
 */
function buildThemePrompt(input: ThemeGeneratorInput): string {
  const { aRace, topPhotos, yearSummary, userPreferences } = input

  const raceInfo = aRace ? `
Primary Race: ${aRace.activity.name}
Race Type: ${aRace.raceType.toUpperCase()}
Location: ${aRace.activity.location_city || 'Unknown'}
Distance: ${(aRace.activity.distance / 1000).toFixed(2)}km
${aRace.matchedEvent ? `Known Event: ${aRace.matchedEvent.name}` : ''}
${aRace.matchedEvent ? `Official Colors: Primary=${aRace.matchedEvent.colors.primary}, Accent=${aRace.matchedEvent.colors.accent}` : ''}
` : 'No primary race identified'

  const stylePreference = userPreferences?.style || 'classic'

  return `You are an expert book designer creating a cohesive visual theme for a commemorative running book.

ATHLETE'S YEAR:
${raceInfo}

Total Distance: ${(yearSummary.totalDistance / 1000).toFixed(0)}km
Total Activities: ${yearSummary.activityCount}
Total Races: ${yearSummary.races.length}

DESIGN BRIEF:
- Style Preference: ${stylePreference}
${aRace?.matchedEvent ? `- Use ${aRace.matchedEvent.name}'s official colors as inspiration` : '- Create an original color palette'}
- The theme should feel professional and publication-ready
- Ensure high contrast for readability in print
- Select font pairings that work well together

YOUR TASK:
Generate a complete book theme with colors and typography.

Return ONLY valid JSON with this exact structure:
{
  "primaryColor": "#HEX",
  "accentColor": "#HEX",
  "backgroundColor": "#HEX",
  "fontPairing": {
    "heading": "Font Name",
    "body": "Font Name"
  },
  "motif": "descriptive-name",
  "backgroundStyle": "solid" | "gradient" | "photo-fade" | "pattern"
}

FONT CHOICES (choose from these available fonts):
Headings: "Oswald", "Playfair Display", "Montserrat", "Bebas Neue", "Anton", "Archivo Black"
Body: "Source Sans Pro", "Open Sans", "Roboto", "Lato", "Merriweather", "PT Sans"

COLOR GUIDELINES:
${aRace?.matchedEvent
  ? `- Start with the race colors: ${aRace.matchedEvent.colors.primary} (primary) and ${aRace.matchedEvent.colors.accent} (accent)
- You may adjust slightly for better print contrast, but stay close to official colors`
  : `- Choose colors that evoke ${yearSummary.races.length > 0 ? 'athletic achievement and determination' : 'movement and exploration'}
- Primary: Bold, confident color (dark blue, deep red, forest green, charcoal)
- Accent: Complementary highlight color (gold, orange, bright blue, lime)
- Background: Usually white or very light cream (#FFFFFF or #FEFEFE)`}
- Ensure primary and accent have good contrast
- Background should be very light for print quality

STYLE GUIDANCE:
${stylePreference === 'bold' ? '- Use strong, saturated colors\n- Modern sans-serif fonts\n- High contrast' : ''}
${stylePreference === 'minimal' ? '- Use muted, sophisticated colors\n- Clean, geometric fonts\n- Lots of white space' : ''}
${stylePreference === 'classic' ? '- Use traditional, timeless colors\n- Mix serif and sans-serif\n- Balanced, elegant' : ''}

IMPORTANT: Return ONLY the JSON object, no additional text.`
}

/**
 * Get a sensible default theme based on input data
 */
function getDefaultThemeFromInput(input: ThemeGeneratorInput): BookTheme {
  const { aRace } = input

  // If there's a known race, use its colors
  if (aRace?.matchedEvent) {
    return {
      primaryColor: aRace.matchedEvent.colors.primary,
      accentColor: aRace.matchedEvent.colors.accent,
      backgroundColor: '#FFFFFF',
      fontPairing: {
        heading: 'Oswald',
        body: 'Source Sans Pro',
      },
      motif: aRace.matchedEvent.name.toLowerCase().replace(/\s+/g, '-'),
      backgroundStyle: 'solid',
    }
  }

  // Otherwise, return sport-specific default
  return getDefaultTheme('running')
}

/**
 * Validate a theme object
 */
export function validateTheme(theme: Partial<BookTheme>): theme is BookTheme {
  return !!(
    theme.primaryColor &&
    theme.accentColor &&
    theme.backgroundColor &&
    theme.fontPairing?.heading &&
    theme.fontPairing?.body &&
    theme.backgroundStyle
  )
}

/**
 * Merge a partial theme with defaults
 */
export function mergeThemeWithDefaults(partial: Partial<BookTheme>, sportType: 'running' | 'cycling' | 'triathlon' = 'running'): BookTheme {
  const defaults = getDefaultTheme(sportType)

  return {
    primaryColor: partial.primaryColor || defaults.primaryColor,
    accentColor: partial.accentColor || defaults.accentColor,
    backgroundColor: partial.backgroundColor || defaults.backgroundColor,
    fontPairing: {
      heading: partial.fontPairing?.heading || defaults.fontPairing.heading,
      body: partial.fontPairing?.body || defaults.fontPairing.body,
    },
    motif: partial.motif || defaults.motif,
    backgroundStyle: partial.backgroundStyle || defaults.backgroundStyle,
  }
}
