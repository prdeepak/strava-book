/**
 * Template Specification: Race_2p
 *
 * Two-page spread for feature races:
 * - Left page: Dark hero image with title overlay
 * - Right page: Map, stats, and details
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

const variants: VariantGuideline[] = [
  {
    name: 'hero-left-map-right',
    description: 'Dark hero photo on left, satellite map and stats on right',
    bestFor: [
      'A-races and major events',
      'Activities with dramatic finish photos',
      'Destination races',
    ],
    avoid: [
      'Activities without photos',
      'Indoor activities',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'portrait',
      requiresHeroPhoto: true,
    },
  },
  {
    name: 'map-left-stats-right',
    description: 'Large satellite map on left, detailed stats on right',
    bestFor: [
      'Trail races with scenic routes',
      'Ultra marathons',
      'Activities without good photos',
    ],
    avoid: [
      'Short urban races',
      'Treadmill activities',
    ],
    photoRequirements: {
      minCount: 0,
    },
  },
  {
    name: 'photo-collage-spread',
    description: 'Multiple photos across both pages with stats overlay',
    bestFor: [
      'Activities with many photos (5+)',
      'Multi-day events',
      'Scenic destination races',
    ],
    avoid: [
      'Activities with few photos',
      'Time-focused races',
    ],
    photoRequirements: {
      minCount: 3,
      preferredAspect: 'any',
    },
  },
  {
    name: 'narrative-spread',
    description: 'Story-focused layout with text and photos',
    bestFor: [
      'Activities with rich descriptions',
      'Personal milestone races',
      'First-time events (first marathon, etc.)',
    ],
    avoid: [
      'Activities without descriptions',
      'Routine training races',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'any',
    },
  },
]

const guidelines: TemplateGuidelines = {
  templateId: 'race_2p',

  selectionCriteria: [
    'A-race or highlighted activity',
    'Race with significant personal meaning',
    'Marathon, half-marathon, or ultra distance',
    'Activities with 3+ photos',
    'PR-setting races',
  ],

  variants,

  contentPriority: [
    'hero-photo',       // Dramatic visual impact
    'race-title',       // Event name prominently displayed
    'key-achievement',  // PR, finish time, placement
    'route-map',        // Visual of the course
    'detailed-stats',   // Full breakdown
    'narrative',        // Story of the race
  ],

  constraints: {
    maxPhotos: 6,
    minPhotos: 1,
    requiresMap: true,
    requiresChart: false,
    minTextLength: 0,
    maxTextLength: 1000,
  },

  colorGuidance: {
    preferDarkBackground: true,  // Left page uses dark overlay
    contrastRequirement: 'high',
  },
}

export const race2pSpec: TemplateSpec = {
  id: 'race_2p',
  name: 'Race Two-Page Spread',
  description: 'Premium two-page spread for A-races with hero imagery and detailed stats',
  pageType: 'RACE_SPREAD',

  inputSchema: {
    requiresActivity: true,
    minPhotos: 1,
    maxPhotos: 6,
    requiredStats: ['distance', 'moving_time', 'pace'],
    optionalStats: ['total_elevation_gain', 'calories', 'average_heartrate', 'max_heartrate', 'kudos_count'],
    requiredGraphics: ['routeMap'],
    optionalGraphics: ['splitsChart', 'elevationProfile'],
  },

  outputOptions: {
    variants: ['hero-left-map-right', 'map-left-stats-right', 'photo-collage-spread', 'narrative-spread'],
    titlePositions: ['overlay', 'top', 'bottom'],
    alignments: ['left', 'center', 'right'],
    photoTreatments: ['full-bleed', 'hero', 'collage'],
    backgroundTypes: ['solid', 'photo-fade', 'gradient'],
  },

  guidelines,
}
