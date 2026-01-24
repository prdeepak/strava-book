#!/usr/bin/env npx tsx
/**
 * Generate a book from cached Strava data
 *
 * Usage:
 *   npx tsx lib/testing/generate-book-from-cache.ts                          # Default: 2025 calendar year
 *   npx tsx lib/testing/generate-book-from-cache.ts --start=2024-07-01 --end=2025-06-30
 *   npx tsx lib/testing/generate-book-from-cache.ts --title="My Running Year"
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { promises as fs } from 'fs'
import path from 'path'
import { BookDocument, computeYearSummary, getCategoryForType } from '@/components/templates/BookDocument'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { BookEntry } from '@/lib/curator'
import { StravaActivity } from '@/lib/strava'
import { TOCEntry } from '@/components/templates/TableOfContents'
import { generateBookEntries, findCoverPhotosFromActivities } from '@/lib/book-entry-generator'

// Register fonts
import '@/lib/pdf-fonts'

// ============================================================================
// Configuration
// ============================================================================

interface GenerateOptions {
  startDate: string
  endDate: string
  title: string
  athleteName: string
  foreword: string
  maxRaces?: number
  maxMonths?: number
}

function parseArgs(): GenerateOptions {
  const args = process.argv.slice(2)

  // Defaults: 2025 calendar year
  const defaults: GenerateOptions = {
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    title: 'My Running Year 2025',
    athleteName: 'Athlete',
    foreword: 'This book captures a year of running adventures, from daily training runs to race day triumphs. Each page tells a story of dedication, perseverance, and the joy of putting one foot in front of the other.',
    maxRaces: 10,
    maxMonths: 12,
  }

  for (const arg of args) {
    if (arg.startsWith('--start=')) {
      defaults.startDate = arg.split('=')[1]
    } else if (arg.startsWith('--end=')) {
      defaults.endDate = arg.split('=')[1]
    } else if (arg.startsWith('--title=')) {
      defaults.title = arg.split('=')[1]
    } else if (arg.startsWith('--athlete=')) {
      defaults.athleteName = arg.split('=')[1]
    } else if (arg.startsWith('--foreword=')) {
      defaults.foreword = arg.split('=')[1]
    } else if (arg.startsWith('--maxRaces=')) {
      defaults.maxRaces = parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--maxMonths=')) {
      defaults.maxMonths = parseInt(arg.split('=')[1], 10)
    }
  }

  return defaults
}

// ============================================================================
// Cache Loading
// ============================================================================

async function loadActivitiesFromCache(cacheDir: string): Promise<StravaActivity[]> {
  const activitiesDir = path.join(cacheDir, 'strava', 'activities')

  try {
    const files = await fs.readdir(activitiesDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    console.log(`  Found ${jsonFiles.length} cached activities`)

    const activities: StravaActivity[] = []

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(activitiesDir, file), 'utf-8')
        const data = JSON.parse(content)
        // The cache format wraps the activity in an object with activityId and activity properties
        const activity = data.activity || data

        // Merge photos into the activity if they exist separately
        if (data.photos) {
          activity.photos = data.photos
        }

        activities.push(activity)
      } catch (e) {
        console.warn(`  Warning: Could not parse ${file}`)
      }
    }

    return activities
  } catch (e) {
    console.error(`Error reading cache directory: ${activitiesDir}`)
    throw e
  }
}

function filterActivitiesByDateRange(
  activities: StravaActivity[],
  startDate: string,
  endDate: string
): StravaActivity[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999) // Include the entire end day

  return activities.filter(a => {
    const activityDate = new Date(a.start_date_local || a.start_date)
    return activityDate >= start && activityDate <= end
  })
}

// ============================================================================
// Helpers
// ============================================================================

async function ensureOutputsDir(): Promise<string> {
  const outputsDir = process.env.WORKSPACE_ID
    ? '/app/outputs'
    : path.join(process.cwd(), 'outputs')
  await fs.mkdir(outputsDir, { recursive: true })
  return outputsDir
}

async function extractPdfPages(pdfPath: string, outputDir: string): Promise<number> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  await fs.mkdir(outputDir, { recursive: true })

  // Use pdftoppm to extract pages as PNG images
  const outputPattern = path.join(outputDir, 'page')

  try {
    await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPattern}"`)

    // Count extracted pages
    const files = await fs.readdir(outputDir)
    const pageCount = files.filter(f => f.startsWith('page-') && f.endsWith('.png')).length
    return pageCount
  } catch (e) {
    console.error('Error extracting PDF pages (is pdftoppm/poppler installed?)')
    throw e
  }
}

// ============================================================================
// Main
// ============================================================================

async function generateBookFromCache(): Promise<void> {
  const options = parseArgs()

  console.log('='.repeat(60))
  console.log('Generate Book from Cache')
  console.log('='.repeat(60))
  console.log(`Date range: ${options.startDate} to ${options.endDate}`)
  console.log(`Title: ${options.title}`)

  const startTime = Date.now()

  // 1. Find cache directory
  const cacheDir = process.env.WORKSPACE_ID
    ? '/app/web/.cache'
    : path.join(process.cwd(), '.cache')

  console.log(`\n[1/6] Loading activities from cache...`)
  console.log(`  Cache directory: ${cacheDir}`)

  const allCachedActivities = await loadActivitiesFromCache(cacheDir)

  // 2. Filter by date range
  console.log(`\n[2/6] Filtering by date range...`)
  const activities = filterActivitiesByDateRange(allCachedActivities, options.startDate, options.endDate)
  console.log(`  Filtered to ${activities.length} activities in range`)

  if (activities.length === 0) {
    console.error('No activities found in the specified date range!')
    console.log('Available date range in cache:')
    const dates = allCachedActivities.map(a => new Date(a.start_date_local || a.start_date))
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    console.log(`  ${minDate.toISOString().slice(0, 10)} to ${maxDate.toISOString().slice(0, 10)}`)
    process.exit(1)
  }

  // Separate races from other activities
  const races = activities.filter(a => a.workout_type === 1)
  const nonRaces = activities.filter(a => a.workout_type !== 1)
  console.log(`  Races: ${races.length}, Other activities: ${nonRaces.length}`)

  // 3. Find photos
  console.log(`\n[3/6] Finding photos for covers...`)
  const photos = findCoverPhotosFromActivities(activities)
  console.log(`  Cover photo: ${photos.coverPhotoUrl ? 'Found' : 'None'}`)
  console.log(`  Background photo: ${photos.backgroundPhotoUrl ? 'Found' : 'None'}`)
  console.log(`  Back cover photo: ${photos.backCoverPhotoUrl ? 'Found' : 'None'}`)

  // 4. Generate book entries
  console.log(`\n[4/6] Generating book entries...`)
  const year = new Date(options.endDate).getFullYear()

  const entries = generateBookEntries(
    { activities: nonRaces, races },
    {
      bookName: options.title,
      athleteName: options.athleteName,
      startDate: options.startDate,
      endDate: options.endDate,
      forewordText: options.foreword,
      coverPhotoUrl: photos.coverPhotoUrl,
      backgroundPhotoUrl: photos.backgroundPhotoUrl,
      backCoverPhotoUrl: photos.backCoverPhotoUrl,
      maxRaces: options.maxRaces,
      maxMonths: options.maxMonths,
    }
  )
  console.log(`  Generated ${entries.length} book entries`)

  // Log entry types
  const typeCounts = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  console.log(`  Entry types: ${JSON.stringify(typeCounts)}`)

  // 5. Render PDF
  console.log(`\n[5/6] Rendering PDF...`)
  const format = FORMATS['10x10']
  const theme = DEFAULT_THEME
  const yearSummary = computeYearSummary(activities, year)

  // Build TOC entries
  const tocEntries: TOCEntry[] = entries
    .filter(entry =>
      entry.type !== 'COVER' &&
      entry.type !== 'TABLE_OF_CONTENTS' &&
      entry.type !== 'ACTIVITY_LOG' &&
      entry.type !== 'BLANK_PAGE' &&
      entry.type !== 'BACK_COVER'
    )
    .map(entry => ({
      title: entry.title || entry.type,
      pageNumber: entry.pageNumber || 0,
      type: entry.type,
      category: getCategoryForType(entry.type),
    }))

  const renderStart = Date.now()
  const pdfBuffer = await renderToBuffer(
    <BookDocument
      entries={entries}
      format={format}
      theme={theme}
      activities={activities}
      yearSummary={yearSummary}
      startDate={options.startDate}
      endDate={options.endDate}
    />
  )
  console.log(`  PDF rendered in ${Date.now() - renderStart}ms`)
  console.log(`  PDF size: ${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`)

  // 6. Save outputs
  console.log(`\n[6/6] Saving outputs...`)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeName = options.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  const pdfFilename = `${safeName}-${timestamp}.pdf`
  const pagesFolder = `${safeName}-${timestamp}-pages`

  const outputsDir = await ensureOutputsDir()
  const pdfPath = path.join(outputsDir, pdfFilename)
  const pagesDir = path.join(outputsDir, pagesFolder)

  await fs.writeFile(pdfPath, pdfBuffer)
  console.log(`  PDF saved: ${pdfFilename}`)

  // Extract pages
  console.log(`  Extracting pages...`)
  const pageCount = await extractPdfPages(pdfPath, pagesDir)
  console.log(`  Extracted ${pageCount} page images`)

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Book Generation Complete`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Total time: ${totalTime}s`)
  console.log(`\nOutputs saved to: ${outputsDir}`)
  console.log(`  - PDF: ${pdfFilename}`)
  console.log(`  - Pages: ${pagesFolder}/`)
}

// Run
generateBookFromCache().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
