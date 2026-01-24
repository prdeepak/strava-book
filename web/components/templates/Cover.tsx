/**
 * Cover Page Template
 *
 * Layout: Full-bleed cover photo with text box overlay in bottom ~30%
 * Uses the typography system from BookTheme for consistent text sizing.
 */

import { Page, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { formatPeriodRange } from '@/lib/activity-utils'
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'

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

// Layout proportions
const TEXT_BOX_HEIGHT_RATIO = 0.30  // Text box covers bottom 30%

// Page-only version for use in BookDocument (no Document wrapper)
export const CoverPage = ({
  title: propTitle,
  // subtitle prop reserved for future use
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
  let mainPeriodDisplay: string
  let showPeriodRangeBelow: boolean

  if (periodName) {
    mainPeriodDisplay = periodName
    showPeriodRangeBelow = periodRangeDisplay !== null && periodRangeDisplay !== periodName
  } else if (periodRangeDisplay) {
    mainPeriodDisplay = periodRangeDisplay
    showPeriodRangeBelow = false
  } else {
    mainPeriodDisplay = year ? String(year) : String(new Date().getFullYear())
    showPeriodRangeBelow = false
  }

  // Resolve design tokens
  const displayLarge = resolveTypography('displayLarge', theme, format)
  const subheading = resolveTypography('subheading', theme, format)
  const caption = resolveTypography('caption', theme, format)
  const spacing = resolveSpacing(theme, format)

  // Calculate dimensions
  const pageWidth = format.dimensions.width
  const pageHeight = format.dimensions.height
  const textBoxHeight = pageHeight * TEXT_BOX_HEIGHT_RATIO
  const contentWidth = pageWidth - (format.safeMargin * 2)

  // Text element heights - sized to fit within 30% text box
  const titleHeight = displayLarge.fontSize * 1.2
  const dateRangeHeight = subheading.fontSize * 1.3
  const athleteNameHeight = caption.fontSize * 2

  // Resolve background image path for PDF rendering
  const bgImage = resolveImageForPdf(backgroundImage)

  const styles = StyleSheet.create({
    page: {
      width: pageWidth,
      height: pageHeight,
      backgroundColor: theme.primaryColor,
      padding: 0,
      position: 'relative',
    },
    // Text box overlay - bottom 30%
    textBox: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      width: pageWidth,
      height: textBoxHeight,
      backgroundColor: theme.backgroundColor,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: format.safeMargin,
      paddingVertical: spacing.md,
    },
    // Title container
    titleContainer: {
      width: contentWidth,
      height: titleHeight,
      marginBottom: spacing.xs,
    },
    // Date range container
    dateRangeContainer: {
      width: contentWidth,
      height: dateRangeHeight,
      marginBottom: spacing.sm,
    },
    // Decorative accent line
    accentLine: {
      width: 60 * format.scaleFactor,
      height: 3 * format.scaleFactor,
      backgroundColor: theme.accentColor,
      marginBottom: spacing.sm,
    },
    // Athlete name container
    athleteNameContainer: {
      width: contentWidth,
      height: athleteNameHeight,
    },
  })

  return (
    <Page size={[pageWidth, pageHeight]} style={styles.page}>
      {/* Full-bleed photo */}
      <FullBleedBackground
        image={bgImage ?? undefined}
        fallbackColor={theme.primaryColor}
        role="hero"
        width={pageWidth}
        height={pageHeight}
      />

      {/* Text box overlay - bottom 30% */}
      <View style={styles.textBox}>
        {/* Title (period name) - accent color */}
        <View style={styles.titleContainer}>
          <AutoResizingPdfText
            text={mainPeriodDisplay}
            width={contentWidth}
            height={titleHeight}
            font={displayLarge.fontFamily}
            min_fontsize={displayLarge.minFontSize}
            max_fontsize={displayLarge.fontSize}
            h_align="center"
            v_align="middle"
            textColor={theme.accentColor}
          />
        </View>

        {/* Date range (if different from title) - primary color */}
        {showPeriodRangeBelow && periodRangeDisplay && (
          <View style={styles.dateRangeContainer}>
            <AutoResizingPdfText
              text={periodRangeDisplay}
              width={contentWidth}
              height={dateRangeHeight}
              font={subheading.fontFamily}
              min_fontsize={subheading.minFontSize}
              max_fontsize={subheading.fontSize}
              h_align="center"
              v_align="middle"
              textColor={theme.primaryColor}
            />
          </View>
        )}

        {/* Decorative accent line */}
        <View style={styles.accentLine} />

        {/* Athlete name - primary color */}
        <View style={styles.athleteNameContainer}>
          <AutoResizingPdfText
            text={athleteName}
            width={contentWidth}
            height={athleteNameHeight}
            font={theme.fontPairing.heading}
            min_fontsize={caption.fontSize}
            max_fontsize={subheading.fontSize}
            h_align="center"
            v_align="middle"
            textColor={theme.primaryColor}
          />
        </View>
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
