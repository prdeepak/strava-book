import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import { PageHeader, getPageHeaderHeight } from '@/components/pdf/PageHeader'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

export interface ForewordProps {
  title?: string
  body?: string
  author?: string
  backgroundPhotoUrl?: string
  format?: BookFormat
  theme?: BookTheme
  // For test harness compatibility - derive props from activity
  activity?: {
    name?: string
    description?: string
    athlete?: { firstname?: string; lastname?: string }
  }
}

// Maximum character limit for foreword text
export const FOREWORD_MAX_CHARS = 1200

// Page-only version for use in BookDocument (no Document wrapper)
export const ForewordPage = ({
  title: propTitle,
  body: propBody,
  author: propAuthor,
  backgroundPhotoUrl,
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

  // Resolve design tokens
  const bodyTypo = resolveTypography('body', theme, format)
  const captionTypo = resolveTypography('caption', theme, format)
  const displayTypo = resolveTypography('displayLarge', theme, format)
  const spacing = resolveSpacing(theme, format)
  const effects = resolveEffects(theme)

  // Calculate dimensions
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)
  const contentHeight = format.dimensions.height - (format.safeMargin * 2)
  const headerHeight = getPageHeaderHeight('large', format, theme, { showBorder: true })

  // Body area: content height minus header, quote mark, author, and spacing
  const quoteMarkHeight = displayTypo.fontSize * 0.8
  const authorHeight = author ? captionTypo.fontSize + spacing.md : 0
  const bodyAreaHeight = contentHeight - headerHeight - quoteMarkHeight - authorHeight - spacing.lg
  const bodyWidth = contentWidth - spacing.lg // Left padding for quote indent

  const styles = StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: 0,
      position: 'relative',
    },
    // Content container with safe margins
    contentContainer: {
      position: 'absolute',
      top: format.safeMargin,
      left: format.safeMargin,
      right: format.safeMargin,
      bottom: format.safeMargin,
      display: 'flex',
      flexDirection: 'column',
    },
    // Body content area
    bodyArea: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      paddingTop: spacing.md,
    },
    // Decorative opening quote mark
    quoteMarkContainer: {
      height: quoteMarkHeight,
      marginLeft: spacing.sm,
    },
    quoteMarkText: {
      fontSize: displayTypo.fontSize * 0.8,
      fontFamily: displayTypo.fontFamily,
      color: theme.accentColor,
      opacity: effects.textOverlayOpacity,
    },
    // Container for body text (with left indent)
    bodyTextContainer: {
      marginLeft: spacing.lg,
      height: bodyAreaHeight,
      width: bodyWidth,
    },
    // Author attribution
    authorContainer: {
      marginLeft: spacing.lg,
      marginTop: spacing.md,
    },
    authorText: {
      fontSize: captionTypo.fontSize,
      fontFamily: captionTypo.fontFamily,
      color: theme.accentColor,
      fontStyle: 'italic',
    },
  })

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Background: solid color or faded photo (no overlay needed - image already faded) */}
      <FullBleedBackground
        image={backgroundPhotoUrl}
        fallbackColor={theme.backgroundColor}
        role="background"
        imageOpacity={effects.backgroundImageOpacity * 0.3}
        overlayOpacity={0}
        width={format.dimensions.width}
        height={format.dimensions.height}
      />

      {/* Content container */}
      <View style={styles.contentContainer}>
        {/* Header - top left, consistent with ActivityLog */}
        <PageHeader
          title={title || 'Foreword'}
          size="large"
          alignment="left"
          showBorder={true}
          format={format}
          theme={theme}
        />

        {/* Body content area */}
        <View style={styles.bodyArea}>
          {/* Decorative opening quote mark */}
          <View style={styles.quoteMarkContainer}>
            <Text style={styles.quoteMarkText}>&ldquo;</Text>
          </View>

          {/* Body text using AutoResizingPdfText */}
          <View style={styles.bodyTextContainer}>
            <AutoResizingPdfText
              text={body}
              width={bodyWidth}
              height={bodyAreaHeight}
              font={bodyTypo.fontFamily}
              min_fontsize={bodyTypo.minFontSize}
              max_fontsize={bodyTypo.fontSize * 1.2}
              h_align="left"
              v_align="top"
              textColor={theme.primaryColor}
              resize_to_text={false}
            />
          </View>

          {/* Author attribution */}
          {author && (
            <View style={styles.authorContainer}>
              <Text style={styles.authorText}>— {author}</Text>
            </View>
          )}
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
