import React from 'react'
import { renderToFile, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { PageHeader } from '@/components/pdf/PageHeader'
import '@/lib/pdf-fonts'

const format = FORMATS['10x10']
const theme = DEFAULT_THEME

const styles = StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
    position: 'relative',
  },
})

// Test 1: Without showBorder
const doc1 = (
  <Document>
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <PageHeader
        title="Test Title"
        size="large"
        showBorder={false}
        format={format}
        theme={theme}
      />
      <Text>Test Content</Text>
    </Page>
  </Document>
)

// Test 2: With showBorder
const doc2 = (
  <Document>
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <PageHeader
        title="Test Title"
        size="large"
        showBorder={true}
        format={format}
        theme={theme}
      />
      <Text>Test Content</Text>
    </Page>
  </Document>
)

async function test() {
  await renderToFile(doc1, '/app/web/.scratch/test-no-border.pdf')
  console.log('Saved no-border')
  await renderToFile(doc2, '/app/web/.scratch/test-with-border.pdf')
  console.log('Saved with-border')
}
test()
