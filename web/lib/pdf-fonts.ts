/**
 * PDF Font Registration
 *
 * Registers all fonts needed for PDF generation with @react-pdf/renderer.
 * This module must be imported before rendering any PDF that uses custom fonts.
 *
 * FALLBACK STRATEGY:
 * For fonts that don't have italic/bold variants, we register the normal variant
 * as a fallback. This prevents "Could not resolve font" errors when templates
 * request a variant that doesn't exist.
 */

import { Font } from '@react-pdf/renderer'
import path from 'path'
import fs from 'fs'

// Determine font path based on environment
const getFontPath = (filename: string): string => {
    // Try multiple possible locations for fonts
    const possiblePaths = [
        // Docker: /app/web/public/fonts
        path.join(process.cwd(), 'public', 'fonts', filename),
        // Local dev from web directory
        path.join(process.cwd(), 'web', 'public', 'fonts', filename),
        // Relative to this file
        path.join(__dirname, '..', '..', 'public', 'fonts', filename),
    ]

    for (const fontPath of possiblePaths) {
        if (fs.existsSync(fontPath)) {
            return fontPath
        }
    }

    // Log which paths were tried if none found
    console.error(`[pdf-fonts] Font not found: ${filename}`)
    console.error(`[pdf-fonts] Tried paths:`, possiblePaths)
    console.error(`[pdf-fonts] process.cwd():`, process.cwd())
    console.error(`[pdf-fonts] __dirname:`, __dirname)

    // Return first path as fallback (will fail with clear error)
    return possiblePaths[0]
}

// Get font source for registration - returns absolute file path
const getFontSource = (filename: string): string => {
    return getFontPath(filename)
}

// Helper to check if a font file exists
const fontExists = (filename: string): boolean => {
    const possiblePaths = [
        path.join(process.cwd(), 'public', 'fonts', filename),
        path.join(process.cwd(), 'web', 'public', 'fonts', filename),
        path.join(__dirname, '..', '..', 'public', 'fonts', filename),
    ]
    return possiblePaths.some(p => fs.existsSync(p))
}

// Track if fonts have been registered to avoid duplicate registration
let fontsRegistered = false

/**
 * Register a font with full variant support and fallbacks
 * If a variant file doesn't exist, uses the regular variant as fallback
 */
function registerFontWithFallbacks(
    family: string,
    baseName: string,
    options: {
        hasItalic?: boolean
        hasBold?: boolean
        hasBoldItalic?: boolean
    } = {}
): void {
    const regular = `${baseName}-Regular.ttf`
    const bold = `${baseName}-Bold.ttf`
    const italic = `${baseName}-Italic.ttf`
    const boldItalic = `${baseName}-BoldItalic.ttf`

    // Determine what files actually exist
    const hasBold = options.hasBold !== false && fontExists(bold)
    const hasItalic = options.hasItalic !== false && fontExists(italic)
    const hasBoldItalic = options.hasBoldItalic !== false && fontExists(boldItalic)

    // Build font variants array with fallbacks
    // Using 'as const' to ensure correct literal types for fontWeight/fontStyle
    const fonts = [
        // Normal
        { src: getFontSource(regular), fontWeight: 'normal' as const },
        // Bold - use actual or fallback to normal
        { src: getFontSource(hasBold ? bold : regular), fontWeight: 'bold' as const },
        // Italic - use actual or fallback to normal
        { src: getFontSource(hasItalic ? italic : regular), fontWeight: 'normal' as const, fontStyle: 'italic' as const },
        // Bold Italic - use actual or fallback (prefer bold > italic > normal)
        {
            src: getFontSource(hasBoldItalic ? boldItalic : (hasBold ? bold : (hasItalic ? italic : regular))),
            fontWeight: 'bold' as const,
            fontStyle: 'italic' as const
        },
    ]

    Font.register({ family, fonts })
}

/**
 * Register all fonts needed for PDF generation.
 * Safe to call multiple times - will only register once.
 */
export function registerPdfFonts(): void {
    if (fontsRegistered) {
        console.log('[pdf-fonts] Fonts already registered, skipping')
        return
    }

    console.log('[pdf-fonts] Registering fonts...')
    console.log('[pdf-fonts] CWD:', process.cwd())

    // Test that we can find at least one font (use a valid font)
    const testFont = getFontPath('Anton-Regular.ttf')
    console.log('[pdf-fonts] Test font path:', testFont)
    console.log('[pdf-fonts] Test font exists:', fs.existsSync(testFont))

    // Register emoji source
    Font.registerEmojiSource({
        format: 'png',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
    })

    // =========================================================================
    // DISPLAY FONTS (no italic/bold variants exist - use fallbacks)
    // =========================================================================

    // BebasNeue - display font (no variants)
    registerFontWithFallbacks('BebasNeue', 'BebasNeue', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: BebasNeue (with fallbacks)')

    // Anton - display font (no variants)
    registerFontWithFallbacks('Anton', 'Anton', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: Anton (with fallbacks)')

    // ArchivoBlack - display font (no variants)
    registerFontWithFallbacks('ArchivoBlack', 'ArchivoBlack', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: ArchivoBlack (with fallbacks)')

    // Bangers - display font (no variants)
    registerFontWithFallbacks('Bangers', 'Bangers', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: Bangers (with fallbacks)')

    // Righteous - display font (no variants)
    registerFontWithFallbacks('Righteous', 'Righteous', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: Righteous (with fallbacks)')

    // Oswald - display font (has bold, no italic)
    registerFontWithFallbacks('Oswald', 'Oswald', {
        hasBold: true,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: Oswald (with fallbacks)')

    // =========================================================================
    // SERIF FONTS (full variant support)
    // =========================================================================

    // CrimsonText - serif font (has bold, italic)
    registerFontWithFallbacks('CrimsonText', 'CrimsonText', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: false  // No bold-italic for CrimsonText
    })
    console.log('[pdf-fonts] Registered: CrimsonText')

    // Lora - serif font (full variants)
    registerFontWithFallbacks('Lora', 'Lora', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: Lora')

    // Merriweather - serif font (full variants)
    registerFontWithFallbacks('Merriweather', 'Merriweather', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: Merriweather')

    // PlayfairDisplay - serif font (full variants)
    registerFontWithFallbacks('PlayfairDisplay', 'PlayfairDisplay', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: PlayfairDisplay')

    // =========================================================================
    // SANS-SERIF FONTS
    // =========================================================================

    // OpenSans - sans-serif (full variants)
    registerFontWithFallbacks('OpenSans', 'OpenSans', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: OpenSans')

    // Roboto - sans-serif (full variants)
    registerFontWithFallbacks('Roboto', 'Roboto', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: Roboto')

    // Montserrat - sans-serif (full variants)
    registerFontWithFallbacks('Montserrat', 'Montserrat', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: Montserrat')

    // Inter - sans-serif (full variants)
    registerFontWithFallbacks('Inter', 'Inter', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: Inter')

    // =========================================================================
    // CONDENSED FONTS
    // =========================================================================

    // BarlowCondensed - condensed sans-serif (has bold, italic)
    registerFontWithFallbacks('BarlowCondensed', 'BarlowCondensed', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: BarlowCondensed')

    // RobotoCondensed - condensed (full variants)
    registerFontWithFallbacks('RobotoCondensed', 'RobotoCondensed', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: RobotoCondensed')

    // =========================================================================
    // MONOSPACE FONTS
    // =========================================================================

    // RobotoMono - monospace (full variants)
    registerFontWithFallbacks('RobotoMono', 'RobotoMono', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: RobotoMono')

    // SourceCodePro - monospace (full variants)
    registerFontWithFallbacks('SourceCodePro', 'SourceCodePro', {
        hasBold: true,
        hasItalic: true,
        hasBoldItalic: true
    })
    console.log('[pdf-fonts] Registered: SourceCodePro')

    // =========================================================================
    // HANDWRITTEN FONTS (no variants - use fallbacks)
    // =========================================================================

    // IndieFlower - handwritten (no variants)
    registerFontWithFallbacks('IndieFlower', 'IndieFlower', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: IndieFlower (with fallbacks)')

    // PatrickHand - handwritten (no variants)
    registerFontWithFallbacks('PatrickHand', 'PatrickHand', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: PatrickHand (with fallbacks)')

    // PermanentMarker - handwritten/marker style (no variants)
    registerFontWithFallbacks('PermanentMarker', 'PermanentMarker', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: PermanentMarker (with fallbacks)')

    // HennyPenny - decorative handwritten (no variants)
    registerFontWithFallbacks('HennyPenny', 'HennyPenny', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: HennyPenny (with fallbacks)')

    // DancingScript - script font (has bold, no italic)
    registerFontWithFallbacks('DancingScript', 'DancingScript', {
        hasBold: true,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: DancingScript (with fallbacks)')

    // ShadowsIntoLight - handwritten (no variants)
    registerFontWithFallbacks('ShadowsIntoLight', 'ShadowsIntoLight', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: ShadowsIntoLight (with fallbacks)')

    // Caveat - handwritten (no variants)
    registerFontWithFallbacks('Caveat', 'Caveat', {
        hasBold: false,
        hasItalic: false,
        hasBoldItalic: false
    })
    console.log('[pdf-fonts] Registered: Caveat (with fallbacks)')

    // =========================================================================
    // BUILT-IN FONTS
    // Helvetica, Times-Roman, Courier are built-in to react-pdf
    // No registration needed - they support all variants natively
    // =========================================================================

    fontsRegistered = true
    console.log('[pdf-fonts] Fonts registered successfully')
}

// Auto-register when this module is imported
registerPdfFonts()
