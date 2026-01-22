import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
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

// Size presets define font size ranges for AutoResizingPdfText
const SIZE_PRESETS: Record<HeaderSize, { minFont: number; maxFont: number; subtitleSize: number }> = {
  medium: { minFont: 18, maxFont: 28, subtitleSize: 10 },
  large: { minFont: 28, maxFont: 44, subtitleSize: 12 },
  hero: { minFont: 48, maxFont: 84, subtitleSize: 14 },
}

// Height allocated for title based on size (before scaling)
const TITLE_HEIGHTS: Record<HeaderSize, number> = {
  medium: 36,
  large: 52,
  hero: 96,
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
  const scale = format.scaleFactor
  const preset = SIZE_PRESETS[size]

  // Calculate dimensions
  const contentWidth = format.dimensions.width - (format.safeMargin * 2)
  const titleHeight = TITLE_HEIGHTS[size] * scale

  // Resolve colors from theme
  const resolvedTitleColor = titleColor ?? (size === 'hero' ? theme.accentColor : theme.primaryColor)
  const resolvedSubtitleColor = subtitleColor ?? theme.primaryColor

  // Map alignment to text align for AutoResizingPdfText
  const textAlign: 'left' | 'center' | 'right' = alignment

  const styles = StyleSheet.create({
    container: {
      width: contentWidth,
      marginBottom: 16 * scale,
    },
    titleContainer: {
      width: '100%',
      height: titleHeight,
    },
    subtitle: {
      width: '100%',
      fontSize: Math.max(preset.subtitleSize * 0.8, preset.subtitleSize * scale),
      fontFamily: theme.fontPairing.body,
      color: resolvedSubtitleColor,
      opacity: 0.6,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginTop: 4 * scale,
      textAlign: textAlign,
    },
    border: {
      width: '100%',
      height: 2 * scale,
      backgroundColor: theme.primaryColor,
      marginTop: 12 * scale,
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <AutoResizingPdfText
          text={title}
          width={contentWidth}
          height={titleHeight}
          font={theme.fontPairing.heading}
          min_fontsize={Math.max(preset.minFont * 0.8, preset.minFont * scale)}
          max_fontsize={Math.max(preset.maxFont * 0.8, preset.maxFont * scale)}
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
