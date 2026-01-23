import React from 'react'
import { renderToFile, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import '@/lib/pdf-fonts'

// Absolute minimal page
const format = FORMATS['10x10']
const theme = DEFAULT_THEME

const styles = StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
  },
})

const doc = (
  <Document>
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <Text>Test Content</Text>
    </Page>
  </Document>
)

renderToFile(doc, '/app/web/.scratch/test-minimal.pdf').then(() => {
  console.log('Saved')
})
