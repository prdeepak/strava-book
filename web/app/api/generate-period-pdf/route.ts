import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { normalizeFontName } from '@/lib/ai-validation'
import { PDFDocument as PDFLibDocument } from 'pdf-lib'
import React from 'react'

// Import templates
import { YearStats } from '@/components/templates/YearStats'
import { YearCalendar } from '@/components/templates/YearCalendar'
import { MonthlyDivider } from '@/components/templates/MonthlyDivider'
import { ActivityLog } from '@/components/templates/ActivityLog'

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

/**
 * Group activities by month for MonthlyDivider pages
 */
function groupActivitiesByMonth(activities: StravaActivity[]): Map<string, StravaActivity[]> {
    const byMonth = new Map<string, StravaActivity[]>()

    activities.forEach(activity => {
        const date = new Date(activity.start_date_local || activity.start_date)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

        if (!byMonth.has(key)) {
            byMonth.set(key, [])
        }
        byMonth.get(key)!.push(activity)
    })

    // Sort by month key
    return new Map([...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

type TemplateType = 'year_stats' | 'year_calendar' | 'monthly_divider' | 'activity_log' | 'concat_all'
type ColorBy = 'distance' | 'time' | 'count' | 'elevation'

interface PeriodPDFRequest {
    activities: StravaActivity[]
    template: TemplateType
    variant?: string
    colorBy?: ColorBy
    periodName?: string
    startDate: string
    endDate: string
    format: BookFormat
    theme: BookTheme
}

export async function POST(request: NextRequest) {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body: PeriodPDFRequest = await request.json()
        const { activities, template, variant, colorBy, periodName, startDate, endDate } = body

        if (!activities || activities.length === 0) {
            return NextResponse.json(
                { error: 'No activities provided' },
                { status: 400 }
            )
        }

        console.log('[Period PDF] Starting generation')
        console.log('[Period PDF] Activities:', activities.length)
        console.log('[Period PDF] Template:', template)
        console.log('[Period PDF] Variant:', variant)

        // Ensure format is valid
        const format = body.format || FORMATS['10x10']
        const rawTheme = body.theme || DEFAULT_THEME
        const theme = normalizeThemeFonts(rawTheme)

        console.log('[Period PDF] Format:', format.size)
        console.log('[Period PDF] Theme fonts:', theme.fontPairing.heading, '/', theme.fontPairing.body)

        const startTime = Date.now()
        let pdfBuffer: Buffer

        switch (template) {
            case 'year_stats':
                pdfBuffer = await renderYearStats(activities, { periodName, startDate, endDate, format, theme })
                break

            case 'year_calendar':
                pdfBuffer = await renderYearCalendar(activities, { colorBy: colorBy || 'distance', format, theme })
                break

            case 'monthly_divider':
                pdfBuffer = await renderMonthlyDividers(activities, { format, theme })
                break

            case 'activity_log':
                pdfBuffer = await renderActivityLog(activities, { variant: variant || 'grid', format, theme })
                break

            case 'concat_all':
                pdfBuffer = await renderConcatAll(activities, { periodName, startDate, endDate, format, theme })
                break

            default:
                return NextResponse.json(
                    { error: `Unknown template: ${template}` },
                    { status: 400 }
                )
        }

        const renderTime = Date.now() - startTime
        console.log('[Period PDF] Generated in', renderTime, 'ms')
        console.log('[Period PDF] Size:', pdfBuffer.length, 'bytes')

        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
        const templateLabel = template === 'concat_all' ? 'period-templates' : template.replace('_', '-')
        const filename = `${templateLabel}-${timestamp}.pdf`

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache',
            },
        })
    } catch (error) {
        console.error('[Period PDF] Error:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate period PDF',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

// =============================================================================
// Individual Template Renderers
// =============================================================================

async function renderYearStats(
    activities: StravaActivity[],
    config: { periodName?: string; startDate?: string; endDate?: string; format: BookFormat; theme: BookTheme }
): Promise<Buffer> {
    // Call template as function (same pattern as generate-book/route.ts)
    const buffer = await renderToBuffer(
        YearStats({
            activities,
            periodName: config.periodName,
            startDate: config.startDate,
            endDate: config.endDate,
            format: config.format,
            theme: config.theme,
        })
    )
    return Buffer.from(buffer)
}

async function renderYearCalendar(
    activities: StravaActivity[],
    config: { colorBy: ColorBy; format: BookFormat; theme: BookTheme }
): Promise<Buffer> {
    // Determine year from activities
    const years = activities.map(a => new Date(a.start_date_local || a.start_date).getFullYear())
    const year = years.length > 0 ? Math.max(...years) : new Date().getFullYear()

    // Call template as function (same pattern as generate-book/route.ts)
    const buffer = await renderToBuffer(
        YearCalendar({
            activities,
            year,
            colorBy: config.colorBy,
            format: config.format,
            theme: config.theme,
        })
    )
    return Buffer.from(buffer)
}

async function renderMonthlyDividers(
    activities: StravaActivity[],
    config: { format: BookFormat; theme: BookTheme }
): Promise<Buffer> {
    const byMonth = groupActivitiesByMonth(activities)
    const buffers: Buffer[] = []

    for (const [monthKey, monthActivities] of byMonth) {
        const [yearStr, monthStr] = monthKey.split('-')
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10) - 1 // Convert to 0-indexed

        // MonthlyDivider returns a Page, so we wrap it in a Document
        const dividerPage = MonthlyDivider({
            activities: monthActivities,
            month,
            year,
            format: config.format,
            theme: config.theme,
        })
        const buffer = await renderToBuffer(
            React.createElement(Document, {}, dividerPage)
        )
        buffers.push(Buffer.from(buffer))
    }

    // Merge all monthly dividers into one PDF
    if (buffers.length === 1) {
        return buffers[0]
    }
    return mergeBuffers(buffers)
}

async function renderActivityLog(
    activities: StravaActivity[],
    config: { variant: string; format: BookFormat; theme: BookTheme }
): Promise<Buffer> {
    // Call template as function (same pattern as generate-book/route.ts)
    const buffer = await renderToBuffer(
        ActivityLog({
            activities,
            variant: config.variant as 'grid' | 'concise' | 'full',
            format: config.format,
            theme: config.theme,
            mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        })
    )
    return Buffer.from(buffer)
}

async function renderConcatAll(
    activities: StravaActivity[],
    config: { periodName?: string; startDate?: string; endDate?: string; format: BookFormat; theme: BookTheme }
): Promise<Buffer> {
    const buffers: Buffer[] = []

    // 1. YearStats
    console.log('[Period PDF] Rendering YearStats...')
    const yearStatsBuffer = await renderYearStats(activities, config)
    buffers.push(yearStatsBuffer)

    // 2. YearCalendar - all colorBy options
    const colorByOptions: ColorBy[] = ['distance', 'time', 'count', 'elevation']
    for (const colorBy of colorByOptions) {
        console.log(`[Period PDF] Rendering YearCalendar (${colorBy})...`)
        const calendarBuffer = await renderYearCalendar(activities, {
            colorBy,
            format: config.format,
            theme: config.theme,
        })
        buffers.push(calendarBuffer)
    }

    // 3. MonthlyDividers (all months with activities)
    console.log('[Period PDF] Rendering MonthlyDividers...')
    const monthlyBuffer = await renderMonthlyDividers(activities, {
        format: config.format,
        theme: config.theme,
    })
    buffers.push(monthlyBuffer)

    // NOTE: ActivityLog is intentionally excluded per requirements

    // Merge all PDFs
    console.log('[Period PDF] Merging', buffers.length, 'PDF segments...')
    return mergeBuffers(buffers)
}

// =============================================================================
// PDF Merging Utility
// =============================================================================

async function mergeBuffers(buffers: Buffer[]): Promise<Buffer> {
    const mergedPdf = await PDFLibDocument.create()

    for (const buffer of buffers) {
        const pdf = await PDFLibDocument.load(buffer)
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach(page => mergedPdf.addPage(page))
    }

    return Buffer.from(await mergedPdf.save())
}
