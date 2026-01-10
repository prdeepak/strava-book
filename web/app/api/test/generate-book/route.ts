/**
 * Test endpoint for PDF generation
 *
 * This endpoint is used by e2e tests to verify that PDF generation works
 * without requiring authentication. It only works when:
 * - NODE_ENV is 'test' or 'development', OR
 * - A valid test secret is provided in the X-Test-Secret header
 *
 * This catches font registration errors and other PDF generation issues
 * that would otherwise only appear in production.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { FullBookDocument } from '@/components/templates/BookDocument'
import type { BookTheme } from '@/lib/book-types'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
// Register fonts for PDF generation
import '@/lib/pdf-fonts'

// Minimal test activity for PDF generation
const TEST_ACTIVITY = {
  id: 1,
  name: 'Test Run',
  type: 'Run',
  sport_type: 'Run',
  distance: 10000,
  moving_time: 3600,
  elapsed_time: 3700,
  total_elevation_gain: 100,
  start_date: '2024-01-15T08:00:00Z',
  start_date_local: '2024-01-15T08:00:00Z',
  timezone: '(GMT-05:00) America/Toronto',
  utc_offset: -18000,
  average_speed: 2.78,
  max_speed: 3.5,
  average_heartrate: 145,
  max_heartrate: 165,
  suffer_score: 50,
  kudos_count: 5,
  comment_count: 2,
  athlete_count: 1,
  photo_count: 0,
  total_photo_count: 0,
  workout_type: 0,
  map: {
    id: 'a1',
    summary_polyline: 'abc123',
    resource_state: 2,
  },
  start_latlng: [43.65, -79.38],
  end_latlng: [43.66, -79.37],
  resource_state: 2,
  athlete: { id: 1, resource_state: 1 },
  has_heartrate: true,
  elev_high: 150,
  elev_low: 50,
  trainer: false,
  commute: false,
  manual: false,
  private: false,
  visibility: 'everyone',
  flagged: false,
  upload_id: 1,
  upload_id_str: '1',
  external_id: 'test',
  from_accepted_tag: false,
  pr_count: 0,
  has_kudoed: false,
  comprehensiveData: {
    photos: [],
    comments: [],
    streams: {},
    fetchedAt: new Date().toISOString(),
  },
}

// Preset themes to test (matching BookGenerationModal.tsx)
const PRESET_THEMES: Record<string, BookTheme> = {
  classic: {
    primaryColor: '#1a1a1a',
    accentColor: '#ff6b35',
    backgroundColor: '#ffffff',
    fontPairing: { heading: 'BebasNeue', body: 'BarlowCondensed' },
    backgroundStyle: 'solid',
  },
  bold: {
    primaryColor: '#000000',
    accentColor: '#ff0000',
    backgroundColor: '#ffffff',
    fontPairing: { heading: 'Anton', body: 'CrimsonText' },
    backgroundStyle: 'solid',
  },
  minimal: {
    primaryColor: '#333333',
    accentColor: '#666666',
    backgroundColor: '#fafafa',
    fontPairing: { heading: 'Helvetica-Bold', body: 'Helvetica' },
    backgroundStyle: 'solid',
  },
  marathon: {
    primaryColor: '#0D2240',
    accentColor: '#FFD200',
    backgroundColor: '#ffffff',
    fontPairing: { heading: 'BebasNeue', body: 'BarlowCondensed' },
    backgroundStyle: 'solid',
  },
  trail: {
    primaryColor: '#2d5016',
    accentColor: '#8bc34a',
    backgroundColor: '#f5f5dc',
    fontPairing: { heading: 'Anton', body: 'CrimsonText' },
    backgroundStyle: 'solid',
  },
}

// Check if request is authorized for testing
function isTestAuthorized(request: NextRequest): boolean {
  const nodeEnv = process.env.NODE_ENV

  // Allow in test or development mode
  if (nodeEnv === 'test' || nodeEnv === 'development') {
    return true
  }

  // Allow in CI environments (e2e tests run against production builds)
  if (process.env.CI === 'true' || process.env.PLAYWRIGHT_TEST === 'true') {
    return true
  }

  // Check for test secret header (for CI in production-like environments)
  const testSecret = request.headers.get('X-Test-Secret')
  if (testSecret && testSecret === process.env.E2E_TEST_SECRET) {
    return true
  }

  return false
}

export async function GET(request: NextRequest) {
  // Security check
  if (!isTestAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - test endpoint only available in test/dev mode' },
      { status: 403 }
    )
  }

  // Get theme from query params (default to classic)
  const { searchParams } = new URL(request.url)
  const themeName = searchParams.get('theme') || 'classic'
  const theme = PRESET_THEMES[themeName] || DEFAULT_THEME

  try {
    console.log(`[Test Generate Book] Testing theme: ${themeName}`)
    console.log(`[Test Generate Book] Font pairing: ${theme.fontPairing.heading} / ${theme.fontPairing.body}`)

    const startTime = Date.now()

    const pdfBuffer = await renderToBuffer(
      FullBookDocument({
        activities: [TEST_ACTIVITY as unknown as import('@/lib/strava').StravaActivity],
        title: 'Test Book',
        athleteName: 'Test Athlete',
        year: 2024,
        format: FORMATS['10x10'],
        theme,
      })
    )

    const renderTime = Date.now() - startTime
    console.log(`[Test Generate Book] PDF rendered in ${renderTime}ms`)
    console.log(`[Test Generate Book] PDF size: ${pdfBuffer.length} bytes`)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="test-${themeName}.pdf"`,
        'X-Render-Time': String(renderTime),
        'X-Theme': themeName,
      },
    })
  } catch (error) {
    console.error('[Test Generate Book] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate test PDF',
        theme: themeName,
        fonts: theme.fontPairing,
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

// POST endpoint for testing with custom activities
export async function POST(request: NextRequest) {
  if (!isTestAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - test endpoint only available in test/dev mode' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { activities, theme, format } = body

    const bookTheme = theme || DEFAULT_THEME
    const bookFormat = format || FORMATS['10x10']

    console.log(`[Test Generate Book] POST with ${activities?.length || 0} activities`)
    console.log(`[Test Generate Book] Font pairing: ${bookTheme.fontPairing?.heading} / ${bookTheme.fontPairing?.body}`)

    const startTime = Date.now()

    const pdfBuffer = await renderToBuffer(
      FullBookDocument({
        activities: activities || [TEST_ACTIVITY],
        title: 'Test Book',
        athleteName: 'Test Athlete',
        year: 2024,
        format: bookFormat,
        theme: bookTheme,
      })
    )

    const renderTime = Date.now() - startTime
    console.log(`[Test Generate Book] PDF rendered in ${renderTime}ms`)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="test-custom.pdf"',
        'X-Render-Time': String(renderTime),
      },
    })
  } catch (error) {
    console.error('[Test Generate Book] POST Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate test PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
