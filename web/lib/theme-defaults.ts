import { BookTheme } from './book-types'

/**
 * Default themes for different sport types
 */

export const RUNNING_THEME: BookTheme = {
  primaryColor: '#0D2240',      // Deep navy blue
  accentColor: '#FFD700',        // Gold
  backgroundColor: '#FFFFFF',
  fontPairing: {
    heading: 'Oswald',
    body: 'Source Sans Pro',
  },
  motif: 'running-classic',
  backgroundStyle: 'solid',
}

export const CYCLING_THEME: BookTheme = {
  primaryColor: '#005EB8',       // Cycling blue
  accentColor: '#00B140',        // Bright green
  backgroundColor: '#FFFFFF',
  fontPairing: {
    heading: 'Montserrat',
    body: 'Open Sans',
  },
  motif: 'cycling-modern',
  backgroundStyle: 'solid',
}

export const TRIATHLON_THEME: BookTheme = {
  primaryColor: '#E31C23',       // Red
  accentColor: '#0055A4',        // Blue
  backgroundColor: '#FFFFFF',
  fontPairing: {
    heading: 'Bebas Neue',
    body: 'Roboto',
  },
  motif: 'triathlon-bold',
  backgroundStyle: 'gradient',
}

export const TRAIL_RUNNING_THEME: BookTheme = {
  primaryColor: '#2E5F3A',       // Forest green
  accentColor: '#D4AF37',        // Earth gold
  backgroundColor: '#FEFEFE',
  fontPairing: {
    heading: 'Playfair Display',
    body: 'Merriweather',
  },
  motif: 'trail-natural',
  backgroundStyle: 'photo-fade',
}

export const MINIMAL_THEME: BookTheme = {
  primaryColor: '#1A1A1A',       // Almost black
  accentColor: '#666666',        // Medium gray
  backgroundColor: '#FFFFFF',
  fontPairing: {
    heading: 'Archivo Black',
    body: 'Lato',
  },
  motif: 'minimal-mono',
  backgroundStyle: 'solid',
}

export const BOLD_THEME: BookTheme = {
  primaryColor: '#FF4500',       // Orange red
  accentColor: '#FFD700',        // Gold
  backgroundColor: '#FFFFFF',
  fontPairing: {
    heading: 'Anton',
    body: 'PT Sans',
  },
  motif: 'bold-energetic',
  backgroundStyle: 'gradient',
}

/**
 * Get default theme by sport type or style
 */
export function getDefaultTheme(
  type: 'running' | 'cycling' | 'triathlon' | 'trail' | 'minimal' | 'bold' = 'running'
): BookTheme {
  switch (type) {
    case 'running':
      return RUNNING_THEME
    case 'cycling':
      return CYCLING_THEME
    case 'triathlon':
      return TRIATHLON_THEME
    case 'trail':
      return TRAIL_RUNNING_THEME
    case 'minimal':
      return MINIMAL_THEME
    case 'bold':
      return BOLD_THEME
    default:
      return RUNNING_THEME
  }
}

/**
 * Get all available default themes
 */
export function getAllDefaultThemes(): Record<string, BookTheme> {
  return {
    running: RUNNING_THEME,
    cycling: CYCLING_THEME,
    triathlon: TRIATHLON_THEME,
    trail: TRAIL_RUNNING_THEME,
    minimal: MINIMAL_THEME,
    bold: BOLD_THEME,
  }
}

/**
 * Available fonts for headings
 */
export const HEADING_FONTS = [
  'Oswald',
  'Playfair Display',
  'Montserrat',
  'Bebas Neue',
  'Anton',
  'Archivo Black',
] as const

/**
 * Available fonts for body text
 */
export const BODY_FONTS = [
  'Source Sans Pro',
  'Open Sans',
  'Roboto',
  'Lato',
  'Merriweather',
  'PT Sans',
] as const

/**
 * Validate if a font is available
 */
export function isValidHeadingFont(font: string): boolean {
  return (HEADING_FONTS as readonly string[]).includes(font)
}

export function isValidBodyFont(font: string): boolean {
  return (BODY_FONTS as readonly string[]).includes(font)
}

/**
 * Get a random theme (useful for testing)
 */
export function getRandomTheme(): BookTheme {
  const themes = getAllDefaultThemes()
  const keys = Object.keys(themes)
  const randomKey = keys[Math.floor(Math.random() * keys.length)]
  return themes[randomKey]
}
