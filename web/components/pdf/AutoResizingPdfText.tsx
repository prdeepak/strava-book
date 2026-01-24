import { Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * ------------------------------------------------------------------
 * HELPER FUNCTIONS
 * ------------------------------------------------------------------
 */

/**
 * Estimates text width based on character count and font size.
 * This is a simplified approach that works well for react-pdf since:
 * 1. react-pdf handles actual text layout during rendering
 * 2. This is just used for pre-calculating optimal font sizes
 * 3. Avoids dependencies on canvas (Node.js native module)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getTextWidth = (text: string, fontSize: number, _fontFamily: string): number => {
  // Average character width varies by font, but ~0.55 of font size is reasonable
  // for most fonts used in PDF generation (sans-serif tends to be ~0.5, serif ~0.55)
  const avgCharWidth = fontSize * 0.55
  return text.length * avgCharWidth
}

/**
 * Simulates word wrapping to check if text fits within dimensions.
 * Returns { fits: boolean, textWidth: number, textHeight: number }
 */
const calculateLayout = (
  text: string,
  fontSize: number,
  font: string,
  containerWidth: number,
  containerHeight: number
): { fits: boolean; textWidth: number; textHeight: number } => {
  const words = text.split(' ')
  const spaceWidth = getTextWidth(' ', fontSize, font)
  const lineHeight = fontSize * 1.2 // Standard PDF line-height factor

  let currentLineW = 0
  let maxLineWidth = 0
  let lines = 1

  for (const word of words) {
    const wordW = getTextWidth(word, fontSize, font)

    // Fail immediately if a single word is wider than the container
    if (wordW > containerWidth) {
      return { fits: false, textWidth: wordW, textHeight: lineHeight }
    }

    if (currentLineW + wordW <= containerWidth) {
      currentLineW += wordW + spaceWidth
    } else {
      // Track max width before wrapping
      maxLineWidth = Math.max(maxLineWidth, currentLineW - spaceWidth)
      lines++
      currentLineW = wordW + spaceWidth
    }
  }

  // Account for the last line
  maxLineWidth = Math.max(maxLineWidth, currentLineW - spaceWidth)
  const totalHeight = lines * lineHeight

  return {
    fits: totalHeight <= containerHeight,
    textWidth: Math.min(maxLineWidth, containerWidth),
    textHeight: totalHeight,
  }
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
  /** When true (default), background hugs the text. When false, fills entire container. */
  resize_to_text?: boolean
  /** Padding around text when resize_to_text is true. Default: 8 */
  text_padding?: number
  /** Font style: normal or italic. Default: normal */
  fontStyle?: 'normal' | 'italic'
}

interface CalculatedState {
  fontSize: number
  text: string
  textWidth: number
  textHeight: number
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
  backgroundOpacity = 0,
  resize_to_text = true,
  text_padding = 8,
  fontStyle = 'normal',
}: AutoResizingPdfTextProps) => {
  // Note: react-pdf doesn't support React hooks, so we compute directly
  // Helper wrapper for the specific inputs
  const getLayout = (size: number, str: string) =>
    calculateLayout(str, size, font, width, height)

  // Calculate state directly (no useMemo - react-pdf doesn't support hooks)
  const calculatedState: CalculatedState = (() => {
    // 1. Quick Check: Does Max Fit?
    const maxLayout = getLayout(max_fontsize, text)
    if (maxLayout.fits) {
      return {
        fontSize: max_fontsize,
        text,
        textWidth: maxLayout.textWidth,
        textHeight: maxLayout.textHeight,
      }
    }

    // 2. Binary Search for Optimal Font Size
    let low = min_fontsize
    let high = max_fontsize
    let optimalSize = min_fontsize

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (getLayout(mid, text).fits) {
        optimalSize = mid // Fits, try larger
        low = mid + 1
      } else {
        high = mid - 1 // Too big, try smaller
      }
    }

    // 3. Truncation Logic (If text overflows even at min_fontsize)
    // If optimalSize (which might be min_fontsize) doesn't actually fit the full text:
    const optimalLayout = getLayout(optimalSize, text)
    if (!optimalLayout.fits) {
      const words = text.split(' ')
      let lowIdx = 0
      let highIdx = words.length - 1
      let validCount = 0

      while (lowIdx <= highIdx) {
        const midIdx = Math.floor((lowIdx + highIdx) / 2)
        const attemptStr = words.slice(0, midIdx + 1).join(' ') + '...'

        if (getLayout(min_fontsize, attemptStr).fits) {
          validCount = midIdx + 1
          lowIdx = midIdx + 1
        } else {
          highIdx = midIdx - 1
        }
      }

      const truncatedText = words.slice(0, validCount).join(' ') + '...'
      const truncatedLayout = getLayout(min_fontsize, truncatedText)

      return {
        fontSize: min_fontsize,
        text: truncatedText,
        textWidth: truncatedLayout.textWidth,
        textHeight: truncatedLayout.textHeight,
      }
    }

    // 4. Normal Fit
    return {
      fontSize: optimalSize,
      text,
      textWidth: optimalLayout.textWidth,
      textHeight: optimalLayout.textHeight,
    }
  })()

  // Calculate background dimensions and position when resize_to_text is enabled
  const bgWidth = calculatedState.textWidth + 2 * text_padding
  const bgHeight = calculatedState.textHeight + 2 * text_padding

  // Calculate horizontal position based on alignment
  const getHorizontalPosition = () => {
    if (!resize_to_text) return { left: 0 }
    switch (h_align) {
      case 'left':
        return { left: 0 }
      case 'right':
        return { right: 0 }
      case 'center':
      case 'justify':
      default:
        return { left: (width - bgWidth) / 2 }
    }
  }

  // Calculate vertical position based on alignment
  const getVerticalPosition = () => {
    if (!resize_to_text) return { top: 0 }
    switch (v_align) {
      case 'top':
        return { top: 0 }
      case 'bottom':
        return { bottom: 0 }
      case 'middle':
      default:
        return { top: (height - bgHeight) / 2 }
    }
  }

  const styles = StyleSheet.create({
    container: {
      width: width,
      height: height,
      position: 'relative',
    },
    background: {
      position: 'absolute',
      ...getHorizontalPosition(),
      ...getVerticalPosition(),
      width: resize_to_text ? bgWidth : '100%',
      height: resize_to_text ? bgHeight : '100%',
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
      fontStyle: fontStyle,
    },
  })

  return (
    <View style={styles.container}>
      {/* Layer 1: Background (Independent Opacity) */}
      <View style={styles.background} />

      {/* Layer 2: Text (Fully Opaque) */}
      <View style={styles.textContainer}>
        <Text style={styles.text} hyphenationCallback={() => []}>{calculatedState.text}</Text>
      </View>
    </View>
  )
}

export default AutoResizingPdfText
