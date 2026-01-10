/**
 * Template Specifications: Additional Templates
 *
 * Specs for ActivityLog, BackCover, Foreword, TableOfContents, and AIRace.
 */

import { TemplateSpec, TemplateGuidelines, VariantGuideline } from './types'

// ============================================================================
// Activity Log Template
// ============================================================================

const activityLogVariants: VariantGuideline[] = [
  {
    name: 'compact-table',
    description: 'Dense tabular layout with many activities per page',
    bestFor: [
      'High-volume months',
      'Training log summaries',
      'Data-focused athletes',
    ],
    avoid: [
      'Visually-focused books',
      'Sparse activity months',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'with-maps',
    description: 'Table rows include mini route maps',
    bestFor: [
      'Outdoor activities with GPS',
      'Route variety emphasis',
      'Trail runners and cyclists',
    ],
    avoid: [
      'Indoor activities',
      'Activities without GPS data',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'journal-style',
    description: 'More spacious layout with room for activity notes',
    bestFor: [
      'Athletes who title activities descriptively',
      'Fewer activities per month',
      'Narrative-focused books',
    ],
    avoid: [
      'High-volume training periods',
      'Generic activity titles',
    ],
    photoRequirements: { minCount: 0 },
  },
]

const activityLogGuidelines: TemplateGuidelines = {
  templateId: 'activity_log',
  selectionCriteria: [
    'Monthly or weekly activity summary',
    'Appendix section for complete activity list',
    'Training log pages',
  ],
  variants: activityLogVariants,
  contentPriority: [
    'date',
    'activity-name',
    'distance',
    'time',
    'pace',
    'mini-map',
  ],
  constraints: {
    maxPhotos: 0,
    minPhotos: 0,
    requiresMap: false,
    requiresChart: false,
    minTextLength: 0,
    maxTextLength: 0,
  },
}

export const activityLogSpec: TemplateSpec = {
  id: 'activity_log',
  name: 'Activity Log',
  description: 'Tabular list of activities with key stats and optional mini-maps',
  pageType: 'ACTIVITY_LOG',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 0,
    requiredStats: [],
    optionalStats: ['totalDistance', 'totalTime', 'activityCount'],
    requiredGraphics: [],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['compact-table', 'with-maps', 'journal-style'],
    titlePositions: ['top'],
    alignments: ['left'],
    photoTreatments: ['inset'],
    backgroundTypes: ['solid'],
  },

  guidelines: activityLogGuidelines,
}

// ============================================================================
// Back Cover Template
// ============================================================================

const backCoverVariants: VariantGuideline[] = [
  {
    name: 'stats-centered',
    description: 'Year summary stats prominently centered on dark background',
    bestFor: [
      'High-achievement years',
      'Impressive cumulative stats',
      'Bold, confident aesthetic',
    ],
    avoid: [
      'Low-activity years',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'minimal',
    description: 'Clean design with subtle stats and branding',
    bestFor: [
      'Elegant, understated books',
      'Professional presentation',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'branded',
    description: 'Prominent Strava Book branding with stats',
    bestFor: [
      'Gift books',
      'Showcasing the product',
    ],
    avoid: [
      'Athletes preferring subtle branding',
    ],
    photoRequirements: { minCount: 0 },
  },
]

const backCoverGuidelines: TemplateGuidelines = {
  templateId: 'back_cover',
  selectionCriteria: [
    'Last page of book',
    'Year-in-review summary',
  ],
  variants: backCoverVariants,
  contentPriority: [
    'year',
    'total-distance',
    'total-time',
    'total-elevation',
    'activity-count',
    'active-days',
    'branding',
  ],
  constraints: {
    maxPhotos: 0,
    minPhotos: 0,
    requiresMap: false,
    requiresChart: false,
  },
  colorGuidance: {
    preferDarkBackground: true,
    contrastRequirement: 'high',
  },
}

export const backCoverSpec: TemplateSpec = {
  id: 'back_cover',
  name: 'Back Cover',
  description: 'Year summary with total distance, time, elevation, and activity count',
  pageType: 'BACK_COVER',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 0,
    requiredStats: ['totalDistance', 'totalTime', 'activityCount'],
    optionalStats: ['totalElevation', 'activeDays'],
    requiredGraphics: [],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['stats-centered', 'minimal', 'branded'],
    titlePositions: ['center', 'top'],
    alignments: ['center'],
    photoTreatments: ['inset'],
    backgroundTypes: ['solid', 'gradient'],
  },

  guidelines: backCoverGuidelines,
}

// ============================================================================
// Foreword Template
// ============================================================================

const forewordVariants: VariantGuideline[] = [
  {
    name: 'centered-elegant',
    description: 'Centered text with decorative line separator',
    bestFor: [
      'Formal, elegant books',
      'Personal reflections',
      'AI-generated narratives',
    ],
    avoid: [],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'left-aligned',
    description: 'Traditional left-aligned text layout',
    bestFor: [
      'Longer forewords',
      'Multiple paragraphs',
      'Traditional book styling',
    ],
    avoid: [
      'Short quote-style content',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'pull-quote',
    description: 'Large quote-style text with emphasis',
    bestFor: [
      'Short, impactful statements',
      'Motivational content',
      'Opening dedication',
    ],
    avoid: [
      'Long-form text',
    ],
    photoRequirements: { minCount: 0 },
  },
]

const forewordGuidelines: TemplateGuidelines = {
  templateId: 'foreword',
  selectionCriteria: [
    'Introduction page after cover',
    'Personal dedication or reflection',
    'AI-generated year narrative',
  ],
  variants: forewordVariants,
  contentPriority: [
    'title',
    'body-text',
    'author',
  ],
  constraints: {
    maxPhotos: 0,
    minPhotos: 0,
    requiresMap: false,
    requiresChart: false,
    minTextLength: 50,
    maxTextLength: 2000,
  },
}

export const forewordSpec: TemplateSpec = {
  id: 'foreword',
  name: 'Foreword',
  description: 'Introduction page with title, body text, and optional author attribution',
  pageType: 'FOREWORD',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 0,
    requiredStats: [],
    optionalStats: [],
    requiredGraphics: [],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['centered-elegant', 'left-aligned', 'pull-quote'],
    titlePositions: ['top', 'center'],
    alignments: ['center', 'left'],
    photoTreatments: ['inset'],
    backgroundTypes: ['solid'],
  },

  guidelines: forewordGuidelines,
}

// ============================================================================
// Table of Contents Template
// ============================================================================

const tableOfContentsVariants: VariantGuideline[] = [
  {
    name: 'grouped-categories',
    description: 'Entries grouped by category with headers',
    bestFor: [
      'Books with diverse content types',
      'Multi-section books',
      'Organized navigation',
    ],
    avoid: [
      'Simple single-section books',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'simple-list',
    description: 'Flat list of entries without grouping',
    bestFor: [
      'Short books',
      'Minimal aesthetic',
      'Few distinct sections',
    ],
    avoid: [
      'Complex multi-section books',
    ],
    photoRequirements: { minCount: 0 },
  },
  {
    name: 'two-column',
    description: 'Two-column layout for many entries',
    bestFor: [
      'Long books with many entries',
      'Compact presentation',
    ],
    avoid: [
      'Short books',
      'Few entries',
    ],
    photoRequirements: { minCount: 0 },
  },
]

const tableOfContentsGuidelines: TemplateGuidelines = {
  templateId: 'table_of_contents',
  selectionCriteria: [
    'Navigation page after foreword',
    'Books with 5+ distinct sections',
  ],
  variants: tableOfContentsVariants,
  contentPriority: [
    'title',
    'category-headers',
    'entry-titles',
    'page-numbers',
  ],
  constraints: {
    maxPhotos: 0,
    minPhotos: 0,
    requiresMap: false,
    requiresChart: false,
  },
}

export const tableOfContentsSpec: TemplateSpec = {
  id: 'table_of_contents',
  name: 'Table of Contents',
  description: 'Navigation page with grouped entries and page numbers',
  pageType: 'TABLE_OF_CONTENTS',

  inputSchema: {
    requiresActivity: false,
    minPhotos: 0,
    maxPhotos: 0,
    requiredStats: [],
    optionalStats: [],
    requiredGraphics: [],
    optionalGraphics: [],
  },

  outputOptions: {
    variants: ['grouped-categories', 'simple-list', 'two-column'],
    titlePositions: ['top'],
    alignments: ['left', 'center'],
    photoTreatments: ['inset'],
    backgroundTypes: ['solid'],
  },

  guidelines: tableOfContentsGuidelines,
}

// ============================================================================
// AI Race Template
// ============================================================================

const aiRaceVariants: VariantGuideline[] = [
  {
    name: 'scrapbook',
    description: 'Creative collage with rotated photos and overlapping elements',
    bestFor: [
      'Activities with multiple photos',
      'Memorable races with social engagement',
      'Fun, casual aesthetic',
    ],
    avoid: [
      'Activities without photos',
      'Formal presentation style',
    ],
    photoRequirements: {
      minCount: 2,
      preferredAspect: 'any',
      requiresHeroPhoto: false,
    },
  },
  {
    name: 'editorial',
    description: 'Clean magazine-style layout with structured elements',
    bestFor: [
      'Professional presentation',
      'High-quality photos',
      'Important races',
    ],
    avoid: [
      'Casual activities',
    ],
    photoRequirements: {
      minCount: 1,
      preferredAspect: 'landscape',
      requiresHeroPhoto: true,
    },
  },
  {
    name: 'minimal',
    description: 'Typography-focused with subtle photo accents',
    bestFor: [
      'Activities with limited photos',
      'Strong narrative focus',
      'Clean, modern aesthetic',
    ],
    avoid: [
      'Photo-rich activities',
    ],
    photoRequirements: {
      minCount: 0,
      preferredAspect: 'any',
    },
  },
]

const aiRaceGuidelines: TemplateGuidelines = {
  templateId: 'ai_race',
  selectionCriteria: [
    'AI-designed race pages',
    'Activities benefiting from creative layouts',
    'Photos available for scrapbook treatment',
  ],
  variants: aiRaceVariants,
  contentPriority: [
    'activity-title',
    'photos',
    'narrative',
    'key-stats',
    'comments',
  ],
  constraints: {
    maxPhotos: 5,
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

export const aiRaceSpec: TemplateSpec = {
  id: 'ai_race',
  name: 'AI Race Page',
  description: 'AI-designed race page with flexible layout elements and creative typography',
  pageType: 'RACE_PAGE',

  inputSchema: {
    requiresActivity: true,
    minPhotos: 0,
    maxPhotos: 5,
    requiredStats: ['distance', 'moving_time', 'pace'],
    optionalStats: ['total_elevation_gain', 'average_heartrate', 'calories'],
    requiredGraphics: [],
    optionalGraphics: ['routeMap', 'elevationProfile'],
  },

  outputOptions: {
    variants: ['scrapbook', 'editorial', 'minimal'],
    titlePositions: ['top', 'center', 'overlay'],
    alignments: ['left', 'center', 'right'],
    photoTreatments: ['full-bleed', 'inset', 'grid', 'collage'],
    backgroundTypes: ['solid', 'gradient', 'photo-fade'],
  },

  guidelines: aiRaceGuidelines,
}
