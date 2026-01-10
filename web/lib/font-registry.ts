/**
 * Font Registry - Single source of truth for available fonts
 *
 * This file defines all fonts available for PDF generation, including
 * their variants (bold, italic). This is used by:
 * - AI style generator (to know what fonts to use)
 * - AI validation (to reject invalid fonts)
 * - Font validation tests (to catch missing registrations)
 *
 * NOTE: All fonts have fallback registrations in pdf-fonts.ts, so requesting
 * a variant that doesn't exist will fall back to the normal variant instead
 * of throwing an error. However, for best results, the AI should be guided
 * to use fonts with actual italic support for body text.
 */

// ============================================================================
// Font Definitions
// ============================================================================

export interface FontVariants {
    normal: boolean
    bold: boolean
    italic: boolean
    boldItalic: boolean
}

export interface FontDefinition {
    family: string
    category: 'display' | 'serif' | 'sans-serif' | 'condensed' | 'handwritten' | 'mono'
    variants: FontVariants
    description?: string
}

/**
 * All registered fonts with their available variants
 * Keep this in sync with pdf-fonts.ts registrations!
 */
export const FONT_REGISTRY: FontDefinition[] = [
    // =========================================================================
    // Display fonts (typically no italic)
    // =========================================================================
    {
        family: 'BebasNeue',
        category: 'display',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Bold display sans-serif, great for headlines'
    },
    {
        family: 'Anton',
        category: 'display',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Impact-style display font'
    },
    {
        family: 'ArchivoBlack',
        category: 'display',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Heavy black display font'
    },
    {
        family: 'Bangers',
        category: 'display',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Comic book style display font'
    },
    {
        family: 'Righteous',
        category: 'display',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Retro-style display font'
    },
    {
        family: 'Oswald',
        category: 'display',
        variants: { normal: true, bold: true, italic: false, boldItalic: false },
        description: 'Condensed display font, has bold'
    },

    // =========================================================================
    // Serif fonts (many have full variant support)
    // =========================================================================
    {
        family: 'CrimsonText',
        category: 'serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: false },
        description: 'Elegant serif, good for body text with italic support'
    },
    {
        family: 'Lora',
        category: 'serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Contemporary serif with full variant support'
    },
    {
        family: 'Merriweather',
        category: 'serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Readable serif optimized for screens, full variants'
    },
    {
        family: 'PlayfairDisplay',
        category: 'serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Elegant transitional serif, full variants'
    },

    // =========================================================================
    // Sans-serif fonts (many have full variant support)
    // =========================================================================
    {
        family: 'OpenSans',
        category: 'sans-serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Highly readable sans-serif, full variants'
    },
    {
        family: 'Roboto',
        category: 'sans-serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Modern geometric sans-serif, full variants'
    },
    {
        family: 'Montserrat',
        category: 'sans-serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Geometric sans-serif, full variants'
    },
    {
        family: 'Inter',
        category: 'sans-serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'UI-optimized sans-serif, full variants'
    },

    // =========================================================================
    // Condensed fonts
    // =========================================================================
    {
        family: 'BarlowCondensed',
        category: 'condensed',
        variants: { normal: true, bold: true, italic: true, boldItalic: false },
        description: 'Condensed sans-serif, space-efficient with italic'
    },
    {
        family: 'RobotoCondensed',
        category: 'condensed',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Condensed version of Roboto, full variants'
    },

    // =========================================================================
    // Monospace fonts
    // =========================================================================
    {
        family: 'RobotoMono',
        category: 'mono',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Monospace with full variant support'
    },
    {
        family: 'SourceCodePro',
        category: 'mono',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Code-optimized monospace, full variants'
    },

    // =========================================================================
    // Handwritten fonts (typically no variants)
    // =========================================================================
    {
        family: 'IndieFlower',
        category: 'handwritten',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Casual handwritten style'
    },
    {
        family: 'PatrickHand',
        category: 'handwritten',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Friendly handwritten style'
    },
    {
        family: 'PermanentMarker',
        category: 'handwritten',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Marker pen style'
    },
    {
        family: 'HennyPenny',
        category: 'handwritten',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Playful handwritten style'
    },
    {
        family: 'DancingScript',
        category: 'handwritten',
        variants: { normal: true, bold: true, italic: false, boldItalic: false },
        description: 'Script font with bold support'
    },
    {
        family: 'ShadowsIntoLight',
        category: 'handwritten',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Light handwritten style'
    },
    {
        family: 'Caveat',
        category: 'handwritten',
        variants: { normal: true, bold: false, italic: false, boldItalic: false },
        description: 'Natural handwriting style'
    },
]

/**
 * Built-in PDF fonts (always available with all variants)
 */
export const BUILTIN_FONTS: FontDefinition[] = [
    {
        family: 'Helvetica',
        category: 'sans-serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Classic sans-serif, built-in'
    },
    {
        family: 'Times-Roman',
        category: 'serif',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Classic serif, built-in'
    },
    {
        family: 'Courier',
        category: 'mono',
        variants: { normal: true, bold: true, italic: true, boldItalic: true },
        description: 'Monospace, built-in'
    },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all font families
 */
export function getAllFontFamilies(): string[] {
    return [
        ...FONT_REGISTRY.map(f => f.family),
        ...BUILTIN_FONTS.map(f => f.family),
    ]
}

/**
 * Get fonts by category
 */
export function getFontsByCategory(category: FontDefinition['category']): string[] {
    return [
        ...FONT_REGISTRY.filter(f => f.category === category).map(f => f.family),
        ...BUILTIN_FONTS.filter(f => f.category === category).map(f => f.family),
    ]
}

/**
 * Get fonts suitable for headings (display, sans-serif, serif, condensed)
 */
export function getHeadingFonts(): string[] {
    const headingCategories: FontDefinition['category'][] = ['display', 'sans-serif', 'serif', 'condensed']
    return [
        ...FONT_REGISTRY.filter(f => headingCategories.includes(f.category)).map(f => f.family),
        ...BUILTIN_FONTS.filter(f => headingCategories.includes(f.category)).map(f => f.family),
    ]
}

/**
 * Get fonts suitable for body text (must have italic variant for best results)
 * Note: Fonts without italic will fall back to normal, but we prefer fonts with actual italic
 */
export function getBodyFonts(): string[] {
    return [
        ...FONT_REGISTRY.filter(f => f.variants.italic).map(f => f.family),
        ...BUILTIN_FONTS.filter(f => f.variants.italic).map(f => f.family),
    ]
}

/**
 * Get all fonts including those without italic (for cases where italic isn't needed)
 */
export function getAllBodyFonts(): string[] {
    // All fonts can technically be used for body (fallbacks exist)
    return getAllFontFamilies()
}

/**
 * Check if a font has italic variant
 */
export function fontHasItalic(family: string): boolean {
    const font = [...FONT_REGISTRY, ...BUILTIN_FONTS].find(f => f.family === family)
    return font?.variants.italic ?? false
}

/**
 * Check if a font has bold variant
 */
export function fontHasBold(family: string): boolean {
    const font = [...FONT_REGISTRY, ...BUILTIN_FONTS].find(f => f.family === family)
    return font?.variants.bold ?? false
}

/**
 * Check if a font has bold-italic variant
 */
export function fontHasBoldItalic(family: string): boolean {
    const font = [...FONT_REGISTRY, ...BUILTIN_FONTS].find(f => f.family === family)
    return font?.variants.boldItalic ?? false
}

/**
 * Validate a font choice for body text (prefer fonts with italic)
 */
export function isValidBodyFont(family: string): boolean {
    return getBodyFonts().includes(family)
}

/**
 * Validate a font choice for headings
 */
export function isValidHeadingFont(family: string): boolean {
    return getAllFontFamilies().includes(family)
}

/**
 * Get font info for AI prompt
 */
export function getFontInfoForAI(): string {
    const headingFonts = getHeadingFonts()
    const bodyFonts = getBodyFonts()

    return `## Available Fonts

### Heading Fonts (for titles, headers)
${headingFonts.join(', ')}

### Body Fonts (for paragraphs, descriptions - RECOMMENDED because they have italic)
${bodyFonts.join(', ')}

### All Fonts (with fallback support)
All fonts can be used anywhere with automatic fallback if a variant doesn't exist.
However, for body text that uses italic styling, prefer Body Fonts for best results.

IMPORTANT: Templates use italic for activity descriptions. Using a font without native
italic support for body text will result in the normal variant being used as fallback.`
}
