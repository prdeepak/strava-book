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

    // Use Gemini 2.0 Flash Thinking Experimental for more creative, intelligent designs
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-thinking-exp-1219'
    })

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

    // Build a comprehensive prompt for creative scrapbook-style layouts
    const prompt = `You are a CREATIVE GRAPHIC DESIGNER creating a custom race poster with a scrapbook/magazine aesthetic.

CANVAS: Letter size page (612 x 792 points)
SAFE MARGINS: Leave 25-30pt margin on all sides

ACTIVITY DATA:
- Name: ${activity.name}
- Date: ${new Date(activity.start_date_local).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
- Distance: ${(activity.distance / 1000).toFixed(2)} km
- Time: ${Math.floor(activity.moving_time / 3600)}h ${Math.floor((activity.moving_time % 3600) / 60)}m
- Elevation: ${activity.total_elevation_gain} m
- Location: ${activity.location_city || 'Unknown'}
${activity.description ? `- Description: ${activity.description}` : ''}
- Available Photos: ${photos.length}
- Comments: ${comments.length}

YOUR TASK: Create a SCRAPBOOK-STYLE layout using bodyElements with creative positioning, rotation, and overlapping!

Return ONLY valid JSON with this structure:
{
  "fonts": {
    "pageTitle": { "family": "Helvetica-Bold", "size": 36, "color": "#000000" },
    "sectionTitle": { "family": "Helvetica-Bold", "size": 14, "color": "#fc4c02" },
    "body": { "family": "Helvetica", "size": 10, "color": "#333333" },
    "accent": { "family": "Times-Italic", "size": 12, "color": "#666666" }
  },
  "colorScheme": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "background": "#FFFFFF",
    "text": "#333333",
    "accent": "#999999"
  },
  "background": {
    "type": "solid",
    "color": "#FFFFFF"
  },
  "theme": "scrapbook-modern",
  "narrative": "2-3 sentence story about this achievement",
  "bodyElements": [
    {
      "type": "photo",
      "photoIndex": 0,
      "position": { "x": 60, "y": 120 },
      "size": { "width": 280, "height": 200 },
      "rotation": -3,
      "zIndex": 1,
      "style": {
        "borderRadius": 8,
        "shadow": { "offsetX": 4, "offsetY": 4, "blur": 10, "color": "#00000040" }
      }
    },
    {
      "type": "textBox",
      "content": "RACE TITLE",
      "position": { "x": 50, "y": 80 },
      "size": { "width": 300, "height": 50 },
      "rotation": -1,
      "zIndex": 3,
      "style": {
        "font": "pageTitle",
        "backgroundColor": "#fc4c02",
        "padding": 10,
        "textAlign": "center"
      }
    }
  ]
}

CREATIVE GUIDELINES:

**Positioning Strategy:**
- Scatter elements across the page (not grid-aligned!)
- Overlap elements for depth (use z-index)
- Rotate photos -5° to 5° for scrapbook feel
- Rotate text boxes -2° to 2° for dynamic look
- Leave breathing room - don't overcrowd

**Element Types:**
1. **photo**: Display race photos
   - Use photoIndex (0, 1, 2) to reference photos
   - Add rotation for scrapbook feel
   - Add shadows for depth
   - Vary sizes (large hero: 300x220, medium: 200x150, small: 120x90)

2. **textBox**: Custom text (title, labels, narrative)
   - Use for race title (large, bold, colored background)
   - Use for narrative (smaller, subtle background)
   - Rotate slightly for visual interest

3. **stat**: Key metrics (distance, time, pace, elevation)
   - Position creatively (not in a row!)
   - Can overlap photos slightly
   - Use colored backgrounds or borders

4. **comment**: User comments
   - Speech bubble style with background
   - Rotate slightly
   - Position near photos

**Visual Style:**
- Mix rotations: some left (-5°), some right (3°), some straight (0°)
- Layer elements: photos at z:1-2, text at z:3-5, decorative at z:0
- Use shadows on photos and important text boxes
- Colored backgrounds on text boxes (primary color or white with opacity)
- Round corners on photos (borderRadius: 8-12)

**Example Layout Pattern:**
1. Large hero photo (rotated -3°, top-left area)
2. Title text box overlapping photo (rotated -1°, z-index higher)
3. 2-3 smaller photos scattered (different rotations)
4. Stats positioned creatively around photos
5. Narrative text box (subtle background, slight rotation)
6. 1-2 comment boxes near photos

**Page Coordinates:**
- Top area: y: 60-200
- Middle area: y: 200-500  
- Bottom area: y: 500-720
- Left side: x: 40-200
- Center: x: 200-400
- Right side: x: 400-550

Be BOLD and CREATIVE! Make it look like a professionally designed scrapbook page, not a template!`

    console.log('[Gemini] Sending request to API...')

    let result
    try {
        result = await model.generateContent(prompt)
    } catch (error) {
        console.error('[Gemini] Error calling API:', error)
        // Fallback to regular flash model if thinking model fails
        console.log('[Gemini] Falling back to regular flash model...')
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
        result = await fallbackModel.generateContent(prompt)
    }

    const response = result.response
    const text = response.text()

    console.log('[Gemini] Received response, length:', text.length)
    console.log('[Gemini] Response preview:', text.substring(0, 300))

    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '')
    }

    console.log('[Gemini] Parsing JSON...')
    console.log('[Gemini] JSON text preview:', jsonText.substring(0, 200))

    let designSpec
    try {
        designSpec = JSON.parse(jsonText)
    } catch (parseError) {
        console.error('[Gemini] JSON parse error:', parseError)
        console.error('[Gemini] Failed JSON text:', jsonText)
        throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    console.log('[Gemini] Successfully parsed design spec')
    console.log('[Gemini] Has bodyElements:', !!designSpec.bodyElements)
    if (designSpec.bodyElements) {
        console.log('[Gemini] Body elements count:', designSpec.bodyElements.length)
    }

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
