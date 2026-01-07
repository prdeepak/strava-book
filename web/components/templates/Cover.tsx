import { Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME } from '@/lib/book-types'

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
    opacity: 0.5,
    objectFit: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: theme.primaryColor,
    opacity: 0.3,
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
  yearText: {
    fontSize: Math.max(80, 96 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    marginBottom: 20 * format.scaleFactor,
    textAlign: 'center',
  },
  title: {
    fontSize: Math.max(28, 36 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 10 * format.scaleFactor,
    textAlign: 'center',
    maxWidth: '80%',
  },
  subtitle: {
    fontSize: Math.max(14, 18 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#e0e0e0',
    marginBottom: 40 * format.scaleFactor,
    textAlign: 'center',
    maxWidth: '70%',
  },
  athleteName: {
    fontSize: Math.max(12, 16 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    position: 'absolute',
    bottom: format.safeMargin,
  },
})

export const Cover = ({
  title,
  subtitle,
  year,
  athleteName,
  backgroundImage,
  format,
  theme = DEFAULT_THEME,
}: CoverProps) => {
  const styles = createStyles(format, theme)

  // Use proxy for background image if provided
  const bgImage = backgroundImage
    ? `/api/proxy-image?url=${encodeURIComponent(backgroundImage)}`
    : null

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
        // Fallback gradient when no image provided
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.accentColor} 100%)`,
        }} />
      )}

      {/* Content layer */}
      <View style={styles.contentContainer}>
        <Text style={styles.yearText}>{year}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.athleteName}>{athleteName}</Text>
      </View>
    </Page>
  )
}
