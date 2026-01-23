import React from 'react'
import { renderToFile, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import '@/lib/pdf-fonts'

// Simplified YearStats with array-format size (like Cover)
const format = FORMATS['10x10']
const theme = DEFAULT_THEME

const styles = StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    padding: format.safeMargin,
    backgroundColor: theme.backgroundColor,
  },
})

const doc = (
  <Document>
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <FullBleedBackground
        fallbackColor={theme.backgroundColor}
        width={format.dimensions.width}
        height={format.dimensions.height}
      />
      <Text>Test Content</Text>
    </Page>
  </Document>
)

renderToFile(doc, '/app/web/.scratch/test-simple.pdf').then(() => {
  console.log('Saved to .scratch/test-simple.pdf')
})
