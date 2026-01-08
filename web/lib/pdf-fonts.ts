/**
 * PDF Font Registration
 *
 * Registers all fonts needed for PDF generation with @react-pdf/renderer.
 * This module must be imported before rendering any PDF that uses custom fonts.
 */

import { Font } from '@react-pdf/renderer'
import path from 'path'

// Determine font path based on environment
const getFontPath = (filename: string): string => {
    // In Next.js API routes, we need to use the file system path
    // process.cwd() gives us the project root
    return path.join(process.cwd(), 'public', 'fonts', filename)
}

// Track if fonts have been registered to avoid duplicate registration
let fontsRegistered = false

/**
 * Register all fonts needed for PDF generation.
 * Safe to call multiple times - will only register once.
 */
export function registerPdfFonts(): void {
    if (fontsRegistered) return

    console.log('[pdf-fonts] Registering fonts...')

    // Register emoji source
    Font.registerEmojiSource({
        format: 'png',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
    })

    // === SANS-SERIF FONTS ===

    // Montserrat
    Font.register({
        family: 'Montserrat',
        fonts: [
            { src: getFontPath('Montserrat-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('Montserrat-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // OpenSans
    Font.register({
        family: 'OpenSans',
        fonts: [
            { src: getFontPath('OpenSans-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('OpenSans-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // Roboto
    Font.register({
        family: 'Roboto',
        fonts: [
            { src: getFontPath('Roboto-Light.ttf'), fontWeight: 'light' },
            { src: getFontPath('Roboto-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('Roboto-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // Inter
    Font.register({
        family: 'Inter',
        fonts: [
            { src: getFontPath('Inter-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('Inter-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // Oswald
    Font.register({
        family: 'Oswald',
        fonts: [
            { src: getFontPath('Oswald-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('Oswald-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // === DISPLAY FONTS ===

    // BebasNeue
    Font.register({
        family: 'BebasNeue',
        src: getFontPath('BebasNeue-Regular.ttf'),
    })

    // Anton
    Font.register({
        family: 'Anton',
        src: getFontPath('Anton-Regular.ttf'),
    })

    // Righteous
    Font.register({
        family: 'Righteous',
        src: getFontPath('Righteous-Regular.ttf'),
    })

    // ArchivoBlack
    Font.register({
        family: 'ArchivoBlack',
        src: getFontPath('ArchivoBlack-Regular.ttf'),
    })

    // Bangers
    Font.register({
        family: 'Bangers',
        src: getFontPath('Bangers-Regular.ttf'),
    })

    // === SERIF FONTS ===

    // Merriweather
    Font.register({
        family: 'Merriweather',
        fonts: [
            { src: getFontPath('Merriweather-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('Merriweather-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // Playfair Display
    Font.register({
        family: 'PlayfairDisplay',
        fonts: [
            { src: getFontPath('PlayfairDisplay-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('PlayfairDisplay-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // Lora
    Font.register({
        family: 'Lora',
        fonts: [
            { src: getFontPath('Lora-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('Lora-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // CrimsonText
    Font.register({
        family: 'CrimsonText',
        fonts: [
            { src: getFontPath('CrimsonText-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('CrimsonText-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // === HANDWRITTEN FONTS ===

    // IndieFlower
    Font.register({
        family: 'IndieFlower',
        src: getFontPath('IndieFlower-Regular.ttf'),
    })

    // PatrickHand
    Font.register({
        family: 'PatrickHand',
        src: getFontPath('PatrickHand-Regular.ttf'),
    })

    // Caveat
    Font.register({
        family: 'Caveat',
        src: getFontPath('Caveat-Regular.ttf'),
    })

    // PermanentMarker
    Font.register({
        family: 'PermanentMarker',
        src: getFontPath('PermanentMarker-Regular.ttf'),
    })

    // ShadowsIntoLight
    Font.register({
        family: 'ShadowsIntoLight',
        src: getFontPath('ShadowsIntoLight-Regular.ttf'),
    })

    // DancingScript
    Font.register({
        family: 'DancingScript',
        fonts: [
            { src: getFontPath('DancingScript-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('DancingScript-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // === MONOSPACE FONTS ===

    // RobotoMono
    Font.register({
        family: 'RobotoMono',
        fonts: [
            { src: getFontPath('RobotoMono-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('RobotoMono-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // SourceCodePro
    Font.register({
        family: 'SourceCodePro',
        fonts: [
            { src: getFontPath('SourceCodePro-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('SourceCodePro-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // === CONDENSED FONTS ===

    // RobotoCondensed
    Font.register({
        family: 'RobotoCondensed',
        fonts: [
            { src: getFontPath('RobotoCondensed-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('RobotoCondensed-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // BarlowCondensed
    Font.register({
        family: 'BarlowCondensed',
        fonts: [
            { src: getFontPath('BarlowCondensed-Regular.ttf'), fontWeight: 'normal' },
            { src: getFontPath('BarlowCondensed-Bold.ttf'), fontWeight: 'bold' },
        ],
    })

    // Register Helvetica as fallback (built-in)
    // No need to register - it's a default font in react-pdf

    fontsRegistered = true
    console.log('[pdf-fonts] Fonts registered successfully')
}

// Auto-register when this module is imported
registerPdfFonts()
