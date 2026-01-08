/**
 * Template Specification System
 *
 * Export all types, specs, and registry functions.
 */

// Types
export * from './types'

// Individual template specs
export { race1pSpec } from './race-1p'
export { race2pSpec } from './race-2p'
export { coverSpec, yearStatsSpec, monthlyDividerSpec, yearCalendarSpec } from './book-templates'

// Registry functions
export {
  getTemplateSpec,
  getAllTemplateSpecs,
  getTemplatesByPageType,
  getTemplateIdsForPageType,
  isValidTemplateId,
  getDefaultTemplateForPageType,
  suggestTemplate,
  validateOutputSpec,
} from './registry'
