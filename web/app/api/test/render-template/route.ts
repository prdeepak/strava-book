/**
 * Test endpoint for rendering individual templates
 *
 * Used by e2e tests to verify template dimensions and rendering.
 * Renders a single template with fixture data and returns the PDF.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import '@/lib/pdf-fonts'

// Template imports
import { Race_1p } from '@/components/templates/Race_1p'
import { Cover } from '@/components/templates/Cover'
import { YearStats } from '@/components/templates/YearStats'
import { YearCalendar } from '@/components/templates/YearCalendar'
import { MonthlyDividerDocument } from '@/components/templates/MonthlyDivider'
import { ActivityLog } from '@/components/templates/ActivityLog'
import { BackCover } from '@/components/templates/BackCover'
import { Foreword } from '@/components/templates/Foreword'
import { TableOfContents } from '@/components/templates/TableOfContents'

// Minimal test activity
const TEST_ACTIVITY = {
  id: 12345,
  name: 'Boston Marathon 2024',
  type: 'Run',
  sport_type: 'Run',
  distance: 42195,
  moving_time: 12600, // 3:30:00
  elapsed_time: 12900,
  total_elevation_gain: 150,
  start_date: '2024-04-15T10:00:00Z',
  start_date_local: '2024-04-15T10:00:00Z',
  timezone: '(GMT-05:00) America/New_York',
  utc_offset: -18000,
  average_speed: 3.35,
  max_speed: 4.2,
  average_heartrate: 155,
  max_heartrate: 175,
  suffer_score: 250,
  kudos_count: 100,
  comment_count: 15,
  athlete_count: 1,
  photo_count: 3,
  total_photo_count: 3,
  workout_type: 1, // Race
  map: {
    id: 'a12345',
    summary_polyline: 'abc123xyz',
    resource_state: 2,
  },
  start_latlng: [42.2293, -71.5144],
  end_latlng: [42.3505, -71.0783],
  resource_state: 2,
  athlete: { id: 1, resource_state: 1 },
  has_heartrate: true,
  elev_high: 150,
  elev_low: 5,
  trainer: false,
  commute: false,
  manual: false,
  private: false,
  visibility: 'everyone',
  flagged: false,
  upload_id: 12345,
  upload_id_str: '12345',
  external_id: 'test-boston',
  from_accepted_tag: false,
  pr_count: 1,
  has_kudoed: false,
  location_city: 'Boston',
  location_state: 'Massachusetts',
  location_country: 'United States',
  splits_metric: [
    { distance: 1000, elapsed_time: 300, moving_time: 300, average_speed: 3.33, pace_zone: 3 },
    { distance: 1000, elapsed_time: 295, moving_time: 295, average_speed: 3.39, pace_zone: 3 },
    { distance: 1000, elapsed_time: 298, moving_time: 298, average_speed: 3.35, pace_zone: 3 },
  ],
  best_efforts: [
    { name: '1 mile', elapsed_time: 480, moving_time: 480, distance: 1609.34 },
    { name: '5K', elapsed_time: 1500, moving_time: 1500, distance: 5000 },
    { name: '10K', elapsed_time: 3050, moving_time: 3050, distance: 10000 },
  ],
  comments: [
    { text: 'Amazing race! Congrats!', athlete: { firstname: 'John', lastname: 'D' } },
    { text: 'Well done!', athlete: { firstname: 'Jane', lastname: 'S' } },
  ],
}

// Test year summary data
const TEST_YEAR_SUMMARY = {
  year: 2024,
  totalDistance: 2500000, // 2500 km
  totalTime: 720000, // 200 hours
  totalElevation: 50000,
  activityCount: 250,
  longestActivity: TEST_ACTIVITY,
  fastestActivity: TEST_ACTIVITY,
  activeDays: new Set(['2024-01-01', '2024-01-02', '2024-01-03']),
  monthlyStats: Array.from({ length: 12 }, (_, i) => ({
    month: i,
    year: 2024,
    activityCount: 20,
    totalDistance: 200000,
    totalTime: 60000,
    totalElevation: 4000,
    activeDays: 20,
    activities: [],
  })),
  races: [TEST_ACTIVITY],
}

// Test monthly stats
const TEST_MONTHLY_STATS = {
  month: 3, // April
  year: 2024,
  activityCount: 25,
  totalDistance: 300000,
  totalTime: 90000,
  totalElevation: 5000,
  activeDays: 22,
  activities: [TEST_ACTIVITY],
}

// Test TOC entries
const TEST_TOC_ENTRIES = [
  { title: 'Year Overview', pageNumber: 1, type: 'YEAR_STATS' as const, category: 'Overview' },
  { title: 'January', pageNumber: 5, type: 'MONTHLY_DIVIDER' as const, category: 'Journal' },
  { title: 'Boston Marathon', pageNumber: 15, type: 'RACE_PAGE' as const, category: 'Races' },
  { title: 'Activity Log', pageNumber: 50, type: 'ACTIVITY_LOG' as const, category: 'Appendix' },
]

// Template registry with component and default props
const TEMPLATES: Record<string, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProps: (variant?: string) => Record<string, any>
  variants: string[]
}> = {
  race_1p: {
    component: Race_1p,
    getProps: (variant) => ({
      activity: TEST_ACTIVITY,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
      layoutVariant: variant,
    }),
    variants: ['photo-hero', 'map-hero', 'dual-image', 'stats-focus', 'polyline-minimal'],
  },
  cover: {
    component: Cover,
    getProps: () => ({
      title: '2024',
      subtitle: 'A Year of Running',
      athleteName: 'Test Athlete',
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['photo-hero', 'gradient-minimal', 'photo-grid'],
  },
  year_stats: {
    component: YearStats,
    getProps: () => ({
      yearSummary: TEST_YEAR_SUMMARY,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['stats-grid', 'infographic', 'comparison'],
  },
  year_calendar: {
    component: YearCalendar,
    getProps: () => ({
      yearSummary: TEST_YEAR_SUMMARY,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['github-style', 'monthly-bars'],
  },
  monthly_divider: {
    component: MonthlyDividerDocument,
    getProps: () => ({
      month: TEST_MONTHLY_STATS.month,
      year: TEST_MONTHLY_STATS.year,
      stats: {
        activityCount: TEST_MONTHLY_STATS.activityCount,
        totalDistance: TEST_MONTHLY_STATS.totalDistance,
        totalTime: TEST_MONTHLY_STATS.totalTime,
        activeDays: TEST_MONTHLY_STATS.activeDays,
        totalElevation: TEST_MONTHLY_STATS.totalElevation,
      },
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['minimal', 'photo-accent', 'stats-preview'],
  },
  activity_log: {
    component: ActivityLog,
    getProps: () => ({
      activities: [TEST_ACTIVITY, TEST_ACTIVITY, TEST_ACTIVITY],
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['compact-table', 'with-maps', 'journal-style'],
  },
  back_cover: {
    component: BackCover,
    getProps: () => ({
      yearSummary: TEST_YEAR_SUMMARY,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['stats-centered', 'minimal', 'branded'],
  },
  foreword: {
    component: Foreword,
    getProps: () => ({
      title: 'Foreword',
      body: 'This was a year of incredible growth and achievement. From the first steps in January to the final miles in December, every run told a story.',
      author: 'Test Athlete',
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['centered-elegant', 'left-aligned', 'pull-quote'],
  },
  table_of_contents: {
    component: TableOfContents,
    getProps: () => ({
      entries: TEST_TOC_ENTRIES,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
    }),
    variants: ['grouped-categories', 'simple-list', 'two-column'],
  },
}

function isTestAuthorized(request: NextRequest): boolean {
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'test' || nodeEnv === 'development') return true
  if (process.env.CI === 'true' || process.env.PLAYWRIGHT_TEST === 'true' || process.env.E2E_TEST_MODE === 'true') return true
  const testSecret = request.headers.get('X-Test-Secret')
  if (testSecret && testSecret === process.env.E2E_TEST_SECRET) return true
  return false
}

export async function GET(request: NextRequest) {
  if (!isTestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const templateId = searchParams.get('template')
  const variant = searchParams.get('variant') || undefined

  // Return list of templates if no template specified
  if (!templateId) {
    const templates = Object.entries(TEMPLATES).map(([id, spec]) => ({
      id,
      variants: spec.variants,
    }))
    return NextResponse.json({ templates })
  }

  const templateSpec = TEMPLATES[templateId]
  if (!templateSpec) {
    return NextResponse.json(
      { error: `Unknown template: ${templateId}`, available: Object.keys(TEMPLATES) },
      { status: 400 }
    )
  }

  try {
    const props = templateSpec.getProps(variant)
    const startTime = Date.now()

    const pdfBuffer = await renderToBuffer(
      React.createElement(templateSpec.component, props)
    )

    const renderTime = Date.now() - startTime

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${templateId}${variant ? `-${variant}` : ''}.pdf"`,
        'X-Render-Time': String(renderTime),
        'X-Template': templateId,
        'X-Variant': variant || 'default',
      },
    })
  } catch (error) {
    console.error(`[Render Template] Error rendering ${templateId}:`, error)
    return NextResponse.json(
      {
        error: 'Failed to render template',
        template: templateId,
        variant,
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
