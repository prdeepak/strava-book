/**
 * PdfImage - Primitive for images in react-pdf with "cover" behavior
 *
 * IMPORTANT: react-pdf does NOT support objectFit or objectPosition.
 * This component provides "cover" behavior: fills the container while
 * maintaining aspect ratio, cropping excess, and centering the image.
 *
 * Usage:
 * 1. Wrap in a container with known dimensions and position: 'relative'
 * 2. Use PdfImage inside with container dimensions for precise aspect-fill
 *
 * Example (precise mode - recommended):
 * ```tsx
 * <View style={{ width: 300, height: 200, position: 'relative', overflow: 'hidden' }}>
 *   <PdfImage
 *     src={imageUrl}
 *     containerWidth={300}
 *     containerHeight={200}
 *     sourceWidth={1920}
 *     sourceHeight={1080}
 *   />
 * </View>
 * ```
 *
 * Example (fallback mode - when source dimensions unknown):
 * ```tsx
 * <View style={{ width: 300, height: 200, position: 'relative' }}>
 *   <PdfImage src={imageUrl} />
 * </View>
 * ```
 *
 * How precise mode works:
 * - Uses calculateAspectFill to compute exact scale and offset
 * - Positions image with negative margins to center the cropped area
 * - Container clips overflow to show only the centered portion
 *
 * Fallback mode (no dimensions):
 * - Uses minWidth/minHeight: 100% with flexbox centering
 * - Less precise but works when source dimensions are unknown
 */

import { Image, View, StyleSheet } from '@react-pdf/renderer'
import { calculateAspectFill } from '@/lib/photo-utils'

export interface PdfImageProps {
  /** Image URL */
  src: string
  /** Optional opacity (0-1). Default: 1 */
  opacity?: number
  /** Optional border radius */
  borderRadius?: number
  /** Container width in points (for precise aspect-fill) */
  containerWidth?: number
  /** Container height in points (for precise aspect-fill) */
  containerHeight?: number
  /** Source image width in pixels (for precise aspect-fill) */
  sourceWidth?: number
  /** Source image height in pixels (for precise aspect-fill) */
  sourceHeight?: number
}

/**
 * PdfImage provides "cover" behavior: fills container, maintains aspect ratio,
 * crops excess, and centers the image.
 *
 * For precise positioning, provide all four dimension props.
 * Parent must have: position: 'relative' and overflow: 'hidden'
 */
export const PdfImage = ({
  src,
  opacity = 1,
  borderRadius,
  containerWidth,
  containerHeight,
  sourceWidth,
  sourceHeight,
}: PdfImageProps) => {
  // Precise mode: use calculateAspectFill when all dimensions are known
  const hasDimensions = containerWidth && containerHeight && sourceWidth && sourceHeight

  if (hasDimensions) {
    // Calculate geometry without buffer first
    const geometry = calculateAspectFill(
      { width: sourceWidth, height: sourceHeight },
      { width: containerWidth, height: containerHeight }
    )

    const styles = StyleSheet.create({
      container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        overflow: 'hidden',
        ...(borderRadius !== undefined ? { borderRadius } : {}),
      },
      image: {
        position: 'absolute',
        // Position image so the center is visible
        // Negative offset moves image left/up to center the crop
        left: -geometry.cropOffset.x,
        top: -geometry.cropOffset.y,
        width: geometry.scaledSize.width,
        height: geometry.scaledSize.height,
        opacity,
      },
    })

    return (
      <View style={styles.container}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
        <Image src={src} style={styles.image} />
      </View>
    )
  }

  // Fallback mode: use CSS-based approach when dimensions unknownn (will squish image)
  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...(borderRadius !== undefined ? { borderRadius } : {}),
    },
    image: {
      minWidth: '100%',
      minHeight: '100%',
      opacity,
    },
  })

  return (
    <View style={styles.container}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop */}
      <Image src={src} style={styles.image} />
    </View>
  )
}

export default PdfImage
