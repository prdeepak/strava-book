import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { BookDocument, computeYearSummary } from '@/components/templates/BookDocument'
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { normalizeFontName } from '@/lib/ai-validation'
import { createBookScoresReport, generateScoresMarkdown, PageScore } from '@/lib/visual-scores-report'
import { BookEntry } from '@/lib/curator'
// Register fonts for PDF generation
import '@/lib/pdf-fonts'

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
    backgroundPhotoUrl?: string | null
    backCoverPhotoUrl?: string | null
    format?: BookFormat
    theme?: BookTheme
  }
}

/**
 * Generate book entries for manual book generation
 * Uses the new structure with user-selected photos and highlight activities
 */
function generateManualBookEntries(
  activities: StravaActivity[],
  races: StravaActivity[],
  highlightActivityIds: Map<string, number>,
  config: ManualBookRequest['config']
): BookEntry[] {
  const entries: BookEntry[] = []

  // Track page numbers
  let currentPage = 1

  // 1. COVER
  entries.push({
    type: 'COVER',
    title: config.bookName,
    pageNumber: currentPage++,
    heroImage: config.coverPhotoUrl || undefined,
  })

  // 2. FOREWORD (if provided)
  if (config.forewordText) {
    entries.push({
      type: 'FOREWORD',
      title: 'Foreword',
      forewordText: config.forewordText,
      pageNumber: currentPage++,
    })
  }

  // 3. TABLE OF CONTENTS
  entries.push({
    type: 'TABLE_OF_CONTENTS',
    title: 'Contents',
    pageNumber: currentPage++,
  })

  // Handle empty activities
  if (activities.length === 0) {
    entries.push({
      type: 'BACK_COVER',
      pageNumber: currentPage++,
    })
    return entries
  }

  // Get year from date range (use end year as primary for display)
  const endYear = new Date(config.endDate).getFullYear()
  const primaryYear = endYear

  // 4. YEAR STATS
  entries.push({
    type: 'YEAR_STATS',
    year: primaryYear,
    title: 'Summary',
    pageNumber: currentPage++,
  })

  // 5. YEAR CALENDAR
  entries.push({
    type: 'YEAR_AT_A_GLANCE',
    year: primaryYear,
    title: 'Year at a Glance',
    pageNumber: currentPage++,
  })

  // 6. RACE PAGES (all races together)
  for (const race of races) {
    entries.push({
      type: 'RACE_PAGE',
      activityId: race.id,
      title: race.name,
      highlightLabel: race.name,
      pageNumber: currentPage,
    })
    currentPage += 2 // Race spreads use 2 pages
  }

  // 7. MONTHLY SECTIONS
  // Group activities by year-month
  const activitiesByYearMonth = new Map<string, StravaActivity[]>()

  activities.forEach(activity => {
    const date = new Date(activity.start_date_local || activity.start_date)
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`

    if (!activitiesByYearMonth.has(key)) {
      activitiesByYearMonth.set(key, [])
    }
    activitiesByYearMonth.get(key)?.push(activity)
  })

  // Sort year-month keys chronologically
  const sortedYearMonths = Array.from(activitiesByYearMonth.keys()).sort()

  // Filter to only months within the selected date range
  const startDateObj = new Date(config.startDate)
  const endDateObj = new Date(config.endDate)

  for (const yearMonthKey of sortedYearMonths) {
    const [yearStr, monthStr] = yearMonthKey.split('-')
    const entryYear = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    // Check if this month is within the date range
    const monthStart = new Date(entryYear, month, 1)
    const monthEnd = new Date(entryYear, month + 1, 0)

    if (monthEnd < startDateObj || monthStart > endDateObj) {
      continue // Skip months outside the range
    }

    const monthActivities = activitiesByYearMonth.get(yearMonthKey) || []
    const monthNonRaces = monthActivities.filter(a => a.workout_type !== 1)

    if (monthNonRaces.length === 0) {
      continue // Skip months with only races
    }

    // MONTHLY DIVIDER (2-page spread)
    entries.push({
      type: 'MONTHLY_DIVIDER',
      month,
      year: entryYear,
      title: new Date(entryYear, month, 1).toLocaleString('en-US', { month: 'long' }),
      highlightLabel: `${monthNonRaces.length} activities`,
      pageNumber: currentPage++,
    })

    // ACTIVITY LOG pages for this month
    const activitiesPerPage = 6 // Adjust based on format
    const totalLogPages = Math.ceil(monthNonRaces.length / activitiesPerPage)

    for (let pageNum = 0; pageNum < totalLogPages; pageNum++) {
      const startIdx = pageNum * activitiesPerPage
      const pageActivities = monthNonRaces.slice(startIdx, startIdx + activitiesPerPage)

      entries.push({
        type: 'ACTIVITY_LOG',
        activityIds: pageActivities.map(a => a.id),
        pageNumber: currentPage++,
        title: new Date(entryYear, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      })
    }
  }

  // 8. BACK COVER
  entries.push({
    type: 'BACK_COVER',
    title: 'Back Cover',
    pageNumber: currentPage++,
  })

  return entries
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

    console.log('[ManualBook] Starting book generation')
    console.log('[ManualBook] Activities:', activities.length)
    console.log('[ManualBook] Races:', races.length)
    console.log('[ManualBook] Date range:', config.startDate, 'to', config.endDate)

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

    // Generate book entries
    const entries = generateManualBookEntries(
      activities,
      races,
      highlightMap,
      config
    )

    console.log('[ManualBook] Generated', entries.length, 'book entries')

    // Compute year summary
    const yearSummary = computeYearSummary(activities, primaryYear)

    // Render PDF
    console.log('[ManualBook] Rendering PDF...')
    const startTime = Date.now()

    const pdfBuffer = await renderToBuffer(
      BookDocument({
        entries,
        activities,
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
        // Pass photo URLs to templates that support them
        // These will be picked up by the template rendering in BookDocument
      })
    )

    const renderTime = Date.now() - startTime
    console.log('[ManualBook] PDF rendered in', renderTime, 'ms')
    console.log('[ManualBook] PDF size:', pdfBuffer.length, 'bytes')

    // Generate visual scores report (simplified - without actual visual judging for now)
    // Full visual judging would require PDF-to-image conversion and LLM calls
    const pageScores: PageScore[] = entries.map((entry, idx) => ({
      pageNumber: entry.pageNumber || idx + 1,
      pageType: entry.type,
      title: entry.title,
      // Skip actual visual judging for now - it would add significant time and complexity
      // The infrastructure is in place in visual-judge-iteration.ts for future use
    }))

    const scoresReport = createBookScoresReport(config.bookName, pageScores)
    const scoresMarkdown = generateScoresMarkdown(scoresReport)

    // Create response with PDF and scores
    const filename = config.bookName.replace(/\s+/g, '-').toLowerCase()

    // For simplicity, return just the PDF for now
    // The scores report can be added as a multipart response in future iterations
    const response = new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Cache-Control': 'no-cache',
        // Include scores in a custom header (base64 encoded for safety)
        'X-Scores-Report': Buffer.from(scoresMarkdown).toString('base64'),
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
