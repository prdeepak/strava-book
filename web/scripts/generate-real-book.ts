/**
 * Generate a book using real cached Strava data
 *
 * Usage (from web/ directory): npx tsx scripts/generate-real-book.ts [--label=NAME]
 */

import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { renderToBuffer } from '@react-pdf/renderer'

// Load .env.local so NEXT_PUBLIC_MAPBOX_TOKEN is available
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Register fonts first
import '@/lib/pdf-fonts'

import { BookDocument, computeYearSummary, getCategoryForType } from '@/components/templates/BookDocument'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'
import { generateBookEntries, findCoverPhotosFromActivities } from '@/lib/book-entry-generator'
import { renderAllEntriesAsPdfs, PageRenderContext } from '@/lib/pdf-page-renderer'
import { TOCEntry } from '@/components/templates/TableOfContents'

const CACHE_BASE = path.join(process.cwd(), '.cache', 'strava')
const ACTIVITIES_DIR = path.join(CACHE_BASE, 'activities')
const LISTS_DIR = path.join(CACHE_BASE, 'lists')

interface CachedActivityFile {
  activity?: StravaActivity
  photos?: Array<{ urls?: Record<string, string>; unique_id?: string; caption?: string }>
  comments?: Array<{ text?: string; firstname?: string; lastname?: string }>
  laps?: unknown[]
  activityFetchedAt?: string
  photosFetchedAt?: string
  commentsFetchedAt?: string
}

async function loadCachedActivities(): Promise<StravaActivity[]> {
  const listFiles = await fs.readdir(LISTS_DIR)
  if (listFiles.length === 0) throw new Error('No cached activity lists found')

  const listData = JSON.parse(await fs.readFile(path.join(LISTS_DIR, listFiles[0]), 'utf-8'))
  const summaryActivities: StravaActivity[] = listData.activities
  console.log(`Loaded ${summaryActivities.length} activities from list cache`)

  const detailFiles = await fs.readdir(ACTIVITIES_DIR)
  const detailMap = new Map<string, CachedActivityFile>()

  for (const file of detailFiles) {
    if (!file.endsWith('.json')) continue
    try {
      const data = JSON.parse(await fs.readFile(path.join(ACTIVITIES_DIR, file), 'utf-8'))
      const activityId = file.replace('.json', '')
      detailMap.set(activityId, data)
    } catch {
      // skip malformed files
    }
  }
  console.log(`Loaded ${detailMap.size} detailed activity caches`)

  const merged = summaryActivities.map(summary => {
    const detail = detailMap.get(String(summary.id))
    if (detail?.activity) {
      return {
        ...summary,
        ...detail.activity,
        comprehensiveData: {
          photos: detail.photos || [],
          comments: detail.comments || [],
          streams: undefined,
        },
      } as StravaActivity
    }
    return summary
  })

  return merged
}

async function main() {
  const args = process.argv.slice(2)
  const labelArg = args.find(a => a.startsWith('--label='))
  const label = labelArg ? labelArg.split('=')[1] : 'real-book'

  console.log('='.repeat(60))
  console.log(`Generating Real-Data Book: ${label}`)
  console.log('='.repeat(60))

  const startTime = Date.now()

  console.log('\n[1/5] Loading cached Strava data...')
  const allActivities = await loadCachedActivities()

  const startDate = '2024-07-01'
  const endDate = '2025-06-15'
  const filtered = allActivities.filter(a => {
    const d = a.start_date_local || a.start_date
    return d >= startDate && d <= endDate
  })
  console.log(`  Filtered to ${filtered.length} activities in ${startDate} to ${endDate}`)

  const races = filtered.filter(a => a.workout_type === 1)
  const nonRaces = filtered.filter(a => a.workout_type !== 1)
  console.log(`  Races: ${races.length}, Other: ${nonRaces.length}`)

  console.log('\n[2/5] Finding cover photos...')
  const photos = findCoverPhotosFromActivities(filtered)

  console.log('\n[3/5] Generating book entries...')
  const year = 2025
  const entries = generateBookEntries(
    { activities: nonRaces, races },
    {
      bookName: 'Comrades Back-to-Back',
      athleteName: 'Deepak Ramachandran',
      startDate,
      endDate,
      forewordText: 'A year of running — from the streets of Toronto to the hills of Durban. Two Comrades Marathons, back to back.',
      coverPhoto: photos.coverPhoto,
      backgroundPhoto: photos.backgroundPhoto,
      backCoverPhoto: photos.backCoverPhoto,
    }
  )
  console.log(`  Generated ${entries.length} book entries`)

  const typeCounts = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  console.log('  Entry types:', typeCounts)

  console.log('\n[4/5] Rendering page PDFs...')
  const yearSummary = computeYearSummary(filtered, year)
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

  const pageRenderContext: PageRenderContext = {
    activities: filtered,
    format: FORMATS['10x10'],
    theme: DEFAULT_THEME,
    athleteName: 'Deepak Ramachandran',
    periodName: 'Comrades Back-to-Back',
    year,
    startDate,
    endDate,
    yearSummary,
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    tocEntries,
  }

  const outputsDir = path.join(process.cwd(), 'outputs')
  await fs.mkdir(outputsDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const pagesDir = path.join(outputsDir, `${label}-${timestamp}-pages`)
  await fs.mkdir(pagesDir, { recursive: true })

  const renderedPages = await renderAllEntriesAsPdfs(entries, pageRenderContext, {
    onProgress: (current, total, entry) => {
      if (current % 10 === 0 || current === total - 1) {
        console.log(`  Rendering page ${current + 1}/${total}: ${entry.type}`)
      }
    },
  })

  for (const page of renderedPages) {
    const pageNum = String(page.entryIndex).padStart(3, '0')
    const filename = `page-${pageNum}-${page.entryType}.pdf`
    if (page.buffer) {
      await fs.writeFile(path.join(pagesDir, filename), page.buffer)
    }
  }

  console.log('\n[5/5] Rendering full book PDF...')
  const bookElement = BookDocument({
    entries,
    activities: filtered,
    format: FORMATS['10x10'],
    theme: DEFAULT_THEME,
    athleteName: 'Deepak Ramachandran',
    periodName: 'Comrades Back-to-Back',
    year,
    startDate,
    endDate,
    yearSummary,
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    printReady: true,
  })

  const pdfBuffer = await renderToBuffer(bookElement as any)
  const pdfPath = path.join(outputsDir, `${label}-${timestamp}.pdf`)
  await fs.writeFile(pdfPath, pdfBuffer)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone in ${elapsed}s`)
  console.log(`  PDF: ${pdfPath}`)
  console.log(`  Pages: ${pagesDir}/ (${renderedPages.length} pages)`)

  // Save manifest for reviewer
  const manifest = {
    label,
    timestamp,
    totalPages: entries.length,
    entries: entries.map(e => ({
      pageNumber: e.pageNumber,
      type: e.type,
      title: e.title,
      activityId: e.activityId,
    })),
    typeCounts,
  }
  await fs.writeFile(
    path.join(pagesDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
