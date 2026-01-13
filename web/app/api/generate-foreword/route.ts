/**
 * API Route: Generate Foreword
 *
 * POST /api/generate-foreword
 *
 * Uses Claude Sonnet 3.5 via AWS Bedrock to generate a personalized foreword
 * based on the athlete's activity descriptions and race comments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  generateForeword,
  generateMockForeword,
  ForewordGeneratorInput,
} from '@/lib/foreword-generator'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const { activities, athleteName, periodName, startDate, endDate, useMock } = body

    if (!activities || !Array.isArray(activities)) {
      return NextResponse.json(
        { error: 'activities array is required' },
        { status: 400 }
      )
    }

    if (!athleteName || typeof athleteName !== 'string') {
      return NextResponse.json(
        { error: 'athleteName is required' },
        { status: 400 }
      )
    }

    const input: ForewordGeneratorInput = {
      activities,
      athleteName,
      periodName: periodName || 'My Running Journey',
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
    }

    // Use mock if requested or if AWS credentials are not configured
    const shouldUseMock = useMock || !process.env.AWS_ACCESS_KEY_ID

    let result
    if (shouldUseMock) {
      console.log('[generate-foreword] Using mock foreword generator')
      result = generateMockForeword(input)
    } else {
      console.log('[generate-foreword] Generating foreword with Claude AI')
      result = await generateForeword(input)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[generate-foreword] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate foreword',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
