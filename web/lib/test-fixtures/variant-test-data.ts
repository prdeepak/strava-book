/**
 * Test Fixtures for Template Variant Validation
 *
 * Provides sample activity data that exercises all variant conditions
 * for each template in the template-specs system.
 */

import { StravaActivity } from '../strava'

// ============================================================================
// Types
// ============================================================================

export interface TestFixture {
  description: string
  activity: StravaActivity
  photos?: PhotoFixture[]
  comments?: CommentFixture[]
  yearStats?: YearStatsData
  monthData?: MonthData
  calendarData?: CalendarData
  tocEntries?: TocEntry[]
  forewordText?: ForewordData
  bookMetadata?: BookMetadata
}

interface PhotoFixture {
  id: string
  url: string
  caption?: string
}

interface CommentFixture {
  id: number
  text: string
  athlete: { firstname: string; lastname: string }
}

interface YearStatsData {
  year: number
  totalDistance: number
  totalTime: number
  totalElevation: number
  activityCount: number
  activeDays: number
  previousYear?: YearStatsData
}

interface MonthData {
  month: number
  year: number
  activityCount: number
  totalDistance: number
  highlightPhoto?: string
}

interface CalendarData {
  year: number
  dailyActivities: Array<{ date: string; distance: number; count: number }>
}

interface TocEntry {
  title: string
  pageNumber: number
  category?: string
}

interface ForewordData {
  title: string
  body: string
  author?: string
}

interface BookMetadata {
  title: string
  subtitle?: string
  athleteName: string
  year: number
}

// ============================================================================
// Sample Polylines
// ============================================================================

const POLYLINE_SHORT = 'mz~aGzfppLcBgAiBwCeCuDoE_FgGkH'
const POLYLINE_MEDIUM = 'mz~aGzfppLcBgAiBwCeCuDoE_FgGkHiImJoKsLoMwNyO_QaRcSeT_UgVoWwX_ZaAcBeCgDkEmFoGsHwIAKcLgM'
const POLYLINE_LONG = 'mz~aGzfppLcBgAiBwCeCuDoE_FgGkHiImJoKsLoMwNyO_QaRcSeT_UgVoWwX_ZaAcBeCgDkEmFoGsHwIAKcLgMkNoOsPwQARcSgTkUoVsWwXAYcZga_bgcgdkeofsguhoijjkkslomwnypAqcrgsktlumvnwoApbqcrdsetfugoiuj'

// ============================================================================
// Helper Functions
// ============================================================================

function createMockPhoto(id: string, caption: string): PhotoFixture {
  return { id, url: `/test/photos/${id}.jpg`, caption }
}

function createMockComment(id: number, text: string, firstname: string, lastname: string): CommentFixture {
  return { id, text, athlete: { firstname, lastname } }
}

function createSplits(count: number, basePace: number): Array<{ distance: number; moving_time: number; elevation_difference: number }> {
  return Array.from({ length: count }, (_, i) => ({
    distance: 1000,
    moving_time: basePace + Math.floor(Math.random() * 20 - 10),
    elevation_difference: Math.floor(Math.random() * 20 - 10),
  }))
}

function createBestEfforts(): Array<{ name: string; distance: number; elapsed_time: number; pr_rank: number | null }> {
  return [
    { name: '400m', distance: 400, elapsed_time: 72, pr_rank: 2 },
    { name: '1/2 mile', distance: 805, elapsed_time: 165, pr_rank: 1 },
    { name: '1K', distance: 1000, elapsed_time: 210, pr_rank: 3 },
    { name: '1 mile', distance: 1609, elapsed_time: 360, pr_rank: 1 },
    { name: '5K', distance: 5000, elapsed_time: 1140, pr_rank: 2 },
    { name: '10K', distance: 10000, elapsed_time: 2400, pr_rank: 1 },
  ]
}

// ============================================================================
// Race_1p Variant Fixtures
// ============================================================================

const race1pPhotoHero: TestFixture = {
  description: 'Boston Marathon with high-quality finish photo. Perfect for photo-hero variant.',
  activity: {
    id: 10000001,
    name: 'Boston Marathon 2024',
    distance: 42195,
    moving_time: 12600,
    elapsed_time: 12900,
    total_elevation_gain: 150,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-04-15T10:00:00Z',
    start_date_local: '2024-04-15T10:00:00',
    timezone: 'America/New_York',
    kudos_count: 234,
    workout_type: 1,
    description: 'Dream come true! Qualifying and running Boston was everything I hoped for.',
    map: { summary_polyline: POLYLINE_LONG },
    photos: { primary: { urls: { '600': '/test/photos/boston-finish.jpg' } }, count: 3 },
    splits_metric: createSplits(42, 300),
    best_efforts: createBestEfforts(),
    laps: [],
    comments: [],
  },
  photos: [
    createMockPhoto('boston-finish', 'Crossing the finish line on Boylston Street'),
    createMockPhoto('boston-heartbreak', 'Conquering Heartbreak Hill'),
    createMockPhoto('boston-crowd', 'The incredible crowd support'),
  ],
  comments: [
    createMockComment(1, 'Incredible achievement! So proud of you!', 'Sarah', 'Runner'),
    createMockComment(2, 'Boston strong!', 'Mike', 'Coach'),
  ],
}

const race1pMapHero: TestFixture = {
  description: 'Grand Canyon Rim-to-Rim with scenic route. No photos - ideal for map-hero variant.',
  activity: {
    id: 10000002,
    name: 'Grand Canyon Rim-to-Rim',
    distance: 34000,
    moving_time: 28800,
    elapsed_time: 32400,
    total_elevation_gain: 1500,
    type: 'Run',
    sport_type: 'TrailRun',
    start_date: '2024-10-12T05:00:00Z',
    start_date_local: '2024-10-12T05:00:00',
    timezone: 'America/Phoenix',
    kudos_count: 189,
    workout_type: null,
    description: 'North Rim to South Rim. Started in the dark, finished in glory.',
    map: { summary_polyline: POLYLINE_LONG },
    photos: { primary: {}, count: 0 },
    splits_metric: createSplits(34, 500),
    best_efforts: [],
    laps: [],
    comments: [],
  },
}

const race1pDualImage: TestFixture = {
  description: 'Big Sur Marathon with both stunning photo and scenic coastal route.',
  activity: {
    id: 10000003,
    name: 'Big Sur International Marathon',
    distance: 42195,
    moving_time: 14400,
    elapsed_time: 15000,
    total_elevation_gain: 600,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-04-28T06:45:00Z',
    start_date_local: '2024-04-28T06:45:00',
    timezone: 'America/Los_Angeles',
    kudos_count: 312,
    workout_type: 1,
    description: 'The most beautiful marathon in the world. Bixby Bridge was breathtaking!',
    map: { summary_polyline: POLYLINE_LONG },
    photos: { primary: { urls: { '600': '/test/photos/bigsur-bixby.jpg' } }, count: 2 },
    splits_metric: createSplits(42, 340),
    best_efforts: createBestEfforts(),
    laps: [],
    comments: [],
  },
  photos: [
    createMockPhoto('bigsur-bixby', 'Bixby Bridge in the morning fog'),
    createMockPhoto('bigsur-coast', 'Pacific Coast Highway views'),
  ],
}

const race1pStatsFocus: TestFixture = {
  description: 'Track 10K PR attempt with detailed splits and multiple PRs. Perfect for stats-focus.',
  activity: {
    id: 10000004,
    name: 'Track 10K - PR Attempt',
    distance: 10000,
    moving_time: 2280,
    elapsed_time: 2300,
    total_elevation_gain: 0,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-06-15T19:00:00Z',
    start_date_local: '2024-06-15T19:00:00',
    timezone: 'America/Chicago',
    kudos_count: 156,
    workout_type: 1,
    description: 'Finally broke 38 minutes! Perfect conditions and great pacers.',
    map: { summary_polyline: POLYLINE_SHORT },
    photos: { primary: {}, count: 0 },
    splits_metric: createSplits(10, 228),
    best_efforts: [
      { name: '1K', distance: 1000, elapsed_time: 218, pr_rank: 1 },
      { name: '1 mile', distance: 1609, elapsed_time: 352, pr_rank: 1 },
      { name: '5K', distance: 5000, elapsed_time: 1120, pr_rank: 1 },
      { name: '10K', distance: 10000, elapsed_time: 2280, pr_rank: 1 },
    ],
    laps: [
      { name: 'Lap 1', distance: 400, moving_time: 91, lap_index: 0 },
      { name: 'Lap 2', distance: 400, moving_time: 90, lap_index: 1 },
      { name: 'Lap 3', distance: 400, moving_time: 91, lap_index: 2 },
    ],
    comments: [],
  },
}

const race1pPolylineMinimal: TestFixture = {
  description: 'Evening trail run with interesting route shape. Ideal for polyline-minimal.',
  activity: {
    id: 10000005,
    name: 'Sunset Trail Loop',
    distance: 15000,
    moving_time: 5400,
    elapsed_time: 5700,
    total_elevation_gain: 350,
    type: 'Run',
    sport_type: 'TrailRun',
    start_date: '2024-08-20T18:30:00Z',
    start_date_local: '2024-08-20T18:30:00',
    timezone: 'America/Denver',
    kudos_count: 67,
    workout_type: null,
    description: 'Perfect golden hour lighting on the trails.',
    map: { summary_polyline: POLYLINE_MEDIUM },
    photos: { primary: {}, count: 0 },
    splits_metric: createSplits(15, 360),
    best_efforts: [],
    laps: [],
    comments: [],
  },
}

// ============================================================================
// Race_2p Variant Fixtures
// ============================================================================

const race2pHeroLeftMapRight: TestFixture = {
  description: 'NYC Marathon with dramatic finish photo and 5-borough route.',
  activity: {
    id: 20000001,
    name: 'NYC Marathon 2024',
    distance: 42195,
    moving_time: 13500,
    elapsed_time: 14100,
    total_elevation_gain: 200,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-11-03T09:00:00Z',
    start_date_local: '2024-11-03T09:00:00',
    timezone: 'America/New_York',
    kudos_count: 456,
    workout_type: 1,
    description: 'Running through all five boroughs was an unforgettable experience!',
    map: { summary_polyline: POLYLINE_LONG },
    photos: { primary: { urls: { '600': '/test/photos/nyc-finish.jpg' } }, count: 4 },
    splits_metric: createSplits(42, 320),
    best_efforts: createBestEfforts(),
    laps: [],
    comments: [],
  },
  photos: [
    createMockPhoto('nyc-finish', 'Central Park finish line'),
    createMockPhoto('nyc-brooklyn', 'Brooklyn Bridge crossing'),
    createMockPhoto('nyc-bronx', 'Bronx cheering section'),
    createMockPhoto('nyc-start', 'Staten Island start'),
  ],
}

const race2pPhotoCollageSpread: TestFixture = {
  description: 'Ironman Kona with 6 diverse race photos. Perfect for photo-collage-spread.',
  activity: {
    id: 20000002,
    name: 'Ironman World Championship Kona',
    distance: 42195,
    moving_time: 18000,
    elapsed_time: 50400,
    total_elevation_gain: 500,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-10-12T06:30:00Z',
    start_date_local: '2024-10-12T06:30:00',
    timezone: 'Pacific/Honolulu',
    kudos_count: 678,
    workout_type: 1,
    description: 'The ultimate test. Swim 2.4mi, Bike 112mi, Run 26.2mi. Done!',
    map: { summary_polyline: POLYLINE_LONG },
    photos: { primary: { urls: { '600': '/test/photos/kona-finish.jpg' } }, count: 6 },
    splits_metric: createSplits(42, 430),
    best_efforts: [],
    laps: [],
    comments: [],
  },
  photos: [
    createMockPhoto('kona-swim', 'Ocean swim start'),
    createMockPhoto('kona-bike', 'Queen K Highway'),
    createMockPhoto('kona-run-start', 'Starting the marathon'),
    createMockPhoto('kona-energy-lab', 'Energy Lab turnaround'),
    createMockPhoto('kona-alii', 'Ali\'i Drive home stretch'),
    createMockPhoto('kona-finish', 'Crossing the finish line'),
  ],
}

const race2pNarrativeSpread: TestFixture = {
  description: 'First marathon with emotional 6-paragraph story. Ideal for narrative-spread.',
  activity: {
    id: 20000003,
    name: 'My First Marathon - Chicago',
    distance: 42195,
    moving_time: 16200,
    elapsed_time: 17100,
    total_elevation_gain: 50,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-10-13T07:30:00Z',
    start_date_local: '2024-10-13T07:30:00',
    timezone: 'America/Chicago',
    kudos_count: 234,
    workout_type: 1,
    description: `Two years ago, I couldn't run a mile without stopping. Today, I ran 26.2 miles through the streets of Chicago.

The journey started with a simple goal: lose weight. But somewhere along the way, running became more than exercise. It became therapy, meditation, and ultimately, a passion.

Training through the brutal Chicago winter taught me discipline. Those dark 5 AM runs when it was -10°F showed me what I was capable of. The long runs in summer heat built my endurance and my confidence.

Race day arrived with perfect weather. As I crossed the start line with 45,000 other runners, I felt tears in my eyes. Every early morning, every sacrifice, every moment of doubt led to this.

Miles 1-13 flew by in a blur of excitement. Miles 14-20 tested my training. Miles 21-26 tested my soul. But the crowd never let me give up. Strangers calling my name, kids giving high fives, signs that made me laugh and cry.

Crossing the finish line in Grant Park, I became a marathoner. Not just someone who ran a marathon, but someone who proved to themselves that impossible is just a word.`,
    map: { summary_polyline: POLYLINE_LONG },
    photos: { primary: { urls: { '600': '/test/photos/chicago-finish.jpg' } }, count: 3 },
    splits_metric: createSplits(42, 385),
    best_efforts: createBestEfforts(),
    laps: [],
    comments: [],
  },
  photos: [
    createMockPhoto('chicago-start', 'Nervous at the start'),
    createMockPhoto('chicago-halfway', 'Still smiling at halfway'),
    createMockPhoto('chicago-finish', 'The moment of triumph'),
  ],
  comments: [
    createMockComment(1, 'I\'m not crying, you\'re crying! So proud!', 'Mom', ''),
    createMockComment(2, 'Remember when you said you\'d never run? Look at you now!', 'Best', 'Friend'),
    createMockComment(3, 'Welcome to the marathon family!', 'Running', 'Club'),
  ],
}

// ============================================================================
// Book Template Fixtures
// ============================================================================

const coverPhotoHero: TestFixture = {
  description: 'Cover with dramatic hero photo of finish line moment.',
  activity: {
    id: 30000001,
    name: 'Cover Photo Activity',
    distance: 0,
    moving_time: 0,
    elapsed_time: 0,
    total_elevation_gain: 0,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-01-01T00:00:00Z',
    start_date_local: '2024-01-01T00:00:00',
    timezone: 'UTC',
    kudos_count: 0,
    map: { summary_polyline: '' },
  },
  photos: [createMockPhoto('cover-hero', 'Epic finish line moment')],
  bookMetadata: {
    title: 'Year of Running',
    subtitle: 'A Journey in Miles',
    athleteName: 'Alex Runner',
    year: 2024,
  },
}

const yearStatsGrid: TestFixture = {
  description: 'Year statistics for stats-grid variant.',
  activity: {
    id: 40000001,
    name: 'Year Stats Placeholder',
    distance: 0,
    moving_time: 0,
    elapsed_time: 0,
    total_elevation_gain: 0,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-12-31T23:59:59Z',
    start_date_local: '2024-12-31T23:59:59',
    timezone: 'UTC',
    kudos_count: 0,
    map: { summary_polyline: '' },
  },
  yearStats: {
    year: 2024,
    totalDistance: 3500000, // 3,500 km
    totalTime: 1080000, // 300 hours
    totalElevation: 45000,
    activityCount: 365,
    activeDays: 280,
  },
}

const monthlyDividerMinimal: TestFixture = {
  description: 'Monthly divider for January with minimal design.',
  activity: {
    id: 50000001,
    name: 'Monthly Divider Placeholder',
    distance: 0,
    moving_time: 0,
    elapsed_time: 0,
    total_elevation_gain: 0,
    type: 'Run',
    sport_type: 'Run',
    start_date: '2024-01-01T00:00:00Z',
    start_date_local: '2024-01-01T00:00:00',
    timezone: 'UTC',
    kudos_count: 0,
    map: { summary_polyline: '' },
  },
  monthData: {
    month: 0,
    year: 2024,
    activityCount: 28,
    totalDistance: 280000,
  },
}

// ============================================================================
// Main Export: Variant Test Fixtures Registry
// ============================================================================

export const VARIANT_TEST_FIXTURES: Record<string, Record<string, TestFixture>> = {
  race_1p: {
    'photo-hero': race1pPhotoHero,
    'map-hero': race1pMapHero,
    'dual-image': race1pDualImage,
    'stats-focus': race1pStatsFocus,
    'polyline-minimal': race1pPolylineMinimal,
  },
  race_2p: {
    'hero-left-map-right': race2pHeroLeftMapRight,
    'photo-collage-spread': race2pPhotoCollageSpread,
    'narrative-spread': race2pNarrativeSpread,
  },
  cover: {
    'photo-hero': coverPhotoHero,
  },
  year_stats: {
    'stats-grid': yearStatsGrid,
  },
  monthly_divider: {
    'minimal': monthlyDividerMinimal,
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a specific test fixture for a template variant.
 */
export function getFixtureForVariant(
  templateId: string,
  variant: string
): TestFixture | undefined {
  return VARIANT_TEST_FIXTURES[templateId]?.[variant]
}

/**
 * Get all test fixtures as a flat array with template and variant identifiers.
 */
export function getAllFixtures(): Array<{
  templateId: string
  variant: string
  fixture: TestFixture
}> {
  const results: Array<{ templateId: string; variant: string; fixture: TestFixture }> = []

  for (const [templateId, variants] of Object.entries(VARIANT_TEST_FIXTURES)) {
    for (const [variant, fixture] of Object.entries(variants)) {
      results.push({ templateId, variant, fixture })
    }
  }

  return results
}

/**
 * Get all fixtures for a specific template.
 */
export function getFixturesForTemplate(
  templateId: string
): Record<string, TestFixture> | undefined {
  return VARIANT_TEST_FIXTURES[templateId]
}

/**
 * Get a list of all available template IDs.
 */
export function getAvailableTemplateIds(): string[] {
  return Object.keys(VARIANT_TEST_FIXTURES)
}

/**
 * Get a list of all variants for a specific template.
 */
export function getAvailableVariants(templateId: string): string[] {
  const templateFixtures = VARIANT_TEST_FIXTURES[templateId]
  return templateFixtures ? Object.keys(templateFixtures) : []
}
