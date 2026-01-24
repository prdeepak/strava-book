/**
 * Typography Resolution System
 *
 * Resolves typography definitions from BookTheme to concrete values
 * based on the target BookFormat. Handles scaling for different page sizes.
 */

import {
  BookFormat,
  BookTheme,
  TypographyRole,
  TypographyDefinition,
  TypographyScaling,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_EFFECTS,
  DEFAULT_SPACING,
  DEFAULT_CHART_COLORS,
  ThemeEffects,
  SpacingScale,
  ChartColors,
} from './book-types'

// Reference size for 10x10 format (720pt = 10 inches at 72dpi)
const REFERENCE_SIZE = 720

// === SCALE FACTOR COMPUTATION ===

export interface ScaleFactors {
  width: number       // format.width / REFERENCE_SIZE
  height: number      // format.height / REFERENCE_SIZE
  min: number         // Math.min(width, height) - constraining dimension
  area: number        // sqrt(width * height / REFERENCE_SIZE^2)
}

/**
 * Compute scale factors from format dimensions.
 * Enables proper scaling for non-square formats in the future.
 */
export function getScaleFactors(format: BookFormat): ScaleFactors {
  const { width, height } = format.dimensions
  return {
    width: width / REFERENCE_SIZE,
    height: height / REFERENCE_SIZE,
    min: Math.min(width, height) / REFERENCE_SIZE,
    area: Math.sqrt((width * height) / (REFERENCE_SIZE * REFERENCE_SIZE)),
  }
}

/**
 * Get the appropriate scale multiplier based on scaling behavior.
 * - display: scales linearly with min dimension (maintains visual proportion)
 * - heading: scales moderately (balance of proportion and readability)
 * - body: scales minimally (readability trumps proportion)
 */
function getScaleMultiplier(scaling: TypographyScaling, scales: ScaleFactors): number {
  switch (scaling) {
    case 'display':
      // Linear scaling with constraining dimension
      return scales.min
    case 'heading':
      // Moderate scaling: 85% fixed + 15% scaled
      return 0.85 + 0.15 * scales.min
    case 'body':
      // Minimal scaling: 95% fixed + 5% scaled (prioritize readability)
      return 0.95 + 0.05 * scales.min
    default:
      return scales.min
  }
}

// === TYPOGRAPHY RESOLUTION ===

export interface ResolvedTypography {
  fontSize: number
  minFontSize: number
  fontFamily: string
  letterSpacing?: number
  lineHeight?: number
}

/**
 * Resolve a typography role to concrete values for rendering.
 *
 * @param role - The typography role (e.g., 'displayLarge', 'body')
 * @param theme - The BookTheme containing typography definitions
 * @param format - The BookFormat for scaling
 * @returns Resolved typography values ready for use in components
 */
export function resolveTypography(
  role: TypographyRole,
  theme: BookTheme,
  format: BookFormat
): ResolvedTypography {
  // Get definition from theme or fall back to default
  const def: TypographyDefinition = theme.typography?.[role] ?? DEFAULT_TYPOGRAPHY[role]
  const scales = getScaleFactors(format)
  const multiplier = getScaleMultiplier(def.scaling, scales)

  // Determine font family based on role
  const isDisplayOrHeading = role === 'displayLarge' || role === 'displaySmall' ||
                             role === 'heading' || role === 'stat'
  const fontFamily = isDisplayOrHeading
    ? theme.fontPairing.heading
    : theme.fontPairing.body

  return {
    fontSize: Math.max(def.min, Math.round(def.base * multiplier)),
    minFontSize: def.min,
    fontFamily,
    letterSpacing: def.letterSpacing,
    lineHeight: def.lineHeight,
  }
}

/**
 * Resolve all typography roles at once.
 * Useful when a component needs multiple text styles.
 */
export function resolveAllTypography(
  theme: BookTheme,
  format: BookFormat
): Record<TypographyRole, ResolvedTypography> {
  const roles: TypographyRole[] = [
    'displayLarge', 'displaySmall', 'heading', 'subheading', 'body', 'caption', 'stat'
  ]

  return roles.reduce((acc, role) => {
    acc[role] = resolveTypography(role, theme, format)
    return acc
  }, {} as Record<TypographyRole, ResolvedTypography>)
}

// === EFFECTS RESOLUTION ===

/**
 * Get resolved effects, merging theme overrides with defaults.
 */
export function resolveEffects(theme: BookTheme): ThemeEffects {
  return {
    ...DEFAULT_EFFECTS,
    ...theme.effects,
  }
}

// === SPACING RESOLUTION ===

/**
 * Get resolved spacing, scaled for the format.
 */
export function resolveSpacing(theme: BookTheme, format: BookFormat): SpacingScale {
  const baseSpacing = { ...DEFAULT_SPACING, ...theme.spacing }
  const scale = format.scaleFactor

  return {
    xs: Math.round(baseSpacing.xs * scale),
    sm: Math.round(baseSpacing.sm * scale),
    md: Math.round(baseSpacing.md * scale),
    lg: Math.round(baseSpacing.lg * scale),
    xl: Math.round(baseSpacing.xl * scale),
  }
}

// === CHART COLORS RESOLUTION ===

/**
 * Get resolved chart colors, merging theme overrides with defaults.
 */
export function resolveChartColors(theme: BookTheme): ChartColors {
  return {
    ...DEFAULT_CHART_COLORS,
    ...theme.chartColors,
  }
}
