import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, BookPageType } from '@/lib/book-types'

export interface TOCEntry {
  title: string
  pageNumber: number
  type: BookPageType
  category?: string  // 'Overview', 'Races', 'Journal', 'Appendix'
}

export interface TableOfContentsProps {
  entries: TOCEntry[]
  format: BookFormat
  theme: BookTheme
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
    fontSize: Math.max(24, 32 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.primaryColor,
    fontWeight: 'bold',
    marginBottom: 24 * format.scaleFactor,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  categoryHeader: {
    fontSize: Math.max(12, 16 * format.scaleFactor),
    fontFamily: theme.fontPairing.heading,
    color: theme.accentColor,
    fontWeight: 'bold',
    marginTop: 16 * format.scaleFactor,
    marginBottom: 10 * format.scaleFactor,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: theme.accentColor,
    paddingBottom: 4 * format.scaleFactor,
  },
  tocEntry: {
    flexDirection: 'row',
    marginBottom: 8 * format.scaleFactor,
    alignItems: 'flex-end',
    paddingLeft: 12 * format.scaleFactor,
  },
  tocTitle: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#000000',
    flex: 1,
  },
  tocPageNumber: {
    fontSize: Math.max(10, 12 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#000000',
    fontWeight: 'bold',
    marginLeft: 8 * format.scaleFactor,
  },
  dotsContainer: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 6 * format.scaleFactor,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
  },
  footerText: {
    fontSize: Math.max(8, 10 * format.scaleFactor),
    fontFamily: theme.fontPairing.body,
    color: '#888888',
    marginTop: 20 * format.scaleFactor,
    textAlign: 'center',
    paddingTop: 12 * format.scaleFactor,
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
  },
})

/**
 * TableOfContents - Auto-generated TOC page
 * Lists sections with page numbers, grouped by category
 * Clean typography with dot leaders and theme-consistent styling
 */

// Page-only version for use in BookDocument (no Document wrapper)
export const TableOfContentsPage = ({
  entries,
  format,
  theme = DEFAULT_THEME,
}: TableOfContentsProps) => {
  const styles = createStyles(format, theme)

  // Group entries by category
  const groupedEntries: Record<string, TOCEntry[]> = {}
  const categoryOrder = ['Overview', 'Races', 'Journal', 'Appendix']

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
            {groupedEntries[category]?.map((entry, idx) => (
              <View key={`${category}-${idx}`} style={styles.tocEntry}>
                <Text style={styles.tocTitle}>
                  {entry.title}
                </Text>
                <View style={styles.dotsContainer} />
                <Text style={styles.tocPageNumber}>{entry.pageNumber}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Footer */}
      <Text style={styles.footerText}>
        Strava Book - Your Year in Review
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
