import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

interface ActivityData {
    name: string
    distance: string
    time: string
    elevation: number
    date: string
    location: string
    photoCount: number
}

interface LayoutDescription {
    theme: string
    aesthetic: string
    colorPalette: {
        primary: string
        secondary: string
        accent: string
        background: string
        text: string
    }
    typography: {
        pageTitle: string
        sectionTitle: string
        body: string
        accent: string
    }
    layoutStrategy: string
    photoPlacement: string[]
    textElements: string[]
    visualHierarchy: string
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

        console.log('[Mockup] Generating text-based layout description for:', activityData.name)

        // Check for Gemini API key
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        // Import Gemini SDK
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(apiKey)

        // Use Gemini 2.0 Flash for creative layout descriptions
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp'
        })

        // Create prompt for detailed layout description
        const prompt = `You are a CREATIVE ART DIRECTOR designing a scrapbook-style race poster layout.

RACE DETAILS:
- Name: ${activityData.name}
- Distance: ${activityData.distance} km
- Time: ${activityData.time}
- Elevation: ${activityData.elevation} m
- Date: ${activityData.date}
- Location: ${activityData.location}
- Available Photos: ${activityData.photoCount}

YOUR TASK: Create a detailed, human-readable description of a creative scrapbook-style layout design.

Return ONLY valid JSON with this structure:
{
  "theme": "Brief theme name (e.g., 'Vibrant Scrapbook', 'Modern Minimalist', 'Editorial Bold')",
  "aesthetic": "2-3 sentence description of the overall visual style and mood",
  "colorPalette": {
    "primary": "#HEX (main brand color, vibrant and eye-catching)",
    "secondary": "#HEX (complementary color)",
    "accent": "#HEX (highlight color for important elements)",
    "background": "#HEX (page background, usually white or light)",
    "text": "#HEX (main text color, usually dark gray or black)"
  },
  "typography": {
    "pageTitle": "Font choice for main title - Available fonts: Helvetica, Helvetica-Bold, Times-Roman, Times-Bold, Times-Italic, Courier, Courier-Bold, Roboto, Open Sans, Montserrat, Playfair Display, Pacifico (e.g., 'Montserrat, 36pt' or 'Playfair Display, 40pt')",
    "sectionTitle": "Font for section headers - Available fonts: Helvetica, Helvetica-Bold, Times-Roman, Times-Bold, Roboto, Open Sans, Montserrat, Playfair Display (e.g., 'Roboto, 14pt')",
    "body": "Font for body text - Available fonts: Helvetica, Times-Roman, Roboto, Open Sans (e.g., 'Open Sans, 10pt')",
    "accent": "Font for decorative text - Available fonts: Helvetica, Times-Italic, Roboto, Montserrat, Playfair Display, Pacifico (e.g., 'Pacifico, 16pt' for handwritten feel)"
  },
  "layoutStrategy": "Detailed description of the overall layout approach - where elements are positioned, how they overlap, the visual flow from top to bottom, use of rotation and angles for scrapbook feel",
  "photoPlacement": [
    "Description of photo 1 placement (e.g., 'Large hero photo in top-left, rotated -3°, size 280x200pt')",
    "Description of photo 2 placement if applicable",
    "Description of photo 3 placement if applicable"
  ],
  "textElements": [
    "Race title placement (e.g., 'Bold title overlapping hero photo, slight rotation, orange background')",
    "Stats placement (e.g., 'Distance, time, pace scattered creatively around photos, not in a grid')",
    "Narrative placement (e.g., 'Story text in bottom section with subtle background')",
    "Other decorative text elements"
  ],
  "visualHierarchy": "Explanation of what draws the eye first, second, third - the visual flow and emphasis"
}

DESIGN PRINCIPLES:
- Scrapbook aesthetic: elements at jaunty angles (-5° to 5°), overlapping for depth
- Dynamic, non-grid layout: avoid boring rows and columns
- Creative positioning: scatter elements across the page
- Visual interest: mix of photo sizes, rotated text boxes, colored backgrounds
- Professional but playful: looks hand-crafted but polished

Be SPECIFIC and CREATIVE in your descriptions. Make it sound exciting and visually compelling!`

        console.log('[Mockup] Sending request to Gemini...')

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        console.log('[Mockup] Received response, length:', text.length)

        // Extract JSON from response
        let jsonText = text.trim()
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '')
        }

        let layoutDescription: LayoutDescription
        try {
            layoutDescription = JSON.parse(jsonText)
        } catch (parseError) {
            console.error('[Mockup] JSON parse error:', parseError)
            throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
        }

        console.log('[Mockup] Successfully generated layout description')

        return NextResponse.json({
            success: true,
            description: layoutDescription,
            metadata: {
                model: 'gemini-2.0-flash-exp',
                generatedAt: new Date().toISOString(),
            }
        })

    } catch (error) {
        console.error('[Mockup] Error generating layout description:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate layout description',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
