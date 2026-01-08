import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getSession } from '@/lib/ai-book-designer'

interface RouteParams {
  params: Promise<{
    sessionId: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { sessionId } = await params

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    )
  }

  console.log('[AI Book Designer Status] Checking session:', sessionId)

  const designSession = getSession(sessionId)

  if (!designSession) {
    return NextResponse.json(
      { error: 'Session not found', sessionId },
      { status: 404 }
    )
  }

  // Return session status and progress
  const response = {
    sessionId: designSession.id,
    status: designSession.status,
    createdAt: designSession.createdAt,
    updatedAt: designSession.updatedAt,
    progress: designSession.progress,
    errors: designSession.errors
  }

  // Include full output if session is completed
  if (designSession.status === 'completed') {
    return NextResponse.json({
      ...response,
      output: designSession.output
    })
  }

  // Include partial output for in-progress sessions
  if (designSession.status !== 'pending' && designSession.status !== 'error') {
    return NextResponse.json({
      ...response,
      partialOutput: {
        hasArtDirector: !!designSession.output?.artDirector,
        hasNarrator: !!designSession.output?.narrator,
        hasDesigner: !!designSession.output?.designer,
        artDirectorTheme: designSession.output?.artDirector?.theme,
        chapterCount: designSession.output?.narrator?.chapters?.length ?? 0,
        highlightCount: designSession.output?.narrator?.highlights?.length ?? 0
      }
    })
  }

  return NextResponse.json(response)
}
