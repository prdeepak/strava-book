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
import { RaceSection } from '@/components/templates/RaceSection'
import { Cover } from '@/components/templates/Cover'
import { YearStats } from '@/components/templates/YearStats'
import { YearCalendar } from '@/components/templates/YearCalendar'
import { MonthlyDividerDocument } from '@/components/templates/MonthlyDivider'
import { MonthlyDividerSpread } from '@/components/templates/MonthlyDividerSpread'
import { ActivityLog } from '@/components/templates/ActivityLog'
import { BackCover } from '@/components/templates/BackCover'
import { Foreword } from '@/components/templates/Foreword'
import { TableOfContents } from '@/components/templates/TableOfContents'
import rawActivitiesJson from '@/lib/testing/fixtures/raw-activities.json'
import * as path from 'path'

// Resolve photo paths in fixtures to absolute paths
function resolveFixturePhotoPaths<T>(fixture: T): T {
  const fixturesDir = path.join(process.cwd(), 'lib/testing/fixtures')
  const json = JSON.stringify(fixture)
  const resolved = json.replace(/"(photos\/[^"]+)"/g, (_match, relativePath) => {
    const absolutePath = path.join(fixturesDir, relativePath)
    return `"${absolutePath}"`
  })
  return JSON.parse(resolved)
}

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

// Test TOC entries - Races before Training Log, no Activity Log pages
const TEST_TOC_ENTRIES = [
  { title: 'Year Overview', pageNumber: 3, type: 'YEAR_STATS' as const, category: 'Overview' },
  { title: 'Activity Calendar', pageNumber: 5, type: 'YEAR_AT_A_GLANCE' as const, category: 'Overview' },
  { title: 'Boston Marathon', pageNumber: 8, type: 'RACE_PAGE' as const, category: 'Races', isARace: true },
  { title: 'Brooklyn Half', pageNumber: 14, type: 'RACE_PAGE' as const, category: 'Races', subtitle: 'May 17 • 21.1 km' },
  { title: 'Chicago Marathon', pageNumber: 20, type: 'RACE_PAGE' as const, category: 'Races', subtitle: 'Oct 12 • 42.2 km' },
  { title: 'January', pageNumber: 28, type: 'MONTHLY_DIVIDER' as const, category: 'Training Log' },
  { title: 'February', pageNumber: 34, type: 'MONTHLY_DIVIDER' as const, category: 'Training Log' },
  { title: 'March', pageNumber: 40, type: 'MONTHLY_DIVIDER' as const, category: 'Training Log' },
  { title: 'Best Efforts', pageNumber: 48, type: 'BEST_EFFORTS' as const, category: 'Highlights' },
]

// Rich activity with full content for testing RaceSection auto variant
const TEST_RICH_ACTIVITY = {
  ...TEST_ACTIVITY,
  id: 99999001,
  name: 'Boston Marathon 2024',
  distance: 42195,
  moving_time: 12600,
  kudos_count: 127,
  comment_count: 6,
  description: 'What an incredible day! Started at Hopkinton with 30,000 of my closest friends. The Newton Hills were brutal but the crowd support at Wellesley was electric! Heartbreak Hill lived up to its name but I pushed through. Crossing the finish on Boylston Street was a dream come true.',
  best_efforts: [
    { name: '1k', elapsed_time: 268, moving_time: 268, distance: 1000, start_index: 0, end_index: 100, pr_rank: 1 },
    { name: '5k', elapsed_time: 1420, moving_time: 1420, distance: 5000, start_index: 0, end_index: 500, pr_rank: 1 },
    { name: '10k', elapsed_time: 2880, moving_time: 2880, distance: 10000, start_index: 0, end_index: 1000, pr_rank: 2 },
    { name: 'Half Marathon', elapsed_time: 6180, moving_time: 6180, distance: 21097, start_index: 0, end_index: 2100, pr_rank: null },
    { name: 'Marathon', elapsed_time: 12600, moving_time: 12600, distance: 42195, start_index: 0, end_index: 4220, pr_rank: 1 },
  ],
  comprehensiveData: {
    photos: [
      { unique_id: 'photo1', urls: { '5000': 'https://example.com/boston1.jpg', '600': 'https://example.com/boston1_600.jpg' }, source: 1, uploaded_at: '2024-04-15T18:00:00Z', created_at: '2024-04-15T11:00:00Z', caption: 'Starting line!', activity_id: 99999001 },
      { unique_id: 'photo2', urls: { '5000': 'https://example.com/boston2.jpg', '600': 'https://example.com/boston2_600.jpg' }, source: 1, uploaded_at: '2024-04-15T18:05:00Z', created_at: '2024-04-15T12:30:00Z', caption: 'Wellesley!', activity_id: 99999001 },
      { unique_id: 'photo3', urls: { '5000': 'https://example.com/boston3.jpg', '600': 'https://example.com/boston3_600.jpg' }, source: 1, uploaded_at: '2024-04-15T18:10:00Z', created_at: '2024-04-15T13:00:00Z', caption: 'Heartbreak Hill', activity_id: 99999001 },
    ],
    comments: [
      { id: 1, activity_id: 99999001, text: 'Incredible run! You crushed it!', athlete: { id: 1001, firstname: 'Sarah', lastname: 'J' }, created_at: '2024-04-15T16:00:00Z', reaction_count: 15 },
      { id: 2, activity_id: 99999001, text: 'Boston!! Amazing achievement!', athlete: { id: 1002, firstname: 'Mike', lastname: 'C' }, created_at: '2024-04-15T16:05:00Z', reaction_count: 8 },
      { id: 3, activity_id: 99999001, text: '12 min PR?! Congrats!', athlete: { id: 1003, firstname: 'Emily', lastname: 'D' }, created_at: '2024-04-15T16:10:00Z', reaction_count: 12 },
    ],
    streams: {},
    fetchedAt: '2024-04-15T20:00:00Z',
  },
}

// Minimal activity for testing minimal variant
const TEST_MINIMAL_ACTIVITY = {
  id: 99999002,
  name: 'Local 10K',
  type: 'Run',
  sport_type: 'Run',
  distance: 10000,
  moving_time: 3000,
  elapsed_time: 3100,
  total_elevation_gain: 45,
  start_date: '2024-06-15T08:00:00Z',
  start_date_local: '2024-06-15T08:00:00Z',
  timezone: '(GMT+00:00) UTC',
  kudos_count: 2,
  map: { id: 'a99999002', summary_polyline: 'kqbjGbducNoBCiKtBoDOqF', resource_state: 2 },
  workout_type: 1,
  comprehensiveData: { photos: [], comments: [], streams: {}, fetchedAt: '2024-06-15T12:00:00Z' },
}

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
    getProps: (variant) => {
      // Map spec variants to component variants:
      // compact-table → grid (multi-activity dense layout)
      // with-maps → concise (single activity with map)
      // journal-style → full (single activity with description/comments)
      const variantMap: Record<string, string> = {
        'compact-table': 'grid',
        'with-maps': 'concise',
        'journal-style': 'full',
      }
      const componentVariant = variant ? variantMap[variant] || 'grid' : 'grid'

      // concise and full variants expect a single activity
      if (componentVariant === 'concise' || componentVariant === 'full') {
        return {
          activity: TEST_ACTIVITY,
          format: FORMATS['10x10'],
          theme: DEFAULT_THEME,
          variant: componentVariant,
        }
      }

      // grid variant expects activities array
      return {
        activities: [TEST_ACTIVITY, TEST_ACTIVITY, TEST_ACTIVITY],
        format: FORMATS['10x10'],
        theme: DEFAULT_THEME,
        variant: componentVariant,
      }
    },
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
  race_section: {
    component: RaceSection,
    getProps: (variant) => ({
      activity: variant === 'minimal' ? TEST_MINIMAL_ACTIVITY : TEST_RICH_ACTIVITY,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
      variant: variant || 'auto',
    }),
    variants: ['auto', 'compact', 'standard', 'full', 'minimal'],
  },
  monthly_divider_spread: {
    component: MonthlyDividerSpread,
    getProps: () => {
      // Get June 2025 activities from real fixtures (has photos that map to local files)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allActivities = (rawActivitiesJson as any).activities || []
      const juneActivities = allActivities
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => a.start_date_local?.startsWith('2025-06'))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => resolveFixturePhotoPaths(a))
      return {
        activities: juneActivities,
        month: 5, // June (0-indexed)
        year: 2025,
        format: FORMATS['10x10'],
        theme: DEFAULT_THEME,
      }
    },
    variants: [],
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
