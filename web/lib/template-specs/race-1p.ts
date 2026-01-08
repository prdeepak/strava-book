/**
 * Template Specification: Race_1p
 *
 * Single-page race layout with hero image, stats grid,
 * splits chart, best efforts, and comments.
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

// Layout variants for Race_1p
const variants: VariantGuideline[] = [
  {
    name: 'photo-hero',
    description: 'Large hero photo with stats below',
    bestFor: [
      'Activities with high-quality photos',
      'Scenic race locations',
      'Finish line photos',
    ],
    avoid: [
      'Indoor activities',
      'Activities without photos',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'landscape',
      requiresHeroPhoto: true,
    },
  },
  {
    name: 'map-hero',
    description: 'Satellite map as hero with route overlay',
    bestFor: [
      'Trail races with interesting routes',
      'Point-to-point courses',
      'Activities without good photos',
    ],
    avoid: [
      'Indoor activities',
      'Treadmill runs',
    ],
    photoRequirements: {
      minCount: 0,
    },
  },
  {
    name: 'dual-image',
    description: 'Side-by-side photo and map',
    bestFor: [
      'Activities with both good photos and interesting routes',
      'Destination races',
    ],
    avoid: [
      'Activities without photos',
      'Short or simple routes',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'any',
    },
  },
  {
    name: 'stats-focus',
    description: 'Minimal visuals, emphasis on data and splits',
    bestFor: [
      'PR-setting races',
      'Time trial activities',
      'Activities with detailed splits',
    ],
    avoid: [
      'Casual activities',
      'Activities without timing data',
    ],
    photoRequirements: {
      minCount: 0,
    },
  },
  {
    name: 'polyline-minimal',
    description: 'SVG route on dark background (no photos/map)',
    bestFor: [
      'Activities without photos or map token',
      'Simple, clean aesthetic',
    ],
    avoid: [
      'Indoor activities without GPS',
      'Very short activities',
    ],
    photoRequirements: {
      minCount: 0,
    },
  },
]

const guidelines: TemplateGuidelines = {
  templateId: 'race_1p',

  selectionCriteria: [
    'Race activities (workout_type === 1)',
    'Activities with significant distance (> 5km)',
    'Activities with photos or interesting routes',
    'Single-page summary needed',
  ],

  variants,

  contentPriority: [
    'hero-image',      // Photo or map at top
    'key-stats',       // Distance, time, pace, elevation
    'splits-chart',    // Visual pace breakdown
    'best-efforts',    // PRs and achievements
    'comments',        // Social engagement
  ],

  constraints: {
    maxPhotos: 2,
    minPhotos: 0,
    requiresMap: false,
    requiresChart: false,
    minTextLength: 0,
    maxTextLength: 500,
  },

  colorGuidance: {
    preferDarkBackground: false,
    contrastRequirement: 'high',
  },
}

export const race1pSpec: TemplateSpec = {
  id: 'race_1p',
  name: 'Race Single Page',
  description: 'Single-page race layout with hero image, stats, splits, and social engagement',
  pageType: 'RACE_PAGE',

  inputSchema: {
    requiresActivity: true,
    minPhotos: 0,
    maxPhotos: 2,
    requiredStats: ['distance', 'moving_time', 'pace'],
    optionalStats: ['total_elevation_gain', 'calories', 'average_heartrate', 'max_heartrate'],
    requiredGraphics: [],
    optionalGraphics: ['splitsChart', 'routeMap', 'elevationProfile'],
  },

  outputOptions: {
    variants: ['photo-hero', 'map-hero', 'dual-image', 'stats-focus', 'polyline-minimal'],
    titlePositions: ['top'],
    alignments: ['left', 'center'],
    photoTreatments: ['full-bleed', 'inset', 'grid'],
    backgroundTypes: ['solid'],
  },

  guidelines,
}
