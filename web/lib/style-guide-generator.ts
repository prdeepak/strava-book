/**
 * Style Guide Generator - AI-powered theme generation for Strava Books
 *
 * Uses Gemini to analyze user activities and photos to generate
 * appropriate color palettes and font pairings.
 */

import { BookTheme } from './book-types'
import { StravaActivity, StravaPhoto } from './strava'

// ============================================================================
// Types
// ============================================================================

export interface StyleGuideRequest {
  aRace?: StravaActivity              // Primary "goal" race
  topPhotos: StravaPhoto[]            // Best photos by engagement
  activityTypes: string[]             // Running, cycling, hiking, etc.
  userPreference?: 'minimal' | 'bold' | 'classic'
  yearRange?: { start: number; end: number }
}

export interface StyleGuideResponse {
  theme: BookTheme
  reasoning: string                   // Why these choices were made
  alternates: BookTheme[]             // 2-3 alternative themes
}

// Known race color schemes
interface RaceColorScheme {
  primaryColor: string
  accentColor: string
  keywords: string[]
}

const KNOWN_RACE_COLORS: Record<string, RaceColorScheme> = {
  'boston': {
    primaryColor: '#0D2240',  // Boston blue
    accentColor: '#FFD200',   // Boston yellow
    keywords: ['boston', 'baa', 'b.a.a.']
  },
  'nyc': {
    primaryColor: '#003087',  // NYC blue
    accentColor: '#FF6B00',   // NYC orange
    keywords: ['new york', 'nyc', 'nyrr', 'tcsnycmarathon']
  },
  'chicago': {
    primaryColor: '#E31837',  // Chicago red
    accentColor: '#00205B',   // Chicago blue
    keywords: ['chicago', 'bank of america marathon']
  },
  'london': {
    primaryColor: '#E31836',  // London red
    accentColor: '#1D428A',   // London blue
    keywords: ['london marathon', 'tcs london']
  },
  'berlin': {
    primaryColor: '#000000',  // Berlin black
    accentColor: '#FFCC00',   // Berlin yellow
    keywords: ['berlin marathon', 'bmw berlin']
  },
  'comrades': {
    primaryColor: '#006B3C',  // Comrades green
    accentColor: '#FFD700',   // Gold
    keywords: ['comrades', 'comrades marathon']
  },
  'ironman': {
    primaryColor: '#E31837',  // Ironman red
    accentColor: '#1C1C1C',   // Ironman black
    keywords: ['ironman', 'im70.3', 'triathlon']
  }
}

// Available fonts categorized by style
// NOTE: Only fonts verified as valid TTF files are included
// Many fonts were corrupted (contain HTML instead of font data)
const AVAILABLE_FONTS = {
  display: [
    'BebasNeue', 'Anton', 'ArchivoBlack', 'Bangers'
  ],
  sansSerif: [
    'Helvetica', 'BarlowCondensed'
  ],
  serif: [
    'CrimsonText'
  ],
  handwritten: [
    'PermanentMarker', 'IndieFlower', 'PatrickHand', 'HennyPenny'
  ],
  mono: [
    'Helvetica'  // Use built-in as fallback
  ],
  condensed: [
    'BarlowCondensed'
  ]
}

// ============================================================================
// Race Detection
// ============================================================================

/**
 * Detect if a race matches a known major race by name
 */
function detectKnownRace(activity: StravaActivity | undefined): RaceColorScheme | null {
  if (!activity) return null

  const name = activity.name.toLowerCase()
  const description = (activity.description || '').toLowerCase()
  const combined = `${name} ${description}`

  for (const [, scheme] of Object.entries(KNOWN_RACE_COLORS)) {
    if (scheme.keywords.some(kw => combined.includes(kw.toLowerCase()))) {
      return scheme
    }
  }

  return null
}

// ============================================================================
// Activity Analysis
// ============================================================================

/**
 * Determine the "energy level" of activities for theme selection
 */
function analyzeActivityEnergy(activityTypes: string[]): 'high' | 'medium' | 'calm' {
  const highEnergyTypes = ['Run', 'Ride', 'VirtualRide', 'Swim', 'HIIT', 'CrossFit']
  const calmTypes = ['Yoga', 'Walk', 'Hike', 'Meditation']

  const typeCounts = activityTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  let highCount = 0
  let calmCount = 0

  for (const [type, count] of Object.entries(typeCounts)) {
    if (highEnergyTypes.includes(type)) highCount += count
    if (calmTypes.includes(type)) calmCount += count
  }

  const total = activityTypes.length || 1
  const highRatio = highCount / total
  const calmRatio = calmCount / total

  if (calmRatio > 0.5) return 'calm'
  if (highRatio > 0.6) return 'high'
  return 'medium'
}

// ============================================================================
// Gemini API Call
// ============================================================================

const STYLE_GUIDE_PROMPT = `You are a professional book designer creating a style guide for a coffee-table yearbook of athletic activities.

CONTEXT:
{context}

AVAILABLE FONTS (you MUST only use these):
- Display/Heading fonts: ${AVAILABLE_FONTS.display.join(', ')}
- Sans-serif fonts: ${AVAILABLE_FONTS.sansSerif.join(', ')}
- Serif fonts: ${AVAILABLE_FONTS.serif.join(', ')}
- Condensed fonts: ${AVAILABLE_FONTS.condensed.join(', ')}

USER PREFERENCE: {preference}

Based on this context, create a cohesive theme that:
1. Reflects the athlete's activity types and achievements
2. Uses colors that feel appropriate for the energy level
3. Pairs fonts that are readable in print and work well together
4. Considers any race-specific branding hints

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "primaryTheme": {
    "primaryColor": "#hexcode",
    "accentColor": "#hexcode",
    "backgroundColor": "#ffffff or other light color",
    "fontPairing": {
      "heading": "FontName from available fonts",
      "body": "FontName from available fonts"
    },
    "backgroundStyle": "solid | gradient | photo-fade",
    "motif": "optional motif name"
  },
  "reasoning": "2-3 sentences explaining the design choices",
  "alternates": [
    {
      "primaryColor": "#hexcode",
      "accentColor": "#hexcode",
      "backgroundColor": "#hexcode",
      "fontPairing": { "heading": "FontName", "body": "FontName" },
      "backgroundStyle": "solid | gradient | photo-fade",
      "motif": "optional"
    },
    {
      "primaryColor": "#hexcode",
      "accentColor": "#hexcode",
      "backgroundColor": "#hexcode",
      "fontPairing": { "heading": "FontName", "body": "FontName" },
      "backgroundStyle": "solid | gradient | photo-fade",
      "motif": "optional"
    }
  ]
}`

/**
 * Build context string for the AI prompt
 */
function buildContext(request: StyleGuideRequest): string {
  const parts: string[] = []

  // Activity types breakdown
  if (request.activityTypes.length > 0) {
    const typeCounts = request.activityTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const sorted = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ')

    parts.push(`Activity breakdown: ${sorted}`)
  }

  // Goal race
  if (request.aRace) {
    const race = request.aRace
    const distance = (race.distance / 1000).toFixed(1)
    parts.push(`Primary race: "${race.name}" (${distance}km, ${race.type})`)

    // Check for known race
    const knownRace = detectKnownRace(race)
    if (knownRace) {
      parts.push(`This appears to be a major race with official branding colors`)
    }

    // Location hints
    if (race.location_city) {
      parts.push(`Race location: ${race.location_city}`)
    }
  }

  // Energy level
  const energy = analyzeActivityEnergy(request.activityTypes)
  parts.push(`Overall energy level: ${energy}`)

  // Photos
  if (request.topPhotos.length > 0) {
    parts.push(`Number of photos available: ${request.topPhotos.length}`)
    // Note: In future we could analyze photo colors with vision API
  }

  // Year range
  if (request.yearRange) {
    if (request.yearRange.start === request.yearRange.end) {
      parts.push(`Year: ${request.yearRange.start}`)
    } else {
      parts.push(`Date range: ${request.yearRange.start}-${request.yearRange.end}`)
    }
  }

  return parts.join('\n')
}

/**
 * Call Gemini API to generate theme
 */
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,  // Some creativity for design choices
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
  return data.candidates[0].content.parts[0].text
}

/**
 * Parse Gemini response into StyleGuideResponse
 */
function parseGeminiResponse(responseText: string): StyleGuideResponse {
  // Clean up response - remove markdown code blocks if present
  let cleanJson = responseText.trim()
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

  // Validate and construct response
  const primaryTheme: BookTheme = {
    primaryColor: parsed.primaryTheme.primaryColor,
    accentColor: parsed.primaryTheme.accentColor,
    backgroundColor: parsed.primaryTheme.backgroundColor,
    fontPairing: {
      heading: parsed.primaryTheme.fontPairing.heading,
      body: parsed.primaryTheme.fontPairing.body
    },
    backgroundStyle: parsed.primaryTheme.backgroundStyle || 'solid',
    motif: parsed.primaryTheme.motif
  }

  const alternates: BookTheme[] = (parsed.alternates || []).map((alt: Record<string, unknown>) => ({
    primaryColor: alt.primaryColor as string,
    accentColor: alt.accentColor as string,
    backgroundColor: alt.backgroundColor as string,
    fontPairing: alt.fontPairing as { heading: string; body: string },
    backgroundStyle: (alt.backgroundStyle as BookTheme['backgroundStyle']) || 'solid',
    motif: alt.motif as string | undefined
  }))

  return {
    theme: primaryTheme,
    reasoning: parsed.reasoning,
    alternates
  }
}

// ============================================================================
// Main Export
// ============================================================================

export interface GenerateStyleGuideOptions {
  useMock?: boolean  // For testing without API calls
  verbose?: boolean
}

/**
 * Generate a style guide based on user activities and preferences
 */
export async function generateStyleGuide(
  request: StyleGuideRequest,
  options: GenerateStyleGuideOptions = {}
): Promise<StyleGuideResponse> {
  const { useMock = false, verbose = false } = options

  // Check for known race first - use its colors as a strong hint
  const knownRace = detectKnownRace(request.aRace)

  // If using mock, return a sensible default based on analysis
  if (useMock) {
    return generateMockStyleGuide(request, knownRace)
  }

  // Build the prompt
  const context = buildContext(request)
  const preference = request.userPreference || 'classic'

  const prompt = STYLE_GUIDE_PROMPT
    .replace('{context}', context)
    .replace('{preference}', preference)

  if (verbose) {
    console.log('[StyleGuide] Context:', context)
    console.log('[StyleGuide] Preference:', preference)
  }

  try {
    const responseText = await callGemini(prompt)

    if (verbose) {
      console.log('[StyleGuide] Gemini response received')
    }

    const result = parseGeminiResponse(responseText)

    // If we have a known race, ensure its colors are prominent
    if (knownRace) {
      // Use known race colors as primary, but keep AI's font choices
      result.theme.primaryColor = knownRace.primaryColor
      result.theme.accentColor = knownRace.accentColor
      result.reasoning = `Theme based on official race branding. ${result.reasoning}`
    }

    return result
  } catch (error) {
    if (verbose) {
      console.error('[StyleGuide] Error:', error)
    }
    // Fallback to mock on error
    return generateMockStyleGuide(request, knownRace)
  }
}

/**
 * Generate a mock style guide without AI (for testing/fallback)
 */
function generateMockStyleGuide(
  request: StyleGuideRequest,
  knownRace: RaceColorScheme | null
): StyleGuideResponse {
  const energy = analyzeActivityEnergy(request.activityTypes)
  const preference = request.userPreference || 'classic'

  // Select base colors based on energy and preference
  let primaryColor: string
  let accentColor: string
  let headingFont: string
  let bodyFont: string

  if (knownRace) {
    primaryColor = knownRace.primaryColor
    accentColor = knownRace.accentColor
  } else if (preference === 'bold') {
    primaryColor = '#1a1a1a'
    accentColor = '#ff6b35'
  } else if (preference === 'minimal') {
    primaryColor = '#2c3e50'
    accentColor = '#95a5a6'
  } else {
    // Classic
    primaryColor = '#1e3a5f'
    accentColor = '#e67e22'
  }

  // Font selection based on energy (using verified valid fonts)
  if (energy === 'high') {
    headingFont = 'Anton'
    bodyFont = 'BarlowCondensed'
  } else if (energy === 'calm') {
    headingFont = 'ArchivoBlack'
    bodyFont = 'CrimsonText'
  } else {
    headingFont = 'BebasNeue'
    bodyFont = 'BarlowCondensed'
  }

  const theme: BookTheme = {
    primaryColor,
    accentColor,
    backgroundColor: '#ffffff',
    fontPairing: {
      heading: headingFont,
      body: bodyFont
    },
    backgroundStyle: 'solid'
  }

  // Generate alternates (using verified valid fonts)
  const alternates: BookTheme[] = [
    {
      primaryColor: '#2c3e50',
      accentColor: '#e74c3c',
      backgroundColor: '#ffffff',
      fontPairing: { heading: 'BebasNeue', body: 'CrimsonText' },
      backgroundStyle: 'solid'
    },
    {
      primaryColor: '#1a1a1a',
      accentColor: '#3498db',
      backgroundColor: '#fafafa',
      fontPairing: { heading: 'Anton', body: 'BarlowCondensed' },
      backgroundStyle: 'gradient'
    }
  ]

  return {
    theme,
    reasoning: knownRace
      ? 'Theme based on official race branding colors with fonts selected for energy and readability.'
      : `Selected ${preference} style with ${energy} energy fonts. Colors complement athletic photography well.`,
    alternates
  }
}

// ============================================================================
// CLI Interface (for testing)
// ============================================================================

if (require.main === module) {
  // Test with sample data
  const testRequest: StyleGuideRequest = {
    activityTypes: ['Run', 'Run', 'Run', 'Ride', 'Hike'],
    aRace: {
      id: 12345,
      name: 'Boston Marathon 2024',
      distance: 42195,
      type: 'Run',
      sport_type: 'Run',
      description: 'My first Boston!',
      moving_time: 14400,
      elapsed_time: 14400,
      total_elevation_gain: 200,
      start_date: '2024-04-15T10:00:00Z',
      start_date_local: '2024-04-15T10:00:00Z',
      timezone: 'America/New_York',
      kudos_count: 100,
      map: { summary_polyline: '' }
    },
    topPhotos: [],
    userPreference: 'bold'
  }

  const useMock = !process.env.GEMINI_API_KEY

  console.log('Testing Style Guide Generator...')
  console.log('Using mock:', useMock)

  generateStyleGuide(testRequest, { useMock, verbose: true })
    .then(result => {
      console.log('\n=== Style Guide Result ===')
      console.log('Theme:', JSON.stringify(result.theme, null, 2))
      console.log('Reasoning:', result.reasoning)
      console.log('Alternates:', result.alternates.length)
    })
    .catch(error => {
      console.error('Error:', error)
      process.exit(1)
    })
}
