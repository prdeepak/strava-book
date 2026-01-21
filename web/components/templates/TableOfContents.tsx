import { Page, Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, BookPageType, FORMATS } from '@/lib/book-types'

export interface TOCEntry {
  title: string
  pageNumber: number
  type: BookPageType | string
  category?: string  // 'Overview', 'Monthly', 'Races', 'Appendix'
  subtitle?: string  // Additional info like date, distance
  isARace?: boolean  // Highlight as primary race
  activityCount?: number
}

export interface TableOfContentsProps {
  // Direct entries for TOC
  entries?: TOCEntry[]
  // Or fixture data with sections
  activity?: {
    sections?: TOCEntry[]
    bookTitle?: string
    athleteName?: string
  }
  backgroundPhotoUrl?: string  // Faint background photo (opacity ~0.1)
  format?: BookFormat
  theme?: BookTheme
}

const createStyles = (format: BookFormat, theme: BookTheme) => StyleSheet.create({
  page: {
    width: format.dimensions.width,
    height: format.dimensions.height,
    backgroundColor: theme.backgroundColor,
    padding: format.safeMargin,
    paddingTop: format.safeMargin * 1.5,
    paddingBottom: format.safeMargin,
    flexDirection: 'column',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.1,
  },
  title: {
    fontSize: Math.max(32, 42 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    fontWeight: 'bold',
    marginBottom: 32 * format.scaleFactor,
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  contentContainer: {
    flexGrow: 1,
    flexShrink: 0,
  },
  categoryHeader: {
    fontSize: Math.max(11, 13 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    marginTop: 28 * format.scaleFactor,
    marginBottom: 14 * format.scaleFactor,
    textTransform: 'uppercase',
    letterSpacing: 2,
    borderBottomWidth: 2,
    borderBottomColor: theme.accentColor,
    paddingBottom: 6 * format.scaleFactor,
  },
  categoryHeaderFirst: {
    marginTop: 0,
  },
  tocEntry: {
    flexDirection: 'row',
    marginBottom: 14 * format.scaleFactor,
    alignItems: 'center',
    paddingLeft: 12 * format.scaleFactor,
  },
  tocEntryHighlight: {
    flexDirection: 'row',
    marginBottom: 14 * format.scaleFactor,
    alignItems: 'center',
    paddingLeft: 12 * format.scaleFactor,
    backgroundColor: `${theme.accentColor}12`,
    paddingVertical: 8 * format.scaleFactor,
    paddingRight: 12 * format.scaleFactor,
    borderRadius: 4,
    marginRight: -12 * format.scaleFactor,
  },
  tocTitleContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  tocTitle: {
    fontSize: Math.max(12, 14 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
  },
  tocTitleHighlight: {
    fontSize: Math.max(12, 14 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    fontWeight: 'bold',
  },
  tocSubtitle: {
    fontSize: Math.max(8, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    marginTop: 2,
  },
  tocPageNumber: {
    fontSize: Math.max(12, 14 * format.scaleFactor),
    fontFamily: 'Courier-Bold',
    color: theme.primaryColor,
    marginLeft: 'auto',
    paddingLeft: 12 * format.scaleFactor,
    textAlign: 'right',
  },
})

/**
 * TableOfContents - Section-based TOC page
 * Lists sections (months, races) rather than individual pages
 * Supports highlighting A-race and showing subtitles with dates/distances
 */

// Generate default entries for testing when no data provided
// Order: Overview → Races → Training Log (dividers only) → Highlights
const generateDefaultEntries = (): TOCEntry[] => [
  { title: 'Year Overview', category: 'Overview', pageNumber: 3, type: 'year_stats' },
  { title: 'Activity Calendar', category: 'Overview', pageNumber: 5, type: 'year_calendar' },
  { title: 'Boston Marathon', category: 'Races', pageNumber: 8, type: 'race_section', subtitle: 'April 21 • 42.2 km', isARace: true },
  { title: 'Brooklyn Half', category: 'Races', pageNumber: 14, type: 'race_section', subtitle: 'May 17 • 21.1 km' },
  { title: 'Comrades Ultra', category: 'Races', pageNumber: 20, type: 'race_section', subtitle: 'June 8 • 89 km' },
  { title: 'Chicago Marathon', category: 'Races', pageNumber: 28, type: 'race_section', subtitle: 'Oct 12 • 42.2 km' },
  { title: 'January', category: 'Training Log', pageNumber: 36, type: 'monthly_divider', activityCount: 18 },
  { title: 'February', category: 'Training Log', pageNumber: 42, type: 'monthly_divider', activityCount: 20 },
  { title: 'March', category: 'Training Log', pageNumber: 48, type: 'monthly_divider', activityCount: 24 },
  { title: 'Best Efforts', category: 'Highlights', pageNumber: 56, type: 'best_efforts' },
]

// Page-only version for use in BookDocument (no Document wrapper)
export const TableOfContentsPage = ({
  entries: propEntries,
  activity,
  backgroundPhotoUrl,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: TableOfContentsProps) => {
  const styles = createStyles(format, theme)

  // Get entries from props, activity fixture, or generate defaults
  const entries = propEntries || activity?.sections || generateDefaultEntries()

  // Group entries by category
  const groupedEntries: Record<string, TOCEntry[]> = {}
  // Category order - Races come before Training Log (monthly sections)
  const categoryOrder = [
    'Front Matter',   // Cover, Foreword
    'Overview',       // Year at a Glance, Year Stats
    'Races',          // Race pages
    'Training Log',   // Monthly Dividers only (not Activity Log)
    'Highlights',     // Best Efforts, Route Heatmap
    'Back Matter',    // Back Cover
    // Legacy categories for backwards compatibility
    'Monthly',
    'Journal',
    'Appendix',
    'Other',
  ]

  entries.forEach(entry => {
    const category = entry.category || 'Other'
    if (!groupedEntries[category]) {
      groupedEntries[category] = []
    }
    groupedEntries[category].push(entry)
  })

  // Sort entries within each category by page number
  Object.values(groupedEntries).forEach(categoryEntries => {
    categoryEntries.sort((a, b) => a.pageNumber - b.pageNumber)
  })

  // Sort categories by predefined order
  const sortedCategories = Object.keys(groupedEntries).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a)
    const indexB = categoryOrder.indexOf(b)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Background photo (if provided) */}
      {backgroundPhotoUrl && (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop
        <Image src={backgroundPhotoUrl} style={styles.backgroundImage} />
      )}

      {/* Title */}
      <Text style={styles.title}>Contents</Text>

      {/* TOC Entries */}
      <View style={styles.contentContainer}>
        {sortedCategories.map((category, categoryIndex) => (
          <View key={category}>
            {/* Category Header - no top margin for first category */}
            <Text style={
              categoryIndex === 0
                ? [styles.categoryHeader, styles.categoryHeaderFirst]
                : styles.categoryHeader
            }>{category}</Text>

            {/* Entries in Category */}
            {groupedEntries[category]?.map((entry, idx) => {
              const isHighlighted = entry.isARace
              const entryStyle = isHighlighted ? styles.tocEntryHighlight : styles.tocEntry
              const titleStyle = isHighlighted ? styles.tocTitleHighlight : styles.tocTitle

              // Build subtitle if not provided but we have activityCount
              let subtitle = entry.subtitle
              if (!subtitle && entry.activityCount) {
                subtitle = `${entry.activityCount} activities`
              }

              return (
                <View key={`${category}-${idx}`} style={entryStyle}>
                  <View style={styles.tocTitleContainer}>
                    <Text style={titleStyle}>{entry.title}</Text>
                    {subtitle && <Text style={styles.tocSubtitle}>{subtitle}</Text>}
                  </View>
                  <Text style={styles.tocPageNumber}>{entry.pageNumber}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </View>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const TableOfContents = (props: TableOfContentsProps) => (
  <Document>
    <TableOfContentsPage {...props} />
  </Document>
)
