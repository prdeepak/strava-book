import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { VertexAI } from '@google-cloud/vertexai'

interface ActivityData {
    name: string
    distance: string
    time: string
    elevation: number
    date: string
    location: string
    photoCount: number
}

interface ImageRequest {
    contents: Array<{
        role: string
        parts: Array<{ text: string }>
    }>
}

interface ImagePart {
    inlineData?: {
        data: string
        mimeType?: string
    }
}

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const activityData = body.activityData as ActivityData

        console.log('[Mockup] Generating visual mockup for:', activityData.name)

        // Initialize Vertex AI
        const projectId = process.env.GOOGLE_CLOUD_PROJECT
        if (!projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT environment variable not set')
        }

        const vertexAI = new VertexAI({
            project: projectId,
            location: 'us-central1'
        })

        // Use Imagen 3 for mockup generation
        const model = vertexAI.preview.getGenerativeModel({
            model: 'imagen-3.0-generate-001'
        })

        // Create detailed prompt for scrapbook-style layout
        const prompt: string = `Create a scrapbook-style race poster mockup layout design:

RACE DETAILS:
- Name: ${activityData.name}
- Distance: ${activityData.distance} km
- Time: ${activityData.time}
- Elevation: ${activityData.elevation} m
- Date: ${activityData.date}
- Location: ${activityData.location}
- Available Photos: ${activityData.photoCount}

DESIGN REQUIREMENTS:
- Scrapbook/magazine aesthetic with creative layout
- Show placeholder boxes for ${activityData.photoCount} photos at jaunty angles (-5° to 5°)
- Bold, eye-catching title placement (rotated slightly)
- Stats displayed in creative positions (not in a boring row)
- Handwritten-style annotations and labels
- Overlapping elements for depth and visual interest
- Drop shadows on photos for dimension
- Colored backgrounds on text boxes
- Professional but playful scrapbook design

STYLE:
- Vibrant, energetic colors
- Dynamic, non-grid layout
- Magazine/scrapbook collage aesthetic
- Show the LAYOUT DESIGN with placeholder elements (wireframe style is OK)

Create a visually stunning mockup that looks like a professionally designed race memory page!`

        console.log('[Mockup] Sending request to Imagen 3...')

        // Generate mockup image using correct Imagen 3 API format
        const imageRequest: ImageRequest = {
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }]
        }

        const result = await model.generateContent(imageRequest)

        console.log('[Mockup] Image generated successfully')

        // Extract image from response
        const response = result.response
        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('No image generated')
        }

        // Get the image data (Imagen returns base64 encoded image)
        const candidate = response.candidates[0]
        const imagePart = candidate.content.parts.find((part: ImagePart) => part.inlineData)

        if (!imagePart || !imagePart.inlineData) {
            throw new Error('No image data in response')
        }

        const imageBytes = imagePart.inlineData.data
        const mimeType = imagePart.inlineData.mimeType || 'image/png'

        // Convert to data URL for display
        const mockupUrl = `data:${mimeType};base64,${imageBytes}`

        console.log('[Mockup] Mockup URL created, length:', mockupUrl.length)

        return NextResponse.json({
            success: true,
            mockupUrl,
            metadata: {
                model: 'imagen-3.0-generate-001',
                generatedAt: new Date().toISOString(),
            }
        })

    } catch (error) {
        console.error('[Mockup] Error generating mockup:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate mockup',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
