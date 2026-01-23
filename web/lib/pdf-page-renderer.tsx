/**
 * PDF Page Renderer - Renders individual book entries as standalone PDFs
 *
 * Used for debugging and page-by-page generation when --pdfByPage is enabled.
 * Each entry is wrapped in its own Document container for independent rendering.
 */

import React, { ReactElement } from 'react'
import { Document, DocumentProps, renderToBuffer } from '@react-pdf/renderer'
import { BookEntry } from '@/lib/curator'
import { BookFormat, BookTheme, YearSummary } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'

// Import individual page components
import { CoverPage } from '@/components/templates/Cover'
import { ForewordPage } from '@/components/templates/Foreword'
import { TableOfContentsPage, TOCEntry, getTocPageCount } from '@/components/templates/TableOfContents'
import { YearStatsPage } from '@/components/templates/YearStats'
import { YearCalendarPage } from '@/components/templates/YearCalendar'
import { RaceSectionPages } from '@/components/templates/RaceSection'
import { MonthlyDividerSpreadPages } from '@/components/templates/MonthlyDividerSpread'
import { ActivityLog } from '@/components/templates/ActivityLog'
import { BackCoverPage } from '@/components/templates/BackCover'
import { calculateActivitiesPerPage } from '@/lib/activity-utils'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export interface PageRenderContext {
  activities: StravaActivity[]
  format: BookFormat
  theme: BookTheme
  athleteName: string
  periodName: string
  year: number
  startDate?: string
  endDate?: string
  yearSummary: YearSummary
  mapboxToken?: string
  tocEntries?: TOCEntry[]
}

export interface RenderedPage {
  filename: string
  buffer: Buffer
  entryType: string
  entryIndex: number
}

/**
 * Get a descriptive filename for an entry
 */
function getEntryFilename(entry: BookEntry, index: number, activities: StravaActivity[]): string {
  const paddedIndex = String(index).padStart(3, '0')

  switch (entry.type) {
    case 'COVER':
      return `${paddedIndex}-Cover`
    case 'FOREWORD':
      return `${paddedIndex}-Foreword`
    case 'TABLE_OF_CONTENTS':
      return `${paddedIndex}-TableOfContents`
    case 'YEAR_STATS':
      return `${paddedIndex}-YearStats`
    case 'YEAR_AT_A_GLANCE':
      return `${paddedIndex}-YearCalendar`
    case 'RACE_PAGE': {
      const activity = activities.find(a => a.id === entry.activityId)
      const activityName = activity?.name?.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30) || entry.activityId
      return `${paddedIndex}-RacePage-${activityName}`
    }
    case 'MONTHLY_DIVIDER': {
      const monthName = entry.month !== undefined ? MONTH_NAMES[entry.month] : 'Unknown'
      return `${paddedIndex}-MonthlyDivider-${monthName}-${entry.year}`
    }
    case 'ACTIVITY_LOG': {
      return `${paddedIndex}-ActivityLog-page${entry.pageNumber || index}`
    }
    case 'BACK_COVER':
      return `${paddedIndex}-BackCover`
    default:
      return `${paddedIndex}-${entry.type}`
  }
}

/**
 * Render a single entry as a standalone PDF
 */
export async function renderEntryAsPdf(
  entry: BookEntry,
  index: number,
  context: PageRenderContext
): Promise<RenderedPage | null> {
  const { activities, format, theme, athleteName, periodName, year, startDate, endDate, yearSummary, mapboxToken, tocEntries } = context

  let pageElement: ReactElement<DocumentProps> | null = null

  try {
    switch (entry.type) {
      case 'COVER':
        pageElement = (
          <Document>
            <CoverPage
              title={entry.title || 'My Year in Review'}
              periodName={periodName}
              startDate={startDate}
              endDate={endDate}
              athleteName={athleteName}
              backgroundImage={entry.heroImage}
              format={format}
              theme={theme}
            />
          </Document>
        )
        break

      case 'FOREWORD':
        pageElement = (
          <Document>
            <ForewordPage
              title={entry.title || 'Foreword'}
              body={entry.forewordText}
              backgroundPhotoUrl={entry.backgroundPhotoUrl}
              format={format}
              theme={theme}
            />
          </Document>
        )
        break

      case 'TABLE_OF_CONTENTS':
        if (tocEntries) {
          const tocPageCount = getTocPageCount(tocEntries)
          pageElement = (
            <Document>
              {Array.from({ length: tocPageCount }).map((_, pageIdx) => (
                <TableOfContentsPage
                  key={pageIdx}
                  entries={tocEntries}
                  format={format}
                  theme={theme}
                  backgroundPhotoUrl={entry.backgroundPhotoUrl}
                  pageIndex={pageIdx}
                  totalPages={tocPageCount}
                />
              ))}
            </Document>
          )
        }
        break

      case 'YEAR_STATS':
        pageElement = (
          <Document>
            <YearStatsPage
              yearSummary={yearSummary}
              periodName={periodName}
              startDate={startDate}
              endDate={endDate}
              format={format}
              theme={theme}
              backgroundPhotoUrl={entry.backgroundPhotoUrl}
            />
          </Document>
        )
        break

      case 'YEAR_AT_A_GLANCE':
        pageElement = (
          <Document>
            <YearCalendarPage
              year={entry.year ?? year}
              activities={activities}
              colorBy="distance"
              format={format}
              theme={theme}
              startDate={startDate}
              endDate={endDate}
              backgroundPhotoUrl={entry.backgroundPhotoUrl}
            />
          </Document>
        )
        break

      case 'RACE_PAGE': {
        if (!entry.activityId) {
          console.log(`[PageRenderer] Skipping RACE_PAGE ${index}: no activityId`)
          return null
        }
        const activity = activities.find(a => a.id === entry.activityId)
        if (!activity) {
          console.log(`[PageRenderer] Skipping RACE_PAGE ${index}: activity ${entry.activityId} not found`)
          return null
        }
        pageElement = (
          <Document>
            <RaceSectionPages
              activity={activity}
              format={format}
              theme={theme}
              mapboxToken={mapboxToken}
              highlightLabel={entry.highlightLabel}
            />
          </Document>
        )
        break
      }

      case 'MONTHLY_DIVIDER': {
        const monthActivities = activities.filter(a => {
          const activityDate = new Date(a.start_date_local || a.start_date)
          const activityMonth = activityDate.getMonth()
          const activityYear = activityDate.getFullYear()
          return activityMonth === entry.month && activityYear === entry.year
        })
        pageElement = (
          <Document>
            <MonthlyDividerSpreadPages
              activities={monthActivities}
              month={entry.month!}
              year={entry.year!}
              format={format}
              theme={theme}
            />
          </Document>
        )
        break
      }

      case 'ACTIVITY_LOG': {
        const perPage = calculateActivitiesPerPage(format)
        const pageActivities = entry.activityIds
          ? activities.filter(a => entry.activityIds?.includes(a.id))
          : activities.slice(
              ((entry.pageNumber || 1) - 1) * perPage,
              (entry.pageNumber || 1) * perPage
            )
        pageElement = (
          <Document>
            <ActivityLog
              activities={pageActivities}
              startIndex={0}
              activitiesPerPage={perPage}
              format={format}
              theme={theme}
            />
          </Document>
        )
        break
      }

      case 'BACK_COVER':
        pageElement = (
          <Document>
            <BackCoverPage
              yearSummary={yearSummary}
              periodName={periodName}
              startDate={startDate}
              endDate={endDate}
              backgroundPhotoUrl={entry.backgroundPhotoUrl}
              format={format}
              theme={theme}
            />
          </Document>
        )
        break

      default:
        console.log(`[PageRenderer] Unknown entry type: ${entry.type}`)
        return null
    }

    if (!pageElement) {
      return null
    }

    console.log(`[PageRenderer] Rendering ${entry.type} (entry ${index})...`)
    const buffer = await renderToBuffer(pageElement)

    return {
      filename: getEntryFilename(entry, index, activities),
      buffer: Buffer.from(buffer),
      entryType: entry.type,
      entryIndex: index,
    }
  } catch (error) {
    console.error(`[PageRenderer] Error rendering ${entry.type} (entry ${index}):`, error)
    return null
  }
}

/**
 * Render all entries as individual PDFs
 */
export async function renderAllEntriesAsPdfs(
  entries: BookEntry[],
  context: PageRenderContext,
  options?: {
    /** Only render entries of these types */
    filterTypes?: BookEntry['type'][]
    /** Only render entries at these indices */
    filterIndices?: number[]
    /** Callback for progress updates */
    onProgress?: (current: number, total: number, entry: BookEntry) => void
  }
): Promise<RenderedPage[]> {
  const results: RenderedPage[] = []
  const { filterTypes, filterIndices, onProgress } = options || {}

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    // Apply filters
    if (filterTypes && !filterTypes.includes(entry.type)) {
      continue
    }
    if (filterIndices && !filterIndices.includes(i)) {
      continue
    }

    onProgress?.(i, entries.length, entry)

    const rendered = await renderEntryAsPdf(entry, i, context)
    if (rendered) {
      results.push(rendered)
    }
  }

  return results
}
