import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { AIRace } from '@/components/templates/AIRace'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: NextRequest) {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const { designSpec, comprehensiveData, pageCount, activityId } = await request.json()

        console.log('[PDF Generation] Starting PDF generation for activity:', activityId)
        console.log('[PDF Generation] Page count:', pageCount)
        console.log('[PDF Generation] Theme:', designSpec.theme)
        console.log('[PDF Generation] Photo count:', comprehensiveData.photos?.length || 0)
        if (comprehensiveData.photos?.length > 0) {
            console.log('[PDF Generation] First photo sample:', JSON.stringify(comprehensiveData.photos[0], null, 2))
        }

        // Render PDF using AIRace component
        const pdfBuffer = await renderToBuffer(
            AIRace({
                designSpec,
                comprehensiveData,
                pageCount
            })
        )

        console.log('[PDF Generation] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

        // Return PDF as blob (convert Buffer to Uint8Array for NextResponse)
        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="activity-${activityId}-ai-generated.pdf"`,
                'Cache-Control': 'no-cache'
            }
        })
    } catch (error) {
        console.error('[PDF Generation] Error:', error)
        return new NextResponse(
            JSON.stringify({ error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}
