/**
 * Book Integration Test
 *
 * Generates a full test book using fixtures with photos, runs visual scoring,
 * and saves all outputs to /outputs for inspection.
 *
 * Usage: npx tsx lib/testing/book-integration-test.ts
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { promises as fs } from 'fs'
import path from 'path'
import { BookDocument, computeYearSummary } from '@/components/templates/BookDocument'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { BookEntry } from '@/lib/curator'
import { scorePdfPages } from '@/lib/visual-scoring'
import { createBookScoresReport, generateScoresMarkdown } from '@/lib/visual-scores-report'
import { StravaActivity } from '@/lib/strava'
// Import directly to avoid circular dependency issues
import allFixturesJson from './fixtures/all-fixtures.json'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

function resolvePhotoPath(relativePath: string): string {
  if (relativePath.startsWith('http')) {
    return relativePath
  }
  return path.join(FIXTURES_DIR, relativePath)
}
// Register fonts
import '@/lib/pdf-fonts'

// ============================================================================
// Configuration
// ============================================================================

const BOOK_NAME = 'Integration Test Book'
const ATHLETE_NAME = 'Test Athlete'


// ============================================================================
// Helpers
// ============================================================================

async function ensureOutputsDir(): Promise<string> {
  const outputsDir = process.env.WORKSPACE_ID
    ? '/app/outputs'
    : path.join(process.cwd(), 'outputs')
  await fs.mkdir(outputsDir, { recursive: true })
  return outputsDir
}

/**
 * Find photos from activities that can be used for covers
 */
function findPhotosFromActivities(activities: StravaActivity[]): {
  coverPhotoUrl: string | null
  backgroundPhotoUrl: string | null
  backCoverPhotoUrl: string | null
} {
  const photos: string[] = []

  // Collect all photo URLs from activities
  for (const activity of activities) {
    const activityPhotos = activity.comprehensiveData?.photos || []
    for (const photo of activityPhotos) {
      // Get the largest available URL
      const url = photo.urls?.['600'] || photo.urls?.['100'] || Object.values(photo.urls || {})[0]
      if (url) {
        // If it's a relative path (local fixture), resolve it
        if (!url.startsWith('http')) {
          photos.push(resolvePhotoPath(url))
        } else {
          photos.push(url)
        }
      }
    }

    // Also check primary photo
    if (activity.photos?.primary?.urls) {
      const urls = activity.photos.primary.urls as Record<string, string>
      const url = urls['600'] || urls['100'] || Object.values(urls)[0]
      if (url && !photos.includes(url)) {
        photos.push(url)
      }
    }
  }

  console.log(`[Integration Test] Found ${photos.length} photos from activities`)

  return {
    coverPhotoUrl: photos[0] || null,
    backgroundPhotoUrl: photos[1] || photos[0] || null,
    backCoverPhotoUrl: photos[2] || photos[0] || null,
  }
}

/**
 * Generate book entries for the test book
 */
function generateTestBookEntries(
  activities: StravaActivity[],
  races: StravaActivity[],
  config: {
    bookName: string
    startDate: string
    endDate: string
    coverPhotoUrl?: string | null
    backgroundPhotoUrl?: string | null
  }
): BookEntry[] {
  const entries: BookEntry[] = []
  let currentPage = 1

  const endYear = new Date(config.endDate).getFullYear()

  // 1. COVER
  entries.push({
    type: 'COVER',
    title: config.bookName,
    heroImage: config.coverPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // 2. FOREWORD
  entries.push({
    type: 'FOREWORD',
    title: 'Foreword',
    forewordText: 'This is a test book generated for integration testing. It includes activities, races, and photos from the test fixtures.',
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // 3. TABLE OF CONTENTS
  entries.push({
    type: 'TABLE_OF_CONTENTS',
    title: 'Contents',
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // 4. YEAR STATS
  entries.push({
    type: 'YEAR_STATS',
    year: endYear,
    title: 'Summary',
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    pageNumber: currentPage++,
  })

  // 5. YEAR CALENDAR
  entries.push({
    type: 'YEAR_AT_A_GLANCE',
    year: endYear,
    backgroundPhotoUrl: config.backgroundPhotoUrl || undefined,
    title: 'Year at a Glance',
    pageNumber: currentPage++,
  })

  // 6. RACE PAGES (limit to first 3 races)
  const racesToInclude = races.slice(0, 3)
  for (const race of racesToInclude) {
    entries.push({
      type: 'RACE_PAGE',
      activityId: race.id,
      title: race.name,
      highlightLabel: race.name,
      pageNumber: currentPage,
    })
    currentPage += 2 // Race spreads use 2 pages
  }

  // 7. MONTHLY SECTIONS (limit to 2 months for faster testing)
  const activitiesByMonth = new Map<string, StravaActivity[]>()
  for (const activity of activities) {
    const date = new Date(activity.start_date_local || activity.start_date)
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
    if (!activitiesByMonth.has(key)) {
      activitiesByMonth.set(key, [])
    }
    activitiesByMonth.get(key)?.push(activity)
  }

  const sortedMonths = Array.from(activitiesByMonth.keys()).sort().slice(0, 2)

  for (const yearMonthKey of sortedMonths) {
    const [yearStr, monthStr] = yearMonthKey.split('-')
    const entryYear = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    const monthActivities = activitiesByMonth.get(yearMonthKey) || []
    const monthNonRaces = monthActivities.filter(a => a.workout_type !== 1).slice(0, 6)

    if (monthNonRaces.length === 0) continue

    // MONTHLY DIVIDER
    entries.push({
      type: 'MONTHLY_DIVIDER',
      month,
      year: entryYear,
      title: new Date(entryYear, month, 1).toLocaleString('en-US', { month: 'long' }),
      highlightLabel: `${monthNonRaces.length} activities`,
      pageNumber: currentPage++,
    })

    // ACTIVITY LOG
    entries.push({
      type: 'ACTIVITY_LOG',
      activityIds: monthNonRaces.map(a => a.id),
      pageNumber: currentPage++,
      title: new Date(entryYear, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    })
  }

  // 8. BACK COVER
  entries.push({
    type: 'BACK_COVER',
    title: 'Back Cover',
    pageNumber: currentPage++,
  })

  return entries
}

// ============================================================================
// Main Test Function
// ============================================================================

async function runIntegrationTest(skipScoring = false): Promise<void> {
  console.log('='.repeat(60))
  console.log('Book Integration Test')
  console.log('='.repeat(60))

  const startTime = Date.now()

  // 1. Load fixtures
  console.log('\n[1/6] Loading fixtures...')
  // Use allFixtures which has photos (rawActivities doesn't have photos)
  const allActivities = Object.values(allFixturesJson) as unknown as StravaActivity[]
  console.log(`  Loaded ${allActivities.length} activities`)

  // Separate races from other activities
  const races = allActivities.filter(a => a.workout_type === 1)
  const nonRaces = allActivities.filter(a => a.workout_type !== 1)
  console.log(`  Races: ${races.length}, Other activities: ${nonRaces.length}`)

  // 2. Find photos
  console.log('\n[2/6] Finding photos for covers...')
  const photos = findPhotosFromActivities(allActivities)
  console.log(`  Cover photo: ${photos.coverPhotoUrl ? 'Found' : 'None'}`)
  console.log(`  Background photo: ${photos.backgroundPhotoUrl ? 'Found' : 'None'}`)
  console.log(`  Back cover photo: ${photos.backCoverPhotoUrl ? 'Found' : 'None'}`)

  // 3. Determine date range
  const dates = allActivities.map(a => new Date(a.start_date_local || a.start_date))
  const startDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const endDate = new Date(Math.max(...dates.map(d => d.getTime())))
  const year = endDate.getFullYear()

  console.log(`\n[3/6] Date range: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`)

  // 4. Generate book entries
  console.log('\n[4/6] Generating book entries...')
  const entries = generateTestBookEntries(allActivities, races, {
    bookName: BOOK_NAME,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    coverPhotoUrl: photos.coverPhotoUrl,
    backgroundPhotoUrl: photos.backgroundPhotoUrl,
  })
  console.log(`  Generated ${entries.length} book entries`)

  // 5. Render PDF
  console.log('\n[5/6] Rendering PDF...')
  const renderStart = Date.now()

  const yearSummary = computeYearSummary(allActivities, year)

  const pdfBuffer = await renderToBuffer(
    BookDocument({
      entries,
      activities: allActivities,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
      athleteName: ATHLETE_NAME,
      periodName: BOOK_NAME,
      year,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      yearSummary,
      mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      printReady: false,
    })
  )

  const renderTime = Date.now() - renderStart
  console.log(`  PDF rendered in ${renderTime}ms`)
  console.log(`  PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)

  // 6. Save outputs and optionally run visual scoring
  console.log(`\n[6/6] Saving outputs${skipScoring ? '' : ' and running visual scoring'}...`)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const baseFilename = 'integration-test'
  const pdfFilename = `${baseFilename}-${timestamp}.pdf`
  const mdFilename = `${baseFilename}-${timestamp}-scores.md`
  const pagesFolder = `${baseFilename}-${timestamp}-pages`

  const outputsDir = await ensureOutputsDir()
  const pagesDir = path.join(outputsDir, pagesFolder)

  // Save PDF first
  const pdfPath = path.join(outputsDir, pdfFilename)
  await fs.writeFile(pdfPath, pdfBuffer)

  if (skipScoring) {
    // Extract page images without scoring
    const { extractPdfPages } = await import('@/lib/pdf-to-images')
    console.log('[VisualScoring] Extracting PDF pages (no scoring)...')
    await fs.mkdir(pagesDir, { recursive: true })
    const extraction = await extractPdfPages(Buffer.from(pdfBuffer), { outputDir: pagesDir })
    const pageCount = extraction.totalPages
    console.log(`  Extracted ${pageCount} page images`)

    // Summary
    const totalTime = Date.now() - startTime
    console.log('\n' + '='.repeat(60))
    console.log('Integration Test Complete (scoring skipped)')
    console.log('='.repeat(60))
    console.log(`\nTotal time: ${(totalTime / 1000).toFixed(1)}s`)
    console.log(`\nOutputs saved to: ${outputsDir}`)
    console.log(`  - PDF: ${pdfFilename}`)
    console.log(`  - Pages: ${pagesFolder}/`)
    console.log('')
    process.exit(0)
  }

  // Run visual scoring with page images saved
  const scoringResult = await scorePdfPages(
    Buffer.from(pdfBuffer),
    entries,
    {
      primaryColor: DEFAULT_THEME.primaryColor,
      accentColor: DEFAULT_THEME.accentColor,
      backgroundColor: DEFAULT_THEME.backgroundColor,
    },
    {
      verbose: true,
      provider: 'auto',
      outputDir: pagesDir,
    }
  )

  console.log(`  Scored ${scoringResult.scoredPages}/${scoringResult.totalPages} pages`)
  console.log(`  Average score: ${scoringResult.averageScore.toFixed(1)}`)

  // Generate scores report
  const scoresReport = createBookScoresReport(BOOK_NAME, scoringResult.pageScores)
  const scoresMarkdown = generateScoresMarkdown(scoresReport)

  // Save scores report
  const mdPath = path.join(outputsDir, mdFilename)
  await fs.writeFile(mdPath, scoresMarkdown)

  // Summary
  const totalTime = Date.now() - startTime
  console.log('\n' + '='.repeat(60))
  console.log('Integration Test Complete')
  console.log('='.repeat(60))
  console.log(`\nTotal time: ${(totalTime / 1000).toFixed(1)}s`)
  console.log(`\nOutputs saved to: ${outputsDir}`)
  console.log(`  - PDF: ${pdfFilename}`)
  console.log(`  - Scores: ${mdFilename}`)
  console.log(`  - Pages: ${pagesFolder}/`)
  console.log('')

  // Exit with appropriate code based on scoring
  if (scoringResult.scoredPages === 0) {
    console.log('Warning: No pages were scored (LLM provider may not be configured)')
    process.exit(0) // Still success - scoring is optional
  } else if (scoringResult.averageScore < 50) {
    console.log('Warning: Average score below 50')
    process.exit(1)
  } else {
    console.log('All tests passed!')
    process.exit(0)
  }
}

// Parse command line args
const args = process.argv.slice(2)
const noScore = args.includes('--no-score')

// Run the test
runIntegrationTest(noScore).catch(error => {
  console.error('Integration test failed:', error)
  process.exit(1)
})
