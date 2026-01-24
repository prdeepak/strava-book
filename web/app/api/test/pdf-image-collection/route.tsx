/**
 * Test endpoint for PdfImageCollection layout behavior
 *
 * Renders multiple images in a container to test layout algorithms.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { PdfImageCollection, CollectionPhoto } from '@/components/pdf/PdfImageCollection'
import '@/lib/pdf-fonts'
import path from 'path'

// Page dimensions (points)
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792

// Available fixture photos
function getFixturePhotos(): CollectionPhoto[] {
  return [
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/kg0JdToiPHrVlA-zj-l7-wodK-NtwuWX2II2bAS9WKw-768x576.jpg'),
      width: 768,
      height: 576,
    },
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/S-ACdwp9_oZFE3eQw4RmwnZp_SASOvNgRAqelVZF9nA-576x768.jpg'),
      width: 576,
      height: 768,
    },
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/ihlXEIUXq2_yAZ-WxIPdUNVtlVY7pXVyltagSzlldCU-768x576.jpg'),
      width: 768,
      height: 576,
    },
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/bIFOxDiA9g0nD45Ehhcr4xs8_JSO6xdeSEhaZLoujzY-576x768.jpg'),
      width: 576,
      height: 768,
    },
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/onC_jOkSVGvnxNfZpsNrjkrzO25b5gAY6uaQY2uV7UQ-576x768.jpg'),
      width: 576,
      height: 768,
    },
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/SgavsCEdms63bIZwetCJoCgX2T1r4yFBQG8mfP2Di7M-576x768.jpg'),
      width: 576,
      height: 768,
    },
    {
      url: path.join(process.cwd(), 'public/fixtures/photos/_kdKb6gRwo3vf0SL51r4eRwkuI06aJUBfDNF6epJDBk-768x576.jpg'),
      width: 768,
      height: 576,
    },
  ]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const containerWidth = parseInt(searchParams.get('containerWidth') || '400', 10)
  const containerHeight = parseInt(searchParams.get('containerHeight') || '300', 10)
  const photoCount = parseInt(searchParams.get('photoCount') || '4', 10)
  const gap = parseInt(searchParams.get('gap') || '4', 10)

  const photos = getFixturePhotos().slice(0, photoCount)
  const orientation = containerWidth / containerHeight > 1.2 ? 'Wide' : containerWidth / containerHeight < 0.83 ? 'Tall' : 'Square'

  const styles = StyleSheet.create({
    page: {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      backgroundColor: '#f5f5f5',
      padding: 40,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 10,
      color: '#666',
    },
    containerWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: containerWidth,
      height: containerHeight,
      backgroundColor: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#ddd',
    },
  })

  try {
    const pdfBuffer = await renderToBuffer(
      <Document>
        <Page size={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }} style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{photoCount} Photo{photoCount !== 1 ? 's' : ''} - {orientation} Container</Text>
            <Text style={styles.subtitle}>Container: {containerWidth}×{containerHeight}pt | Gap: {gap}pt</Text>
          </View>
          <View style={styles.containerWrapper}>
            <View style={styles.container}>
              <PdfImageCollection
                photos={photos}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
                gap={gap}
              />
            </View>
          </View>
        </Page>
      </Document>
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="pdf-image-collection-test.pdf"',
      },
    })
  } catch (error) {
    console.error('[PDF Image Collection] Error:', error)
    return NextResponse.json(
      { error: 'Failed to render PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
