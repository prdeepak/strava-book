import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'

export interface ForewordProps {
  title?: string
  body?: string
  author?: string
  format?: BookFormat
  theme?: BookTheme
  // For test harness compatibility - derive props from activity
  activity?: {
    name?: string
    description?: string
    athlete?: { firstname?: string; lastname?: string }
  }
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: 0,
    position: 'relative',
  },
  // Top decorative accent
  topAccent: {
    position: 'absolute',
    top: format.safeMargin,
    left: '50%',
    width: 80 * format.scaleFactor,
    height: 3 * format.scaleFactor,
    backgroundColor: theme.accentColor,
    transform: 'translateX(-50%)',
  },
  // Bottom decorative accent
  bottomAccent: {
    position: 'absolute',
    bottom: format.safeMargin,
    left: '50%',
    width: 80 * format.scaleFactor,
    height: 3 * format.scaleFactor,
    backgroundColor: theme.accentColor,
    transform: 'translateX(-50%)',
  },
  // Content wrapper for true vertical centering
  contentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: format.safeMargin * 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Math.max(24, 28 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 24 * format.scaleFactor,
    textAlign: 'center',
  },
  decorativeLine: {
    width: 100 * format.scaleFactor,
    height: 2,
    backgroundColor: theme.accentColor,
    marginBottom: 40 * format.scaleFactor,
  },
  bodyContainer: {
    maxWidth: '75%',
  },
  bodyText: {
    fontSize: Math.max(12, 14 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    lineHeight: 1.9,
    textAlign: 'center',
    marginBottom: 8 * format.scaleFactor,
  },
  author: {
    fontSize: Math.max(11, 13 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.accentColor,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 32 * format.scaleFactor,
  },
  // Decorative quote marks
  quoteMarkTop: {
    fontSize: 72 * format.scaleFactor,
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    opacity: 0.15,
    marginBottom: -20 * format.scaleFactor,
    textAlign: 'center',
  },
})

// Page-only version for use in BookDocument (no Document wrapper)
export const ForewordPage = ({
  title: propTitle,
  body: propBody,
  author: propAuthor,
  format: propFormat,
  theme = DEFAULT_THEME,
  activity,
}: ForewordProps) => {
  // Handle test harness case: derive props from activity if provided
  const format = propFormat || FORMATS['10x10']

  let title = propTitle
  let body = propBody
  let author = propAuthor

  if (activity && !propBody) {
    // Derive from activity for testing
    title = 'Foreword'

    // Use activity description as body, or generate default
    body = activity.description ||
      `This book captures a year of running adventures, from the early morning miles to the finish line celebrations. Each step tells a story of dedication, perseverance, and the joy of movement. May these pages inspire you to chase your own running dreams.`

    // Get athlete name from activity
    author = activity.athlete
      ? `${activity.athlete.firstname || ''} ${activity.athlete.lastname || ''}`.trim()
      : undefined
  }

  // Set default values if still missing
  if (!body) {
    body = `This book captures a year of running adventures, from the early morning miles to the finish line celebrations. Each step tells a story of dedication, perseverance, and the joy of movement. May these pages inspire you to chase your own running dreams.`
  }

  const styles = createStyles(format, theme)

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Top decorative accent */}
      <View style={styles.topAccent} />

      {/* Bottom decorative accent */}
      <View style={styles.bottomAccent} />

      {/* Centered content */}
      <View style={styles.contentWrapper}>
        {/* Decorative opening quote mark */}
        <Text style={styles.quoteMarkTop}>&ldquo;</Text>

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
