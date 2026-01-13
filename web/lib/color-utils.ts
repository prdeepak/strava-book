/**
 * Color utilities for ensuring WCAG contrast compliance
 *
 * These utilities help ensure text remains readable when using
 * race-specific color schemes that may have low-contrast accent colors.
 */

/**
 * Parse a hex color string to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate relative luminance per WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate WCAG 2.1 contrast ratio between two colors
 * Returns a value between 1 (no contrast) and 21 (max contrast)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1)
  const l2 = getRelativeLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG 2.1 contrast requirements:
 * - AA normal text: 4.5:1
 * - AA large text (18pt+ or 14pt bold): 3:1
 * - AAA normal text: 7:1
 * - AAA large text: 4.5:1
 */
export const CONTRAST_THRESHOLDS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const

/**
 * Check if a color has sufficient contrast against white (#FFFFFF)
 * Uses AA large text threshold (3:1) since headings/stats are typically large
 */
export function hasContrastAgainstWhite(
  color: string,
  threshold: number = CONTRAST_THRESHOLDS.AA_LARGE
): boolean {
  return getContrastRatio(color, '#FFFFFF') >= threshold
}

/**
 * Check if a color has sufficient contrast against a given background
 */
export function hasContrast(
  foreground: string,
  background: string,
  threshold: number = CONTRAST_THRESHOLDS.AA_LARGE
): boolean {
  return getContrastRatio(foreground, background) >= threshold
}

/**
 * Darken a color by a percentage (0-100)
 * Used to adjust accent colors that don't meet contrast requirements
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const factor = 1 - percent / 100
  const r = Math.round(rgb.r * factor)
  const g = Math.round(rgb.g * factor)
  const b = Math.round(rgb.b * factor)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Adjust a color to meet minimum contrast against white
 * Progressively darkens the color until it meets the threshold
 */
export function ensureContrastAgainstWhite(
  color: string,
  threshold: number = CONTRAST_THRESHOLDS.AA_LARGE
): string {
  if (hasContrastAgainstWhite(color, threshold)) {
    return color
  }

  // Progressively darken until we meet the threshold
  let adjusted = color
  for (let percent = 5; percent <= 80; percent += 5) {
    adjusted = darkenColor(color, percent)
    if (hasContrastAgainstWhite(adjusted, threshold)) {
      return adjusted
    }
  }

  // If we can't make it work, return a very dark version
  return darkenColor(color, 80)
}

/**
 * Get the best text color (black or white) for a given background
 */
export function getContrastTextColor(backgroundColor: string): string {
  const contrastWithWhite = getContrastRatio(backgroundColor, '#FFFFFF')
  const contrastWithBlack = getContrastRatio(backgroundColor, '#000000')
  return contrastWithWhite > contrastWithBlack ? '#FFFFFF' : '#000000'
}

/**
 * Get the appropriate accent color for a given background from a theme
 * Returns accentForWhiteBg for light backgrounds, accentColor otherwise
 */
export function getAccentColorForBackground(
  theme: {
    accentColor: string
    accentForWhiteBg?: string
    backgroundColor?: string
  },
  background?: string
): string {
  const bg = background || theme.backgroundColor || '#ffffff'
  const isLightBackground = getRelativeLuminance(bg) > 0.5

  if (isLightBackground && theme.accentForWhiteBg) {
    return theme.accentForWhiteBg
  }
  return theme.accentColor
}
