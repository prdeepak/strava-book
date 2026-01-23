import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS, TypographyRole } from '@/lib/book-types'
import { resolveTypography, resolveSpacing } from '@/lib/typography'
import { AutoResizingPdfText } from './AutoResizingPdfText'

/**
 * PageHeader - Standardized section header for PDF pages
 *
 * Used for consistent headers across section pages like:
 * - Table of Contents ("Contents")
 * - Activity Log ("Activity Log")
 * - YearStats ("2024" / "In Review")
 * - YearCalendar ("2024" / "Training Calendar")
 *
 * Features:
 * - Auto-sizing title text via AutoResizingPdfText
 * - Optional subtitle with consistent styling
 * - Left/center/right alignment
 * - Size presets (medium, large, hero)
 * - Optional bottom border
 * - Theme-aware colors and fonts
 * - Format-aware scaling
 */

export type HeaderAlignment = 'left' | 'center' | 'right'
export type HeaderSize = 'medium' | 'large' | 'hero'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  alignment?: HeaderAlignment
  size?: HeaderSize
  showBorder?: boolean
  /** Override title color (defaults to theme.primaryColor, or accentColor for 'hero' size) */
  titleColor?: string
  /** Override subtitle color (defaults to theme.primaryColor with opacity) */
  subtitleColor?: string
  format?: BookFormat
  theme?: BookTheme
}

// Map header sizes to typography roles for consistent font sizing
const SIZE_TO_TYPOGRAPHY_ROLE: Record<HeaderSize, TypographyRole> = {
  medium: 'heading',
  large: 'displaySmall',
  hero: 'displayLarge',
}

// Title height multiplier relative to font size (accounts for line height + padding)
const TITLE_HEIGHT_MULTIPLIER = 1.5

/**
 * Calculate the total height occupied by a PageHeader.
 * Use this to reserve space when laying out page content.
 */
export function getPageHeaderHeight(
  size: HeaderSize,
  format: BookFormat,
  theme: BookTheme,
  options?: { showBorder?: boolean; hasSubtitle?: boolean }
): number {
  const { showBorder = false, hasSubtitle = false } = options ?? {}
  const spacing = resolveSpacing(theme, format)
  const titleTypo = resolveTypography(SIZE_TO_TYPOGRAPHY_ROLE[size], theme, format)
  const captionTypo = resolveTypography('caption', theme, format)

  // Title container height based on typography
  let height = titleTypo.fontSize * TITLE_HEIGHT_MULTIPLIER

  // Subtitle adds caption font size + small spacing
  if (hasSubtitle) {
    height += captionTypo.fontSize + spacing.xs
  }

  // Border adds xs spacing (for margin) + 2pt line
  if (showBorder) {
    height += spacing.sm + 2
  }

  // Bottom margin
  height += spacing.sm

  return height
}

export const PageHeader = ({
  title,
  subtitle,
  alignment = 'left',
  size = 'large',
  showBorder = false,
  titleColor,
  subtitleColor,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: PageHeaderProps) => {
  // Resolve design tokens
  const spacing = resolveSpacing(theme, format)
  const titleTypo = resolveTypography(SIZE_TO_TYPOGRAPHY_ROLE[size], theme, format)
  const captionTypo = resolveTypography('caption', theme, format)

  // Calculate dimensions
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)
  const titleHeight = titleTypo.fontSize * TITLE_HEIGHT_MULTIPLIER

  // Resolve colors from theme
  const resolvedTitleColor = titleColor ?? (size === 'hero' ? theme.accentColor : theme.primaryColor)
  const resolvedSubtitleColor = subtitleColor ?? theme.primaryColor

  // Map alignment to text align for AutoResizingPdfText
  const textAlign: 'left' | 'center' | 'right' = alignment

  const styles = StyleSheet.create({
    container: {
      width: contentWidth,
      marginBottom: spacing.sm,
    },
    titleContainer: {
      width: '100%',
      height: titleHeight,
    },
    subtitle: {
      width: '100%',
      fontSize: captionTypo.fontSize,
      fontFamily: captionTypo.fontFamily,
      color: resolvedSubtitleColor,
      opacity: 0.6,
      textTransform: 'uppercase',
      letterSpacing: captionTypo.letterSpacing ?? 2,
      marginTop: spacing.xs,
      textAlign: textAlign,
    },
    border: {
      width: '100%',
      height: 2,
      backgroundColor: theme.primaryColor,
      marginTop: spacing.sm,
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <AutoResizingPdfText
          text={title}
          width={contentWidth}
          height={titleHeight}
          font={titleTypo.fontFamily}
          min_fontsize={titleTypo.minFontSize}
          max_fontsize={titleTypo.fontSize}
          h_align={textAlign}
          v_align="bottom"
          textColor={resolvedTitleColor}
          resize_to_text={false}
        />
      </View>

      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}

      {showBorder && (
        <View style={styles.border} />
      )}
    </View>
  )
}

export default PageHeader
