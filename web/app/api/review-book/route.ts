import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { reviewBook, reviewBookHeuristic } from '@/lib/book-reviewer'
import { buildManifest, BookManifest } from '@/lib/book-manifest'
import { BookEntry } from '@/lib/curator'
import { StravaActivity } from '@/lib/strava'

// ============================================================================
// Types
// ============================================================================

interface ReviewFromManifestRequest {
  manifestJson: string
  contactSheetPaths?: string[]
}

interface ReviewFromEntriesRequest {
  bookEntriesJson: string
  activitiesJson?: string
}

type ReviewBookRequest = ReviewFromManifestRequest | ReviewFromEntriesRequest

function isManifestRequest(body: ReviewBookRequest): body is ReviewFromManifestRequest {
  return 'manifestJson' in body
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const body: ReviewBookRequest = await request.json()

    let manifest: BookManifest

    if (isManifestRequest(body)) {
      // Direct manifest provided
      manifest = JSON.parse(body.manifestJson)

      // If contact sheet paths are provided, use LLM review
      if (body.contactSheetPaths && body.contactSheetPaths.length > 0) {
        const review = await reviewBook(manifest, body.contactSheetPaths, {
          verbose: true,
        })
        return NextResponse.json(review)
      }

      // No contact sheets — use heuristic review
      const review = reviewBookHeuristic(manifest)
      return NextResponse.json(review)
    } else {
      // Build manifest from book entries
      const entries: BookEntry[] = JSON.parse(body.bookEntriesJson)
      const activities: StravaActivity[] = body.activitiesJson
        ? JSON.parse(body.activitiesJson)
        : []

      manifest = buildManifest(entries, activities)

      // Heuristic review (no contact sheets available via this path)
      const review = reviewBookHeuristic(manifest)
      return NextResponse.json(review)
    }
  } catch (error) {
    console.error('[Review Book API] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Review failed: ${message}` },
      { status: 500 }
    )
  }
}
