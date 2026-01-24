/**
 * PdfImage - Primitive for images in react-pdf with "cover" behavior
 *
 * IMPORTANT: react-pdf does NOT support objectFit or objectPosition.
 * This component provides "cover" behavior: fills the container while
 * maintaining aspect ratio, cropping excess, and centering the image.
 *
 * Usage:
 * 1. Wrap in a container with known dimensions and position: 'relative'
 * 2. Use PdfImage inside - it handles overflow, centering, and cropping
 *
 * Example:
 * ```tsx
 * <View style={{ width: 300, height: 200, position: 'relative' }}>
 *   <PdfImage src={imageUrl} />
 * </View>
 * ```
 *
 * How it works:
 * - Creates an absolutely positioned flex container that fills the parent
 * - Uses flexbox centering (alignItems/justifyContent: center) to center the image
 * - Sets minWidth/minHeight: 100% so image fills container in both dimensions
 * - overflow: hidden clips the excess while keeping the center visible
 */

import { Image, View, StyleSheet } from '@react-pdf/renderer'

export interface PdfImageProps {
  /** Image URL */
  src: string
  /** Optional opacity (0-1). Default: 1 */
  opacity?: number
  /** Optional border radius */
  borderRadius?: number
}

/**
 * PdfImage provides "cover" behavior: fills container, maintains aspect ratio,
 * crops excess, and centers the image.
 * Parent must have: position: 'relative' (or be a flex container)
 */
export const PdfImage = ({
  src,
  opacity = 1,
  borderRadius,
}: PdfImageProps) => {
  const styles = StyleSheet.create({
    // Flex container for centering - fills parent and clips overflow
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
    // Image with minWidth/minHeight ensures it covers the container
    // while maintaining aspect ratio - excess is clipped by parent
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
