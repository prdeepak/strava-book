import { Page, Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { resolveImageForPdf } from '@/lib/pdf-image-loader'
import { formatPeriodRange } from '@/lib/activity-utils'

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

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: 0,
    position: 'relative',
  },
  // Solid color base layer (behind image)
  colorBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: theme.primaryColor,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.6,
    objectFit: 'cover',
  },
  // Semi-transparent overlay for text readability
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
  // Main title - period name (e.g., "Road to Comrades 2025", "2024", "Summer 2024")
  // Uses dynamic font sizing to fit longer text
  yearText: {
    fontSize: Math.max(48, 72 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    marginBottom: 16 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: 2,
    maxWidth: '90%',
    lineHeight: 1.1,
  },
  periodRangeText: {
    fontSize: Math.max(14, 18 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 24 * format.scaleFactor,
    textAlign: 'center',
    letterSpacing: 1,
  },
  // REMOVED: title style - periodName is now the book title, displayed in yearText
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
  // REMOVED: athleteLabel style - no longer showing "By" prefix
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

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Layer 1: Solid color base */}
      <View style={styles.colorBase} />

      {/* Layer 2: Background image (on top of color, visible) */}
      {bgImage && (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={bgImage} style={styles.backgroundImage} />
          {/* Layer 3: Semi-transparent overlay for text readability */}
          <View style={styles.textOverlay} />
        </>
      )}

      {/* Top decorative accent */}
      <View style={styles.topAccent} />

      {/* Main content layer */}
      <View style={styles.contentContainer}>
        {/* Period name IS the book title now */}
        <Text style={styles.yearText}>{mainPeriodDisplay}</Text>
        {showPeriodRangeBelow && periodRangeDisplay && (
          <Text style={styles.periodRangeText}>{periodRangeDisplay}</Text>
        )}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Bottom section with athlete name (no "By" prefix) */}
      <View style={styles.bottomSection}>
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
