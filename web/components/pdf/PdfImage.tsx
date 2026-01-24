/**
 * PdfImage - Primitive for images in react-pdf
 *
 * IMPORTANT: react-pdf does NOT support objectFit or objectPosition.
 * This component provides the correct pattern for filling a container with an image.
 *
 * Usage:
 * 1. Wrap in a container with known dimensions, overflow: 'hidden', position: 'relative'
 * 2. Use PdfImage inside - it will fill the container using absolute positioning
 *
 * Example:
 * ```tsx
 * <View style={{ width: 300, height: 200, overflow: 'hidden', position: 'relative' }}>
 *   <PdfImage src={imageUrl} />
 * </View>
 * ```
 *
 * Note: This fills the container but may stretch the image if aspect ratios differ.
 * For most activity photos (landscape), this works well. For precise cover behavior,
 * you'd need to know image dimensions ahead of time.
 */

import { Image, StyleSheet } from '@react-pdf/renderer'

export interface PdfImageProps {
  /** Image URL */
  src: string
  /** Optional opacity (0-1). Default: 1 */
  opacity?: number
  /** Optional border radius */
  borderRadius?: number
}

/**
 * PdfImage fills its parent container using absolute positioning.
 * Parent must have: overflow: 'hidden', position: 'relative'
 */
export const PdfImage = ({
  src,
  opacity = 1,
  borderRadius,
}: PdfImageProps) => {
  const styles = StyleSheet.create({
    image: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity,
      ...(borderRadius !== undefined ? { borderRadius } : {}),
    },
  })

  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image doesn't support alt prop
  return <Image src={src} style={styles.image} />
}

export default PdfImage
