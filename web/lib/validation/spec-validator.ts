/**
 * Spec Validator - Validate rendered output against template specifications
 *
 * Reads template specs and validates that rendered PDF output
 * matches the variant requirements.
 */

import { TemplateSpec, VariantGuideline } from '../template-specs/types'
import { getTemplateSpec, getAllTemplateSpecs } from '../template-specs/registry'
import { FullAnalysis } from './pdf-analyzer'

// ============================================================================
// Types
// ============================================================================

export interface ValidationIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  details?: string
}

export interface SpecValidationResult {
  templateId: string
  variantName: string
  valid: boolean
  issues: ValidationIssue[]
  checksPerformed: string[]
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate PDF analysis against template spec and variant requirements
 */
export function validateAgainstSpec(
  templateId: string,
  variantName: string,
  analysis: FullAnalysis,
  inputData: {
    photoCount: number
    hasMapData: boolean
    hasChartData: boolean
    hasDescription: boolean
  }
): SpecValidationResult {
  const spec = getTemplateSpec(templateId)
  const issues: ValidationIssue[] = []
  const checksPerformed: string[] = []

  if (!spec) {
    return {
      templateId,
      variantName,
      valid: false,
      issues: [{
        type: 'error',
        code: 'UNKNOWN_TEMPLATE',
        message: `Template '${templateId}' not found in registry`,
      }],
      checksPerformed: ['template_exists'],
    }
  }

  // Find the variant guideline
  const variant = spec.guidelines.variants.find(v => v.name === variantName)
  if (!variant) {
    return {
      templateId,
      variantName,
      valid: false,
      issues: [{
        type: 'error',
        code: 'UNKNOWN_VARIANT',
        message: `Variant '${variantName}' not found in template '${templateId}'`,
        details: `Available variants: ${spec.outputOptions.variants.join(', ')}`,
      }],
      checksPerformed: ['variant_exists'],
    }
  }

  // Check render success
  checksPerformed.push('render_success')
  if (!analysis.renderSuccess) {
    issues.push({
      type: 'error',
      code: 'RENDER_FAILED',
      message: 'PDF rendering failed',
      details: analysis.renderError,
    })
  }

  // Check file size
  checksPerformed.push('file_size')
  if (analysis.fileSize === 0) {
    issues.push({
      type: 'error',
      code: 'EMPTY_FILE',
      message: 'Generated PDF has zero file size',
    })
  } else if (analysis.fileSize < 1000) {
    issues.push({
      type: 'warning',
      code: 'SMALL_FILE',
      message: 'Generated PDF seems unusually small',
      details: `File size: ${analysis.fileSize} bytes`,
    })
  }

  // Validate photo requirements
  if (variant.photoRequirements) {
    checksPerformed.push('photo_requirements')
    const photoReqs = variant.photoRequirements

    if (photoReqs.minCount !== undefined && inputData.photoCount < photoReqs.minCount) {
      // This is expected if the variant requires more photos than provided
      // Don't fail, but warn
      issues.push({
        type: 'warning',
        code: 'INSUFFICIENT_PHOTOS',
        message: `Variant '${variantName}' expects at least ${photoReqs.minCount} photos`,
        details: `Provided: ${inputData.photoCount} photos`,
      })
    }

    if (photoReqs.requiresHeroPhoto && !analysis.hasImages) {
      issues.push({
        type: 'warning',
        code: 'MISSING_HERO_PHOTO',
        message: `Variant '${variantName}' expects a hero photo but none detected in output`,
      })
    }
  }

  // Validate graphic requirements based on spec
  checksPerformed.push('graphic_requirements')
  const constraints = spec.guidelines.constraints

  if (constraints.requiresMap && !analysis.hasMap && !analysis.hasPolyline) {
    if (inputData.hasMapData) {
      issues.push({
        type: 'warning',
        code: 'MAP_NOT_RENDERED',
        message: 'Template requires map but no map detected in output',
      })
    }
  }

  // Check if template has text (most templates should)
  checksPerformed.push('text_content')
  if (!analysis.hasText) {
    issues.push({
      type: 'warning',
      code: 'NO_TEXT',
      message: 'No text content detected in output',
    })
  }

  // Check page count (most single-page templates should have 1 page)
  checksPerformed.push('page_count')
  if (analysis.pageCount === 0) {
    issues.push({
      type: 'error',
      code: 'NO_PAGES',
      message: 'Generated PDF has no pages',
    })
  }

  return {
    templateId,
    variantName,
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    checksPerformed,
  }
}

/**
 * Get all template specs from the registry
 */
export function getAllSpecs(): TemplateSpec[] {
  return getAllTemplateSpecs()
}

/**
 * Get variant guidelines for a template
 */
export function getVariantGuidelines(templateId: string): VariantGuideline[] {
  const spec = getTemplateSpec(templateId)
  return spec?.guidelines.variants || []
}

/**
 * Check if a template has variants defined
 */
export function templateHasVariants(templateId: string): boolean {
  const spec = getTemplateSpec(templateId)
  return (spec?.outputOptions.variants.length || 0) > 0
}

// ============================================================================
// Distinctness Validation
// ============================================================================

/**
 * Validate that different variants produce distinct output
 */
export function validateDistinctness(
  hashes: Map<string, string> // variantName -> hash
): { distinct: boolean; duplicates: string[][] } {
  const hashToVariants = new Map<string, string[]>()

  for (const [variant, hash] of hashes) {
    const existing = hashToVariants.get(hash) || []
    existing.push(variant)
    hashToVariants.set(hash, existing)
  }

  const duplicates: string[][] = []
  for (const variants of hashToVariants.values()) {
    if (variants.length > 1) {
      duplicates.push(variants)
    }
  }

  return {
    distinct: duplicates.length === 0,
    duplicates,
  }
}
