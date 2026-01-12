/**
 * Photo gallery utilities for PDF generation
 * Handles multi-photo layouts, B&W conversion, and decorative elements
 */

import { StravaActivity } from './strava'
import { resolveImageForPdf } from './pdf-image-loader'
import { BookFormat } from './book-types'

// ============================================================================
// TYPES
// ============================================================================

export interface PhotoData {
    url: string
    caption?: string
    width?: number
    height?: number
    isPortrait?: boolean
}

export type GalleryLayout =
    | 'single-hero'      // Single large photo
    | 'side-by-side'     // Two photos side by side
    | 'triptych'         // Three photos (1 large + 2 small)
    | 'quad-grid'        // Four photos in 2x2 grid
    | 'masonry'          // Asymmetric artistic layout
    | 'filmstrip'        // Horizontal strip layout
    | 'collage'          // Overlapping artistic collage

export interface GalleryLayoutConfig {
    type: GalleryLayout
    slots: LayoutSlot[]
    aspectRatio: number  // Overall container aspect ratio
}

export interface LayoutSlot {
    x: number           // Percentage from left (0-100)
    y: number           // Percentage from top (0-100)
    width: number       // Percentage width (0-100)
    height: number      // Percentage height (0-100)
    rotation?: number   // Degrees of rotation for artistic layouts
    zIndex?: number     // Stacking order for overlapping layouts
}

// ============================================================================
// PHOTO EXTRACTION
// ============================================================================

/**
 * Extract all photos from an activity with their metadata
 */
export function extractPhotos(activity: StravaActivity): PhotoData[] {
    const photos: PhotoData[] = []

    // Check comprehensiveData photos first (preferred)
    if (activity.comprehensiveData?.photos?.length) {
        activity.comprehensiveData.photos.forEach((photo) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const photoAny = photo as any
            const photoUrls = photoAny.urls as Record<string, string> | undefined
            const photoSizes = photoAny.sizes as Record<string, [number, number]> | undefined

            if (photoUrls) {
                // Prefer 5000px, fallback to 600px
                const url = photoUrls['5000'] || photoUrls['600'] || Object.values(photoUrls)[0]
                if (url) {
                    const resolved = resolveImageForPdf(url)
                    if (resolved) {
                        const size = photoSizes?.['5000'] || photoSizes?.['600']
                        const width = size?.[0]
                        const height = size?.[1]
                        photos.push({
                            url: resolved,
                            caption: photoAny.caption || undefined,
                            width,
                            height,
                            isPortrait: width && height ? height > width : undefined
                        })
                    }
                }
            }
        })
    }

    // Fall back to primary photo if no comprehensiveData
    if (photos.length === 0) {
        const primaryUrls = activity.photos?.primary?.urls as Record<string, string> | undefined
        if (primaryUrls) {
            const url = primaryUrls['600'] || primaryUrls['5000'] || Object.values(primaryUrls)[0]
            if (url) {
                const resolved = resolveImageForPdf(url)
                if (resolved) {
                    photos.push({
                        url: resolved,
                        caption: undefined
                    })
                }
            }
        }
    }

    return photos
}

// ============================================================================
// LAYOUT SELECTION
// ============================================================================

/**
 * Select optimal gallery layout based on photo count and characteristics
 */
export function selectGalleryLayout(photos: PhotoData[], preferArtistic = false): GalleryLayout {
    const count = photos.length

    if (count === 0) return 'single-hero'
    if (count === 1) return 'single-hero'
    if (count === 2) return preferArtistic ? 'masonry' : 'side-by-side'
    if (count === 3) return preferArtistic ? 'collage' : 'triptych'
    if (count === 4) return preferArtistic ? 'masonry' : 'quad-grid'

    // 5+ photos: filmstrip or masonry
    return preferArtistic ? 'masonry' : 'filmstrip'
}

/**
 * Get layout configuration for rendering
 */
export function getLayoutConfig(layout: GalleryLayout, photoCount: number): GalleryLayoutConfig {
    switch (layout) {
        case 'single-hero':
            return {
                type: 'single-hero',
                aspectRatio: 4 / 3,
                slots: [
                    { x: 0, y: 0, width: 100, height: 100 }
                ]
            }

        case 'side-by-side':
            return {
                type: 'side-by-side',
                aspectRatio: 16 / 9,
                slots: [
                    { x: 0, y: 0, width: 49, height: 100 },
                    { x: 51, y: 0, width: 49, height: 100 }
                ]
            }

        case 'triptych':
            return {
                type: 'triptych',
                aspectRatio: 4 / 3,
                slots: [
                    { x: 0, y: 0, width: 60, height: 100 },
                    { x: 62, y: 0, width: 38, height: 49 },
                    { x: 62, y: 51, width: 38, height: 49 }
                ]
            }

        case 'quad-grid':
            return {
                type: 'quad-grid',
                aspectRatio: 1,
                slots: [
                    { x: 0, y: 0, width: 49, height: 49 },
                    { x: 51, y: 0, width: 49, height: 49 },
                    { x: 0, y: 51, width: 49, height: 49 },
                    { x: 51, y: 51, width: 49, height: 49 }
                ]
            }

        case 'masonry':
            // Asymmetric artistic layout - varies by photo count
            if (photoCount <= 2) {
                return {
                    type: 'masonry',
                    aspectRatio: 4 / 3,
                    slots: [
                        { x: 0, y: 5, width: 55, height: 90, rotation: -2 },
                        { x: 45, y: 0, width: 55, height: 85, rotation: 3 }
                    ]
                }
            }
            if (photoCount === 3) {
                return {
                    type: 'masonry',
                    aspectRatio: 4 / 3,
                    slots: [
                        { x: 0, y: 8, width: 45, height: 70, rotation: -3 },
                        { x: 35, y: 0, width: 45, height: 65, rotation: 2 },
                        { x: 55, y: 35, width: 45, height: 65, rotation: -1 }
                    ]
                }
            }
            // 4+ photos
            return {
                type: 'masonry',
                aspectRatio: 4 / 3,
                slots: [
                    { x: 0, y: 5, width: 40, height: 55, rotation: -2 },
                    { x: 30, y: 0, width: 42, height: 50, rotation: 2 },
                    { x: 58, y: 10, width: 42, height: 55, rotation: -1 },
                    { x: 15, y: 50, width: 40, height: 50, rotation: 1 },
                    { x: 50, y: 55, width: 48, height: 45, rotation: -2 }
                ].slice(0, photoCount)
            }

        case 'filmstrip':
            // Horizontal strip - equal width slots
            const filmstripCount = Math.min(photoCount, 5)
            const slotWidth = 100 / filmstripCount - 2
            return {
                type: 'filmstrip',
                aspectRatio: filmstripCount * 0.8,
                slots: Array.from({ length: filmstripCount }, (_, i) => ({
                    x: i * (100 / filmstripCount) + 1,
                    y: 0,
                    width: slotWidth,
                    height: 100
                }))
            }

        case 'collage':
            return {
                type: 'collage',
                aspectRatio: 1,
                slots: [
                    { x: 5, y: 5, width: 50, height: 60, rotation: -5, zIndex: 1 },
                    { x: 40, y: 10, width: 55, height: 55, rotation: 8, zIndex: 2 },
                    { x: 20, y: 45, width: 45, height: 50, rotation: -3, zIndex: 3 }
                ].slice(0, photoCount)
            }

        default:
            return getLayoutConfig('single-hero', photoCount)
    }
}

// ============================================================================
// LAYOUT CALCULATIONS
// ============================================================================

/**
 * Calculate actual pixel dimensions for layout slots
 */
export function calculateSlotDimensions(
    slot: LayoutSlot,
    containerWidth: number,
    containerHeight: number
): {
    x: number
    y: number
    width: number
    height: number
    rotation?: number
} {
    return {
        x: (slot.x / 100) * containerWidth,
        y: (slot.y / 100) * containerHeight,
        width: (slot.width / 100) * containerWidth,
        height: (slot.height / 100) * containerHeight,
        rotation: slot.rotation
    }
}

/**
 * Calculate gallery container dimensions based on format and available space
 */
export function calculateGalleryDimensions(
    format: BookFormat,
    availableHeight: number
): {
    width: number
    height: number
} {
    // Use full width minus safe margins
    const width = format.dimensions.width - (2 * format.safeMargin)
    // Use available height or calculate from aspect ratio
    const height = Math.min(availableHeight, width * 0.75) // Max 4:3 aspect

    return { width, height }
}

// ============================================================================
// DECORATIVE ELEMENTS
// ============================================================================

/**
 * Generate decorative stripe pattern for gallery borders
 * Returns SVG path data for horizontal stripes
 */
export function generateDecorativeStripes(
    width: number,
    height: number,
    stripeCount: number = 3
): string[] {
    const stripes: string[] = []
    const stripeHeight = height / (stripeCount * 2 - 1)

    for (let i = 0; i < stripeCount; i++) {
        const y = i * stripeHeight * 2
        stripes.push(`M 0 ${y} L ${width} ${y} L ${width} ${y + stripeHeight} L 0 ${y + stripeHeight} Z`)
    }

    return stripes
}

/**
 * Generate corner decorations for frames
 */
export function generateCornerDecoration(
    size: number,
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
): string {
    const line = size * 0.3

    switch (corner) {
        case 'top-left':
            return `M 0 ${line} L 0 0 L ${line} 0`
        case 'top-right':
            return `M ${size - line} 0 L ${size} 0 L ${size} ${line}`
        case 'bottom-left':
            return `M 0 ${size - line} L 0 ${size} L ${line} ${size}`
        case 'bottom-right':
            return `M ${size - line} ${size} L ${size} ${size} L ${size} ${size - line}`
        default:
            return ''
    }
}

// ============================================================================
// B&W CONVERSION (for server-side processing)
// ============================================================================

/**
 * Check if a photo should be rendered in B&W based on theme/style preferences
 * Note: Actual B&W conversion requires server-side image processing
 */
export function shouldApplyBWFilter(
    index: number,
    totalPhotos: number,
    style: 'all-color' | 'all-bw' | 'alternating' | 'accent-only' = 'all-color'
): boolean {
    switch (style) {
        case 'all-color':
            return false
        case 'all-bw':
            return true
        case 'alternating':
            return index % 2 === 1
        case 'accent-only':
            // Only first photo in color, rest in B&W
            return index > 0
        default:
            return false
    }
}

/**
 * Generate CSS filter string for B&W effect (for preview/web use)
 * Note: react-pdf doesn't support CSS filters, so this is for web preview only
 */
export function getBWFilterStyle(): Record<string, string> {
    return {
        filter: 'grayscale(100%) contrast(1.1)',
        WebkitFilter: 'grayscale(100%) contrast(1.1)'
    }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const GALLERY_LAYOUTS: GalleryLayout[] = [
    'single-hero',
    'side-by-side',
    'triptych',
    'quad-grid',
    'masonry',
    'filmstrip',
    'collage'
]
