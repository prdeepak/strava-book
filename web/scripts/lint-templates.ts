/**
 * Lint script for race section templates.
 *
 * Checks that any RaceSection*.tsx file using displayLarge or displaySmall
 * typography also imports AutoResizingPdfText, since display-sized text
 * on user data must auto-resize to prevent overflow.
 *
 * Usage: npx tsx web/scripts/lint-templates.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const TEMPLATES_DIR = path.resolve(__dirname, '../components/templates')
const DISPLAY_PATTERN = /resolveTypography\(\s*['"]display(?:Large|Small)['"]/
const AUTO_RESIZE_IMPORT = /AutoResizingPdfText/

interface Violation {
  file: string
  line: number
  text: string
}

function lintFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const hasAutoResizeImport = AUTO_RESIZE_IMPORT.test(content)
  if (hasAutoResizeImport) return []

  for (let i = 0; i < lines.length; i++) {
    if (DISPLAY_PATTERN.test(lines[i])) {
      violations.push({
        file: path.basename(filePath),
        line: i + 1,
        text: lines[i].trim(),
      })
    }
  }

  return violations
}

function main() {
  const files = fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.startsWith('RaceSection') && f.endsWith('.tsx'))
    .map(f => path.join(TEMPLATES_DIR, f))

  let totalViolations = 0

  for (const file of files) {
    const violations = lintFile(file)
    for (const v of violations) {
      console.error(
        `${v.file}:${v.line}: uses display typography without AutoResizingPdfText import`
      )
      console.error(`  ${v.text}`)
      totalViolations++
    }
  }

  if (totalViolations > 0) {
    console.error(
      `\n${totalViolations} violation(s) found. Files using displayLarge/displaySmall must import AutoResizingPdfText.`
    )
    process.exit(1)
  } else {
    console.log('lint-templates: all RaceSection files OK')
  }
}

main()
