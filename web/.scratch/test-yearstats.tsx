import React from 'react'
import { renderToFile, Document } from '@react-pdf/renderer'
import { YearStatsPage } from '@/components/templates/YearStats'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import '@/lib/pdf-fonts'

const yearSummary = {
  year: 2025,
  totalDistance: 2500000,
  totalTime: 360000,
  totalElevation: 25000,
  activityCount: 150,
  activeDays: new Set(['2025-01-01']),
  monthlyStats: Array.from({ length: 12 }, (_, i) => ({
    month: i,
    year: 2025,
    activityCount: 12,
    totalDistance: 200000,
    totalTime: 30000,
    totalElevation: 2000,
    activeDays: 10,
    activities: [],
  })),
  races: [],
}

const doc = (
  <Document>
    <YearStatsPage
      yearSummary={yearSummary}
      periodName="Test Book"
      startDate="2025-01-01"
      endDate="2025-12-31"
      format={FORMATS['10x10']}
      theme={DEFAULT_THEME}
    />
  </Document>
)

renderToFile(doc, '/app/web/.scratch/direct-yearstats.pdf').then(() => {
  console.log('Saved to .scratch/direct-yearstats.pdf')
})
