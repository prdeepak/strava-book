/**
 * Test script for Style Guide Generator
 *
 * Run with: npx ts-node web/lib/testing/test-style-guide.ts
 * Or: npx tsx web/lib/testing/test-style-guide.ts
 */

import * as path from 'path'
import * as fs from 'fs'
import { generateStyleGuide } from '../style-guide-generator'
import { StravaActivity } from '../strava'

// Load a fixture for testing
function loadFixture(name: string): StravaActivity {
  const fixturePath = path.join(__dirname, 'fixtures', `${name}.json`)
  const content = fs.readFileSync(fixturePath, 'utf-8')
  return JSON.parse(content)
}

// Test cases
const testCases = [
  {
    name: 'Boston Marathon detection',
    request: {
      activityTypes: ['Run', 'Run', 'Run', 'Run'],
      aRace: {
        id: 1,
        name: 'Boston Marathon 2024',
        distance: 42195,
        type: 'Run',
        sport_type: 'Run',
        description: 'BAA Boston Marathon - qualified!',
        moving_time: 12600,
        elapsed_time: 12600,
        total_elevation_gain: 150,
        start_date: '2024-04-15T10:00:00Z',
        start_date_local: '2024-04-15T10:00:00Z',
        timezone: 'America/New_York',
        kudos_count: 50,
        map: { summary_polyline: '' }
      } as StravaActivity,
      topPhotos: [],
      userPreference: 'bold' as const
    },
    expectedColors: {
      primaryColor: '#0D2240',  // Boston blue
      accentColor: '#FFD200'   // Boston yellow
    }
  },
  {
    name: 'NYC Marathon detection',
    request: {
      activityTypes: ['Run'],
      aRace: {
        id: 2,
        name: 'TCS NYC Marathon',
        distance: 42195,
        type: 'Run',
        sport_type: 'Run',
        moving_time: 14400,
        elapsed_time: 14400,
        total_elevation_gain: 200,
        start_date: '2024-11-03T10:00:00Z',
        start_date_local: '2024-11-03T10:00:00Z',
        timezone: 'America/New_York',
        kudos_count: 75,
        map: { summary_polyline: '' }
      } as StravaActivity,
      topPhotos: [],
      userPreference: 'classic' as const
    },
    expectedColors: {
      primaryColor: '#003087',  // NYC blue
      accentColor: '#FF6B00'   // NYC orange
    }
  },
  {
    name: 'Comrades Marathon detection',
    request: {
      activityTypes: ['Run', 'Run', 'Run'],
      aRace: {
        id: 3,
        name: 'Comrades Marathon 2025 - Down Run',
        distance: 89000,
        type: 'Run',
        sport_type: 'Run',
        description: 'The ultimate human race - Comrades!',
        moving_time: 39600,
        elapsed_time: 39600,
        total_elevation_gain: 1500,
        start_date: '2025-06-08T05:30:00Z',
        start_date_local: '2025-06-08T05:30:00Z',
        timezone: 'Africa/Johannesburg',
        kudos_count: 100,
        map: { summary_polyline: '' }
      } as StravaActivity,
      topPhotos: [],
      userPreference: 'bold' as const
    },
    expectedColors: {
      primaryColor: '#006B3C',  // Comrades green
      accentColor: '#FFD700'   // Gold
    }
  },
  {
    name: 'Calm yoga-focused athlete',
    request: {
      activityTypes: ['Yoga', 'Yoga', 'Walk', 'Hike', 'Yoga', 'Meditation'],
      topPhotos: [],
      userPreference: 'minimal' as const
    },
    // No expected colors - just verify it generates something sensible
  },
  {
    name: 'High-energy runner',
    request: {
      activityTypes: ['Run', 'Run', 'Run', 'HIIT', 'Run', 'Swim', 'Run'],
      topPhotos: [],
      userPreference: 'bold' as const
    },
  }
]

async function runTests() {
  console.log('=== Style Guide Generator Tests ===\n')

  // Check if we have API key
  const hasApiKey = !!process.env.GEMINI_API_KEY
  console.log(`GEMINI_API_KEY: ${hasApiKey ? 'configured' : 'not set (using mock)'}`)
  console.log('')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`)
    console.log('-'.repeat(40))

    try {
      const result = await generateStyleGuide(testCase.request, {
        useMock: !hasApiKey,
        verbose: false
      })

      // Validate structure
      if (!result.theme) {
        throw new Error('Missing theme in response')
      }
      if (!result.theme.primaryColor || !result.theme.accentColor) {
        throw new Error('Missing colors in theme')
      }
      if (!result.theme.fontPairing?.heading || !result.theme.fontPairing?.body) {
        throw new Error('Missing font pairing')
      }
      if (!result.reasoning) {
        throw new Error('Missing reasoning')
      }
      if (!Array.isArray(result.alternates)) {
        throw new Error('Missing alternates array')
      }

      // Check expected colors for race detection tests
      if (testCase.expectedColors) {
        if (result.theme.primaryColor !== testCase.expectedColors.primaryColor) {
          console.log(`  WARNING: Expected primaryColor ${testCase.expectedColors.primaryColor}, got ${result.theme.primaryColor}`)
        }
        if (result.theme.accentColor !== testCase.expectedColors.accentColor) {
          console.log(`  WARNING: Expected accentColor ${testCase.expectedColors.accentColor}, got ${result.theme.accentColor}`)
        }
      }

      console.log(`  Primary: ${result.theme.primaryColor}`)
      console.log(`  Accent: ${result.theme.accentColor}`)
      console.log(`  Fonts: ${result.theme.fontPairing.heading} / ${result.theme.fontPairing.body}`)
      console.log(`  Reasoning: ${result.reasoning.substring(0, 80)}...`)
      console.log(`  Alternates: ${result.alternates.length}`)
      console.log(`  PASS`)
      passed++
    } catch (error) {
      console.log(`  FAIL: ${error}`)
      failed++
    }

    console.log('')
  }

  // Test with real fixture
  console.log('Test: Real fixture (race_marathon)')
  console.log('-'.repeat(40))

  try {
    const marathonActivity = loadFixture('race_marathon')

    const result = await generateStyleGuide({
      activityTypes: ['Run', 'Run', 'Run', 'Ride', 'Hike'],
      aRace: marathonActivity,
      topPhotos: [],
      userPreference: 'classic'
    }, {
      useMock: !hasApiKey,
      verbose: false
    })

    console.log(`  Race: ${marathonActivity.name}`)
    console.log(`  Primary: ${result.theme.primaryColor}`)
    console.log(`  Accent: ${result.theme.accentColor}`)
    console.log(`  Fonts: ${result.theme.fontPairing.heading} / ${result.theme.fontPairing.body}`)
    console.log(`  PASS`)
    passed++
  } catch (error) {
    console.log(`  FAIL: ${error}`)
    failed++
  }

  console.log('')
  console.log('='.repeat(40))
  console.log(`Results: ${passed} passed, ${failed} failed`)

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(console.error)
