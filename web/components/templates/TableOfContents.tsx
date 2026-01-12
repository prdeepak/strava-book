import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, BookPageType, FORMATS } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'

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
  },
  title: {
    fontSize: Math.max(28, 36 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    fontWeight: 'bold',
    marginBottom: 20 * format.scaleFactor,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  categoryHeader: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    marginTop: 14 * format.scaleFactor,
    marginBottom: 8 * format.scaleFactor,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.accentColor,
    paddingBottom: 4 * format.scaleFactor,
  },
  tocEntry: {
    flexDirection: 'row',
    marginBottom: 6 * format.scaleFactor,
    alignItems: 'center',
    paddingLeft: 8 * format.scaleFactor,
  },
  tocEntryHighlight: {
    flexDirection: 'row',
    marginBottom: 6 * format.scaleFactor,
    alignItems: 'center',
    paddingLeft: 8 * format.scaleFactor,
    backgroundColor: `${theme.accentColor}15`,
    paddingVertical: 4 * format.scaleFactor,
    paddingRight: 8 * format.scaleFactor,
    borderRadius: 4,
    marginRight: -8 * format.scaleFactor,
  },
  tocTitleContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  tocTitle: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
  },
  tocTitleHighlight: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    fontWeight: 'bold',
  },
  tocSubtitle: {
    fontSize: Math.max(7, 8 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.6,
    marginTop: 1,
  },
  tocPageNumber: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: 'Courier-Bold',
    color: theme.primaryColor,
    marginLeft: 8 * format.scaleFactor,
    minWidth: 24 * format.scaleFactor,
    textAlign: 'right',
  },
  dotsContainer: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 6 * format.scaleFactor,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.primaryColor,
    opacity: 0.2,
    minWidth: 20,
  },
  footerText: {
    fontSize: Math.max(8, 9 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: theme.primaryColor,
    opacity: 0.5,
    marginTop: 'auto',
    textAlign: 'center',
    paddingTop: 12 * format.scaleFactor,
    borderTopWidth: 0.5,
    borderTopColor: theme.primaryColor,
    borderTopStyle: 'solid',
  },
})

/**
 * TableOfContents - Section-based TOC page
 * Lists sections (months, races) rather than individual pages
 * Supports highlighting A-race and showing subtitles with dates/distances
 */

// Generate default entries for testing when no data provided
const generateDefaultEntries = (): TOCEntry[] => [
  { title: 'Year Overview', category: 'Overview', pageNumber: 3, type: 'year_stats' },
  { title: 'Activity Calendar', category: 'Overview', pageNumber: 4, type: 'year_calendar' },
  { title: 'January', category: 'Monthly', pageNumber: 6, type: 'monthly_divider', activityCount: 18 },
  { title: 'February', category: 'Monthly', pageNumber: 12, type: 'monthly_divider', activityCount: 20 },
  { title: 'March', category: 'Monthly', pageNumber: 18, type: 'monthly_divider', activityCount: 24 },
  { title: 'Boston Marathon', category: 'Races', pageNumber: 24, type: 'race_section', subtitle: 'April 21 • 42.2 km' },
  { title: 'Brooklyn Half', category: 'Races', pageNumber: 30, type: 'race_section', subtitle: 'May 17 • 21.1 km' },
  { title: 'Comrades Ultra', category: 'Races', pageNumber: 36, type: 'race_section', subtitle: 'June 8 • 89 km', isARace: true },
  { title: 'Chicago Marathon', category: 'Races', pageNumber: 44, type: 'race_section', subtitle: 'Oct 12 • 42.2 km' },
  { title: 'Activity Log', category: 'Appendix', pageNumber: 56, type: 'activity_log' },
]

// Page-only version for use in BookDocument (no Document wrapper)
export const TableOfContentsPage = ({
  entries: propEntries,
  activity,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: TableOfContentsProps) => {
  const styles = createStyles(format, theme)

  // Get entries from props, activity fixture, or generate defaults
  const entries = propEntries || activity?.sections || generateDefaultEntries()

  // Group entries by category
  const groupedEntries: Record<string, TOCEntry[]> = {}
  const categoryOrder = ['Overview', 'Monthly', 'Races', 'Appendix']

  entries.forEach(entry => {
    const category = entry.category || 'Other'
    if (!groupedEntries[category]) {
      groupedEntries[category] = []
    }
    groupedEntries[category].push(entry)
  })

  // Sort categories by predefined order
  const sortedCategories = Object.keys(groupedEntries).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a)
    const indexB = categoryOrder.indexOf(b)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Title */}
      <Text style={styles.title}>Contents</Text>

      {/* TOC Entries */}
      <View style={{ flex: 1 }}>
        {sortedCategories.map(category => (
          <View key={category}>
            {/* Category Header */}
            <Text style={styles.categoryHeader}>{category}</Text>

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
                  <View style={styles.dotsContainer} />
                  <Text style={styles.tocPageNumber}>{entry.pageNumber}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </View>

      {/* Footer */}
      <Text style={styles.footerText}>
        {activity?.bookTitle || 'Strava Book'} • {activity?.athleteName || 'Year in Review'}
      </Text>
    </Page>
  )
}

// Standalone version with Document wrapper (for testing)
export const TableOfContents = (props: TableOfContentsProps) => (
  <Document>
    <TableOfContentsPage {...props} />
  </Document>
)
