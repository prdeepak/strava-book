/**
 * Cover Page Template
 *
 * Uses the typography system from BookTheme for consistent text sizing.
 * Cover photo is displayed as a hero image (full opacity, no overlay).
 */

import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { formatPeriodRange } from '@/lib/activity-utils'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

export interface CoverProps {
  title?: string
  subtitle?: string
  periodName?: string  // Display text for time period (e.g., "Summer 2024")
  year?: number        // Fallback if periodName not provided
  startDate?: string   // ISO date string for period start
  endDate?: string     // ISO date string for period end
  athleteName?: string
  backgroundImage?: string
  format?: BookFormat
  theme?: BookTheme
  // For test harness compatibility - derive props from activity
  activity?: {
    name?: string
    start_date?: string
    start_date_local?: string
    athlete?: { firstname?: string; lastname?: string }
    photos?: {
      primary?: { urls?: Record<string, string> }
    }
    comprehensiveData?: {
      photos?: Array<{ urls?: Record<string, string> }>
    }
  }
}

/**
 * Create styles using resolved typography and spacing from theme
 */
const createStyles = (format: BookFormat, theme: BookTheme) => {
  // Resolve typography for each text role
  const displayLarge = resolveTypography('displayLarge', theme, format)
  const subheading = resolveTypography('subheading', theme, format)
  const body = resolveTypography('body', theme, format)
  const caption = resolveTypography('caption', theme, format)

  // Resolve spacing
  const spacing = resolveSpacing(theme, format)

  return StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: 0,
      position: 'relative',
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
    // Main title - uses displayLarge typography role
    titleText: {
      fontSize: displayLarge.fontSize,
      fontFamily: displayLarge.fontFamily,
      color: theme.accentColor,
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      textAlign: 'center',
      letterSpacing: displayLarge.letterSpacing ?? 2,
      maxWidth: '90%',
      lineHeight: displayLarge.lineHeight ?? 1.1,
    },
    // Period range text - uses subheading typography role
    periodRangeText: {
      fontSize: subheading.fontSize,
      fontFamily: subheading.fontFamily,
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: spacing.md,
      textAlign: 'center',
      letterSpacing: 1,
    },
    // Subtitle - uses body typography role
    subtitle: {
      fontSize: body.fontSize,
      fontFamily: body.fontFamily,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: spacing.lg,
      textAlign: 'center',
      maxWidth: '75%',
      lineHeight: body.lineHeight ?? 1.4,
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
    // Athlete name - uses caption typography role with heading font
    athleteName: {
      fontSize: caption.fontSize + 4, // Slightly larger than caption
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
      marginTop: spacing.xs + 4,
    },
  })
}

// Page-only version for use in BookDocument (no Document wrapper)
export const CoverPage = ({
  title: propTitle,
  subtitle: propSubtitle,
  periodName: propPeriodName,
  year: propYear,
  startDate: propStartDate,
  endDate: propEndDate,
  athleteName: propAthleteName,
  backgroundImage: propBackgroundImage,
  format: propFormat,
  theme = DEFAULT_THEME,
  activity,
}: CoverProps) => {
  // Handle test harness case: derive props from activity if provided
  const format = propFormat || FORMATS['10x10']

  let title = propTitle
  let subtitle = propSubtitle
  let periodName = propPeriodName
  let year = propYear
  const startDate = propStartDate
  const endDate = propEndDate
  let athleteName = propAthleteName
  let backgroundImage = propBackgroundImage

  if (activity && !propTitle) {
    // Derive from activity for testing
    const activityDate = new Date(activity.start_date || activity.start_date_local || new Date())
    year = activityDate.getFullYear()
    periodName = String(year)

    // Use activity name as title, or generate a default
    title = activity.name || 'My Running Year'
    subtitle = `A Year of Running Adventures`

    // Get athlete name from activity
    athleteName = activity.athlete
      ? `${activity.athlete.firstname || ''} ${activity.athlete.lastname || ''}`.trim()
      : 'Athlete'

    // Get photo from activity
    const photoUrls = activity.photos?.primary?.urls ||
      activity.comprehensiveData?.photos?.[0]?.urls || {}
    const sizes = Object.keys(photoUrls).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a)
    if (sizes.length > 0) {
      backgroundImage = photoUrls[sizes[0]]
    }
  }

  // Set default values if still missing
  if (!title) title = 'My Running Year'
  if (!athleteName) athleteName = 'Athlete'

  // Calculate period range display
  let periodRangeDisplay: string | null = null
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      periodRangeDisplay = formatPeriodRange(start, end)
    }
  }

  // Determine what to display as main period text
  // If no periodName, use period_range as main display (skip smaller font below)
  let mainPeriodDisplay: string
  let showPeriodRangeBelow: boolean

  if (periodName) {
    mainPeriodDisplay = periodName
    // Only show range below if it's different from the main display
    showPeriodRangeBelow = periodRangeDisplay !== null && periodRangeDisplay !== periodName
  } else if (periodRangeDisplay) {
    mainPeriodDisplay = periodRangeDisplay
    showPeriodRangeBelow = false
  } else {
    mainPeriodDisplay = year ? String(year) : String(new Date().getFullYear())
    showPeriodRangeBelow = false
  }

  const styles = createStyles(format, theme)

  // Resolve background image path for PDF rendering
  const bgImage = resolveImageForPdf(backgroundImage)

  // Resolve effects for text background opacity
  const effects = resolveEffects(theme)

  // Determine if we need text backgrounds (when there's an image behind)
  const hasImageBackground = !!bgImage
  const textBgOpacity = hasImageBackground ? effects.textOverlayOpacity : 0

  // Resolve typography for AutoResizingPdfText
  const displayLarge = resolveTypography('displayLarge', theme, format)
  const subheadingTypo = resolveTypography('subheading', theme, format)
  const bodyTypo = resolveTypography('body', theme, format)
  const captionTypo = resolveTypography('caption', theme, format)

  // Calculate content dimensions
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)
  const titleHeight = displayLarge.fontSize * 1.5
  const subtitleHeight = bodyTypo.fontSize * 3
  const athleteNameHeight = (captionTypo.fontSize + 4) * 1.5

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Full-bleed background: hero image or solid primary color */}
      <FullBleedBackground
        image={bgImage}
        fallbackColor={theme.primaryColor}
        role="hero"
        width={format.dimensions.width}
        height={format.dimensions.height}
      />

      {/* Top decorative accent */}
      <View style={styles.topAccent} />

      {/* Main content layer */}
      <View style={styles.contentContainer}>
        {/* Period name IS the book title now - uses AutoResizingPdfText */}
        <AutoResizingPdfText
          text={mainPeriodDisplay}
          width={contentWidth * 0.9}
          height={titleHeight}
          font={displayLarge.fontFamily}
          min_fontsize={displayLarge.minFontSize}
          max_fontsize={displayLarge.fontSize}
          h_align="center"
          v_align="middle"
          textColor={theme.accentColor}
          backgroundColor={theme.primaryColor}
          backgroundOpacity={textBgOpacity}
        />
        {showPeriodRangeBelow && periodRangeDisplay && (
          <Text style={styles.periodRangeText}>{periodRangeDisplay}</Text>
        )}
        {subtitle && (
          <AutoResizingPdfText
            text={subtitle}
            width={contentWidth * 0.75}
            height={subtitleHeight}
            font={bodyTypo.fontFamily}
            min_fontsize={bodyTypo.minFontSize}
            max_fontsize={bodyTypo.fontSize}
            h_align="center"
            v_align="middle"
            textColor={theme.backgroundColor}
            backgroundColor={theme.primaryColor}
            backgroundOpacity={textBgOpacity}
          />
        )}
      </View>

      {/* Bottom section with athlete name (no "By" prefix) */}
      <View style={styles.bottomSection}>
        <AutoResizingPdfText
          text={athleteName}
          width={contentWidth}
          height={athleteNameHeight}
          font={theme.fontPairing.heading}
          min_fontsize={captionTypo.minFontSize}
          max_fontsize={captionTypo.fontSize + 4}
          h_align="center"
          v_align="middle"
          textColor={theme.backgroundColor}
          backgroundColor={theme.primaryColor}
          backgroundOpacity={textBgOpacity}
        />
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
