import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  runDesignSession,
  createSession,
  DesignSessionOptions
} from '@/lib/ai-book-designer'
import { StravaActivity, StravaPhoto } from '@/lib/strava'

interface StartDesignRequest {
  activities: StravaActivity[]
  photos?: StravaPhoto[]
  options?: {
    useMock?: boolean
    verbose?: boolean
    maxDesignIterations?: number
    targetScore?: number
    userPreference?: 'minimal' | 'bold' | 'classic'
    year?: number
    runAsync?: boolean
  }
}

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const body: StartDesignRequest = await request.json()
    const { activities, photos = [], options = {} } = body

    if (!activities || activities.length === 0) {
      return NextResponse.json(
        { error: 'No activities provided' },
        { status: 400 }
      )
    }

    console.log('[AI Book Designer] Starting design session')
    console.log('[AI Book Designer] Activities:', activities.length)
    console.log('[AI Book Designer] Photos:', photos.length)
    console.log('[AI Book Designer] Options:', options)

    // Determine if we should use mock or real AI
    const useMock = options.useMock ?? (process.env.USE_REAL_AI !== 'true')

    const designOptions: DesignSessionOptions = {
      useMock,
      verbose: options.verbose ?? true,
      maxDesignIterations: options.maxDesignIterations ?? 3,
      targetScore: options.targetScore ?? 70,
      userPreference: options.userPreference ?? 'classic',
      year: options.year
    }

    if (options.runAsync) {
      // Create session and return immediately for async processing
      const designSession = createSession(activities, photos, designOptions)

      console.log('[AI Book Designer] Created async session:', designSession.id)

      // Start the design process in the background
      // Note: In production, this would be handled by a job queue
      runDesignSession(activities, photos, designOptions)
        .then(result => {
          console.log('[AI Book Designer] Async session completed:', result.id)
        })
        .catch(error => {
          console.error('[AI Book Designer] Async session failed:', error)
        })

      return NextResponse.json({
        success: true,
        sessionId: designSession.id,
        status: designSession.status,
        message: 'Design session started. Poll /api/ai-book-designer/status/[sessionId] for progress.'
      })
    } else {
      // Run synchronously and return full result
      const result = await runDesignSession(activities, photos, designOptions)

      console.log('[AI Book Designer] Session completed:', result.id)
      console.log('[AI Book Designer] Status:', result.status)
      console.log('[AI Book Designer] Pages:', result.output?.designer?.pages.length ?? 0)

      return NextResponse.json({
        success: true,
        sessionId: result.id,
        status: result.status,
        progress: result.progress,
        output: result.output,
        errors: result.errors
      })
    }
  } catch (error) {
    console.error('[AI Book Designer] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to start design session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
