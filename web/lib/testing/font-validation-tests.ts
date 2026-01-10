/**
 * Font Validation Tests
 *
 * Ensures all fonts used in templates are properly registered and available.
 * Catches missing font errors at test time rather than runtime.
 */

import * as fs from 'fs'
import * as path from 'path'

// Simple glob replacement using fs
function globSync(pattern: string, options: { cwd: string, absolute?: boolean }): string[] {
    const results: string[] = []
    const ext = pattern.replace('**/*', '')

    function walkDir(dir: string): void {
        if (!fs.existsSync(dir)) return
        const files = fs.readdirSync(dir)
        for (const file of files) {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)
            if (stat.isDirectory()) {
                walkDir(fullPath)
            } else if (file.endsWith(ext)) {
                results.push(options.absolute ? fullPath : path.relative(options.cwd, fullPath))
            }
        }
    }

    walkDir(options.cwd)
    return results
}

// ============================================================================
// Configuration
// ============================================================================

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
const TEMPLATES_DIR = path.join(process.cwd(), 'components', 'templates')
const LIB_DIR = path.join(process.cwd(), 'lib')

// Built-in fonts that don't need files
const BUILTIN_FONTS = [
    'Helvetica',
    'Helvetica-Bold',
    'Helvetica-Oblique',
    'Helvetica-BoldOblique',
    'Times-Roman',
    'Times-Bold',
    'Times-Italic',
    'Times-BoldItalic',
    'Courier',
    'Courier-Bold',
    'Courier-Oblique',
    'Courier-BoldOblique',
]

// ============================================================================
// Font File Discovery
// ============================================================================

function getAvailableFontFiles(): string[] {
    if (!fs.existsSync(FONTS_DIR)) {
        console.error(`Fonts directory not found: ${FONTS_DIR}`)
        return []
    }

    const files = fs.readdirSync(FONTS_DIR)
        .filter(f => f.endsWith('.ttf') || f.endsWith('.otf'))

    return files
}

function extractFontFamilyFromFile(filename: string): string {
    // BarlowCondensed-Bold.ttf -> BarlowCondensed
    // Anton-Regular.ttf -> Anton
    return filename.replace(/-(Regular|Bold|Italic|Light|Medium|SemiBold|BoldItalic)\.ttf$/, '')
                   .replace(/\.ttf$/, '')
                   .replace(/\.otf$/, '')
}

function getAvailableFontFamilies(): Set<string> {
    const files = getAvailableFontFiles()
    const families = new Set<string>()

    files.forEach(file => {
        families.add(extractFontFamilyFromFile(file))
    })

    // Add built-in fonts
    BUILTIN_FONTS.forEach(f => families.add(f))

    return families
}

// ============================================================================
// Registered Font Extraction (from pdf-fonts.ts)
// ============================================================================

function getRegisteredFonts(): Set<string> {
    const pdfFontsPath = path.join(LIB_DIR, 'pdf-fonts.ts')

    if (!fs.existsSync(pdfFontsPath)) {
        console.error(`pdf-fonts.ts not found: ${pdfFontsPath}`)
        return new Set()
    }

    const content = fs.readFileSync(pdfFontsPath, 'utf-8')
    const registered = new Set<string>()

    // Match Font.register({ family: 'FontName' })
    const familyRegex = /family:\s*['"]([^'"]+)['"]/g
    let match
    while ((match = familyRegex.exec(content)) !== null) {
        registered.add(match[1])
    }

    // Match registerFontWithFallbacks('FontName', ...)
    const fallbackRegex = /registerFontWithFallbacks\s*\(\s*['"]([^'"]+)['"]/g
    while ((match = fallbackRegex.exec(content)) !== null) {
        registered.add(match[1])
    }

    // Add built-in fonts
    BUILTIN_FONTS.forEach(f => registered.add(f))

    return registered
}

// ============================================================================
// Font Usage Detection
// ============================================================================

interface FontUsage {
    font: string
    file: string
    line: number
    context: string
}

async function findFontUsagesInFile(filePath: string): Promise<FontUsage[]> {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const usages: FontUsage[] = []

    // Patterns to match font usage
    const patterns = [
        /fontFamily:\s*['"]([^'"]+)['"]/g,           // fontFamily: 'SomeFont'
        /fontFamily:\s*`([^`]+)`/g,                   // fontFamily: `SomeFont`
        /font-family:\s*['"]([^'"]+)['"]/g,          // CSS style
    ]

    // Skip this test file to avoid matching example patterns
    if (filePath.includes('font-validation-tests')) {
        return usages
    }

    lines.forEach((line, index) => {
        patterns.forEach(pattern => {
            let match
            pattern.lastIndex = 0 // Reset regex
            while ((match = pattern.exec(line)) !== null) {
                const font = match[1]
                // Skip template literals with variables
                if (font.includes('${')) continue
                // Skip theme references
                if (font.includes('theme.')) continue

                usages.push({
                    font,
                    file: filePath,
                    line: index + 1,
                    context: line.trim().substring(0, 80),
                })
            }
        })
    })

    return usages
}

async function findAllFontUsages(): Promise<FontUsage[]> {
    const allUsages: FontUsage[] = []

    // Scan templates
    const templateFiles = globSync('**/*.tsx', { cwd: TEMPLATES_DIR, absolute: true })
    for (const file of templateFiles) {
        const usages = await findFontUsagesInFile(file)
        allUsages.push(...usages)
    }

    // Scan lib files for theme defaults
    const libFiles = globSync('**/*.ts', { cwd: LIB_DIR, absolute: true })
    for (const file of libFiles) {
        const usages = await findFontUsagesInFile(file)
        allUsages.push(...usages)
    }

    return allUsages
}

// ============================================================================
// Validation
// ============================================================================

interface ValidationResult {
    valid: boolean
    availableFamilies: string[]
    registeredFonts: string[]
    usedFonts: FontUsage[]
    missingFonts: FontUsage[]
    unregisteredButAvailable: string[]
}

async function validateFonts(): Promise<ValidationResult> {
    const availableFamilies = getAvailableFontFamilies()
    const registeredFonts = getRegisteredFonts()
    const usedFonts = await findAllFontUsages()

    // Find fonts that are used but not registered
    const missingFonts = usedFonts.filter(usage => {
        return !registeredFonts.has(usage.font)
    })

    // Find fonts that are available but not registered
    const unregisteredButAvailable = Array.from(availableFamilies)
        .filter(f => !registeredFonts.has(f) && !BUILTIN_FONTS.includes(f))

    return {
        valid: missingFonts.length === 0,
        availableFamilies: Array.from(availableFamilies).sort(),
        registeredFonts: Array.from(registeredFonts).sort(),
        usedFonts,
        missingFonts,
        unregisteredButAvailable,
    }
}

// ============================================================================
// Font Style Validation (italic, bold variants)
// ============================================================================

interface FontStyleUsage {
    font: string
    style: 'italic' | 'bold' | 'bold-italic'
    file: string
    line: number
}

async function findFontStyleUsages(): Promise<FontStyleUsage[]> {
    const usages: FontStyleUsage[] = []

    const templateFiles = globSync('**/*.tsx', { cwd: TEMPLATES_DIR, absolute: true })

    for (const filePath of templateFiles) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        // Track current fontFamily in scope (simplified)
        let currentFont = ''

        lines.forEach((line, index) => {
            // Check for fontFamily declaration
            const fontMatch = line.match(/fontFamily:\s*['"]([^'"]+)['"]/)
            if (fontMatch) {
                currentFont = fontMatch[1]
            }

            // Check for fontStyle: 'italic'
            if (line.includes("fontStyle: 'italic'") || line.includes('fontStyle: "italic"')) {
                // Look backwards for fontFamily in same style block
                for (let i = index; i >= Math.max(0, index - 10); i--) {
                    const prevFontMatch = lines[i].match(/fontFamily:\s*['"]([^'"]+)['"]/)
                    if (prevFontMatch) {
                        usages.push({
                            font: prevFontMatch[1],
                            style: 'italic',
                            file: filePath,
                            line: index + 1,
                        })
                        break
                    }
                    // Also check for theme font references
                    const themeMatch = lines[i].match(/fontFamily:\s*theme\.fontPairing\.(body|heading)/)
                    if (themeMatch) {
                        usages.push({
                            font: `theme.fontPairing.${themeMatch[1]}`,
                            style: 'italic',
                            file: filePath,
                            line: index + 1,
                        })
                        break
                    }
                }
            }
        })
    }

    return usages
}

function getRegisteredFontStyles(): Map<string, Set<string>> {
    const pdfFontsPath = path.join(LIB_DIR, 'pdf-fonts.ts')
    const content = fs.readFileSync(pdfFontsPath, 'utf-8')
    const fontStyles = new Map<string, Set<string>>()

    // Parse old-style Font.register() calls
    const registerBlocks = content.split('Font.register(')
    for (const block of registerBlocks.slice(1)) {
        const familyMatch = block.match(/family:\s*['"]([^'"]+)['"]/)
        if (!familyMatch) continue

        const family = familyMatch[1]
        const styles = new Set<string>(['normal']) // normal is always available

        // Check for bold
        if (block.includes("fontWeight: 'bold'") || block.includes('fontWeight: "bold"')) {
            styles.add('bold')
        }

        // Check for italic
        if (block.includes("fontStyle: 'italic'") || block.includes('fontStyle: "italic"')) {
            styles.add('italic')
        }

        fontStyles.set(family, styles)
    }

    // Parse new-style registerFontWithFallbacks() calls
    // Format: registerFontWithFallbacks('FontName', 'BaseName', { hasBold: true, hasItalic: true, ... })
    const fallbackRegex = /registerFontWithFallbacks\s*\(\s*['"]([^'"]+)['"][^{]*\{([^}]*)\}/g
    let match
    while ((match = fallbackRegex.exec(content)) !== null) {
        const family = match[1]
        const options = match[2]
        const styles = new Set<string>(['normal']) // normal is always available

        // All fonts registered with fallbacks have all styles (with fallbacks)
        // Check the actual variant availability from the options
        if (options.includes('hasBold: true')) {
            styles.add('bold')
        }
        if (options.includes('hasItalic: true')) {
            styles.add('italic')
        }
        if (options.includes('hasBoldItalic: true')) {
            styles.add('bold-italic')
        }

        // Note: Even fonts without actual variants have fallback registration
        // So they won't cause errors, but we track actual support here
        fontStyles.set(family, styles)
    }

    // Built-in fonts have all styles
    BUILTIN_FONTS.forEach(f => {
        fontStyles.set(f, new Set(['normal', 'bold', 'italic', 'bold-italic']))
    })

    return fontStyles
}

// ============================================================================
// Theme Body Font Validation
// ============================================================================

function getThemeBodyFonts(): string[] {
    const themeDefaultsPath = path.join(LIB_DIR, 'theme-defaults.ts')
    const styleGuidePath = path.join(LIB_DIR, 'style-guide-generator.ts')
    const bodyFonts = new Set<string>()

    // Check theme-defaults.ts
    if (fs.existsSync(themeDefaultsPath)) {
        const content = fs.readFileSync(themeDefaultsPath, 'utf-8')
        const bodyMatches = content.matchAll(/body:\s*['"]([^'"]+)['"]/g)
        for (const match of bodyMatches) {
            bodyFonts.add(match[1])
        }
    }

    // Check style-guide-generator.ts
    if (fs.existsSync(styleGuidePath)) {
        const content = fs.readFileSync(styleGuidePath, 'utf-8')
        const bodyMatches = content.matchAll(/body:\s*['"]([^'"]+)['"]/g)
        for (const match of bodyMatches) {
            bodyFonts.add(match[1])
        }
        // Also check bodyFont assignments
        const assignMatches = content.matchAll(/bodyFont\s*=\s*['"]([^'"]+)['"]/g)
        for (const match of assignMatches) {
            bodyFonts.add(match[1])
        }
    }

    return Array.from(bodyFonts)
}

function validateBodyFontsHaveItalic(bodyFonts: string[], registeredStyles: Map<string, Set<string>>): string[] {
    const missing: string[] = []

    for (const font of bodyFonts) {
        // Skip built-in fonts
        if (BUILTIN_FONTS.includes(font)) continue

        const styles = registeredStyles.get(font)
        if (!styles || !styles.has('italic')) {
            missing.push(font)
        }
    }

    return missing
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runFontValidation(): Promise<void> {
    console.log('Font Validation Tests')
    console.log('=====================\n')

    // Test 1: Check all used fonts are registered
    console.log('1. Checking font registration...')
    const result = await validateFonts()

    console.log(`   Available font families: ${result.availableFamilies.length}`)
    console.log(`   Registered fonts: ${result.registeredFonts.length}`)
    console.log(`   Font usages found: ${result.usedFonts.length}`)

    if (result.missingFonts.length > 0) {
        console.log('\n   ERRORS - Fonts used but not registered:')
        result.missingFonts.forEach(usage => {
            console.log(`   - "${usage.font}" in ${path.basename(usage.file)}:${usage.line}`)
            console.log(`     ${usage.context}`)
        })
    } else {
        console.log('   All used fonts are registered.')
    }

    // Test 2: Check font style availability
    console.log('\n2. Checking font style variants...')
    const styleUsages = await findFontStyleUsages()
    const registeredStyles = getRegisteredFontStyles()

    const missingStyles: FontStyleUsage[] = []

    for (const usage of styleUsages) {
        // Skip theme references (need runtime check)
        if (usage.font.startsWith('theme.')) continue

        const styles = registeredStyles.get(usage.font)
        if (!styles || !styles.has(usage.style)) {
            missingStyles.push(usage)
        }
    }

    if (missingStyles.length > 0) {
        console.log('\n   ERRORS - Font styles used but not registered:')
        missingStyles.forEach(usage => {
            console.log(`   - "${usage.font}" ${usage.style} in ${path.basename(usage.file)}:${usage.line}`)
        })
    } else {
        console.log(`   Checked ${styleUsages.length} style usages - all variants available.`)
    }

    // Test 3: Check body fonts have italic (for theme.fontPairing.body)
    // Note: With fallback registrations, fonts without italic won't cause errors
    // but will use normal variant as fallback
    console.log('\n3. Checking theme body fonts have italic variants...')
    const bodyFonts = getThemeBodyFonts()
    const bodyFontsMissingItalic = validateBodyFontsHaveItalic(bodyFonts, registeredStyles)

    if (bodyFontsMissingItalic.length > 0) {
        console.log('\n   INFO - Body fonts without native italic (will use fallback):')
        bodyFontsMissingItalic.forEach(font => {
            console.log(`   - "${font}" has no italic variant (normal will be used as fallback)`)
        })
    } else {
        console.log(`   Checked ${bodyFonts.length} body fonts - all have italic variants.`)
    }

    // Test 4: Report unregistered fonts
    if (result.unregisteredButAvailable.length > 0) {
        console.log('\n4. Info - Available fonts not registered:')
        result.unregisteredButAvailable.forEach(f => console.log(`   - ${f}`))
    }

    // Summary
    console.log('\n=====================')
    // Note: bodyFontsMissingItalic is just info now (fallbacks exist), not an error
    const hasErrors = result.missingFonts.length > 0 || missingStyles.length > 0
    if (hasErrors) {
        console.log('VALIDATION FAILED')
        process.exit(1)
    } else {
        console.log('VALIDATION PASSED')
    }
}

// Run if called directly
runFontValidation().catch(err => {
    console.error('Font validation failed:', err)
    process.exit(1)
})
