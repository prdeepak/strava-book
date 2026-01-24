import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer'
import { PdfImage } from '@/components/pdf/PdfImage'
import path from 'path'
import fs from 'fs'

// Register fonts (required for react-pdf)
import '@/lib/pdf-fonts'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f0f0f0',
    padding: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
    // Border to show container bounds
    borderWidth: 2,
    borderColor: '#ff0000',
    borderStyle: 'solid',
  },
})

interface TestDocumentProps {
  containerWidth: number
  containerHeight: number
  imageDataUrl: string
  sourceWidth: number
  sourceHeight: number
}

function TestDocument({
  containerWidth,
  containerHeight,
  imageDataUrl,
  sourceWidth,
  sourceHeight,
}: TestDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View
          style={[
            styles.container,
            {
              width: containerWidth,
              height: containerHeight,
            },
          ]}
        >
          <PdfImage
            src={imageDataUrl}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            sourceWidth={sourceWidth}
            sourceHeight={sourceHeight}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const containerWidth = Number(searchParams.get('containerWidth') || 300)
  const containerHeight = Number(searchParams.get('containerHeight') || 200)
  const imagePath = searchParams.get('imagePath') || '/fixtures/photos/kg0JdToiPHrVlA-zj-l7-wodK-NtwuWX2II2bAS9WKw-768x576.jpg'
  const sourceWidth = Number(searchParams.get('sourceWidth') || 768)
  const sourceHeight = Number(searchParams.get('sourceHeight') || 576)

  // Read the image file and convert to data URL
  const publicPath = path.join(process.cwd(), 'public', imagePath)

  let imageDataUrl: string

  try {
    // Follow symlink and read the actual file
    const realPath = fs.realpathSync(publicPath)
    const imageBuffer = fs.readFileSync(realPath)
    const base64 = imageBuffer.toString('base64')
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
    imageDataUrl = `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('Failed to read image:', error)
    return NextResponse.json({ error: 'Failed to read image' }, { status: 500 })
  }

  try {
    const pdfBuffer = await renderToBuffer(
      <TestDocument
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        imageDataUrl={imageDataUrl}
        sourceWidth={sourceWidth}
        sourceHeight={sourceHeight}
      />
    )

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="pdf-image-test.pdf"',
      },
    })
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
