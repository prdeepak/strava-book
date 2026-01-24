/**
 * Test endpoint for previewing single-activity templates with fixture data
 *
 * Usage: GET /api/test/preview-template?template=race_section&fixture=ultramarathon
 *
 * This endpoint renders a single-activity template as a PDF using fixture data,
 * allowing quick iteration on template designs without needing real Strava data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RaceSection } from '@/components/templates/RaceSection'
import { Race_1p } from '@/components/templates/Race_1p'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import '@/lib/pdf-fonts'

// Load fixture data
import ultramarathonFixture from '@/lib/testing/fixtures/race_ultramarathon.json'
import type { StravaActivity } from '@/lib/strava'

const FIXTURES: Record<string, StravaActivity> = {
  ultramarathon: ultramarathonFixture as unknown as StravaActivity,
}

// Check if request is authorized for testing
function isTestAuthorized(request: NextRequest): boolean {
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'test' || nodeEnv === 'development') {
    return true
  }
  if (process.env.CI === 'true' || process.env.E2E_TEST_MODE === 'true') {
    return true
  }
  const testSecret = request.headers.get('X-Test-Secret')
  if (testSecret && testSecret === process.env.E2E_TEST_SECRET) {
    return true
  }
  return false
}

export async function GET(request: NextRequest) {
  if (!isTestAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - test endpoint only available in test/dev mode' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const template = searchParams.get('template') || 'race_section'
  const fixtureName = searchParams.get('fixture') || 'ultramarathon'

  const activity = FIXTURES[fixtureName]
  if (!activity) {
    return NextResponse.json(
      { error: `Unknown fixture: ${fixtureName}. Available: ${Object.keys(FIXTURES).join(', ')}` },
      { status: 400 }
    )
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  try {
    console.log(`[Test Preview] Template: ${template}, Fixture: ${fixtureName}`)
    const startTime = Date.now()

    let pdfBuffer: Buffer

    if (template === 'race_section') {
      pdfBuffer = await renderToBuffer(
        RaceSection({
          activity,
          format: FORMATS['10x10'],
          theme: DEFAULT_THEME,
          mapboxToken,
        })
      )
    } else if (template === 'race_1p') {
      pdfBuffer = await renderToBuffer(
        Race_1p({
          activity,
          format: FORMATS['10x10'],
          theme: DEFAULT_THEME,
          mapboxToken,
        })
      )
    } else {
      return NextResponse.json(
        { error: `Unknown template: ${template}. Available: race_section, race_1p` },
        { status: 400 }
      )
    }

    const renderTime = Date.now() - startTime
    console.log(`[Test Preview] Rendered in ${renderTime}ms, Size: ${pdfBuffer.length} bytes`)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-${template}.pdf"`,
        'X-Render-Time': String(renderTime),
        'X-Template': template,
      },
    })
  } catch (error) {
    console.error('[Test Preview] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to render template',
        template,
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
