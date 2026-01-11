import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'

export interface ForewordProps {
  title?: string
  body: string
  author?: string
  format: BookFormat
  theme: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  title: {
    fontSize: Math.max(20, 24 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 30 * format.scaleFactor,
    textAlign: 'center',
  },
  bodyContainer: {
    maxWidth: '80%',
    alignSelf: 'center',
  },
  bodyText: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    lineHeight: 1.8,
    textAlign: 'justify',
    marginBottom: 20 * format.scaleFactor,
  },
  author: {
    fontSize: Math.max(10, 11 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 20 * format.scaleFactor,
  },
  decorativeLine: {
    width: 60 * format.scaleFactor,
    height: 2,
    backgroundColor: theme.accentColor,
    marginBottom: 30 * format.scaleFactor,
    alignSelf: 'center',
  },
})

// Page-only version for use in BookDocument (no Document wrapper)
export const ForewordPage = ({
  title,
  body,
  author,
  format,
  theme = DEFAULT_THEME,
}: ForewordProps) => {
  const styles = createStyles(format, theme)

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {title && (
          <>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.decorativeLine} />
          </>
        )}

        <View style={styles.bodyContainer}>
          <Text style={styles.bodyText}>{body}</Text>
          {author && <Text style={styles.author}>— {author}</Text>}
        </View>
      </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const Foreword = (props: ForewordProps) => (
  <Document>
    <ForewordPage {...props} />
  </Document>
)
