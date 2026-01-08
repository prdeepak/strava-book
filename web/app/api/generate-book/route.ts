import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { FullBookDocument } from '@/components/templates/BookDocument'
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'

interface BookGenerationRequest {
    activities: StravaActivity[]
    config: {
        title?: string
        athleteName: string
        year: number
        forewordText?: string
        format: BookFormat
        theme: BookTheme
    }
}

export async function POST(request: NextRequest) {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body: BookGenerationRequest = await request.json()
        const { activities, config } = body

        if (!activities || activities.length === 0) {
            return NextResponse.json(
                { error: 'No activities provided' },
                { status: 400 }
            )
        }

        console.log('[Book Generation] Starting book generation')
        console.log('[Book Generation] Activities:', activities.length)
        console.log('[Book Generation] Year:', config.year)
        console.log('[Book Generation] Format:', config.format?.size || '10x10')

        // Use athlete name from session if not provided
        const athleteName = config.athleteName || session.user?.name || 'Athlete'

        // Ensure format is valid
        const format = config.format || FORMATS['10x10']
        const theme = config.theme || DEFAULT_THEME

        // Render PDF using FullBookDocument
        console.log('[Book Generation] Rendering PDF...')
        const startTime = Date.now()

        const pdfBuffer = await renderToBuffer(
            FullBookDocument({
                activities,
                title: config.title,
                athleteName,
                year: config.year,
                forewordText: config.forewordText,
                format,
                theme,
            })
        )

        const renderTime = Date.now() - startTime
        console.log('[Book Generation] PDF rendered in', renderTime, 'ms')
        console.log('[Book Generation] PDF size:', pdfBuffer.length, 'bytes')

        // Return PDF
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
        const filename = config.title
            ? `${config.title.replace(/\s+/g, '-').toLowerCase()}.pdf`
            : `strava-book-${config.year}-${timestamp}.pdf`

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache',
            },
        })
    } catch (error) {
        console.error('[Book Generation] Error:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate book',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
