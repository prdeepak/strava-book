import { StravaActivity } from "./strava"

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

// === AI-GENERATED THEME ===
export interface BookTheme {
  primaryColor: string      // e.g., "#0D2240" (Boston blue)
  accentColor: string       // e.g., "#FFD200" (Boston yellow)
  backgroundColor: string
  fontPairing: {
    heading: string         // e.g., "Oswald"
    body: string            // e.g., "Source Sans Pro"
  }
  motif?: string            // e.g., "boston-marathon", "trail-running"
  backgroundStyle: 'solid' | 'gradient' | 'photo-fade' | 'pattern'
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
