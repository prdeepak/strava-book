import { StyleSheet } from '@react-pdf/renderer'
import { BookFormat, FORMATS } from './book-types'

/**
 * Get BookFormat by size string
 * @param size - One of '8x8', '10x10', or '12x12'
 * @returns BookFormat configuration
 */
export function getFormat(size: '8x8' | '10x10' | '12x12'): BookFormat {
  return FORMATS[size]
}

/**
 * Calculate scaled font size based on format
 * @param baseSize - Base font size at 10x10 format
 * @param format - Target book format
 * @param minSize - Optional minimum font size (default: 10)
 * @returns Scaled font size
 */
export function scaledFontSize(
  baseSize: number,
  format: BookFormat,
  minSize: number = 10
): number {
  return Math.max(minSize, baseSize * format.scaleFactor)
}

/**
 * Create scaled styles helper for StyleSheet.create patterns
 * This helper applies format scaling to a style object
 * @param format - Book format to scale for
 * @returns Function that creates scaled StyleSheet
 *
 * @example
 * const createStyles = createScaledStyles(format)
 * const styles = createStyles({
 *   page: {
 *     padding: format.safeMargin,
 *   },
 *   title: {
 *     fontSize: 36,  // Will be scaled by scaleFactor
 *   }
 * })
 */
export function createScaledStyles(format: BookFormat) {
  return <T extends Record<string, any>>(styles: T) => {
    const scaledStyles: Record<string, any> = {}

    for (const [key, value] of Object.entries(styles)) {
      if (value && typeof value === 'object') {
        scaledStyles[key] = { ...value }

        // Apply scale factor to fontSize if present
        if (typeof value.fontSize === 'number') {
          scaledStyles[key].fontSize = scaledFontSize(
            value.fontSize,
            format,
            10 // Default min size
          )
        }
      }
    }

    return StyleSheet.create(scaledStyles)
  }
}

/**
 * Get page dimensions for react-pdf Page component
 * @param format - Book format
 * @returns Object with width and height in points
 */
export function getPageDimensions(format: BookFormat) {
  return {
    width: format.dimensions.width,
    height: format.dimensions.height,
  }
}

/**
 * Calculate safe area dimensions (excluding margins)
 * @param format - Book format
 * @returns Object with width and height of safe area
 */
export function getSafeAreaDimensions(format: BookFormat) {
  return {
    width: format.dimensions.width - (format.safeMargin * 2),
    height: format.dimensions.height - (format.safeMargin * 2),
  }
}
