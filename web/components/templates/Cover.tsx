import { Page, Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'

export interface CoverProps {
  title: string
  subtitle?: string
  year: number
  athleteName: string
  backgroundImage?: string
  format: BookFormat
  theme: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: 0,
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.35,
    objectFit: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: theme.primaryColor,
    opacity: 0.85,
  },
  contentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    padding: format.safeMargin,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Decorative top accent bar
  topAccent: {
    position: 'absolute',
    top: format.safeMargin,
    left: '50%',
    width: 80 * format.scaleFactor,
    height: 4 * format.scaleFactor,
    backgroundColor: theme.accentColor,
    transform: 'translateX(-50%)',
  },
  yearText: {
    fontSize: Math.max(120, 140 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    marginBottom: 24 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: -2,
  },
  title: {
    fontSize: Math.max(32, 42 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 16 * format.scaleFactor,
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: Math.max(16, 20 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 48 * format.scaleFactor,
    textAlign: 'center',
    maxWidth: '75%',
    lineHeight: 1.4,
  },
  // Bottom section with athlete name
  bottomSection: {
    position: 'absolute',
    bottom: format.safeMargin,
    left: format.safeMargin,
    right: format.safeMargin,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  athleteLabel: {
    fontSize: Math.max(9, 11 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4 * format.scaleFactor,
  },
  athleteName: {
    fontSize: Math.max(14, 18 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 3,
    textAlign: 'center',
  },
  // Decorative bottom accent bar
  bottomAccent: {
    width: 60 * format.scaleFactor,
    height: 3 * format.scaleFactor,
    backgroundColor: theme.accentColor,
    marginTop: 12 * format.scaleFactor,
  },
})

// Page-only version for use in BookDocument (no Document wrapper)
export const CoverPage = ({
  title,
  subtitle,
  year,
  athleteName,
  backgroundImage,
  format,
  theme = DEFAULT_THEME,
}: CoverProps) => {
  const styles = createStyles(format, theme)

  // Resolve background image path for PDF rendering
  const bgImage = resolveImageForPdf(backgroundImage)

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Background layer */}
      {bgImage ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={bgImage} style={styles.backgroundImage} />
          <View style={styles.gradientOverlay} />
        </>
      ) : (
        // Fallback solid color when no image provided (react-pdf doesn't support gradients)
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: theme.primaryColor,
        }} />
      )}

      {/* Top decorative accent */}
      <View style={styles.topAccent} />

      {/* Main content layer */}
      <View style={styles.contentContainer}>
        <Text style={styles.yearText}>{year}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Bottom section with athlete name */}
      <View style={styles.bottomSection}>
        <Text style={styles.athleteLabel}>By</Text>
        <Text style={styles.athleteName}>{athleteName}</Text>
        <View style={styles.bottomAccent} />
      </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const Cover = (props: CoverProps) => (
  <Document>
    <CoverPage {...props} />
  </Document>
)
