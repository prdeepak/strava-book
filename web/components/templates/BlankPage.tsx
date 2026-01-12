import { Page, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'

export interface BlankPageProps {
  format?: BookFormat
  theme?: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: 0,
  },
  content: {
    flex: 1,
  },
})

/**
 * BlankPage - An intentionally blank page for print-ready spreads.
 *
 * Used to ensure proper left/right page alignment in printed books.
 * Key sections (monthly dividers, race pages) should start on right-hand
 * pages (odd-numbered), so blank pages are inserted when needed.
 */
export const BlankPageComponent = ({
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: BlankPageProps) => {
  const styles = createStyles(format, theme)

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <View style={styles.content} />
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const BlankPage = (props: BlankPageProps) => (
  <Document>
    <BlankPageComponent {...props} />
  </Document>
)
