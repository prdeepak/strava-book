import React, { useMemo } from 'react'
import { Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * ------------------------------------------------------------------
 * HELPER FUNCTIONS
 * ------------------------------------------------------------------
 */

/**
 * Measures text width using an offscreen canvas.
 * ENVIRONMENT NOTE:
 * - Browser: Uses native <canvas>.
 * - Node.js: Requires the 'canvas' package (npm install canvas) for accurate results.
 * If 'canvas' is missing, falls back to a rough character width approximation.
 */
const getTextWidth = (text: string, fontSize: number, fontFamily: string): number => {
  let canvas: HTMLCanvasElement | { getContext: (type: string) => CanvasRenderingContext2D } | null

  if (typeof document !== 'undefined') {
    // Browser environment
    canvas = document.createElement('canvas')
  } else {
    // Node environment
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createCanvas } = require('canvas')
      canvas = createCanvas(1, 1)
    } catch {
      // Fallback if 'canvas' package is not installed
      canvas = null
    }
  }

  // Safe fallback if canvas isn't available
  if (!canvas) {
    // Rough estimate: average character width is ~0.5 of font size
    return text.length * (fontSize * 0.5)
  }

  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.font = `${fontSize}px ${fontFamily}`
  return context.measureText(text).width
}

/**
 * Simulates word wrapping to check if text fits within dimensions.
 * Returns { fits: boolean }
 */
const calculateLayout = (
  text: string,
  fontSize: number,
  font: string,
  containerWidth: number,
  containerHeight: number
): { fits: boolean } => {
  const words = text.split(' ')
  const spaceWidth = getTextWidth(' ', fontSize, font)
  const lineHeight = fontSize * 1.2 // Standard PDF line-height factor

  let currentLineW = 0
  let lines = 1

  for (const word of words) {
    const wordW = getTextWidth(word, fontSize, font)

    // Fail immediately if a single word is wider than the container
    if (wordW > containerWidth) return { fits: false }

    if (currentLineW + wordW <= containerWidth) {
      currentLineW += wordW + spaceWidth
    } else {
      lines++
      currentLineW = wordW + spaceWidth
    }
  }

  const totalHeight = lines * lineHeight
  return { fits: totalHeight <= containerHeight }
}

/**
 * ------------------------------------------------------------------
 * MAIN COMPONENT
 * ------------------------------------------------------------------
 */

type HorizontalAlign = 'left' | 'center' | 'right' | 'justify'
type VerticalAlign = 'top' | 'middle' | 'bottom'

interface AutoResizingPdfTextProps {
  text: string
  width: number
  height: number
  font?: string
  min_fontsize?: number
  max_fontsize?: number
  h_align?: HorizontalAlign
  v_align?: VerticalAlign
  textColor?: string
  backgroundColor?: string
  backgroundOpacity?: number
}

interface CalculatedState {
  fontSize: number
  text: string
}

export const AutoResizingPdfText = ({
  text,
  width,
  height,
  font = 'Helvetica',
  min_fontsize = 8,
  max_fontsize = 40,
  h_align = 'center',
  v_align = 'middle',
  textColor = 'black',
  backgroundColor = 'transparent',
  backgroundOpacity = 1,
}: AutoResizingPdfTextProps) => {
  const calculatedState = useMemo<CalculatedState>(() => {
    // Helper wrapper for the specific inputs
    const checkFit = (size: number, str: string) =>
      calculateLayout(str, size, font, width, height).fits

    // 1. Quick Check: Does Max Fit?
    if (checkFit(max_fontsize, text)) {
      return { fontSize: max_fontsize, text }
    }

    // 2. Binary Search for Optimal Font Size
    let low = min_fontsize
    let high = max_fontsize
    let optimalSize = min_fontsize

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (checkFit(mid, text)) {
        optimalSize = mid // Fits, try larger
        low = mid + 1
      } else {
        high = mid - 1 // Too big, try smaller
      }
    }

    // 3. Truncation Logic (If text overflows even at min_fontsize)
    // If optimalSize (which might be min_fontsize) doesn't actually fit the full text:
    if (!checkFit(optimalSize, text)) {
      const words = text.split(' ')
      let lowIdx = 0
      let highIdx = words.length - 1
      let validCount = 0

      while (lowIdx <= highIdx) {
        const midIdx = Math.floor((lowIdx + highIdx) / 2)
        const attemptStr = words.slice(0, midIdx + 1).join(' ') + '...'

        if (checkFit(min_fontsize, attemptStr)) {
          validCount = midIdx + 1
          lowIdx = midIdx + 1
        } else {
          highIdx = midIdx - 1
        }
      }

      return {
        fontSize: min_fontsize,
        text: words.slice(0, validCount).join(' ') + '...',
      }
    }

    // 4. Normal Fit
    return { fontSize: optimalSize, text }
  }, [text, width, height, font, min_fontsize, max_fontsize])

  const styles = StyleSheet.create({
    container: {
      width: width,
      height: height,
      position: 'relative',
    },
    background: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: backgroundColor,
      opacity: backgroundOpacity,
    },
    textContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent:
        v_align === 'top' ? 'flex-start' : v_align === 'bottom' ? 'flex-end' : 'center',
    },
    text: {
      fontFamily: font,
      fontSize: calculatedState.fontSize,
      textAlign: h_align,
      color: textColor,
      lineHeight: 1.2,
      margin: 0,
      padding: 0,
    },
  })

  return (
    <View style={styles.container}>
      {/* Layer 1: Background (Independent Opacity) */}
      <View style={styles.background} />

      {/* Layer 2: Text (Fully Opaque) */}
      <View style={styles.textContainer}>
        <Text style={styles.text}>{calculatedState.text}</Text>
      </View>
    </View>
  )
}

export default AutoResizingPdfText
