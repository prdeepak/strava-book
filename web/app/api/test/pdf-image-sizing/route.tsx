/**
 * Test endpoint for PdfImage sizing/aspect-fill behavior
 *
 * Renders a single image in a container to test aspect-fill calculations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, StyleSheet } from '@react-pdf/renderer'
import { PdfImage } from '@/components/pdf/PdfImage'
import '@/lib/pdf-fonts'
import path from 'path'
import fs from 'fs'

// Page dimensions (points)
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const containerWidth = parseInt(searchParams.get('containerWidth') || '300', 10)
  const containerHeight = parseInt(searchParams.get('containerHeight') || '200', 10)
  const imagePath = searchParams.get('imagePath') || '/fixtures/photos/kg0JdToiPHrVlA-zj-l7-wodK-NtwuWX2II2bAS9WKw-768x576.jpg'
  const sourceWidth = searchParams.get('sourceWidth') ? parseInt(searchParams.get('sourceWidth')!, 10) : undefined
  const sourceHeight = searchParams.get('sourceHeight') ? parseInt(searchParams.get('sourceHeight')!, 10) : undefined

  // Resolve the image path to absolute filesystem path
  const absoluteImagePath = path.join(process.cwd(), 'public', imagePath)

  // Verify file exists
  if (!fs.existsSync(absoluteImagePath)) {
    return NextResponse.json({ error: `Image not found: ${imagePath}` }, { status: 404 })
  }

  const styles = StyleSheet.create({
    page: {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      backgroundColor: '#f0f0f0',
      padding: 40,
    },
    containerWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: containerWidth,
      height: containerHeight,
      backgroundColor: '#e5e5e5',
      position: 'relative',
      overflow: 'hidden',
    },
  })

  try {
    const pdfBuffer = await renderToBuffer(
      <Document>
        <Page size={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }} style={styles.page}>
          <View style={styles.containerWrapper}>
            <View style={styles.container}>
              <PdfImage
                src={absoluteImagePath}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
                sourceWidth={sourceWidth}
                sourceHeight={sourceHeight}
              />
            </View>
          </View>
        </Page>
      </Document>
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="pdf-image-sizing-test.pdf"',
      },
    })
  } catch (error) {
    console.error('[PDF Image Sizing] Error:', error)
    return NextResponse.json(
      { error: 'Failed to render PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
