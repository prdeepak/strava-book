import React from 'react'
import { renderToFile, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { FORMATS, DEFAULT_THEME } from '@/lib/book-types'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'
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

const doc = (
  <Document>
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <View style={{ width: 500, height: 50 }}>
        <AutoResizingPdfText
          text="Test Title"
          width={500}
          height={50}
          font="Helvetica"
          min_fontsize={12}
          max_fontsize={40}
          h_align="center"
          v_align="middle"
          textColor="#333333"
        />
      </View>
      <Text>Test Content</Text>
    </Page>
  </Document>
)

renderToFile(doc, '/app/web/.scratch/test-auto-text.pdf').then(() => {
  console.log('Saved')
})
