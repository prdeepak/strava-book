import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { promises as fs } from 'fs'
import path from 'path'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { BookDocument, computeYearSummary, getCategoryForType } from '@/components/templates/BookDocument'
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { normalizeFontName } from '@/lib/ai-validation'
import { createBookScoresReport, generateScoresMarkdown } from '@/lib/visual-scores-report'
import { scorePdfPages } from '@/lib/visual-scoring'
import { extractPdfPages, isPdftoppmAvailable } from '@/lib/pdf-to-images'
import { BookEntry } from '@/lib/curator'
import { generateBookEntries } from '@/lib/book-entry-generator'
import { renderAllEntriesAsPdfs, PageRenderContext } from '@/lib/pdf-page-renderer'
import { TOCEntry } from '@/components/templates/TableOfContents'
// Register fonts for PDF generation
import '@/lib/pdf-fonts'

// Ensure outputs directory exists
async function ensureOutputsDir(): Promise<string> {
  // Use /app/outputs in container (maps to workspace root outputs/)
  // or fallback to cwd/outputs for local dev
  const outputsDir = process.env.WORKSPACE_ID
    ? '/app/outputs'
    : path.join(process.cwd(), 'outputs')
  await fs.mkdir(outputsDir, { recursive: true })
  return outputsDir
}

/**
 * Normalize fonts in a BookTheme to ensure they are registered
 */
function normalizeThemeFonts(theme: BookTheme): BookTheme {
  const headingFont = normalizeFontName(theme.fontPairing.heading, false)
  const bodyFont = normalizeFontName(theme.fontPairing.body, true)

  return {
    ...theme,
    fontPairing: {
      heading: headingFont,
      body: bodyFont,
    },
  }
}

interface ManualBookRequest {
  activities: StravaActivity[]
  races: StravaActivity[]
  highlightActivityIds: Array<{ month: string; activityId: number }>
  config: {
    bookName: string
    athleteName: string
    startDate: string
    endDate: string
    forewordText?: string
    coverPhotoUrl?: string | null
    coverPhotoWidth?: number
    coverPhotoHeight?: number
    backgroundPhotoUrl?: string | null
    backgroundPhotoWidth?: number
    backgroundPhotoHeight?: number
    backCoverPhotoUrl?: string | null
    backCoverPhotoWidth?: number
    backCoverPhotoHeight?: number
    format?: BookFormat
    theme?: BookTheme
    // Debug/testing options
    /** Enable visual scoring (off by default) */
    scoring?: boolean
    /** Generate individual PDFs for each template/page */
    pdfByPage?: boolean
    /** Only generate specific entry types (e.g., ['COVER', 'YEAR_STATS']) */
    filterTypes?: BookEntry['type'][]
  }
}

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const body: ManualBookRequest = await request.json()
    const { activities, races, highlightActivityIds, config } = body

    if (!activities || activities.length === 0) {
      return NextResponse.json(
        { error: 'No activities provided' },
        { status: 400 }
      )
    }

    // Extract debug options
    const enableScoring = config.scoring ?? false
    const pdfByPage = config.pdfByPage ?? false
    const filterTypes = config.filterTypes

    console.log('[ManualBook] Starting book generation')
    console.log('[ManualBook] Activities:', activities.length)
    console.log('[ManualBook] Races:', races.length)
    console.log('[ManualBook] Date range:', config.startDate, 'to', config.endDate)
    console.log('[ManualBook] Options: scoring=%s, pdfByPage=%s, filterTypes=%s',
      enableScoring, pdfByPage, filterTypes?.join(',') || 'all')

    // Ensure format and theme
    const format = config.format || FORMATS['10x10']
    const rawTheme = config.theme || DEFAULT_THEME
    const theme = normalizeThemeFonts(rawTheme)

    // Get year from date range (use end year as primary for display)
    const endYear = new Date(config.endDate).getFullYear()
    const primaryYear = endYear

    // Convert highlightActivityIds to Map
    const highlightMap = new Map<string, number>()
    highlightActivityIds.forEach(h => highlightMap.set(h.month, h.activityId))

    // Generate book entries using shared generator
    let entries = generateBookEntries(
      { activities, races },
      {
        bookName: config.bookName,
        athleteName: config.athleteName,
        startDate: config.startDate,
        endDate: config.endDate,
        forewordText: config.forewordText,
        coverPhotoUrl: config.coverPhotoUrl,
        coverPhotoWidth: config.coverPhotoWidth,
        coverPhotoHeight: config.coverPhotoHeight,
        backgroundPhotoUrl: config.backgroundPhotoUrl,
        backgroundPhotoWidth: config.backgroundPhotoWidth,
        backgroundPhotoHeight: config.backgroundPhotoHeight,
        backCoverPhotoUrl: config.backCoverPhotoUrl,
        backCoverPhotoWidth: config.backCoverPhotoWidth,
        backCoverPhotoHeight: config.backCoverPhotoHeight,
        highlightActivityIds: highlightMap,
      }
    )

    // Filter entries if filterTypes is specified
    if (filterTypes && filterTypes.length > 0) {
      entries = entries.filter(e => filterTypes.includes(e.type))
      console.log('[ManualBook] Filtered to', entries.length, 'entries of types:', filterTypes.join(', '))
    }

    console.log('[ManualBook] Generated', entries.length, 'book entries')

    // Filter activities to date range for year summary
    const startDateObj = new Date(config.startDate)
    const endDateObj = new Date(config.endDate)
    endDateObj.setHours(23, 59, 59, 999)

    const filteredActivities = activities.filter(a => {
      const actDate = new Date(a.start_date_local || a.start_date)
      return actDate >= startDateObj && actDate <= endDateObj
    })

    console.log('[ManualBook] Filtered activities for stats:', filteredActivities.length, 'of', activities.length)

    // Compute year summary from filtered activities only
    const yearSummary = computeYearSummary(filteredActivities, primaryYear)

    // Create filenames with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const baseFilename = config.bookName.replace(/\s+/g, '-').toLowerCase()
    const pdfFilename = `${baseFilename}-${timestamp}.pdf`
    const mdFilename = `${baseFilename}-${timestamp}-scores.md`
    const pagesFolder = `${baseFilename}-${timestamp}-pages`

    // Ensure outputs directory exists
    const outputsDir = await ensureOutputsDir()
    const pagesDir = path.join(outputsDir, pagesFolder)
    await fs.mkdir(pagesDir, { recursive: true })

    // Build TOC entries for page renderer (needed for TABLE_OF_CONTENTS)
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

    // Render individual page PDFs if pdfByPage is enabled
    if (pdfByPage) {
      console.log('[ManualBook] Generating individual page PDFs...')

      const pageRenderContext: PageRenderContext = {
        activities: filteredActivities,  // Use date-filtered activities
        format,
        theme,
        athleteName: config.athleteName,
        periodName: config.bookName,
        year: primaryYear,
        startDate: config.startDate,
        endDate: config.endDate,
        yearSummary,
        mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        tocEntries,
      }

      const renderedPages = await renderAllEntriesAsPdfs(entries, pageRenderContext, {
        onProgress: (current, total, entry) => {
          console.log(`[ManualBook] Rendering page ${current + 1}/${total}: ${entry.type}`)
        },
      })

      // Save each page PDF
      for (const page of renderedPages) {
        const pagePdfPath = path.join(pagesDir, `${page.filename}.pdf`)
        await fs.writeFile(pagePdfPath, page.buffer)
        console.log(`[ManualBook] Saved: ${pagePdfPath}`)
      }

      console.log(`[ManualBook] Generated ${renderedPages.length} individual page PDFs in ${pagesDir}`)
    }

    // Render main PDF
    console.log('[ManualBook] Rendering main PDF...')
    const startTime = Date.now()

    const pdfBuffer = await renderToBuffer(
      BookDocument({
        entries,
        activities: filteredActivities,  // Use date-filtered activities
        format,
        theme,
        athleteName: config.athleteName,
        periodName: config.bookName,
        year: primaryYear,
        startDate: config.startDate,
        endDate: config.endDate,
        yearSummary,
        mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        printReady: false,
      })
    )

    const renderTime = Date.now() - startTime
    console.log('[ManualBook] PDF rendered in', renderTime, 'ms')
    console.log('[ManualBook] PDF size:', pdfBuffer.length, 'bytes')

    // Save main PDF
    const pdfPath = path.join(outputsDir, pdfFilename)
    await fs.writeFile(pdfPath, pdfBuffer)
    console.log('[ManualBook] Saved PDF to:', pdfPath)

    // Always extract PDF pages to PNG for preview (independent of scoring)
    const pdftoppmAvailable = await isPdftoppmAvailable()
    if (pdftoppmAvailable) {
      console.log('[ManualBook] Extracting PDF pages to PNG...')
      const extractStartTime = Date.now()
      try {
        const extraction = await extractPdfPages(Buffer.from(pdfBuffer), {
          resolution: 150,
          prefix: 'page',
          outputDir: pagesDir,
        })
        console.log(`[ManualBook] Extracted ${extraction.totalPages} pages in ${Date.now() - extractStartTime}ms`)
        console.log(`[ManualBook] Page images saved to: ${pagesDir}`)
      } catch (extractError) {
        console.error('[ManualBook] Failed to extract PDF pages:', extractError)
      }
    } else {
      console.log('[ManualBook] pdftoppm not available - skipping PNG extraction')
    }

    // Visual scoring (optional, off by default)
    let scoresMarkdown = ''
    if (enableScoring) {
      console.log('[ManualBook] Running visual scoring...')
      const scoringStartTime = Date.now()

      const scoringResult = await scorePdfPages(
        Buffer.from(pdfBuffer),
        entries,
        {
          primaryColor: theme.primaryColor,
          accentColor: theme.accentColor,
          backgroundColor: theme.backgroundColor,
        },
        {
          verbose: true,
          provider: 'auto',
          outputDir: pagesDir,  // Will use already-extracted PNGs
        }
      )

      const pageScores = scoringResult.pageScores
      console.log(`[ManualBook] Visual scoring complete in ${Date.now() - scoringStartTime}ms`)
      console.log(`[ManualBook] Scored ${scoringResult.scoredPages}/${scoringResult.totalPages} pages, avg score: ${scoringResult.averageScore.toFixed(1)}`)

      const scoresReport = createBookScoresReport(config.bookName, pageScores)
      scoresMarkdown = generateScoresMarkdown(scoresReport)
      const mdPath = path.join(outputsDir, mdFilename)
      await fs.writeFile(mdPath, scoresMarkdown)
      console.log('[ManualBook] Saved scores to:', mdPath)
    } else {
      console.log('[ManualBook] Skipping visual scoring (scoring not enabled)')
    }

    // Return PDF with metadata about saved files
    const response = new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
        'Cache-Control': 'no-cache',
        'X-Output-PDF': pdfFilename,
        'X-Output-Scores': enableScoring ? mdFilename : '',
        'X-Output-Pages': pagesFolder,  // PNG pages always generated
      },
    })

    return response
  } catch (error) {
    console.error('[ManualBook] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate book',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
