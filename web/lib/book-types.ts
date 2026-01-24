import { StravaActivity } from "./strava"
import { BookPageType } from "./curator"

// Re-export BookPageType for convenience
export type { BookPageType }

// === BOOK FORMAT (Square, print-ready) ===
export interface BookFormat {
  size: '8x8' | '10x10' | '12x12'
  dimensions: { width: number; height: number }  // in points (72pt = 1 inch)
  bleed: number          // 9pt = 0.125" standard bleed
  safeMargin: number     // keep text/important content inside this
  scaleFactor: number    // relative to 10x10 base design
}

export const FORMATS: Record<string, BookFormat> = {
  '8x8':   { size: '8x8', dimensions: { width: 576, height: 576 }, bleed: 9, safeMargin: 36, scaleFactor: 0.8 },
  '10x10': { size: '10x10', dimensions: { width: 720, height: 720 }, bleed: 9, safeMargin: 45, scaleFactor: 1.0 },  // BASE
  '12x12': { size: '12x12', dimensions: { width: 864, height: 864 }, bleed: 9, safeMargin: 54, scaleFactor: 1.2 },
}

// === BOOK CONFIG ===
export interface BookConfig {
  title: string
  subtitle?: string
  year: number
  dateRange: { start: Date; end: Date }
  athlete: { name: string; profileUrl?: string }
  format: BookFormat
  units: 'metric' | 'imperial'
  theme: BookTheme        // AI-generated or user-selected
  aRace?: StravaActivity  // Primary "goal race" for theming
}

// === TYPOGRAPHY SYSTEM ===
export type TypographyScaling = 'display' | 'heading' | 'body'

export interface TypographyDefinition {
  base: number              // Base size in points for 10x10 format
  min: number               // Minimum size (floor for scaling)
  scaling: TypographyScaling  // How aggressively to scale with format
  letterSpacing?: number    // Optional letter spacing
  lineHeight?: number       // Optional line height multiplier
}

export interface TypographyScale {
  displayLarge: TypographyDefinition   // Cover titles, big statements
  displaySmall: TypographyDefinition   // Section headers
  heading: TypographyDefinition        // Page titles
  subheading: TypographyDefinition     // Secondary titles
  body: TypographyDefinition           // Readable paragraphs
  caption: TypographyDefinition        // Photo labels, fine print
  stat: TypographyDefinition           // Big numbers on stats pages
}

export type TypographyRole = keyof TypographyScale

// Default typography scale (sizes for 10x10 reference format)
export const DEFAULT_TYPOGRAPHY: TypographyScale = {
  displayLarge: { base: 72, min: 48, scaling: 'display', letterSpacing: 2, lineHeight: 1.1 },
  displaySmall: { base: 48, min: 36, scaling: 'display', letterSpacing: 1 },
  heading: { base: 24, min: 18, scaling: 'heading' },
  subheading: { base: 18, min: 14, scaling: 'heading' },
  body: { base: 14, min: 12, scaling: 'body', lineHeight: 1.4 },
  caption: { base: 10, min: 8, scaling: 'body' },
  stat: { base: 32, min: 24, scaling: 'display' },
}

// === EFFECTS SYSTEM ===
export interface ThemeEffects {
  // For 'background' role photos (faded behind content)
  backgroundImageOpacity: number    // e.g., 0.5
  textOverlayOpacity: number        // Dark scrim for text readability, e.g., 0.3
  // Hero images use full opacity with no overlay
}

export const DEFAULT_EFFECTS: ThemeEffects = {
  backgroundImageOpacity: 0.5,
  textOverlayOpacity: 0.3,
}

// === CHART COLORS SYSTEM ===
export interface ChartColors {
  barFill: string       // Primary bar color (light blue default)
  barStroke: string     // Bar border/outline
  gridLine: string      // Horizontal/vertical grid lines
  axisLine: string      // Axis lines
  axisLabel: string     // Axis tick labels
  markerLine: string    // Progress marker lines (dashed)
  markerText: string    // Progress marker text (percentage, time)
  elevationFill: string // Elevation profile fill
  elevationStroke: string // Elevation profile line
}

export const DEFAULT_CHART_COLORS: ChartColors = {
  barFill: '#7ed3f7',      // Strava-style light blue
  barStroke: '#5bc0de',    // Slightly darker blue
  gridLine: '#e5e7eb',     // Light gray
  axisLine: '#9ca3af',     // Medium gray
  axisLabel: '#6b7280',    // Dark gray for readability
  markerLine: '#d1d5db',   // Light gray dashed lines
  markerText: '#374151',   // Dark gray text
  elevationFill: '#e5e7eb', // Light gray fill
  elevationStroke: '#9ca3af', // Medium gray stroke
}

// === SPACING SYSTEM ===
export interface SpacingScale {
  xs: number   // 8pt
  sm: number   // 16pt
  md: number   // 24pt
  lg: number   // 48pt
  xl: number   // 72pt
}

export const DEFAULT_SPACING: SpacingScale = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 48,
  xl: 72,
}

// === AI-GENERATED THEME ===
export interface BookTheme {
  primaryColor: string      // e.g., "#0D2240" (Boston blue)
  accentColor: string       // e.g., "#FFD200" (Boston yellow)
  // Adjusted accent color that meets WCAG contrast against white backgrounds
  // Falls back to accentColor if not provided
  accentForWhiteBg?: string
  // Background color to use when displaying text in the accent color
  // Ensures proper contrast for accent-colored text on stats pages
  accentBackground?: string
  backgroundColor: string
  fontPairing: {
    heading: string         // e.g., "Oswald"
    body: string            // e.g., "Source Sans Pro"
  }
  motif?: string            // e.g., "boston-marathon", "trail-running"
  backgroundStyle: 'solid' | 'gradient' | 'photo-fade' | 'pattern'

  // Optional overrides (fall back to defaults if not provided)
  typography?: Partial<TypographyScale>
  effects?: Partial<ThemeEffects>
  spacing?: Partial<SpacingScale>
  chartColors?: Partial<ChartColors>
}

// Default theme for when no theme is provided
export const DEFAULT_THEME: BookTheme = {
  primaryColor: '#1a1a1a',
  accentColor: '#ff6b35',
  backgroundColor: '#ffffff',
  fontPairing: {
    heading: 'Helvetica-Bold',
    body: 'Helvetica',
  },
  backgroundStyle: 'solid',
}

// === RACE-SPECIFIC THEME OVERLAY ===
export interface RaceTheme {
  raceId: number
  raceName: string
  heroImage?: string        // User's best photo from race
  backgroundImage?: string  // Official race photo or location imagery
  logoUrl?: string          // Official race logo
  logoPlacement?: 'top-left' | 'top-right' | 'bottom-center'
  accentColor?: string      // Override book accent for this race
  narrative?: string        // AI-written emotional caption
}

// === YEAR SUMMARY ===
export interface YearSummary {
  year: number
  totalDistance: number
  totalTime: number
  totalElevation: number
  activityCount: number
  longestActivity: StravaActivity
  fastestActivity: StravaActivity
  activeDays: Set<string>  // ISO date strings
  monthlyStats: MonthlyStats[]
  races: StravaActivity[]  // Activities with workout_type === 1
  aRace?: StravaActivity   // Auto-detected or user-selected primary race
}

// === MONTHLY STATISTICS ===
export interface MonthlyStats {
  month: number            // 0-11
  year: number
  activityCount: number
  totalDistance: number
  totalTime: number
  totalElevation: number
  activeDays: number
  activities: StravaActivity[]
}
