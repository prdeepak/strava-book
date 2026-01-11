/**
 * Template Specification: Race Section
 *
 * Multi-page section for feature races. Each variant can span
 * as many pages as needed to display content appropriately.
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

const variants: VariantGuideline[] = [
  {
    name: 'compact',
    description: '2-page spread: hero photo + map/stats. Quick visual summary.',
    bestFor: [
      'Shorter races (5K, 10K)',
      'Activities with 1-2 photos',
      'When space is limited in the book',
    ],
    avoid: [
      'A-races with rich stories',
      'Activities with many photos or comments',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'portrait',
      requiresHeroPhoto: true,
    },
  },
  {
    name: 'standard',
    description: '4-page section: hero, stats/map, photos, splits/efforts',
    bestFor: [
      'Half marathons and marathons',
      'Activities with 3-5 photos',
      'Races with good split data',
    ],
    avoid: [
      'Activities without photos',
      'Short routine races',
    ],
    photoRequirements: {
      minCount: 2,
      preferredAspect: 'any',
    },
  },
  {
    name: 'full',
    description: '6+ page section: complete race story with all data',
    bestFor: [
      'A-races and major events (ultras, Comrades, etc.)',
      'Activities with rich descriptions',
      'Races with many photos (5+) and comments',
      'Personal milestone races',
    ],
    avoid: [
      'Routine training races',
      'Activities without meaningful content',
    ],
    photoRequirements: {
      minCount: 3,
      preferredAspect: 'any',
    },
  },
  {
    name: 'minimal',
    description: '2-page spread focused on map and stats, no hero photo',
    bestFor: [
      'Trail races with scenic routes',
      'Activities without good photos',
      'When the route is the story',
    ],
    avoid: [
      'Urban races',
      'Treadmill activities',
    ],
    photoRequirements: {
      minCount: 0,
    },
  },
]

const guidelines: TemplateGuidelines = {
  templateId: 'race_section',

  selectionCriteria: [
    'A-race or highlighted activity',
    'Race with significant personal meaning',
    'Marathon, half-marathon, or ultra distance',
    'Activities with 3+ photos',
    'PR-setting races',
  ],

  variants,

  contentPriority: [
    // Emotionally compelling first
    'description',       // The athlete's story
    'hero-photo',        // Dramatic visual impact
    'comments',          // Community support
    'kudos',             // Social validation
    // Then the race details
    'race-title',        // Event name
    'key-achievement',   // PR, finish time, placement
    'route-map',         // Visual of the course
    'all-photos',        // Photo gallery
    'detailed-stats',    // Full breakdown
    'elevation-profile', // Course elevation
    'splits',            // Per-km/mile breakdown
    'best-efforts',      // PRs for standard distances
    'gear',              // Shoes/equipment used
  ],

  constraints: {
    maxPhotos: 20,
    minPhotos: 0,
    requiresMap: true,
    requiresChart: false,
    minTextLength: 0,
    maxTextLength: 5000,
  },

  colorGuidance: {
    preferDarkBackground: true,
    contrastRequirement: 'high',
  },
}

export const raceSectionSpec: TemplateSpec = {
  id: 'race_section',
  name: 'Race Section',
  description: 'Multi-page section for A-races with photos, narrative, stats, and community reactions',
  pageType: 'RACE_SPREAD',

  inputSchema: {
    requiresActivity: true,
    minPhotos: 0,
    maxPhotos: 20,
    requiredStats: ['distance', 'moving_time', 'pace'],
    optionalStats: [
      'total_elevation_gain',
      'calories',
      'average_heartrate',
      'max_heartrate',
      'kudos_count',
      'comment_count',
      'suffer_score',
      'average_cadence',
      'average_watts',
    ],
    requiredGraphics: ['routeMap'],
    optionalGraphics: ['splitsChart', 'elevationProfile', 'paceHeatmap'],
  },

  outputOptions: {
    variants: ['compact', 'standard', 'full', 'minimal'],
    titlePositions: ['overlay', 'top', 'bottom'],
    alignments: ['left', 'center', 'right'],
    photoTreatments: ['full-bleed', 'hero', 'collage', 'grid'],
    backgroundTypes: ['solid', 'photo-fade', 'gradient'],
  },

  guidelines,
}
