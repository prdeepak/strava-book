/**
 * Template Specification System
 *
 * Defines structured input/output specs for each template,
 * enabling the AI Designer to make informed layout choices.
 */

import { StravaActivity } from '@/lib/strava'

// ============================================================================
// Input Specification - What material is available to the template
// ============================================================================

export interface PhotoData {
  id: string
  url: string
  width: number
  height: number
  aspectRatio: 'landscape' | 'portrait' | 'square'
  caption?: string
  isPrimary?: boolean
}

export interface StatBlock {
  label: string
  value: string
  unit?: string
  icon?: string
  highlight?: boolean  // Should this stat be emphasized?
}

export interface PrebuiltGraphics {
  splitsChart?: string      // SVG string or data URL
  elevationProfile?: string
  routeMap?: string         // Mapbox static image URL
  paceHeatmap?: string
  calendarHeatmap?: string
}

export interface TextContent {
  title: string
  subtitle?: string
  description?: string
  narrative?: string        // AI-generated story text
  pullQuotes?: string[]     // Highlight phrases to feature
  location?: string
  date?: string
}

export interface TemplateInputSpec {
  templateId: string
  pageType: BookPageType

  // Available data sources
  availableInputs: {
    activity?: StravaActivity
    photos: PhotoData[]
    prebuiltGraphics: PrebuiltGraphics
    stats: StatBlock[]
    textContent: TextContent
  }
}

// ============================================================================
// Output Specification - Layout choices the AI can make
// ============================================================================

export type TitlePosition = 'top' | 'bottom' | 'center' | 'overlay' | 'left' | 'right'
export type Alignment = 'left' | 'center' | 'right'
export type PhotoTreatment = 'full-bleed' | 'inset' | 'grid' | 'collage' | 'hero'
export type BackgroundType = 'solid' | 'gradient' | 'photo-fade' | 'pattern'

export interface BackgroundSpec {
  type: BackgroundType
  color?: string
  gradientColors?: [string, string]
  gradientDirection?: 'horizontal' | 'vertical' | 'diagonal'
  photoIndex?: number       // Which photo to use as background
  opacity?: number          // 0-1, for photo backgrounds
  patternType?: string      // e.g., 'dots', 'lines', 'topographic'
}

export interface GeneratedGraphic {
  type: 'pattern' | 'decoration' | 'divider' | 'frame'
  svg: string
  position: 'background' | 'accent' | 'border' | 'corner'
}

export interface TemplateOutputSpec {
  templateId: string
  layoutVariant: string     // e.g., 'hero-left', 'title-top', 'stats-focus'

  options: {
    titlePosition: TitlePosition
    alignment: Alignment
    photoTreatment: PhotoTreatment
    showMap: boolean
    showChart: boolean
    emphasisStats: string[] // Which stat labels to highlight
  }

  background: BackgroundSpec

  // Which content to include (indices into input arrays)
  selectedPhotos: number[]
  selectedStats: string[]   // Stat labels to display

  // Optional AI-generated content
  generatedContent?: {
    narrative?: string
    graphics?: GeneratedGraphic[]
  }
}

// ============================================================================
// Layout Guidelines - Rules for the AI Designer
// ============================================================================

export interface VariantGuideline {
  name: string
  description: string
  bestFor: string[]         // Conditions when this variant works well
  avoid?: string[]          // Conditions when to avoid this variant (optional)
  photoRequirements?: {
    minCount?: number
    preferredAspect?: 'landscape' | 'portrait' | 'any'
    requiresHeroPhoto?: boolean
  }
  // Layout description for variants that use all available data
  layoutDescription?: {
    hero: string            // What element dominates (e.g., "Photo (large, 50% height)")
    secondary: string       // Supporting elements layout
  }
}

export interface TemplateGuidelines {
  templateId: string

  // When to choose this template
  selectionCriteria: string[]

  // Available layout variants with guidance
  variants: VariantGuideline[]

  // Content priorities (ordered by importance)
  contentPriority: string[]

  // Style constraints
  constraints: {
    maxPhotos: number
    minPhotos: number
    requiresMap: boolean
    requiresChart: boolean
    minTextLength?: number
    maxTextLength?: number
  }

  // Color scheme guidance
  colorGuidance?: {
    preferDarkBackground: boolean
    contrastRequirement: 'high' | 'medium' | 'low'
  }
}

// ============================================================================
// Complete Template Spec - Combines all three parts
// ============================================================================

export interface TemplateSpec {
  id: string
  name: string
  description: string
  pageType: BookPageType

  // Default input structure (what this template expects)
  inputSchema: {
    requiresActivity: boolean
    minPhotos: number
    maxPhotos: number
    requiredStats: string[]
    optionalStats: string[]
    requiredGraphics: (keyof PrebuiltGraphics)[]
    optionalGraphics: (keyof PrebuiltGraphics)[]
  }

  // Available output options
  outputOptions: {
    variants: string[]
    titlePositions: TitlePosition[]
    alignments: Alignment[]
    photoTreatments: PhotoTreatment[]
    backgroundTypes: BackgroundType[]
  }

  // AI guidance
  guidelines: TemplateGuidelines
}

// ============================================================================
// Book Page Types
// ============================================================================

export type BookPageType =
  | 'COVER'
  | 'TABLE_OF_CONTENTS'
  | 'FOREWORD'
  | 'YEAR_AT_A_GLANCE'
  | 'YEAR_STATS'
  | 'YEAR_CALENDAR'
  | 'MONTHLY_DIVIDER'
  | 'RACE_PAGE'
  | 'RACE_SPREAD'
  | 'ACTIVITY_LOG'
  | 'BEST_EFFORTS'
  | 'ROUTE_HEATMAP'
  | 'STATS_SUMMARY'
  | 'BACK_COVER'
