import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { StravaActivity, StravaPhoto, StravaComment, StravaStreams } from '@/lib/strava'

interface ComprehensiveData {
    activity: StravaActivity
    photos?: StravaPhoto[]
    comments?: StravaComment[]
    streams?: StravaStreams
}

interface AIGenerationResult {
    success: boolean
    designSpec: {
        layout: string
        theme: string
        colorPalette: {
            primary: string
            secondary: string
            accent: string
            background: string
        }
        selectedPhotos?: Array<{ url: string; caption: string }>
        narrative: {
            title: string
            subtitle: string
            story: string
            highlights: string[]
        }
        metadata: {
            model: string
            generatedAt: string
            processingTimeMs?: number
            dataUsed: {
                hasPhotos: boolean
                hasComments: boolean
                hasStreams: boolean
            }
        }
    }
}

// Mock AI response for POC
// When GEMINI_API_KEY is available, this will be replaced with real Gemini API calls
function generateMockAIResponse(comprehensiveData: ComprehensiveData, pageCount: number = 1): Promise<AIGenerationResult> {
    const activity = comprehensiveData.activity
    const photos = comprehensiveData.photos || []
    const comments = comprehensiveData.comments || []

    // Simulate AI processing time (1-3 seconds)
    const processingTime = 1000 + Math.random() * 2000

    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                designSpec: {
                    layout: 'hero_split',
                    theme: 'vibrant',
                    colorPalette: {
                        primary: '#FF6B35',
                        secondary: '#004E89',
                        accent: '#F7B801',
                        background: '#FFFFFF',
                    },
                    selectedPhotos: photos.slice(0, 1).map((p) => ({
                        url: p.urls?.['5000'] || p.urls?.[Object.keys(p.urls || {})[0]],
                        caption: p.caption || 'Race day memories',
                    })),
                    narrative: {
                        title: activity.name,
                        subtitle: `A ${(activity.distance / 1000).toFixed(2)}km journey`,
                        story: `On ${new Date(activity.start_date_local).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })}, you conquered ${(activity.distance / 1000).toFixed(2)} kilometers with ${activity.total_elevation_gain}m of elevation gain. ${comments.length > 0
                            ? `Your achievement inspired ${comments.length} ${comments.length === 1 ? 'comment' : 'comments'} from the community.`
                            : 'An impressive solo effort.'
                            }`,
                        highlights: [
                            `Distance: ${(activity.distance / 1000).toFixed(2)} km`,
                            `Elevation: ${activity.total_elevation_gain} m`,
                            `Time: ${Math.floor(activity.moving_time / 3600)}h ${Math.floor((activity.moving_time % 3600) / 60)}m`,
                        ],
                    },
                    metadata: {
                        model: 'mock-claude-3.5-sonnet',
                        generatedAt: new Date().toISOString(),
                        processingTimeMs: processingTime,
                        dataUsed: {
                            hasPhotos: photos.length > 0,
                            hasComments: comments.length > 0,
                            hasStreams: Object.keys(comprehensiveData.streams || {}).length > 0,
                        },
                    },
                },
            })
        }, processingTime)
    })
}

// Real AI generation function using Google Gemini
async function generateWithGemini(comprehensiveData: ComprehensiveData, pageCount: number = 1) {
    const apiKey = process.env.GEMINI_API_KEY

    console.log('[Gemini] Starting generation...')
    console.log('[Gemini] Page count:', pageCount)

    if (!apiKey) {
        console.error('[Gemini] API key not configured')
        throw new Error('GEMINI_API_KEY not configured')
    }

    console.log('[Gemini] Importing SDK...')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const activity = comprehensiveData.activity
    const photos = comprehensiveData.photos || []
    const comments = comprehensiveData.comments || []
    const streams = comprehensiveData.streams || {}

    console.log('[Gemini] Activity data:', {
        name: activity.name,
        distance: activity.distance,
        photoCount: photos.length,
        commentCount: comments.length,
    })

    // Build page-specific layout guidance
    const pageGuidance = pageCount === 1
        ? 'SINGLE PAGE: Create a compact, hero-style layout with key stats and 1-2 photos. Focus on visual impact.'
        : pageCount === 2
            ? 'TWO PAGES: Design a spread with page 1 as hero/narrative and page 2 for detailed stats, photos, and comments.'
            : 'THREE PAGES: Create an editorial spread - page 1: hero with main photo, page 2: stats/splits/map, page 3: photo gallery and comments.'

    // Build a comprehensive prompt for the AI
    const prompt = `You are "The Designer" for a commemorative race book. Your role is to analyze activity data and create a beautiful, personalized design specification for a race page.

PAGE REQUIREMENTS: ${pageCount} page(s)
${pageGuidance}

ACTIVITY DATA:
- Name: ${activity.name}
- Date: ${new Date(activity.start_date_local).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
- Distance: ${(activity.distance / 1000).toFixed(2)} km
- Time: ${Math.floor(activity.moving_time / 3600)}h ${Math.floor((activity.moving_time % 3600) / 60)}m
- Elevation Gain: ${activity.total_elevation_gain} m
- Location: ${activity.location_city || 'Unknown'}
- Type: ${activity.type}
${activity.description ? `- Description: ${activity.description}` : ''}

AVAILABLE PHOTOS: ${photos.length} photo(s)
COMMUNITY ENGAGEMENT: ${comments.length} comment(s)
PERFORMANCE DATA: ${Object.keys(streams).length > 0 ? 'Detailed pace, elevation, and route data available' : 'Summary data only'}

YOUR TASK:
Generate a JSON design specification for this ${pageCount}-page race layout. Consider:
1. The achievement level (distance, elevation, time)
2. The emotional tone (celebratory, reflective, triumphant)
3. Available visual assets (photos)
4. Community engagement (comments)
5. How to distribute content across ${pageCount} page(s)

IMPORTANT: Return ONLY a valid JSON object with this EXACT structure:
{
  "fonts": {
    "pageTitle": { "family": "Helvetica-Bold", "size": 28, "weight": "bold", "color": "#000000" },
    "sectionTitle": { "family": "Helvetica-Bold", "size": 12, "weight": "bold", "color": "#fc4c02" },
    "body": { "family": "Helvetica", "size": 10, "weight": "normal", "color": "#333333" },
    "accent": { "family": "Helvetica-Oblique", "size": 11, "weight": "normal", "color": "#666666" }
  },
  "colorScheme": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "background": "#FFFFFF",
    "text": "#333333",
    "accent": "#999999"
  },
  "theme": "bold-modern" | "minimal-clean" | "vintage-newspaper" | "elegant-magazine",
  "layout": "hero-image-top" | "split-columns" | "photo-grid" | "narrative-focus",
  "layoutDescription": "Brief description of the layout you chose and why (1-2 sentences)",
  "narrative": "A 2-3 sentence narrative about this achievement (focus on the journey, the challenge, the accomplishment)"
}

FONT GUIDELINES:
- family must be one of: "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Times-Roman", "Times-Bold", "Times-Italic", "Courier"
- pageTitle size: 24-36
- sectionTitle size: 10-14
- body size: 8-11
- accent size: 9-12

COLOR GUIDELINES:
- Choose colors that match the race theme and achievement level
- primary: Main accent color (vibrant for big achievements, subtle for regular runs)
- secondary: Supporting color (can be similar to primary or complementary)
- background: Usually white or very light
- text: Dark for readability
- accent: Medium gray for labels

THEME GUIDELINES:
- "bold-modern": Large fonts, vibrant colors, high contrast
- "minimal-clean": Smaller fonts, muted colors, lots of whitespace
- "vintage-newspaper": Classic fonts, black/sepia tones, traditional layout
- "elegant-magazine": Refined fonts, sophisticated colors, balanced composition

Be creative and personalized. Make the athlete feel proud of their achievement!`

    console.log('[Gemini] Sending request to API...')
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    console.log('[Gemini] Received response, length:', text.length)
    console.log('[Gemini] Response preview:', text.substring(0, 200))

    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '')
    }

    console.log('[Gemini] Parsing JSON...')
    const designSpec = JSON.parse(jsonText)

    console.log('[Gemini] Successfully parsed design spec:', {
        layout: designSpec.layout,
        theme: designSpec.theme,
    })

    return {
        success: true,
        designSpec: {
            ...designSpec,
            selectedPhotos: photos.slice(0, 1).map((p) => ({
                url: p.urls?.['5000'] || p.urls?.[Object.keys(p.urls || {})[0]],
                caption: p.caption || 'Race day memories',
            })),
            metadata: {
                model: 'gemini-2.0-flash-exp',
                generatedAt: new Date().toISOString(),
                dataUsed: {
                    hasPhotos: photos.length > 0,
                    hasComments: comments.length > 0,
                    hasStreams: Object.keys(streams).length > 0,
                },
            },
        },
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        console.error('[AI Generate] Unauthorized request - no session')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { activityId, comprehensiveData, pageCount = 1, dataSelection } = body

        console.log('[AI Generate] Request received for activity:', activityId)
        console.log('[AI Generate] Configuration:', {
            pageCount,
            includePhotos: dataSelection?.includePhotos,
            selectedPhotoCount: dataSelection?.selectedPhotoIds?.length || 0,
            includeComments: dataSelection?.includeComments,
            includeSplits: dataSelection?.includeSplits,
        })
        console.log('[AI Generate] Data summary:', {
            hasActivity: !!comprehensiveData?.activity,
            photoCount: comprehensiveData?.photos?.length || 0,
            commentCount: comprehensiveData?.comments?.length || 0,
            hasStreams: Object.keys(comprehensiveData?.streams || {}).length > 0,
        })

        if (!activityId || !comprehensiveData) {
            console.error('[AI Generate] Missing required data:', { activityId, hasData: !!comprehensiveData })
            return NextResponse.json(
                { error: 'activityId and comprehensiveData are required' },
                { status: 400 }
            )
        }

        // Check environment variables
        const geminiKey = process.env.GEMINI_API_KEY
        const useRealAI = process.env.USE_REAL_AI === 'true'

        console.log('[AI Generate] Environment check:', {
            hasGeminiKey: !!geminiKey,
            geminiKeyPrefix: geminiKey ? geminiKey.substring(0, 10) + '...' : 'NOT SET',
            useRealAI,
        })

        // Use mock response for POC
        // Switch to real Gemini API when GEMINI_API_KEY is configured
        const shouldUseRealAI = geminiKey && useRealAI

        console.log('[AI Generate] Using:', shouldUseRealAI ? 'Real Gemini API' : 'Mock response')

        const result: AIGenerationResult = shouldUseRealAI
            ? await generateWithGemini(comprehensiveData, pageCount)
            : await generateMockAIResponse(comprehensiveData, pageCount)

        console.log('[AI Generate] Generation successful:', {
            hasDesignSpec: !!result.designSpec,
            layout: result.designSpec?.layout,
            theme: result.designSpec?.theme,
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('[AI Generate] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            error,
        })

        return NextResponse.json(
            {
                error: 'Failed to generate AI layout',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
