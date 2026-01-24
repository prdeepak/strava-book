import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, BookPageType, FORMATS } from '@/lib/book-types'
import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'
import { PageHeader } from '@/components/pdf/PageHeader'

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
  backgroundPhotoUrl?: string  // Reserved for future background image support
  format?: BookFormat
  theme?: BookTheme
  // For multi-page support
  pageIndex?: number  // Which page of TOC (0-indexed)
  totalPages?: number // Total TOC pages (for "continued" indicator)
}

// Constants for calculating page capacity
const ENTRIES_PER_PAGE_FIRST = 12  // First page has title, fewer entries
const ENTRIES_PER_PAGE_CONTINUATION = 16  // Continuation pages fit more

/**
 * Calculate how many TOC pages are needed for given entries
 */
export const getTocPageCount = (entries: TOCEntry[]): number => {
  if (entries.length <= ENTRIES_PER_PAGE_FIRST) return 1
  const remaining = entries.length - ENTRIES_PER_PAGE_FIRST
  return 1 + Math.ceil(remaining / ENTRIES_PER_PAGE_CONTINUATION)
}

/**
 * TableOfContents - Section-based TOC page
 * Lists sections (months, races) rather than individual pages
 * Supports highlighting A-race and showing subtitles with dates/distances
 */

// Generate default entries for testing when no data provided
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
  // backgroundPhotoUrl reserved for future background image support
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  pageIndex = 0,
  totalPages = 1,
}: TableOfContentsProps) => {
  // Resolve design tokens
  const heading = resolveTypography('heading', theme, format)
  const body = resolveTypography('body', theme, format)
  const caption = resolveTypography('caption', theme, format)
  const spacing = resolveSpacing(theme, format)
  const effects = resolveEffects(theme)

  // Get entries from props, activity fixture, or generate defaults
  const allEntries = propEntries || activity?.sections || generateDefaultEntries()

  // Calculate which entries to show on this page
  const isFirstPage = pageIndex === 0
  const entriesPerPage = isFirstPage ? ENTRIES_PER_PAGE_FIRST : ENTRIES_PER_PAGE_CONTINUATION
  const startIndex = isFirstPage ? 0 : ENTRIES_PER_PAGE_FIRST + (pageIndex - 1) * ENTRIES_PER_PAGE_CONTINUATION
  const entries = allEntries.slice(startIndex, startIndex + entriesPerPage)

  // Group entries by category
  const groupedEntries: Record<string, TOCEntry[]> = {}
  const categoryOrder = [
    'Front Matter',
    'Overview',
    'Races',
    'Training Log',
    'Highlights',
    'Back Matter',
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

  const styles = StyleSheet.create({
    page: {
      width: format.dimensions.width,
      height: format.dimensions.height,
      backgroundColor: theme.backgroundColor,
      padding: 0,  // Use contentContainer for padding to avoid react-pdf layout bug
      position: 'relative',
    },
    // Content container with safe margins (avoids react-pdf bug with page padding + absolute elements)
    contentContainer: {
      position: 'absolute',
      top: format.safeMargin,
      left: format.safeMargin,
      right: format.safeMargin,
      bottom: format.safeMargin,
      flexDirection: 'column',
    },
    entriesContainer: {
      flexGrow: 1,
      flexShrink: 0,
    },
    categoryHeader: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.accentColor,
      fontWeight: 'bold',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: caption.letterSpacing ?? 2,
      borderBottomWidth: 2,
      borderBottomColor: theme.accentColor,
      paddingBottom: spacing.xs,
    },
    categoryHeaderFirst: {
      marginTop: 0,
    },
    tocEntry: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
      alignItems: 'center',
      paddingLeft: spacing.sm,
    },
    tocEntryHighlight: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
      alignItems: 'center',
      paddingLeft: spacing.sm,
      backgroundColor: `${theme.accentColor}12`,
      paddingVertical: spacing.xs,
      paddingRight: spacing.sm,
      borderRadius: 4,
      marginRight: -spacing.sm,
    },
    tocTitleContainer: {
      flex: 1,
      flexDirection: 'column',
    },
    tocTitle: {
      fontSize: body.fontSize,
      fontFamily: body.fontFamily,
      color: theme.primaryColor,
    },
    tocTitleHighlight: {
      fontSize: body.fontSize,
      fontFamily: heading.fontFamily,
      color: theme.primaryColor,
      fontWeight: 'bold',
    },
    tocSubtitle: {
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      marginTop: 2,
    },
    tocPageNumber: {
      fontSize: body.fontSize,
      fontFamily: heading.fontFamily,
      color: theme.primaryColor,
      marginLeft: 'auto',
      paddingLeft: spacing.sm,
      textAlign: 'right',
    },
    continuedIndicator: {
      position: 'absolute',
      bottom: 0,  // Relative to contentContainer which already has margins
      right: 0,
      fontSize: caption.fontSize,
      fontFamily: caption.fontFamily,
      color: theme.primaryColor,
      opacity: effects.backgroundImageOpacity,
      fontStyle: 'italic',
    },
  })

  return (
    <Page size={[format.dimensions.width, format.dimensions.height]} style={styles.page}>
      {/* Solid background - differentiates TOC from photo-heavy pages */}
      <FullBleedBackground
        fallbackColor={theme.backgroundColor}
        width={format.dimensions.width}
        height={format.dimensions.height}
      />

      {/* Content container with safe margins */}
      <View style={styles.contentContainer}>
        {/* Header */}
        <PageHeader
          title="Contents"
          subtitle={isFirstPage ? undefined : 'Continued'}
          size="large"
          alignment="left"
          showBorder={true}
          format={format}
          theme={theme}
        />

        {/* TOC Entries */}
        <View style={styles.entriesContainer}>
          {sortedCategories.map((category, categoryIndex) => (
            <View key={category}>
              {/* Category Header */}
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

        {/* "Continued" indicator when there are more pages */}
        {pageIndex < totalPages - 1 && (
          <Text style={styles.continuedIndicator}>continued →</Text>
        )}
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
