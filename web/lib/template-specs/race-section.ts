/**
 * Template Specification: Race Section
 *
 * Multi-page section for feature races. Pages are conditionally
 * rendered based on available content (photos, description, comments).
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

const variants: VariantGuideline[] = [
  {
    name: 'full',
    description: 'Dynamic page count based on content: hero, description, comments, stats/map, photos',
    bestFor: [
      'All races - content-aware page generation',
      'A-races with rich stories get more pages',
      'Minimal races still get hero + stats',
    ],
    avoid: [],
    photoRequirements: {
      minCount: 0,
      preferredAspect: 'any',
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
  description: 'Multi-page section for races with photos, narrative, stats, and community reactions. Pages rendered based on available content.',
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
    variants: ['full'],
    titlePositions: ['overlay', 'top', 'bottom'],
    alignments: ['left', 'center', 'right'],
    photoTreatments: ['full-bleed', 'hero', 'collage', 'grid'],
    backgroundTypes: ['solid', 'photo-fade', 'gradient'],
  },

  guidelines,
}
