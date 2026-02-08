/**
 * PdfFilmstrip - Primitive for rendering photos in a filmstrip with sprocket holes
 *
 * Renders a vertical (or horizontal) strip of photos with a film sprocket-hole
 * border effect. Handles insufficient photos gracefully:
 * - 5+ photos: Render as filmstrip (ideal case)
 * - 2-4 photos: Cycle through available photos to fill the strip
 * - 0-1 photos: Fall back to single PdfImage filling the same dimensions
 */

import { View, StyleSheet } from '@react-pdf/renderer'
import { PdfImage } from './PdfImage'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'

export interface FilmstripPhoto {
  url: string
  width?: number
  height?: number
}

export interface PdfFilmstripProps {
  /** Photos to display in the filmstrip */
  photos: FilmstripPhoto[]
  /** Strip width in points */
  width: number
  /** Strip height in points */
  height: number
  /** Strip orientation (default: vertical) */
  orientation?: 'vertical' | 'horizontal'
  /** Book format for scaling */
  format: BookFormat
  /** Book theme for colors */
  theme: BookTheme
}

/** Number of sprocket holes per side for vertical filmstrip */
const SPROCKET_COUNT_VERTICAL = 20
/** Number of sprocket holes per side for horizontal filmstrip */
const SPROCKET_COUNT_HORIZONTAL = 15
/** Number of photos to fill the filmstrip */
const TARGET_PHOTO_COUNT = 5
/** Filmstrip border width relative to strip width */
const BORDER_RATIO = 0.12
/** Sprocket hole width relative to border width */
const SPROCKET_WIDTH_RATIO = 0.5
/** Sprocket hole height relative to spacing */
const SPROCKET_HEIGHT_RATIO = 0.4

/**
 * Cycle photos to fill the target count.
 * E.g., [A, B] with target 5 → [A, B, A, B, A]
 */
function cyclePhotos(photos: FilmstripPhoto[], target: number): FilmstripPhoto[] {
  if (photos.length === 0) return []
  if (photos.length >= target) return photos.slice(0, target)
  const result: FilmstripPhoto[] = []
  for (let i = 0; i < target; i++) {
    result.push(photos[i % photos.length])
  }
  return result
}

/**
 * Render sprocket holes along one edge of the filmstrip.
 */
function SprocketHoles({
  count,
  borderWidth,
  stripLength,
  orientation,
  side,
  theme,
}: {
  count: number
  borderWidth: number
  stripLength: number
  orientation: 'vertical' | 'horizontal'
  side: 'start' | 'end'
  theme: BookTheme
}) {
  const sprocketWidth = borderWidth * SPROCKET_WIDTH_RATIO
  const spacing = stripLength / count
  const sprocketHeight = spacing * SPROCKET_HEIGHT_RATIO
  const borderRadius = Math.min(sprocketWidth, sprocketHeight) * 0.25
  const sprocketColor = theme.backgroundColor + 'CC'

  const holes = Array.from({ length: count }, (_, i) => {
    const offset = spacing * i + (spacing - sprocketHeight) / 2

    if (orientation === 'vertical') {
      return (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: offset,
            left: side === 'start'
              ? (borderWidth - sprocketWidth) / 2
              : undefined,
            right: side === 'end'
              ? (borderWidth - sprocketWidth) / 2
              : undefined,
            width: sprocketWidth,
            height: sprocketHeight,
            backgroundColor: sprocketColor,
            borderRadius,
          }}
        />
      )
    }

    // horizontal
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: offset,
          top: side === 'start'
            ? (borderWidth - sprocketWidth) / 2
            : undefined,
          bottom: side === 'end'
            ? (borderWidth - sprocketWidth) / 2
            : undefined,
          width: sprocketHeight,
          height: sprocketWidth,
          backgroundColor: sprocketColor,
          borderRadius,
        }}
      />
    )
  })

  if (orientation === 'vertical') {
    return (
      <View style={{
        position: 'absolute',
        top: 0,
        left: side === 'start' ? 0 : undefined,
        right: side === 'end' ? 0 : undefined,
        width: borderWidth,
        height: stripLength,
      }}>
        {holes}
      </View>
    )
  }

  // horizontal
  return (
    <View style={{
      position: 'absolute',
      left: 0,
      top: side === 'start' ? 0 : undefined,
      bottom: side === 'end' ? 0 : undefined,
      width: stripLength,
      height: borderWidth,
    }}>
      {holes}
    </View>
  )
}

/**
 * PdfFilmstrip renders a strip of photos with film sprocket-hole borders.
 *
 * Falls back to a single PdfImage when fewer than 2 photos are available.
 */
export const PdfFilmstrip = ({
  photos,
  width,
  height,
  orientation = 'vertical',
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: PdfFilmstripProps) => {
  // 0-1 photos: fall back to single PdfImage (no filmstrip effect)
  if (photos.length <= 1) {
    if (photos.length === 0) return null

    const photo = photos[0]
    return (
      <View style={{ width, height, position: 'relative', overflow: 'hidden' }}>
        <PdfImage
          src={photo.url}
          containerWidth={width}
          containerHeight={height}
          sourceWidth={photo.width}
          sourceHeight={photo.height}
        />
      </View>
    )
  }

  // 2+ photos: render filmstrip
  const filmPhotos = cyclePhotos(photos, TARGET_PHOTO_COUNT)
  const borderWidth = Math.round(width * BORDER_RATIO)
  const isVertical = orientation === 'vertical'

  // Available space for photos after subtracting borders
  const photoAreaWidth = isVertical ? width - borderWidth * 2 : width
  const photoAreaHeight = isVertical ? height : height - borderWidth * 2

  // Gap between photos
  const photoGap = 2 * format.scaleFactor
  const photoCount = filmPhotos.length

  // Calculate individual photo dimensions
  let photoWidth: number
  let photoHeight: number

  if (isVertical) {
    photoWidth = photoAreaWidth
    const totalGaps = (photoCount - 1) * photoGap
    photoHeight = (photoAreaHeight - totalGaps) / photoCount
  } else {
    photoHeight = photoAreaHeight
    const totalGaps = (photoCount - 1) * photoGap
    photoWidth = (photoAreaWidth - totalGaps) / photoCount
  }

  const sprocketCount = isVertical ? SPROCKET_COUNT_VERTICAL : SPROCKET_COUNT_HORIZONTAL
  const stripLength = isVertical ? height : width

  const styles = StyleSheet.create({
    container: {
      width,
      height,
      position: 'relative',
      backgroundColor: theme.primaryColor,
      overflow: 'hidden',
    },
    photoArea: {
      position: 'absolute',
      top: isVertical ? 0 : borderWidth,
      left: isVertical ? borderWidth : 0,
      width: photoAreaWidth,
      height: photoAreaHeight,
      flexDirection: isVertical ? 'column' : 'row',
      gap: photoGap,
    },
    photoSlot: {
      width: photoWidth,
      height: photoHeight,
      position: 'relative',
      overflow: 'hidden',
    },
  })

  return (
    <View style={styles.container}>
      {/* Sprocket holes on both edges */}
      <SprocketHoles
        count={sprocketCount}
        borderWidth={borderWidth}
        stripLength={stripLength}
        orientation={orientation}
        side="start"
        theme={theme}
      />
      <SprocketHoles
        count={sprocketCount}
        borderWidth={borderWidth}
        stripLength={stripLength}
        orientation={orientation}
        side="end"
        theme={theme}
      />

      {/* Photos */}
      <View style={styles.photoArea}>
        {filmPhotos.map((photo, idx) => (
          <View key={idx} style={styles.photoSlot}>
            <PdfImage
              src={photo.url}
              containerWidth={photoWidth}
              containerHeight={photoHeight}
              sourceWidth={photo.width}
              sourceHeight={photo.height}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

export default PdfFilmstrip
