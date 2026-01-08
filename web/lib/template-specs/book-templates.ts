/**
 * Template Specifications: Book-Level Templates
 *
 * Specs for Cover, YearStats, MonthlyDivider, and other book structure pages.
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

// ============================================================================
// Cover Template
// ============================================================================

const coverVariants: VariantGuideline[] = [
  {
    name: 'photo-hero',
    description: 'Full-bleed hero photo with title overlay',
    bestFor: [
      'Years with dramatic A-race photos',
      'Scenic destination events',
    ],
    avoid: [
      'Years without quality photos',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'portrait',
      requiresHeroPhoto: true,
    },
  },
  {
    name: 'gradient-minimal',
    description: 'Clean gradient background with typography focus',
    bestFor: [
      'Clean, modern aesthetic',
      'Years without standout photos',
    ],
    avoid: [],
    photoRequirements: {
      minCount: 0,
    },
  },
  {
    name: 'photo-grid',
    description: 'Grid of highlight photos behind title',
    bestFor: [
      'Years with many diverse activities',
      'Multi-sport years',
    ],
    avoid: [
      'Years with few photos',
    ],
    photoRequirements: {
      minCount: 4,
      preferredAspect: 'any',
    },
  },
]

export const coverSpec: TemplateSpec = {
  id: 'cover',
  name: 'Book Cover',
  description: 'Title page with year, athlete name, and hero imagery',
  pageType: 'COVER',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 9,
    requiredStats: [],
    optionalStats: ['totalDistance', 'activityCount'],
    requiredGraphics: [],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['photo-hero', 'gradient-minimal', 'photo-grid'],
    titlePositions: ['center', 'bottom', 'top'],
    alignments: ['center', 'left'],
    photoTreatments: ['full-bleed', 'grid', 'collage'],
    backgroundTypes: ['photo-fade', 'gradient', 'solid'],
  },

  guidelines: {
    templateId: 'cover',
    selectionCriteria: ['First page of book'],
    variants: coverVariants,
    contentPriority: ['title', 'year', 'athlete-name', 'hero-photo'],
    constraints: {
      maxPhotos: 9,
      minPhotos: 0,
      requiresMap: false,
      requiresChart: false,
    },
    colorGuidance: {
      preferDarkBackground: true,
      contrastRequirement: 'high',
    },
  },
}

// ============================================================================
// Year Stats Template
// ============================================================================

const yearStatsVariants: VariantGuideline[] = [
  {
    name: 'stats-grid',
    description: 'Clean grid of key metrics',
    bestFor: [
      'Data-focused athletes',
      'High-volume training years',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'infographic',
    description: 'Visual infographic with icons and charts',
    bestFor: [
      'Visual learners',
      'Years with interesting trends',
    ],
    avoid: [
      'Low-activity years',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'comparison',
    description: 'Year-over-year comparison layout',
    bestFor: [
      'Athletes tracking progress',
      'Comeback years',
    ],
    avoid: [
      'First year of tracking',
    ],
    photoRequirements: { minCount: 0 },
  },
]

export const yearStatsSpec: TemplateSpec = {
  id: 'year_stats',
  name: 'Year Statistics',
  description: 'Annual summary with total distance, time, elevation, and activity breakdown',
  pageType: 'YEAR_STATS',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 0,
    requiredStats: ['totalDistance', 'totalTime', 'activityCount'],
    optionalStats: ['totalElevation', 'longestActivity', 'fastestActivity', 'activeDays'],
    requiredGraphics: [],
    optionalGraphics: ['calendarHeatmap'],
  },

  outputOptions: {
    variants: ['stats-grid', 'infographic', 'comparison'],
    titlePositions: ['top'],
    alignments: ['center', 'left'],
    photoTreatments: ['inset'],
    backgroundTypes: ['solid', 'gradient'],
  },

  guidelines: {
    templateId: 'year_stats',
    selectionCriteria: ['Year summary section'],
    variants: yearStatsVariants,
    contentPriority: ['total-distance', 'total-time', 'activity-count', 'elevation', 'highlights'],
    constraints: {
      maxPhotos: 0,
      minPhotos: 0,
      requiresMap: false,
      requiresChart: true,
    },
  },
}

// ============================================================================
// Monthly Divider Template
// ============================================================================

const monthlyDividerVariants: VariantGuideline[] = [
  {
    name: 'minimal',
    description: 'Clean month name with subtle stats',
    bestFor: [
      'Consistent aesthetic',
      'Fast page turns',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'photo-accent',
    description: 'Month name with small photo from that month',
    bestFor: [
      'Months with memorable activities',
      'Seasonal variety',
    ],
    avoid: [
      'Low-activity months',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'landscape',
    },
  },
  {
    name: 'stats-preview',
    description: 'Month name with preview of key stats',
    bestFor: [
      'High-volume months',
      'Months with races',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
]

export const monthlyDividerSpec: TemplateSpec = {
  id: 'monthly_divider',
  name: 'Monthly Divider',
  description: 'Section divider for each month with optional photo and stats preview',
  pageType: 'MONTHLY_DIVIDER',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 1,
    requiredStats: [],
    optionalStats: ['monthlyDistance', 'monthlyActivities'],
    requiredGraphics: [],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['minimal', 'photo-accent', 'stats-preview'],
    titlePositions: ['center', 'left'],
    alignments: ['center', 'left'],
    photoTreatments: ['inset', 'full-bleed'],
    backgroundTypes: ['solid', 'gradient'],
  },

  guidelines: {
    templateId: 'monthly_divider',
    selectionCriteria: ['Start of each month section'],
    variants: monthlyDividerVariants,
    contentPriority: ['month-name', 'year', 'preview-stats'],
    constraints: {
      maxPhotos: 1,
      minPhotos: 0,
      requiresMap: false,
      requiresChart: false,
    },
  },
}

// ============================================================================
// Year Calendar (Heatmap) Template
// ============================================================================

const yearCalendarVariants: VariantGuideline[] = [
  {
    name: 'github-style',
    description: 'GitHub-style contribution heatmap',
    bestFor: [
      'Showing consistency',
      'High-frequency training',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'monthly-bars',
    description: 'Bar chart by month',
    bestFor: [
      'Showing seasonal patterns',
      'Training periodization',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
]

export const yearCalendarSpec: TemplateSpec = {
  id: 'year_calendar',
  name: 'Year Calendar Heatmap',
  description: 'GitHub-style activity heatmap showing training consistency',
  pageType: 'YEAR_CALENDAR',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 0,
    requiredStats: ['activeDays'],
    optionalStats: [],
    requiredGraphics: ['calendarHeatmap'],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['github-style', 'monthly-bars'],
    titlePositions: ['top'],
    alignments: ['center'],
    photoTreatments: ['inset'],
    backgroundTypes: ['solid'],
  },

  guidelines: {
    templateId: 'year_calendar',
    selectionCriteria: ['Year summary section'],
    variants: yearCalendarVariants,
    contentPriority: ['heatmap', 'legend', 'total-days'],
    constraints: {
      maxPhotos: 0,
      minPhotos: 0,
      requiresMap: false,
      requiresChart: true,
    },
  },
}
