/**
 * Template Registry
 *
 * Central registry mapping template IDs to their specifications.
 * Used by the Designer Agent to understand available templates
 * and make informed layout decisions.
 */

import { TemplateSpec, BookPageType } from './types'
import { race1pSpec } from './race-1p'
import { race2pSpec } from './race-2p'
import { coverSpec, yearStatsSpec, monthlyDividerSpec, yearCalendarSpec } from './book-templates'
import {
  activityLogSpec,
  backCoverSpec,
  forewordSpec,
  tableOfContentsSpec,
  aiRaceSpec,
  race1pScrapbookSpec,
} from './additional-templates'

// All registered template specs
const templateSpecs: Map<string, TemplateSpec> = new Map([
  ['race_1p', race1pSpec],
  ['race_2p', race2pSpec],
  ['race_1p_scrapbook', race1pScrapbookSpec],
  ['cover', coverSpec],
  ['year_stats', yearStatsSpec],
  ['monthly_divider', monthlyDividerSpec],
  ['year_calendar', yearCalendarSpec],
  ['activity_log', activityLogSpec],
  ['back_cover', backCoverSpec],
  ['foreword', forewordSpec],
  ['table_of_contents', tableOfContentsSpec],
  ['ai_race', aiRaceSpec],
])

/**
 * Get a template spec by ID
 */
export function getTemplateSpec(templateId: string): TemplateSpec | undefined {
  return templateSpecs.get(templateId)
}

/**
 * Get all registered template specs
 */
export function getAllTemplateSpecs(): TemplateSpec[] {
  return Array.from(templateSpecs.values())
}

/**
 * Get templates by page type
 */
export function getTemplatesByPageType(pageType: BookPageType): TemplateSpec[] {
  return Array.from(templateSpecs.values()).filter(spec => spec.pageType === pageType)
}

/**
 * Get template IDs for a given page type
 */
export function getTemplateIdsForPageType(pageType: BookPageType): string[] {
  return getTemplatesByPageType(pageType).map(spec => spec.id)
}

/**
 * Check if a template ID is registered
 */
export function isValidTemplateId(templateId: string): boolean {
  return templateSpecs.has(templateId)
}

/**
 * Get the default template for a page type
 */
export function getDefaultTemplateForPageType(pageType: BookPageType): TemplateSpec | undefined {
  const templates = getTemplatesByPageType(pageType)
  return templates[0] // First registered template is the default
}

/**
 * Template selection helper - suggests the best template based on activity data
 */
export function suggestTemplate(
  pageType: BookPageType,
  context: {
    hasPhotos: boolean
    photoCount: number
    isRace: boolean
    isHighlight: boolean
    hasDetailedSplits: boolean
    distance: number
  }
): string {
  const templates = getTemplatesByPageType(pageType)

  if (pageType === 'RACE_PAGE' || pageType === 'RACE_SPREAD') {
    // For races, choose between 1p and 2p based on importance
    if (context.isHighlight || context.distance > 21097) { // Half marathon+
      return 'race_2p'
    }
    return 'race_1p'
  }

  // Default to first template for the page type
  return templates[0]?.id || 'race_1p'
}

/**
 * Validate that a TemplateOutputSpec matches the template's allowed options
 */
export function validateOutputSpec(
  templateId: string,
  outputSpec: {
    layoutVariant: string
    options: {
      titlePosition: string
      alignment: string
      photoTreatment: string
    }
    background: {
      type: string
    }
  }
): { valid: boolean; errors: string[] } {
  const spec = getTemplateSpec(templateId)
  if (!spec) {
    return { valid: false, errors: [`Unknown template: ${templateId}`] }
  }

  const errors: string[] = []

  if (!spec.outputOptions.variants.includes(outputSpec.layoutVariant)) {
    errors.push(`Invalid variant: ${outputSpec.layoutVariant}. Valid: ${spec.outputOptions.variants.join(', ')}`)
  }

  if (!spec.outputOptions.titlePositions.includes(outputSpec.options.titlePosition as never)) {
    errors.push(`Invalid title position: ${outputSpec.options.titlePosition}`)
  }

  if (!spec.outputOptions.alignments.includes(outputSpec.options.alignment as never)) {
    errors.push(`Invalid alignment: ${outputSpec.options.alignment}`)
  }

  if (!spec.outputOptions.photoTreatments.includes(outputSpec.options.photoTreatment as never)) {
    errors.push(`Invalid photo treatment: ${outputSpec.options.photoTreatment}`)
  }

  if (!spec.outputOptions.backgroundTypes.includes(outputSpec.background.type as never)) {
    errors.push(`Invalid background type: ${outputSpec.background.type}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Get templates designed for single-activity pages (race pages, etc.)
 * These are suitable for the "Generate PDF pages" dropdown
 */
export function getSingleActivityTemplates(): { id: string; name: string; description: string }[] {
  const singleActivityPageTypes: BookPageType[] = ['RACE_PAGE', 'RACE_SPREAD']

  return Array.from(templateSpecs.entries())
    .filter(([, spec]) => singleActivityPageTypes.includes(spec.pageType))
    .map(([id, spec]) => ({
      id,
      name: spec.name,
      description: spec.description,
    }))
}
