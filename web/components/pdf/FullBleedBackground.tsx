/**
 * FullBleedBackground - Primitive for full-page backgrounds in PDF
 *
 * Handles two photo roles:
 * - 'hero': Full opacity image, the photo IS the content (no overlay)
 * - 'background': Faded image with optional dark overlay for text readability
 *
 * Falls back to solid color when no image is provided.
 *
 * Images are cropped to fit the target dimensions (cover behavior):
 * - Landscape image on square page: crops left/right edges
 * - Portrait image on square page: crops top/bottom edges
 * - Image is always centered on the cropped dimension
 */

import { View, Image, StyleSheet } from '@react-pdf/renderer'
import { DEFAULT_EFFECTS } from '@/lib/book-types'

export type PhotoRole = 'hero' | 'background'

export interface FullBleedBackgroundProps {
  /** Image URL (optional - falls back to solid color) */
  image?: string
  /** Fallback color when no image is provided */
  fallbackColor: string
  /** Photo role determines opacity and overlay behavior */
  role?: PhotoRole
  /** Override image opacity (defaults based on role) */
  imageOpacity?: number
  /** Override overlay opacity (only applies to 'background' role) */
  overlayOpacity?: number
  /** Overlay color (defaults to black) */
  overlayColor?: string
  /** Page dimensions */
  width: number
  height: number
}

export const FullBleedBackground = ({
  image,
  fallbackColor,
  role = 'background',
  imageOpacity,
  overlayOpacity,
  overlayColor = 'black',
  width,
  height,
}: FullBleedBackgroundProps) => {
  // Resolve opacities based on role
  const resolvedImageOpacity = imageOpacity ?? (role === 'hero' ? 1.0 : DEFAULT_EFFECTS.backgroundImageOpacity)
  const resolvedOverlayOpacity = overlayOpacity ?? DEFAULT_EFFECTS.textOverlayOpacity

  // Determine if overlay is needed
  // Hero images: no overlay (photo is the content)
  // Background images: use overlay for text readability
  // Solid color: no overlay needed
  const needsOverlay = image && role === 'background'

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
    },
    solidBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
      backgroundColor: fallbackColor,
    },
    // Clipping container for the image - crops overflow
    imageClip: {
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
      overflow: 'hidden',
    },
    // Image uses objectFit: 'cover' to fill container while maintaining aspect ratio
    // Combined with overflow: 'hidden' on parent, this crops the image
    image: {
      width,
      height,
      objectFit: 'cover',
      objectPosition: 'center',
      opacity: resolvedImageOpacity,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
      backgroundColor: overlayColor,
      opacity: resolvedOverlayOpacity,
    },
  })

  return (
    <View style={styles.container}>
      {/* Layer 1: Solid color base (always present as fallback) */}
      <View style={styles.solidBackground} />

      {/* Layer 2: Image in clipping container (if provided) */}
      {image && (
        <View style={styles.imageClip}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={image} style={styles.image} />
        </View>
      )}

      {/* Layer 3: Dark overlay for text readability (background role only) */}
      {needsOverlay && (
        <View style={styles.overlay} />
      )}
    </View>
  )
}

export default FullBleedBackground
