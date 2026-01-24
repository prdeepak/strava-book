/**
 * Book Integration Test
 *
 * Generates a full test book using fixtures with photos and saves all outputs
 * to /outputs for inspection. Visual scoring is optional (off by default).
 *
 * Usage:
 *   npx tsx lib/testing/book-integration-test.ts                    # Full book (no scoring)
 *   npx tsx lib/testing/book-integration-test.ts --score            # With visual scoring
 *   npx tsx lib/testing/book-integration-test.ts --pdfByPage        # Generate individual PDFs per template
 *   npx tsx lib/testing/book-integration-test.ts --filter=COVER,YEAR_STATS  # Only specific templates
 *   npx tsx lib/testing/book-integration-test.ts --pdfByPage --filter=RACE_PAGE
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { promises as fs } from 'fs'
import path from 'path'
import { BookDocument, computeYearSummary, getCategoryForType } from '@/components/templates/BookDocument'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { BookEntry } from '@/lib/curator'
import { scorePdfPages } from '@/lib/visual-scoring'
import { createBookScoresReport, generateScoresMarkdown } from '@/lib/visual-scores-report'
import { StravaActivity } from '@/lib/strava'
import { renderAllEntriesAsPdfs, PageRenderContext } from '@/lib/pdf-page-renderer'
import { TOCEntry } from '@/components/templates/TableOfContents'
import { generateBookEntries, findCoverPhotosFromActivities } from '@/lib/book-entry-generator'
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
 * Find photos from activities and resolve local fixture paths
 */
function findPhotosFromActivities(activities: StravaActivity[]): {
  coverPhotoUrl: string | null
  backgroundPhotoUrl: string | null
  backCoverPhotoUrl: string | null
} {
  // Use shared function
  const photos = findCoverPhotosFromActivities(activities)

  // Resolve local fixture paths
  const resolveUrl = (url: string | null) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    return resolvePhotoPath(url)
  }

  const result = {
    coverPhotoUrl: resolveUrl(photos.coverPhotoUrl),
    backgroundPhotoUrl: resolveUrl(photos.backgroundPhotoUrl),
    backCoverPhotoUrl: resolveUrl(photos.backCoverPhotoUrl),
  }

  console.log(`[Integration Test] Found photos: cover=${!!result.coverPhotoUrl}, bg=${!!result.backgroundPhotoUrl}, back=${!!result.backCoverPhotoUrl}`)
  return result
}

// ============================================================================
// Main Test Function
// ============================================================================

interface TestOptions {
  enableScoring: boolean
  pdfByPage: boolean
  filterTypes?: BookEntry['type'][]
}

async function runIntegrationTest(options: TestOptions): Promise<void> {
  const { enableScoring, pdfByPage, filterTypes } = options

  console.log('='.repeat(60))
  console.log('Book Integration Test')
  console.log('='.repeat(60))
  console.log(`Options: scoring=${enableScoring}, pdfByPage=${pdfByPage}, filter=${filterTypes?.join(',') || 'all'}`)

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

  // 4. Generate book entries using shared generator
  console.log('\n[4/6] Generating book entries...')
  let entries = generateBookEntries(
    { activities: nonRaces, races },
    {
      bookName: BOOK_NAME,
      athleteName: ATHLETE_NAME,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      forewordText: 'This is a test book generated for integration testing. It includes activities, races, and photos from the test fixtures.',
      coverPhotoUrl: photos.coverPhotoUrl,
      backgroundPhotoUrl: photos.backgroundPhotoUrl,
      backCoverPhotoUrl: photos.backCoverPhotoUrl,
      // Test limits for faster execution
      maxRaces: 3,
      maxMonths: 2,
    }
  )
  console.log(`  Generated ${entries.length} book entries`)

  // Filter entries if filterTypes is specified
  if (filterTypes && filterTypes.length > 0) {
    entries = entries.filter(e => filterTypes.includes(e.type))
    // Renumber pages sequentially for filtered entries (so page numbers match PDF pages)
    entries = entries.map((entry, idx) => ({ ...entry, pageNumber: idx + 1 }))
    console.log(`  Filtered to ${entries.length} entries of types: ${filterTypes.join(', ')}`)
  }

  // Setup output directories
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const baseFilename = filterTypes ? `test-${filterTypes.join('-').toLowerCase()}` : 'integration-test'
  const pdfFilename = `${baseFilename}-${timestamp}.pdf`
  const mdFilename = `${baseFilename}-${timestamp}-scores.md`
  const pagesFolder = `${baseFilename}-${timestamp}-pages`

  const outputsDir = await ensureOutputsDir()
  const pagesDir = path.join(outputsDir, pagesFolder)
  await fs.mkdir(pagesDir, { recursive: true })

  const yearSummary = computeYearSummary(allActivities, year)
  const startDateStr = startDate.toISOString().slice(0, 10)
  const endDateStr = endDate.toISOString().slice(0, 10)

  // Build TOC entries for page renderer
  const tocEntries: TOCEntry[] = entries
    .filter(entry =>
      entry.type !== 'COVER' &&
      entry.type !== 'TABLE_OF_CONTENTS' &&
      entry.type !== 'ACTIVITY_LOG' &&
      entry.type !== 'BLANK_PAGE' &&
      entry.type !== 'BACK_COVER'
    )
    .map(entry => ({
      title: entry.title || entry.type,
      pageNumber: entry.pageNumber || 0,
      type: entry.type,
      category: getCategoryForType(entry.type),
    }))

  // 5. Generate individual page PDFs if pdfByPage is enabled
  if (pdfByPage) {
    console.log('\n[5/7] Generating individual page PDFs...')

    const pageRenderContext: PageRenderContext = {
      activities: allActivities,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
      athleteName: ATHLETE_NAME,
      periodName: BOOK_NAME,
      year,
      startDate: startDateStr,
      endDate: endDateStr,
      yearSummary,
      mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      tocEntries,
    }

    const renderedPages = await renderAllEntriesAsPdfs(entries, pageRenderContext, {
      onProgress: (current, total, entry) => {
        console.log(`  Rendering page ${current + 1}/${total}: ${entry.type}`)
      },
    })

    // Save each page PDF
    for (const page of renderedPages) {
      const pagePdfPath = path.join(pagesDir, `${page.filename}.pdf`)
      await fs.writeFile(pagePdfPath, page.buffer)
      console.log(`  Saved: ${page.filename}.pdf`)
    }

    console.log(`  Generated ${renderedPages.length} individual page PDFs`)
  }

  // 6. Render main PDF
  const stepNum = pdfByPage ? 6 : 5
  const totalSteps = pdfByPage ? 7 : 6
  console.log(`\n[${stepNum}/${totalSteps}] Rendering main PDF...`)
  const renderStart = Date.now()

  const pdfBuffer = await renderToBuffer(
    BookDocument({
      entries,
      activities: allActivities,
      format: FORMATS['10x10'],
      theme: DEFAULT_THEME,
      athleteName: ATHLETE_NAME,
      periodName: BOOK_NAME,
      year,
      startDate: startDateStr,
      endDate: endDateStr,
      yearSummary,
      mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      printReady: false,
    })
  )

  const renderTime = Date.now() - renderStart
  console.log(`  PDF rendered in ${renderTime}ms`)
  console.log(`  PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)

  // Save PDF
  const pdfPath = path.join(outputsDir, pdfFilename)
  await fs.writeFile(pdfPath, pdfBuffer)

  // 7. Save outputs and optionally run visual scoring
  const lastStep = pdfByPage ? 7 : 6
  console.log(`\n[${lastStep}/${totalSteps}] Saving outputs${enableScoring ? ' and running visual scoring' : ''}...`)

  if (!enableScoring) {
    // Extract page images without scoring
    const { extractPdfPages } = await import('@/lib/pdf-to-images')
    console.log('  Extracting PDF pages (no scoring)...')
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
    if (pdfByPage) {
      console.log(`  - Individual PDFs: ${pagesFolder}/*.pdf`)
    }
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
  if (pdfByPage) {
    console.log(`  - Individual PDFs: ${pagesFolder}/*.pdf`)
  }
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

const testOptions: TestOptions = {
  enableScoring: args.includes('--score'),
  pdfByPage: args.includes('--pdfByPage'),
  filterTypes: undefined,
}

// Parse --filter=TYPE1,TYPE2
const filterArg = args.find(a => a.startsWith('--filter='))
if (filterArg) {
  const filterStr = filterArg.split('=')[1]
  testOptions.filterTypes = filterStr.split(',') as BookEntry['type'][]
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Book Integration Test

Usage: npx tsx lib/testing/book-integration-test.ts [options]

Options:
  --score          Enable visual scoring (off by default)
  --pdfByPage      Generate individual PDFs for each template
  --filter=TYPES   Only generate specific template types (comma-separated)
                   Valid types: COVER, FOREWORD, TABLE_OF_CONTENTS, YEAR_STATS,
                   YEAR_AT_A_GLANCE, RACE_PAGE, MONTHLY_DIVIDER, ACTIVITY_LOG,
                   BACK_COVER
  --help, -h       Show this help

Examples:
  npx tsx lib/testing/book-integration-test.ts --score
  npx tsx lib/testing/book-integration-test.ts --pdfByPage --filter=COVER,YEAR_STATS
  npx tsx lib/testing/book-integration-test.ts --pdfByPage --filter=RACE_PAGE --score
`)
  process.exit(0)
}

// Run the test
runIntegrationTest(testOptions).catch(error => {
  console.error('Integration test failed:', error)
  process.exit(1)
})
