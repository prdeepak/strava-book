/**
 * Report Formatter - Pretty CLI output for validation results
 *
 * Formats validation results as nicely formatted CLI tables
 * and summary reports.
 */

import { SpecValidationResult } from './spec-validator'

// ============================================================================
// Types
// ============================================================================

export interface VariantResult {
  templateId: string
  variantName: string
  passed: boolean
  fileSize: number
  renderTime: number
  hash: string
  validation: SpecValidationResult
  error?: string
}

export interface TemplateReport {
  templateId: string
  variantsTotal: number
  variantsPassed: number
  variantsFailed: number
  distinctOutput: boolean
  duplicateVariants: string[][]
  results: VariantResult[]
}

export interface FullReport {
  timestamp: string
  duration: number
  templatesTotal: number
  templatesPassed: number
  templatesFailed: number
  variantsTotal: number
  variantsPassed: number
  variantsFailed: number
  templates: TemplateReport[]
}

// ============================================================================
// ANSI Color Codes
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
}

const symbols = {
  pass: `${colors.green}[PASS]${colors.reset}`,
  fail: `${colors.red}[FAIL]${colors.reset}`,
  warn: `${colors.yellow}[WARN]${colors.reset}`,
  info: `${colors.cyan}[INFO]${colors.reset}`,
  bullet: `${colors.dim}-${colors.reset}`,
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Pad string to fixed width
 */
function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '') // Strip ANSI codes for length
  const padLength = Math.max(0, width - stripped.length)
  if (align === 'right') {
    return ' '.repeat(padLength) + str
  }
  return str + ' '.repeat(padLength)
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Format a single variant result row
 */
export function formatVariantRow(result: VariantResult): string {
  const status = result.passed ? symbols.pass : symbols.fail
  const template = pad(result.templateId, 20)
  const variant = pad(result.variantName, 25)
  const size = pad(formatFileSize(result.fileSize), 12, 'right')
  const time = pad(formatDuration(result.renderTime), 8, 'right')
  const hash = result.hash.slice(0, 8)

  return `${status} ${template} ${variant} ${size} ${time}  ${colors.dim}${hash}${colors.reset}`
}

/**
 * Format the table header
 */
export function formatTableHeader(): string {
  const header = `${pad('STATUS', 8)} ${pad('TEMPLATE', 20)} ${pad('VARIANT', 25)} ${pad('SIZE', 12)} ${pad('TIME', 8)}  ${pad('HASH', 8)}`
  const separator = '-'.repeat(90)
  return `${colors.bright}${header}${colors.reset}\n${separator}`
}

/**
 * Format a template summary section
 */
export function formatTemplateSummary(report: TemplateReport): string {
  const lines: string[] = []

  const status = report.variantsFailed === 0 ? symbols.pass : symbols.fail
  lines.push(`\n${status} ${colors.bright}${report.templateId}${colors.reset}`)
  lines.push(`   Variants: ${report.variantsPassed}/${report.variantsTotal} passed`)

  if (!report.distinctOutput && report.duplicateVariants.length > 0) {
    lines.push(`   ${symbols.warn} Duplicate outputs detected:`)
    for (const group of report.duplicateVariants) {
      lines.push(`      ${symbols.bullet} ${group.join(', ')} produce identical output`)
    }
  }

  // Show individual variant results
  for (const result of report.results) {
    const variantStatus = result.passed ? colors.green + 'OK' + colors.reset : colors.red + 'FAIL' + colors.reset
    lines.push(`   ${symbols.bullet} ${pad(result.variantName, 22)} ${variantStatus} ${formatFileSize(result.fileSize)}`)

    // Show validation issues
    for (const issue of result.validation.issues) {
      const issueSymbol = issue.type === 'error' ? colors.red + '!' + colors.reset : colors.yellow + '?' + colors.reset
      lines.push(`      ${issueSymbol} ${issue.message}`)
    }

    // Show error if present
    if (result.error) {
      lines.push(`      ${colors.red}Error: ${result.error}${colors.reset}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format the full report summary
 */
export function formatFullSummary(report: FullReport): string {
  const lines: string[] = []

  lines.push('\n' + '='.repeat(70))
  lines.push(`${colors.bright}VALIDATION SUMMARY${colors.reset}`)
  lines.push('='.repeat(70))
  lines.push('')
  lines.push(`Completed: ${report.timestamp}`)
  lines.push(`Duration:  ${formatDuration(report.duration)}`)
  lines.push('')

  // Template summary
  const templateStatus = report.templatesFailed === 0
    ? `${colors.green}${report.templatesPassed}/${report.templatesTotal} passed${colors.reset}`
    : `${colors.red}${report.templatesFailed}/${report.templatesTotal} failed${colors.reset}`
  lines.push(`Templates: ${templateStatus}`)

  // Variant summary
  const variantStatus = report.variantsFailed === 0
    ? `${colors.green}${report.variantsPassed}/${report.variantsTotal} passed${colors.reset}`
    : `${colors.red}${report.variantsFailed}/${report.variantsTotal} failed${colors.reset}`
  lines.push(`Variants:  ${variantStatus}`)

  lines.push('')

  // Overall status
  if (report.templatesFailed === 0 && report.variantsFailed === 0) {
    lines.push(`${colors.bgGreen}${colors.white} ALL VALIDATIONS PASSED ${colors.reset}`)
  } else {
    lines.push(`${colors.bgRed}${colors.white} SOME VALIDATIONS FAILED ${colors.reset}`)
  }

  lines.push('')

  return lines.join('\n')
}

/**
 * Format the full report
 */
export function formatFullReport(report: FullReport): string {
  const lines: string[] = []

  lines.push('')
  lines.push(`${colors.bright}Template Variant Validation Report${colors.reset}`)
  lines.push('='.repeat(70))
  lines.push('')

  // Table header
  lines.push(formatTableHeader())

  // All variant results
  for (const template of report.templates) {
    for (const result of template.results) {
      lines.push(formatVariantRow(result))
    }
  }

  lines.push('')

  // Template summaries
  for (const template of report.templates) {
    lines.push(formatTemplateSummary(template))
  }

  // Overall summary
  lines.push(formatFullSummary(report))

  return lines.join('\n')
}

/**
 * Format a simple progress indicator
 */
export function formatProgress(current: number, total: number, message: string): string {
  const percentage = Math.round((current / total) * 100)
  const bar = '='.repeat(Math.floor(percentage / 2)) + ' '.repeat(50 - Math.floor(percentage / 2))
  return `\r[${bar}] ${percentage}% ${message}`
}

/**
 * Format JSON report for machine consumption
 */
export function formatJsonReport(report: FullReport): string {
  return JSON.stringify(report, null, 2)
}
