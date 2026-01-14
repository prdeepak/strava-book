#!/usr/bin/env npx tsx
/**
 * Generate all YearStats and YearCalendar templates with fixture data
 * into a single large PDF for review.
 *
 * Usage: npx tsx scripts/generate-year-templates-pdf.tsx
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { PDFDocument } from 'pdf-lib'

// Import templates
import { YearStats } from '../components/templates/YearStats'
import { YearCalendar } from '../components/templates/YearCalendar'

// Import types
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME, YearSummary } from '../lib/book-types'

// Load fixture data
const fixturesDir = join(__dirname, '../lib/testing/fixtures')
const yearStatsFixture = JSON.parse(readFileSync(join(fixturesDir, 'year_stats.json'), 'utf-8'))
const yearCalendarFixture = JSON.parse(readFileSync(join(fixturesDir, 'year_calendar.json'), 'utf-8'))

// Define themes for variation
const themes: Record<string, BookTheme> = {
  default: DEFAULT_THEME,
  dark: {
    primaryColor: '#ffffff',
    accentColor: '#00d4ff',
    backgroundColor: '#1a1a2e',
    fontPairing: {
      heading: 'Helvetica-Bold',
      body: 'Helvetica',
    },
    backgroundStyle: 'solid',
  },
  boston: {
    primaryColor: '#0D2240',
    accentColor: '#FFD200',
    backgroundColor: '#ffffff',
    fontPairing: {
      heading: 'Helvetica-Bold',
      body: 'Helvetica',
    },
    backgroundStyle: 'solid',
  },
  nature: {
    primaryColor: '#2d5a3d',
    accentColor: '#8bc34a',
    backgroundColor: '#f5f5dc',
    fontPairing: {
      heading: 'Helvetica-Bold',
      body: 'Helvetica',
    },
    backgroundStyle: 'solid',
  },
  minimal: {
    primaryColor: '#333333',
    accentColor: '#ff4757',
    backgroundColor: '#fafafa',
    fontPairing: {
      heading: 'Helvetica-Bold',
      body: 'Helvetica',
    },
    backgroundStyle: 'solid',
  },
}

// Title page styles
const titleStyles = StyleSheet.create({
  page: {
    padding: 45,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    fontFamily: 'Helvetica',
    marginBottom: 48,
    textAlign: 'center',
  },
  info: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'Helvetica',
    marginBottom: 8,
    textAlign: 'center',
  },
})

// Section title page styles
const sectionStyles = StyleSheet.create({
  page: {
    padding: 45,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'Helvetica',
    textAlign: 'center',
  },
})

// Helper to create title page
const TitlePage = ({ format }: { format: BookFormat }) => (
  <Document>
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={titleStyles.page}>
      <Text style={titleStyles.title}>Year Templates Catalog</Text>
      <Text style={titleStyles.subtitle}>YearStats & YearCalendar Templates</Text>
      <Text style={titleStyles.info}>Generated with fixture data</Text>
      <Text style={titleStyles.info}>All formats: 8x8, 10x10, 12x12</Text>
      <Text style={titleStyles.info}>All themes: default, dark, boston, nature, minimal</Text>
      <Text style={titleStyles.info}>YearCalendar colorBy: distance, time, elevation, count</Text>
    </Page>
  </Document>
)

// Helper to create section page
const SectionPage = ({ title, subtitle, format }: { title: string; subtitle: string; format: BookFormat }) => (
  <Document>
    <Page size={{ width: format.dimensions.width, height: format.dimensions.height }} style={sectionStyles.page}>
      <Text style={sectionStyles.title}>{title}</Text>
      <Text style={sectionStyles.subtitle}>{subtitle}</Text>
    </Page>
  </Document>
)

// Convert yearSummary from fixture (activeDays is number, not Set)
const convertYearSummary = (fixture: typeof yearStatsFixture): YearSummary => {
  const summary = fixture.yearSummary
  return {
    ...summary,
    activeDays: typeof summary.activeDays === 'number'
      ? new Set<string>() // Placeholder - actual set not needed for display
      : summary.activeDays,
  }
}

async function generatePDF() {
  console.log('Starting PDF generation...')

  const outputDir = join(__dirname, '../test-output')
  mkdirSync(outputDir, { recursive: true })

  const pdfBuffers: Buffer[] = []
  const baseFormat = FORMATS['10x10']

  // 1. Title page
  console.log('Generating title page...')
  const titleBuffer = await renderToBuffer(TitlePage({ format: baseFormat }))
  pdfBuffers.push(Buffer.from(titleBuffer))

  // 2. YearStats section
  console.log('Generating YearStats templates...')

  // Section divider for YearStats
  const yearStatsSectionBuffer = await renderToBuffer(
    SectionPage({
      title: 'YearStats Template',
      subtitle: 'Annual summary with total distance, time, elevation, and activity breakdown',
      format: baseFormat,
    })
  )
  pdfBuffers.push(Buffer.from(yearStatsSectionBuffer))

  // Generate YearStats for each format and theme combination
  const formats = Object.values(FORMATS)
  const themeEntries = Object.entries(themes)

  for (const format of formats) {
    for (const [themeName, theme] of themeEntries) {
      console.log(`  YearStats: ${format.size} / ${themeName}`)

      // Label page
      const labelBuffer = await renderToBuffer(
        SectionPage({
          title: `YearStats`,
          subtitle: `Format: ${format.size} | Theme: ${themeName}`,
          format,
        })
      )
      pdfBuffers.push(Buffer.from(labelBuffer))

      // Actual template
      const templateBuffer = await renderToBuffer(
        YearStats({
          yearSummary: convertYearSummary(yearStatsFixture),
          format,
          theme,
        })
      )
      pdfBuffers.push(Buffer.from(templateBuffer))
    }
  }

  // 3. YearCalendar section
  console.log('Generating YearCalendar templates...')

  // Section divider for YearCalendar
  const yearCalendarSectionBuffer = await renderToBuffer(
    SectionPage({
      title: 'YearCalendar Template',
      subtitle: 'GitHub-style activity heatmap showing training consistency',
      format: baseFormat,
    })
  )
  pdfBuffers.push(Buffer.from(yearCalendarSectionBuffer))

  const colorByOptions: Array<'distance' | 'time' | 'count' | 'elevation'> = ['distance', 'time', 'count', 'elevation']

  for (const format of formats) {
    for (const [themeName, theme] of themeEntries) {
      for (const colorBy of colorByOptions) {
        console.log(`  YearCalendar: ${format.size} / ${themeName} / ${colorBy}`)

        // Label page
        const labelBuffer = await renderToBuffer(
          SectionPage({
            title: `YearCalendar`,
            subtitle: `Format: ${format.size} | Theme: ${themeName} | Color by: ${colorBy}`,
            format,
          })
        )
        pdfBuffers.push(Buffer.from(labelBuffer))

        // Actual template
        const templateBuffer = await renderToBuffer(
          YearCalendar({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activity: yearCalendarFixture as any,
            colorBy,
            format,
            theme,
          })
        )
        pdfBuffers.push(Buffer.from(templateBuffer))
      }
    }
  }

  // Merge all PDFs
  console.log('Merging PDFs...')
  const mergedPdf = await PDFDocument.create()

  for (const buffer of pdfBuffers) {
    const pdf = await PDFDocument.load(buffer)
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    pages.forEach(page => mergedPdf.addPage(page))
  }

  const mergedBuffer = await mergedPdf.save()
  const outputPath = join(outputDir, 'year-templates-all.pdf')
  writeFileSync(outputPath, mergedBuffer)

  console.log(`\nPDF generated: ${outputPath}`)
  console.log(`Total pages: ${mergedPdf.getPageCount()}`)
}

generatePDF().catch(console.error)
