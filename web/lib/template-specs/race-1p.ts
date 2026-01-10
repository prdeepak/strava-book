/**
 * Template Specification: Race_1p
 *
 * Single-page race layout with hero image, stats grid,
 * splits chart, best efforts, and comments.
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

/**
 * Layout variants for Race_1p
 *
 * IMPORTANT: All variants display ALL available data (photos, maps, stats, splits,
 * best efforts, comments). Variants differ only in visual presentation and emphasis.
 * This is our flagship template - maximize information density while varying layout.
 */
const variants: VariantGuideline[] = [
  {
    name: 'photo-hero',
    description: 'Large hero photo dominates top half; map thumbnail, stats, and data below',
    bestFor: [
      'Activities with stunning photos',
      'Scenic race locations',
      'Finish line or action shots',
    ],
    layoutDescription: {
      hero: 'Photo (large, 50% height)',
      secondary: 'Map (thumbnail), Stats row, Splits/Efforts/Comments columns',
    },
  },
  {
    name: 'map-hero',
    description: 'Large satellite map dominates top; photo thumbnail, stats, and data below',
    bestFor: [
      'Trail races with interesting routes',
      'Point-to-point courses',
      'Scenic GPS routes',
    ],
    layoutDescription: {
      hero: 'Satellite map (large, 50% height)',
      secondary: 'Photo (thumbnail), Stats row, Splits/Efforts/Comments columns',
    },
  },
  {
    name: 'dual-image',
    description: 'Photo and map side-by-side at top; balanced visual weight',
    bestFor: [
      'Activities with both great photos and interesting routes',
      'Destination races',
      'Visual storytelling',
    ],
    layoutDescription: {
      hero: 'Photo (left 50%) + Map (right 50%)',
      secondary: 'Stats row, Splits/Efforts/Comments columns',
    },
  },
  {
    name: 'stats-focus',
    description: 'Oversized stats dominate; photo and map as small accents',
    bestFor: [
      'PR-setting races',
      'Time trials and tempo runs',
      'Data-driven athletes',
    ],
    layoutDescription: {
      hero: 'Giant stats (distance, time, pace, elevation)',
      secondary: 'Photo (small inset), Map (small inset), Splits/Efforts prominent',
    },
  },
  {
    name: 'polyline-minimal',
    description: 'Artistic SVG route as hero; photo inset, clean dark aesthetic',
    bestFor: [
      'Interesting route shapes',
      'Minimalist design preference',
      'Clean, modern look',
    ],
    layoutDescription: {
      hero: 'SVG polyline (large, artistic rendering)',
      secondary: 'Photo (small inset), Stats row, Splits/Efforts/Comments columns',
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
