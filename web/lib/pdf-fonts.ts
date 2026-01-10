/**
 * PDF Font Registration
 *
 * Registers all fonts needed for PDF generation with @react-pdf/renderer.
 * This module must be imported before rendering any PDF that uses custom fonts.
 *
 * NOTE: Some font files in public/fonts are corrupted (contain only newlines).
 * Only registering fonts that have been verified as valid TTF files.
 *
 * Valid fonts: Anton, ArchivoBlack, Bangers, BarlowCondensed, BebasNeue,
 *              CrimsonText, IndieFlower, PatrickHand, PermanentMarker, HennyPenny
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

// Track if fonts have been registered to avoid duplicate registration
let fontsRegistered = false

/**
 * Register all fonts needed for PDF generation.
 * Safe to call multiple times - will only register once.
 *
 * Only registers fonts that are known to be valid TTF files.
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

    // === DISPLAY FONTS (all verified as valid TTF) ===

    // BebasNeue - display font
    Font.register({
        family: 'BebasNeue',
        src: getFontSource('BebasNeue-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: BebasNeue')

    // Anton - display font
    Font.register({
        family: 'Anton',
        src: getFontSource('Anton-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: Anton')

    // ArchivoBlack - display font
    Font.register({
        family: 'ArchivoBlack',
        src: getFontSource('ArchivoBlack-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: ArchivoBlack')

    // Bangers - display font
    Font.register({
        family: 'Bangers',
        src: getFontSource('Bangers-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: Bangers')

    // === SERIF FONTS (valid TTF) ===

    // CrimsonText - serif font
    Font.register({
        family: 'CrimsonText',
        fonts: [
            { src: getFontSource('CrimsonText-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontSource('CrimsonText-Bold.ttf'), fontWeight: 'bold' },
        ],
    })
    console.log('[pdf-fonts] Registered: CrimsonText')

    // === CONDENSED FONTS (valid TTF) ===

    // BarlowCondensed - condensed sans-serif
    Font.register({
        family: 'BarlowCondensed',
        fonts: [
            { src: getFontSource('BarlowCondensed-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontSource('BarlowCondensed-Bold.ttf'), fontWeight: 'bold' },
            { src: getFontSource('BarlowCondensed-Italic.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
        ],
    })
    console.log('[pdf-fonts] Registered: BarlowCondensed')

    // === HANDWRITTEN FONTS (valid TTF) ===

    // IndieFlower - handwritten
    Font.register({
        family: 'IndieFlower',
        src: getFontSource('IndieFlower-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: IndieFlower')

    // PatrickHand - handwritten
    Font.register({
        family: 'PatrickHand',
        src: getFontSource('PatrickHand-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: PatrickHand')

    // PermanentMarker - handwritten/marker style
    Font.register({
        family: 'PermanentMarker',
        src: getFontSource('PermanentMarker-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: PermanentMarker')

    // HennyPenny - decorative handwritten
    Font.register({
        family: 'HennyPenny',
        src: getFontSource('HennyPenny-Regular.ttf'),
    })
    console.log('[pdf-fonts] Registered: HennyPenny')

    // === BUILT-IN FONTS ===
    // Helvetica, Helvetica-Bold, Times-Roman, Courier are built-in to react-pdf
    // No registration needed

    fontsRegistered = true
    console.log('[pdf-fonts] Fonts registered successfully')
}

// Auto-register when this module is imported
registerPdfFonts()
