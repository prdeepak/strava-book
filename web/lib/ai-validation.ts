/**
 * AI Output Validation
 *
 * Validates AI-generated design specs to ensure they are safe and valid
 * before being used for PDF generation.
 */

import { HEADING_FONTS, BODY_FONTS } from './theme-defaults'
import { getAllFontFamilies, getAllFontFamiliesWithVariants, fontHasItalic, getBodyFonts } from './font-registry'

// ============================================================================
// Safe Default Fonts
// ============================================================================

/**
 * Preferred fallback fonts (in order of preference)
 * BarlowCondensed is preferred because it has italic support
 * Helvetica is the ultimate fallback (built-in, always available)
 */
const PREFERRED_HEADING_FONT = 'BarlowCondensed'
const PREFERRED_BODY_FONT = 'BarlowCondensed'  // Has italic support
const BUILTIN_FALLBACK_FONT = 'Helvetica'  // Built-in, always works

/**
 * Get the best available fallback font
 * Prefers BarlowCondensed, falls back to Helvetica if not available
 */
function getFallbackFont(isBodyFont: boolean): string {
  const allFonts = getAllFontFamilies()
  const preferred = isBodyFont ? PREFERRED_BODY_FONT : PREFERRED_HEADING_FONT

  if (allFonts.includes(preferred)) {
    return preferred
  }
  return BUILTIN_FALLBACK_FONT
}

// Export for backward compatibility
export const DEFAULT_HEADING_FONT = PREFERRED_HEADING_FONT
export const DEFAULT_BODY_FONT = PREFERRED_BODY_FONT

/**
 * Normalize a font name - if unknown, return safe default
 * Fallback order: BarlowCondensed -> Helvetica
 */
export function normalizeFontName(font: string, isBodyFont: boolean = false): string {
  // Use variant-aware list to recognize built-in font variants like Helvetica-Bold
  const allFonts = getAllFontFamiliesWithVariants()

  // If font is valid (including variants like Helvetica-Bold), return it
  if (allFonts.includes(font)) {
    return font
  }

  // Try case-insensitive match
  const lowerFont = font.toLowerCase()
  const match = allFonts.find(f => f.toLowerCase() === lowerFont)
  if (match) {
    return match
  }

  // Try partial match (e.g., "Bebas Neue" -> "BebasNeue")
  const noSpaces = font.replace(/\s+/g, '')
  const partialMatch = allFonts.find(f => f.toLowerCase() === noSpaces.toLowerCase())
  if (partialMatch) {
    return partialMatch
  }

  // Return safe default (BarlowCondensed if available, else Helvetica)
  const fallback = getFallbackFont(isBodyFont)
  console.warn(`[ai-validation] Unknown font "${font}", falling back to ${fallback}`)
  return fallback
}

/**
 * Normalize fonts in a design spec - replace unknown fonts with safe defaults
 */
export function normalizeFonts(spec: DesignSpec): { spec: DesignSpec; replacements: string[] } {
  const replacements: string[] = []
  const allFonts = getAllFontFamilies()

  let headingFont = spec.theme.fontPairing.heading
  let bodyFont = spec.theme.fontPairing.body

  // Normalize heading font
  if (!allFonts.includes(headingFont)) {
    const normalized = normalizeFontName(headingFont, false)
    if (normalized !== headingFont) {
      replacements.push(`Heading font "${headingFont}" -> "${normalized}"`)
      headingFont = normalized
    }
  }

  // Normalize body font
  if (!allFonts.includes(bodyFont)) {
    const normalized = normalizeFontName(bodyFont, true)
    if (normalized !== bodyFont) {
      replacements.push(`Body font "${bodyFont}" -> "${normalized}"`)
      bodyFont = normalized
    }
  }

  // If body font is valid but doesn't have italic, suggest a better one
  // (but don't replace - fallbacks will handle it)
  if (allFonts.includes(bodyFont) && !fontHasItalic(bodyFont)) {
    const bodyFontsWithItalic = getBodyFonts()
    if (bodyFontsWithItalic.length > 0) {
      replacements.push(`Note: "${bodyFont}" lacks italic, will use normal variant as fallback`)
    }
  }

  return {
    spec: {
      ...spec,
      theme: {
        ...spec.theme,
        fontPairing: {
          heading: headingFont,
          body: bodyFont
        }
      }
    },
    replacements
  }
}

// ============================================================================
// Types
// ============================================================================

export interface DesignSpec {
  theme: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
    fontPairing: {
      heading: string
      body: string
    }
    motif?: string
    backgroundStyle?: 'solid' | 'gradient' | 'photo-fade' | 'pattern'
  }
  layout?: {
    coverStyle?: string
    headerStyle?: string
    pageMargins?: number
  }
  content?: {
    title?: string
    subtitle?: string
    athleteName?: string
    foreword?: string
    captions?: string[]
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitizedSpec?: DesignSpec
}

export interface ColorAccessibility {
  contrastRatio: number
  wcagAA: boolean       // >= 4.5:1 for normal text
  wcagAALarge: boolean  // >= 3:1 for large text
  wcagAAA: boolean      // >= 7:1 for enhanced
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate that a design spec has the required structure
 */
export function validateDesignSpec(spec: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!spec || typeof spec !== 'object') {
    return {
      valid: false,
      errors: ['Design spec must be an object'],
      warnings: []
    }
  }

  const s = spec as Record<string, unknown>

  // Check required theme object
  if (!s.theme || typeof s.theme !== 'object') {
    errors.push('Missing required "theme" object')
    return { valid: false, errors, warnings }
  }

  const theme = s.theme as Record<string, unknown>

  // Validate required theme properties
  const requiredThemeProps = ['primaryColor', 'accentColor', 'backgroundColor', 'fontPairing']
  for (const prop of requiredThemeProps) {
    if (!(prop in theme)) {
      errors.push(`Missing required theme property: ${prop}`)
    }
  }

  // Validate colors are strings
  const colorProps = ['primaryColor', 'accentColor', 'backgroundColor']
  for (const prop of colorProps) {
    if (prop in theme && typeof theme[prop] !== 'string') {
      errors.push(`Theme property "${prop}" must be a string`)
    }
  }

  // Validate fontPairing structure
  if (theme.fontPairing) {
    if (typeof theme.fontPairing !== 'object') {
      errors.push('fontPairing must be an object')
    } else {
      const fp = theme.fontPairing as Record<string, unknown>
      if (!fp.heading || typeof fp.heading !== 'string') {
        errors.push('fontPairing.heading is required and must be a string')
      }
      if (!fp.body || typeof fp.body !== 'string') {
        errors.push('fontPairing.body is required and must be a string')
      }
    }
  }

  // Validate backgroundStyle if present
  if (theme.backgroundStyle !== undefined) {
    const validStyles = ['solid', 'gradient', 'photo-fade', 'pattern']
    if (!validStyles.includes(theme.backgroundStyle as string)) {
      warnings.push(`Unknown backgroundStyle "${theme.backgroundStyle}", defaulting to "solid"`)
    }
  }

  // Validate optional layout object
  if (s.layout !== undefined) {
    if (typeof s.layout !== 'object') {
      errors.push('layout must be an object if provided')
    } else {
      const layout = s.layout as Record<string, unknown>
      if (layout.pageMargins !== undefined && typeof layout.pageMargins !== 'number') {
        warnings.push('layout.pageMargins should be a number')
      }
    }
  }

  // Validate optional content object
  if (s.content !== undefined) {
    if (typeof s.content !== 'object') {
      errors.push('content must be an object if provided')
    } else {
      const content = s.content as Record<string, unknown>
      const stringProps = ['title', 'subtitle', 'athleteName', 'foreword']
      for (const prop of stringProps) {
        if (content[prop] !== undefined && typeof content[prop] !== 'string') {
          warnings.push(`content.${prop} should be a string`)
        }
      }
      if (content.captions !== undefined && !Array.isArray(content.captions)) {
        warnings.push('content.captions should be an array')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// Font Validation
// ============================================================================

/**
 * All valid fonts for PDF generation
 * Sources from font-registry.ts for consistency
 */
export const VALID_FONTS = getAllFontFamilies()

export type ValidFont = string

/**
 * Validate that fonts are from the registered set
 * Note: Unknown fonts will be auto-replaced by normalizeFonts(), so we warn instead of error
 */
export function validateFonts(spec: DesignSpec): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const headingFont = spec.theme.fontPairing.heading
  const bodyFont = spec.theme.fontPairing.body

  // Check heading font is valid - warn only since normalizeFonts() will fix it
  if (!VALID_FONTS.includes(headingFont)) {
    warnings.push(`Unknown heading font "${headingFont}" will be replaced with "${DEFAULT_HEADING_FONT}"`)
  }

  // Check body font is valid - warn only since normalizeFonts() will fix it
  if (!VALID_FONTS.includes(bodyFont)) {
    warnings.push(`Unknown body font "${bodyFont}" will be replaced with "${DEFAULT_BODY_FONT}"`)
  }

  // Check body font has italic variant (templates use italic for descriptions)
  // Note: Fallbacks exist so this won't cause errors, but we warn for best results
  if (VALID_FONTS.includes(bodyFont) && !fontHasItalic(bodyFont)) {
    warnings.push(`Body font "${bodyFont}" does not have italic variant - normal variant will be used as fallback`)
  }

  // Warn if using same font for heading and body
  if (headingFont === bodyFont) {
    warnings.push('Using same font for heading and body may reduce visual hierarchy')
  }

  // Warn about handwritten fonts for body text
  const handwrittenFonts = ['IndieFlower', 'PatrickHand', 'PermanentMarker', 'HennyPenny', 'DancingScript', 'ShadowsIntoLight', 'Caveat']
  if (handwrittenFonts.includes(bodyFont)) {
    warnings.push(`Handwritten font "${bodyFont}" may be hard to read for body text`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// Color Validation & Accessibility
// ============================================================================

/**
 * Parse a hex color string to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  if (hex.length !== 6) {
    return null
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Calculate relative luminance of a color (WCAG formula)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors (WCAG formula)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) {
    return 0
  }

  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check color accessibility against WCAG guidelines
 */
export function checkColorAccessibility(foreground: string, background: string): ColorAccessibility {
  const ratio = getContrastRatio(foreground, background)

  return {
    contrastRatio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,      // Normal text
    wcagAALarge: ratio >= 3,   // Large text (18pt+ or 14pt bold)
    wcagAAA: ratio >= 7        // Enhanced contrast
  }
}

/**
 * Validate colors for accessibility
 */
export function validateColors(spec: DesignSpec): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const { primaryColor, accentColor, backgroundColor } = spec.theme

  // Validate hex format
  const hexPattern = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

  if (!hexPattern.test(primaryColor)) {
    errors.push(`Invalid primaryColor format "${primaryColor}". Use hex format like #FF5500`)
  }

  if (!hexPattern.test(accentColor)) {
    errors.push(`Invalid accentColor format "${accentColor}". Use hex format like #FF5500`)
  }

  if (!hexPattern.test(backgroundColor)) {
    errors.push(`Invalid backgroundColor format "${backgroundColor}". Use hex format like #FFFFFF`)
  }

  // If any color is invalid, can't do accessibility checks
  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  // Check primary color contrast against background
  const primaryAccess = checkColorAccessibility(primaryColor, backgroundColor)
  if (!primaryAccess.wcagAA) {
    if (primaryAccess.wcagAALarge) {
      warnings.push(`Primary color contrast (${primaryAccess.contrastRatio}:1) only meets WCAG AA for large text`)
    } else {
      errors.push(`Primary color contrast (${primaryAccess.contrastRatio}:1) fails WCAG AA (need 4.5:1 for normal text)`)
    }
  }

  // Check accent color contrast against background
  const accentAccess = checkColorAccessibility(accentColor, backgroundColor)
  if (!accentAccess.wcagAALarge) {
    warnings.push(`Accent color contrast (${accentAccess.contrastRatio}:1) may be too low for some uses`)
  }

  // Check if colors are too similar
  const primaryAccentRatio = getContrastRatio(primaryColor, accentColor)
  if (primaryAccentRatio < 2) {
    warnings.push(`Primary and accent colors are very similar (ratio ${primaryAccentRatio}:1), may lack distinction`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// Content/XSS Validation
// ============================================================================

/**
 * Dangerous patterns that could indicate XSS attempts
 */
const DANGEROUS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,  // onclick=, onload=, etc.
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<link\b/i,
  /<style\b/i,
  /expression\s*\(/i,
  /url\s*\(/i,
  /data:/i,
  /vbscript:/i,
]

/**
 * Sanitize a text string for safe use
 */
export function sanitizeText(text: string): string {
  // Remove null bytes
  text = text.replace(/\0/g, '')

  // Escape HTML entities
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

  return text
}

/**
 * Check if text contains potentially dangerous patterns
 */
export function containsDangerousPatterns(text: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * Validate content fields for XSS protection
 */
export function validateContent(spec: DesignSpec): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!spec.content) {
    return { valid: true, errors, warnings }
  }

  const { title, subtitle, athleteName, foreword, captions } = spec.content

  // Check each text field
  const textFields: [string, string | undefined][] = [
    ['title', title],
    ['subtitle', subtitle],
    ['athleteName', athleteName],
    ['foreword', foreword]
  ]

  for (const [fieldName, value] of textFields) {
    if (value !== undefined) {
      if (containsDangerousPatterns(value)) {
        errors.push(`Potentially dangerous content detected in ${fieldName}`)
      }

      // Check for excessive length
      if (value.length > 10000) {
        warnings.push(`${fieldName} is very long (${value.length} chars), may cause layout issues`)
      }
    }
  }

  // Check captions array
  if (captions) {
    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i]
      if (typeof caption === 'string') {
        if (containsDangerousPatterns(caption)) {
          errors.push(`Potentially dangerous content detected in caption[${i}]`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Run all validations on a design spec
 */
export function validateAll(spec: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Schema validation first
  const schemaResult = validateDesignSpec(spec)
  errors.push(...schemaResult.errors)
  warnings.push(...schemaResult.warnings)

  if (!schemaResult.valid) {
    return { valid: false, errors, warnings }
  }

  const typedSpec = spec as DesignSpec

  // Font validation
  const fontResult = validateFonts(typedSpec)
  errors.push(...fontResult.errors)
  warnings.push(...fontResult.warnings)

  // Color validation
  const colorResult = validateColors(typedSpec)
  errors.push(...colorResult.errors)
  warnings.push(...colorResult.warnings)

  // Content/XSS validation
  const contentResult = validateContent(typedSpec)
  errors.push(...contentResult.errors)
  warnings.push(...contentResult.warnings)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedSpec: errors.length === 0 ? sanitizeSpec(typedSpec) : undefined
  }
}

/**
 * Sanitize a spec by escaping potentially dangerous content and normalizing fonts
 */
export function sanitizeSpec(spec: DesignSpec): DesignSpec {
  // First normalize fonts (replace unknown fonts with safe defaults)
  const { spec: normalizedSpec, replacements } = normalizeFonts(spec)

  if (replacements.length > 0) {
    console.log('[ai-validation] Font normalizations applied:', replacements)
  }

  const sanitized: DesignSpec = {
    theme: {
      primaryColor: normalizedSpec.theme.primaryColor,
      accentColor: normalizedSpec.theme.accentColor,
      backgroundColor: normalizedSpec.theme.backgroundColor,
      fontPairing: {
        heading: normalizedSpec.theme.fontPairing.heading,
        body: normalizedSpec.theme.fontPairing.body
      },
      motif: normalizedSpec.theme.motif,
      backgroundStyle: normalizedSpec.theme.backgroundStyle
    }
  }

  if (normalizedSpec.layout) {
    sanitized.layout = { ...normalizedSpec.layout }
  }

  if (normalizedSpec.content) {
    sanitized.content = {}
    if (normalizedSpec.content.title) {
      sanitized.content.title = sanitizeText(normalizedSpec.content.title)
    }
    if (normalizedSpec.content.subtitle) {
      sanitized.content.subtitle = sanitizeText(normalizedSpec.content.subtitle)
    }
    if (normalizedSpec.content.athleteName) {
      sanitized.content.athleteName = sanitizeText(normalizedSpec.content.athleteName)
    }
    if (normalizedSpec.content.foreword) {
      sanitized.content.foreword = sanitizeText(normalizedSpec.content.foreword)
    }
    if (normalizedSpec.content.captions) {
      sanitized.content.captions = normalizedSpec.content.captions.map(c =>
        typeof c === 'string' ? sanitizeText(c) : c
      )
    }
  }

  return sanitized
}
