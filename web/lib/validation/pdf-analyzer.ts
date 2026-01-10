/**
 * PDF Analyzer - Introspection of generated PDFs
 *
 * Analyzes PDFs to check for expected elements without running
 * the visual judge. Uses a lightweight approach of inspecting
 * the React element tree before rendering.
 */

import { ReactElement } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface PDFAnalysisResult {
  fileSize: number
  pageCount: number
  hasImages: boolean
  imageCount: number
  hasMap: boolean
  hasText: boolean
  textContentSample: string[]
  hasPolyline: boolean
  hasSvg: boolean
  elements: ElementCount
}

export interface ElementCount {
  views: number
  texts: number
  images: number
  svgs: number
  pages: number
}

// ============================================================================
// React Element Tree Analysis
// ============================================================================

/**
 * Analyze a React element tree to extract information about what will be rendered
 * This is a lightweight alternative to parsing the actual PDF
 */
export function analyzeReactTree(element: ReactElement): PDFAnalysisResult {
  const elements: ElementCount = {
    views: 0,
    texts: 0,
    images: 0,
    svgs: 0,
    pages: 0,
  }

  const textContent: string[] = []
  let hasMap = false
  let hasPolyline = false

  function traverse(node: unknown): void {
    if (!node) return

    // Handle arrays
    if (Array.isArray(node)) {
      node.forEach(traverse)
      return
    }

    // Handle React elements
    if (typeof node === 'object' && node !== null && 'type' in node) {
      const element = node as { type: unknown; props?: Record<string, unknown>; children?: unknown }
      const typeName = typeof element.type === 'string'
        ? element.type
        : typeof element.type === 'function'
          ? (element.type as { name?: string }).name || 'Component'
          : 'Unknown'

      // Count element types (case-insensitive for react-pdf components)
      const lowerTypeName = typeName.toLowerCase()
      if (lowerTypeName === 'view') elements.views++
      if (lowerTypeName === 'text') elements.texts++
      if (lowerTypeName === 'image') elements.images++
      if (lowerTypeName === 'svg') elements.svgs++
      if (lowerTypeName === 'page') elements.pages++
      if (lowerTypeName === 'polyline') hasPolyline = true

      // Check for map-related props
      if (element.props) {
        const props = element.props as Record<string, unknown>
        if (props.src && typeof props.src === 'string') {
          if (props.src.includes('mapbox') || props.src.includes('map')) {
            hasMap = true
          }
        }
      }

      // Extract text content
      if (lowerTypeName === 'text' && element.props && typeof element.props === 'object') {
        const props = element.props as { children?: unknown }
        if (props.children) {
          const text = extractText(props.children)
          if (text && textContent.length < 10) {
            textContent.push(text.slice(0, 100))
          }
        }
      }

      // Traverse children
      if (element.props && typeof element.props === 'object' && 'children' in element.props) {
        traverse((element.props as { children: unknown }).children)
      }
    }
  }

  traverse(element)

  return {
    fileSize: 0, // Will be set from actual PDF buffer
    pageCount: elements.pages,
    hasImages: elements.images > 0,
    imageCount: elements.images,
    hasMap,
    hasText: elements.texts > 0,
    textContentSample: textContent,
    hasPolyline,
    hasSvg: elements.svgs > 0,
    elements,
  }
}

/**
 * Extract text content from React children
 */
function extractText(children: unknown): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) {
    return children.map(extractText).filter(Boolean).join(' ')
  }
  return ''
}

// ============================================================================
// PDF Buffer Analysis
// ============================================================================

/**
 * Analyze a PDF buffer for basic properties
 * Simple analysis without external dependencies
 */
export function analyzePDFBuffer(buffer: Buffer): {
  fileSize: number
  estimatedPages: number
  hasText: boolean
  hasImages: boolean
} {
  const fileSize = buffer.length

  // Convert to string for text searching
  const content = buffer.toString('binary')

  // Simple heuristic: count PDF page markers
  const pageMatches = content.match(/\/Type\s*\/Page[^s]/g)
  const estimatedPages = pageMatches ? pageMatches.length : 1

  // Check for text content (PDF text operators)
  const hasText = /\/Type\s*\/Font/.test(content) || /\bTj\b|\bTJ\b/.test(content)

  // Check for images (PDF image markers)
  const hasImages = /\/Subtype\s*\/Image/.test(content) || /\/XObject/.test(content)

  return {
    fileSize,
    estimatedPages,
    hasText,
    hasImages,
  }
}

// ============================================================================
// Combined Analysis
// ============================================================================

export interface FullAnalysis extends PDFAnalysisResult {
  renderSuccess: boolean
  renderError?: string
}

/**
 * Combine React tree analysis with PDF buffer analysis
 */
export function combineAnalysis(
  treeAnalysis: PDFAnalysisResult,
  bufferAnalysis: { fileSize: number; estimatedPages: number; hasText: boolean; hasImages: boolean },
  renderSuccess: boolean,
  renderError?: string
): FullAnalysis {
  return {
    ...treeAnalysis,
    fileSize: bufferAnalysis.fileSize,
    pageCount: treeAnalysis.pageCount || bufferAnalysis.estimatedPages,
    // Use buffer analysis for text/images as it's more reliable
    hasText: bufferAnalysis.hasText || treeAnalysis.hasText,
    hasImages: bufferAnalysis.hasImages || treeAnalysis.hasImages,
    renderSuccess,
    renderError,
  }
}
